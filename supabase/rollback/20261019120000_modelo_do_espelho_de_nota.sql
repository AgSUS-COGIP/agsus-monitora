/*
  Rollback de 20261019120000_modelo_do_espelho_de_nota.sql: saem as duas RPCs,
  a validação e as tabelas TH_MODELO_ESPELHO_NOTA e TB_MODELO_ESPELHO_NOTA
  (nada mais dependia delas). Os modelos salvos se perdem: o espelho volta aos
  textos padrão do código (o front, sem a RPC, já usa o padrão).
*/

begin;

drop function if exists public.salvar_modelo_espelho_nota(uuid, jsonb, integer);
drop function if exists public.obter_modelo_espelho_nota(uuid);
drop function if exists private."FC_VALIDAR_MODELO_ESPELHO_NOTA"(jsonb);
drop table if exists public."TH_MODELO_ESPELHO_NOTA";
drop table if exists public."TB_MODELO_ESPELHO_NOTA";

commit;
