import unittest
from datetime import datetime
from aplicativo.esquemas.modelos import ContextoEntrada, ConversaEntrada, MensagemEntrada, RequisicaoProcessamento, UsuarioEntrada
from aplicativo.servicos.interpretador import interpretar


class TesteInterpretador(unittest.TestCase):
    def requisicao(self, texto, pendente=None):
        return RequisicaoProcessamento(
            user=UsuarioEntrada(id="usr-1", name="Cristian", timezone="America/Sao_Paulo"),
            conversation=ConversaEntrada(id="conv-1"),
            message=MensagemEntrada(id="msg-1", content=texto, receivedAt=datetime(2026, 8, 25, 10, 0)),
            context=ContextoEntrada(pendingAction=pendente),
        )

    def test_cria_prova_com_data_e_horario(self):
        resposta = interpretar(self.requisicao("Tenho prova de matemática sexta às 19h"))
        self.assertEqual(resposta.intent, "create_task")
        self.assertEqual(resposta.task.type, "exam")
        self.assertEqual(resposta.task.subject, "Matemática")
        self.assertEqual(resposta.task.dueTime, "19:00")
        self.assertEqual(resposta.missingFields, [])
        self.assertFalse(resposta.requiresConfirmation)

    def test_pergunta_materia_quando_ambigua(self):
        resposta = interpretar(self.requisicao("Tenho prova sexta"))
        self.assertEqual(resposta.intent, "create_task")
        self.assertIn("subject", resposta.missingFields)
        self.assertIn("matéria", resposta.response)

    def test_comando_agenda(self):
        resposta = interpretar(self.requisicao("O que tenho hoje?"))
        self.assertEqual(resposta.intent, "list_today")

    def test_completa_materia_pendente(self):
        pendente = {"intent": "create_task", "task": {"title": "Prova", "type": "exam", "dueDate": "2026-08-28", "dueTime": None, "subject": None, "reminders": [{"amount": 1, "unit": "day"}]}}
        resposta = interpretar(self.requisicao("Programação", pendente))
        self.assertEqual(resposta.task.subject, "Programação")
        self.assertEqual(resposta.missingFields, [])
        self.assertFalse(resposta.requiresConfirmation)

    def test_confirmacao(self):
        resposta = interpretar(self.requisicao("Sim"))
        self.assertEqual(resposta.intent, "confirm")
        self.assertGreater(resposta.confidence, 0.9)

    def test_marca_atividade_como_concluida(self):
        resposta = interpretar(self.requisicao("Marque o trabalho de redes como concluído"))
        self.assertEqual(resposta.intent, "complete_task")
        self.assertEqual(resposta.reference, "trabalho de redes")
        self.assertFalse(resposta.requiresConfirmation)

    def test_remove_atividade(self):
        resposta = interpretar(self.requisicao("Remova o trabalho de redes"))
        self.assertEqual(resposta.intent, "delete_task")
        self.assertEqual(resposta.reference, "trabalho de redes")
        self.assertTrue(resposta.requiresConfirmation)

    def test_edita_data_da_atividade(self):
        resposta = interpretar(self.requisicao("Mude o trabalho de redes para 22/10/2026"))
        self.assertEqual(resposta.intent, "edit_task")
        self.assertEqual(resposta.reference, "trabalho de redes")
        self.assertEqual(resposta.task.dueDate, "2026-10-22")
        self.assertTrue(resposta.requiresConfirmation)

    def test_completa_campo_de_edicao_pendente(self):
        pendente = {"intent": "edit_task", "reference": "trabalho de redes", "targetId": "tarefa-1", "task": {}}
        resposta = interpretar(self.requisicao("matéria para Banco de Dados", pendente))
        self.assertEqual(resposta.intent, "edit_task")
        self.assertIsNone(resposta.reference)
        self.assertEqual(resposta.task.subject, "Banco De Dados")

    def test_cria_assunto_de_estudo_sem_exigir_materia(self):
        resposta = interpretar(self.requisicao("quero estudar normalização até 20/10/2026 às 18h"))
        self.assertEqual(resposta.intent, "create_task")
        self.assertEqual(resposta.task.type, "study")
        self.assertEqual(resposta.task.title, "Estudar Normalização")
        self.assertEqual(resposta.task.dueDate, "2026-10-20")
        self.assertEqual(resposta.task.dueTime, "18:00")
        self.assertEqual(resposta.missingFields, [])

    def test_assunto_de_estudo_pendente_coleta_data(self):
        pendente = {"intent": "create_task", "task": {"title": "Estudar Algoritmos", "type": "study", "dueDate": None}}
        resposta = interpretar(self.requisicao("dia 22/10/2026", pendente))
        self.assertEqual(resposta.intent, "create_task")
        self.assertEqual(resposta.task.type, "study")
        self.assertEqual(resposta.task.title, "Estudar Algoritmos")
        self.assertEqual(resposta.task.dueDate, "2026-10-22")

    def test_conversa_geral_nao_vira_mutacao(self):
        resposta = interpretar(self.requisicao("me explica normalização"))
        self.assertEqual(resposta.intent, "general_chat")
        self.assertIn("organizar", resposta.response)

    def test_pergunta_sobre_como_estudar_nao_cria_tarefa(self):
        resposta = interpretar(self.requisicao("como estudar normalização melhor?"))
        self.assertEqual(resposta.intent, "general_chat")
        self.assertIsNone(resposta.task)

    def test_preserva_assunto_quando_estudo_e_para_uma_prova(self):
        resposta = interpretar(self.requisicao("quero estudar para a prova de matemática até 20/10/2026"))
        self.assertEqual(resposta.intent, "create_task")
        self.assertEqual(resposta.task.title, "Estudar Para A Prova De Matemática")
        self.assertEqual(resposta.task.dueDate, "2026-10-20")


if __name__ == "__main__":
    unittest.main()
