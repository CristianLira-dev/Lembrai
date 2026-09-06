# Lembraí — Guia de execução

> Você fala. O assistente organiza.

Este repositório contém o MVP da Lembraí, um assistente acadêmico integrado ao WhatsApp, com painel web em React, API em Node.js, chatbot em Python/FastAPI, PostgreSQL/Supabase e Redis/BullMQ. A execução recomendada para desenvolvimento no Windows **não depende de Docker**. O banco principal usa PostgreSQL hospedado no Supabase.

## O que foi implementado

O fluxo principal está preparado de ponta a ponta:

```text
Evolution API → webhook Node.js → fila BullMQ → chatbot Python → confirmação persistida → tarefa → lembrete → resposta WhatsApp
```

O painel web permite criar conta, entrar, visualizar indicadores, criar, editar, concluir e excluir tarefas, consultar o calendário, acompanhar lembretes e configurar integrações. O WhatsApp pode operar em modo simulado, o que permite testar o produto sem credenciais externas.

## Execução rápida sem Docker

Antes de iniciar, configure o Supabase Auth usando os arquivos `.env.example` e `frontend/.env.example`, conforme o [guia de autenticação](docs/autenticacao-supabase.md). Login e cadastro exigem acesso ao Supabase mesmo quando os dados da aplicação estão em memória. O guia inclui confirmação de e-mail, URLs de retorno, variáveis de hospedagem e sessões JWT.

O modo rápido usa o repositório em memória e o WhatsApp simulado. Ele é o caminho mais simples para abrir o painel e testar o produto sem instalar PostgreSQL, Redis ou Docker. Os dados são perdidos quando o backend é encerrado.

No Windows, abra um PowerShell na pasta do projeto e execute:

```powershell
cd C:\cristian\ChatBot-Tasks
npm run dev
```

O comando verifica Node.js, npm e Python, cria o ambiente virtual do chatbot, instala dependências ausentes e inicia os três serviços no mesmo terminal. Não é necessário executar `Set-ExecutionPolicy`.

