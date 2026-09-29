/*
  Rollback de 20260929150000_analises_lista_enxuta.sql.

  Volta às definições que estavam no banco em 29/09/2026 antes da migration
  (conferidas com pg_get_functiondef): lista com 35 colunas (schema_version 3)
  montada na hora com o recorte por coordenação, só o escopo 'ativo' guardado,
  get_analises_dashboard_filtrado de volta e o detalhe/textos só com o parecer.

  Publique o front antigo ANTES deste rollback só se ele não aceitar o
  payload de 35 colunas — o front da lista enxuta aceita os dois.
*/
begin;

-- As funções novas saem antes da coluna que elas usam.
drop function if exists public.atualizar_cache_painel_analises(text, text[]);
drop function if exists private."FC_MONTAR_PAINEL_ANALISE"(text, text[], boolean);

delete from private."TA_PAINEL_ANALISE";
alter table private."TA_PAINEL_ANALISE" drop column if exists "DT_ULTIMA_ATUALIZACAO";
alter table private."TA_PAINEL_ANALISE" drop constraint "CK_PAINEL_ANALISE_TPESCOPO";
alter table private."TA_PAINEL_ANALISE"
  add constraint "CK_PAINEL_ANALISE_TPESCOPO"
  check ("TP_ESCOPO" = any (array['ativo', 'inativo', 'todos']));
comment on table private."TA_PAINEL_ANALISE" is
  'Cache do painel de análises: linhas e editais já montados por área e escopo. Só funções SECURITY DEFINER leem.';

CREATE OR REPLACE FUNCTION private."FC_MONTAR_PAINEL_ANALISE"(p_area text, p_escopo text, OUT p_linhas json, OUT p_editais json, OUT p_total integer)
 RETURNS record
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'private', 'pg_temp'
 SET work_mem TO '64MB'
 SET jit TO 'off'
AS $function$
declare
  v_scope text := lower(btrim(coalesce(p_escopo, 'ativo')));
  v_area text := lower(btrim(coalesce(p_area, 'saude-indigena')));
  v_com_municipio boolean;
  v_grupos_norm text[];
  v_grupo text;
begin
  if v_scope not in ('ativo', 'inativo', 'todos') then
    raise exception 'Escopo invalido. Use ativo, inativo ou todos.';
  end if;

  select a."NO_GRUPO_PLANILHA" into v_grupo
    from public."TB_AREA" a
   where a."CO_AREA" = v_area;
  if not found then
    raise exception 'Área inválida: %', v_area using errcode = '22023';
  end if;

  -- O mesmo recorte de FC_GRUPOS_ANALISES_DA_AREA, sem a checagem de permissão.
  v_grupos_norm := array[public.analises_norm_key(v_grupo)];
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
  into p_linhas
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
  into p_editais
  from public."TB_EDITAL_ANALISE" e
  where e.grupo_norm = any (v_grupos_norm);

  p_total := json_array_length(p_linhas);
end;
$function$
;

comment on function private."FC_MONTAR_PAINEL_ANALISE"(text, text) is
  'Linhas e editais do painel de análises da área/escopo. NÃO checa permissão: só para funções que já checaram.';
revoke all on function private."FC_MONTAR_PAINEL_ANALISE"(text, text) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.atualizar_cache_painel_analises(p_area text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_area text;
  v_inicio timestamptz;
  v_versao text;
  v_montado record;
  v_resultado jsonb := '[]'::jsonb;
begin
  if p_area is not null
     and not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = lower(btrim(p_area))) then
    raise exception 'Área inválida: %', p_area using errcode = '22023';
  end if;

  for v_area in
    select a."CO_AREA" from public."TB_AREA" a
     where p_area is null or a."CO_AREA" = lower(btrim(p_area))
     order by a."CO_AREA"
  loop
    begin
      -- A versão vem ANTES da montagem: sync que terminar no meio muda a versão
      -- e o guardado já nasce vencido (nunca o contrário).
      v_inicio := clock_timestamp();
      v_versao := private."FC_VERSAO_DADOS_ANALISE"(v_area);
      select * into v_montado from private."FC_MONTAR_PAINEL_ANALISE"(v_area, 'ativo');

      insert into private."TA_PAINEL_ANALISE" as c (
        "CO_AREA", "TP_ESCOPO", "DS_LINHAS", "DS_EDITAIS", "QT_LINHAS",
        "DS_VERSAO_DADOS", "DT_GERACAO", "NU_DURACAO_MS"
      ) values (
        v_area, 'ativo', v_montado.p_linhas, v_montado.p_editais, v_montado.p_total,
        v_versao, v_inicio,
        (extract(epoch from clock_timestamp() - v_inicio) * 1000)::integer
      )
      on conflict ("CO_AREA", "TP_ESCOPO") do update set
        "DS_LINHAS" = excluded."DS_LINHAS",
        "DS_EDITAIS" = excluded."DS_EDITAIS",
        "QT_LINHAS" = excluded."QT_LINHAS",
        "DS_VERSAO_DADOS" = excluded."DS_VERSAO_DADOS",
        "DT_GERACAO" = excluded."DT_GERACAO",
        "NU_DURACAO_MS" = excluded."NU_DURACAO_MS";

      v_resultado := v_resultado || jsonb_build_object(
        'area', v_area, 'escopo', 'ativo', 'ok', true, 'linhas', v_montado.p_total,
        'ms', (extract(epoch from clock_timestamp() - v_inicio) * 1000)::integer);
    exception when others then
      -- Nunca derruba quem chamou (sync, agendamento, RPC): o cache vencido é
      -- remontado depois, ou o painel monta na hora.
      raise warning 'Cache do painel de análises (%) não foi remontado: % (%)', v_area, sqlerrm, sqlstate;
      v_resultado := v_resultado || jsonb_build_object(
        'area', v_area, 'escopo', 'ativo', 'ok', false, 'erro', sqlerrm);
    end;
  end loop;

  return v_resultado;
