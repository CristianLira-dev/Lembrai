# Autenticação e dados do Lembraí com Supabase

O Supabase Auth gerencia cadastro, login e renovação da sessão. Temporariamente, o backend confirma o e-mail no momento do cadastro, inicia a sessão imediatamente e não envia mensagem de verificação. O navegador guarda a sessão do SDK e envia o access token JWT à API. O backend valida o token com `auth.getUser(token)` antes de acessar os dados.

## Variáveis

No frontend:

```dotenv
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUBSTITUA
VITE_URL_API=http://localhost:3000/api
```

No backend:

```dotenv
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUBSTITUA
SUPABASE_SECRET_KEY=sb_secret_SUBSTITUA
URL_FRONTEND=http://localhost:5173
CORS_ORIGENS=http://localhost:5173
```

A chave publicável pode ser usada no navegador. A chave secreta acessa a Data API com privilégios do servidor e deve existir somente nas variáveis protegidas do backend. O nome legado `SUPABASE_SERVICE_ROLE_KEY` também é aceito no servidor para facilitar a transição.

Execute [`supabase/schema.sql`](../supabase/schema.sql) uma vez no SQL Editor para criar as tabelas. O backend usa `@supabase/supabase-js`; não precisa de string de conexão do PostgreSQL nem de geração de cliente.

## Cadastro temporariamente sem confirmação

O endpoint de cadastro usa `auth.admin.createUser` com `email_confirm: true` exclusivamente no backend e depois cria a sessão com e-mail e senha. Isso evita o envio de e-mail enquanto o SMTP e as URLs de retorno não estão configurados. `SUPABASE_SECRET_KEY` é obrigatória no Render e nunca pode ser exposta em uma variável `VITE_`.

Quando a verificação por e-mail for reativada, substitua esse fluxo pelo `signUp` público, configure as URLs em **Authentication → URL Configuration** e implemente novamente a etapa de confirmação na interface.

## Identidade e segurança

- `Usuario.id` recebe o UUID validado pelo Supabase Auth.
- O perfil é criado no primeiro acesso autenticado.
- `senhaCriptografada` permanece apenas como campo legado e recebe `!supabase-auth`; senhas reais ficam exclusivamente no Auth.
- Todas as consultas do backend filtram explicitamente por `usuarioId`.
- O navegador não acessa as tabelas diretamente.
- `JWT_SEGREDO` assina apenas o estado OAuth das integrações de calendário.
- Respostas 401 permitem uma renovação da sessão; falhas temporárias não encerram o usuário imediatamente.

## Diagnóstico

```text
GET /api/saude        -> processo Express ativo
GET /api/saude/banco  -> Data API do Supabase acessível
```

Uma resposta `503` no segundo endpoint normalmente indica `SUPABASE_URL` ou `SUPABASE_SECRET_KEY` ausente, inválida ou inacessível. Detalhes técnicos ficam somente nos logs.

## Validação

```sh
npm --prefix backend test
npm --prefix frontend test
npm --prefix frontend run build
```

Referências: [sessões](https://supabase.com/docs/guides/auth/sessions), [getUser](https://supabase.com/docs/reference/javascript/auth-getuser), [criação administrativa de usuário](https://supabase.com/docs/reference/javascript/auth-admin-createuser) e [Data API](https://supabase.com/docs/guides/api).