| Serviço | Endereço |
|---|---|
| Painel React | [http://localhost:5173](http://localhost:5173) |
| Saúde da API | [http://localhost:3000/api/saude](http://localhost:3000/api/saude) |
| Documentação do chatbot | [http://localhost:8000/docs](http://localhost:8000/docs) |

Para encerrar o modo rápido, feche as três janelas abertas pelo script. O Docker Compose continua disponível como alternativa futura, mas não é necessário para este fluxo.

### Execução manual em três terminais

Caso prefira não usar o script, abra três terminais na pasta do projeto.

No primeiro terminal, inicie o chatbot:

```powershell
cd C:\cristian\ChatBot-Tasks\chatbot
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requisitos.txt
$env:TOKEN_SERVICO_INTERNO = 'desenvolvimento-token-interno'
python -m uvicorn aplicativo.principal:aplicacao --reload --port 8000
```

No segundo terminal, inicie a API em modo memória:

```powershell
cd C:\cristian\ChatBot-Tasks\backend
npm install
npm run desenvolvimento:memoria
```

No terceiro terminal, inicie o painel:

```powershell
cd C:\cristian\ChatBot-Tasks\frontend
npm install
npm run desenvolvimento
```

Depois acesse [http://localhost:5173](http://localhost:5173). A variável `VITE_URL_API` pode ser omitida, pois o frontend usa `http://localhost:3000/api` como padrão.

## PostgreSQL remoto com Supabase

Para manter os dados entre reinicializações, crie um projeto no Supabase e abra o botão **Connect**. Copie a string de conexão PostgreSQL do modo **Session pooler**, normalmente na porta `5432`. O backend usa Prisma, portanto a string deve ser mantida apenas no arquivo `.env` local ou nas variáveis protegidas do ambiente de hospedagem.

Crie um arquivo local chamado `.env` na raiz do projeto. Ele é ignorado pelo Git e não deve ser enviado ao repositório. Um conjunto mínimo de variáveis é:

```dotenv
AMBIENTE=desenvolvimento
PORTA_BACKEND=3000
URL_FRONTEND=http://localhost:5173
DATABASE_URL="COLE_A_CONNECTION_STRING_DO_SUPABASE_AQUI"
REDIS_URL=redis://localhost:6379
JWT_SEGREDO=troque-por-um-segredo-local
URL_CHATBOT=http://localhost:8000
TOKEN_SERVICO_INTERNO=troque-por-um-token-local
MODO_WHATSAPP=simulado
EVOLUTION_WEBHOOK_SEGREDO=troque-por-um-segredo-de-webhook
```

No Supabase, recomenda-se usar um usuário de banco próprio para o Prisma. Se a senha contiver caracteres especiais, mantenha a string copiada pelo botão **Connect**, pois ela já contém o formato correto. Para uma aplicação server-based local, a conexão de sessão na porta `5432` é a escolha inicial; em um runtime serverless, use a conexão de transação na porta `6543` conforme a documentação do Supabase.

Em terminais separados, execute o chatbot, a API, o worker e o frontend:

```powershell
cd C:\cristian\ChatBot-Tasks\chatbot
.\.venv\Scripts\Activate.ps1
python -m uvicorn aplicativo.principal:aplicacao --reload --port 8000
```

```powershell
cd C:\cristian\ChatBot-Tasks\backend
npm install
npm run prisma:gerar
npm run prisma:migrar
npm run desenvolvimento
```

```powershell
cd C:\cristian\ChatBot-Tasks\backend
npm run worker
```

```powershell
cd C:\cristian\ChatBot-Tasks\frontend
npm install
npm run desenvolvimento
```

No modo completo, mantenha `USAR_BANCO_MEMORIA` e `USAR_FILAS_MEMORIA` ausentes ou definidos como `false`. O worker precisa de Redis; o painel e a API precisam conseguir alcançar o PostgreSQL do Supabase e os demais serviços pelos endereços definidos no `.env`.

### Execução sem Redis e sem FFmpeg

Para um teste real usando o PostgreSQL do Supabase, mas somente com mensagens de texto, execute na raiz do projeto:

```powershell
npm run dev:sem-redis
```

Esse comando inicia o chatbot, o backend conectado ao Supabase e o frontend. O backend usa processamento direto para mensagens recebidas pelo webhook e um agendador local que consulta os lembretes pendentes no PostgreSQL. Não execute `npm run worker` nesse modo, porque o worker tradicional depende do Redis.

Nesse modo, o fluxo é limitado a mensagens de texto. Áudios, vídeos, imagens e outros arquivos são ignorados até que o processamento de mídia seja habilitado. O FFmpeg não é necessário para esse cenário.

O modo sem Redis não mantém uma fila distribuída nem oferece as mesmas garantias de reprocessamento do BullMQ. Para um projeto de teste com baixo volume, ele simplifica a instalação sem alterar a persistência do PostgreSQL.

## Teste do webhook simulado

O endpoint de simulação não exige Evolution API nem Redis e chama o orquestrador diretamente. Com a API e o chatbot em execução, envie no PowerShell:

```powershell
$payload = @'
{
  "event": "messages.upsert",
  "instance": "assistente-academico",
  "sender": "5511999999999",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "teste-local-1"
    },
    "pushName": "Estudante",
    "message": {
      "conversation": "Tenho prova de matemática sexta às 19h"
    }
  }
}
'@
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/webhooks/evolution/simular -ContentType 'application/json' -Body $payload
```

A primeira mensagem solicita confirmação. Envie uma segunda requisição com o mesmo telefone e o conteúdo `Sim` para concluir a criação da tarefa em modo simulado. A resposta do WhatsApp aparece no retorno e nos logs da API.

## Docker Compose — alternativa local

O Compose permanece versionado para ambientes que já tenham Docker Desktop configurado:

```powershell
cd C:\cristian\ChatBot-Tasks
docker compose up --build
```

Esse caminho inicia frontend, backend, chatbot, PostgreSQL, Redis e worker em containers separados. Ele não é necessário para o modo rápido local nem para o uso do PostgreSQL no Supabase.

## Testes e validações

Backend:

```powershell
cd C:\cristian\ChatBot-Tasks\backend
npm test
```

Chatbot:

```powershell
cd C:\cristian\ChatBot-Tasks\chatbot
python -m unittest discover -s testes -v
```

Frontend:

```powershell
cd C:\cristian\ChatBot-Tasks\frontend
npm run build
```

O endpoint `GET /api/saude` confirma a disponibilidade da API. A documentação interativa do chatbot fica em `http://localhost:8000/docs`.

## Integrações reais

O banco atual do projeto é PostgreSQL compatível com Supabase. Para executar as migrations, use a `DATABASE_URL` de sessão apropriada do Supabase e valide o ambiente antes de disponibilizar a aplicação.

Para usar a Evolution API, preencha `EVOLUTION_API_URL`, `EVOLUTION_API_CHAVE`, `EVOLUTION_API_INSTANCIA`, `EVOLUTION_WEBHOOK_SEGREDO` e defina `MODO_WHATSAPP=evolution`. Em produção, o webhook deve usar HTTPS.

Para Google Calendar ou Outlook, configure os clientes OAuth no provedor e informe as variáveis correspondentes. Os tokens são mantidos no backend; o frontend não recebe credenciais. Sem credenciais, as conexões permanecem disponíveis para configuração, sem simular autorização OAuth real.

## Solução de problemas no Windows

Se `python` não for reconhecido, instale Python 3.11 ou superior e marque a opção de adicionar Python ao PATH. O comando `npm run dev` não exige alteração na política de execução do PowerShell. Se o Windows não reconhecer `npm`, feche o terminal, abra um novo e confirme a instalação com `node --version` e `npm --version`.


Se a porta 5173, 3000 ou 8000 estiver ocupada, encerre o processo que está usando a porta ou altere `PORTA_BACKEND` e os comandos de inicialização. Se o painel abrir, mas não carregar dados, confirme primeiro `http://localhost:3000/api/saude` e depois verifique se a janela do chatbot está ativa.

## Arquitetura

A arquitetura detalhada, o modelo de dados, os fluxos de autenticação, webhooks, calendários, filas, segurança, rotas e o plano de evolução estão em [`docs/arquitetura-mvp.md`](docs/arquitetura-mvp.md). Os tokens visuais oficiais estão em [`docs/design-system-lembr-ai.md`](docs/design-system-lembr-ai.md).
