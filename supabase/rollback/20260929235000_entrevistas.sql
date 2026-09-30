-- Desfaz 20260929235000_entrevistas: tira a aba, o recurso de permissão, as funções e as tabelas.
-- ATENÇÃO: apaga as entrevistas carregadas (vêm da planilha e podem ser recarregadas).
begin;

delete from public."RL_ABA_AREA" where "CO_ABA" = 'entrevistas';
delete from public."TB_ABA" where "CO_ABA" = 'entrevistas';
update public."TB_ABA" set "NU_ORDEM" = 6, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'recursos';

drop function if exists public.get_entrevistas_da_area(text);
drop function if exists public.finalizar_sync_entrevistas(text, text, boolean);
drop function if exists public.sincronizar_entrevistas(text, text, jsonb);
drop function if exists private."FC_NUMERO_EDITAL"(text);

drop table if exists public."TB_ENTREVISTA_NOTA";
drop table if exists public."TB_ENTREVISTA";
drop table if exists public."TL_SYNC_ENTREVISTA";
drop index if exists public."IN_ANALISECURRICULAR_VAGA";

delete from public."TB_PERMISSAO_RECURSO" where recurso = 'entrevistas';
delete from public."TA_GRUPO_ACESSO_RECURSO" where "NO_RECURSO" = 'entrevistas';
create or replace function private."FC_RECURSOS_MODULO"()
 returns text[]
 language sql
 immutable
 set search_path to ''
as $function$
  select array['dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes','acessos','recursos']::text[];
$function$;

commit;
