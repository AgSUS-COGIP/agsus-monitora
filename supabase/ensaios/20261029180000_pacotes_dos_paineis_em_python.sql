-- ENSAIO de supabase/migrations/20261029180000_pacotes_dos_paineis_em_python.sql: roda o corpo e desfaz (rollback).
-- Esperado (todas as chaves true; "recusas" = 15; ms/mb = medidas): as RPCs do job são só do service_role e
-- as do pg_cron de ninguém; o workflow fica na chave "Pacotes dos painéis"; numa área de mentira (com acento,
-- caixa, nulos, editais repetidos, treinamento e "Fora do lote"), a leitura traz as marcas e as fontes, e
-- "dourado" traz as fontes e o que o SQL monta na mesma foto — o pytest (tests/python/test_pacotes_dos_paineis.py,
-- tests/fixtures/paineis/dourado.json) confere que o Python monta igual; a gravação recusa 15 formas de lixo
-- (22023) sem gravar nada, grava os três pacotes com DT_GERACAO = lido_em, apaga só as marcas lidas (a marca
-- nova fica e a área continua pendente) e nunca troca um pacote mais novo; a rodada do pg_cron não repete um
-- pedido de 1 min atrás nem monta, vai para a reserva com marca de 31 min, pede o job e — sem a chave do GitHub
-- (simulada: nada sai do banco) — fica SEM_TOKEN e monta na reserva, e depois de um pedido sem sucesso vai
-- direto para a reserva. Medidas: ler as fontes e gravar o pacote das análises da Saúde Indígena (o maior).
-- O resultado (json) traz só verdadeiro/falso, números e o dourado (dados de mentira).
begin;

-- ═══ CORPO DA MIGRATION (início) ═══

set local lock_timeout = '5s';

do $$
begin
  if to_regprocedure('private."FC_DISPARAR_ROBO"(text, jsonb, uuid, text)') is null
     or to_regprocedure('private."FC_CHAVE_DO_WORKFLOW"(text)') is null
     or to_regprocedure('private."PR_REMONTAR_CACHE_AGENDADO"(text)') is null
     or to_regprocedure('public.atualizar_cache_painel_entrevistas(text)') is null
     or to_regprocedure('private."FC_MONTAR_APROVADOS_AREA"(text, uuid[])') is null then
    raise exception 'Aplique antes 20261022190000 e 20261024120000.';
  end if;
  -- FC_DISPARAR_ROBO, FC_CHAVE_DO_WORKFLOW e PR_REMONTAR_CACHE_AGENDADO abaixo partem dos que estão
  -- no banco (20261024120000): se outra migration os mudou depois, junte as mudanças antes de aplicar.
  if md5((select prosrc from pg_proc where oid = 'private."FC_DISPARAR_ROBO"(text, jsonb, uuid, text)'::regprocedure))
       <> '0ad818a351250566951441d865f0b7bf'
     or md5((select prosrc from pg_proc where oid = 'private."FC_CHAVE_DO_WORKFLOW"(text)'::regprocedure))
       <> '4b47a70019d24ebf26956ca7e317d6bc'
     or md5((select prosrc from pg_proc where oid = 'private."PR_REMONTAR_CACHE_AGENDADO"(text)'::regprocedure))
       <> '74c661361822ac64a82218afca6b4f15' then
    raise exception 'FC_DISPARAR_ROBO, FC_CHAVE_DO_WORKFLOW ou PR_REMONTAR_CACHE_AGENDADO mudou depois de 20261024120000: junte as mudanças.';
  end if;
end;
$$;

-- 1. O que está desatualizado -----------------------------------------------------------------
create or replace function private."FC_PAINEIS_VENCIDOS"(p_cache text)
returns table ("CO_AREA" text, "TP_MOTIVO" text, "DT_DESDE" timestamptz)
language sql
stable
security definer
set search_path to ''
as $function$
  -- O critério das rodadas de sempre (atualizar_cache_*_vencidos): marca, sem pacote (na
  -- análise, sem um dos três escopos) ou pacote de mais de 24 h. DT_DESDE: a marca mais antiga,
  -- ou a geração do pacote mais velho.
  with pacote as (
    select a."CO_AREA",
           case p_cache
             when 'ANALISES' then (select case when count(*) < 3 then null else min(c."DT_GERACAO") end
                                     from private."TA_PAINEL_ANALISE" c
                                    where c."CO_AREA" = a."CO_AREA"
                                      and c."TP_ESCOPO" in ('ativo', 'inativo', 'desativadas'))
             when 'APROVADOS' then (select c."DT_GERACAO" from private."TA_CANDIDATO_APROVADO_AREA" c
                                     where c."CO_AREA" = a."CO_AREA")
             when 'ENTREVISTAS' then (select c."DT_GERACAO" from private."TA_PAINEL_ENTREVISTA" c
                                       where c."CO_AREA" = a."CO_AREA")
           end as gerado_em,
           (select min(t."DT_ALTERACAO") from private."TL_ALTERACAO_CACHE" t
             where t."TP_CACHE" = p_cache and t."CO_AREA" = a."CO_AREA") as marca_desde
      from public."TB_AREA" a
     where p_cache in ('ANALISES', 'APROVADOS', 'ENTREVISTAS')
  )
  select p."CO_AREA",
         case when p.gerado_em is null then 'SEM_PACOTE'
              when p.marca_desde is not null then 'MARCA'
              else 'VELHO' end,
         case when p.gerado_em is null then null
              when p.marca_desde is not null then p.marca_desde
              else p.gerado_em end
    from pacote p
   where p.gerado_em is null
      or p.marca_desde is not null
      or p.gerado_em < now() - interval '24 hours'
   order by p."CO_AREA";
$function$;

comment on function private."FC_PAINEIS_VENCIDOS"(text) is
  'Áreas com o pacote do painel desatualizado (ANALISES, APROVADOS ou ENTREVISTAS): SEM_PACOTE, MARCA (TL_ALTERACAO_CACHE; DT_DESDE = a mais antiga) ou VELHO (mais de 24 h; DT_DESDE = a geração). O critério das rodadas atualizar_cache_*_vencidos. 20261029180000.';
revoke all on function private."FC_PAINEIS_VENCIDOS"(text) from public, anon, authenticated, service_role;

create or replace function public.paineis_ler_pendentes()
returns json
language sql
stable
security definer
set search_path to ''
as $function$
  select json_build_object(
    'schema_version', 1,
    'pendentes', coalesce((
      select json_agg(json_build_object('cache', c.cache, 'area', v."CO_AREA", 'motivo', v."TP_MOTIVO")
                      order by c.ordem, v."CO_AREA")
        from (values ('ANALISES', 1), ('APROVADOS', 2), ('ENTREVISTAS', 3)) c(cache, ordem)
       cross join lateral private."FC_PAINEIS_VENCIDOS"(c.cache) v), '[]'::json));
$function$;

comment on function public.paineis_ler_pendentes() is
  'Job "Pacotes dos painéis" (Python, só service_role): os pacotes desatualizados, { schema_version, pendentes: [{ cache, area, motivo }] }. 20261029180000.';
revoke all on function public.paineis_ler_pendentes() from public, anon, authenticated;
grant execute on function public.paineis_ler_pendentes() to service_role;

-- 2. As fontes de uma área, sem montar --------------------------------------------------------
create or replace function public.paineis_ler_fontes(p_cache text, p_area text)
returns json
language plpgsql
stable
security definer
set search_path to ''
set work_mem to '64MB'
set jit to 'off'
as $function$
declare
  v_cache text := upper(btrim(coalesce(p_cache, '')));
  v_area text := lower(btrim(coalesce(p_area, '')));
  v_lido_em timestamptz := clock_timestamp();
  v_marcas bigint[];
  v_grupo text;
  v_grupo_norm text;
