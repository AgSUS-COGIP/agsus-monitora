/*
  Rollback de 20261015180000_espelhos_de_nota_em_massa.sql: saem
  public.obter_espelhos_de_nota e private."FC_LANCAMENTO_DO_ESPELHO" (nada mais
  dependia delas; nenhuma tabela mudou).
*/

begin;

drop function if exists public.obter_espelhos_de_nota(uuid, text[], text, text[], text, integer, text[]);
drop function if exists private."FC_LANCAMENTO_DO_ESPELHO"(jsonb);

commit;
