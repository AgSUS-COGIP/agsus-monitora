-- ROLLBACK de supabase/migrations/20261007220000_caches_so_quando_muda.sql
-- Volta às definições que estavam no banco em 07/10/2026 (pg_get_functiondef antes da
-- migration): as funções de versão, a remontagem a cada 6 h / 30 min e a contagem dos
-- marcos na hora. Nada gravado se perde (os caches são refeitos pelo pg_cron).
begin;

-- Gatilhos e marcas
drop trigger if exists "TG_ANALISE_CACHE_INS" on public."TB_ANALISE_CURRICULAR";
drop trigger if exists "TG_ANALISE_CACHE_UPD" on public."TB_ANALISE_CURRICULAR";
drop trigger if exists "TG_ANALISE_CACHE_DEL" on public."TB_ANALISE_CURRICULAR";
drop trigger if exists "TG_EDITALANALISE_CACHE_INS" on public."TB_EDITAL_ANALISE";
drop trigger if exists "TG_EDITALANALISE_CACHE_UPD" on public."TB_EDITAL_ANALISE";
drop trigger if exists "TG_EDITALANALISE_CACHE_DEL" on public."TB_EDITAL_ANALISE";
drop trigger if exists "TG_LISTAAPROV_CACHE_INS" on public."TB_LISTA_APROVADO";
drop trigger if exists "TG_LISTAAPROV_CACHE_UPD" on public."TB_LISTA_APROVADO";
drop trigger if exists "TG_LISTAAPROV_CACHE_DEL" on public."TB_LISTA_APROVADO";
drop trigger if exists "TG_CANDAPROV_CACHE_INS" on public."TB_CANDIDATO_APROVADO";
drop trigger if exists "TG_CANDAPROV_CACHE_UPD" on public."TB_CANDIDATO_APROVADO";
drop trigger if exists "TG_CANDAPROV_CACHE_DEL" on public."TB_CANDIDATO_APROVADO";
drop trigger if exists "TG_MONITINDIG_CACHE_INS" on public."TB_MONITORAMENTO_INDIGENA";
drop trigger if exists "TG_MONITINDIG_CACHE_UPD" on public."TB_MONITORAMENTO_INDIGENA";
drop trigger if exists "TG_MONITINDIG_CACHE_DEL" on public."TB_MONITORAMENTO_INDIGENA";
drop trigger if exists "TG_ENTREVISTA_CACHE_INS" on public."TB_ENTREVISTA";
drop trigger if exists "TG_ENTREVISTA_CACHE_UPD" on public."TB_ENTREVISTA";
drop trigger if exists "TG_ENTREVISTA_CACHE_DEL" on public."TB_ENTREVISTA";
drop trigger if exists "TG_ENTREVNOTA_CACHE_INS" on public."TB_ENTREVISTA_NOTA";
drop trigger if exists "TG_ENTREVNOTA_CACHE_UPD" on public."TB_ENTREVISTA_NOTA";
drop trigger if exists "TG_ENTREVNOTA_CACHE_DEL" on public."TB_ENTREVISTA_NOTA";
drop trigger if exists "TG_SYNCENTREV_CACHE_INS" on public."TL_SYNC_ENTREVISTA";
drop trigger if exists "TG_SYNCENTREV_CACHE_UPD" on public."TL_SYNC_ENTREVISTA";
drop trigger if exists "TG_AREA_CACHE_INS" on public."TB_AREA";
drop trigger if exists "TG_AREA_CACHE_UPD" on public."TB_AREA";
drop function if exists private."FC_TG_CACHE_ANALISE"();
drop function if exists private."FC_TG_CACHE_EDITAL_ANALISE"();
drop function if exists private."FC_TG_CACHE_LISTA_APROVADO"();
drop function if exists private."FC_TG_CACHE_CANDIDATO_APROVADO"();
drop function if exists private."FC_TG_CACHE_MONITORAMENTO"();
drop function if exists private."FC_TG_CACHE_ENTREVISTA"();
drop function if exists private."FC_TG_CACHE_ENTREVISTA_NOTA"();
drop function if exists private."FC_TG_CACHE_SYNC_ENTREVISTA"();
drop function if exists private."FC_TG_CACHE_AREA"();

