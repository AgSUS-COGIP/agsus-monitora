/*
  ROLLBACK de 20261104130000_resumo_do_dia_do_responsavel.sql

  Tira as duas RPCs e a tabela de preferências pessoais (apaga as preferências
  gravadas). O front trata a ausência da RPC (PGRST202): sem popup e sem sininho.
*/
begin;

set local lock_timeout = '5s';

drop function if exists public.salvar_minha_preferencia_do_resumo(boolean);
drop function if exists public.obter_meu_resumo_do_dia(date);
drop table if exists public."TB_PREFERENCIA_USUARIO";

notify pgrst, 'reload schema';

commit;
