# Lembraí — arquitetura do MVP

## 1. Objetivo e recorte

A Lembraí é um assistente acadêmico pessoal no WhatsApp. O estudante escreve uma mensagem natural, o sistema interpreta a intenção, apresenta uma confirmação quando a operação altera dados e, somente depois, cria ou modifica a tarefa, agenda lembretes e sincroniza calendários.

O primeiro incremento implementado neste repositório prioriza o fluxo de ponta a ponta: **mensagem recebida → webhook Evolution API → fila BullMQ → identificação do usuário → chatbot Python → confirmação persistida → tarefa → lembrete → resposta pelo WhatsApp**. O painel React expõe autenticação, dashboard, CRUD de tarefas, lembretes, conversas e integrações. Os provedores de calendário possuem uma abstração real e adaptadores preparados para OAuth; sem credenciais de provedor, o ambiente local usa um modo simulado explícito.

## 2. Arquitetura completa

```text
WhatsApp
   ↓
Evolution API
   ↓  HTTP POST autenticado
Backend Node.js / webhook
   ↓  Redis + BullMQ
Processador de mensagens
   ↓
PostgreSQL/Supabase: usuário, conversa, mensagem, idempotência
   ↓  HTTP interno autenticado
Chatbot Python / FastAPI
   ↓  intenção + entidades + resposta estruturada
Serviço de tarefas
   ├── confirmação persistida
   ├── lembretes em BullMQ
   └── histórico de mensagens
Serviço de calendários
   ├── Google Calendar
   ├── Microsoft Outlook
   └── ICS/WebCal / simulador local
   ↓
Evolution API → WhatsApp

React/Vite → API REST Node.js → PostgreSQL/Supabase
```

O frontend nunca acessa PostgreSQL/Supabase, Redis, Evolution API, tokens OAuth ou o chatbot diretamente. O backend é o gateway e orquestrador de todas as operações.

## 3. Serviços e stack

| Serviço | Tecnologia | Responsabilidade | Porta local |
|---|---|---|---:|
| `frontend` | React, Vite, JavaScript, React Router, Axios | Painel, autenticação e consumo da API | 5173 |
| `backend` | Node.js, Express, Prisma, Zod, Pino, BullMQ | API REST, autenticação, negócio, webhooks e integrações | 3000 |
| `chatbot` | Python, FastAPI, Pydantic | Interpretação de mensagens e geração de resposta estruturada | 8000 |
| `postgres` | PostgreSQL/Supabase | Persistência relacional multiusuário | 5432 |
| `redis` | Redis 7 | Filas, idempotência e armazenamento transitório | 6379 |
| Evolution API | Serviço externo ou container separado | WhatsApp, envio e webhooks | externo |

Duas formas de execução são suportadas. A primeira, recomendada para desenvolvimento no Windows, é a execução local dos aplicativos sem Docker, usando o modo memória para uma experiência rápida ou PostgreSQL hospedado no Supabase e Redis para persistência e processamento assíncrono. A segunda é o **Docker Compose**, mantido como alternativa para reproduzir o ambiente completo localmente com PostgreSQL, Redis e serviços isolados.

| Abordagem | Trade-offs | Custo | Complexidade de configuração |
|---|---|---|---|
| Docker Compose | Ambientes mais reproduzíveis e serviços isolados; requer Docker instalado | Sem custo de licença; depende da infraestrutura escolhida | Baixa após instalar Docker |
| Execução local dos aplicativos | Depuração simples e inicialização rápida; versões e serviços precisam ser mantidos manualmente | Sem custo adicional | Média |

Para produção, o webhook precisa de HTTPS e URL pública. A Evolution API documenta webhooks globais e por instância, eventos como `MESSAGES_UPSERT` e `CONNECTION_UPDATE`, cabeçalhos personalizados, reenvio com backoff e recomenda resposta rápida com processamento assíncrono [1] [2].

## 4. Estrutura de pastas

Os nomes de domínio próprios usam português sem acentos. Nomes oficiais de ferramentas permanecem conforme exigido por elas.

