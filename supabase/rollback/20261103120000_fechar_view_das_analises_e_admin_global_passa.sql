/*
  ROLLBACK de 20261103120000_fechar_view_das_analises_e_admin_global_passa.sql

  ATENÇÃO: desfazer REABRE a falha crítica (a VW_ANALISES_DASHBOARD_BASE_TODOS
  volta a ler como a dona, com SELECT para authenticated, sem RLS) e volta a
  deixar o administrador global abaixo de admin onde o grupo ou a permissão
  individual dele estiver abaixo. Só use para voltar ao estado de 03/11/2026
  por causa de um problema maior.

  Volta:
    - VW_ANALISES_DASHBOARD_BASE_TODOS sem opções (como a 20261022120000 deixou)
      e com SELECT para authenticated;
    - VW_ANALISES_DASHBOARD_BASE com security_invoker (como estava) e SELECT
      para authenticated;
    - private."FC_NIVEL_EFETIVO" da 20260929121000 (permissão individual ?? grupo).
*/
begin;

set local lock_timeout = '5s';

alter view public."VW_ANALISES_DASHBOARD_BASE_TODOS" reset (security_invoker);
grant select on public."VW_ANALISES_DASHBOARD_BASE_TODOS" to authenticated;
grant select on public."VW_ANALISES_DASHBOARD_BASE" to authenticated;
comment on view public."VW_ANALISES_DASHBOARD_BASE_TODOS" is null;
comment on view public."VW_ANALISES_DASHBOARD_BASE" is null;

create or replace function private."FC_NIVEL_EFETIVO"(p_perfil_usuario uuid, p_grupo text, p_recurso text)
 returns text
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce(
    (select g.nivel from public."TB_PERMISSAO_RECURSO" g
      where g.perfil_usuario_id = p_perfil_usuario and g.recurso = p_recurso),
    private."FC_NIVEL_DO_GRUPO"(p_grupo, p_recurso));
$function$;

revoke all on function private."FC_NIVEL_EFETIVO"(uuid, text, text) from public, anon, authenticated;

comment on function private."FC_NIVEL_EFETIVO"(uuid, text, text) is
  'Nível efetivo de um usuário: exceção (TB_PERMISSAO_RECURSO) ?? nível do grupo.';

select private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"();

notify pgrst, 'reload schema';

commit;