begin
  if v_cache not in ('ANALISES', 'APROVADOS', 'ENTREVISTAS') then
    raise exception 'Pacote desconhecido: %', left(p_cache, 30) using errcode = '22023';
  end if;
  select a."NO_GRUPO_PLANILHA", public.analises_norm_key(a."NO_GRUPO_PLANILHA")
    into v_grupo, v_grupo_norm
    from public."TB_AREA" a where a."CO_AREA" = v_area;
  if not found then
    raise exception 'Área inválida: %', left(p_area, 40) using errcode = '22023';
  end if;

  -- As marcas ANTES das fontes: uma mudança confirmada entre as duas leituras aparece nas fontes
  -- e deixa a marca dela, que a gravação não apaga (a área volta na próxima rodada).
  select coalesce(array_agg(t."CO_ALTERACAO_CACHE" order by t."CO_ALTERACAO_CACHE"), '{}')
    into v_marcas
    from private."TL_ALTERACAO_CACHE" t
   where t."TP_CACHE" = v_cache and t."CO_AREA" = v_area;

  if v_cache = 'ANALISES' then
    -- As fontes de FC_MONTAR_PAINEL_ANALISE (sem recorte) e da VW_ANALISES_DASHBOARD_BASE_TODOS.
    return (
      with an as (
        select a.id, a.unidade, a.edital, a.codigo_vaga, a.nome_vaga, a.candidato, a.categoria,
               a.modalidade_concorrencia, a.status_consolidado, a.etapa, a.responsavel_analise,
               a.data_analise, a.nota_final_ajustada, a.pdf_status,
               nullif(btrim(a.link_pdf), '') is not null as tem_pdf,
               a.ativo, coalesce(a.updated_at, a.ultima_atualizacao) as atualizado_em,
               a.unidade_norm, a.edital_norm
          from public."TB_ANALISE_CURRICULAR" a
         where a.grupo_norm = v_grupo_norm
           and not private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)
           and a.status_consolidado is distinct from 'Fora do lote'
      ), ep as (
        select e.id, e.grupo, e.unidade, e.edital, e.ativo, e.data_inicio_analise, e.data_fim_analise,
               e.unidade_norm, e.edital_norm
          from public."TB_EDITAL_ANALISE" e
         where e.grupo_norm = v_grupo_norm
      ), em as (
        select m.id, m.unidade, m.edital, j.inicio, j.fim
          from public."TB_ORIGEM_ANALISE_EDITAL" o
          join public."TB_MONITORAMENTO_INDIGENA" m on m.id = o."CO_MONITORAMENTO"
         cross join lateral private."FC_JANELA_AVALIACAO_DOCUMENTAL"(m.id) j
         where o."TP_ORIGEM" = 'MONITORA'
           and m."CO_AREA" = v_area
           and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
      )
      select json_build_object(
        'schema_version', 1, 'cache', v_cache, 'area', v_area, 'lido_em', v_lido_em,
        'marcas', to_json(v_marcas), 'grupo', v_grupo,
        'analises', (select coalesce(json_agg(json_build_array(
            an.id, an.unidade, an.edital, an.codigo_vaga, an.nome_vaga, an.candidato, an.categoria,
            an.modalidade_concorrencia, an.status_consolidado, an.etapa, an.responsavel_analise,
            an.data_analise, an.nota_final_ajustada, an.pdf_status, an.tem_pdf, an.ativo,
            an.atualizado_em, an.unidade_norm, an.edital_norm)), '[]'::json) from an),
        'editais_planilha', (select coalesce(json_agg(json_build_array(
            ep.id, ep.grupo, ep.unidade, ep.edital, ep.ativo, ep.data_inicio_analise,
            ep.data_fim_analise, ep.unidade_norm, ep.edital_norm)), '[]'::json) from ep),
        'editais_monitora', (select coalesce(json_agg(json_build_array(
            em.id, em.unidade, em.edital, em.inicio, em.fim)), '[]'::json) from em),
        'vocabulario', (select coalesce(json_agg(x.v order by x.v), '[]'::json)
                          from (select an.unidade as v from an union select an.edital from an
                                union select an.codigo_vaga from an union select an.candidato from an
                                union select ep.unidade from ep union select ep.edital from ep
                                union select em.unidade from em union select em.edital from em) x
                         where x.v is not null)));
  elsif v_cache = 'APROVADOS' then
    -- As fontes de FC_MONTAR_APROVADOS_AREA (sem recorte).
    return (
      with li as (
        select l.id, l.edital_id, m.edital, m.unidade, l.ativo, l.arquivo_nome, l.importado_em
          from public."TB_LISTA_APROVADO" l
          join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
         where l.vigente is true
           and m."CO_AREA" = v_area
           and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
      ), ca as (
        select c.id, c.lista_id, c.cargo, c.classificacao, c.nota, c.nome, c.modalidade, c.status,
               c.processo_sei, c.matricula, c.sub_judice, c.codigo_vaga, c.alterado_judicialmente,
               c.nota_original, c.modalidade_original, c.classificacao_original
          from li join public."TB_CANDIDATO_APROVADO" c on c.lista_id = li.id
         where c.removido_em is null
      )
      select json_build_object(
        'schema_version', 1, 'cache', v_cache, 'area', v_area, 'lido_em', v_lido_em,
        'marcas', to_json(v_marcas),
        'listas', (select coalesce(json_agg(json_build_array(
            li.id, li.edital_id, li.edital, li.unidade, li.ativo, li.arquivo_nome, li.importado_em)),
            '[]'::json) from li),
        'candidatos', (select coalesce(json_agg(json_build_array(
            ca.id, ca.lista_id, ca.cargo, ca.classificacao, ca.nota, ca.nome, ca.modalidade, ca.status,
            ca.processo_sei, ca.matricula, ca.sub_judice, ca.codigo_vaga, ca.alterado_judicialmente,
            ca.nota_original, ca.modalidade_original, ca.classificacao_original)), '[]'::json) from ca),
        'contratacao', (select coalesce(json_agg(json_build_array(
            x."CO_CANDIDATO_APROVADO", x."TP_SITUACAO", x."DS_MOTIVO")), '[]'::json)
                          from public."TB_CONTRATACAO_APROVADO" x
                          join ca on ca.id = x."CO_CANDIDATO_APROVADO"
                         where ca.status = 'Contratado'),
        'vocabulario', (select coalesce(json_agg(x.v order by x.v), '[]'::json)
                          from (select li.edital as v from li union select ca.cargo from ca
                                union select ca.nome from ca union select ca.modalidade from ca
                                union select ca.status from ca union select ca.codigo_vaga from ca) x
                         where x.v is not null)));
  end if;

  -- ENTREVISTAS: as fontes de FC_MONTAR_ENTREVISTAS_AREA (sem recorte). As entrevistas ativas da
  -- área vão todas: a vigente de cada pessoa (FC_ENTREVISTAS_VIGENTES) é escolhida no Python.
  return (
    with en as (
      select e."CO_ENTREVISTA", e."CO_MONITORAMENTO", e."CO_ANALISE_CURRICULAR", e."TP_LIGACAO_ANALISE",
             e."NO_UNIDADE", e."DS_EDITAL", e."CO_VAGA", e."NO_CARGO", e."NO_CANDIDATO", e."CO_CANDIDATO",
             e."DS_MODALIDADE", e."VL_NOTA_TOTAL", e."TP_PARECER", e."ST_COMPARECEU", e."TP_ORIGEM",
             e."DT_ATUALIZACAO", e."DS_LINK_PLANILHA"
        from public."TB_ENTREVISTA" e
       where e."CO_AREA" = v_area and e."ST_ATIVO" = 'S'
    ), mo as (
      select m.id, m.edital, m.unidade, m.ativo, private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO") as treinamento
        from public."TB_MONITORAMENTO_INDIGENA" m
       where m.id in (select en."CO_MONITORAMENTO" from en)
    ), anl as (
      select a.id, a.nome_vaga, a.modalidade_concorrencia, a.nota_final_ajustada, a.status_consolidado,
             a.etapa, a.responsavel_analise, a.ativo
        from public."TB_ANALISE_CURRICULAR" a
       where a.id in (select en."CO_ANALISE_CURRICULAR" from en)
    ), sem as (
      select a.id, a.candidato, a.id_origem, a.codigo_vaga, a.nome_vaga, a.edital, a.unidade,
             a.nota_final_ajustada, a.modalidade_concorrencia
        from public."TB_ANALISE_CURRICULAR" a
       where a."CO_AREA" = v_area and a.ativo
         and not private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)
         and a.status_consolidado = 'Aprovado'
         and a.codigo_vaga in (select en."CO_VAGA" from en)
         and not exists (select 1 from public."TB_ENTREVISTA" x
                          where x."CO_ANALISE_CURRICULAR" = a.id and x."ST_ATIVO" = 'S')
    ), nt as (
      select n."CO_ENTREVISTA", n."NU_ORDEM", n."DS_CRITERIO", n."VL_NOTA"
        from public."TB_ENTREVISTA_NOTA" n
       where n."CO_ENTREVISTA" in (select en."CO_ENTREVISTA" from en) and n."VL_NOTA" is not null
    )
    select json_build_object(
      'schema_version', 1, 'cache', v_cache, 'area', v_area, 'lido_em', v_lido_em,
      'marcas', to_json(v_marcas),
      'ultima_carga', (
        select json_build_object('em', s."DT_FIM", 'linhas', s."QT_LINHA",
                                 'ligadas_analise', s."QT_LIGADA_ANALISE",
                                 'sem_analise', s."QT_SEM_ANALISE", 'sem_edital', s."QT_SEM_EDITAL")
          from public."TL_SYNC_ENTREVISTA" s
         where s."CO_AREA" = v_area and s."TP_SITUACAO" = 'CONCLUIDA'
         order by s."DT_FIM" desc limit 1),
      'entrevistas', (select coalesce(json_agg(json_build_array(
          en."CO_ENTREVISTA", en."CO_MONITORAMENTO", en."CO_ANALISE_CURRICULAR", en."TP_LIGACAO_ANALISE",
          en."NO_UNIDADE", en."DS_EDITAL", en."CO_VAGA", en."NO_CARGO", en."NO_CANDIDATO", en."CO_CANDIDATO",
          en."DS_MODALIDADE", en."VL_NOTA_TOTAL", en."TP_PARECER", en."ST_COMPARECEU", en."TP_ORIGEM",
          en."DT_ATUALIZACAO", en."DS_LINK_PLANILHA")), '[]'::json) from en),
      'notas', (select coalesce(json_agg(json_build_array(
          nt."CO_ENTREVISTA", nt."NU_ORDEM", nt."DS_CRITERIO", nt."VL_NOTA")), '[]'::json) from nt),
      'monitoramentos', (select coalesce(json_agg(json_build_array(
          mo.id, mo.edital, mo.unidade, mo.ativo, mo.treinamento)), '[]'::json) from mo),
      'analises', (select coalesce(json_agg(json_build_array(
          anl.id, anl.nome_vaga, anl.modalidade_concorrencia, anl.nota_final_ajustada, anl.status_consolidado,
          anl.etapa, anl.responsavel_analise, anl.ativo)), '[]'::json) from anl),
      'sem_entrevista', (select coalesce(json_agg(json_build_array(
          sem.id, sem.candidato, sem.id_origem, sem.codigo_vaga, sem.nome_vaga, sem.edital, sem.unidade,
          sem.nota_final_ajustada, sem.modalidade_concorrencia)), '[]'::json) from sem),
      'vocabulario', (select coalesce(json_agg(x.v order by x.v), '[]'::json)
                        from (select en."DS_EDITAL" as v from en union select en."CO_VAGA" from en
                              union select en."NO_CANDIDATO" from en union select mo.edital from mo
                              union select nt."DS_CRITERIO" from nt union select sem.edital from sem
                              union select sem.codigo_vaga from sem union select sem.candidato from sem) x
                       where x.v is not null)));
end;
$function$;

