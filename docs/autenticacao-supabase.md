# Autenticação e dados do Lembraí com Supabase

O Supabase Auth gerencia identidades, senhas e sessões. O backend envia códigos de cinco caracteres pelo Nodemailer, confirma cada ação e só então libera a sessão ou altera a senha. O navegador guarda a sessão do SDK e envia o access token JWT à API. O backend valida o token com `auth.getUser(token)` antes de acessar os dados.

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
CODIGO_VERIFICACAO_SEGREDO=gere-um-segredo-aleatorio-longo
SMTP_HOST=smtp.seu-provedor.com
SMTP_PORT=587
SMTP_SEGURO=false
SMTP_USUARIO=usuario-smtp
SMTP_SENHA=senha-smtp
EMAIL_REMETENTE=nao-responda@seudominio.com
EMAIL_NOME_REMETENTE=Lembraí
```

A chave publicável pode ser usada no navegador. A chave secreta acessa a Data API com privilégios do servidor e deve existir somente nas variáveis protegidas do backend. O nome legado `SUPABASE_SERVICE_ROLE_KEY` também é aceito no servidor para facilitar a transição.

No Render, cadastre essas variáveis exclusivamente no serviço do backend. A porta `465` usa `SMTP_SEGURO=true`; as portas `587` e `2525` normalmente usam `false` e iniciam TLS durante a conexão. Nunca exponha a senha SMTP em variáveis `VITE_`.

## Fluxos de código

- Cadastro: cria a identidade ainda não confirmada, envia o código e confirma o e-mail somente após a validação.
- Login: valida e-mail e senha, envia um segundo código e só então emite a sessão.
- Recuperação: envia o código para uma conta existente e altera a senha depois da validação.
- Confirmação: permite reenviar o código de um cadastro ainda pendente.

Os códigos usam cinco caracteres alfanuméricos sem caracteres visualmente ambíguos, expiram em 10 minutos, aceitam até cinco tentativas e são armazenados somente como hash. As respostas de recuperação não revelam se o e-mail está cadastrado. Há também limitação de requisições nas rotas públicas de autenticação.

## Identidade e segurança

- `Usuario.id` recebe o UUID validado pelo Supabase Auth.
- O perfil é criado no primeiro acesso autenticado.
- `senhaCriptografada` permanece apenas como campo legado e recebe `!supabase-auth`; senhas reais ficam exclusivamente no Auth.
- O Nodemailer só transporta os códigos; senhas e sessões não são enviadas por e-mail.
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

Referências: [sessões](https://supabase.com/docs/guides/auth/sessions), [getUser](https://supabase.com/docs/reference/javascript/auth-getuser), [criação administrativa de usuário](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [alteração administrativa de usuário](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid) e [Data API](https://supabase.com/docs/guides/api).
