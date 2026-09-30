-- Desfaz 20260930235800: sai o cron e a função nova; atualizar_indicadores_dashboard volta a gravar os KPIs (versão anterior abaixo). Os valores já recalculados ficam.
begin;
select cron.unschedule('agsus_kpis_do_edital_pela_selecao') where exists (select 1 from cron.job where jobname = 'agsus_kpis_do_edital_pela_selecao');
drop function if exists private."FC_ATUALIZAR_KPIS_PELA_SELECAO"();
CREATE OR REPLACE FUNCTION public.atualizar_indicadores_dashboard(p_sync_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_lidos integer := 0;
  v_atualizados integer := 0;
  v_sem_match integer := 0;
  v_result jsonb;
begin
  select count(*) into v_lidos
  from public."TM_DASHBOARD_MONIT_INDIG"
  where sync_id = p_sync_id;

  with numeric_agg as (
    select
      sync_id,
      edital,
      max(nullif(unidade_normalizada, '')) as unidade_normalizada,
      sum(inscritos)::integer as inscritos,
      sum(aptos_analise)::integer as aptos_analise,
      sum(cancelados)::integer as cancelados,
      sum(eliminados_nota)::integer as eliminados_nota,
      sum(reprovados_analise)::integer as reprovados_analise,
      sum(total_eliminados)::integer as total_eliminados,
      sum(aprovados_analise)::integer as aprovados_analise,
      sum(aprovados_prova)::integer as aprovados_prova,
      sum(entrevistados)::integer as entrevistados,
      sum(contratados)::integer as contratados,
      string_agg(distinct nullif(observacoes_origem, ''), ' | ') filter (where nullif(observacoes_origem, '') is not null) as observacoes
    from public."TM_DASHBOARD_MONIT_INDIG"
    where sync_id = p_sync_id
    group by sync_id, edital
  ), cargo_agg as (
    select
      s.sync_id,
      s.edital,
      string_agg(distinct c.cargo, ' | ' order by c.cargo) filter (where c.cargo is not null and c.cargo <> '') as cargos
    from public."TM_DASHBOARD_MONIT_INDIG" s
    left join lateral jsonb_array_elements_text(coalesce(s.cargos_json, '[]'::jsonb)) as c(cargo) on true
    where s.sync_id = p_sync_id
    group by s.sync_id, s.edital
  ), agg as (
    select n.*, c.cargos
    from numeric_agg n
    left join cargo_agg c
      on c.sync_id = n.sync_id
     and c.edital = n.edital
  ), updated as (
    update public."TB_MONITORAMENTO_INDIGENA" m
    set
      -- ATENCAO: vagas_total representa Vagas Imediatas Previstas e e campo manual/Equipe Nucleo.
      -- A carga automatica NAO altera vagas_total.
      inscritos = coalesce(a.inscritos, 0),
      aptos_analise = coalesce(a.aptos_analise, 0),
      cancelados = coalesce(a.cancelados, 0),
      eliminados_nota = coalesce(a.eliminados_nota, 0),
      reprovados_analise = coalesce(a.reprovados_analise, 0),
      total_eliminados = coalesce(a.total_eliminados, 0),
      aprovados_analise = coalesce(a.aprovados_analise, 0),
      aprovados_prova = coalesce(a.aprovados_prova, 0),
      entrevistados = coalesce(a.entrevistados, 0),
      contratados = coalesce(a.contratados, 0),
      cargos = coalesce(nullif(a.cargos, ''), m.cargos),
      observacoes = coalesce(nullif(a.observacoes, ''), m.observacoes),
      updated_at = now()
    from agg a
    where m.edital = a.edital
      and m.ativo = true
    returning m.edital
  )
  select count(*) into v_atualizados from updated;

  select greatest(count(*) - v_atualizados, 0) into v_sem_match
  from (
    select distinct edital
    from public."TM_DASHBOARD_MONIT_INDIG"
    where sync_id = p_sync_id
  ) e;

  v_result := jsonb_build_object(
    'ok', true,
    'sync_id', p_sync_id,
    'linhas_lidas', v_lidos,
    'editais_atualizados', v_atualizados,
    'editais_sem_match', v_sem_match,
    'preservou_vagas_total', true
  );

  update public."TL_SYNC_MONIT_INDIGENA"
  set status = 'processado',
      linhas_processadas = v_lidos,
      total_atualizados = v_atualizados,
      total_sem_match = v_sem_match,
      resultado = v_result,
      erro = null,
      finished_at = now(),
      updated_at = now()
  where sync_id = p_sync_id;

  delete from public."TM_DASHBOARD_MONIT_INDIG"
  where sync_id = p_sync_id;

  delete from public."TM_DASHBOARD_MONIT_INDIG"
  where created_at < now() - interval '7 days';

  return v_result;
exception when others then
  update public."TL_SYNC_MONIT_INDIGENA"
  set status = 'erro',
      erro = sqlerrm,
      finished_at = now(),
      updated_at = now()
  where sync_id = p_sync_id;
  raise;
end;
$function$
;
commit;
