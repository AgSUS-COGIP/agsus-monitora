/*
  ENSAIO de 20261007170000_sync_de_analises_nao_trava.sql — begin … rollback.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, aplica o corpo da migration (copiado sem
  mudança, sem o begin/commit dela) e confere:
    E0  nenhuma execução real pendente na Saúde Indígena, em Projetos e na SEDE
        (com uma pendente de verdade, as contas abaixo não fecham: rode depois);
    E1  função nova só para o service_role, iniciar/gatilho/comparar chamando a
        regra, tarefa agsus_analises_encerrar_inativas agendada, Status das
        atualizações com encerrada_por_inatividade;
    E2  o INCIDENTE: uma execução 'carregado' da Saúde Indígena parada há 16 h
        (linhas_staging 0, como a 5065) e uma nova pedindo para começar: a velha
        sai como 'erro' "encerrada por inatividade" e a nova começa;
    E3  o lock continua: com a nova ativa, outro iniciar é recusado e o insert
        do FULL da mesma planilha é recusado (55P03);
    E4  a varredura (todas as planilhas): fecha a parada da SEDE sem apagar o
        staging dela; uma parada no log mas com staging recente fica; uma
        parada que volta a comparar (comparar_analises_incremental_v2) fica.
  Termina em ROLLBACK: nada fica gravado. As execuções são fictícias (sync_id
  aleatório, chaves "ENSAIO|…").

  Resultado esperado: as mensagens "ok E0" … "ok E4" e a linha "ENSAIO OK" do
  SELECT final. Qualquer "FALHOU …" interrompe e desfaz tudo; copie a mensagem.

  Mantenha em sincronia: tests/sync-de-analises-nao-trava-migration.test.js
  confere que o corpo da migration aqui é idêntico ao do arquivo da migration.
*/
begin;

-- E0. Nenhuma execução real pendente nas três planilhas (antes do corpo).
do $$
begin
  if exists (select 1 from public."TL_SYNC_ANALISE"
              where status in ('iniciado', 'carregado', 'processando') and finished_at is null
                and "CO_PLANILHA" in ('saude-indigena', 'projetos', 'sede')) then
    raise exception 'FALHOU E0: há execução real pendente; rode o ensaio quando ela terminar';
  end if;
  raise notice 'ok E0: nenhuma execução real pendente';
end;
$$;

-- ═══ CORPO DA MIGRATION (início) ═══

set local lock_timeout = '5s';

-- 0. Pré-requisitos ------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.iniciar_sync_analises_incremental(uuid, text)') is null
     or to_regprocedure('public.comparar_analises_incremental_v2(uuid, jsonb, boolean)') is null
     or to_regclass('public."TM_MANIFESTO_ANALISE"') is null then
    raise exception 'Aplique antes 20260928140000_sync_de_analises_por_planilha.sql e 20261001140000_incremental_remove_ausentes.sql.';
  end if;
  if to_regprocedure('public.get_saude_das_cargas()') is null then
    raise exception 'Aplique antes 20261001120000_saude_das_cargas.sql.';
  end if;
end;
$$;

-- 1. Encerrar execução parada ----------------------------------------------------------------
create function public."FC_ENCERRAR_SYNC_ANALISE_INATIVO"(p_planilha text default null, p_minutos integer default 30)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_planilha text;
  v_encerradas jsonb := '[]'::jsonb;
  v_lote jsonb;
  v_ocupadas jsonb := '[]'::jsonb;
