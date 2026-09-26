create table if not exists public."CodigoVerificacaoEmail" (
  "id" text primary key,
  "email" text not null,
  "finalidade" text not null,
  "codigoHash" text not null,
  "tokenHash" text not null,
  "tipoToken" text not null,
  "usuarioAuthId" text not null,
  "tentativas" smallint not null default 0,
  "expiraEm" timestamp(3) not null,
  "usadoEm" timestamp(3),
  "criadoEm" timestamp(3) not null default current_timestamp,
  constraint "CodigoVerificacaoEmail_finalidade_check" check ("finalidade" in ('cadastro', 'entrada')),
  constraint "CodigoVerificacaoEmail_tentativas_check" check ("tentativas" between 0 and 5)
);

create index if not exists "CodigoVerificacaoEmail_email_finalidade_criadoEm_idx"
  on public."CodigoVerificacaoEmail" ("email", "finalidade", "criadoEm" desc);

create index if not exists "CodigoVerificacaoEmail_expiraEm_idx"
  on public."CodigoVerificacaoEmail" ("expiraEm");

alter table public."CodigoVerificacaoEmail" enable row level security;
revoke all on table public."CodigoVerificacaoEmail" from anon, authenticated;
grant select, insert, update, delete on table public."CodigoVerificacaoEmail" to service_role;
