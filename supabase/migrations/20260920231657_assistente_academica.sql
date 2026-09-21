alter table public."Usuario"
  add column if not exists "horarioLembretes" text not null default '07:27',
  add column if not exists "preferenciaLembretesPerguntada" boolean not null default false;

update public."Usuario"
set "telefone" = '55' || regexp_replace("telefone", '\D', '', 'g')
where "telefone" is not null
  and char_length(regexp_replace("telefone", '\D', '', 'g')) in (10, 11);

do $$ begin
  alter table public."Usuario" add constraint "Usuario_horarioLembretes_check"
    check ("horarioLembretes" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
exception when duplicate_object then null;
end $$;

alter table public."Mensagem"
  add column if not exists "metadados" jsonb;

create table if not exists public."Materia" (
  "id" text primary key,
  "usuarioId" text not null references public."Usuario"("id") on delete cascade on update cascade,
  "nome" text not null,
  "normalizado" text not null,
  "criadoEm" timestamp(3) not null default current_timestamp,
  constraint "Materia_usuarioId_normalizado_key" unique ("usuarioId", "normalizado"),
  constraint "Materia_nome_check" check (char_length("nome") between 1 and 120),
  constraint "Materia_normalizado_check" check (char_length("normalizado") between 1 and 120)
);

create index if not exists "Materia_usuarioId_nome_idx"
  on public."Materia" ("usuarioId", "nome");

alter table public."Materia" enable row level security;
revoke all on table public."Materia" from anon, authenticated;
