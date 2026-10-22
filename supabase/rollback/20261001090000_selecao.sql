-- Desfaz 20261001090000_selecao: tira a aba, o recurso de permissão, as funções e as tabelas.
-- ATENÇÃO: apaga as vagas carregadas (vêm da planilha "Auditoria" e podem ser recarregadas).
begin;

delete from public."RL_ABA_AREA" where "CO_ABA" = 'selecao';
delete from public."TB_ABA" where "CO_ABA" = 'selecao';

drop function if exists public.get_selecao_da_area(text);
drop function if exists public.finalizar_sync_selecao(text, boolean);
drop function if exists public.sincronizar_selecao(text, jsonb);

drop table if exists public."TB_SELECAO_VAGA";
drop table if exists public."TL_SYNC_SELECAO";

delete from public."TB_PERMISSAO_RECURSO" where recurso = 'selecao';
delete from public."TA_GRUPO_ACESSO_RECURSO" where "NO_RECURSO" = 'selecao';
create or replace function private."FC_RECURSOS_MODULO"()
 returns text[]
 language sql
 immutable
 set search_path to ''
as $function$
  select array['dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes','acessos','recursos','entrevistas']::text[];
$function$;

commit;