-- Funções de versão
CREATE OR REPLACE FUNCTION private."FC_VERSAO_DADOS_ANALISE"(p_area text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select count(*)::text || '|' || coalesce(max(s.finished_at)::text, '-')
    from public."TL_SYNC_ANALISE" s
    join public."TB_PLANILHA_ANALISE" p on p."CO_PLANILHA" = s."CO_PLANILHA"
   where p."CO_AREA" = p_area
     and s.finished_at is not null;
$function$;
CREATE OR REPLACE FUNCTION private."FC_VERSAO_APROVADOS_AREA"(p_area text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with l as (
    select l.id,
           l.vigente,
           hashtext(l.xmin::text || '|' || coalesce(m.edital, '') || '|' || coalesce(m.unidade, ''))::bigint as h
      from public."TB_LISTA_APROVADO" l
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
     where m."CO_AREA" = p_area
  ), c as (
    select count(*) as n,
           count(*) filter (where c.removido_em is null) as vivos,
           coalesce(sum(hashtext(c.xmin::text)::bigint), 0) as s
      from public."TB_CANDIDATO_APROVADO" c
     where c.lista_id in (select l.id from l where l.vigente is true)
  )
  select (select count(*)::text || '.' || coalesce(sum(l.h), 0)::text from l)
         || '.' || c.n::text || '.' || c.vivos::text || '.' || c.s::text
    from c;
$function$;
CREATE OR REPLACE FUNCTION private."FC_VERSAO_ENTREVISTAS"(p_area text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  -- Entrevistas da área + versão das análises (o pacote mostra nota/resultado
  -- da análise e os aprovados sem entrevista).
  select count(*)::text || '|' || coalesce(max(e."DT_ATUALIZACAO")::text, '-')
         || '|' || private."FC_VERSAO_DADOS_ANALISE"(p_area)
    from public."TB_ENTREVISTA" e
   where e."CO_AREA" = p_area;
$function$;
revoke all on function private."FC_VERSAO_DADOS_ANALISE"(text) from public, anon, authenticated;
revoke all on function private."FC_VERSAO_APROVADOS_AREA"(text) from public, anon, authenticated;
revoke all on function private."FC_VERSAO_ENTREVISTAS"(text) from public, anon, authenticated;

-- Montagem do painel sem as concluídas por ano
drop function private."FC_MONTAR_PAINEL_ANALISE"(text, text[], boolean);
CREATE OR REPLACE FUNCTION private."FC_MONTAR_PAINEL_ANALISE"(p_area text, p_escopos text[], p_so_visiveis boolean DEFAULT false)
 RETURNS TABLE("TP_ESCOPO" text, "DS_LINHAS" json, "QT_LINHAS" integer, "DS_EDITAIS" json, "DT_ULTIMA_ATUALIZACAO" timestamp with time zone)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'private', 'pg_temp'
 SET work_mem TO '64MB'
 SET jit TO 'off'
AS $function$
declare
  v_area text := lower(btrim(coalesce(p_area, 'saude-indigena')));
  v_grupo text;
  v_grupos_norm text[];
  v_editais json;
  v_restrito boolean;
  v_editais_norm text[];
  v_unidades_norm text[];
begin
  if p_escopos is null or cardinality(p_escopos) = 0
     or not (p_escopos <@ array['ativo', 'inativo', 'desativadas']) then
    raise exception 'Escopo invalido. Use ativo, inativo ou desativadas.';
  end if;

  select a."NO_GRUPO_PLANILHA" into v_grupo
    from public."TB_AREA" a
   where a."CO_AREA" = v_area;
  if not found then
    raise exception 'Área inválida: %', v_area using errcode = '22023';
  end if;

  -- O mesmo recorte de FC_GRUPOS_ANALISES_DA_AREA, sem a checagem de permissão.
  v_grupos_norm := array[public.analises_norm_key(v_grupo)];

  -- Recorte por coordenação só quando pedido (a RPC, para quem tem recorte);
  -- o pacote guardado é o da área inteira.
  v_restrito := coalesce(p_so_visiveis, false) and private."FC_EDITAIS_VISIVEIS"() is not null;
  if v_restrito then
    v_editais_norm := coalesce(private."FC_EDITAIS_NORM_VISIVEIS"(), '{}');
    v_unidades_norm := coalesce(private."FC_UNIDADES_NORM_VISIVEIS"(), '{}');
  end if;

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
    and (not v_restrito
      or e.edital_norm = any (v_editais_norm)
      or e.unidade_norm = any (v_unidades_norm));

  -- Colunas na ordem de `columns` de get_analises_dashboard_payload_v2. A ordem
  -- das linhas é a de sempre, com o id no fim para desempatar (a mesma análise
  -- repetida para o candidato trocava de lugar entre uma montagem e outra).
  return query
  with linhas as (
    select
      case
        when v.edital_ativo is false then 'inativo'
        when v.ativo is true then 'ativo'
        else 'desativadas'
      end as escopo,
      v.id, v.unidade, v.edital, v.codigo_vaga, v.candidato,
      coalesce(v.updated_at, v.ultima_atualizacao) as atualizado_em,
      json_build_array(
        v.id, v.unidade, v.edital, v.codigo_vaga, v.nome_vaga, v.candidato,
        v.categoria, v.modalidade_concorrencia, v.status_consolidado, v.etapa,
        v.responsavel_analise, v.data_analise, v.nota_final_ajustada,
        v.pdf_status, nullif(btrim(v.link_pdf), '') is not null
      ) as linha
    from public."VW_ANALISES_DASHBOARD_BASE_TODOS" v
    join public."TB_ANALISE_CURRICULAR" ac on ac.id = v.id
    where ac.grupo_norm = any (v_grupos_norm)
      and (not v_restrito
        or ac.edital_norm = any (v_editais_norm)
        or ac.unidade_norm = any (v_unidades_norm))
  ),
  agregado as (
    select l.escopo,
           json_agg(l.linha order by l.unidade, l.edital, l.codigo_vaga, l.candidato, l.id) as linhas,
           count(*)::integer as total,
           max(l.atualizado_em) as atualizado_em
      from linhas l
     where l.escopo = any (p_escopos)
     group by l.escopo
  )
  select pedido.escopo, coalesce(a.linhas, '[]'::json), coalesce(a.total, 0), v_editais,
         a.atualizado_em
    from unnest(p_escopos) as pedido(escopo)
    left join agregado a on a.escopo = pedido.escopo;
end;
$function$;
revoke all on function private."FC_MONTAR_PAINEL_ANALISE"(text, text[], boolean) from public, anon, authenticated;

-- Quem remonta e quem serve, como antes
CREATE OR REPLACE FUNCTION public.atualizar_cache_aprovados(p_area text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET lock_timeout TO '3s'
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
    -- Uma montagem por área de cada vez (a RPC que já tem a trava a reobtém).
    if not pg_try_advisory_xact_lock(hashtext('aprovados_area:' || v_area)::bigint) then
      v_resultado := v_resultado || jsonb_build_object('area', v_area, 'ok', false, 'erro', 'ocupado');
      continue;
    end if;
    begin
      v_inicio := clock_timestamp();
      v_versao := private."FC_VERSAO_APROVADOS_AREA"(v_area);
      select * into v_montado from private."FC_MONTAR_APROVADOS_AREA"(v_area, null);

      insert into private."TA_CANDIDATO_APROVADO_AREA" as c (
        "CO_AREA", "DS_LISTAS", "DS_DICIONARIOS", "DS_LINHAS", "QT_CANDIDATOS",
        "DS_VERSAO_DADOS", "DT_GERACAO", "NU_DURACAO_MS"
      ) values (
        v_area, v_montado.p_listas, v_montado.p_dicionarios, v_montado.p_linhas,
        v_montado.p_total, v_versao, v_inicio,
        (extract(epoch from clock_timestamp() - v_inicio) * 1000)::integer
      )
      on conflict ("CO_AREA") do update set
        "DS_LISTAS" = excluded."DS_LISTAS",
        "DS_DICIONARIOS" = excluded."DS_DICIONARIOS",
        "DS_LINHAS" = excluded."DS_LINHAS",
        "QT_CANDIDATOS" = excluded."QT_CANDIDATOS",
        "DS_VERSAO_DADOS" = excluded."DS_VERSAO_DADOS",
        "DT_GERACAO" = excluded."DT_GERACAO",
        "NU_DURACAO_MS" = excluded."NU_DURACAO_MS";

      v_resultado := v_resultado || jsonb_build_object(
        'area', v_area, 'ok', true, 'candidatos', v_montado.p_total,
        'ms', (extract(epoch from clock_timestamp() - v_inicio) * 1000)::integer);
    exception when others then
      -- Nunca derruba quem chamou: a RPC monta na hora.
      raise warning 'Pacote da lista de aprovados (%) não foi remontado: % (%)', v_area, sqlerrm, sqlstate;
      v_resultado := v_resultado || jsonb_build_object('area', v_area, 'ok', false, 'erro', sqlerrm);
    end;
  end loop;

  return v_resultado;
end;
$function$;
CREATE OR REPLACE FUNCTION public.atualizar_cache_aprovados_vencidos()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text;
  v_cache record;
  v_resultado jsonb := '[]'::jsonb;
begin
  for v_area in select a."CO_AREA" from public."TB_AREA" a order by a."CO_AREA" loop
    select c."DS_VERSAO_DADOS", c."DT_GERACAO" into v_cache
      from private."TA_CANDIDATO_APROVADO_AREA" c
     where c."CO_AREA" = v_area;
    if not found
       or v_cache."DS_VERSAO_DADOS" is distinct from private."FC_VERSAO_APROVADOS_AREA"(v_area)
       or v_cache."DT_GERACAO" < now() - interval '6 hours' then
      v_resultado := v_resultado || public.atualizar_cache_aprovados(v_area);
    end if;
  end loop;
  return v_resultado;
end;
$function$;
CREATE OR REPLACE FUNCTION public.atualizar_cache_painel_analises(p_area text DEFAULT NULL::text, p_escopos text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_area text;
  v_escopos text[] := coalesce(p_escopos, array['ativo', 'inativo', 'desativadas']);
  v_inicio timestamptz;
  v_versao text;
  v_parte record;
  v_ms integer;
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

      for v_parte in
        select * from private."FC_MONTAR_PAINEL_ANALISE"(v_area, v_escopos, false)
      loop
        v_ms := (extract(epoch from clock_timestamp() - v_inicio) * 1000)::integer;
        insert into private."TA_PAINEL_ANALISE" as c (
          "CO_AREA", "TP_ESCOPO", "DS_LINHAS", "DS_EDITAIS", "QT_LINHAS",
          "DS_VERSAO_DADOS", "DT_GERACAO", "NU_DURACAO_MS", "DT_ULTIMA_ATUALIZACAO"
        ) values (
          v_area, v_parte."TP_ESCOPO", v_parte."DS_LINHAS", v_parte."DS_EDITAIS",
          v_parte."QT_LINHAS", v_versao, v_inicio, v_ms, v_parte."DT_ULTIMA_ATUALIZACAO"
        )
        on conflict ("CO_AREA", "TP_ESCOPO") do update set
          "DS_LINHAS" = excluded."DS_LINHAS",
          "DS_EDITAIS" = excluded."DS_EDITAIS",
          "QT_LINHAS" = excluded."QT_LINHAS",
          "DS_VERSAO_DADOS" = excluded."DS_VERSAO_DADOS",
          "DT_GERACAO" = excluded."DT_GERACAO",
          "NU_DURACAO_MS" = excluded."NU_DURACAO_MS",
          "DT_ULTIMA_ATUALIZACAO" = excluded."DT_ULTIMA_ATUALIZACAO";

        v_resultado := v_resultado || jsonb_build_object(
          'area', v_area, 'escopo', v_parte."TP_ESCOPO", 'ok', true,
          'linhas', v_parte."QT_LINHAS", 'ms', v_ms);
      end loop;
    exception when others then
      -- Nunca derruba quem chamou (agendamento, RPC): o guardado vencido é
      -- remontado depois, ou o painel monta na hora.
      raise warning 'Cache do painel de análises (%) não foi remontado: % (%)', v_area, sqlerrm, sqlstate;
      v_resultado := v_resultado || jsonb_build_object(
        'area', v_area, 'escopos', to_jsonb(v_escopos), 'ok', false, 'erro', sqlerrm);
    end;
  end loop;

  return v_resultado;
end;
$function$;
CREATE OR REPLACE FUNCTION public.atualizar_cache_painel_analises_vencidos()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_area text;
  v_versao text;
  v_vencida boolean;
  v_resultado jsonb := '[]'::jsonb;
begin
  for v_area in select a."CO_AREA" from public."TB_AREA" a order by a."CO_AREA" loop
    v_versao := private."FC_VERSAO_DADOS_ANALISE"(v_area);
    -- Vencida: falta um dos três escopos, a versão dos dados mudou (sync novo)
    -- ou o guardado tem mais de 6 h (correção manual no banco, fora do sync).
    select count(*) < 3
        or bool_or(c."DS_VERSAO_DADOS" is distinct from v_versao)
        or min(c."DT_GERACAO") < now() - interval '6 hours'
      into v_vencida
      from private."TA_PAINEL_ANALISE" c
     where c."CO_AREA" = v_area
       and c."TP_ESCOPO" in ('ativo', 'inativo', 'desativadas');
    if coalesce(v_vencida, true) then
      v_resultado := v_resultado || public.atualizar_cache_painel_analises(v_area);
    end if;
  end loop;
  return v_resultado;
end;
$function$;
CREATE OR REPLACE FUNCTION public.atualizar_cache_painel_entrevistas(p_area text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text;
  v_versao text;
  v_inicio timestamptz;
  v_payload json;
  v_feitas jsonb := '[]'::jsonb;
begin
  for v_area in
    select a."CO_AREA" from public."TB_AREA" a
     where p_area is null or a."CO_AREA" = p_area
     order by a."CO_AREA"
  loop
    v_versao := private."FC_VERSAO_ENTREVISTAS"(v_area);
    if exists (select 1 from private."TA_PAINEL_ENTREVISTA" c
                where c."CO_AREA" = v_area and c."DS_VERSAO_DADOS" = v_versao) then
      continue;
    end if;
    v_inicio := clock_timestamp();
    v_payload := private."FC_MONTAR_ENTREVISTAS_AREA"(v_area, null);
    insert into private."TA_PAINEL_ENTREVISTA" as c
      ("CO_AREA", "DS_PAYLOAD", "QT_ENTREVISTA", "DS_VERSAO_DADOS", "DT_GERACAO", "NU_DURACAO_MS")
    values (v_area, v_payload, json_array_length(v_payload->'entrevistas'), v_versao, now(),
            (extract(epoch from clock_timestamp() - v_inicio) * 1000)::integer)
    on conflict ("CO_AREA") do update set
      "DS_PAYLOAD" = excluded."DS_PAYLOAD", "QT_ENTREVISTA" = excluded."QT_ENTREVISTA",
      "DS_VERSAO_DADOS" = excluded."DS_VERSAO_DADOS", "DT_GERACAO" = excluded."DT_GERACAO",
      "NU_DURACAO_MS" = excluded."NU_DURACAO_MS";
    v_feitas := v_feitas || to_jsonb(v_area);
  end loop;
  return jsonb_build_object('remontadas', v_feitas);
end;
$function$;
CREATE OR REPLACE FUNCTION public.listar_candidatos_aprovados_compacto(p_area text DEFAULT NULL::text, p_versao text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET work_mem TO '64MB'
 SET jit TO 'off'
AS $function$
declare
  v_listas json;
  v_linhas json;
  v_area text;
  v_visiveis uuid[];
  v_versao text;
  v_cache private."TA_CANDIDATO_APROVADO_AREA";
  v_tem_cache boolean := false;
  v_dicionarios json;
  v_total integer;
  v_gerado_em timestamptz := now();
begin
  if not (private.pode_recurso('aprovados',1)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if private.papel_recurso('aprovados') = '' then
    raise exception 'Perfil sem acesso ao sistema';
  end if;

  -- Sem área: a resposta de antes (formato 1), para o front publicado até o deploy.
  if p_area is null then
    -- Dados da lista vão uma vez por lista (≈110), não repetidos em cada candidato.
    select coalesce(json_object_agg(l.id, json_build_array(
             l.edital_id, m.edital, m.unidade, l.ativo, l.arquivo_nome, l.importado_em
           )), '{}'::json)
      into v_listas
    from public."TB_LISTA_APROVADO" l
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
    where l.vigente is true
      and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
        and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]));

    select coalesce(json_agg(
             case when c.alterado_judicialmente then json_build_array(
               c.id, l.id, c.cargo, c.classificacao, c.nota, c.nome, c.modalidade,
               c.status, c.processo_sei, c.matricula, c.sub_judice, c.codigo_vaga,
               true, c.nota_original, c.modalidade_original, c.classificacao_original
             ) else json_build_array(
               c.id, l.id, c.cargo, c.classificacao, c.nota, c.nome, c.modalidade,
               c.status, c.processo_sei, c.matricula, c.sub_judice, c.codigo_vaga
             ) end
           order by m.edital, c.cargo, c.classificacao nulls last, c.nome), '[]'::json)
      into v_linhas
    from public."TB_LISTA_APROVADO" l
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
    join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id
    where l.vigente is true
      and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
        and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
      and c.removido_em is null;

    return json_build_object(
      'colunas_da_lista', json_build_array(
        'edital_id', 'edital', 'unidade', 'lista_ativa', 'arquivo_nome', 'importado_em'
      ),
      'listas', v_listas,
      'colunas', json_build_array(
        'candidato_id', 'lista_id', 'cargo', 'classificacao', 'nota', 'nome',
        'modalidade', 'status', 'processo_sei', 'matricula', 'sub_judice',
        'codigo_vaga', 'alterado_judicialmente', 'nota_original',
        'modalidade_original', 'classificacao_original'
      ),
      'linhas', v_linhas,
      'total', json_array_length(v_linhas)
    );
  end if;

  -- Área válida e do usuário: 22023/42501 antes de qualquer leitura.
  v_area := lower(btrim(p_area));
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
    raise exception 'Área inválida: %', p_area using errcode = '22023';
  end if;
  if not (v_area = any ((select private."FC_AREAS_USUARIO"())::text[])) then
    raise exception 'Sem permissão para a lista de aprovados desta área' using errcode = '42501';
  end if;

  -- Recorte por coordenação: entra na versão (mudou o recorte, a cópia não vale).
  v_visiveis := private."FC_EDITAIS_VISIVEIS"();
  v_versao := private."FC_VERSAO_APROVADOS_AREA"(v_area)
    || case when v_visiveis is null then ''
            else ':' || md5(array(select x from unnest(v_visiveis) x order by x)::text) end;

  if p_versao is not null and p_versao = v_versao then
    return json_build_object('formato', 2, 'area', v_area, 'versao', v_versao, 'inalterado', true);
  end if;

  if v_visiveis is null then
    select * into v_cache from private."TA_CANDIDATO_APROVADO_AREA" c where c."CO_AREA" = v_area;
    v_tem_cache := found and v_cache."DS_VERSAO_DADOS" = v_versao;
    if not v_tem_cache
       and pg_try_advisory_xact_lock(hashtext('aprovados_area:' || v_area)::bigint) then
      -- Venceu: remonta e grava. Falhou a gravação (transação só de leitura,
      -- trava), monta na hora abaixo.
      perform public.atualizar_cache_aprovados(v_area);
      select * into v_cache from private."TA_CANDIDATO_APROVADO_AREA" c where c."CO_AREA" = v_area;
      v_tem_cache := found and v_cache."DS_VERSAO_DADOS" = v_versao;
    end if;
  end if;

  if v_tem_cache then
    v_listas := v_cache."DS_LISTAS";
    v_dicionarios := v_cache."DS_DICIONARIOS";
    v_linhas := v_cache."DS_LINHAS";
    v_total := v_cache."QT_CANDIDATOS";
    v_gerado_em := v_cache."DT_GERACAO";
  else
    -- Com recorte, ou pronto ainda sem a versão de agora: montada na hora.
    select m.p_listas, m.p_dicionarios, m.p_linhas, m.p_total
      into v_listas, v_dicionarios, v_linhas, v_total
      from private."FC_MONTAR_APROVADOS_AREA"(v_area, v_visiveis) m;
  end if;

  return json_build_object(
    'formato', 2,
    'area', v_area,
    'versao', v_versao,
    'inalterado', false,
    'cache', json_build_object('hit', v_tem_cache, 'gerado_em', v_gerado_em),
    'colunas_da_lista', json_build_array(
      'lista_id', 'edital_id', 'edital', 'unidade', 'lista_ativa', 'arquivo_nome', 'importado_em'
    ),
    'listas', v_listas,
    'colunas', json_build_array(
      'candidato_id', 'lista_id', 'cargo', 'classificacao', 'nota', 'nome',
      'modalidade', 'status', 'processo_sei', 'matricula', 'sub_judice',
      'codigo_vaga', 'alterado_judicialmente', 'nota_original',
      'modalidade_original', 'classificacao_original'
    ),
    'dicionarios', v_dicionarios,
    'linhas', v_linhas,
    'total', v_total
  );
end;
$function$;
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
  v_grupo text;
  v_columns json := json_build_array(
    'id', 'unidade', 'edital', 'codigo_vaga', 'nome_vaga', 'candidato',
    'categoria', 'modalidade_concorrencia', 'status_consolidado', 'etapa',
    'responsavel_analise', 'data_analise', 'nota_final_ajustada',
    'pdf_status', 'tem_pdf'
  );
  v_cache private."TA_PAINEL_ANALISE";
  v_versao text;
  v_tem_cache boolean := false;
  v_hit boolean := false;
  v_rows json;
  v_editais json;
  v_total integer;
  v_atualizado_em timestamptz;
  v_gerado_em timestamptz := now();
begin
  if not (private.pode_recurso('analises')) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;

  -- "Todos" é montado no navegador com os três escopos.
  if v_scope not in ('ativo', 'inativo', 'desativadas') then
    raise exception 'Escopo invalido. Use ativo, inativo ou desativadas.';
  end if;

  -- Área válida e do usuário (ou admin): 22023/42501 antes de qualquer leitura.
  perform private."FC_GRUPOS_ANALISES_DA_AREA"(v_area);
  select a."NO_AREA", a."NO_GRUPO_PLANILHA" into v_area_nome, v_grupo
    from public."TB_AREA" a where a."CO_AREA" = v_area;
  v_versao := private."FC_VERSAO_DADOS_ANALISE"(v_area);

  -- Quem tem recorte por coordenação não usa o pronto (que é da área inteira).
  if private."FC_EDITAIS_VISIVEIS"() is null then
    select * into v_cache
      from private."TA_PAINEL_ANALISE" c
     where c."CO_AREA" = v_area and c."TP_ESCOPO" = v_scope;
    v_tem_cache := found;

    if v_tem_cache and v_cache."DT_GERACAO" > now() - interval '24 hours' then
      -- Sempre entrega o guardado, mesmo de antes do último sync: quem remonta
      -- é o agendamento (a cada 2 min, só a área que mudou).
      v_hit := v_cache."DS_VERSAO_DADOS" = v_versao;
    elsif pg_try_advisory_xact_lock(hashtext('painel_analise:' || v_area || ':' || v_scope)::bigint) then
      -- Sem guardado (ou agendamento parado há um dia): remonta só este
      -- escopo e grava. Se a gravação falhar, monta na hora, abaixo.
      perform public.atualizar_cache_painel_analises(v_area, array[v_scope]);
      select * into v_cache
        from private."TA_PAINEL_ANALISE" c
       where c."CO_AREA" = v_area and c."TP_ESCOPO" = v_scope;
      v_tem_cache := found
        and v_cache."DS_VERSAO_DADOS" = v_versao
        and v_cache."DT_GERACAO" > now() - interval '1 hour';
      v_hit := v_tem_cache;
    else
      -- Outra abertura já está remontando: o guardado anterior serve por ora.
      v_hit := false;
    end if;
  end if;

  if v_tem_cache then
    v_rows := v_cache."DS_LINHAS";
    v_editais := v_cache."DS_EDITAIS";
    v_total := v_cache."QT_LINHAS";
    v_atualizado_em := v_cache."DT_ULTIMA_ATUALIZACAO";
    v_gerado_em := v_cache."DT_GERACAO";
  else
    select m."DS_LINHAS", m."DS_EDITAIS", m."QT_LINHAS", m."DT_ULTIMA_ATUALIZACAO"
      into v_rows, v_editais, v_total, v_atualizado_em
      from private."FC_MONTAR_PAINEL_ANALISE"(v_area, array[v_scope], true) m;
  end if;

  return json_build_object(
    'schema_version', 4,
    'scope', v_scope,
    'area', v_area,
    'area_nome', v_area_nome,
    'grupo', v_grupo,
    'edital_status', case when v_scope = 'inativo' then 'Inativo' else 'Ativo' end,
    'columns', v_columns,
    'rows', v_rows,
    'editais', v_editais,
    'total', v_total,
    'textos_sob_demanda', true,
    'detalhe_sob_demanda', true,
    'versao_dados', v_versao,
    'atualizado_em', v_atualizado_em,
    'generated_at', v_gerado_em,
    'cache', json_build_object('hit', v_hit, 'refreshed_at', v_gerado_em)
  );
end;
$function$;
CREATE OR REPLACE FUNCTION public.obter_marcos_da_area(p_area text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if not private."FC_PODE_AREA"(p_area) then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  return (
    select json_build_object(
      'area', p_area,
      'ano', extract(year from now() at time zone 'America/Sao_Paulo')::integer,
      'concluidas_no_ano', count(*) filter (where v.data_analise >= date_trunc('year', now() at time zone 'America/Sao_Paulo')::date),
      'concluidas_total', count(*),
      'gerado_em', now())
      from public."VW_ANALISES_DASHBOARD_BASE_TODOS" v
      join public."TB_ANALISE_CURRICULAR" a on a.id = v.id
     where a."CO_AREA" = p_area
       and (v.edital_ativo is false or v.ativo is true)
       and v.status_consolidado in ('Aprovado', 'Reprovado')
  );
end;
$function$;
CREATE OR REPLACE FUNCTION public.finalizar_sync_analises_incremental(p_sync_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
 SET statement_timeout TO '30s'
 SET lock_timeout TO '2s'
 SET work_mem TO '8MB'
 SET jit TO 'off'
AS $function$
declare
  v_cursor integer:=0;
  v_max integer:=0;
  v_total_staging integer:=0;
  v_esperado integer:=0;
  v_total_fato integer:=0;
  v_total_editais integer:=0;
  v_editais_upsert integer:=0;
  v_editais_inativados integer:=0;
  v_removido integer:=0;
  v_total_ativos_local integer:=0;
  v_result jsonb;
  v_planilha text;
  v_conflitos integer:=0;
  v_duplicadas integer:=0;
  v_ausentes jsonb;
begin
  if p_sync_id is null then raise exception 'p_sync_id obrigatorio'; end if;
  -- [por-planilha]
  v_planilha := public."FC_PLANILHA_DO_SYNC_ANALISE"(p_sync_id);
  if v_planilha is null then raise exception 'Sync incremental nao esta pronto para finalizacao.'; end if;
  if not pg_try_advisory_xact_lock(hashtext('public.processar_sync_analises:'||v_planilha)::bigint) then
    raise exception 'Outro processamento de analises esta em andamento.';
  end if;

  select coalesce(nullif(resultado->>'lote_cursor','')::integer,0),
         coalesce(linhas_staging,0),
         coalesce(nullif(resultado->>'incremental_total_ativos_local','')::integer,0)
    into v_cursor,v_esperado,v_total_ativos_local
  from public."TL_SYNC_ANALISE"
  where sync_id=p_sync_id and modo='INCREMENTAL_ACTIVE' and status in ('carregado','processando')
    and coalesce((resultado->>'incremental_preparado')::boolean,false)=true
  order by id desc limit 1;
  if not found then raise exception 'Sync incremental nao esta pronto para finalizacao.'; end if;

  select coalesce(max(linha_origem) filter(where entidade='FATO_ANALISES'),0),
         count(*)::integer,
         count(*) filter(where entidade='FATO_ANALISES')::integer,
         count(*) filter(where entidade='DIM_EDITAIS')::integer
    into v_max,v_total_staging,v_total_fato,v_total_editais
  from public."TM_ANALISE_CURRICULAR"
  where sync_id=p_sync_id;

  if v_total_staging <> v_esperado then raise exception 'Staging incremental divergente: esperado %, encontrado %.',v_esperado,v_total_staging; end if;
  if v_cursor < v_max then raise exception 'Ainda existem linhas FATO incrementais pendentes: cursor %, max %.',v_cursor,v_max; end if;
  if v_total_editais < 1 then raise exception 'DIM_EDITAIS ausente no incremental.'; end if;

  -- [por-planilha] porteiro antes de gravar editais.
  perform public."FC_VALIDAR_GRUPO_STAGING_ANALISE"(p_sync_id, v_planilha);

  create temporary table tmp_editais_incremental on commit drop as
  with x as (
    select s.id,s.linha_origem,
      public.jsonb_text_or_null(s.payload,'grupo') as grupo,
      coalesce(public.jsonb_text_or_null(s.payload,'unidade'),'Nao informada') as unidade,
      coalesce(public.jsonb_text_or_null(s.payload,'edital'),'Sem edital') as edital,
      coalesce(public.jsonb_bool_or_null(s.payload,'ativo'),true) as ativo,
      public.jsonb_date_or_null(s.payload,'data_inicio_analise') as data_inicio_analise,
      public.jsonb_date_or_null(s.payload,'data_fim_analise') as data_fim_analise
    from public."TM_ANALISE_CURRICULAR" s
    where s.sync_id=p_sync_id and s.entidade='DIM_EDITAIS'
  ), ranked as (
    select *,row_number() over(partition by coalesce(public.analises_norm_key(grupo),''),coalesce(public.analises_norm_key(unidade),''),coalesce(public.analises_norm_key(edital),'') order by coalesce(linha_origem,2147483647),id) rn
    from x
  )
  select grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise
  from ranked where rn=1;

  -- [por-planilha] edital já cadastrado por outra planilha: recusa.
  select count(*)::integer into v_conflitos
  from public."TB_EDITAL_ANALISE" e
  join tmp_editais_incremental x
    on e.grupo_norm=coalesce(public.analises_norm_key(x.grupo),'')
   and e.unidade_norm=coalesce(public.analises_norm_key(x.unidade),'')
   and e.edital_norm=coalesce(public.analises_norm_key(x.edital),'')
  where e."CO_PLANILHA"<>v_planilha;
  if v_conflitos>0 then
    raise exception 'Sync % recusado: % edital(is) do envio ja pertencem a outra planilha.',p_sync_id,v_conflitos
      using errcode = '22023';
  end if;

  insert into public."TB_EDITAL_ANALISE"(grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise,"CO_PLANILHA")
  select grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise,v_planilha
  from tmp_editais_incremental
  -- Pela chave normalizada (uq_analises_editais_norm): "DSEI  Parintins" e
  -- "DSEI Parintins" são o mesmo edital; o texto passa a ser o da planilha.
  on conflict(grupo_norm,unidade_norm,edital_norm) do update set
    grupo=excluded.grupo,
    unidade=excluded.unidade,
    edital=excluded.edital,
    ativo=excluded.ativo,
    data_inicio_analise=excluded.data_inicio_analise,
    data_fim_analise=excluded.data_fim_analise,
    updated_at=now()
  where "TB_EDITAL_ANALISE"."CO_PLANILHA"=excluded."CO_PLANILHA";
  get diagnostics v_editais_upsert=row_count;

  -- [por-planilha] só desativa editais desta planilha.
  update public."TB_EDITAL_ANALISE" e
  set ativo=false,updated_at=now()
  where e.ativo is true
    and e."CO_PLANILHA"=v_planilha
    and not exists(select 1 from tmp_editais_incremental x
      where e.grupo_norm=coalesce(public.analises_norm_key(x.grupo),'')
        and e.unidade_norm=coalesce(public.analises_norm_key(x.unidade),'')
        and e.edital_norm=coalesce(public.analises_norm_key(x.edital),''));
  get diagnostics v_editais_inativados=row_count;

  -- [por-planilha] Mesmo candidato (id_origem) duas vezes na mesma vaga e edital:
  -- fica ativo só o registro mais recente. O incremental só envia o que mudou;
  -- quando o nome é corrigido na planilha, a chave natural muda, entra um
  -- registro novo e o antigo ficava ativo como "Pendente" (14 casos em 30/09).
  with r as (
    select a.id,
           row_number() over (partition by a.edital_norm, a.codigo_vaga, a.id_origem
                              order by a.updated_at desc, a.id desc) as rn
      from public."TB_ANALISE_CURRICULAR" a
     where a.ativo
       and a."CO_PLANILHA" = v_planilha
       and nullif(btrim(a.id_origem), '') is not null
       and nullif(btrim(a.codigo_vaga), '') is not null
  )
  update public."TB_ANALISE_CURRICULAR" a
     set ativo = false, updated_at = now()
    from r
   where a.id = r.id and r.rn > 1;
  get diagnostics v_duplicadas=row_count;

  -- Quem saiu da planilha (manifesto da comparação): ver 20261001140000.
  v_ausentes := public."FC_DESATIVAR_AUSENTES_DA_PLANILHA"(p_sync_id, v_planilha, v_total_ativos_local);
  delete from public."TM_MANIFESTO_ANALISE" where "CO_SYNC" = p_sync_id or "DT_CRIACAO" < now() - interval '2 days';

  delete from public."TM_ANALISE_CURRICULAR" where sync_id=p_sync_id;
  get diagnostics v_removido=row_count;

  v_result=jsonb_build_object(
    'ok',true,
    'sync_id',p_sync_id,
    'modo_processamento','incremental',
    'planilha',v_planilha,
    'total_ativos_local',v_total_ativos_local,
    'fato_analises_enviadas',v_total_fato,
    'analises_editais_recebidos',v_total_editais,
    'analises_editais_upsert',v_editais_upsert,
    'analises_editais_inativados',v_editais_inativados,
    'staging',v_total_staging,
    'staging_removido',v_removido,
    'historico_inativado',coalesce((v_ausentes->>'desativadas')::integer,0),
    'ausentes',v_ausentes,
    'analises_duplicadas_inativadas',v_duplicadas
  );

  update public."TL_SYNC_ANALISE"
  set status='processado',resultado=v_result,erro=null,total_processados=v_total_fato,
      finished_at=now(),updated_at=now()
  where sync_id=p_sync_id and modo='INCREMENTAL_ACTIVE';

  return v_result;
end;
$function$;

drop function if exists private."FC_CACHE_DESATUALIZADO"(text, text);
drop function if exists private."FC_MARCAR_CACHE"(text[], text[], text);
drop table if exists private."TL_ALTERACAO_CACHE";

alter table private."TA_PAINEL_ANALISE" drop column if exists "DS_CONCLUIDAS_POR_ANO";
alter table private."TA_CANDIDATO_APROVADO_AREA" set logged;
alter table private."TA_PAINEL_ANALISE" set logged;
alter table private."TA_PAINEL_ENTREVISTA" set logged;
alter table public."TM_ANALISE_CURRICULAR" set logged;
alter table public."TM_MANIFESTO_ANALISE" set logged;

-- Comentários de antes
comment on function private."FC_VERSAO_DADOS_ANALISE"(text) is 'Resumo dos syncs terminados das planilhas da área: muda sempre que um sync da área termina (bem ou mal).';
comment on function private."FC_VERSAO_APROVADOS_AREA"(text) is 'Assinatura dos dados da lista de aprovados da área (contagens e hash do xmin de listas e candidatos das listas vigentes, edital/unidade do monitoramento). Muda no mesmo commit de qualquer insert/update/delete.';
comment on function private."FC_VERSAO_ENTREVISTAS"(text) is 'Versão dos dados da aba Entrevistas de uma área (muda quando entrevistas ou o sync das análises mudam).';
comment on function private."FC_MONTAR_PAINEL_ANALISE"(text, text[], boolean) is 'Linhas (lista enxuta) e editais do painel de análises da área, por escopo (ativo, inativo, desativadas), numa passada. NÃO checa permissão: só para funções que já checaram. p_so_visiveis aplica o recorte por coordenação do usuário.';
comment on function public.atualizar_cache_aprovados(text) is 'Remonta o pacote pronto da lista de aprovados de uma área ou de todas. Erro numa área vira aviso e ok=false; só lança para área inexistente. Só service_role/postgres.';
comment on function public.atualizar_cache_aprovados_vencidos() is 'Remonta só as áreas cujo pacote da lista de aprovados venceu (dados mudaram ou mais de 6 h). pg_cron a cada 2 min; barata quando nada mudou.';
comment on function public.atualizar_cache_painel_analises(text, text[]) is 'Remonta o cache do painel de análises (escopos ativo, inativo e desativadas, ou os pedidos) de uma área ou de todas, numa passada por área. Erro numa área vira aviso e ok=false; só lança para área inexistente. Só service_role/postgres (pg_cron).';
comment on function public.atualizar_cache_painel_analises_vencidos() is 'Remonta só as áreas cujo pacote do painel de análises venceu (sync novo, escopo faltando ou mais de 6 h). Chamada pelo pg_cron a cada 2 min; barata quando nada mudou.';
comment on function public.atualizar_cache_painel_entrevistas(text) is 'Remonta o pacote pronto da aba Entrevistas das áreas cuja versão mudou (todas, ou só p_area). pg_cron a cada 2 min; barata quando nada mudou.';
comment on function public.obter_marcos_da_area(text) is 'Análises concluídas (Aprovado/Reprovado, ativas) da área no ano corrente e no total, para a faixa de marcos da equipe. Exige a área do usuário.';
comment on column private."TA_PAINEL_ANALISE"."DS_VERSAO_DADOS" is 'FC_VERSAO_DADOS_ANALISE lida antes da montagem; diferente da atual, o cache não vale.';
comment on column private."TA_CANDIDATO_APROVADO_AREA"."DS_VERSAO_DADOS" is 'FC_VERSAO_APROVADOS_AREA lida antes da montagem; diferente da atual, o pacote não vale.';
comment on column private."TA_PAINEL_ENTREVISTA"."DS_VERSAO_DADOS" is 'Versão dos dados usada (FC_VERSAO_ENTREVISTAS).';

notify pgrst, 'reload schema';

commit;