begin
  if p_minutos is null or p_minutos not between 30 and 1440 then
    raise exception 'p_minutos deve estar entre 30 e 1440' using errcode = '22023';
  end if;

  for v_planilha in
    select distinct l."CO_PLANILHA"
      from public."TL_SYNC_ANALISE" l
     where l.status in ('iniciado', 'carregado', 'processando')
       and l.finished_at is null
       and (p_planilha is null or l."CO_PLANILHA" = p_planilha)
     order by 1
  loop
    -- Mesmo lock do iniciar, do lote e dos finalizar. Quem chama de dentro do iniciar já o tem
    -- (o lock de transação é reentrante); a varredura pula a planilha que está processando.
    if not pg_try_advisory_xact_lock(hashtext('public.processar_sync_analises:' || v_planilha)::bigint) then
      v_ocupadas := v_ocupadas || to_jsonb(v_planilha);
      continue;
    end if;

    with parada as (
      select l.id, l.status, a.ultima
        from public."TL_SYNC_ANALISE" l
        cross join lateral (
          select greatest(
                   l.updated_at, l.started_at, l.created_at,
                   (select max(m."DT_CRIACAO") from public."TM_MANIFESTO_ANALISE" m where m."CO_SYNC" = l.sync_id),
                   (select max(s.created_at) from public."TM_ANALISE_CURRICULAR" s where s.sync_id = l.sync_id)
                 ) as ultima
        ) a
       where l."CO_PLANILHA" = v_planilha
         and l.status in ('iniciado', 'carregado', 'processando')
         and l.finished_at is null
         and a.ultima < now() - make_interval(mins => p_minutos)
         for update of l skip locked
    ), encerrada as (
      update public."TL_SYNC_ANALISE" l
         set status = 'erro',
             finished_at = now(),
             updated_at = now(),
             erro = format(
               'Execução encerrada por inatividade: sem progresso desde %s (mais de %s min). Nada foi apagado; a próxima execução da planilha começa do zero.',
               to_char(p.ultima at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'), p_minutos),
             mensagem = coalesce(l.mensagem, 'Encerrada por inatividade.'),
             resultado = coalesce(l.resultado, '{}'::jsonb) || jsonb_build_object(
               'ok', false,
               'encerrada_por_inatividade', true,
               'auto_expired', true,
               'expired_at', now(),
               'previous_status', l.status,
               'ultima_atividade', p.ultima,
               'minutos_sem_progresso', p_minutos,
               'erro_anterior', l.erro
             )
        from parada p
       where l.id = p.id
      returning l.id, l.sync_id, p.status as status_anterior, p.ultima
    )
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', e.id, 'sync_id', e.sync_id, 'planilha', v_planilha,
             'status_anterior', e.status_anterior, 'ultima_atividade', e.ultima)
             order by e.id), '[]'::jsonb)
      into v_lote
      from encerrada e;
    v_encerradas := v_encerradas || v_lote;
  end loop;

  return jsonb_build_object(
    'encerradas', jsonb_array_length(v_encerradas),
    'execucoes', v_encerradas,
    'planilhas_ocupadas', v_ocupadas,
    'minutos', p_minutos
  );
end;
$function$;
comment on function public."FC_ENCERRAR_SYNC_ANALISE_INATIVO"(text, integer) is
  'Encerra como erro ("encerrada por inatividade") a execução de sync de análises iniciado/carregado/processando sem progresso há mais de p_minutos (30 a 1440; padrão 30). Progresso: updated_at/started_at/created_at do log, último manifesto e último staging do sync. p_planilha nula = todas. Não apaga nada; pula a planilha cujo lock consultivo está ocupado. Usada pelo iniciar, pelo gatilho do insert do log e pela tarefa agsus_analises_encerrar_inativas. Só service_role.';
revoke all on function public."FC_ENCERRAR_SYNC_ANALISE_INATIVO"(text, integer) from public, anon, authenticated;
grant execute on function public."FC_ENCERRAR_SYNC_ANALISE_INATIVO"(text, integer) to service_role;