```text
ChatBot-Tasks/
├── frontend/
│   ├── src/
│   │   ├── componentes/
│   │   ├── paginas/
│   │   ├── servicos/
│   │   ├── contextos/
│   │   ├── rotas/
│   │   └── estilos/
│   ├── publico/
│   ├── package.json
│   └── Dockerfile
├── backend/
│   ├── src/
│   │   ├── configuracao/
│   │   ├── controladores/
│   │   ├── rotas/
│   │   ├── intermediarios/
│   │   ├── servicos/
│   │   ├── repositorios/
│   │   ├── integracoes/
│   │   ├── filas/
│   │   ├── tarefas/
│   │   ├── validadores/
│   │   ├── utilitarios/
│   │   └── servidor.js
│   ├── prisma/schema.prisma
│   ├── package.json
│   └── Dockerfile
├── chatbot/
│   ├── aplicativo/
│   │   ├── api/
│   │   ├── esquemas/
│   │   ├── servicos/
│   │   ├── intencoes/
│   │   ├── entidades/
│   │   ├── prompts/
│   │   ├── validadores/
│   │   ├── configuracao/
│   │   └── principal.py
│   ├── testes/
│   ├── requisitos.txt
│   └── Dockerfile
├── docs/arquitetura-mvp.md
├── docker-compose.yml
├── package.json
├── scripts/iniciar-local.js
├── scripts/iniciar-local.ps1
├── scripts/iniciar-local.sh
├── LEIA-ME.md
└── README.md
```

## 5. Modelo de dados

O Prisma modela `Usuario`, `Tarefa`, `ConexaoCalendario`, `EventoCalendario`, `Lembrete`, `Conversa`, `Mensagem`, `EventoWebhook` e `RegistroSincronizacao`. Índices e restrições únicas protegem o isolamento por usuário e a idempotência de mensagens e webhooks.

| Entidade | Finalidade | Relações principais |
|---|---|---|
| `Usuario` | Conta, telefone, e-mail, senha e fuso horário | Possui tarefas, conversas, conexões e lembretes |
| `Tarefa` | Atividade acadêmica e seu estado | Pertence a usuário; pode gerar evento externo |
| `ConexaoCalendario` | OAuth e status do provedor | Pertence a usuário; tokens ficam criptografados |
| `EventoCalendario` | Relação entre tarefa e evento externo | Guarda `externalEventId`, datas e sincronização |
| `Lembrete` | Notificação agendada | Pertence a tarefa e usuário |
| `Conversa` | Estado de confirmação persistente | Pertence a usuário e contém dados pendentes |
| `Mensagem` | Histórico de entrada e saída | Usa identificador externo único quando disponível |
| `EventoWebhook` | Deduplicação e auditoria de eventos recebidos | Guarda payload e estado de processamento |
| `RegistroSincronizacao` | Auditoria de sincronizações | Pertence ao usuário e ao provedor |

A estratégia de conflito utiliza `externalEventId`, `updatedAt`, `lastSyncedAt` e registro de sincronização. O MVP aplica a regra “última atualização conhecida vence” e registra o resultado; a expansão bidirecional adicionará tokens de página e webhooks específicos de cada calendário.

## 6. Autenticação e multi-tenancy

O cadastro cria um usuário com senha submetida por HTTPS. O backend aplica `bcryptjs`, emite JWT com expiração configurável e protege todas as rotas de negócio com o middleware de autenticação. As consultas sempre filtram por `usuarioId`; o telefone do WhatsApp é usado somente para localizar ou criar o usuário associado à conversa.

O frontend mantém o token em `localStorage` apenas para o MVP de desenvolvimento, remove-o no logout e não recebe tokens OAuth de calendários. Em produção, a evolução recomendada é cookie `HttpOnly`, `Secure` e `SameSite=Lax`, com rotação e revogação de sessão.

## 7. Evolution API e webhooks

A integração está isolada em `backend/src/integracoes/evolution-api`, composta pelo contrato de provedor, adaptador HTTP e formatador de mensagens. O restante do backend depende de `servico-whatsapp`, não das URLs ou nomes internos da Evolution API.

O endpoint `POST /api/webhooks/evolution` valida o segredo do webhook, registra o evento com chave idempotente e responde rapidamente. Somente depois o evento é colocado na fila `processamento-mensagens`. O worker ignora mensagens de saída (`fromMe`), extrai texto de `conversation` ou `extendedTextMessage`, resolve o telefone e aciona o chatbot.

O tratamento cobre eventos duplicados, mensagens fora de ordem, falhas e timeouts externos, usuários não cadastrados, eventos inválidos e indisponibilidade temporária do chatbot. A resposta ao WhatsApp usa a mesma abstração e pode operar em `simulado` quando as variáveis da Evolution API não estiverem definidas.

## 8. Comunicação Node.js ↔ Python

O backend chama `POST /api/v1/assistente/processar` por HTTP interno com `x-servico-token`. O payload inclui usuário, conversa, mensagem e contexto com tarefa pendente e tarefas recentes. O chatbot não lê o banco nem executa ações. A validação Pydantic retorna intenção, confiança, campos ausentes, tarefa normalizada e resposta em português.

As intenções do MVP são `create_task`, `list_today`, `list_week`, `next_exam`, `list_overdue`, `complete_task`, `delete_task`, `confirm`, `cancel` e `unknown`. Datas relativas são convertidas para ISO usando o fuso enviado pelo backend; mensagens ambíguas não executam alterações.

