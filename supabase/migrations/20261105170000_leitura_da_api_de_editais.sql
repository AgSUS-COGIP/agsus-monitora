/*
  LEITURA DA API DE EDITAIS (service_role)

  GET /api/editais (api/editais.js) lia `listar_monitoramento_operacional`
  com a chave de servidor e dava 42501 em produção (05/11/2026): a RPC é
  SECURITY INVOKER sobre a VW_MONITORAMENTO_INDIGENA_OPERACIONAL, e a view
  monta status e etapa com public.get_monitoramento_cronograma_estado, que
  exige uma pessoa com permissão (pode_recurso). Sem sessão, recusa.

  O QUE MUDA
    1. private."FC_ESTADO_DO_CRONOGRAMA"(uuid, date): o cálculo do estado do
       cronograma, corpo IDÊNTICO ao de get_monitoramento_cronograma_estado
       (20261022184000) sem a linha do pode_recurso. Ninguém executa direto.
    2. public.get_monitoramento_cronograma_estado: mesma assinatura, mesmo
       padrão de data, mesma checagem; o cálculo passa a ser a chamada à
       interna. Para a tela e a view, nada muda (o ensaio compara edital a
       edital o antes e o depois).
    3. public.listar_editais_da_api(): SECURITY DEFINER, só service_role.
       Os editais ativos (todas as áreas) com id, unidade, edital, status,
       etapa, vagas_total, contratados, vagas_ociosas, risco e link_edital;
       status e etapa como na view, no dia de Brasília (a view hoje passa
       CURRENT_DATE, em UTC, desde 20261022200000: das 21h à meia-noite ela
       já está no dia seguinte).

  Ensaio: supabase/ensaios/20261105170000_leitura_da_api_de_editais.sql
  Rollback: supabase/rollback/20261105170000_leitura_da_api_de_editais.sql
*/
begin;

set local lock_timeout = '5s';

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.get_monitoramento_cronograma_estado(uuid, date)') is null
     or to_regprocedure('private.pode_recurso(text, integer)') is null then
    raise exception 'Faltam public.get_monitoramento_cronograma_estado(uuid, date) ou private.pode_recurso(text, integer).';
  end if;
end;
$$;

-- 1. O cálculo do estado do cronograma, sem a checagem de permissão ----------------------
-- Corpo idêntico ao de public.get_monitoramento_cronograma_estado em
-- 20261022184000_cronograma_pelo_dia_de_brasilia.sql, sem a linha do pode_recurso.
CREATE FUNCTION private."FC_ESTADO_DO_CRONOGRAMA"(p_monitoramento_id uuid, p_data date)
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
comment on function private."FC_ESTADO_DO_CRONOGRAMA"(uuid, date) is
  'Estado do cronograma de um edital no dia p_data (status, etapa, percentual, atividade atual e próxima, datas): o cálculo de public.get_monitoramento_cronograma_estado sem a checagem de permissão (20261105170000). Só para funções SECURITY DEFINER do banco; ninguém executa direto.';
revoke all on function private."FC_ESTADO_DO_CRONOGRAMA"(uuid, date) from public, anon, authenticated, service_role;

-- 2. A função pública: a mesma checagem de sempre, e o cálculo pela interna --------------
CREATE OR REPLACE FUNCTION public.get_monitoramento_cronograma_estado(p_monitoramento_id uuid, p_data date DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo'::text))::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'pg_temp'
AS $function$
begin
  if not ((private.pode_recurso('dashboard') or private.pode_recurso('nucleo') or private.pode_recurso('calendario') or private.pode_recurso('aprovados') or private.pode_recurso('importacao'))) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  return private."FC_ESTADO_DO_CRONOGRAMA"(p_monitoramento_id, p_data);
end;
$function$;

-- 3. A leitura da API de editais ---------------------------------------------------------
create function public.listar_editais_da_api()
returns jsonb
language sql
stable
security definer
set search_path to ''
set statement_timeout to '15s'
as $function$
  select jsonb_build_object('linhas', coalesce((
    select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'unidade', m.unidade,
        'edital', m.edital,
        'status', coalesce(e.estado ->> 'status', m.status, ''),
        'etapa', coalesce(e.estado ->> 'etapa', m.etapa, ''),
        'vagas_total', m.vagas_total,
        'contratados', m.contratados,
        'vagas_ociosas', m.vagas_ociosas,
        'risco', m.risco,
        'link_edital', m.link_edital
      ) order by m.unidade, m.edital)
      from public."TB_MONITORAMENTO_INDIGENA" m
     cross join lateral private."FC_ESTADO_DO_CRONOGRAMA"(m.id, ((now() AT TIME ZONE 'America/Sao_Paulo'::text))::date) e(estado)
     where m.ativo is true), '[]'::jsonb));
$function$;
comment on function public.listar_editais_da_api() is
  'API de editais para outro sistema (/api/editais, 20261105170000): { linhas } com id, unidade, edital, status, etapa, vagas_total, contratados, vagas_ociosas, risco e link_edital dos editais ativos (todas as áreas). status e etapa como na VW_MONITORAMENTO_INDIGENA_OPERACIONAL (estado do cronograma no dia de Brasília). Só service_role.';
revoke all on function public.listar_editais_da_api() from public, anon, authenticated;
grant execute on function public.listar_editais_da_api() to service_role;

commit;