end;
$function$
;

comment on function public.atualizar_cache_painel_analises(text) is
  'Remonta o cache do painel de análises (escopo ativo) de uma área ou de todas. Erro numa área vira aviso e ok=false; só lança para área inexistente. Só service_role/postgres (pg_cron, fim do sync).';
revoke all on function public.atualizar_cache_painel_analises(text) from public, anon, authenticated;
grant execute on function public.atualizar_cache_painel_analises(text) to service_role;

CREATE OR REPLACE FUNCTION public.atualizar_cache_painel_analises_vencidos()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_area text;
  v_cache record;
  v_resultado jsonb := '[]'::jsonb;
begin
  for v_area in select a."CO_AREA" from public."TB_AREA" a order by a."CO_AREA" loop
    select c."DS_VERSAO_DADOS", c."DT_GERACAO" into v_cache
      from private."TA_PAINEL_ANALISE" c
     where c."CO_AREA" = v_area and c."TP_ESCOPO" = 'ativo';
    if not found
       or v_cache."DS_VERSAO_DADOS" is distinct from private."FC_VERSAO_DADOS_ANALISE"(v_area)
       or v_cache."DT_GERACAO" < now() - interval '30 minutes' then
      v_resultado := v_resultado || public.atualizar_cache_painel_analises(v_area);
    end if;
  end loop;
  return v_resultado;
end;
$function$
;

comment on function public.atualizar_cache_painel_analises_vencidos() is
  'Remonta só as áreas cujo pacote do painel de análises venceu (sync novo ou mais de 30 min). Chamada pelo pg_cron a cada 2 min; barata quando nada mudou.';

CREATE OR REPLACE FUNCTION public.get_analises_dashboard_payload_v2(p_scope text DEFAULT 'ativo'::text, p_area text DEFAULT 'saude-indigena'::text)
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
    and ac.grupo_norm = any (v_grupos_norm)
    and ((select private."FC_EDITAIS_VISIVEIS"()) is null
      or ac.edital_norm = any ((select private."FC_EDITAIS_NORM_VISIVEIS"())::text[])
      or ac.unidade_norm = any ((select private."FC_UNIDADES_NORM_VISIVEIS"())::text[]));

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
  where e.grupo_norm = any (v_grupos_norm)
    and ((select private."FC_EDITAIS_VISIVEIS"()) is null
      or e.edital_norm = any ((select private."FC_EDITAIS_NORM_VISIVEIS"())::text[])
      or e.unidade_norm = any ((select private."FC_UNIDADES_NORM_VISIVEIS"())::text[]));

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
$function$
;

CREATE OR REPLACE FUNCTION public.get_analise_detalhe_do_painel(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
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

  if not (private.is_master() or (v_area is not null and private."FC_PODE_AREA"(v_area)
      and (private."FC_EDITAIS_VISIVEIS"() is null or exists (
        select 1 from public."TB_ANALISE_CURRICULAR" x
         where x.id = v_id
           and (x.edital_norm = any (private."FC_EDITAIS_NORM_VISIVEIS"())
                or x.unidade_norm = any (private."FC_UNIDADES_NORM_VISIVEIS"())))))) then
    raise exception 'Sem permissão para as análises desta área' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'id', v_id,
    'area', v_area,
    'analise', v_analise,
    'chave_natural', v_chave
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_analises_texto_do_painel(p_scope text DEFAULT 'ativo'::text, p_area text DEFAULT 'saude-indigena'::text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
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
    and ((select private."FC_EDITAIS_VISIVEIS"()) is null
      or ac.edital_norm = any ((select private."FC_EDITAIS_NORM_VISIVEIS"())::text[])
      or ac.unidade_norm = any ((select private."FC_UNIDADES_NORM_VISIVEIS"())::text[]))
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_analises_dashboard_filtrado(p_scope text, p_unidades text[] DEFAULT NULL::text[], p_editais text[] DEFAULT NULL::text[], p_offset integer DEFAULT 0, p_limit integer DEFAULT 1000, p_include_total boolean DEFAULT true, p_area text DEFAULT 'saude-indigena'::text)
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
    and ((select private."FC_EDITAIS_VISIVEIS"()) is null
      or f.edital_norm = any ((select private."FC_EDITAIS_NORM_VISIVEIS"())::text[])
      or f.unidade_norm = any ((select private."FC_UNIDADES_NORM_VISIVEIS"())::text[]))
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
    and ((select private."FC_EDITAIS_VISIVEIS"()) is null
      or f.edital_norm = any ((select private."FC_EDITAIS_NORM_VISIVEIS"())::text[])
      or f.unidade_norm = any ((select private."FC_UNIDADES_NORM_VISIVEIS"())::text[]))
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
$function$
;

revoke all on function public.get_analises_dashboard_filtrado(text, text[], text[], integer, integer, boolean, text) from public, anon;
grant execute on function public.get_analises_dashboard_filtrado(text, text[], text[], integer, integer, boolean, text) to authenticated, service_role;

-- O pronto do 'ativo' (35 colunas), como estava.
select public.atualizar_cache_painel_analises();

commit;
