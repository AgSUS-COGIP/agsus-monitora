-- Desfaz 20261006090000_avaliacao_documental_permissao_e_menu: tira a aba
-- 'avaliacao-documental' (e volta a ordem: recursos 5, entrevistas 6,
-- classificação 7, aprovados 8, seleção 9), devolve o rótulo "Análises
-- curriculares" e tira o recurso de permissão 'avaliacao_documental'.
-- Desfaça antes 20261006100000_regra_da_analise (as RPCs dela usam o recurso).
begin;

delete from public."RL_ABA_AREA" where "CO_ABA" = 'avaliacao-documental';
delete from public."TB_ABA" where "CO_ABA" = 'avaliacao-documental';
update public."TB_ABA" set "NU_ORDEM" = 5, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'recursos';
update public."TB_ABA" set "NU_ORDEM" = 6, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'entrevistas';
update public."TB_ABA" set "NU_ORDEM" = 7, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'classificacao';
update public."TB_ABA" set "NU_ORDEM" = 8, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'aprovados';
update public."TB_ABA" set "NU_ORDEM" = 9, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'selecao';
update public."TB_ABA" set "NO_ABA" = 'Análises curriculares', "DT_ATUALIZACAO" = now() where "CO_ABA" = 'analises';

delete from public."TB_PERMISSAO_RECURSO" where recurso = 'avaliacao_documental';
delete from public."TA_GRUPO_ACESSO_RECURSO" where "NO_RECURSO" = 'avaliacao_documental';
create or replace function private."FC_RECURSOS_MODULO"()
 returns text[]
 language sql
 immutable
 set search_path to ''
as $function$
  select array['dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes','acessos','recursos','entrevistas','selecao','recursos_parecer','classificacao','chat']::text[];
$function$;

commit;
