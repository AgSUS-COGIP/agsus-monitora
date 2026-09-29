/*
  CACHE DO PAINEL DE ANÁLISES NO SERVIDOR

  ## O problema

  Cada abertura do painel (get_analises_dashboard_payload_v2) montava o payload
  inteiro da área: na Saúde Indígena, ≈3,5 MB de JSON, 1,5 s com o banco quente
  e 4 s frio, no servidor NANO do Supabase (CPU limitada). Os dados só mudam
  quando uma planilha sincroniza (2 a 4 vezes por hora); entre um sync e outro,
  todo mundo que abria o painel refazia exatamente a mesma conta.

  ## O que muda

  - private."TA_PAINEL_ANALISE" guarda, por área e escopo, as linhas e os
    editais já montados em JSON. Fica no schema private (o PostgREST não o
    expõe), com RLS ligada e sem policy: só as funções abaixo o leem.
    Só o escopo 'ativo' é guardado — é o único que o front pede inteiro;
    'inativo' e 'todos' vão pelo recorte (get_analises_dashboard_filtrado) e,
    se pedidos aqui, continuam montados na hora, como antes.
  - private."FC_MONTAR_PAINEL_ANALISE" é a montagem que estava dentro de
    get_analises_dashboard_payload_v2, tirada de lá sem mudar uma linha do SQL
    e sem checar permissão (quem chama já checou): a RPC e a remontagem usam a
    mesma, não há duas versões da conta.
  - public.atualizar_cache_painel_analises(área) monta e grava; é a única
    que escreve no cache (pg_cron, fim do sync e a própria RPC).
  - get_analises_dashboard_payload_v2: mesma assinatura, mesmas checagens de
    permissão (pode_recurso + FC_GRUPOS_ANALISES_DA_AREA, que dá 22023/42501),
    mesmo conteúdo. No 'ativo', devolve o que está guardado quando ainda vale;
    senão monta, grava e devolve. `cache.hit` diz de onde veio;
    `cache.refreshed_at` e `generated_at` passam a ser a hora da montagem.

  ## Quando o guardado vale (sem gatilho por linha)

  O cache antigo (TA_DASHBOARD_ANALISE, removido em 20260925150000) era apagado
  por gatilho a cada escrita, inclusive no meio do sync. Aqui não há gatilho:

  1. Versão dos dados: private."FC_VERSAO_DADOS_ANALISE"(área) resume os syncs
     terminados das planilhas da área (quantos e o último finished_at, em
     TL_SYNC_ANALISE). A versão é lida ANTES de montar e gravada junto; se um
     sync terminar depois (inclusive um que falhou no meio, com lotes já
     gravados), a versão muda e o guardado deixa de valer. Comparar versões, e
     não horas, evita a corrida "montei com dados velhos, mas a hora é nova".
  2. O sync NÃO é tocado: finalizar_sync_analises_* continuam iguais. Depois de
     um sync, a versão muda e a primeira abertura do painel remonta a área
     (0,2–0,8 s, uma vez, sob trava consultiva). Remontar dentro do finalizar
     somaria segundos a uma função com statement_timeout de 30 s, e um timeout
     ali faria o sync falhar.
  3. pg_cron (agsus_analises_cache_do_painel, a cada 30 min) remonta todas as
     áreas: cobre correção manual no banco e mudança em TB_AREA.
  4. Guardado com mais de 40 min (cron parado) também é remontado na hora.

  Duas aberturas ao mesmo tempo com o cache vencido: só uma remonta (trava
  consultiva por área); a outra devolve o guardado anterior ou, se não houver,
  monta sem gravar. Falha ao gravar (trava, transação só de leitura) também cai
  na montagem sem gravar: o painel nunca deixa de abrir por causa do cache.

  Nenhum dado muda. O rollback está em supabase/rollback/.
*/
begin;

