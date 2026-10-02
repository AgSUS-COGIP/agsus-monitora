-- Desfaz 20261002120000_classificacao: tira a aba (e volta a ordem: aprovados 7,
-- seleção 8), as funções, as tabelas e o recurso de permissão 'classificacao'.
-- ATENÇÃO: apaga as regras, as versões, as listas geradas e os sorteios/decisões
-- registrados. Exporte antes (obter_lista_classificacao) se precisar guardar.
begin;

delete from public."RL_ABA_AREA" where "CO_ABA" = 'classificacao';
delete from public."TB_ABA" where "CO_ABA" = 'classificacao';
update public."TB_ABA" set "NU_ORDEM" = 7, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'aprovados';
update public."TB_ABA" set "NU_ORDEM" = 8, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'selecao';

drop function if exists public.registrar_desempate_classificacao(uuid, jsonb);
drop function if exists public.obter_lista_classificacao(uuid);
drop function if exists public.publicar_lista_classificacao(uuid);
drop function if exists public.registrar_lista_classificacao(uuid, text, integer, jsonb);
drop function if exists public.salvar_regra_classificacao(uuid, jsonb, integer, text);
drop function if exists public.obter_classificacao_do_edital(uuid);
drop function if exists public.listar_editais_classificacao(text);
drop function if exists private."FC_DESEMPATE_CLASSIFICACAO_JSON"(uuid);
drop function if exists private."FC_LISTA_CLASSIFICACAO_JSON"(uuid);
drop function if exists private."FC_REGRA_CLASSIFICACAO_JSON"(uuid);
drop function if exists private."FC_VALIDAR_REGRA_CLASSIFICACAO"(jsonb);
drop function if exists private."FC_JSON_NUMERO_ENTRE"(jsonb, numeric, numeric);
drop function if exists private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(uuid, integer);

drop table if exists public."TB_DESEMPATE_CLASSIFICACAO";
drop table if exists public."TB_LISTA_CLASSIFICACAO";
drop table if exists public."RL_REGRA_CRITERIO_DESEMPATE";
drop table if exists public."TH_REGRA_CLASSIFICACAO";
drop table if exists public."TB_REGRA_CLASSIFICACAO";
drop table if exists public."TB_CRITERIO_CLASSIFICACAO";

delete from public."TB_PERMISSAO_RECURSO" where recurso = 'classificacao';
delete from public."TA_GRUPO_ACESSO_RECURSO" where "NO_RECURSO" = 'classificacao';
create or replace function private."FC_RECURSOS_MODULO"()
 returns text[]
 language sql
 immutable
 set search_path to ''
as $function$
  select array['dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes','acessos','recursos','entrevistas','selecao','recursos_parecer']::text[];
$function$;

commit;
