/*
  PAINEL DE ANÁLISES: LISTA ENXUTA E OS TRÊS ESCOPOS PRONTOS NO SERVIDOR

  ## O problema

  - A lista (get_analises_dashboard_payload_v2) levava 35 colunas por linha, e
    metade delas só aparece no detalhamento ou no CSV (pontuações,
    experiências, links, origem, datas de PDF, updated_at...). Saúde Indígena
    ativa: ~3,5 MB; inativa: ~7,8 MB.
  - Só o 'ativo' ficava pronto no servidor. 'Inativo' e 'Todos' exigiam o
    "recorte" (escolher unidades e editais antes, get_analises_dashboard_filtrado),
    que filtrava pelo nome da unidade da análise e devolvia 0 linha quando a
    DIM_EDITAIS escrevia a unidade diferente ("Agora tem Especialistas
    Caminhoneiros" x "Especialistas Caminhoneiros").
  - A versão aplicada no banco em 29/09 (recorte por coordenação,
    FC_EDITAIS_VISIVEIS) voltou a montar o 'ativo' a cada abertura: o pacote
    pronto de TA_PAINEL_ANALISE era remontado pelo pg_cron e ninguém o lia.

  ## O que muda

  - Lista (schema_version 4): só o que a lista, os filtros, os KPIs, os
    gráficos, as pendências e a tabela usam — id, unidade, edital, código e
    nome da vaga, candidato, categoria, modalidade, status, etapa, responsável,
    data da análise, nota final, pdf_status e tem_pdf (há link de PDF?).
    `grupo` (o da área), `edital_status` (do escopo) e `atualizado_em` (o
    dado mais novo, para o "Atualizado em" do painel) vão uma vez no envelope.
    A ordem é a de sempre (unidade, edital, vaga, candidato), com o id no
    desempate.
    Saem da linha, sem sumir do painel:
      * a janela oficial (data_inicio/fim_analise) e a validação: o front casa
        a linha com `editais[]` pela mesma regra da view (edital de mesma
        unidade; senão o único de mesmo grupo e número) e calcula a validação,
        como já fazia;
      * o município/UF da UBS móvel: o front lê do nome da vaga com a mesma
        expressão;
      * pontuações, experiências, link_pdf, erro_pdf, origem_arquivo_id,
        updated_at, ultima_atualizacao, chave_natural: no detalhamento
        (get_analise_detalhe_do_painel, ao abrir o registro);
      * link_pdf e o tempo de experiência profissional do CSV: em
        get_analises_texto_do_painel, junto do parecer (o CSV sai igual).
  - Três escopos guardados por área em TA_PAINEL_ANALISE, que dividem as
    análises sem sobra nem repetição:
      'ativo'       análise ativa de edital ativo (como antes);
      'inativo'     edital inativo (como antes);
      'desativadas' análise desativada pelo sync de edital ativo — só aparece
                    em "Todos".
    "Todos" = os três juntos no navegador (o front já tem as cópias de 'ativo'
    e 'inativo'); não há pacote próprio. private."FC_MONTAR_PAINEL_ANALISE"
    monta os escopos pedidos numa passada só pela tabela.
  - Quem tem recorte por coordenação (FC_EDITAIS_VISIVEIS não nulo) continua
    recebendo só o que pode ver, montado na hora; os demais recebem o pronto.
  - pg_cron (a cada 2 min, atualizar_cache_painel_analises_vencidos): remonta a
    área só quando a versão dos dados muda, falta um escopo ou o pronto tem
    mais de 6 h (rede de segurança para correção manual no banco).
  - get_analises_dashboard_filtrado sai: o front não usa mais o recorte.

  Permissões iguais: pode_recurso('analises'), área do usuário
  (FC_GRUPOS_ANALISES_DA_AREA: 22023/42501) e o recorte por coordenação.
  Nenhum dado muda. O rollback está em supabase/rollback/.
*/
begin;

-- ---------------------------------------------------------------------------
-- 1. O guardado aceita o escopo 'desativadas'.
-- ---------------------------------------------------------------------------
alter table private."TA_PAINEL_ANALISE"
  drop constraint "CK_PAINEL_ANALISE_TPESCOPO";
alter table private."TA_PAINEL_ANALISE"
  add constraint "CK_PAINEL_ANALISE_TPESCOPO"
  check ("TP_ESCOPO" = any (array['ativo', 'inativo', 'desativadas', 'todos']));

-- A hora do dado mais novo do escopo (o "Atualizado em" do painel), que antes
-- o front tirava de updated_at/ultima_atualizacao de cada linha.
alter table private."TA_PAINEL_ANALISE"
  add column "DT_ULTIMA_ATUALIZACAO" timestamptz;

