import os

from fastapi import FastAPI

from aplicativo.api.rotas import rotas

aplicacao = FastAPI(title="Assistente Acadêmico — Chatbot", version="2.0.0")
aplicacao.include_router(rotas)


@aplicacao.get("/api/saude")
async def saude():
    return {
        "status": "ok",
        "servico": "chatbot",
        "versao": "2.0.0",
        "ia": "configurada" if os.getenv("OPENROUTER_API_KEY", "").strip() else "fallback_local",
    }
