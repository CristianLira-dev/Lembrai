#!/usr/bin/env bash
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

command -v node >/dev/null || { echo 'Node.js 20+ não encontrado.'; exit 1; }
command -v npm >/dev/null || { echo 'npm não encontrado.'; exit 1; }
command -v python3 >/dev/null || { echo 'Python 3.11+ não encontrado.'; exit 1; }

if [[ ! -x "$RAIZ/chatbot/.venv/bin/python" ]]; then
  echo 'Criando ambiente virtual do chatbot...'
  (cd "$RAIZ/chatbot" && python3 -m venv .venv && .venv/bin/python -m pip install -r requisitos.txt)
fi

if [[ ! -d "$RAIZ/backend/node_modules" ]]; then
  (cd "$RAIZ/backend" && npm install)
fi

if [[ ! -d "$RAIZ/frontend/node_modules" ]]; then
  (cd "$RAIZ/frontend" && npm install)
fi

(cd "$RAIZ/chatbot" && TOKEN_SERVICO_INTERNO=desenvolvimento-token-interno .venv/bin/python -m uvicorn aplicativo.principal:aplicacao --reload --port 8000) &
CHATBOT_PID=$!
(cd "$RAIZ/backend" && USAR_BANCO_MEMORIA=true USAR_FILAS_MEMORIA=true MODO_WHATSAPP=simulado TOKEN_SERVICO_INTERNO=desenvolvimento-token-interno npm run desenvolvimento:memoria) &
BACKEND_PID=$!
(cd "$RAIZ/frontend" && VITE_URL_API=http://localhost:3000/api npm run desenvolvimento) &
FRONTEND_PID=$!

cleanup() {
  kill "$CHATBOT_PID" "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo ''
echo 'Painel:  http://localhost:5173'
echo 'API:     http://localhost:3000/api/saude'
echo 'Chatbot: http://localhost:8000/api/saude'
echo ''
wait