comment on column private."TA_PAINEL_ANALISE"."DT_ULTIMA_ATUALIZACAO" is
  'Maior coalesce(updated_at, ultima_atualizacao) das linhas do escopo.';

comment on table private."TA_PAINEL_ANALISE" is
  'Cache do painel de análises: linhas (lista enxuta) e editais já montados por área e escopo (ativo, inativo, desativadas). Só funções SECURITY DEFINER leem.';

-- ---------------------------------------------------------------------------
-- 2. Montagem: vários escopos numa passada, lista enxuta.
-- ---------------------------------------------------------------------------
drop function if exists private."FC_MONTAR_PAINEL_ANALISE"(text, text);

create function private."FC_MONTAR_PAINEL_ANALISE"(
  p_area text,
  p_escopos text[],
  p_so_visiveis boolean default false
)
returns table (
  "TP_ESCOPO" text,
  "DS_LINHAS" json,
  "QT_LINHAS" integer,
  "DS_EDITAIS" json,
  "DT_ULTIMA_ATUALIZACAO" timestamptz
)
language plpgsql
stable
set search_path to 'public', 'private', 'pg_temp'
set work_mem to '64MB'
set jit to 'off'
as $function$
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

comment on function private."FC_MONTAR_PAINEL_ANALISE"(text, text[], boolean) is
  'Linhas (lista enxuta) e editais do painel de análises da área, por escopo (ativo, inativo, desativadas), numa passada. NÃO checa permissão: só para funções que já checaram. p_so_visiveis aplica o recorte por coordenação do usuário.';

revoke all on function private."FC_MONTAR_PAINEL_ANALISE"(text, text[], boolean) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Remontagem: os três escopos da área numa passada.
-- ---------------------------------------------------------------------------
drop function if exists public.atualizar_cache_painel_analises(text);