comment on function public.paineis_ler_fontes(text, text) is
  'Job "Pacotes dos painéis" (Python, só service_role): as fontes de um pacote (ANALISES, APROVADOS ou ENTREVISTAS) de uma área, em listas cruas, sem montar; marcas (TL_ALTERACAO_CACHE) lidas antes das fontes; lido_em; vocabulario = os textos que ordenam, na ordem da colação do banco. 20261029180000.';
revoke all on function public.paineis_ler_fontes(text, text) from public, anon, authenticated;
grant execute on function public.paineis_ler_fontes(text, text) to service_role;

-- 3. Gravar o pacote que o job montou (só valida e guarda) --------------------------------------
create or replace function private."FC_LINHAS_VALIDAS"(p_linhas json, p_tamanhos integer[])
returns boolean
language sql
immutable
set search_path to ''
as $function$
  -- Toda linha é uma lista com um dos tamanhos e começa por um uuid.
  select json_typeof(p_linhas) = 'array'
     and not exists (
       select 1 from json_array_elements(p_linhas) l
        where json_typeof(l) <> 'array'
           or not (json_array_length(l) = any (p_tamanhos))
           or coalesce(l ->> 0, '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
$function$;
revoke all on function private."FC_LINHAS_VALIDAS"(json, integer[]) from public, anon, authenticated, service_role;

create or replace function public.paineis_gravar_pacote(
  p_cache text, p_area text, p_lido_em timestamptz, p_marcas bigint[], p_pacote json, p_execucao text)
returns jsonb
language plpgsql
security definer
set search_path to ''
set lock_timeout to '5s'
as $function$
declare
  v_cache text := upper(btrim(coalesce(p_cache, '')));
  v_area text := lower(btrim(coalesce(p_area, '')));
  v_versao text := (extract(epoch from p_lido_em) * 1000000)::bigint::text;
  v_ms integer := greatest(0, (extract(epoch from clock_timestamp() - p_lido_em) * 1000)::integer);
  v_escopo text;
  v_parte json;
  v_gravou integer := 0;
  v_marcas integer;
begin
  if v_cache not in ('ANALISES', 'APROVADOS', 'ENTREVISTAS') then
    raise exception 'Pacote desconhecido: %', left(p_cache, 30) using errcode = '22023';
  end if;
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
    raise exception 'Área inválida: %', left(p_area, 40) using errcode = '22023';
  end if;
  -- A leitura é a de agora há pouco: nem do futuro, nem de mais de 1 h (o job leva minutos).
  if p_lido_em is null or p_lido_em > clock_timestamp() + interval '1 minute'
     or p_lido_em < clock_timestamp() - interval '1 hour' then
    raise exception 'Leitura fora do prazo (lido_em).' using errcode = '22023';
  end if;
  if p_marcas is null or array_position(p_marcas, null) is not null then
    raise exception 'Marcas inválidas.' using errcode = '22023';
  end if;
  if coalesce(p_execucao, '') !~ '^[A-Za-z0-9_.:-]{1,80}$' then
    raise exception 'Execução inválida.' using errcode = '22023';
  end if;
  if p_pacote is null or json_typeof(p_pacote) <> 'object' then
    raise exception 'Pacote inválido.' using errcode = '22023';
  end if;

  -- Um gravador por pacote e área de cada vez (o job e a reserva no banco).
  perform pg_advisory_xact_lock(hashtext('paineis_gravar:' || v_cache || ':' || v_area)::bigint);

  if v_cache = 'ANALISES' then
    -- Os três escopos, cada um com as colunas de get_analises_dashboard_payload_v2 (15).
    foreach v_escopo in array array['ativo', 'inativo', 'desativadas'] loop
      v_parte := p_pacote -> v_escopo;
      if v_parte is null or json_typeof(v_parte) <> 'object'
         or not private."FC_LINHAS_VALIDAS"(v_parte -> 'linhas', array[15])
         or coalesce(json_typeof(v_parte -> 'editais'), '') <> 'array'
         or coalesce(json_typeof(v_parte -> 'concluidas_por_ano'), '') <> 'object'
         or coalesce(json_typeof(v_parte -> 'atualizado_em'), 'null') not in ('string', 'null') then
        raise exception 'Pacote das análises inválido no escopo %.', v_escopo using errcode = '22023';
      end if;
    end loop;
    foreach v_escopo in array array['ativo', 'inativo', 'desativadas'] loop
      v_parte := p_pacote -> v_escopo;
      insert into private."TA_PAINEL_ANALISE" as c (
        "CO_AREA", "TP_ESCOPO", "DS_LINHAS", "DS_EDITAIS", "QT_LINHAS", "DS_VERSAO_DADOS",
        "DT_GERACAO", "NU_DURACAO_MS", "DT_ULTIMA_ATUALIZACAO", "DS_CONCLUIDAS_POR_ANO")
      values (
        v_area, v_escopo, v_parte -> 'linhas', v_parte -> 'editais', json_array_length(v_parte -> 'linhas'),
        v_versao, p_lido_em, v_ms, (v_parte ->> 'atualizado_em')::timestamptz, v_parte -> 'concluidas_por_ano')
      on conflict ("CO_AREA", "TP_ESCOPO") do update set
        "DS_LINHAS" = excluded."DS_LINHAS",
        "DS_EDITAIS" = excluded."DS_EDITAIS",
        "QT_LINHAS" = excluded."QT_LINHAS",
        "DS_VERSAO_DADOS" = excluded."DS_VERSAO_DADOS",
        "DT_GERACAO" = excluded."DT_GERACAO",
        "NU_DURACAO_MS" = excluded."NU_DURACAO_MS",
        "DT_ULTIMA_ATUALIZACAO" = excluded."DT_ULTIMA_ATUALIZACAO",
        "DS_CONCLUIDAS_POR_ANO" = excluded."DS_CONCLUIDAS_POR_ANO"
      -- Nunca troca um pacote mais novo (a reserva no banco remontou depois desta leitura).
      where c."DT_GERACAO" < excluded."DT_GERACAO";
      if found then
        v_gravou := v_gravou + 1;
      end if;
    end loop;
  elsif v_cache = 'APROVADOS' then
    -- Linhas de 12 colunas (16 quando alterada judicialmente), listas de 7.
    if not private."FC_LINHAS_VALIDAS"(p_pacote -> 'linhas', array[12, 16])
       or not private."FC_LINHAS_VALIDAS"(p_pacote -> 'listas', array[7])
       or coalesce(json_typeof(p_pacote -> 'dicionarios'), '') <> 'object'
       or exists (select 1 from unnest(array['cargo', 'modalidade', 'status', 'codigo_vaga']) k
                   where coalesce(json_typeof(p_pacote -> 'dicionarios' -> k), '') <> 'array')
       or coalesce(json_typeof(p_pacote -> 'dicionarios' -> 'contratacao'), '') <> 'object' then
      raise exception 'Pacote da Lista de aprovados inválido.' using errcode = '22023';
    end if;
    insert into private."TA_CANDIDATO_APROVADO_AREA" as c (
      "CO_AREA", "DS_LISTAS", "DS_DICIONARIOS", "DS_LINHAS", "QT_CANDIDATOS",
      "DS_VERSAO_DADOS", "DT_GERACAO", "NU_DURACAO_MS")
    values (
      v_area, p_pacote -> 'listas', p_pacote -> 'dicionarios', p_pacote -> 'linhas',
      json_array_length(p_pacote -> 'linhas'), v_versao, p_lido_em, v_ms)
    on conflict ("CO_AREA") do update set
      "DS_LISTAS" = excluded."DS_LISTAS",
      "DS_DICIONARIOS" = excluded."DS_DICIONARIOS",
      "DS_LINHAS" = excluded."DS_LINHAS",
      "QT_CANDIDATOS" = excluded."QT_CANDIDATOS",
      "DS_VERSAO_DADOS" = excluded."DS_VERSAO_DADOS",
      "DT_GERACAO" = excluded."DT_GERACAO",
      "NU_DURACAO_MS" = excluded."NU_DURACAO_MS"
    where c."DT_GERACAO" < excluded."DT_GERACAO";
    if found then
      v_gravou := 1;
    end if;
  else
    -- O payload de FC_MONTAR_ENTREVISTAS_AREA (schema_version 1), da mesma área.
    if (p_pacote ->> 'schema_version') is distinct from '1'
       or (p_pacote ->> 'area') is distinct from v_area
       or coalesce(json_typeof(p_pacote -> 'gerado_em'), '') <> 'string'
       or coalesce(json_typeof(p_pacote -> 'criterios'), '') <> 'array'
       or not private."FC_LINHAS_VALIDAS"(
            coalesce((select json_agg(json_build_array(e ->> 'id')) from json_array_elements(p_pacote -> 'entrevistas') e
                       where json_typeof(e) = 'object'), '[]'::json), array[1])
       or coalesce(json_typeof(p_pacote -> 'aprovados_sem_entrevista'), '') <> 'array'
       or json_array_length(p_pacote -> 'aprovados_sem_entrevista') > 3000
       or coalesce(json_typeof(p_pacote -> 'ultima_carga'), 'null') not in ('object', 'null') then
      raise exception 'Pacote das entrevistas inválido.' using errcode = '22023';
    end if;
    insert into private."TA_PAINEL_ENTREVISTA" as c
      ("CO_AREA", "DS_PAYLOAD", "QT_ENTREVISTA", "DS_VERSAO_DADOS", "DT_GERACAO", "NU_DURACAO_MS")
    values (v_area, p_pacote, json_array_length(p_pacote -> 'entrevistas'), v_versao, p_lido_em, v_ms)
    on conflict ("CO_AREA") do update set
      "DS_PAYLOAD" = excluded."DS_PAYLOAD", "QT_ENTREVISTA" = excluded."QT_ENTREVISTA",
      "DS_VERSAO_DADOS" = excluded."DS_VERSAO_DADOS", "DT_GERACAO" = excluded."DT_GERACAO",
      "NU_DURACAO_MS" = excluded."NU_DURACAO_MS"
    where c."DT_GERACAO" < excluded."DT_GERACAO";
    if found then
      v_gravou := 1;
    end if;
  end if;

  -- Só as marcas que a leitura viu: as mudanças delas estão no pacote (este ou o mais novo).
  delete from private."TL_ALTERACAO_CACHE" t
   where t."TP_CACHE" = v_cache and t."CO_AREA" = v_area
     and t."CO_ALTERACAO_CACHE" = any (p_marcas);
  get diagnostics v_marcas = row_count;

  return jsonb_build_object('ok', true, 'cache', v_cache, 'area', v_area, 'gravados', v_gravou,
                            'marcas_apagadas', v_marcas, 'ms', v_ms);
end;
$function$;

comment on function public.paineis_gravar_pacote(text, text, timestamptz, bigint[], json, text) is
  'Job "Pacotes dos painéis" (Python, só service_role): só valida o formato e grava o pacote montado (TA_PAINEL_ANALISE, TA_CANDIDATO_APROVADO_AREA ou TA_PAINEL_ENTREVISTA), com DT_GERACAO = lido_em; nunca troca um pacote mais novo; apaga só as marcas que a leitura viu. 20261029180000.';
revoke all on function public.paineis_gravar_pacote(text, text, timestamptz, bigint[], json, text) from public, anon, authenticated;
grant execute on function public.paineis_gravar_pacote(text, text, timestamptz, bigint[], json, text) to service_role;

-- 4. O workflow na lista fixa e na chave "Pacotes dos painéis" ----------------------------------
alter table public."TL_DISPARO_ROBO" drop constraint "CK_DISPROBO_NOWORKFLOW";
alter table public."TL_DISPARO_ROBO" add constraint "CK_DISPROBO_NOWORKFLOW" check ("NO_WORKFLOW" = any (array[
  'sincronizar-entrevistas.yml', 'sincronizar-selecao.yml', 'conferencias.yml', 'expurgo-anexos-chat.yml',
  'robo-empregare.yml', 'pre-classificacao.yml', 'leitura-de-arquivos.yml', 'classificacao.yml',
  'contratacao-dos-aprovados.yml', 'pacotes-dos-paineis.yml']));
comment on constraint "CK_DISPROBO_NOWORKFLOW" on public."TL_DISPARO_ROBO" is
  'Workflows que o banco pede (lista fixa de FC_DISPARAR_ROBO) ou registra; pacotes-dos-paineis.yml desde 20261029180000.';

CREATE OR REPLACE FUNCTION private."FC_DISPARAR_ROBO"(p_workflow text, p_inputs jsonb DEFAULT '{}'::jsonb, p_usuario uuid DEFAULT NULL::uuid, p_origem text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  -- Lista fixa: workflow → inputs que ele aceita (além de disparado_por).
  c_aceitos constant jsonb := jsonb_build_object(
    'sincronizar-entrevistas.yml', jsonb_build_array('modo'),
    'sincronizar-selecao.yml', jsonb_build_array('modo'),
    'conferencias.yml', jsonb_build_array('modo'),
    'robo-empregare.yml', jsonb_build_array('modo', 'editais', 'vagas', 'limite', 'anexos', 'candidatos', 'seco', 'forcar_congelado'),
    'pre-classificacao.yml', jsonb_build_array('modo', 'editais', 'forcar_congelado'),
    'classificacao.yml', jsonb_build_array('modo', 'listas'),
    'contratacao-dos-aprovados.yml', jsonb_build_array('modo'),
    -- Pacotes dos painéis (20261029180000): pedido pela rodada do pg_cron dos pacotes.
    'pacotes-dos-paineis.yml', jsonb_build_array('modo'));
  v_inputs jsonb := coalesce(p_inputs, '{}'::jsonb);
  -- AGENDA só do pg_cron: as tarefas passam p_origem = 'AGENDA' (e a sessão do pg_cron
  -- se chama pg_cron); MONITORA com o usuário da tela; MANUAL = SQL direto, sem usuário.
  v_origem constant text := case
    when p_usuario is not null then 'MONITORA'
    when p_origem = 'AGENDA' or current_setting('application_name', true) = 'pg_cron' then 'AGENDA'
    else 'MANUAL' end;
  v_disparado_por constant text := case v_origem
    when 'MONITORA' then p_usuario::text
    when 'AGENDA' then 'AGENDA'
    else 'manual' end;
  v_chave text;
  v_pedido bigint;
  v_disparo bigint;
begin
  if p_workflow is null or not (c_aceitos ? p_workflow) then
    raise exception 'Workflow fora da lista fixa dos robôs' using errcode = '22023';
  end if;
  if p_origem is not null and p_origem <> 'AGENDA' then
    raise exception 'Origem inválida (só AGENDA, nas tarefas do pg_cron)' using errcode = '22023';
  end if;
  if jsonb_typeof(v_inputs) <> 'object'
     or exists (
       select 1 from jsonb_each(v_inputs) i
        where not ((c_aceitos -> p_workflow) ? i.key)
           or jsonb_typeof(i.value) <> 'string'
           or length(i.value #>> '{}') > 20000) then
    raise exception 'Inputs inválidos para %', p_workflow using errcode = '22023';
  end if;

  -- [chaves-da-automacao] Chave desligada (20261022190000): a agenda não pede nada.
  -- O Rodar agora (MONITORA) e o SQL direto (MANUAL) seguem.
  if v_origem = 'AGENDA'
     and not private."FC_AUTOMACAO_LIGADA"(private."FC_CHAVE_DO_WORKFLOW"(p_workflow)) then
    return null;
  end if;

  -- O nome do segredo é sempre github_disparo_robos; a configuração da sessão
  -- agsus.segredo_disparo_robos só existe para o ensaio simular a chave ausente
  -- (set local) sem tocar no Vault nem ler o valor.
  select nullif(btrim(s.decrypted_secret), '')
    into v_chave
    from vault.decrypted_secrets s
   where s.name = coalesce(nullif(current_setting('agsus.segredo_disparo_robos', true), ''), 'github_disparo_robos')
   order by s.updated_at desc nulls last
   limit 1;

  if v_chave is null then
    insert into public."TL_DISPARO_ROBO" ("NO_WORKFLOW", "TP_ORIGEM", "CO_USUARIO", "TP_SITUACAO", "DS_MENSAGEM")
    values (p_workflow, v_origem, p_usuario, 'SEM_TOKEN', 'Sem a chave github_disparo_robos no Vault.')
    returning "CO_DISPARO" into v_disparo;
    return v_disparo;
  end if;

  begin
    v_pedido := net.http_post(
      url := 'https://api.github.com/repos/AgSUS-COGIP/agsus-monitora/actions/workflows/' || p_workflow || '/dispatches',
      body := jsonb_build_object(
        'ref', 'main',
        'inputs', v_inputs || jsonb_build_object('disparado_por', v_disparado_por)),
      headers := jsonb_build_object(
        'Accept', 'application/vnd.github+json',
        'Authorization', 'Bearer ' || v_chave,
        'X-GitHub-Api-Version', '2022-11-28',
        'User-Agent', 'agsus-monitora-agenda',
        'Content-Type', 'application/json'),
      timeout_milliseconds := 10000);
  exception when others then
    -- Só o código do erro: a mensagem poderia citar o pedido.
    v_chave := null;
    insert into public."TL_DISPARO_ROBO" ("NO_WORKFLOW", "TP_ORIGEM", "CO_USUARIO", "TP_SITUACAO", "DT_RESPOSTA", "DS_MENSAGEM")
    values (p_workflow, v_origem, p_usuario, 'FALHOU', now(), 'O pg_net recusou o pedido (' || sqlstate || ').')
    returning "CO_DISPARO" into v_disparo;
    return v_disparo;
  end;
  v_chave := null;

  insert into public."TL_DISPARO_ROBO" ("NO_WORKFLOW", "TP_ORIGEM", "CO_USUARIO", "CO_PEDIDO_HTTP", "TP_SITUACAO")
  values (p_workflow, v_origem, p_usuario, v_pedido, 'PEDIDO')
  returning "CO_DISPARO" into v_disparo;
  return v_disparo;
end;
$function$;

create or replace function private."FC_CHAVE_DO_WORKFLOW"(p_workflow text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select case p_workflow
    when 'sincronizar-entrevistas.yml' then 'entrevistas'
    when 'sincronizar-selecao.yml' then 'selecao'
    when 'conferencias.yml' then 'conferencias'
    when 'robo-empregare.yml' then 'robo_de_inscricoes'
    when 'pre-classificacao.yml' then 'pre_classificacao'
    when 'classificacao.yml' then 'classificacao'
    when 'contratacao-dos-aprovados.yml' then 'conferencias'
    when 'pacotes-dos-paineis.yml' then 'paineis'
  end;
$function$;

-- 5. A rodada do pg_cron só pede o job (e monta no banco só na reserva) -------------------------
create or replace function private."FC_PAINEIS_RODADA"(p_cache text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  c_workflow constant text := 'pacotes-dos-paineis.yml';
  v_vencida record;
  v_ultimo_situacao text;
  v_ultimo_em timestamptz;
  v_reserva text[] := '{}';
  v_pedir boolean := false;
  v_disparo bigint;
  v_situacao text;
  v_area text;
  v_resposta jsonb := '[]'::jsonb;
begin
  if p_cache is null or p_cache not in ('ANALISES', 'APROVADOS', 'ENTREVISTAS') then
    raise exception 'Cache desconhecido: %', p_cache using errcode = '22023';
  end if;

  -- O último pedido do job nos últimos 30 min.
  select d."TP_SITUACAO", d."DT_DISPARO" into v_ultimo_situacao, v_ultimo_em
    from public."TL_DISPARO_ROBO" d
   where d."NO_WORKFLOW" = c_workflow and d."DT_DISPARO" > now() - interval '30 minutes'
   order by d."DT_DISPARO" desc, d."CO_DISPARO" desc limit 1;

  for v_vencida in select * from private."FC_PAINEIS_VENCIDOS"(p_cache) loop
    -- Reserva: sem pacote (a tela montaria a cada abertura), o job não deu conta em 30 min
    -- (marca) ou em 1 h (pacote de mais de 24 h), ou o último pedido não chegou ao GitHub.
    if v_vencida."TP_MOTIVO" = 'SEM_PACOTE'
       or (v_vencida."TP_MOTIVO" = 'MARCA' and v_vencida."DT_DESDE" < now() - interval '30 minutes')
       or (v_vencida."TP_MOTIVO" = 'VELHO' and v_vencida."DT_DESDE" < now() - interval '25 hours')
       or coalesce(v_ultimo_situacao, '') in ('FALHOU', 'SEM_TOKEN') then
      v_reserva := v_reserva || v_vencida."CO_AREA";
    else
      v_pedir := true;
    end if;
  end loop;

  -- Pede o job (ele monta tudo o que estiver desatualizado), sem repetir um pedido de 4 min atrás.
  if v_pedir and not (coalesce(v_ultimo_situacao, '') in ('PEDIDO', 'ACEITO')
                      and v_ultimo_em > now() - interval '4 minutes') then
    v_disparo := private."FC_DISPARAR_ROBO"(c_workflow, '{"modo": "normal"}'::jsonb, p_origem => 'AGENDA');
    select d."TP_SITUACAO" into v_situacao from public."TL_DISPARO_ROBO" d where d."CO_DISPARO" = v_disparo;
    -- Sem a chave do GitHub ou com o pg_net recusando: a reserva monta já.
    if v_situacao in ('FALHOU', 'SEM_TOKEN') then
      select coalesce(array_agg(v."CO_AREA"), '{}') into v_reserva from private."FC_PAINEIS_VENCIDOS"(p_cache) v;
    end if;
  end if;

  -- A reserva: as montagens de sempre, no banco, só para as áreas da reserva. Com a trava da
  -- gravação do job (paineis_gravar_pacote) até o commit: uma gravação do job não passa no meio
  -- e a montagem que começa depois dela sempre é a mais nova.
  foreach v_area in array v_reserva loop
    perform pg_advisory_xact_lock(hashtext('paineis_gravar:' || p_cache || ':' || v_area)::bigint);
    v_resposta := v_resposta || case p_cache
      when 'ANALISES' then public.atualizar_cache_painel_analises(v_area)
      when 'APROVADOS' then public.atualizar_cache_aprovados(v_area)
      else coalesce(public.atualizar_cache_painel_entrevistas(v_area) -> 'falhas', '[]'::jsonb)
    end;
  end loop;

  return jsonb_build_object('cache', p_cache, 'pediu', v_pedir, 'disparo', v_disparo,
                            'situacao_do_pedido', v_situacao, 'reserva', to_jsonb(v_reserva),
                            'falhas', private."FC_FALHAS_DO_CACHE"(case when p_cache = 'ENTREVISTAS'
                                                                      then jsonb_build_object('falhas', v_resposta)
                                                                      else v_resposta end));
end;
$function$;

comment on function private."FC_PAINEIS_RODADA"(text) is
  'Uma rodada dos pacotes dos painéis: pede o job Python pacotes-dos-paineis.yml quando há área desatualizada (sem repetir pedido de 4 min); monta no banco (atualizar_cache_*) só na reserva — sem pacote, marca de mais de 30 min, pacote de mais de 25 h ou último pedido FALHOU/SEM_TOKEN. Devolve { pediu, disparo, situacao_do_pedido, reserva, falhas }. 20261029180000.';
revoke all on function private."FC_PAINEIS_RODADA"(text) from public, anon, authenticated, service_role;

create or replace procedure private."PR_REMONTAR_CACHE_AGENDADO"(in p_cache text)
language plpgsql
as $procedure$
declare
  v_rodada jsonb;
begin
  perform pg_catalog.set_config('search_path', '', true);
  -- A mesma trava de antes: uma rodada de cada vez.
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtext(case p_cache
       when 'ANALISES' then 'agsus_analises_cache_do_painel'
       when 'APROVADOS' then 'agsus_aprovados_cache_por_area'
       when 'ENTREVISTAS' then 'agsus_entrevistas_cache_do_painel' end)) then
    return;
  end if;
  -- Pede o job Python (20261029180000); a montagem no banco ficou só como reserva.
  v_rodada := private."FC_PAINEIS_RODADA"(p_cache);
  -- O que deu certo fica gravado (e o pedido ao GitHub sai no commit); a falha vai para a
  -- execução do job (Status das atualizações).
  commit;
  if v_rodada ->> 'falhas' is not null then
    raise exception 'Pacote % não remontado: %', lower(p_cache), left(v_rodada ->> 'falhas', 400);
  end if;
end;
$procedure$;

comment on procedure private."PR_REMONTAR_CACHE_AGENDADO"(text) is
  'Rodada do pg_cron dos pacotes dos painéis: private."FC_PAINEIS_RODADA" (pede o job Python; monta no banco só na reserva) e commit. 20261029180000.';

-- ═══ CORPO DA MIGRATION (fim) ═══

-- ═══ CONFERÊNCIAS ═══
create temporary table t_r (k text primary key, v jsonb) on commit drop;
create temporary table t_ids (k text primary key, id uuid) on commit drop;

-- A. Só o service_role chama as RPCs do job; as do pg_cron, ninguém de fora.
insert into t_r
select 'permissoes_so_service_role', to_jsonb(
  bool_and(has_function_privilege('service_role', f, 'execute'))
  and not bool_or(has_function_privilege('authenticated', f, 'execute'))
  and not bool_or(has_function_privilege('anon', f, 'execute'))
  and not has_function_privilege('authenticated', 'private."FC_PAINEIS_RODADA"(text)', 'execute')
  and not has_function_privilege('service_role', 'private."FC_PAINEIS_RODADA"(text)', 'execute')
  and not has_function_privilege('authenticated', 'private."FC_PAINEIS_VENCIDOS"(text)', 'execute'))
  from unnest(array['public.paineis_ler_pendentes()', 'public.paineis_ler_fontes(text, text)',
                    'public.paineis_gravar_pacote(text, text, timestamptz, bigint[], json, text)']) f;

insert into t_r values ('workflow_na_chave_paineis',
  to_jsonb(private."FC_CHAVE_DO_WORKFLOW"('pacotes-dos-paineis.yml') = 'paineis'));

-- B. Uma área de mentira, com os casos que mudam a ordem e a escolha (nada disso fica: rollback).
insert into public."TB_AREA" ("CO_AREA", "NO_AREA", "NO_GRUPO_PLANILHA", "NU_ORDEM")
values ('ensaio-paineis', 'Ensaio dos painéis', 'Ensaio dos Painéis', 99);

do $$
declare
  v_autor constant uuid := 'a01afddb-f64b-47d9-80e8-476a1ed14e43';
  m1 uuid; m2 uuid; m3 uuid; m4 uuid; l1 uuid; l2 uuid; l3 uuid; a1 uuid; a2 uuid; a3 uuid;
  e1 uuid; e2 uuid;
begin
  insert into public."TB_MONITORAMENTO_INDIGENA" (edital, unidade, "CO_AREA", ativo, "ST_TREINAMENTO")
  values ('Edital 01/2099', 'DSEI Alfa', 'ensaio-paineis', true, 'N') returning id into m1;
  insert into public."TB_MONITORAMENTO_INDIGENA" (edital, unidade, "CO_AREA", ativo, "ST_TREINAMENTO")
  values ('02/2099', 'dsei beta', 'ensaio-paineis', true, 'N') returning id into m2;
  insert into public."TB_MONITORAMENTO_INDIGENA" (edital, unidade, "CO_AREA", ativo, "ST_TREINAMENTO")
  values ('Edital 04/2099', 'Ômega', 'ensaio-paineis', false, 'N') returning id into m3;
  insert into public."TB_MONITORAMENTO_INDIGENA" (edital, unidade, "CO_AREA", ativo, "ST_TREINAMENTO")
  values ('Edital 05/2099', 'Treino', 'ensaio-paineis', true, 'S') returning id into m4;
  insert into t_ids values ('m1', m1), ('m2', m2), ('m3', m3), ('m4', m4);

  -- Editais da planilha: 01/2099 em duas unidades (só casa a da mesma unidade), 03/2099 único (casa
  -- qualquer unidade), um inativo.
  insert into public."TB_EDITAL_ANALISE" (grupo, unidade, edital, ativo, data_inicio_analise, data_fim_analise, "CO_PLANILHA")
  values ('Ensaio dos Painéis', 'DSEI Alfa', 'Edital 01/2099', true, '2099-01-10', '2099-02-10', 'sede'),
         ('Ensaio dos Painéis', 'Ébano', 'Edital 01/2099', false, null, null, 'sede'),
         ('Ensaio dos Painéis', 'Polo Único', 'Edital 03/2099', false, '2099-03-01', null, 'sede'),
         ('Ensaio dos Painéis', 'abacate', 'edital 07/2099', true, null, null, 'sede');
  -- Avaliação no MONITORA: 02/2099 entra nos editais; 01/2099 não (a planilha já tem).
  insert into public."TB_ORIGEM_ANALISE_EDITAL" ("CO_MONITORAMENTO", "TP_ORIGEM") values (m1, 'MONITORA'), (m2, 'MONITORA');

  -- Análises: ordem com acento e caixa, nulos, escopos, treinamento e "Fora do lote" de fora.
  insert into public."TB_ANALISE_CURRICULAR"
    (grupo, unidade, edital, codigo_vaga, nome_vaga, candidato, categoria, modalidade_concorrencia,
     status_consolidado, etapa, responsavel_analise, data_analise, nota_final_ajustada, pdf_status, link_pdf,
     ativo, origem_planilha, chave_natural, "CO_PLANILHA")
  values
    ('Ensaio dos Painéis', 'DSEI Alfa', 'Edital 01/2099', '101', 'Enfermeiro', 'ana', 'Nível superior', 'Ampla',
     'Aprovado', 'Concluída', 'Fulano', '2099-01-15', 7.50, 'ok', 'https://exemplo/1', true, null, 'ensaio-1', 'sede'),
    ('Ensaio dos Painéis', 'DSEI Alfa', 'Edital 01/2099', '101', 'Enfermeiro', 'Ana', null, 'PPIQ',
     'Reprovado', null, null, '2098-12-31', 0, null, '  ', true, null, 'ensaio-2', 'sede'),
    ('Ensaio dos Painéis', 'DSEI Alfa', 'Edital 01/2099', '101', 'Enfermeiro', 'Álvaro', null, null,
     'Aprovado', null, null, null, 10.25, null, null, true, null, 'ensaio-3', 'sede'),
    ('Ensaio dos Painéis', 'dsei alfa', 'Edital 01/2099', null, null, 'beto', null, null,
     'Em análise', null, null, null, null, null, null, false, null, 'ensaio-4', 'sede'),
    ('Ensaio dos Painéis', 'Ébano', 'Edital 01/2099', '102', 'Médico', 'Zé', null, null,
     'Aprovado', null, null, '2099-02-01', 9, null, null, true, null, 'ensaio-5', 'sede'),
    ('Ensaio dos Painéis', 'Outra', 'Edital 03/2099', '103', null, 'Ítalo', null, null,
     'Reprovado', null, null, '2099-03-05', 1.5, null, null, false, null, 'ensaio-6', 'sede'),
    ('Ensaio dos Painéis', 'Sem edital', 'Edital 09/2099', '104', null, 'Carla', null, null,
     'Aprovado', null, null, '2099-04-01', 8, null, null, true, null, 'ensaio-7', 'sede'),
    ('Ensaio dos Painéis', 'DSEI Alfa', 'Edital 01/2099', '101', null, 'Fora', null, null,
     'Fora do lote', null, null, null, null, null, null, true, null, 'ensaio-8', 'sede'),
    ('Ensaio dos Painéis', 'DSEI Alfa', 'Edital 01/2099', '101', null, 'Treino', null, null,
     'Aprovado', null, null, null, null, null, null, true, 'treinamento', 'ensaio-9', 'sede'),
    ('Ensaio dos Painéis', 'abacate', 'edital 07/2099', 'V1', 'Agente', 'Bruna', null, 'Ampla',
     'Aprovado', null, null, '2099-05-01', 6, null, null, true, null, 'ensaio-10', 'sede'),
    ('Ensaio dos Painéis', 'abacate', 'edital 07/2099', 'V1', 'Agente', 'bruno', null, 'Ampla',
     'Aprovado', null, null, '2099-05-02', 5, null, null, true, null, 'ensaio-11', 'sede');
  -- Datas de atualização diferentes (a maior de cada escopo vai para atualizado_em).
  update public."TB_ANALISE_CURRICULAR" set ultima_atualizacao = '2099-06-01 12:00+00'
   where chave_natural in ('ensaio-3', 'ensaio-6');
  select id into a1 from public."TB_ANALISE_CURRICULAR" where chave_natural = 'ensaio-1';
  select id into a2 from public."TB_ANALISE_CURRICULAR" where chave_natural = 'ensaio-10';
  select id into a3 from public."TB_ANALISE_CURRICULAR" where chave_natural = 'ensaio-11';

  -- Lista de aprovados: duas vigentes, uma substituída e uma de treinamento (de fora).
  insert into public."TB_LISTA_APROVADO" (edital_id, ativo, vigente, arquivo_nome, arquivo_path, importado_por, "TP_ORIGEM")
  values (m1::text, true, true, 'lista-1.xlsx', 'ensaio/1', v_autor, 'XLSX') returning id into l1;
  insert into public."TB_LISTA_APROVADO" (edital_id, ativo, vigente, arquivo_nome, arquivo_path, importado_por, "TP_ORIGEM")
  values (m2::text, false, true, 'lista-2.xlsx', 'ensaio/2', v_autor, 'XLSX') returning id into l2;
  insert into public."TB_LISTA_APROVADO" (edital_id, ativo, vigente, arquivo_nome, arquivo_path, importado_por, "TP_ORIGEM")
  values (m1::text, true, false, 'velha.xlsx', 'ensaio/3', v_autor, 'XLSX'),
         (m4::text, true, true, 'treino.xlsx', 'ensaio/4', v_autor, 'XLSX');
  insert into public."TB_CANDIDATO_APROVADO"
    (lista_id, codigo_vaga, cargo, classificacao, nota, nome, modalidade, status, matricula, sub_judice,
     alterado_judicialmente, nota_original, modalidade_original, classificacao_original, created_by, updated_by)
  values
    (l1, '101', 'Enfermeiro', 2, 7.50, 'ana', 'Ampla', null, null, false, false, null, null, null, v_autor, v_autor),
    (l1, '101', 'Enfermeiro', 1, 9.00, 'Ana', 'PPIQ', 'Contratado', 'M-1', false, true, 8.00, 'Ampla', 3, v_autor, v_autor),
    (l1, '101', 'enfermeiro', null, 5, 'Álvaro', null, null, null, true, false, null, null, null, v_autor, v_autor),
    (l1, '102', 'Médico', 1, 10, 'Zé', 'Ampla', 'Desistente', null, false, false, null, null, null, v_autor, v_autor),
    (l2, '201', 'Agente', 1, 6.5, 'Bruna', 'Ampla', null, null, false, false, null, null, null, v_autor, v_autor);
  update public."TB_CANDIDATO_APROVADO" set removido_em = now()
   where lista_id = l1 and nome = 'Zé';
  insert into public."TB_CANDIDATO_APROVADO"
    (lista_id, codigo_vaga, cargo, classificacao, nota, nome, modalidade, created_by, updated_by)
  values (l1, '102', 'Médico', 2, 8, 'Úrsula', 'Ampla', v_autor, v_autor);

  -- Entrevistas: a vigente de cada pessoa (APTO ou INAPTO antes de sem parecer), edital
  -- inativo e de treinamento de fora, uma sem edital, notas com critérios.
  insert into public."TB_ENTREVISTA"
    ("CO_AREA", "CO_MONITORAMENTO", "CO_ANALISE_CURRICULAR", "TP_LIGACAO_ANALISE", "NO_UNIDADE", "DS_EDITAL",
     "CO_VAGA", "NO_CARGO", "NO_CANDIDATO", "CO_CANDIDATO", "DS_MODALIDADE", "VL_NOTA_TOTAL", "TP_PARECER",
     "ST_COMPARECEU", "TP_ORIGEM", "ST_ATIVO", "DS_CHAVE_ORIGEM", "DT_ATUALIZACAO")
  values
    ('ensaio-paineis', m1, a1, 'codigo', 'DSEI Alfa', 'Edital 01/2099', '101', 'Enf', 'ana', 'c1', 'Ampla', null,
     'SEM_PARECER', 'S', 'planilha', 'S', 'ensaio-e1', now() - interval '1 day'),
    ('ensaio-paineis', m1, a1, 'codigo', 'DSEI Alfa', 'Edital 01/2099', '101', 'Enf', 'ana', 'c1', 'Ampla', 8.5,
     'APTO', 'S', 'sistema', 'S', 'ensaio-e2', now() - interval '2 days'),
    ('ensaio-paineis', null, null, null, 'Polo', 'Edital 08/2099', 'V1', 'Agente', 'Bia', 'c2', null, 7,
     'INAPTO', 'S', 'planilha', 'S', 'ensaio-e3', now()),
    ('ensaio-paineis', null, null, null, 'Polo', 'Edital 08/2099', 'V1', 'Agente', 'Bia', 'c2', null, null,
     'SEM_PARECER', null, 'planilha', 'S', 'ensaio-e4', now() - interval '3 days'),
    ('ensaio-paineis', null, null, null, 'Polo', 'edital 08/2099', 'V1', 'Agente', 'Álvaro', 'c3', null, 9,
     'APTO', 'S', 'planilha', 'S', 'ensaio-e5', now() - interval '5 days'),
    ('ensaio-paineis', m3, null, null, 'Ômega', 'Edital 04/2099', 'V9', 'X', 'Inativo', 'c4', null, 5,
     'APTO', 'S', 'planilha', 'S', 'ensaio-e6', now()),
    ('ensaio-paineis', m4, null, null, 'Treino', 'Edital 05/2099', 'V9', 'X', 'Treino', 'c5', null, 5,
     'APTO', 'S', 'planilha', 'S', 'ensaio-e7', now()),
    ('ensaio-paineis', m2, null, null, 'dsei beta', '02/2099', 'V1', 'Agente', 'Desligada', 'c6', null, 5,
     'APTO', 'S', 'planilha', 'N', 'ensaio-e8', now());
  select "CO_ENTREVISTA" into e1 from public."TB_ENTREVISTA" where "DS_CHAVE_ORIGEM" = 'ensaio-e2';
  select "CO_ENTREVISTA" into e2 from public."TB_ENTREVISTA" where "DS_CHAVE_ORIGEM" = 'ensaio-e5';
  insert into public."TB_ENTREVISTA_NOTA" ("CO_ENTREVISTA", "NU_ORDEM", "DS_CRITERIO", "VL_NOTA")
  values (e1, 2, 'Ética', 4.5), (e1, 1, 'Comunicação', 4), (e2, 1, 'comunicação', 5), (e2, 3, 'Postura', null);
end;
$$;

-- C. O teste dourado: as fontes e o que o SQL monta, na mesma foto (funções STABLE).
insert into t_r
select 'dourado', jsonb_build_object(
  'ANALISES', jsonb_build_object('fontes', public.paineis_ler_fontes('ANALISES', 'ensaio-paineis')::jsonb,
     'sql', (select jsonb_object_agg(m."TP_ESCOPO", jsonb_build_object('linhas', m."DS_LINHAS", 'total', m."QT_LINHAS",
                     'editais', m."DS_EDITAIS", 'atualizado_em', m."DT_ULTIMA_ATUALIZACAO",
                     'concluidas_por_ano', m."DS_CONCLUIDAS_POR_ANO"))
               from private."FC_MONTAR_PAINEL_ANALISE"('ensaio-paineis', array['ativo', 'inativo', 'desativadas'], false) m)),
  'APROVADOS', jsonb_build_object('fontes', public.paineis_ler_fontes('APROVADOS', 'ensaio-paineis')::jsonb,
     'sql', (select jsonb_build_object('listas', m.p_listas, 'dicionarios', m.p_dicionarios, 'linhas', m.p_linhas,
                                       'total', m.p_total)
               from private."FC_MONTAR_APROVADOS_AREA"('ensaio-paineis', null) m)),
  'ENTREVISTAS', jsonb_build_object('fontes', public.paineis_ler_fontes('ENTREVISTAS', 'ensaio-paineis')::jsonb,
     'sql', private."FC_MONTAR_ENTREVISTAS_AREA"('ensaio-paineis', null)::jsonb));

-- D. Pendentes: a área nova sem pacote nos três; as marcas vêm na leitura.
insert into t_r
select 'pendentes_sem_pacote', to_jsonb(count(*) = 3)
  from json_array_elements(public.paineis_ler_pendentes() -> 'pendentes') p
 where p ->> 'area' = 'ensaio-paineis' and p ->> 'motivo' = 'SEM_PACOTE';
insert into t_r
select 'leitura_traz_as_marcas', to_jsonb(
  (select array_agg(x::bigint order by x::bigint)
     from json_array_elements_text(public.paineis_ler_fontes('aprovados', 'ENSAIO-PAINEIS') -> 'marcas') x)
  = (select array_agg(t."CO_ALTERACAO_CACHE" order by t."CO_ALTERACAO_CACHE") from private."TL_ALTERACAO_CACHE" t
      where t."TP_CACHE" = 'APROVADOS' and t."CO_AREA" = 'ensaio-paineis'));

-- E. A gravação recusa o que não é pacote (22023) e não grava nada.
do $$
declare
  v_ok json := (select jsonb_object_agg(m."TP_ESCOPO", jsonb_build_object('linhas', m."DS_LINHAS", 'editais', m."DS_EDITAIS",
                        'atualizado_em', m."DT_ULTIMA_ATUALIZACAO", 'concluidas_por_ano', m."DS_CONCLUIDAS_POR_ANO"))::json
                  from private."FC_MONTAR_PAINEL_ANALISE"('ensaio-paineis', array['ativo', 'inativo', 'desativadas'], false) m);
  v_ap json := (select json_build_object('listas', m.p_listas, 'dicionarios', m.p_dicionarios, 'linhas', m.p_linhas)
                  from private."FC_MONTAR_APROVADOS_AREA"('ensaio-paineis', null) m);
  v_en json := private."FC_MONTAR_ENTREVISTAS_AREA"('ensaio-paineis', null);
  v_casos text[][] := array[
    ['XYZ', 'ensaio-paineis', '0', 'ok'],
    ['ANALISES', 'nao-existe', '0', 'ok'],
    ['ANALISES', 'ensaio-paineis', 'futuro', 'ok'],
    ['ANALISES', 'ensaio-paineis', 'velho', 'ok'],
    ['ANALISES', 'ensaio-paineis', 'marca_nula', 'ok'],
    ['ANALISES', 'ensaio-paineis', 'execucao', 'ok'],
    ['ANALISES', 'ensaio-paineis', '0', 'lista'],
    ['ANALISES', 'ensaio-paineis', '0', 'sem_escopo'],
    ['ANALISES', 'ensaio-paineis', '0', 'linha_curta'],
    ['ANALISES', 'ensaio-paineis', '0', 'linha_sem_id'],
    ['APROVADOS', 'ensaio-paineis', '0', 'linha_curta'],
    ['APROVADOS', 'ensaio-paineis', '0', 'sem_contratacao'],
    ['ENTREVISTAS', 'ensaio-paineis', '0', 'outra_area'],
    ['ENTREVISTAS', 'ensaio-paineis', '0', 'versao'],
    ['ENTREVISTAS', 'ensaio-paineis', '0', 'sem_entrevista_demais']];
  v_i integer;
  v_pacote json;
  v_recusas integer := 0;
  v_outros integer := 0;
begin
  for v_i in 1 .. array_length(v_casos, 1) loop
    v_pacote := case v_casos[v_i][1] when 'APROVADOS' then v_ap when 'ENTREVISTAS' then v_en else v_ok end;
    v_pacote := case v_casos[v_i][4]
      when 'lista' then '[]'::json
      when 'sem_escopo' then (v_pacote::jsonb - 'inativo')::json
      when 'linha_curta' then case v_casos[v_i][1]
        when 'APROVADOS' then jsonb_set(v_pacote::jsonb, '{linhas}', '[["00000000-0000-0000-0000-000000000000",1,2,3,4,5,6,7,8,9,10,11,12]]')::json
        else jsonb_set(v_pacote::jsonb, '{ativo,linhas}', '[["00000000-0000-0000-0000-000000000000",1]]')::json end
      when 'linha_sem_id' then jsonb_set(v_pacote::jsonb, '{ativo,linhas}', '[[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]]')::json
      when 'sem_contratacao' then (v_pacote::jsonb #- '{dicionarios,contratacao}')::json
      when 'outra_area' then jsonb_set(v_pacote::jsonb, '{area}', '"sede"')::json
      when 'versao' then jsonb_set(v_pacote::jsonb, '{schema_version}', '2')::json
      when 'sem_entrevista_demais' then jsonb_set(v_pacote::jsonb, '{aprovados_sem_entrevista}',
        (select jsonb_agg('{}'::jsonb) from generate_series(1, 3001)))::json
      else v_pacote end;
    begin
      perform public.paineis_gravar_pacote(
        v_casos[v_i][1], v_casos[v_i][2],
        case v_casos[v_i][3] when 'futuro' then now() + interval '10 minutes'
                             when 'velho' then now() - interval '2 hours' else now() end,
        case v_casos[v_i][3] when 'marca_nula' then array[null::bigint] else '{}'::bigint[] end,
        v_pacote,
        case v_casos[v_i][3] when 'execucao' then 'com espaço' else 'ensaio-1' end);
      v_outros := v_outros + 1;
    exception when sqlstate '22023' then
      v_recusas := v_recusas + 1;
    end;
  end loop;
  insert into t_r values ('gravacao_recusa_lixo', to_jsonb(v_recusas = array_length(v_casos, 1) and v_outros = 0));
  insert into t_r values ('recusas', to_jsonb(v_recusas));
  insert into t_r values ('nada_gravado_com_lixo', to_jsonb(
    not exists (select 1 from private."TA_PAINEL_ANALISE" where "CO_AREA" = 'ensaio-paineis')
    and not exists (select 1 from private."TA_CANDIDATO_APROVADO_AREA" where "CO_AREA" = 'ensaio-paineis')
    and not exists (select 1 from private."TA_PAINEL_ENTREVISTA" where "CO_AREA" = 'ensaio-paineis')));
end;
$$;

-- F. Gravar de verdade: só as marcas lidas saem; a marca nova (depois da leitura) fica.
do $$
declare
  v_fontes json;
  v_marcas bigint[];
  v_lido timestamptz;
  v_pac json;
  v_r jsonb;
  v_nova bigint;
  v_ms numeric;
  v_t0 timestamptz;
  v_si json;
begin
  v_fontes := public.paineis_ler_fontes('ANALISES', 'ensaio-paineis');
  v_marcas := (select array_agg(x::bigint) from json_array_elements_text(v_fontes -> 'marcas') x);
  v_lido := (v_fontes ->> 'lido_em')::timestamptz;
  perform private."FC_MARCAR_CACHE"(array['ANALISES'], array['ensaio-paineis'], 'ENSAIO');
  select max(t."CO_ALTERACAO_CACHE") into v_nova from private."TL_ALTERACAO_CACHE" t
   where t."TP_CACHE" = 'ANALISES' and t."CO_AREA" = 'ensaio-paineis';
  v_pac := (select json_object_agg(m."TP_ESCOPO", json_build_object('linhas', m."DS_LINHAS", 'editais', m."DS_EDITAIS",
                    'atualizado_em', m."DT_ULTIMA_ATUALIZACAO", 'concluidas_por_ano', m."DS_CONCLUIDAS_POR_ANO"))
              from private."FC_MONTAR_PAINEL_ANALISE"('ensaio-paineis', array['ativo', 'inativo', 'desativadas'], false) m);
  v_r := public.paineis_gravar_pacote('ANALISES', 'ensaio-paineis', v_lido, v_marcas, v_pac, 'ensaio-1');
  insert into t_r values ('grava_tres_escopos', to_jsonb((v_r ->> 'gravados')::integer = 3
    and (select count(*) = 3 and bool_and("DT_GERACAO" = v_lido)
                and bool_and("DS_VERSAO_DADOS" = (extract(epoch from v_lido) * 1000000)::bigint::text)
                and bool_and("NU_DURACAO_MS" >= 0)
           from private."TA_PAINEL_ANALISE" where "CO_AREA" = 'ensaio-paineis')));
  insert into t_r values ('marcas_lidas_apagadas_nova_fica', to_jsonb(
    (v_r ->> 'marcas_apagadas')::integer = cardinality(v_marcas) and cardinality(v_marcas) > 0
    and (select array_agg(t."CO_ALTERACAO_CACHE") from private."TL_ALTERACAO_CACHE" t
          where t."TP_CACHE" = 'ANALISES' and t."CO_AREA" = 'ensaio-paineis') = array[v_nova]));
  insert into t_r values ('area_continua_pendente_pela_marca_nova', to_jsonb(exists (
    select 1 from private."FC_PAINEIS_VENCIDOS"('ANALISES') v where v."CO_AREA" = 'ensaio-paineis' and v."TP_MOTIVO" = 'MARCA')));

  -- Aprovados e entrevistas.
  v_fontes := public.paineis_ler_fontes('APROVADOS', 'ensaio-paineis');
  v_r := public.paineis_gravar_pacote('APROVADOS', 'ensaio-paineis', (v_fontes ->> 'lido_em')::timestamptz,
           (select coalesce(array_agg(x::bigint), '{}') from json_array_elements_text(v_fontes -> 'marcas') x),
           (select json_build_object('listas', m.p_listas, 'dicionarios', m.p_dicionarios, 'linhas', m.p_linhas)
              from private."FC_MONTAR_APROVADOS_AREA"('ensaio-paineis', null) m), 'ensaio-1');
  v_fontes := public.paineis_ler_fontes('ENTREVISTAS', 'ensaio-paineis');
  v_r := v_r || jsonb_build_object('entrevistas', public.paineis_gravar_pacote('ENTREVISTAS', 'ensaio-paineis',
           (v_fontes ->> 'lido_em')::timestamptz,
           (select coalesce(array_agg(x::bigint), '{}') from json_array_elements_text(v_fontes -> 'marcas') x),
           private."FC_MONTAR_ENTREVISTAS_AREA"('ensaio-paineis', null), 'ensaio-1'));
  insert into t_r values ('grava_aprovados_e_entrevistas', to_jsonb(
    (v_r ->> 'gravados')::integer = 1 and (v_r -> 'entrevistas' ->> 'gravados')::integer = 1
    and (select "QT_CANDIDATOS" from private."TA_CANDIDATO_APROVADO_AREA" where "CO_AREA" = 'ensaio-paineis') = 5
    and (select "QT_ENTREVISTA" from private."TA_PAINEL_ENTREVISTA" where "CO_AREA" = 'ensaio-paineis') = 3
    and not exists (select 1 from private."FC_PAINEIS_VENCIDOS"('APROVADOS') v where v."CO_AREA" = 'ensaio-paineis')
    and not exists (select 1 from private."FC_PAINEIS_VENCIDOS"('ENTREVISTAS') v where v."CO_AREA" = 'ensaio-paineis')));

  -- G. Nunca troca um pacote mais novo por um mais velho.
  v_r := public.paineis_gravar_pacote('APROVADOS', 'ensaio-paineis', now() - interval '10 minutes', '{}',
           (select json_build_object('listas', '[]'::json, 'dicionarios', json_build_object('cargo', '[]'::json,
                     'modalidade', '[]'::json, 'status', '[]'::json, 'codigo_vaga', '[]'::json, 'contratacao', '{}'::json),
                     'linhas', '[]'::json)), 'ensaio-1');
  insert into t_r values ('nao_troca_o_mais_novo', to_jsonb((v_r ->> 'gravados')::integer = 0
    and (select "QT_CANDIDATOS" from private."TA_CANDIDATO_APROVADO_AREA" where "CO_AREA" = 'ensaio-paineis') = 5));

  -- Medida: gravar o pacote das análises da Saúde Indígena (o maior) e ler as fontes dele.
  v_t0 := clock_timestamp();
  v_si := public.paineis_ler_fontes('ANALISES', 'saude-indigena');
  insert into t_r values ('ms_ler_fontes_analises_si', to_jsonb(round(extract(epoch from clock_timestamp() - v_t0)::numeric * 1000)));
  v_pac := (select json_object_agg(m."TP_ESCOPO", json_build_object('linhas', m."DS_LINHAS", 'editais', m."DS_EDITAIS",
                    'atualizado_em', m."DT_ULTIMA_ATUALIZACAO", 'concluidas_por_ano', m."DS_CONCLUIDAS_POR_ANO"))
              from private."FC_MONTAR_PAINEL_ANALISE"('saude-indigena', array['ativo', 'inativo', 'desativadas'], false) m);
  v_t0 := clock_timestamp();
  v_r := public.paineis_gravar_pacote('ANALISES', 'saude-indigena', clock_timestamp(), '{}', v_pac, 'ensaio-1');
  v_ms := round(extract(epoch from clock_timestamp() - v_t0)::numeric * 1000);
  insert into t_r values ('ms_gravar_analises_si', to_jsonb(v_ms));
  insert into t_r values ('mb_pacote_analises_si', to_jsonb(round(octet_length(v_pac::text) / 1e6, 2)));
end;
$$;

-- H. A rodada do pg_cron: pede o job em vez de montar; reserva no banco quando precisa.
do $$
declare
  v_r jsonb;
  v_antes timestamptz;
begin
  -- Pedido de 1 min atrás ainda em andamento: não pede de novo nem monta.
  insert into public."TL_DISPARO_ROBO" ("NO_WORKFLOW", "TP_ORIGEM", "CO_PEDIDO_HTTP", "TP_SITUACAO", "DT_DISPARO")
  values ('pacotes-dos-paineis.yml', 'AGENDA', -1, 'PEDIDO', now() - interval '1 minute');
  select max("DT_GERACAO") into v_antes from private."TA_PAINEL_ANALISE" where "CO_AREA" = 'ensaio-paineis';
  v_r := private."FC_PAINEIS_RODADA"('ANALISES');
  insert into t_r values ('rodada_nao_repete_pedido_nem_monta', to_jsonb(
    (v_r ->> 'pediu')::boolean and v_r -> 'disparo' = 'null'::jsonb
    and not (v_r -> 'reserva') ? 'ensaio-paineis'
    and (select max("DT_GERACAO") from private."TA_PAINEL_ANALISE" where "CO_AREA" = 'ensaio-paineis') = v_antes
    and exists (select 1 from private."TL_ALTERACAO_CACHE" where "TP_CACHE" = 'ANALISES' and "CO_AREA" = 'ensaio-paineis')));

  -- Marca esperando há mais de 30 min: a reserva monta no banco (e apaga as marcas).
  update private."TL_ALTERACAO_CACHE" set "DT_ALTERACAO" = now() - interval '31 minutes'
   where "TP_CACHE" = 'ANALISES' and "CO_AREA" = 'ensaio-paineis';
  v_r := private."FC_PAINEIS_RODADA"('ANALISES');
  insert into t_r values ('rodada_reserva_marca_velha', to_jsonb(
    (v_r -> 'reserva') ? 'ensaio-paineis'
    and (select max("DT_GERACAO") from private."TA_PAINEL_ANALISE" where "CO_AREA" = 'ensaio-paineis') > v_antes
    and not exists (select 1 from private."TL_ALTERACAO_CACHE" where "TP_CACHE" = 'ANALISES' and "CO_AREA" = 'ensaio-paineis')));

  -- Sem pedido recente e sem a chave do GitHub (simulada: nada sai do banco): pede, fica
  -- SEM_TOKEN e a reserva monta já.
  delete from public."TL_DISPARO_ROBO" where "NO_WORKFLOW" = 'pacotes-dos-paineis.yml';
  perform set_config('agsus.segredo_disparo_robos', 'segredo-que-nao-existe-no-ensaio', true);
  perform private."FC_MARCAR_CACHE"(array['APROVADOS'], array['ensaio-paineis'], 'ENSAIO');
  select "DT_GERACAO" into v_antes from private."TA_CANDIDATO_APROVADO_AREA" where "CO_AREA" = 'ensaio-paineis';
  v_r := private."FC_PAINEIS_RODADA"('APROVADOS');
  insert into t_r values ('rodada_pede_o_job_e_sem_token_vai_para_reserva', to_jsonb(
    (v_r ->> 'pediu')::boolean and v_r ->> 'situacao_do_pedido' = 'SEM_TOKEN'
    and (v_r -> 'reserva') ? 'ensaio-paineis'
    and (select "DT_GERACAO" from private."TA_CANDIDATO_APROVADO_AREA" where "CO_AREA" = 'ensaio-paineis') > v_antes
    and exists (select 1 from public."TL_DISPARO_ROBO" where "NO_WORKFLOW" = 'pacotes-dos-paineis.yml'
                                                         and "TP_ORIGEM" = 'AGENDA' and "TP_SITUACAO" = 'SEM_TOKEN')));

  -- Último pedido SEM_TOKEN (há menos de 30 min): a próxima rodada vai direto para a reserva.
  perform private."FC_MARCAR_CACHE"(array['ENTREVISTAS'], array['ensaio-paineis'], 'ENSAIO');
  v_r := private."FC_PAINEIS_RODADA"('ENTREVISTAS');
  insert into t_r values ('rodada_depois_de_falha_vai_para_reserva', to_jsonb(
    v_r -> 'disparo' = 'null'::jsonb and (v_r -> 'reserva') ? 'ensaio-paineis' and v_r -> 'falhas' = 'null'::jsonb
    and not exists (select 1 from private."TL_ALTERACAO_CACHE" where "TP_CACHE" = 'ENTREVISTAS' and "CO_AREA" = 'ensaio-paineis')));
end;
$$;

-- I. A leitura recusa pacote e área desconhecidos.
do $$
declare v_n integer := 0;
begin
  begin perform public.paineis_ler_fontes('XYZ', 'sede'); exception when sqlstate '22023' then v_n := v_n + 1; end;
  begin perform public.paineis_ler_fontes('ANALISES', 'nao-existe'); exception when sqlstate '22023' then v_n := v_n + 1; end;
  insert into t_r values ('leitura_recusa_desconhecido', to_jsonb(v_n = 2));
end;
$$;

select jsonb_object_agg(k, v order by k) as resultado from t_r;

rollback;
