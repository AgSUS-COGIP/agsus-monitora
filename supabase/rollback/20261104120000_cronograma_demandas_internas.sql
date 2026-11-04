/*
  ROLLBACK de 20261104120000_cronograma_demandas_internas.sql

  Tira as RPCs, as funções auxiliares e as tabelas das demandas internas e dos
  responsáveis pelo edital. ATENÇÃO: apaga as demandas internas, os responsáveis
  e os históricos gravados desde a aplicação (exporte antes se precisar deles).
  O front desta versão trata a ausência das RPCs (PGRST202) escondendo as
  demandas e o bloco de responsáveis.
*/
begin;

set local lock_timeout = '5s';

drop function if exists public.salvar_responsaveis_do_edital(uuid, uuid[]);
drop function if exists public.obter_responsaveis_do_edital(uuid);
drop function if exists public.listar_pessoas_da_area(text, uuid);
drop function if exists public.excluir_demanda_interna(uuid);
drop function if exists public.concluir_demanda_interna(uuid, boolean);
drop function if exists public.salvar_demanda_interna(jsonb);
drop function if exists public.listar_demandas_internas();

drop function if exists private."FC_RESPONSAVEIS_DO_EDITAL_JSON"(uuid);
drop function if exists private."FC_DEMANDA_INTERNA_JSON"(uuid);
drop function if exists private."FC_PERFIL_PODE_SER_RESPONSAVEL"(uuid, text, uuid);
drop function if exists private."FC_PODE_EDITAR_DEMANDA"(text, uuid);
drop function if exists private."FC_PODE_VER_DEMANDA"(text, uuid);
drop function if exists private."FC_PODE_EDITAR_CRONOGRAMA_AREA"(text);

drop table if exists public."TH_RESPONSAVEL_EDITAL";
drop table if exists public."RL_RESPONSAVEL_EDITAL";
drop table if exists public."TH_DEMANDA_INTERNA";
drop table if exists public."RL_DEMANDA_INTERNA_RESPONSAVEL";
drop table if exists public."TB_DEMANDA_INTERNA";

notify pgrst, 'reload schema';

commit;