create function public.atualizar_cache_painel_analises(
  p_area text default null,
  p_escopos text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
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

comment on function public.atualizar_cache_painel_analises(text, text[]) is
  'Remonta o cache do painel de análises (escopos ativo, inativo e desativadas, ou os pedidos) de uma área ou de todas, numa passada por área. Erro numa área vira aviso e ok=false; só lança para área inexistente. Só service_role/postgres (pg_cron).';

revoke all on function public.atualizar_cache_painel_analises(text, text[]) from public, anon, authenticated;
grant execute on function public.atualizar_cache_painel_analises(text, text[]) to service_role;

create or replace function public.atualizar_cache_painel_analises_vencidos()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
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

comment on function public.atualizar_cache_painel_analises_vencidos() is
  'Remonta só as áreas cujo pacote do painel de análises venceu (sync novo, escopo faltando ou mais de 6 h). Chamada pelo pg_cron a cada 2 min; barata quando nada mudou.';

revoke all on function public.atualizar_cache_painel_analises_vencidos() from public, anon, authenticated;
grant execute on function public.atualizar_cache_painel_analises_vencidos() to service_role;

-- ---------------------------------------------------------------------------
-- 4. A lista: o pronto para quem vê a área inteira; na hora para quem tem
--    recorte por coordenação.
-- ---------------------------------------------------------------------------
create or replace function public.get_analises_dashboard_payload_v2(
  p_scope text default 'ativo'::text,
  p_area text default 'saude-indigena'::text
)
returns json
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
set statement_timeout to '15s'
set lock_timeout to '3s'
set work_mem to '64MB'
set jit to 'off'
as $function$
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

-- ---------------------------------------------------------------------------
-- 5. Detalhamento: tudo o que saiu da linha.
-- ---------------------------------------------------------------------------
create or replace function public.get_analise_detalhe_do_painel(p_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'private', 'pg_temp'
set statement_timeout to '5s'
as $function$
declare
  v_id uuid;
  v_analise text;
  v_chave text;
  v_grupo_norm text;
  v_area text;
  v_detalhe jsonb;
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

  select jsonb_build_object(
    'grupo', v.grupo,
    'nota_final_ajustada', v.nota_final_ajustada,
    'pontuacao_escolaridade', v.pontuacao_escolaridade,
    'pontuacao_cursos_aperfeicoamento', v.pontuacao_cursos_aperfeicoamento,
    'pontuacao_experiencia_profissional', v.pontuacao_experiencia_profissional,
    'pontuacao_criterio_etnico', v.pontuacao_criterio_etnico,
    'experiencia_saude_indigena_total', v.experiencia_saude_indigena_total,
    'experiencia_atencao_basica_total', v.experiencia_atencao_basica_total,
    'experiencia_profissional_anos', ac.experiencia_profissional_anos,
    'experiencia_profissional_meses', ac.experiencia_profissional_meses,
    'experiencia_profissional_dias', ac.experiencia_profissional_dias,
    'experiencia_profissional_total', ac.experiencia_profissional_total,
    'link_pdf', v.link_pdf,
    'pdf_status', v.pdf_status,
    'erro_pdf', v.erro_pdf,
    'origem_arquivo_id', v.origem_arquivo_id,
    'data_inicio_analise', v.data_inicio_analise,
    'data_fim_analise', v.data_fim_analise,
    'data_validacao_status', v.data_validacao_status,
    'edital_status', v.edital_status,
    'updated_at', v.updated_at,
    'ultima_atualizacao', v.ultima_atualizacao
  )
  into v_detalhe
  from public."VW_ANALISES_DASHBOARD_BASE_TODOS" v
  join public."TB_ANALISE_CURRICULAR" ac on ac.id = v.id
  where v.id = v_id;

  return coalesce(v_detalhe, '{}'::jsonb) || jsonb_build_object(
    'id', v_id,
    'area', v_area,
    'analise', v_analise,
    'chave_natural', v_chave
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- 6. Textos do escopo (CSV e busca): parecer, link do PDF e experiência.
-- ---------------------------------------------------------------------------
create or replace function public.get_analises_texto_do_painel(
  p_scope text default 'ativo'::text,
  p_area text default 'saude-indigena'::text
)
returns json
language plpgsql
stable security definer
set search_path to 'public', 'private', 'pg_temp'
set statement_timeout to '15s'
set work_mem to '64MB'
set jit to 'off'
as $function$
declare
  v_scope text := lower(btrim(coalesce(p_scope, 'ativo')));
  v_area text := lower(btrim(coalesce(p_area, 'saude-indigena')));
  v_grupos_norm text[];
  v_rows json;
begin
  if not (private.pode_recurso('analises')) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;

  if v_scope not in ('ativo', 'inativo', 'desativadas', 'todos') then
    raise exception 'Escopo invalido. Use ativo, inativo, desativadas ou todos.';
  end if;

  v_grupos_norm := private."FC_GRUPOS_ANALISES_DA_AREA"(v_area);

  select coalesce(json_agg(json_build_array(
    v.id, v.analise, v.link_pdf,
    ac.experiencia_profissional_anos, ac.experiencia_profissional_meses,
    ac.experiencia_profissional_dias, ac.experiencia_profissional_total
  )), '[]'::json)
  into v_rows
  from public."VW_ANALISES_DASHBOARD_BASE_TODOS" v
  join public."TB_ANALISE_CURRICULAR" ac on ac.id = v.id
  where case
    when v_scope = 'ativo' then v.ativo is true and v.edital_ativo is true
    when v_scope = 'inativo' then v.edital_ativo is false
    when v_scope = 'desativadas' then v.ativo is not true and v.edital_ativo is true
    else true
  end
    and ac.grupo_norm = any (v_grupos_norm)
    and ((select private."FC_EDITAIS_VISIVEIS"()) is null
      or ac.edital_norm = any ((select private."FC_EDITAIS_NORM_VISIVEIS"())::text[])
      or ac.unidade_norm = any ((select private."FC_UNIDADES_NORM_VISIVEIS"())::text[]))
    -- Linha sem nada disso não precisa vir: o front a completa com null.
    and (v.analise is not null
      or v.link_pdf is not null
      or ac.experiencia_profissional_anos is not null
      or ac.experiencia_profissional_meses is not null
      or ac.experiencia_profissional_dias is not null
      or ac.experiencia_profissional_total is not null);

  return json_build_object(
    'scope', v_scope,
    'area', v_area,
    'columns', json_build_array(
      'id', 'analise', 'link_pdf',
      'experiencia_profissional_anos', 'experiencia_profissional_meses',
      'experiencia_profissional_dias', 'experiencia_profissional_total'
    ),
    'rows', v_rows,
    'total', json_array_length(v_rows),
    'generated_at', now()
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- 7. O recorte (unidades + editais antes da consulta) sai.
-- ---------------------------------------------------------------------------
drop function if exists public.get_analises_dashboard_filtrado(text, text[], text[], integer, integer, boolean, text);

-- ---------------------------------------------------------------------------
-- 8. Os prontos antigos (35 colunas) saem e os três escopos são montados já.
-- ---------------------------------------------------------------------------
delete from private."TA_PAINEL_ANALISE";
select public.atualizar_cache_painel_analises();

commit;
