-- Padronizacao de nomenclatura - item 9 (views) e remocao dos shims
-- Referencia: padrao_nomenclatura_tabelas_agsus.pdf (PDTIC 2026-2027, v1.0)
--
-- 1) As 11 views analiticas passam a VW_ maiusculo (item 9: VW_[NOME]).
-- 2) As 7 views de compatibilidade, que expunham as tabelas pelos nomes
--    antigos, sao removidas: o frontend em producao (78535d4) ja chama
--    os nomes padronizados, entao elas deixaram de ter proposito e
--    violavam os itens 2 (singular) e 3 (maiusculas).

begin;

-- ============================================================
-- 1. Remocao das views de compatibilidade
-- ============================================================

drop view if exists public.configuracoes;
drop view if exists public.dim_unidades;
drop view if exists public.mapa_saude_indigena_config;
drop view if exists public.monitoramento_indigena;
drop view if exists public.paineis_externos;
drop view if exists public.perfis_usuarios;
drop view if exists public.solicitacoes_acesso;

-- ============================================================
-- 2. Rename das views analiticas para VW_ (item 9)
-- ============================================================

alter view if exists public.vw_analises_dashboard_base_todos rename to "VW_ANALISES_DASHBOARD_BASE_TODOS";
alter view if exists public.vw_analises_dashboard_base rename to "VW_ANALISES_DASHBOARD_BASE";
alter view if exists public.vw_analises_dashboard_por_edital rename to "VW_ANALISES_DASHBOARD_POR_EDITAL";
alter view if exists public.vw_analises_kpis rename to "VW_ANALISES_KPIS";
alter view if exists public.vw_analises_por_responsavel rename to "VW_ANALISES_POR_RESPONSAVEL";
alter view if exists public.vw_analises_tendencia_diaria rename to "VW_ANALISES_TENDENCIA_DIARIA";
alter view if exists public.vw_auditoria_acessos_diaria rename to "VW_AUDITORIA_ACESSOS_DIARIA";
alter view if exists public.vw_monitoramento_indigena_kpis rename to "VW_MONITORAMENTO_INDIGENA_KPIS";
alter view if exists public.vw_monitoramento_indigena_operacional rename to "VW_MONITORAMENTO_INDIGENA_OPERACIONAL";
alter view if exists public.vw_monitoramento_indigena_por_edital rename to "VW_MONITORAMENTO_INDIGENA_POR_EDITAL";
alter view if exists public.vw_monitoramento_indigena_por_unidade rename to "VW_MONITORAMENTO_INDIGENA_POR_UNIDADE";

-- ============================================================
-- 3. Funcoes que consultam as views (o corpo nao acompanha o rename)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_analises_dashboard_contadores()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'ativos', count(*) filter (where ativo is true),
    'inativos', count(*) filter (where ativo is false),
    'todos', count(*)
  )
  from public."VW_ANALISES_DASHBOARD_BASE";
$function$;

