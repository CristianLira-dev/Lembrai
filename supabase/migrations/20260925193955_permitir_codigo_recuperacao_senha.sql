alter table public."CodigoVerificacaoEmail"
  drop constraint if exists "CodigoVerificacaoEmail_finalidade_check";

alter table public."CodigoVerificacaoEmail"
  add constraint "CodigoVerificacaoEmail_finalidade_check"
  check ("finalidade" in ('cadastro', 'entrada', 'recuperacao'));
