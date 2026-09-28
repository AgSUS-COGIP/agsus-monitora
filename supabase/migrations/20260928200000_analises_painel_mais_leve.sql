-- Painel de análises mais leve e mais rápido.
--
-- 1. O payload da lista (get_analises_dashboard_payload_v2) deixa de trazer os
--    textos longos: `analise` (o parecer, ~70% do payload da Saúde Indígena) e
--    `chave_natural` (só servia de chave interna do front). Lista, KPIs,
--    gráficos, pendências e filtros não usam nenhum dos dois. O front monta as
--    linhas pelo NOME da coluna, então tirar colunas de `columns` não desloca
--    as outras; `schema_version` passa a 3 e o front aceita as duas versões.
-- 2. O parecer vem sob demanda:
--      * get_analise_detalhe_do_painel(p_id): o de uma linha, ao abrir o
--        detalhamento;
--      * get_analises_texto_do_painel(p_scope, p_area): os da área e escopo,
--        em lote, para o CSV e para a busca geral (que também procura no
--        parecer), só quando o usuário pede um dos dois.
-- 3. O recorte por área passa a comparar a coluna gerada `grupo_norm`
--    (= coalesce(analises_norm_key(grupo), '')) em vez de chamar
--    analises_norm_key linha a linha: a função tem `SET search_path`, não é
--    embutida pelo planejador e custava uma chamada por linha da tabela
--    inteira. O resultado é o mesmo (a chave pedida nunca é vazia). Vale para
--    as duas RPCs da lista; no filtrado, também unidade e edital.
-- 4. Fora da Saúde Indígena, o payload ganha `municipio_uf` NO FIM de
--    `columns`: o município e a UF da UBS móvel, lidos do nome da vaga
--    ("… UBS móvel Seropédica/RJ …" → "Seropédica/RJ"); null quando o nome
--    não traz. Na Saúde Indígena a coluna vem sempre null.
-- 5. As RPCs da lista montam e devolvem `json` (json_agg/json_build_*) em vez
--    de `jsonb`: o conteúdo é o mesmo, a montagem fica várias vezes mais rápida
--    (como na Lista de aprovados) e o supabase-js entrega o mesmo objeto. Mudar
--    o tipo de retorno exige DROP + CREATE, na mesma transação.
--
-- Permissão igual à da lista: pode_recurso('analises') e a área tem de ser do
-- usuário (FC_PODE_AREA) ou o usuário ser admin (is_master). No detalhe, a área
-- é a do grupo da própria linha.
begin;

DROP FUNCTION IF EXISTS public.get_analises_dashboard_payload_v2(text, text);
DROP FUNCTION IF EXISTS public.get_analises_dashboard_filtrado(text, text[], text[], integer, integer, boolean, text);

CREATE FUNCTION public.get_analises_dashboard_payload_v2(p_scope text DEFAULT 'ativo'::text, p_area text DEFAULT 'saude-indigena'::text)
 RETURNS json
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
  v_com_municipio boolean;
  v_columns json := json_build_array(
    'id', 'grupo', 'unidade', 'edital', 'codigo_vaga',
    'nome_vaga', 'candidato', 'categoria', 'modalidade_concorrencia',
    'status_consolidado', 'etapa', 'responsavel_analise', 'data_analise',
    'nota_final_ajustada', 'pontuacao_escolaridade',
    'pontuacao_cursos_aperfeicoamento', 'pontuacao_experiencia_profissional',
    'pontuacao_criterio_etnico', 'experiencia_saude_indigena_total',
    'experiencia_atencao_basica_total', 'link_pdf', 'pdf_status',
    'erro_pdf', 'origem_arquivo_id', 'data_inicio_analise', 'data_fim_analise',
    'data_validacao_status', 'updated_at', 'ultima_atualizacao', 'edital_status',
    'experiencia_profissional_anos', 'experiencia_profissional_meses',
    'experiencia_profissional_dias', 'experiencia_profissional_total',
    'municipio_uf'
  );
  v_rows json;
  v_editais json;
  v_grupos_norm text[];
