"""Interpretação estruturada com orçamento exclusivamente gratuito e fallback local."""
import json
import logging
import os
import uuid
from datetime import date
from typing import Literal
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, ValidationError
from aplicativo.entidades.datas import combinar_data_horario
from aplicativo.esquemas.modelos import TarefaInterpretada
from aplicativo.prompts.lembrai import IDENTIDADE
from aplicativo.servicos.interpretador import comando_explicito, interpretar, resultado, FORA_ESCOPO

log = logging.getLogger("lembrai.ia")


class PropostaIA(BaseModel):
    model_config = ConfigDict(extra="forbid")
    intent: Literal["create_task", "create_subject", "edit_task", "complete_task", "delete_task",
                    "list_pending", "list_today", "list_week", "next_exam", "list_overdue",
                    "list_subjects", "get_reminder_time", "set_reminder_time", "unknown"]
    confidence: float = Field(ge=0, le=1)
    title: str | None = Field(max_length=180)
    subject: str | None = Field(max_length=120)
    dueDate: str | None = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    dueTime: str | None = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    type: Literal["exam", "assignment", "task", "class", "appointment", "other"]
    reference: str | None = Field(max_length=300)
    reminderTime: str | None = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")


def contexto_minimo(req):
    # Nunca mandar telefone, email, senha, tokens, ids de banco ou histórico alheio.
    pendente = req.context.pendingAction or {}
    tarefa = pendente.get("task") or {}
    return {
        "conta": "existente",
        "data_atual": req.message.receivedAt.astimezone(ZoneInfo(req.user.timezone)).isoformat(),
        "fuso": req.user.timezone,
        "horario_padrao": req.context.reminderTime,
        "materias": req.context.subjects[:80],
        "acao_pendente": {
            "intent": pendente.get("intent"),
            "task": {k: tarefa.get(k) for k in ("title", "subject", "type", "dueDate", "dueTime")},
            "reference": pendente.get("reference"),
            "reminderTime": pendente.get("reminderTime"),
        } if pendente else None,
        "atividades": [
            {k: t.get(k) for k in ("titulo", "materia", "dataEntrega", "horarioEntrega", "status")}
            for t in req.context.recentTasks[:50]
        ],
        "mensagem": req.message.content,
    }


def chamar_openrouter(payload, chave):
    requisicao = Request("https://openrouter.ai/api/v1/chat/completions",
                        data=json.dumps(payload).encode("utf-8"), method="POST",
                        headers={"Content-Type": "application/json", "Authorization": f"Bearer {chave}"})
    with urlopen(requisicao, timeout=20) as resposta:
        corpo = resposta.read(262145)
        if len(corpo) > 262144:
            raise ValueError("resposta_excessiva")
        return json.loads(corpo)


def processar(req, transporte=None):
    if comando_explicito(req.message.content):
        return interpretar(req)
    chave = os.getenv("OPENROUTER_API_KEY", "").strip()
    modelo = os.getenv("OPENROUTER_MODEL", "openrouter/free").strip()
    if not chave:
        return interpretar(req)
    # Não permitir ativação acidental de modelos pagos ou fallback pago.
    if modelo != "openrouter/free" and not modelo.endswith(":free"):
        log.warning("ia_configuracao: modelo_pago_bloqueado")
        return interpretar(req)
    geracao = {"id": str(uuid.uuid4()), "provider": "openrouter", "status": "pending", "model": modelo}
    payload = {
        "model": modelo,
        "messages": [{"role": "system", "content": IDENTIDADE},
                     {"role": "user", "content": json.dumps(contexto_minimo(req), ensure_ascii=False)}],
        "response_format": {"type": "json_schema", "json_schema": {
            "name": "lembrai_intencao", "strict": True, "schema": PropostaIA.model_json_schema()}},
        "provider": {"require_parameters": True},
        "max_tokens": 1000,
        "temperature": 0,
    }
    try:
        resposta = (transporte or chamar_openrouter)(payload, chave)
        conteudo = resposta["choices"][0]["message"]["content"]
        proposta = PropostaIA.model_validate_json(conteudo)
        if proposta.dueDate:
            date.fromisoformat(proposta.dueDate)
        geracao.update(status="complete", model=resposta.get("model", modelo),
                       providerId=resposta.get("id"), usage=resposta.get("usage", {}),
                       result=proposta.model_dump())
        if proposta.intent == "unknown" or proposta.confidence < 0.65:
            return resultado("unknown", response=FORA_ESCOPO, generation=geracao)
        tarefa = None
        if proposta.intent in ("create_task", "edit_task"):
            tarefa = TarefaInterpretada(
                title=proposta.title, subject=proposta.subject, type=proposta.type,
                dueDate=proposta.dueDate, dueTime=proposta.dueTime, timezone=req.user.timezone,
                dueDateTime=combinar_data_horario(date.fromisoformat(proposta.dueDate), proposta.dueTime, req.user.timezone) if proposta.dueDate else None)
        return resultado(proposta.intent, confidence=proposta.confidence, task=tarefa,
                         reference=proposta.reference, subject=proposta.subject,
                         reminderTime=proposta.reminderTime, generation=geracao,
                         requiresConfirmation=proposta.intent in ("create_subject", "edit_task", "delete_task", "set_reminder_time"))
    except (HTTPError, URLError, TimeoutError, OSError, ValueError, KeyError, IndexError, TypeError, ValidationError) as erro:
        # Não registrar payload, chave, cabeçalhos, mensagem nem corpo do provedor.
        codigo = erro.code if isinstance(erro, HTTPError) else type(erro).__name__
        log.warning("ia_indisponivel: %s", codigo)
        fallback = interpretar(req)
        fallback.generation = {**geracao, "status": "fallback", "errorCode": str(codigo)}
        return fallback
