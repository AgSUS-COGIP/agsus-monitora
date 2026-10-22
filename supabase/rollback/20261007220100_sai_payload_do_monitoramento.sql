-- ROLLBACK de supabase/migrations/20261007220100_sai_payload_do_monitoramento.sql
-- Devolve a função como estava no banco em 07/10/2026 (pg_get_functiondef).
begin;

CREATE OR REPLACE FUNCTION public.get_monitoramento_dashboard_payload()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_payload jsonb;
begin
  if not ((private.pode_recurso('dashboard') or private.pode_recurso('nucleo') or private.pode_recurso('calendario') or private.pode_recurso('aprovados') or private.pode_recurso('importacao'))) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  select jsonb_build_object(
    'kpis', coalesce((select to_jsonb(k) from public."VW_MONITORAMENTO_INDIGENA_KPIS" k limit 1), '{}'::jsonb),
    'por_unidade', coalesce((select jsonb_agg(to_jsonb(u) order by u.unidade) from public."VW_MONITORAMENTO_INDIGENA_POR_UNIDADE" u), '[]'::jsonb),
    'por_edital', coalesce((select jsonb_agg(to_jsonb(e) order by e.unidade, e.edital, e.etapa, e.status) from public."VW_MONITORAMENTO_INDIGENA_POR_EDITAL" e), '[]'::jsonb),
    'config', coalesce((
      select jsonb_object_agg(chave, valor order by chave)
      from public."TB_CONFIGURACAO"
      where chave in (
        'app_version_current',
        'access_heartbeat_minutos',
        'feature_modo_executivo',
        'feature_realtime_monitoramento',
        'password_reset_flow'
      )
    ), '{}'::jsonb)
  ) into v_payload;

  return v_payload;
end;
$function$;

revoke all on function public.get_monitoramento_dashboard_payload() from public, anon;
grant execute on function public.get_monitoramento_dashboard_payload() to authenticated;

notify pgrst, 'reload schema';

commit;
