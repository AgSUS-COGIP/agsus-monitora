/*
  ENSAIO de 20261105170000_leitura_da_api_de_editais.sql — begin … rollback.

  Cole no SQL Editor do Supabase (papel postgres). Como a conta do setor
  (administrador global), guarda o estado do cronograma de cada edital ativo
  pela função de ANTES, aplica a migration dentro da transação e confere:
    1. a função pública devolve o mesmo de antes, edital a edital;
    2. a interna devolve o mesmo, e ninguém (anon, authenticated, service_role)
       a executa direto;
    3. listar_editais_da_api: uma linha por edital ativo, os dez campos, status
       e etapa iguais aos da view; só service_role executa.
*/
begin;

select set_config('request.jwt.claims',
  '{"sub": "a01afddb-f64b-47d9-80e8-476a1ed14e43", "role": "authenticated"}', true);

create temporary table ensaio_estado_antes on commit drop as
  select m.id, public.get_monitoramento_cronograma_estado(m.id, ((now() AT TIME ZONE 'America/Sao_Paulo'::text))::date) as estado
    from public."TB_MONITORAMENTO_INDIGENA" m
   where m.ativo is true;

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

-- Conferências --------------------------------------------------------------------------
do $$
declare
  v_dia date := ((now() AT TIME ZONE 'America/Sao_Paulo'::text))::date;
  v_diferentes integer;
  v_total integer;
  v_linhas jsonb := public.listar_editais_da_api() -> 'linhas';
begin
  select count(*) into v_diferentes
    from ensaio_estado_antes a
   where public.get_monitoramento_cronograma_estado(a.id, v_dia) is distinct from a.estado
      or private."FC_ESTADO_DO_CRONOGRAMA"(a.id, v_dia) is distinct from a.estado;
  if v_diferentes > 0 then
    raise exception 'ENSAIO: % edital(is) com estado do cronograma diferente do de antes', v_diferentes;
  end if;

  select count(*) into v_total from ensaio_estado_antes;
  if jsonb_array_length(v_linhas) <> v_total then
    raise exception 'ENSAIO: % editais, esperado %', jsonb_array_length(v_linhas), v_total;
  end if;
  if v_total > 0 and (select array_agg(k order by k) from jsonb_object_keys(v_linhas -> 0) k)
       <> array['contratados', 'edital', 'etapa', 'id', 'link_edital', 'risco',
                'status', 'unidade', 'vagas_ociosas', 'vagas_total'] then
    raise exception 'ENSAIO: campos dos editais diferentes do combinado';
  end if;

  -- A view passa CURRENT_DATE (UTC; 20261022200000); a API, o dia de Brasília.
  -- Só dá para comparar com a view quando os dois dias são o mesmo.
  select count(*) into v_diferentes
    from jsonb_array_elements(v_linhas) l
    join public."VW_MONITORAMENTO_INDIGENA_OPERACIONAL" v on v.id = (l ->> 'id')::uuid
   where current_date = v_dia
     and ((l ->> 'status') is distinct from v.status
       or (l ->> 'etapa') is distinct from v.etapa);
  if v_diferentes > 0 then
    raise exception 'ENSAIO: % edital(is) com status/etapa diferente da view', v_diferentes;
  end if;

  if has_function_privilege('anon', 'public.listar_editais_da_api()', 'execute')
     or has_function_privilege('authenticated', 'public.listar_editais_da_api()', 'execute')
     or not has_function_privilege('service_role', 'public.listar_editais_da_api()', 'execute') then
    raise exception 'ENSAIO: só service_role deveria executar listar_editais_da_api';
  end if;
  if has_function_privilege('anon', 'private."FC_ESTADO_DO_CRONOGRAMA"(uuid, date)', 'execute')
     or has_function_privilege('authenticated', 'private."FC_ESTADO_DO_CRONOGRAMA"(uuid, date)', 'execute')
     or has_function_privilege('service_role', 'private."FC_ESTADO_DO_CRONOGRAMA"(uuid, date)', 'execute') then
    raise exception 'ENSAIO: ninguém deveria executar FC_ESTADO_DO_CRONOGRAMA direto';
  end if;
end;
$$;

select 'ok' as ensaio_da_leitura_da_api_de_editais;

rollback;
