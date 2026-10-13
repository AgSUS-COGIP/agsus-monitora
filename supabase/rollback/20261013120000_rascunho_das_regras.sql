-- ROLLBACK de supabase/migrations/20261013120000_rascunho_das_regras.sql
-- Apaga as três RPCs do rascunho das regras, a função de permissão e a tabela
-- TB_RASCUNHO_REGRA (com os rascunhos que houver: são trabalho não salvo; a tela
-- volta a guardar só neste computador, sem sincronizar). As regras salvas
-- (TH_REGRA_ANALISE e TH_REGRA_CLASSIFICACAO) não mudam.
begin;

set local lock_timeout = '10s';

drop function if exists public.descartar_rascunho_regra(text, uuid);
drop function if exists public.obter_rascunho_regra(text, uuid);
drop function if exists public.salvar_rascunho_regra(text, uuid, jsonb, integer);
drop function if exists private."FC_EXIGIR_RASCUNHO_REGRA"(text, uuid);
drop table if exists public."TB_RASCUNHO_REGRA";

commit;
