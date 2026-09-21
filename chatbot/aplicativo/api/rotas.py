from fastapi import APIRouter, Header, HTTPException

from aplicativo.esquemas.modelos import RequisicaoProcessamento, RespostaProcessamento
from aplicativo.servicos.openrouter import processar


rotas = APIRouter(prefix="/api/v1/assistente", tags=["assistente"])


@rotas.post("/processar", response_model=RespostaProcessamento)
def processar_mensagem(requisicao: RequisicaoProcessamento, x_servico_token: str | None = Header(default=None)) -> RespostaProcessamento:
    # O backend envia o token de serviço; em desenvolvimento o valor padrão permite executar sem segredo externo.
    import os
    import hmac
    esperado = os.getenv("TOKEN_SERVICO_INTERNO", "desenvolvimento-token-interno")
    if os.getenv("RENDER") and esperado == "desenvolvimento-token-interno":
        raise HTTPException(status_code=503, detail="Serviço não configurado")
    if not x_servico_token or not hmac.compare_digest(x_servico_token, esperado):
        raise HTTPException(status_code=401, detail="Serviço não autorizado")
    return processar(requisicao)