CREATE OR REPLACE FUNCTION public.get_analises_dashboard_filtrado(p_scope text, p_unidades text[] DEFAULT NULL::text[], p_editais text[] DEFAULT NULL::text[], p_offset integer DEFAULT 0, p_limit integer DEFAULT 1000, p_include_total boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
 SET statement_timeout TO '20s'
AS $function$
declare
  v_scope text := lower(btrim(coalesce(p_scope, '')));
  v_unidades text[];
  v_editais text[];
  v_unidades_norm text[];
  v_editais_norm text[];
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_limit integer := least(greatest(coalesce(p_limit, 1000), 1), 1000);
  v_total bigint := null;
  v_rows jsonb := '[]'::jsonb;
  v_can_view boolean;
begin
  select (
    private.has_perm('paineis')
    or private.has_perm('ind')
    or private.has_perm('config')
    or private.has_perm('admin')
  ) into v_can_view;

  if not coalesce(v_can_view, false) then
    raise exception 'Sem permissao para visualizar painel de analises';
  end if;

  if v_scope not in ('inativo', 'todos') then
    raise exception 'Escopo invalido. Use inativo ou todos.';
  end if;

  select
    array_agg(distinct btrim(value) order by btrim(value)),
    array_agg(distinct public.analises_norm_key(value) order by public.analises_norm_key(value))
  into v_unidades, v_unidades_norm
  from unnest(coalesce(p_unidades, array[]::text[])) as item(value)
  where btrim(value) <> '';

  select
    array_agg(distinct btrim(value) order by btrim(value)),
    array_agg(distinct public.analises_norm_key(value) order by public.analises_norm_key(value))
  into v_editais, v_editais_norm
  from unnest(coalesce(p_editais, array[]::text[])) as item(value)
  where btrim(value) <> '';

  if coalesce(cardinality(v_unidades_norm), 0) = 0
     and coalesce(cardinality(v_editais_norm), 0) = 0 then
    raise exception 'Selecione pelo menos uma unidade ou um edital antes da consulta.';
  end if;

  if coalesce(p_include_total, true) then
    select count(*)
      into v_total
    from public."VW_ANALISES_DASHBOARD_BASE_TODOS" as base
    where (v_scope = 'todos' or base.edital_ativo is false)
      and (
        coalesce(cardinality(v_unidades_norm), 0) = 0
        or public.analises_norm_key(base.unidade) = any(v_unidades_norm)
      )
      and (
        coalesce(cardinality(v_editais_norm), 0) = 0
        or public.analises_norm_key(base.edital) = any(v_editais_norm)
      );
  end if;

  select coalesce(jsonb_agg(to_jsonb(filtered)), '[]'::jsonb)
    into v_rows
  from (
    select base.*
    from public."VW_ANALISES_DASHBOARD_BASE_TODOS" as base
    where (v_scope = 'todos' or base.edital_ativo is false)
      and (
        coalesce(cardinality(v_unidades_norm), 0) = 0
        or public.analises_norm_key(base.unidade) = any(v_unidades_norm)
      )
      and (
        coalesce(cardinality(v_editais_norm), 0) = 0
        or public.analises_norm_key(base.edital) = any(v_editais_norm)
      )
    order by base.unidade, base.edital, base.codigo_vaga, base.candidato, base.id
    offset v_offset
    limit v_limit
  ) as filtered;

  return jsonb_build_object(
    'scope', v_scope,
    'rows', v_rows,
    'total', v_total,
    'offset', v_offset,
    'limit', v_limit,
    'has_more', jsonb_array_length(v_rows) = v_limit,
    'filters', jsonb_build_object(
      'unidades', coalesce(to_jsonb(v_unidades), '[]'::jsonb),
      'editais', coalesce(to_jsonb(v_editais), '[]'::jsonb)
    ),
    'generated_at', now()
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_analises_dashboard_payload()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
 SET statement_timeout TO '8s'
AS $function$
declare
  v_payload jsonb;
  v_ttl_minutes integer := 5;
  v_can_view boolean;
begin
  select (
    private.has_perm('paineis')
    or private.has_perm('ind')
    or private.has_perm('config')
    or private.has_perm('admin')
  ) into v_can_view;

  if not coalesce(v_can_view, false) then
    raise exception 'Sem permissao para visualizar painel de analises';
  end if;

  select least(greatest(coalesce(nullif(valor, '')::integer, 5), 1), 120)
  into v_ttl_minutes
  from public."TB_CONFIGURACAO"
  where chave = 'analises_cache_ttl_minutos'
  limit 1;

  v_ttl_minutes := coalesce(v_ttl_minutes, 5);

  select c.payload
  into v_payload
  from private."TA_DASHBOARD_ANALISE" c
  where c.cache_key = 'payload'
    and c.refreshed_at >= now() - make_interval(mins => v_ttl_minutes);

  if v_payload is not null then
    return v_payload || jsonb_build_object(
      'cache', jsonb_build_object(
        'hit', true,
        'refreshed_at', (
          select refreshed_at
          from private."TA_DASHBOARD_ANALISE"
          where cache_key = 'payload'
        )
      )
    );
  end if;

  select jsonb_build_object(
    'kpis', coalesce((select to_jsonb(k) from public."VW_ANALISES_KPIS" k limit 1), '{}'::jsonb),
    'por_responsavel', coalesce((select jsonb_agg(to_jsonb(r) order by r.total desc, r.responsavel_analise) from public."VW_ANALISES_POR_RESPONSAVEL" r), '[]'::jsonb),
    'tendencia_diaria', coalesce((select jsonb_agg(to_jsonb(t) order by t.data_analise) from public."VW_ANALISES_TENDENCIA_DIARIA" t), '[]'::jsonb),
    'por_edital', coalesce((select jsonb_agg(to_jsonb(e) order by e.unidade, e.edital) from public."VW_ANALISES_DASHBOARD_POR_EDITAL" e), '[]'::jsonb),
    'config', coalesce((
      select jsonb_object_agg(chave, valor order by chave)
      from public."TB_CONFIGURACAO"
      where chave in (
        'app_version_current',
        'analises_cache_ttl_minutos',
        'access_heartbeat_minutos',
        'password_reset_flow'
      )
    ), '{}'::jsonb),
    'cache', jsonb_build_object(
      'hit', false,
      'refreshed_at', now()
    )
  ) into v_payload;

  insert into private."TA_DASHBOARD_ANALISE"(cache_key, payload, refreshed_at)
  values ('payload', v_payload, now())
  on conflict (cache_key) do update
    set payload = excluded.payload,
        refreshed_at = excluded.refreshed_at;

  return v_payload;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_analises_dashboard_payload_v2(p_scope text DEFAULT 'ativo'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
 SET statement_timeout TO '15s'
 SET lock_timeout TO '3s'
 SET work_mem TO '64MB'
 SET jit TO 'off'
AS $function$
declare
  v_scope text := lower(btrim(coalesce(p_scope, 'ativo')));
  v_can_view boolean;
  v_columns jsonb := jsonb_build_array(
    'id', 'chave_natural', 'grupo', 'unidade', 'edital', 'codigo_vaga',
    'nome_vaga', 'candidato', 'categoria', 'modalidade_concorrencia',
    'status_consolidado', 'etapa', 'responsavel_analise', 'data_analise',
    'nota_final_ajustada', 'pontuacao_escolaridade',
    'pontuacao_cursos_aperfeicoamento', 'pontuacao_experiencia_profissional',
    'pontuacao_criterio_etnico', 'experiencia_saude_indigena_total',
    'experiencia_atencao_basica_total', 'analise', 'link_pdf', 'pdf_status',
    'erro_pdf', 'origem_arquivo_id', 'data_inicio_analise', 'data_fim_analise',
    'data_validacao_status', 'updated_at', 'ultima_atualizacao', 'edital_status'
  );
  v_rows jsonb;
  v_editais jsonb;
begin
  select (
    private.has_perm('paineis')
    or private.has_perm('ind')
    or private.has_perm('config')
    or private.has_perm('admin')
  ) into v_can_view;

  if not coalesce(v_can_view, false) then
    raise exception 'Sem permissao para visualizar painel de analises';
  end if;

  if v_scope not in ('ativo', 'inativo', 'todos') then
    raise exception 'Escopo invalido. Use ativo, inativo ou todos.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_array(
    v.id, v.chave_natural, v.grupo, v.unidade, v.edital, v.codigo_vaga,
    v.nome_vaga, v.candidato, v.categoria, v.modalidade_concorrencia,
    v.status_consolidado, v.etapa, v.responsavel_analise, v.data_analise,
    v.nota_final_ajustada, v.pontuacao_escolaridade,
    v.pontuacao_cursos_aperfeicoamento, v.pontuacao_experiencia_profissional,
    v.pontuacao_criterio_etnico, v.experiencia_saude_indigena_total,
    v.experiencia_atencao_basica_total, v.analise, v.link_pdf, v.pdf_status,
    v.erro_pdf, v.origem_arquivo_id, v.data_inicio_analise, v.data_fim_analise,
    v.data_validacao_status, v.updated_at, v.ultima_atualizacao, v.edital_status
  ) order by v.unidade, v.edital, v.codigo_vaga, v.candidato), '[]'::jsonb)
  into v_rows
  from public."VW_ANALISES_DASHBOARD_BASE_TODOS" v
  where case
    when v_scope = 'ativo' then v.ativo is true and v.edital_ativo is true
    when v_scope = 'inativo' then v.edital_ativo is false
    else true
  end;

  select coalesce(jsonb_agg(jsonb_build_object(
    'grupo', e.grupo,
    'unidade', e.unidade,
    'edital', e.edital,
    'ativo', e.ativo,
    'data_inicio_analise', e.data_inicio_analise,
    'data_fim_analise', e.data_fim_analise
  ) order by e.unidade, e.edital), '[]'::jsonb)
  into v_editais
  from public."TB_EDITAL_ANALISE" e;

  return jsonb_build_object(
    'schema_version', 2,
    'scope', v_scope,
    'columns', v_columns,
    'rows', v_rows,
    'editais', v_editais,
    'total', jsonb_array_length(v_rows),
    'generated_at', now(),
    'cache', jsonb_build_object('hit', false, 'refreshed_at', now())
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_analises_dashboard_recorte(p_situacao text DEFAULT 'Ativo'::text, p_limit integer DEFAULT 1000, p_offset integer DEFAULT 0)
 RETURNS SETOF "VW_ANALISES_DASHBOARD_BASE_TODOS"
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select *
  from public."VW_ANALISES_DASHBOARD_BASE_TODOS" v
  where
    case
      when coalesce(p_situacao, 'Ativo') = 'Ativo' then v.ativo is true
      when coalesce(p_situacao, 'Ativo') = 'Inativo' then v.ativo is false
      else true
    end
  order by
    v.unidade asc,
    v.edital asc,
    v.codigo_vaga asc,
    v.candidato asc
  limit greatest(1, least(coalesce(p_limit, 1000), 2000))
  offset greatest(0, coalesce(p_offset, 0));
$function$;

CREATE OR REPLACE FUNCTION public.get_monitoramento_dashboard_payload()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_payload jsonb;
begin
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

commit;