-- ---------------------------------------------------------------------------
-- 1. Tabela do cache
-- ---------------------------------------------------------------------------
create table private."TA_PAINEL_ANALISE" (
  "CO_AREA" text not null,
  "TP_ESCOPO" text not null,
  "DS_LINHAS" json not null,
  "DS_EDITAIS" json not null,
  "QT_LINHAS" integer not null,
  "DS_VERSAO_DADOS" text not null,
  "DT_GERACAO" timestamptz not null,
  "NU_DURACAO_MS" integer not null,
  constraint "PK_TA_PAINEL_ANALISE" primary key ("CO_AREA", "TP_ESCOPO"),
  constraint "FK_AREA_PAINEL_ANALISE" foreign key ("CO_AREA")
    references public."TB_AREA" ("CO_AREA") on delete cascade,
  constraint "CK_PAINEL_ANALISE_TPESCOPO" check ("TP_ESCOPO" in ('ativo', 'inativo', 'todos'))
);

comment on table private."TA_PAINEL_ANALISE" is
  'Cache do painel de análises: linhas e editais já montados por área e escopo. Só funções SECURITY DEFINER leem.';
comment on column private."TA_PAINEL_ANALISE"."DS_LINHAS" is
  'Linhas do payload (array de arrays, na ordem de "columns" de get_analises_dashboard_payload_v2).';
comment on column private."TA_PAINEL_ANALISE"."DS_EDITAIS" is 'Editais do payload.';
comment on column private."TA_PAINEL_ANALISE"."QT_LINHAS" is 'Quantidade de linhas (campo total do payload).';
comment on column private."TA_PAINEL_ANALISE"."DS_VERSAO_DADOS" is
  'FC_VERSAO_DADOS_ANALISE lida antes da montagem; diferente da atual, o cache não vale.';
comment on column private."TA_PAINEL_ANALISE"."DT_GERACAO" is 'Início da montagem (vira generated_at e cache.refreshed_at).';
comment on column private."TA_PAINEL_ANALISE"."NU_DURACAO_MS" is 'Quanto a montagem levou, em milissegundos.';

alter table private."TA_PAINEL_ANALISE" enable row level security;
revoke all on private."TA_PAINEL_ANALISE" from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Versão dos dados da área
-- ---------------------------------------------------------------------------
create function private."FC_VERSAO_DADOS_ANALISE"(p_area text)
 returns text
 language sql
 stable
 set search_path to ''
as $function$
  select count(*)::text || '|' || coalesce(max(s.finished_at)::text, '-')
    from public."TL_SYNC_ANALISE" s
    join public."TB_PLANILHA_ANALISE" p on p."CO_PLANILHA" = s."CO_PLANILHA"
   where p."CO_AREA" = p_area
     and s.finished_at is not null;
$function$;

comment on function private."FC_VERSAO_DADOS_ANALISE"(text) is
  'Resumo dos syncs terminados das planilhas da área: muda sempre que um sync da área termina (bem ou mal).';

-- ---------------------------------------------------------------------------
-- 3. Montagem (a de get_analises_dashboard_payload_v2, sem checar permissão)
-- ---------------------------------------------------------------------------
create function private."FC_MONTAR_PAINEL_ANALISE"(
  p_area text,
  p_escopo text,
  out p_linhas json,
  out p_editais json,
  out p_total integer
)
 language plpgsql
 stable
 set search_path to 'public', 'private', 'pg_temp'
 set work_mem to '64MB'
 set jit to 'off'
as $function$
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
$function$;

comment on function private."FC_MONTAR_PAINEL_ANALISE"(text, text) is
  'Linhas e editais do painel de análises da área/escopo. NÃO checa permissão: só para funções que já checaram.';

