import os
import unittest
from unittest.mock import patch

try:
    from fastapi.testclient import TestClient
    from aplicativo.principal import aplicacao
except ModuleNotFoundError:
    TestClient = None
    aplicacao = None


@unittest.skipIf(TestClient is None, "dependências HTTP disponíveis apenas no ambiente do chatbot")
class TesteRotas(unittest.TestCase):
    @patch.dict(os.environ, {"TOKEN_SERVICO_INTERNO": "segredo-teste"}, clear=False)
    def test_saude_interna_valida_token(self):
        cliente = TestClient(aplicacao)

        negada = cliente.get("/api/v1/assistente/saude-interna", headers={"x-servico-token": "errado"})
        self.assertEqual(negada.status_code, 401)

        aceita = cliente.get("/api/v1/assistente/saude-interna", headers={"x-servico-token": "segredo-teste"})
        self.assertEqual(aceita.status_code, 200)
        self.assertEqual(aceita.json()["status"], "ok")