## 9. Calendários

O serviço de calendários expõe um contrato comum para `conectar`, `desconectar`, `sincronizar`, `criarEvento`, `atualizarEvento` e `excluirEvento`. Os adaptadores iniciais são Google Calendar, Microsoft Outlook e um provedor ICS/simulado. URLs de autorização são iniciadas pelo backend, e callbacks trocam o código por tokens no servidor. Tokens são criptografados com AES-256-GCM quando a chave está configurada.

Sem `GOOGLE_CLIENT_ID`, `OUTLOOK_CLIENT_ID` e respectivas chaves, o painel apresenta o provedor como “disponível para configuração” e o ambiente não finge que existe uma conexão real. Essa decisão torna o MVP executável sem credenciais e evita armazenar senhas de serviços externos.

## 10. Filas, lembretes e resumo diário

O Redis sustenta as filas BullMQ `processamento-mensagens`, `processamento-lembretes`, `sincronizacao-calendarios`, `envio-whatsapp` e `resumo-diario`. O webhook não mantém requisição aberta. O worker de lembretes confirma que a tarefa continua pendente, envia a mensagem, atualiza o status e aplica tentativas com backoff. O resumo diário é gerado pelo Node.js a partir das tarefas e pode ser ativado posteriormente por um scheduler externo.

## 11. Rotas do backend

| Método | Rota | Proteção | Uso |
|---|---|---|---|
| `POST` | `/api/autenticacao/cadastro` | pública | criar conta |
| `POST` | `/api/autenticacao/entrar` | pública | emitir JWT |
| `GET` | `/api/autenticacao/eu` | JWT | usuário atual |
| `GET/POST` | `/api/tarefas` | JWT | listar e criar tarefas |
| `GET/PATCH/DELETE` | `/api/tarefas/:id` | JWT | consultar, editar e excluir |
| `POST` | `/api/tarefas/:id/concluir` | JWT | concluir tarefa |
| `GET/POST` | `/api/lembretes` | JWT | listar e criar lembretes |
| `PATCH/DELETE` | `/api/lembretes/:id` | JWT | atualizar e excluir lembretes |
| `GET` | `/api/conversas` | JWT | listar conversas |
| `GET` | `/api/conversas/:id/mensagens` | JWT | histórico |
| `GET` | `/api/calendarios/conexoes` | JWT | listar conexões |
| `GET` | `/api/calendarios/:provedor/conectar` | JWT | iniciar OAuth |
| `GET` | `/api/calendarios/:provedor/retorno` | pública | callback OAuth |
| `POST` | `/api/calendarios/:provedor/sincronizar` | JWT | solicitar sincronismo |
| `DELETE` | `/api/calendarios/:provedor/desconectar` | JWT | desligar provedor |
| `POST` | `/api/webhooks/evolution` | segredo | receber WhatsApp |
| `GET` | `/api/saude` | pública | saúde do backend |
| `GET` | `/api/saude/banco` | pública | conectividade do PostgreSQL |

## 12. Rotas do frontend

As telas são `/`, `/entrar`, `/cadastro`, `/painel`, `/tarefas`, `/tarefas/nova`, `/tarefas/:id`, `/calendario`, `/integracoes`, `/notificacoes`, `/perfil` e `/configuracoes`. Um guard redireciona as áreas privadas para `/entrar`, enquanto estados de carregamento, vazio, erro e sucesso aparecem em componentes reutilizáveis.

## 13. Segurança

O backend usa Helmet, CORS configurável, limite de requisições, Zod, logs estruturados, timeout no chatbot, segredo de serviço, segredo de webhook, hash de senha e criptografia opcional de tokens. Segredos entram somente por ambiente. Em produção, o serviço deve operar atrás de HTTPS, com banco e Redis privados e rotação de chaves.

## 14. Plano de implementação

1. **Fundação:** documentação, variáveis, Docker Compose e schema Prisma.
2. **Backend:** autenticação, CRUD, webhook, filas, chatbot client e adaptadores.
3. **Chatbot:** contratos Pydantic, parser de intenções, datas relativas e testes.
4. **Frontend:** shell responsivo, autenticação, dashboard, tarefas, calendário e integrações.
5. **Validação:** testes de parser, testes de saúde, lint/build e simulação do webhook.
6. **Integrações reais:** cadastrar Evolution API, Google OAuth, Outlook OAuth e HTTPS.
7. **Evolução:** sincronização bidirecional, resumo diário, auditoria avançada e provedores adicionais.

## Referências

[1]: https://evolutionapi-evolution-api-90.mintlify.app/concepts/webhooks "Evolution API — Webhooks"

[2]: https://evolutionapi-evolution-api-90.mintlify.app/events/webhooks "Evolution API — Events/Webhooks"
