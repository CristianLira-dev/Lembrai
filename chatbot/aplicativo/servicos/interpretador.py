"""Intérprete local conservador; confirmações e execução pertencem ao backend."""
import re
import unicodedata
from datetime import date

from aplicativo.entidades.datas import combinar_data_horario, extrair_data, extrair_horario
from aplicativo.esquemas.modelos import RequisicaoProcessamento, RespostaProcessamento, TarefaInterpretada

FORA_ESCOPO = "Esse assunto eu não consigo ajudar por aqui. Mas se quiser registrar uma atividade, concluir alguma ou ver suas pendências, é comigo!"
FALHA_IA = "Não consegui entender agora. Tenta de novo em instantes?"
TIPOS = {"prova": ("exam", "Prova"), "trabalho": ("assignment", "Trabalho"), "tarefa": ("task", "Tarefa"), "atividade": ("task", "Atividade"), "seminário": ("other", "Seminário"), "aula": ("class", "Aula")}


def sem_acentos(texto: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn")


def comando_explicito(texto: str) -> str | None:
    baixo = sem_acentos(texto.lower()).strip(" .!?")
    if re.fullmatch(r"sim|s|confirmo|pode|pode sim|pode registrar|pode salvar|pode concluir|pode alterar|ok|confirmado|fechado", baixo):
        return "confirm"
    if re.fullmatch(r"nao|n|cancelar|cancela|deixa pra la|nao quero", baixo):
        return "cancel"
    return None


def resultado(intent, **campos):
    return RespostaProcessamento(intent=intent, confidence=campos.pop("confidence", 0.95), response=campos.pop("response", ""), **campos)


def interpretar(req: RequisicaoProcessamento) -> RespostaProcessamento:
    texto = req.message.content.strip()
    baixo = sem_acentos(texto.lower())
    comando = comando_explicito(texto)
    if comando:
        return resultado(comando)
    # Palavras acadêmicas em uma pergunta geral não autorizam criar atividades.
    if re.search(r"\b(explique|explica|resolva|resolve|normalizacao|ignore.*instruc|piada|noticias|opiniao)\b", baixo):
        return resultado("unknown", response=FORA_ESCOPO)
    pendente = req.context.pendingAction or {}
    dados = pendente.get("task") or {}
    data, _ = extrair_data(texto, req.user.timezone, req.message.receivedAt)
    horario, _ = extrair_horario(texto)
    if "lembrete" in baixo or pendente.get("intent") == "set_reminder_time":
        if horario or re.search(r"\b(mudar|alterar|trocar|receber|envie|manda)\b", baixo) or pendente.get("intent") == "set_reminder_time":
            return resultado("set_reminder_time", reminderTime=horario, requiresConfirmation=True)
        return resultado("get_reminder_time")
    materia_nova = re.fullmatch(r"(?:quero\s+)?(?:cadastrar|cadastre|registrar|registre|adicionar|adicione)\s+(?:a\s+)?(?:materia|disciplina)\s*(.*)", baixo)
    if materia_nova:
        nome = texto[-len(materia_nova.group(1)):].strip(" .") if materia_nova.group(1) else None
        return resultado("create_subject", subject=nome, requiresConfirmation=True)
    if pendente.get("intent") == "create_subject":
        return resultado("create_subject", subject=texto.strip(" ."), requiresConfirmation=True)
    if any(x in baixo for x in ("minhas materias", "materias cadastradas", "minhas disciplinas")):
        return resultado("list_subjects")
    if re.search(r"^(?:o que tenho|tarefas|agenda|atividades|pendencias).*hoje", baixo):
        return resultado("list_today")
    if re.search(r"^(?:o que tenho|tarefas|agenda|atividades|pendencias).*semana", baixo):
        return resultado("list_week")
    if "proxima prova" in baixo:
        return resultado("next_exam")
    if re.search(r"\batrasad[ao]s?\b", baixo):
        return resultado("list_overdue")
    if re.search(r"\b(pendencias|pendentes)\b", baixo) or baixo in ("minha agenda", "minhas tarefas"):
        return resultado("list_pending")
    concluida = re.match(r"^(?:terminei|conclui|finalizei|concluir)\s+(.*)", texto, re.IGNORECASE)
    if concluida:
        return resultado("complete_task", reference=concluida.group(1), requiresConfirmation=True)
    tipo, rotulo = next((valor for chave, valor in TIPOS.items() if re.search(rf"\b{sem_acentos(chave)}\b", baixo)), ("task", ""))
    if not rotulo and pendente.get("intent") != "create_task":
        return resultado("unknown", response=FORA_ESCOPO)
    if pendente.get("intent") == "create_task":
        tarefa = TarefaInterpretada(**dados)
        if data:
            tarefa.dueDate = data.isoformat()
        elif not tarefa.subject and len(texto.split()) <= 8:
            tarefa.subject = texto.strip(" .").title()
        elif not tarefa.title:
            tarefa.title = texto.strip(" .")
        if horario:
            tarefa.dueTime = horario
    else:
        materia = re.search(r"\b(?:de|da|do)\s+(.+?)(?=\s+(?:para|no dia|dia\s+\d|amanh[ãa]|hoje|sexta|s[áa]bado|domingo|segunda|ter[cç]a|quarta|quinta|[àa]s\s+\d|\d{1,2}[/:])|$)", texto, re.IGNORECASE)
        tarefa = TarefaInterpretada(title=rotulo, type=tipo, subject=materia.group(1).strip(" .,!?;").title() if materia else None, dueDate=data.isoformat() if data else None, dueTime=horario)
    tarefa.timezone = req.user.timezone
    if tarefa.dueDate:
        tarefa.dueDateTime = combinar_data_horario(date.fromisoformat(tarefa.dueDate), tarefa.dueTime, req.user.timezone)
    faltantes = [campo for campo in ("title", "subject", "dueDate") if not getattr(tarefa, campo)]
    perguntas = {"title": "Qual é o nome da atividade?", "subject": "Qual é a matéria?", "dueDate": "Qual é a data de entrega?"}
    return resultado("create_task", task=tarefa, requiresConfirmation=True, missingFields=faltantes, response=perguntas[faltantes[0]] if faltantes else "Confirma o registro?")
