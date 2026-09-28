-- Desfaz 20260928200000: o payload volta a trazer `analise` e `chave_natural`
-- (sem `municipio_uf`) e em jsonb, o recorte volta a analises_norm_key por linha e saem
-- as RPCs do parecer sob demanda. Volta às versões de 20260928180000.
begin;

DROP FUNCTION IF EXISTS public.get_analise_detalhe_do_painel(uuid);
DROP FUNCTION IF EXISTS public.get_analises_texto_do_painel(text, text);
-- As duas voltam a devolver jsonb: mudar o tipo de retorno exige DROP.
DROP FUNCTION IF EXISTS public.get_analises_dashboard_payload_v2(text, text);
DROP FUNCTION IF EXISTS public.get_analises_dashboard_filtrado(text, text[], text[], integer, integer, boolean, text);

CREATE OR REPLACE FUNCTION public.get_analises_dashboard_payload_v2(p_scope text DEFAULT 'ativo'::text, p_area text DEFAULT 'saude-indigena'::text)
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
  v_area text := lower(btrim(coalesce(p_area, 'saude-indigena')));
  v_area_nome text;
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
    'data_validacao_status', 'updated_at', 'ultima_atualizacao', 'edital_status',
    'experiencia_profissional_anos', 'experiencia_profissional_meses',
    'experiencia_profissional_dias', 'experiencia_profissional_total'
  );
  v_rows jsonb;
  v_editais jsonb;
  v_grupos_norm text[];
