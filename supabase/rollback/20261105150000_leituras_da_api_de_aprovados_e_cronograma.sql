/*
  Rollback de 20261105150000_leituras_da_api_de_aprovados_e_cronograma.sql.

  Apaga as duas leituras da API. /api/aprovados e /api/cronograma passam a
  responder 502 falha_na_leitura; /api/editais não muda.
*/
begin;

set local lock_timeout = '5s';

drop function if exists public.listar_cronograma_da_api();
drop function if exists public.listar_aprovados_da_api();

commit;
