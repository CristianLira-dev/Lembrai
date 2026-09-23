import json
import os
import unittest
from datetime import datetime
from unittest.mock import patch

from aplicativo.esquemas.modelos import ContextoEntrada, ConversaEntrada, MensagemEntrada, RequisicaoProcessamento, UsuarioEntrada
from aplicativo.servicos.openrouter import processar


class TesteOpenRouter(unittest.TestCase):
    def requisicao(self, texto="trabalho de redes dia 20/10"):
        return RequisicaoProcessamento(
            user=UsuarioEntrada(id="auth-1", name="Estudante", timezone="America/Sao_Paulo"),
            conversation=ConversaEntrada(id="conv-1"),
            message=MensagemEntrada(id="msg-1", content=texto, receivedAt=datetime(2026, 9, 21, 12, 0)),
            context=ContextoEntrada(
                recentTasks=[{"titulo": "Prova", "materia": "Matemática", "dataEntrega": "2026-10-20T22:00:00Z", "telefone": "não-enviar"}],
                subjects=["Matemática"], reminderTime="07:27"),
        )

    @patch.dict(os.environ, {"OPENROUTER_API_KEY": "teste", "OPENROUTER_MODEL": "openrouter/free"}, clear=False)
    def test_usa_saida_estruturada_sem_dados_pessoais(self):
        capturado = {}

        def transporte(payload, chave):
            capturado.update(payload)
            conteudo = {
                "intent": "create_task", "confidence": 0.98, "title": "Trabalho",
                "subject": "Redes", "dueDate": "2026-10-20", "dueTime": None,
                "type": "assignment", "reference": None, "reminderTime": None,
            }
            return {"id": "gen-1", "model": "modelo-gratis", "choices": [{"message": {"content": json.dumps(conteudo)}}], "usage": {"total_tokens": 20}}

        resposta = processar(self.requisicao(), transporte)
        self.assertEqual(resposta.intent, "create_task")
        self.assertFalse(resposta.requiresConfirmation)
        self.assertEqual(resposta.generation["status"], "complete")
        enviado = capturado["messages"][1]["content"]
        self.assertNotIn("auth-1", enviado)
        self.assertNotIn("conv-1", enviado)
        self.assertNotIn("não-enviar", enviado)
        self.assertTrue(capturado["provider"]["require_parameters"])
        self.assertEqual(capturado["response_format"]["type"], "json_schema")

    @patch.dict(os.environ, {"OPENROUTER_API_KEY": "teste", "OPENROUTER_MODEL": "openai/gpt-4o"}, clear=False)
    def test_bloqueia_modelo_pago(self):
        chamado = False

        def transporte(payload, chave):
            nonlocal chamado
            chamado = True
            return {}

        resposta = processar(self.requisicao(), transporte)
        self.assertFalse(chamado)
        self.assertEqual(resposta.intent, "create_task")

    @patch.dict(os.environ, {"OPENROUTER_API_KEY": "teste", "OPENROUTER_MODEL": "openrouter/free"}, clear=False)
    def test_fallback_quando_provedor_falha(self):
        def transporte(payload, chave):
            raise TimeoutError()

        resposta = processar(self.requisicao(), transporte)
        self.assertEqual(resposta.intent, "create_task")
        self.assertEqual(resposta.generation["status"], "fallback")


if __name__ == "__main__":
    unittest.main()