begin
  if not (private.pode_recurso('analises')) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  select (
    private.pode_recurso('analises')
  ) into v_can_view;

  if not coalesce(v_can_view, false) then
    raise exception 'Sem permissao para visualizar painel de analises';
  end if;

  if v_scope not in ('ativo', 'inativo', 'todos') then
    raise exception 'Escopo invalido. Use ativo, inativo ou todos.';
  end if;

  v_grupos_norm := private."FC_GRUPOS_ANALISES_DA_AREA"(v_area);
  select a."NO_AREA" into v_area_nome from public."TB_AREA" a where a."CO_AREA" = v_area;

  select coalesce(jsonb_agg(jsonb_build_array(
    v.id, v.chave_natural, v.grupo, v.unidade, v.edital, v.codigo_vaga,
    v.nome_vaga, v.candidato, v.categoria, v.modalidade_concorrencia,
    v.status_consolidado, v.etapa, v.responsavel_analise, v.data_analise,
    v.nota_final_ajustada, v.pontuacao_escolaridade,
    v.pontuacao_cursos_aperfeicoamento, v.pontuacao_experiencia_profissional,
    v.pontuacao_criterio_etnico, v.experiencia_saude_indigena_total,
    v.experiencia_atencao_basica_total, v.analise, v.link_pdf, v.pdf_status,
    v.erro_pdf, v.origem_arquivo_id, v.data_inicio_analise, v.data_fim_analise,
    v.data_validacao_status, v.updated_at, v.ultima_atualizacao, v.edital_status,
    ac.experiencia_profissional_anos, ac.experiencia_profissional_meses,
    ac.experiencia_profissional_dias, ac.experiencia_profissional_total
  ) order by v.unidade, v.edital, v.codigo_vaga, v.candidato), '[]'::jsonb)
  into v_rows
  from public."VW_ANALISES_DASHBOARD_BASE_TODOS" v
  left join public."TB_ANALISE_CURRICULAR" ac on ac.id = v.id
  where case
    when v_scope = 'ativo' then v.ativo is true and v.edital_ativo is true
    when v_scope = 'inativo' then v.edital_ativo is false
    else true
  end
    and public.analises_norm_key(v.grupo) = any (v_grupos_norm);

  select coalesce(jsonb_agg(jsonb_build_object(
    'grupo', e.grupo,
    'unidade', e.unidade,
    'edital', e.edital,
    'ativo', e.ativo,
    'data_inicio_analise', e.data_inicio_analise,
    'data_fim_analise', e.data_fim_analise
  ) order by e.unidade, e.edital), '[]'::jsonb)
  into v_editais
  from public."TB_EDITAL_ANALISE" e
  where public.analises_norm_key(e.grupo) = any (v_grupos_norm);

  return jsonb_build_object(
    'schema_version', 2,
    'scope', v_scope,
    'area', v_area,
    'area_nome', v_area_nome,
    'columns', v_columns,
    'rows', v_rows,
    'editais', v_editais,
    'total', jsonb_array_length(v_rows),
    'generated_at', now(),
    'cache', jsonb_build_object('hit', false, 'refreshed_at', now())
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_analises_dashboard_filtrado(p_scope text, p_unidades text[] DEFAULT NULL::text[], p_editais text[] DEFAULT NULL::text[], p_offset integer DEFAULT 0, p_limit integer DEFAULT 1000, p_include_total boolean DEFAULT true, p_area text DEFAULT 'saude-indigena'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
 SET statement_timeout TO '20s'
AS $function$
declare
  v_area text := lower(btrim(coalesce(p_area, 'saude-indigena')));
  v_area_nome text;
  v_grupos_norm text[];
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
  if not (private.pode_recurso('analises')) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  select (
    private.pode_recurso('analises')
  ) into v_can_view;

  if not coalesce(v_can_view, false) then
    raise exception 'Sem permissao para visualizar painel de analises';
  end if;

  if v_scope not in ('inativo', 'todos') then
    raise exception 'Escopo invalido. Use inativo ou todos.';
  end if;

  v_grupos_norm := private."FC_GRUPOS_ANALISES_DA_AREA"(v_area);
  select a."NO_AREA" into v_area_nome from public."TB_AREA" a where a."CO_AREA" = v_area;

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
      and public.analises_norm_key(base.grupo) = any (v_grupos_norm)
      and (
        coalesce(cardinality(v_unidades_norm), 0) = 0
        or public.analises_norm_key(base.unidade) = any(v_unidades_norm)
      )
      and (
        coalesce(cardinality(v_editais_norm), 0) = 0
        or public.analises_norm_key(base.edital) = any(v_editais_norm)
      );
  end if;

  -- As colunas da view seguem como antes; o tempo de experiência profissional
  -- entra como chaves a mais no fim de cada linha.
  select coalesce(jsonb_agg(filtered.linha order by filtered.ordem), '[]'::jsonb)
    into v_rows
  from (
    select
      to_jsonb(base) || jsonb_build_object(
        'experiencia_profissional_anos', ac.experiencia_profissional_anos,
        'experiencia_profissional_meses', ac.experiencia_profissional_meses,
        'experiencia_profissional_dias', ac.experiencia_profissional_dias,
        'experiencia_profissional_total', ac.experiencia_profissional_total
      ) as linha,
      row_number() over (
        order by base.unidade, base.edital, base.codigo_vaga, base.candidato, base.id
      ) as ordem
    from (
      select b.*
      from public."VW_ANALISES_DASHBOARD_BASE_TODOS" as b
      where (v_scope = 'todos' or b.edital_ativo is false)
        and public.analises_norm_key(b.grupo) = any (v_grupos_norm)
        and (
          coalesce(cardinality(v_unidades_norm), 0) = 0
          or public.analises_norm_key(b.unidade) = any(v_unidades_norm)
        )
        and (
          coalesce(cardinality(v_editais_norm), 0) = 0
          or public.analises_norm_key(b.edital) = any(v_editais_norm)
        )
      order by b.unidade, b.edital, b.codigo_vaga, b.candidato, b.id
      offset v_offset
      limit v_limit
    ) as base
    left join public."TB_ANALISE_CURRICULAR" ac on ac.id = base.id
  ) as filtered;

  return jsonb_build_object(
    'scope', v_scope,
    'area', v_area,
    'area_nome', v_area_nome,
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

revoke all on function public.get_analises_dashboard_payload_v2(text, text) from public, anon;
grant execute on function public.get_analises_dashboard_payload_v2(text, text) to authenticated, service_role;

revoke all on function public.get_analises_dashboard_filtrado(text, text[], text[], integer, integer, boolean, text) from public, anon;
grant execute on function public.get_analises_dashboard_filtrado(text, text[], text[], integer, integer, boolean, text) to authenticated, service_role;

commit;