-- 2. iniciar: encerra a parada antes de conferir a fila ----------------------------------------
CREATE OR REPLACE FUNCTION public.iniciar_sync_analises_incremental(p_sync_id uuid, p_origem text DEFAULT 'apps_script_analises_incremental_v1'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
 SET statement_timeout TO '5s'
 SET lock_timeout TO '1s'
AS $function$
declare
  v_row public."TL_SYNC_ANALISE"%rowtype;
  v_planilha text;
  v_encerradas jsonb;
  v_pendente record;
begin
  if p_sync_id is null then raise exception 'p_sync_id obrigatorio'; end if;
  -- [por-planilha] origem cadastrada e de carga incremental; lock por planilha.
  v_planilha := public."FC_PLANILHA_DA_ORIGEM_ANALISE"(p_origem, 'INCREMENTAL');
  if not pg_try_advisory_xact_lock(hashtext('public.processar_sync_analises:'||v_planilha)::bigint) then
    raise exception 'Outro processamento de analises esta em andamento.';
  end if;

  select * into v_row from public."TL_SYNC_ANALISE" where sync_id=p_sync_id order by id desc limit 1;
  if found then
    if coalesce(v_row.modo,'') <> 'INCREMENTAL_ACTIVE' then
      raise exception 'sync_id ja existe com modo diferente: %',coalesce(v_row.modo,'<null>');
    end if;
    if v_row."CO_PLANILHA" is distinct from v_planilha then
      raise exception 'sync_id ja existe para outra planilha: %',coalesce(v_row."CO_PLANILHA",'<null>');
    end if;
    return jsonb_build_object('ok',true,'sync_id',p_sync_id,'status',v_row.status,'existing',true,'resultado',v_row.resultado);
  end if;

  -- [nao-trava] execução desta planilha parada há mais de 30 min sai como 'erro' (20261007170000).
  v_encerradas := public."FC_ENCERRAR_SYNC_ANALISE_INATIVO"(v_planilha, 30);

  -- [por-planilha] só um sync pendente por planilha.
  select l.sync_id, l.status, greatest(l.updated_at, l.started_at, l.created_at) as ultima
    into v_pendente
    from public."TL_SYNC_ANALISE" l
   where l.status in ('carregado','processando') and l."CO_PLANILHA"=v_planilha
   order by l.id desc
   limit 1;
  if found then
    raise exception 'Existe outro sync de Analises pendente para a planilha % (sync_id %, status %, ultimo sinal %). Ele sera encerrado por inatividade depois de 30 min sem progresso.',
      v_planilha, v_pendente.sync_id, v_pendente.status, v_pendente.ultima;
  end if;

  insert into public."TL_SYNC_ANALISE"(sync_id,origem,modo,status,linhas_staging,started_at,resultado)
  values(p_sync_id,p_origem,'INCREMENTAL_ACTIVE','carregado',0,now(),jsonb_build_object(
    'modo_processamento','incremental',
    'incremental_preparado',false,
    'incremental_cursor',0,
    'incremental_iniciado_em',now(),
    'planilha',v_planilha
  ));

  return jsonb_build_object('ok',true,'sync_id',p_sync_id,'status','carregado','existing',false,
    'encerradas_por_inatividade',v_encerradas->'encerradas');
end;
$function$;

-- 3. comparar v2: a comparação conta como progresso ---------------------------------------------
CREATE OR REPLACE FUNCTION public.comparar_analises_incremental_v2(p_sync_id uuid, p_itens jsonb, p_reiniciar boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
 SET statement_timeout TO '10s'
 SET lock_timeout TO '1s'
AS $function$
begin
  if p_sync_id is null then raise exception 'p_sync_id obrigatorio'; end if;
  if not exists (select 1 from public."TL_SYNC_ANALISE"
                  where sync_id = p_sync_id and modo = 'INCREMENTAL_ACTIVE'
                    and status in ('iniciado', 'carregado', 'processando')) then
    raise exception 'Sync incremental % nao esta em andamento.', p_sync_id;
  end if;
  -- [nao-trava] sinal de vida no log (no máximo 1 vez por minuto): a comparação é progresso.
  update public."TL_SYNC_ANALISE"
     set updated_at = now()
   where sync_id = p_sync_id and modo = 'INCREMENTAL_ACTIVE'
     and status in ('iniciado', 'carregado', 'processando')
     and updated_at < now() - interval '1 minute';
  if p_reiniciar then
    delete from public."TM_MANIFESTO_ANALISE" where "CO_SYNC" = p_sync_id;
  end if;
  -- A v1 valida o lote (até 500 itens, linha e chave preenchidas) e compara.
  if p_itens is not null and jsonb_typeof(p_itens) = 'array' and jsonb_array_length(p_itens) between 1 and 500 then
    insert into public."TM_MANIFESTO_ANALISE" ("CO_SYNC", "NU_LINHA_ORIGEM", "DS_CHAVE_NATURAL")
    select p_sync_id, (j->>'linha_origem')::integer, j->>'chave_natural'
      from jsonb_array_elements(p_itens) j
     where coalesce(j->>'linha_origem', '') ~ '^[1-9][0-9]*$'
       and nullif(btrim(j->>'chave_natural'), '') is not null
    on conflict ("CO_SYNC", "NU_LINHA_ORIGEM") do update set "DS_CHAVE_NATURAL" = excluded."DS_CHAVE_NATURAL";
  end if;
  return public.comparar_analises_incremental(p_itens);
end;
$function$;

-- 4. Gatilho do insert do log (FULL): a mesma regra ---------------------------------------------
CREATE OR REPLACE FUNCTION public.analises_sync_guard_before_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_active record;
  v_planilha text;
begin
  -- [por-planilha] origem precisa estar cadastrada; o log recebe a planilha.
  select o."CO_PLANILHA" into v_planilha
    from public."TA_ORIGEM_ANALISE" o
   where o."CO_ORIGEM" = new.origem;
  if v_planilha is null then
    raise exception 'Origem de sincronizacao nao cadastrada em TA_ORIGEM_ANALISE: "%". Sync recusado.', coalesce(new.origem, '<nula>')
      using errcode = '22023';
  end if;
  new."CO_PLANILHA" := v_planilha;

  if coalesce(new.status, 'iniciado') in ('iniciado', 'carregado', 'processando') then
    -- [nao-trava] parada há mais de 30 min sai como 'erro' (20261007170000).
    perform public."FC_ENCERRAR_SYNC_ANALISE_INATIVO"(v_planilha, 30);

    select l.sync_id, l.status, l.created_at
      into v_active
    from public."TL_SYNC_ANALISE" l
    where l."CO_PLANILHA" = v_planilha
      and l.status in ('iniciado', 'carregado', 'processando')
      and l.finished_at is null
    order by l.created_at desc
    limit 1;

    if found then
      raise exception 'Ja existe uma carga de analises em andamento para a planilha % (sync_id %, status %, criada em %). Aguarde finalizar antes de iniciar outra.',
        v_planilha, v_active.sync_id, v_active.status, v_active.created_at
        using errcode = '55P03';
    end if;
  end if;

  return new;
end;
$function$;

-- 5. Varredura a cada 10 min (pg_cron) -----------------------------------------------------------
do $$
declare
  v_comando constant text := 'select public."FC_ENCERRAR_SYNC_ANALISE_INATIVO"(null, 30);';
  v_id bigint;
begin
  if to_regclass('cron.job') is null then
    raise notice 'pg_cron indisponível: o encerramento vale só quando a planilha pede para começar.';
    return;
  end if;
  select jobid into v_id from cron.job where jobname = 'agsus_analises_encerrar_inativas';
  if v_id is null then
    perform cron.schedule('agsus_analises_encerrar_inativas', '*/10 * * * *', v_comando);
  else
    perform cron.alter_job(v_id, schedule => '*/10 * * * *', command => v_comando);
  end if;
end;
$$;

-- 6. Status das atualizações: "encerrada por inatividade" ---------------------------------------
CREATE OR REPLACE FUNCTION public.get_saude_das_cargas()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_tarefas json;
begin
  if not private.is_master() then
    raise exception 'Somente o administrador global vê a saúde das cargas' using errcode = '42501';
  end if;

  -- pg_cron pode não estar acessível: a seção mostra "indisponível" nessa parte.
  begin
    select coalesce(json_agg(json_build_object(
        'nome', j.jobname,
        'agenda', j.schedule,
        'ativa', j.active,
        'execucoes', (
          select coalesce(json_agg(json_build_object(
              'inicio', d.start_time,
              'fim', d.end_time,
              'situacao', d.status,
              'mensagem', left(d.return_message, 500)
            ) order by d.start_time desc), '[]'::json)
            from (select * from cron.job_run_details r
                   where r.jobid = j.jobid
                   order by r.start_time desc limit 10) d
        )
      ) order by j.jobname), '[]'::json)
      into v_tarefas
      from cron.job j
     where left(j.jobname, 6) = 'agsus_';
  exception when others then
    v_tarefas := null;
  end;

  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'analises', (
      select coalesce(json_agg(json_build_object(
          'origem', o."CO_ORIGEM",
          'area', p."CO_AREA",
          'planilha', p."NO_PLANILHA",
          'tipo', o."TP_CARGA",
          'execucoes', (
            select coalesce(json_agg(json_build_object(
                'inicio', x.j ->> 'started_at',
                'fim', x.j ->> 'finished_at',
                'situacao', x.j ->> 'status',
                'linhas', coalesce(x.j ->> 'total_processados', x.j ->> 'total_lidos', x.j ->> 'linhas_staging'),
                'mensagem', left(coalesce(x.j ->> 'erro', x.j ->> 'mensagem'), 500),
                -- [nao-trava] encerrada por inatividade (20261007170000)
                'encerrada_por_inatividade', coalesce((x.j -> 'resultado' ->> 'encerrada_por_inatividade')::boolean, false)
              ) order by x.inicio desc nulls last), '[]'::json)
              from (select to_jsonb(s) as j, s.started_at as inicio
                      from public."TL_SYNC_ANALISE" s
                     where s.origem = o."CO_ORIGEM"
                     order by s.started_at desc nulls last
                     limit 10) x
          )
        ) order by p."CO_AREA", o."TP_CARGA" desc), '[]'::json)
        from public."TA_ORIGEM_ANALISE" o
        join public."TB_PLANILHA_ANALISE" p on p."CO_PLANILHA" = o."CO_PLANILHA"
    ),
    'entrevistas', (
      select coalesce(json_agg(json_build_object(
          'inicio', e."DT_INICIO",
          'fim', e."DT_FIM",
          'situacao', e."TP_SITUACAO",
          'linhas', e."QT_LINHA",
          'mensagem', e."DS_MENSAGEM",
          'area', e."CO_AREA"
        ) order by e."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_SYNC_ENTREVISTA" t order by t."DT_INICIO" desc limit 10) e
    ),
    'selecao', (
      select coalesce(json_agg(json_build_object(
          'inicio', e."DT_INICIO",
          'fim', e."DT_FIM",
          'situacao', e."TP_SITUACAO",
          'linhas', e."QT_LINHA",
          'mensagem', e."DS_MENSAGEM"
        ) order by e."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_SYNC_SELECAO" t order by t."DT_INICIO" desc limit 10) e
    ),
    'empregare', (
      select coalesce(json_agg(json_build_object(
          'inicio', e."DT_INICIO",
          'fim', e."DT_FIM",
          'situacao', e."TP_SITUACAO",
          'linhas', e."QT_LINHA",
          'mensagem', e."DS_MENSAGEM",
          'disparo', e."TP_DISPARO",
          'vagas_pedidas', e."QT_VAGA_PEDIDA",
          'vagas_baixadas', e."QT_VAGA_BAIXADA",
          'vagas_falha', e."QT_VAGA_FALHA",
          'vagas_recusadas', e."QT_VAGA_RECUSADA",
          'desativadas', e."QT_DESATIVADA",
          'execucao', e."DS_URL_EXECUCAO"
        ) order by e."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_SYNC_EMPREGARE" t order by t."DT_INICIO" desc limit 10) e
    ),
    'conferencias', (
      select coalesce(json_agg(json_build_object(
          'inicio', c."DT_INICIO",
          'fim', c."DT_FIM",
          'situacao', c."TP_SITUACAO",
          'linhas', c."QT_AVISO_ABERTO",
          'mensagem', c."DS_MENSAGEM",
          'disparo', c."TP_DISPARO",
          'novos', c."QT_AVISO_NOVO",
          'abertos', c."QT_AVISO_ABERTO",
          'resolvidos', c."QT_AVISO_RESOLVIDO",
          'falhas', c."DS_FALHA",
          'execucao', c."DS_URL_EXECUCAO"
        ) order by c."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_CONFERENCIA" t order by t."DT_INICIO" desc limit 10) c
    ),
    'pre_classificacao', (
      select coalesce(json_agg(json_build_object(
          'inicio', p."DT_INICIO",
          'fim', p."DT_FIM",
          'situacao', p."TP_SITUACAO",
          'linhas', p."QT_INSCRITO",
          'mensagem', p."DS_MENSAGEM",
          'disparo', p."TP_DISPARO",
          'editais', p."QT_EDITAL",
          'vagas', p."QT_VAGA",
          'lote', p."QT_LOTE",
          'refazer', p."ST_REFAZER_LOTE" = 'S',
          'execucao', p."DS_URL_EXECUCAO"
        ) order by p."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_PRE_CLASSIFICACAO" t order by t."DT_INICIO" desc limit 10) p
    ),
    'tarefas', v_tarefas
  );
end;
$function$;
comment on function public.get_saude_das_cargas() is
  'Saúde das cargas (Configurações, só administrador global): as últimas 10 execuções de cada carga das análises (por origem, com encerrada_por_inatividade — 20261007170000), das entrevistas, da seleção, do robô da Empregare (com vagas pedidas/baixadas/falhas/recusadas e quem disparou), das conferências de consistência (avisos novos, abertos e resolvidos), da pré-classificação da Avaliação documental (editais, vagas, inscritos e lote) e das tarefas agsus_* do pg_cron (nulas sem acesso ao pg_cron). Só leitura.';

notify pgrst, 'reload schema';

-- ═══ CORPO DA MIGRATION (fim) ═══

create temp table ensaio_sync (nome text primary key, sync uuid not null default gen_random_uuid()) on commit drop;
insert into ensaio_sync (nome) values ('si_velha'), ('si_nova'), ('si_outra'), ('si_full'), ('sede_parada'), ('sede_com_staging'), ('projetos_comparando');

-- E1. Objetos e permissões.
do $$
begin
  if to_regprocedure('public."FC_ENCERRAR_SYNC_ANALISE_INATIVO"(text, integer)') is null then
    raise exception 'FALHOU E1: função de encerramento';
  end if;
  if has_function_privilege('authenticated', 'public."FC_ENCERRAR_SYNC_ANALISE_INATIVO"(text, integer)', 'execute')
     or has_function_privilege('anon', 'public."FC_ENCERRAR_SYNC_ANALISE_INATIVO"(text, integer)', 'execute')
     or not has_function_privilege('service_role', 'public."FC_ENCERRAR_SYNC_ANALISE_INATIVO"(text, integer)', 'execute') then
    raise exception 'FALHOU E1: execução só do service_role';
  end if;
  if position('FC_ENCERRAR_SYNC_ANALISE_INATIVO' in pg_get_functiondef('public.iniciar_sync_analises_incremental(uuid, text)'::regprocedure)) = 0
     or position('FC_ENCERRAR_SYNC_ANALISE_INATIVO' in pg_get_functiondef('public.analises_sync_guard_before_insert()'::regprocedure)) = 0
     or position('updated_at = now()' in pg_get_functiondef('public.comparar_analises_incremental_v2(uuid, jsonb, boolean)'::regprocedure)) = 0
     or position('encerrada_por_inatividade' in pg_get_functiondef('public.get_saude_das_cargas()'::regprocedure)) = 0 then
    raise exception 'FALHOU E1: iniciar, gatilho, comparar ou get_saude_das_cargas sem a regra';
  end if;
  if to_regclass('cron.job') is not null
     and not exists (select 1 from cron.job where jobname = 'agsus_analises_encerrar_inativas'
                      and schedule = '*/10 * * * *' and command like '%FC_ENCERRAR_SYNC_ANALISE_INATIVO%') then
    raise exception 'FALHOU E1: tarefa agsus_analises_encerrar_inativas';
  end if;
  raise notice 'ok E1: função só do service_role, iniciar/gatilho/comparar com a regra, tarefa a cada 10 min, Status com encerrada_por_inatividade';
end;
$$;

-- E2. O incidente: 'carregado' parada há 16 h; a nova execução começa.
do $$
declare
  v_velha uuid := (select sync from ensaio_sync where nome = 'si_velha');
  v_nova uuid := (select sync from ensaio_sync where nome = 'si_nova');
  v_r jsonb;
  v_l public."TL_SYNC_ANALISE"%rowtype;
begin
  insert into public."TL_SYNC_ANALISE" (sync_id, origem, modo, status, linhas_staging, started_at, created_at, updated_at, resultado)
  values (v_velha, 'apps_script_analises_incremental_v1', 'INCREMENTAL_ACTIVE', 'carregado', 0,
          now() - interval '16 hours', now() - interval '16 hours', now() - interval '16 hours',
          jsonb_build_object('modo_processamento', 'incremental', 'incremental_preparado', false, 'planilha', 'saude-indigena'));

  v_r := public.iniciar_sync_analises_incremental(v_nova, 'apps_script_analises_incremental_v1');
  if (v_r->>'ok')::boolean is not true or (v_r->>'existing')::boolean or (v_r->>'sync_id')::uuid <> v_nova
     or (v_r->>'encerradas_por_inatividade')::integer <> 1 then
    raise exception 'FALHOU E2: iniciar devolveu %', v_r;
  end if;

  select * into v_l from public."TL_SYNC_ANALISE" where sync_id = v_velha;
  if v_l.status <> 'erro' or v_l.finished_at is null
     or v_l.erro not like 'Execução encerrada por inatividade: sem progresso desde %'
     or (v_l.resultado->>'encerrada_por_inatividade')::boolean is not true
     or v_l.resultado->>'previous_status' <> 'carregado' then
    raise exception 'FALHOU E2: a velha ficou % / % / %', v_l.status, v_l.erro, v_l.resultado;
  end if;
  if (select status from public."TL_SYNC_ANALISE" where sync_id = v_nova) <> 'carregado' then
    raise exception 'FALHOU E2: a nova não começou';
  end if;
  raise notice 'ok E2: velha encerrada (%), nova começou', v_l.erro;
end;
$$;

-- E3. O lock por planilha continua: duas execuções ao mesmo tempo, não.
do $$
declare
  v_recusou boolean := false;
begin
  begin
    perform public.iniciar_sync_analises_incremental((select sync from ensaio_sync where nome = 'si_outra'), 'apps_script_analises_incremental_v1');
  exception when others then
    v_recusou := sqlerrm like 'Existe outro sync de Analises pendente para a planilha saude-indigena%';
    if not v_recusou then raise exception 'FALHOU E3: recusa inesperada: %', sqlerrm; end if;
  end;
  if not v_recusou then raise exception 'FALHOU E3: segundo iniciar aceito com a nova ativa'; end if;
  if exists (select 1 from public."TL_SYNC_ANALISE" where sync_id = (select sync from ensaio_sync where nome = 'si_outra')) then
    raise exception 'FALHOU E3: o segundo iniciar gravou log';
  end if;

  v_recusou := false;
  begin
    insert into public."TL_SYNC_ANALISE" (sync_id, origem, modo, status, linhas_staging, started_at)
    values ((select sync from ensaio_sync where nome = 'si_full'), 'apps_script_analises_curriculares_v2_pdf', 'FULL', 'carregado', 0, now());
  exception when sqlstate '55P03' then
    v_recusou := true;
  end;
  if not v_recusou then raise exception 'FALHOU E3: insert do FULL aceito com a incremental ativa'; end if;
  raise notice 'ok E3: segundo iniciar recusado; FULL recusado com 55P03';
end;
$$;

-- E4. A varredura de todas as planilhas.
do $$
declare
  v_parada uuid := (select sync from ensaio_sync where nome = 'sede_parada');
  v_staging uuid := (select sync from ensaio_sync where nome = 'sede_com_staging');
  v_comparando uuid := (select sync from ensaio_sync where nome = 'projetos_comparando');
  v_r jsonb;
  v_antes integer;
begin
  -- SEDE parada há 2 h, com staging de 2 h atrás: sai.
  insert into public."TL_SYNC_ANALISE" (sync_id, origem, modo, status, linhas_staging, started_at, created_at, updated_at)
  values (v_parada, 'apps_script_analises_sede_incremental_v1', 'INCREMENTAL_ACTIVE', 'carregado', 0,
          now() - interval '2 hours', now() - interval '2 hours', now() - interval '2 hours');
  insert into public."TM_ANALISE_CURRICULAR" (sync_id, entidade, linha_origem, payload, hash_registro, created_at)
  values (v_parada, 'FATO_ANALISES', 2, '{"ensaio": true}'::jsonb, 'ENSAIO', now() - interval '2 hours');
  select count(*) into v_antes from public."TM_ANALISE_CURRICULAR" where sync_id = v_parada;

  -- Projetos parada há 2 h no log, mas volta a comparar: fica.
  insert into public."TL_SYNC_ANALISE" (sync_id, origem, modo, status, linhas_staging, started_at, created_at, updated_at)
  values (v_comparando, 'apps_script_analises_projetos_incremental_v1', 'INCREMENTAL_ACTIVE', 'carregado', 0,
          now() - interval '2 hours', now() - interval '2 hours', now() - interval '2 hours');
  perform public.comparar_analises_incremental_v2(v_comparando,
    '[{"linha_origem": 2, "chave_natural": "ENSAIO|x|y|z|1|Fulano", "hash_registro": "ENSAIO"}]'::jsonb, true);
  if (select updated_at from public."TL_SYNC_ANALISE" where sync_id = v_comparando) < now() - interval '1 minute' then
    raise exception 'FALHOU E4: comparar não marcou o sinal de vida';
  end if;

  v_r := public."FC_ENCERRAR_SYNC_ANALISE_INATIVO"(null, 30);
  if (v_r->>'encerradas')::integer <> 1 or (v_r->'execucoes'->0->>'sync_id')::uuid <> v_parada then
    raise exception 'FALHOU E4: varredura devolveu %', v_r;
  end if;
  if (select status from public."TL_SYNC_ANALISE" where sync_id = v_parada) <> 'erro'
     or (select status from public."TL_SYNC_ANALISE" where sync_id = v_comparando) <> 'carregado'
     or (select status from public."TL_SYNC_ANALISE" where sync_id = (select sync from ensaio_sync where nome = 'si_nova')) <> 'carregado' then
    raise exception 'FALHOU E4: status depois da varredura';
  end if;
  if (select count(*) from public."TM_ANALISE_CURRICULAR" where sync_id = v_parada) <> v_antes then
    raise exception 'FALHOU E4: a varredura apagou staging';
  end if;

  -- SEDE parada há 2 h no log, mas com staging de 5 min atrás: fica.
  insert into public."TL_SYNC_ANALISE" (sync_id, origem, modo, status, linhas_staging, started_at, created_at, updated_at)
  values (v_staging, 'apps_script_analises_sede_incremental_v1', 'INCREMENTAL_ACTIVE', 'carregado', 0,
          now() - interval '2 hours', now() - interval '2 hours', now() - interval '2 hours');
  insert into public."TM_ANALISE_CURRICULAR" (sync_id, entidade, linha_origem, payload, hash_registro, created_at)
  values (v_staging, 'FATO_ANALISES', 2, '{"ensaio": true}'::jsonb, 'ENSAIO', now() - interval '5 minutes');
  v_r := public."FC_ENCERRAR_SYNC_ANALISE_INATIVO"(null, 30);
  if (v_r->>'encerradas')::integer <> 0 then
    raise exception 'FALHOU E4: fechou execução com staging recente: %', v_r;
  end if;

  begin
    perform public."FC_ENCERRAR_SYNC_ANALISE_INATIVO"(null, 10);
    raise exception 'FALHOU E4: aceitou limite menor que 30 min';
  exception when sqlstate '22023' then null;
  end;
  raise notice 'ok E4: varredura fechou só a parada (staging mantido); staging recente e comparação seguram a execução';
end;
$$;

select
  'ENSAIO OK' as resultado,
  (select l.erro from public."TL_SYNC_ANALISE" l where l.sync_id = (select sync from ensaio_sync where nome = 'si_velha')) as velha,
  (select l.status from public."TL_SYNC_ANALISE" l where l.sync_id = (select sync from ensaio_sync where nome = 'si_nova')) as nova;

rollback;
