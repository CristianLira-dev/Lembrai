alter table public."Usuario"
  add column if not exists "proximoResumoPendenciasEm" timestamp(3),
  add column if not exists "ultimoResumoPendenciasEm" timestamp(3);

create index if not exists "Usuario_proximoResumoPendenciasEm_idx"
  on public."Usuario" ("proximoResumoPendenciasEm")
  where "proximoResumoPendenciasEm" is not null;

-- Os avisos individuais anteriores seriam duplicados pelo novo resumo por aluno.
update public."Lembrete"
set status = 'cancelado'
where status = 'agendado'
  and tipo = 'padrao_diario';
