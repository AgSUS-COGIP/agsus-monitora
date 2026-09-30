-- Desfaz as entrevistas no sistema (roteiros, configuração, banca e notas).
-- ATENÇÃO: apaga roteiros, configurações e notas lançadas no sistema; as
-- entrevistas TP_ORIGEM 'sistema' ficam desativadas antes de soltar as colunas.
begin;
drop function if exists public.lancar_notas_entrevista(uuid, jsonb);
drop function if exists public.desconvocar_da_entrevista(uuid, text);
drop function if exists public.convocar_para_entrevista(uuid, uuid[]);
drop function if exists public.configurar_entrevista_edital(uuid, jsonb);
drop function if exists public.obter_entrevistas_do_edital(uuid);
drop function if exists public.salvar_roteiro_entrevista(jsonb);
drop function if exists public.listar_roteiros_entrevista(text);
drop function if exists private."FC_ROTEIRO_JSON"(uuid);
drop function if exists private."FC_CALCULAR_ENTREVISTA"(uuid);
drop function if exists private."FC_EXIGIR_ENTREVISTAS_EDITAL"(uuid, integer);
drop table if exists public."TH_ENTREVISTA_AVALIACAO";
drop table if exists public."TB_ENTREVISTA_AVALIACAO";
update public."TB_ENTREVISTA" set "ST_ATIVO" = 'N' where "TP_ORIGEM" = 'sistema';
alter table public."TB_ENTREVISTA" drop constraint if exists "FK_ROTEIRO_ENTREVISTA", drop column if exists "CO_ROTEIRO", drop column if exists "NU_BANCA";
drop table if exists public."TB_ENTREVISTA_AVALIADOR";
drop table if exists public."TB_ENTREVISTA_VAGA";
drop table if exists public."TB_ENTREVISTA_EDITAL";
drop table if exists public."TB_ROTEIRO_NIVEL";
drop table if exists public."TB_ROTEIRO_COMPETENCIA";
drop table if exists public."TB_ROTEIRO_ENTREVISTA";
commit;
