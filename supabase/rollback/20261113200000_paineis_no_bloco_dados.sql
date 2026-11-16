/*
  DESFAZ 20261113200000_paineis_no_bloco_dados.sql: tira a aba "Painéis" do catálogo e o recurso
  "paineis_dados" da matriz (grupos e permissões individuais), e volta FC_RECURSOS_MODULO.
*/
begin;

delete from public."RL_ABA_AREA" where "CO_ABA" = 'paineis-de-dados';
delete from public."TB_ABA" where "CO_ABA" = 'paineis-de-dados';

delete from public."TB_PERMISSAO_RECURSO" where recurso = 'paineis_dados';
delete from public."TA_GRUPO_ACESSO_RECURSO" where "NO_RECURSO" = 'paineis_dados';

create or replace function private."FC_RECURSOS_MODULO"()
 returns text[]
 language sql
 immutable
 set search_path to ''
as $function$
  select array['dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes','acessos','recursos','entrevistas','selecao','recursos_parecer','classificacao','chat','avaliacao_documental','aprovados_pendencias']::text[];
$function$;

commit;