begin
  if not (private.pode_recurso('analises')) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;

  if v_scope not in ('ativo', 'inativo', 'todos') then
    raise exception 'Escopo invalido. Use ativo, inativo ou todos.';
  end if;

  v_grupos_norm := private."FC_GRUPOS_ANALISES_DA_AREA"(v_area);
  select a."NO_AREA" into v_area_nome from public."TB_AREA" a where a."CO_AREA" = v_area;
  v_com_municipio := v_area <> 'saude-indigena';

  select coalesce(json_agg(json_build_array(
    v.id, v.grupo, v.unidade, v.edital, v.codigo_vaga,
    v.nome_vaga, v.candidato, v.categoria, v.modalidade_concorrencia,
    v.status_consolidado, v.etapa, v.responsavel_analise, v.data_analise,
    v.nota_final_ajustada, v.pontuacao_escolaridade,
    v.pontuacao_cursos_aperfeicoamento, v.pontuacao_experiencia_profissional,
    v.pontuacao_criterio_etnico, v.experiencia_saude_indigena_total,
    v.experiencia_atencao_basica_total, v.link_pdf, v.pdf_status,
    v.erro_pdf, v.origem_arquivo_id, v.data_inicio_analise, v.data_fim_analise,
    v.data_validacao_status, v.updated_at, v.ultima_atualizacao, v.edital_status,
    ac.experiencia_profissional_anos, ac.experiencia_profissional_meses,
    ac.experiencia_profissional_dias, ac.experiencia_profissional_total,
    nullif(btrim(mu.partes[1]), '') || '/' || mu.partes[2]
  ) order by v.unidade, v.edital, v.codigo_vaga, v.candidato), '[]'::json)
  into v_rows
  from public."VW_ANALISES_DASHBOARD_BASE_TODOS" v
  join public."TB_ANALISE_CURRICULAR" ac on ac.id = v.id
  left join lateral regexp_match(v.nome_vaga, 'UBS m[óo]vel ([^/]+)/([A-Z]{2})') as mu(partes)
    on v_com_municipio
  where case
    when v_scope = 'ativo' then v.ativo is true and v.edital_ativo is true
    when v_scope = 'inativo' then v.edital_ativo is false
    else true
  end
    and ac.grupo_norm = any (v_grupos_norm);

  select coalesce(json_agg(json_build_object(
    'grupo', e.grupo,
    'unidade', e.unidade,
    'edital', e.edital,
    'ativo', e.ativo,
    'data_inicio_analise', e.data_inicio_analise,
    'data_fim_analise', e.data_fim_analise
  ) order by e.unidade, e.edital), '[]'::json)
  into v_editais
  from public."TB_EDITAL_ANALISE" e
  where e.grupo_norm = any (v_grupos_norm);

  return json_build_object(
    'schema_version', 3,
    'scope', v_scope,
    'area', v_area,
    'area_nome', v_area_nome,
    'columns', v_columns,
    'rows', v_rows,
    'editais', v_editais,
    'total', json_array_length(v_rows),
    'textos_sob_demanda', true,
    'generated_at', now(),
    'cache', json_build_object('hit', false, 'refreshed_at', now())
  );
end;
$function$;

CREATE FUNCTION public.get_analises_dashboard_filtrado(p_scope text, p_unidades text[] DEFAULT NULL::text[], p_editais text[] DEFAULT NULL::text[], p_offset integer DEFAULT 0, p_limit integer DEFAULT 1000, p_include_total boolean DEFAULT true, p_area text DEFAULT 'saude-indigena'::text)
 RETURNS json
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
  v_rows json := '[]'::json;
begin
  if not (private.pode_recurso('analises')) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;

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

  -- Recorte pelas colunas geradas *_norm da tabela (mesmo valor de
  -- analises_norm_key, sem uma chamada de função por linha).
  if coalesce(p_include_total, true) then
    select count(*)
      into v_total
    from public."VW_ANALISES_DASHBOARD_BASE_TODOS" as base
    join public."TB_ANALISE_CURRICULAR" as f on f.id = base.id
    where (v_scope = 'todos' or base.edital_ativo is false)
      and f.grupo_norm = any (v_grupos_norm)
      and (
        coalesce(cardinality(v_unidades_norm), 0) = 0
        or f.unidade_norm = any(v_unidades_norm)
      )
      and (
        coalesce(cardinality(v_editais_norm), 0) = 0
        or f.edital_norm = any(v_editais_norm)
      );
  end if;

  -- As colunas da view seguem como antes; o tempo de experiência profissional
  -- entra como chaves a mais no fim de cada linha. Cada linha segue montada em
  -- jsonb (no máximo 1000 por página); só a lista e o envelope viram json.
  select coalesce(json_agg(filtered.linha order by filtered.ordem), '[]'::json)
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
      join public."TB_ANALISE_CURRICULAR" as f on f.id = b.id
      where (v_scope = 'todos' or b.edital_ativo is false)
        and f.grupo_norm = any (v_grupos_norm)
        and (
          coalesce(cardinality(v_unidades_norm), 0) = 0
          or f.unidade_norm = any(v_unidades_norm)
        )
        and (
          coalesce(cardinality(v_editais_norm), 0) = 0
          or f.edital_norm = any(v_editais_norm)
        )
      order by b.unidade, b.edital, b.codigo_vaga, b.candidato, b.id
      offset v_offset
      limit v_limit
    ) as base
    left join public."TB_ANALISE_CURRICULAR" ac on ac.id = base.id
  ) as filtered;

  return json_build_object(
    'scope', v_scope,
    'area', v_area,
    'area_nome', v_area_nome,
    'rows', v_rows,
    'total', v_total,
    'offset', v_offset,
    'limit', v_limit,
    'has_more', json_array_length(v_rows) = v_limit,
    'filters', json_build_object(
      'unidades', coalesce(to_json(v_unidades), '[]'::json),
      'editais', coalesce(to_json(v_editais), '[]'::json)
    ),
    'generated_at', now()
  );
