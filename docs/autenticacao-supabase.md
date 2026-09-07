# Autenticação do Lembraí com Supabase

O projeto usa o Supabase Auth de `wbmmuttuyxhzdthunobb`. Login e cadastro são enviados pela API Express ao Auth. O SDK no navegador persiste a sessão, recebe o retorno da confirmação de e-mail e renova o access token JWT com o refresh token. O backend valida cada Bearer token com `auth.getUser(token)` no mesmo projeto Supabase, antes de acessar o banco pelo Prisma.

## Configurar e executar

Use Node.js 22 ou superior. Copie `.env.example` para `.env` na raiz e `frontend/.env.example` para `frontend/.env.local`. Os exemplos já contêm a URL e a chave **publicável** do Lembraí; essa chave pode ser distribuída ao navegador e não concede acesso administrativo.

Preencha `DATABASE_URL` e `DIRECT_URL` com as conexões do projeto Supabase obtidas em **Connect**. Preserve os valores existentes se o backend já estiver conectado. A senha do banco fica somente no ambiente do backend. Não use `service_role`, `sb_secret_...` nem o segredo de assinatura JWT em variáveis `VITE_`.

No Render, use em `DATABASE_URL` a string **Session pooler**, na porta `5432`. A conexão direta `db.<project-ref>.supabase.co` usa IPv6 por padrão e pode não funcionar em uma hospedagem somente IPv4. Copie o host exato exibido pelo Supabase e aplique URL encoding à senha quando ela contiver caracteres especiais. `DIRECT_URL` pode repetir a Session pooler quando o ambiente que executa as migrations também não tiver IPv6.

```sh
npm --prefix backend ci
npm --prefix backend run prisma:gerar
npm --prefix frontend ci
npm run dev:sem-redis
```

O modo `npm run dev` continua usando dados de aplicação em memória para desenvolvimento, mas também precisa das configurações do Supabase Auth. Use `dev:sem-redis` para persistir perfis e tarefas no PostgreSQL.

Em **Authentication → URL Configuration**, configure o Site URL e permita `http://localhost:5173/entrar` em Redirect URLs para desenvolvimento. Em produção, permita a URL HTTPS real terminada em `/entrar`, configure `URL_FRONTEND` e `CORS_ORIGENS` no backend e `VITE_URL_API` no frontend. Mantenha a confirmação de e-mail conforme a configuração desejada do Auth; o formulário suporta tanto a confirmação por e-mail quanto a sessão imediata.

Na hospedagem do frontend, configure `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_URL_API` **antes do build**. Na hospedagem do backend, configure `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL`, `DIRECT_URL`, `URL_FRONTEND` e `CORS_ORIGENS`. Recompile o frontend e reinicie o backend após alterar o ambiente.

Depois do redeploy do backend, valide separadamente a aplicação e o banco:

```text
GET /api/saude        -> 200 (processo Express ativo)
GET /api/saude/banco  -> 200 (PostgreSQL acessível pelo Prisma)
```

Uma resposta `503` em `/api/saude/banco` indica que `DATABASE_URL` está ausente, inválida ou inacessível. O detalhe técnico permanece somente nos logs do backend; a API não expõe credenciais.

## Identidade, dados e compatibilidade

- `Usuario.id` recebe o UUID da identidade validada pelo Supabase Auth, preservando os relacionamentos atuais com tarefas e lembretes. O perfil é provisionado no primeiro acesso autenticado após a confirmação do e-mail.
- Nome, WhatsApp e fuso são validados como dados de perfil. `user_metadata` nunca decide identidade ou permissões. O e-mail vem do usuário devolvido pelo Auth.
- `senhaCriptografada` é um campo legado obrigatório no esquema atual. Novos perfis recebem somente o marcador não autenticável `!supabase-auth`. Nenhuma senha de login é gravada nessa tabela. Não é necessária migração de esquema para esta integração.
- Contas legadas não são vinculadas automaticamente por e-mail ou telefone. Uma migração de identidade exige um fluxo separado de comprovação de titularidade, preservando seus relacionamentos. O banco Lembraí estava sem usuários no momento da inspeção.
- Os endpoints de cadastro e login agora retornam `{ sessao, confirmarEmail? }`, substituindo o contrato antigo `{ usuario, token }`. A sessão usa os campos padrão do Supabase, incluindo `access_token` e `refresh_token`. `GET /api/autenticacao/eu` continua retornando `{ usuario }`.
- JWTs locais antigos não são aceitos pelas rotas privadas. A chave `assistente_token` é removida do armazenamento ao iniciar o frontend. `JWT_SEGREDO` permanece apenas para o estado OAuth de calendário e deve ser forte em produção.
- O logout usa `scope: 'local'` para revogar a renovação da sessão atual, sem desconectar outros dispositivos. Um JWT de acesso já emitido pode continuar válido até expirar; configure a duração em Supabase Auth conforme necessário.
- Uma resposta 401 nas requisições privadas permite uma renovação e uma nova tentativa. Se continuar inválida, a sessão é encerrada. Falhas temporárias de rede ou respostas 5xx não removem a sessão.

As tabelas do projeto permanecem acessíveis pelo backend Prisma. O navegador não consulta diretamente as tabelas pelo Data API. O RLS já estava habilitado, sem políticas de acesso público; esta integração não amplia essas permissões. O backend usa o ID autenticado nos filtros de propriedade.

O campo WhatsApp continua sendo um dado informado no cadastro; a comprovação de posse do número não faz parte desta alteração. Números já associados a outro perfil são rejeitados.

## Validação

```sh
npm --prefix backend test
npm --prefix frontend test
npm --prefix frontend run build
```

Os testes automatizados cobrem cadastro com e sem confirmação, validação de campos, erros de autenticação, vínculo de identidade, rejeição de JWT local, isolamento de tarefas e renovação após 401. O provedor Auth é simulado nos testes; não são criadas contas reais nem enviados e-mails. A verificação final em produção precisa de um cadastro real, confirmação do e-mail, login, recarga de página e logout após configurar a hospedagem.

Referências: [sessões](https://supabase.com/docs/guides/auth/sessions), [getUser](https://supabase.com/docs/reference/javascript/auth-getuser), [signUp](https://supabase.com/docs/reference/javascript/auth-signup), [onAuthStateChange](https://supabase.com/docs/reference/javascript/auth-onauthstatechange).
