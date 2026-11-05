/*
  Rollback de 20261105170000_leitura_da_api_de_editais.sql.

  Apaga a leitura própria da API de editais. /api/editais passa a responder
  502 (a função some); aprovados e cronograma não mudam.
*/
begin;

set local lock_timeout = '5s';

drop function if exists public.listar_editais_da_api();

commit;