end;
$function$;

-- Parecer de UMA linha, para o detalhamento. Linha inexistente → null.
CREATE OR REPLACE FUNCTION public.get_analise_detalhe_do_painel(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
 SET statement_timeout TO '5s'
AS $function$
declare
  v_id uuid;
  v_analise text;
  v_chave text;
  v_grupo_norm text;
  v_area text;
begin
  if not (private.pode_recurso('analises')) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;

  select a.id, a.analise, a.chave_natural, a.grupo_norm
    into v_id, v_analise, v_chave, v_grupo_norm
    from public."TB_ANALISE_CURRICULAR" a
   where a.id = p_id;

  if not found then
    return null;
  end if;

  select ar."CO_AREA" into v_area
    from public."TB_AREA" ar
   where public.analises_norm_key(ar."NO_GRUPO_PLANILHA") = v_grupo_norm;

  if not (private.is_master() or (v_area is not null and private."FC_PODE_AREA"(v_area))) then
    raise exception 'Sem permissão para as análises desta área' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'id', v_id,
    'area', v_area,
    'analise', v_analise,
    'chave_natural', v_chave
  );
end;
$function$;

-- Pareceres da área e escopo, em lote (CSV e busca geral). Só as linhas com
-- parecer; a linha que não vem aqui tem `analise` null.
CREATE FUNCTION public.get_analises_texto_do_painel(p_scope text DEFAULT 'ativo'::text, p_area text DEFAULT 'saude-indigena'::text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
 SET statement_timeout TO '15s'
 SET work_mem TO '64MB'
 SET jit TO 'off'
AS $function$
declare
  v_scope text := lower(btrim(coalesce(p_scope, 'ativo')));
  v_area text := lower(btrim(coalesce(p_area, 'saude-indigena')));
  v_grupos_norm text[];
  v_rows json;
begin
  if not (private.pode_recurso('analises')) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;

  if v_scope not in ('ativo', 'inativo', 'todos') then
    raise exception 'Escopo invalido. Use ativo, inativo ou todos.';
  end if;

  v_grupos_norm := private."FC_GRUPOS_ANALISES_DA_AREA"(v_area);

  select coalesce(json_agg(json_build_array(v.id, v.analise)), '[]'::json)
  into v_rows
  from public."VW_ANALISES_DASHBOARD_BASE_TODOS" v
  join public."TB_ANALISE_CURRICULAR" ac on ac.id = v.id
  where case
    when v_scope = 'ativo' then v.ativo is true and v.edital_ativo is true
    when v_scope = 'inativo' then v.edital_ativo is false
    else true
  end
    and ac.grupo_norm = any (v_grupos_norm)
    and v.analise is not null;

  return json_build_object(
    'scope', v_scope,
    'area', v_area,
    'columns', json_build_array('id', 'analise'),
    'rows', v_rows,
    'total', json_array_length(v_rows),
    'generated_at', now()
  );
end;
$function$;

revoke all on function public.get_analises_dashboard_payload_v2(text, text) from public, anon;
grant execute on function public.get_analises_dashboard_payload_v2(text, text) to authenticated, service_role;

revoke all on function public.get_analises_dashboard_filtrado(text, text[], text[], integer, integer, boolean, text) from public, anon;
grant execute on function public.get_analises_dashboard_filtrado(text, text[], text[], integer, integer, boolean, text) to authenticated, service_role;

revoke all on function public.get_analise_detalhe_do_painel(uuid) from public, anon;
grant execute on function public.get_analise_detalhe_do_painel(uuid) to authenticated, service_role;

revoke all on function public.get_analises_texto_do_painel(text, text) from public, anon;
grant execute on function public.get_analises_texto_do_painel(text, text) to authenticated, service_role;

commit;
