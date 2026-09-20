# Lembraí — Guia de execução

> Você fala. O assistente organiza.

O Lembraí reúne painel React, API Node.js, chatbot Python/FastAPI, Supabase e Redis/BullMQ. Os serviços rodam diretamente no sistema operacional. O Supabase Auth gerencia cadastro, confirmação de e-mail, login e JWT; a Data API do Supabase persiste os dados da aplicação.

## Execução rápida

Copie `.env.example` para `.env` e `frontend/.env.example` para `frontend/.env.local`. Consulte o [guia do Supabase](docs/autenticacao-supabase.md) para configurar as chaves.

Na raiz, execute:

```powershell
npm run dev
```

Esse modo instala dependências ausentes, inicia backend e frontend ao mesmo tempo e mantém os dados da aplicação em memória. O Auth continua usando o Supabase. Acesse:

| Serviço | Endereço |
|---|---|
| Painel React | [http://localhost:5173](http://localhost:5173) |
| Saúde da API | [http://localhost:3000/api/saude](http://localhost:3000/api/saude) |

## Persistência no Supabase

Para persistir perfis, tarefas e lembretes, execute uma vez [`supabase/schema.sql`](supabase/schema.sql) no SQL Editor do projeto e configure no backend:

```dotenv
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUBSTITUA
SUPABASE_SECRET_KEY=sb_secret_SUBSTITUA
USAR_BANCO_MEMORIA=false
USAR_FILAS_MEMORIA=true
```

`SUPABASE_SECRET_KEY` é exclusiva do backend. Nunca a coloque no frontend, em uma variável `VITE_` ou no repositório.

Depois execute:

```powershell
npm run dev:sem-redis
```

Esse modo persiste os dados pela Data API e processa mensagens e lembretes localmente. Para processamento distribuído, configure `REDIS_URL`, defina `USAR_FILAS_MEMORIA=false`, inicie o backend com `npm run desenvolvimento` e o worker com `npm run worker`.

## Execução manual

Chatbot:

```powershell
cd chatbot
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requisitos.txt
python -m uvicorn aplicativo.principal:aplicacao --reload --port 8000
```

Backend:

```powershell
cd backend
npm install
npm run desenvolvimento:memoria
```

Frontend:

```powershell
cd frontend
npm install
npm run desenvolvimento
```

## Testes

```powershell
npm --prefix backend test
npm --prefix frontend test
npm --prefix frontend run build
python -m unittest discover -s chatbot/testes -v
```

`GET /api/saude` verifica o processo Express. `GET /api/saude/banco` verifica o acesso do backend à Data API do Supabase.

## Integrações

Para a Evolution API, configure `EVOLUTION_API_URL`, `EVOLUTION_API_CHAVE`, `EVOLUTION_API_INSTANCIA`, `EVOLUTION_WEBHOOK_SEGREDO` e `MODO_WHATSAPP=evolution`. Em produção, o webhook deve usar HTTPS.

Para Google Calendar ou Outlook, configure os clientes OAuth correspondentes. Os tokens ficam no backend e não são enviados ao navegador.

A arquitetura completa está em [`docs/arquitetura-mvp.md`](docs/arquitetura-mvp.md).
