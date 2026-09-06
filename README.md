# Lembraí

> Você fala. O assistente organiza.

MVP da Lembraí, um assistente acadêmico integrado ao WhatsApp por meio da Evolution API, com frontend React/JavaScript, backend Node.js/JavaScript, chatbot Python/FastAPI, PostgreSQL hospedado no Supabase e Redis/BullMQ.

Antes da primeira execução, configure os arquivos de ambiente para o Supabase Auth conforme [`docs/autenticacao-supabase.md`](docs/autenticacao-supabase.md). Os formulários usam sessões JWT do Supabase, com renovação automática e validação no backend.

A execução rápida recomendada **não exige Docker**. Na pasta do projeto, execute:

```powershell
npm run dev
```

Esse comando inicia o chatbot, o backend em modo memória e o frontend. Depois acesse [http://localhost:5173](http://localhost:5173). Para usar o PostgreSQL do Supabase sem Redis e sem FFmpeg, execute `npm run dev:sem-redis`. Consulte [`LEIA-ME.md`](LEIA-ME.md) para os demais modos de execução.

A arquitetura completa está em [`docs/arquitetura-mvp.md`](docs/arquitetura-mvp.md). O Design System obrigatório está consolidado em [`docs/design-system-lembr-ai.md`](docs/design-system-lembr-ai.md).