revoke all on function private."FC_VERSAO_DADOS_ANALISE"(text) from public, anon, authenticated, service_role;
revoke all on function private."FC_MONTAR_PAINEL_ANALISE"(text, text) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Remontagem: pg_cron, fim do sync e a própria RPC quando o cache venceu
--    (só service_role e postgres executam direto)
-- ---------------------------------------------------------------------------
create function public.atualizar_cache_painel_analises(p_area text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'private', 'pg_temp'
as $function$
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
$function$;

comment on function public.atualizar_cache_painel_analises(text) is
  'Remonta o cache do painel de análises (escopo ativo) de uma área ou de todas. Erro numa área vira aviso e ok=false; só lança para área inexistente. Só service_role/postgres (pg_cron, fim do sync).';

revoke all on function public.atualizar_cache_painel_analises(text) from public, anon, authenticated;
grant execute on function public.atualizar_cache_painel_analises(text) to service_role;

-- ---------------------------------------------------------------------------
-- 5. A RPC do painel lê o cache
-- ---------------------------------------------------------------------------
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
  v_cache private."TA_PAINEL_ANALISE";
  v_versao text;
  v_tem_cache boolean := false;
  v_hit boolean := false;
  v_rows json;
  v_editais json;
  v_total integer;
  v_gerado_em timestamptz := now();
begin
  if not (private.pode_recurso('analises')) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;

  if v_scope not in ('ativo', 'inativo', 'todos') then
    raise exception 'Escopo invalido. Use ativo, inativo ou todos.';
  end if;

  -- Área válida e do usuário (ou admin): 22023/42501 antes de qualquer leitura.
  perform private."FC_GRUPOS_ANALISES_DA_AREA"(v_area);
  select a."NO_AREA" into v_area_nome from public."TB_AREA" a where a."CO_AREA" = v_area;

  -- Só o 'ativo' é guardado; 'inativo' e 'todos' seguem montados na hora.
  if v_scope = 'ativo' then
    v_versao := private."FC_VERSAO_DADOS_ANALISE"(v_area);
    select * into v_cache
      from private."TA_PAINEL_ANALISE" c
     where c."CO_AREA" = v_area and c."TP_ESCOPO" = v_scope;
    v_tem_cache := found;

    if v_tem_cache
       and v_cache."DS_VERSAO_DADOS" = v_versao
       and v_cache."DT_GERACAO" > now() - interval '40 minutes' then
      v_hit := true;
    elsif pg_try_advisory_xact_lock(hashtext('painel_analise:' || v_area || ':' || v_scope)::bigint) then
      -- Vencido: remonta e grava. Se a gravação falhar (trava, transação só de
      -- leitura...), atualizar_cache_painel_analises só avisa e o painel é
      -- montado na hora, abaixo.
      perform public.atualizar_cache_painel_analises(v_area);
      select * into v_cache
        from private."TA_PAINEL_ANALISE" c
       where c."CO_AREA" = v_area and c."TP_ESCOPO" = v_scope;
      v_tem_cache := found
        and v_cache."DS_VERSAO_DADOS" = v_versao
        and v_cache."DT_GERACAO" > now() - interval '40 minutes';
    else
      -- Outra abertura já está remontando: o guardado anterior serve por ora.
      v_hit := v_tem_cache;
    end if;
  end if;

  if v_tem_cache then
    v_rows := v_cache."DS_LINHAS";
    v_editais := v_cache."DS_EDITAIS";
    v_total := v_cache."QT_LINHAS";
    v_gerado_em := v_cache."DT_GERACAO";
  else
    select m.p_linhas, m.p_editais, m.p_total
      into v_rows, v_editais, v_total
      from private."FC_MONTAR_PAINEL_ANALISE"(v_area, v_scope) m;
  end if;

  return json_build_object(
    'schema_version', 3,
    'scope', v_scope,
    'area', v_area,
    'area_nome', v_area_nome,
    'columns', v_columns,
    'rows', v_rows,
    'editais', v_editais,
    'total', v_total,
    'textos_sob_demanda', true,
    'generated_at', v_gerado_em,
    'cache', json_build_object('hit', v_hit, 'refreshed_at', v_gerado_em)
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- 6. Agendamento de segurança (pg_cron) e primeira carga
-- ---------------------------------------------------------------------------
do $$
declare
  v_comando constant text := 'select public.atualizar_cache_painel_analises();';
  v_id bigint;
begin
  select jobid into v_id from cron.job where jobname = 'agsus_analises_cache_do_painel';
  if v_id is null then
    perform cron.schedule('agsus_analises_cache_do_painel', '7,37 * * * *', v_comando);
  else
    perform cron.alter_job(v_id, schedule => '7,37 * * * *', command => v_comando);
  end if;
end;
$$;

select public.atualizar_cache_painel_analises();

commit;
