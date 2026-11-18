/*
  O banco ANTES de 20261117190000 (cronograma com cálculo manual e datas do
  cadastro pelas etapas), no que tests/apoio/banco-do-cronograma.ts usa:
  private."FC_ESTADO_DO_CRONOGRAMA" e public.get_nucleo_cronograma_resumo com os
  comentários, copiados letra por letra do banco de produção (pg_get_functiondef
  e obj_description) em 17/11/2026, antes da aplicação. A guarda md5 da
  migration confere que são estes corpos. Não é migration: não aplicar.
*/

CREATE OR REPLACE FUNCTION private."FC_ESTADO_DO_CRONOGRAMA"(p_monitoramento_id uuid, p_data date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'pg_temp'
AS $function$
declare
  v_monitor public."TB_MONITORAMENTO_INDIGENA"%rowtype;
  v_total integer := 0;
  v_concluidas integer := 0;
  v_primeira public."TB_CRONOGRAMA_MONIT_INDIG"%rowtype;
  v_ultima public."TB_CRONOGRAMA_MONIT_INDIG"%rowtype;
  v_atual public."TB_CRONOGRAMA_MONIT_INDIG"%rowtype;
  v_proxima public."TB_CRONOGRAMA_MONIT_INDIG"%rowtype;
  v_status text;
  v_etapa text;
  v_percentual numeric := 0;
  v_dias integer;
begin
  select * into v_monitor
  from public."TB_MONITORAMENTO_INDIGENA"
  where id = p_monitoramento_id;

  if not found then
    return jsonb_build_object('status', null, 'etapa', null, 'tem_cronograma', false);
  end if;

  select count(*)::integer,
         count(*) filter (where data_fim < p_data)::integer
  into v_total, v_concluidas
  from public."TB_CRONOGRAMA_MONIT_INDIG"
  where monitoramento_id = p_monitoramento_id;

  if not v_monitor.cronograma_automatico or v_total = 0 then
    return jsonb_build_object(
      'status', coalesce(nullif(v_monitor.status_override,''), nullif(v_monitor.status,''), 'Cronograma pendente'),
      'etapa', coalesce(nullif(v_monitor.etapa_override,''), nullif(v_monitor.etapa,''), 'Cronograma pendente'),
      'tem_cronograma', false,
      'percentual', 0,
      'proxima_atividade', null,
      'proxima_data', null,
      'dias_para_proxima', null
    );
  end if;

  select * into v_primeira
  from public."TB_CRONOGRAMA_MONIT_INDIG"
  where monitoramento_id = p_monitoramento_id
  order by data_inicio, ordem
  limit 1;

  select * into v_ultima
  from public."TB_CRONOGRAMA_MONIT_INDIG"
  where monitoramento_id = p_monitoramento_id
  order by data_fim desc, ordem desc
  limit 1;

  select * into v_atual
  from public."TB_CRONOGRAMA_MONIT_INDIG"
  where monitoramento_id = p_monitoramento_id
    and p_data between data_inicio and data_fim
  order by data_inicio desc, ordem desc
  limit 1;

  select * into v_proxima
  from public."TB_CRONOGRAMA_MONIT_INDIG"
  where monitoramento_id = p_monitoramento_id
    and data_inicio > p_data
  order by data_inicio, ordem
  limit 1;

  v_percentual := round(least(100, greatest(0, (v_concluidas::numeric / nullif(v_total,0)) * 100)), 1);

  if p_data < v_primeira.data_inicio then
    v_status := 'Planejado';
    v_etapa := 'Aguardando: ' || v_primeira.atividade;
  elsif p_data > v_ultima.data_fim then
    v_status := 'Concluído';
    v_etapa := v_ultima.atividade;
    v_percentual := 100;
  elsif v_atual.id is not null then
    v_status := 'Em andamento';
    v_etapa := v_atual.atividade;
  elsif v_proxima.id is not null then
    v_status := 'Em andamento';
    v_etapa := 'Aguardando: ' || v_proxima.atividade;
  else
    v_status := 'Em andamento';
    v_etapa := coalesce(v_ultima.atividade, 'Cronograma em andamento');
  end if;

  if v_proxima.id is not null then
    v_dias := v_proxima.data_inicio - p_data;
  end if;

  v_status := coalesce(nullif(v_monitor.status_override,''), v_status);
  v_etapa := coalesce(nullif(v_monitor.etapa_override,''), v_etapa);

  return jsonb_build_object(
    'status', v_status,
    'etapa', v_etapa,
    'tem_cronograma', true,
    'percentual', v_percentual,
    'atividade_atual', case when v_atual.id is null then null else v_atual.atividade end,
    'proxima_atividade', case when v_proxima.id is null then null else v_proxima.atividade end,
    'proxima_data', case when v_proxima.id is null then null else v_proxima.data_inicio end,
    'dias_para_proxima', v_dias,
    'data_inicio', v_primeira.data_inicio,
    'data_fim', v_ultima.data_fim,
    'total_etapas', v_total,
    'etapas_concluidas', v_concluidas
  );
end;
$function$;

comment on function private."FC_ESTADO_DO_CRONOGRAMA"(uuid, date) is 'Estado do cronograma de um edital no dia p_data (status, etapa, percentual, atividade atual e próxima, datas): o cálculo de public.get_monitoramento_cronograma_estado sem a checagem de permissão (20261105170000). Só para funções SECURITY DEFINER do banco; ninguém executa direto.';

CREATE OR REPLACE FUNCTION public.get_nucleo_cronograma_resumo()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not ((private.pode_recurso('dashboard') or private.pode_recurso('nucleo') or private.pode_recurso('calendario') or private.pode_recurso('aprovados') or private.pode_recurso('importacao'))) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if not ((private.pode_recurso('dashboard') or private.pode_recurso('nucleo') or private.pode_recurso('calendario') or private.pode_recurso('aprovados') or private.pode_recurso('importacao'))) then
    raise exception 'Sem permissao para consultar resumo da Equipe Nucleo';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', m.id,
      'edital', m.edital,
      'unidade', m.unidade,
      'status', e ->> 'status',
      'etapa', e ->> 'etapa',
      'cronograma_automatico', m.cronograma_automatico,
      'cronograma_total', coalesce(c.total, 0),
      'tem_resultado_final', coalesce(c.tem_resultado_final, false),
      'percentual', coalesce((e ->> 'percentual')::numeric, 0),
      'proxima_atividade', e ->> 'proxima_atividade',
      'proxima_data', e ->> 'proxima_data',
      'dias_para_proxima', (e ->> 'dias_para_proxima')::integer,
      'status_override', m.status_override,
      'alerta_tipo', case
        when nullif(m.status_override, '') is not null then 'excepcional'
        when not m.cronograma_automatico or coalesce(c.total, 0) = 0 then 'sem_cronograma'
        when coalesce(c.total, 0) < 2 or not coalesce(c.tem_resultado_final, false) then 'incompleto'
        when (e ->> 'dias_para_proxima')::integer between 0 and 3 then 'proxima_3d'
        when (e ->> 'dias_para_proxima')::integer between 4 and 6 then 'proxima_7d'
        else 'ok'
      end
    ) order by m.unidade, m.edital)
    from public."TB_MONITORAMENTO_INDIGENA" m
    cross join lateral public.get_monitoramento_cronograma_estado(m.id, (now() at time zone 'America/Sao_Paulo')::date) e
    left join lateral (
      select
        count(*)::integer as total,
        bool_or(lower(atividade) like '%resultado final%') as tem_resultado_final
      from public."TB_CRONOGRAMA_MONIT_INDIG" c
      where c.monitoramento_id = m.id
    ) c on true
    where m.ativo is true
      and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
      and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
  ), '[]'::jsonb);
end;
$function$;

comment on function public.get_nucleo_cronograma_resumo() is null;
