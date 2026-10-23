-- ENSAIO de supabase/migrations/20261024100000_resumo_do_painel_a_cada_5_min.sql: roda o corpo e desfaz (rollback).
-- Esperado:
--   o job agsus_analises_cache_do_painel fica com '*/5 * * * *', o mesmo comando e o mesmo active;
--   (marca de uma carga recém-chegada é consumida por uma rodada antes de medir);
--   sem marca de ANALISES em TL_ALTERACAO_CACHE (e pacotes com menos de 24 h), uma rodada de
--   atualizar_cache_painel_analises_vencidos() não remonta nada e custa milissegundos;
--   um update numa linha de TB_ANALISE_CURRICULAR (o que a carga de TL_SYNC_ANALISE faz) marca a área;
--   a rodada seguinte remonta só essa área, apaga a marca, e a próxima volta a não remontar nada.
-- A rodada é medida pela função que o procedimento chama (o procedimento faz commit e não roda
-- dentro de begin…rollback). O resultado (json) traz só verdadeiro/falso, números e áreas.
begin;

-- ═══ CORPO DA MIGRATION (início) ═══

set local lock_timeout = '5s';

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'agsus_analises_cache_do_painel') then
    raise exception 'Aplique antes 20261022185000_falha_do_cache_aparece_no_status.sql (o job agsus_analises_cache_do_painel não existe).';
  end if;
end;
$$;

select cron.alter_job(jobid, schedule := '*/5 * * * *')
  from cron.job where jobname = 'agsus_analises_cache_do_painel';
-- ═══ CORPO DA MIGRATION (fim) ═══

create temporary table t_ensaio (chave text primary key, valor jsonb) on commit drop;

do $$
declare
  v_job record;
  v_area constant text := 'saude-indigena';
  v_linha uuid;
  v_inicio timestamptz;
  v_ms_sem_marca numeric;
  v_ms_com_marca numeric;
  v_ms_depois numeric;
  v_remontadas_sem_marca integer;
  v_remontadas_com_marca text[];
  v_remontadas_depois integer;
  v_marcas_antes integer;
  v_marcou boolean;
  v_ms_arrumacao numeric;
begin
  select j.schedule, j.command, j.active into v_job
    from cron.job j where j.jobname = 'agsus_analises_cache_do_painel';
  insert into t_ensaio values ('job', jsonb_build_object(
    'agenda', v_job.schedule,
    'agenda_a_cada_5_min', v_job.schedule = '*/5 * * * *',
    'mesmo_comando', v_job.command = 'call private."PR_REMONTAR_CACHE_AGENDADO"(''ANALISES'');',
    'ativo', v_job.active));

  -- 0. Se já havia marca (carga recém-chegada), uma rodada a consome antes de medir.
  select count(*) into v_marcas_antes from private."TL_ALTERACAO_CACHE" t where t."TP_CACHE" = 'ANALISES';
  v_inicio := clock_timestamp();
  perform public.atualizar_cache_painel_analises_vencidos();
  v_ms_arrumacao := round(extract(epoch from clock_timestamp() - v_inicio) * 1000, 1);

  -- 1. Rodada sem marca.
  v_inicio := clock_timestamp();
  perform public.atualizar_cache_painel_analises_vencidos();
  v_ms_sem_marca := round(extract(epoch from clock_timestamp() - v_inicio) * 1000, 1);
  select count(distinct c."CO_AREA") into v_remontadas_sem_marca
    from private."TA_PAINEL_ANALISE" c where c."DT_GERACAO" >= v_inicio;

  -- 2. Uma linha da área muda, como na carga: o gatilho marca a área.
  select a.id into v_linha from public."TB_ANALISE_CURRICULAR" a where a."CO_AREA" = v_area limit 1;
  update public."TB_ANALISE_CURRICULAR" a set updated_at = a.updated_at where a.id = v_linha;
  v_marcou := private."FC_CACHE_DESATUALIZADO"('ANALISES', v_area);
  if not v_marcou then
    raise exception 'Ensaio: o update em TB_ANALISE_CURRICULAR não marcou a área %.', v_area;
  end if;

  -- 3. Rodada com marca: remonta só a área marcada e apaga a marca.
  v_inicio := clock_timestamp();
  perform public.atualizar_cache_painel_analises_vencidos();
  v_ms_com_marca := round(extract(epoch from clock_timestamp() - v_inicio) * 1000, 1);
  select array_agg(distinct c."CO_AREA") into v_remontadas_com_marca
    from private."TA_PAINEL_ANALISE" c where c."DT_GERACAO" >= v_inicio;

  -- 4. A rodada seguinte volta a não ter o que remontar.
  v_inicio := clock_timestamp();
  perform public.atualizar_cache_painel_analises_vencidos();
  v_ms_depois := round(extract(epoch from clock_timestamp() - v_inicio) * 1000, 1);
  select count(distinct c."CO_AREA") into v_remontadas_depois
    from private."TA_PAINEL_ANALISE" c where c."DT_GERACAO" >= v_inicio;

  insert into t_ensaio values ('rodadas', jsonb_build_object(
    'marcas_de_analises_antes', v_marcas_antes,
    'arrumacao_ms', v_ms_arrumacao,
    'sem_marca_ms', v_ms_sem_marca,
    'sem_marca_areas_remontadas', v_remontadas_sem_marca,
    'update_marcou_a_area', v_marcou,
    'com_marca_ms', v_ms_com_marca,
    'com_marca_areas_remontadas', to_jsonb(v_remontadas_com_marca),
    'marca_apagada', not private."FC_CACHE_DESATUALIZADO"('ANALISES', v_area),
    'rodada_seguinte_ms', v_ms_depois,
    'rodada_seguinte_areas_remontadas', v_remontadas_depois));
end;
$$;

select json_build_object(
  'job', (select valor from t_ensaio where chave = 'job'),
  'rodadas', (select valor from t_ensaio where chave = 'rodadas')
) as ensaio;

rollback;
