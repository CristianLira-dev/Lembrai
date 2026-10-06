# Operação do Lembraí em produção

## Arquitetura

- `backend-api`: recebe HTTP e webhooks, valida e enfileira rapidamente.
- `backend-worker`: processa mensagens, lembretes, calendário e envios.
- `backend-scheduler`: reconcilia trabalhos persistidos, aplica retenção e processa exclusões solicitadas.
- `Valkey`: filas BullMQ, locks e rate limiting compartilhado.
- `Evolution API`: conexão com WhatsApp.
- `PostgreSQL da Evolution`: usado somente pela Evolution API.
- `Supabase`: Auth e banco principal do Lembraí.

O arquivo `deploy/docker-compose.vps.yml` prepara esses serviços na VPS. O PostgreSQL local não substitui o Supabase.

## Requisitos de produção

O backend interrompe a inicialização quando falta uma configuração crítica. Configure as variáveis diretamente no provedor ou em um `.env` local nunca versionado:

- Supabase: URL, chave publicável e chave secreta.
- Segurança: segredo de código, JWT, comunicação interna, webhook e chave AES-256-GCM.
- Evolution: URL, chave e instância.
- Valkey: `REDIS_URL` privada.
- E-mail: Resend via HTTPS ou SMTP.
- URLs, CORS e domínio HTTPS.

Use `openssl rand -hex 32` para segredos de 32 bytes. Cada segredo deve ser diferente.

## Implantação

1. Aponte os domínios da API e Evolution para o IP público da VPS.
2. Instale Docker e o plugin Docker Compose.
3. Crie o `.env` somente no servidor, com permissão restrita.
4. Execute `docker compose -f deploy/docker-compose.vps.yml config`.
5. Execute `docker compose -f deploy/docker-compose.vps.yml up -d --build`.
6. Confira `/api/saude`, os logs dos três processos e a conexão da Evolution.
7. Envie uma mensagem de teste e confirme a sequência recebida, processada, enviada e entregue.

## Recuperação e observabilidade

- Jobs usam retentativa exponencial e idempotência por identificador externo.
- O painel administrativo mostra apenas metadados operacionais, nunca o conteúdo das conversas.
- Mensagens antigas são removidas conforme `RETENCAO_MENSAGENS_DIAS`.
- Backups do Supabase e do volume PostgreSQL da Evolution devem ser testados periodicamente.
- Antes de atualizar a Evolution, fixe a nova versão e valide os payloads de webhook em homologação.

## Banco e segurança

O frontend acessa o Supabase apenas para autenticação. As tabelas do produto são operadas pelo backend, portanto `anon` e `authenticated` não precisam de privilégios diretos nelas. Mantenha RLS ativo, retire execução pública de funções privilegiadas e execute os Security Advisors após cada mudança.

Os arquivos de schema e migrations do Supabase não ficam no repositório público. Mudanças de banco devem ser registradas em um repositório privado de infraestrutura ou no histórico seguro da equipe.
