/*
  ENSAIO de 20261008140000_agenda_dos_robos_pelo_banco.sql — begin … rollback.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, aplica o corpo da migration (sem o
  begin/commit dela) e confere:
    E1  ninguém além do dono executa FC_DISPARAR_ROBO e FC_CONFERIR_DISPAROS_ROBO
        nem lê TL_DISPARO_ROBO (anon, authenticated, service_role); RLS ligada;
        SECURITY DEFINER; as 5 tarefas agsus_robo_* agendadas;
    E2  SEM DISPARAR HTTP: a função procura, só nesta transação, um segredo de
        nome alternativo que não existe (set_config agsus.segredo_disparo_robos;
        a chave de verdade não é lida nem muda) → SEM_TOKEN, sem erro e sem pedido
        na fila do pg_net; workflow fora da lista, input que o workflow não tem e
        input que não é texto → 22023;
    E3  respostas falsas em net._http_response: 204 → ACEITO; 401 → FALHOU com
        "GitHub 401: Bad credentials"; pedido sem resposta há 2 h → FALHOU;
        linha de 31 dias sai;
    E4  como um administrador global de verdade (sem mostrar quem):
        get_saude_das_cargas traz 'agenda_dos_robos' e as tarefas agsus_robo_*.
  Termina em ROLLBACK (a extensão pg_net criada aqui também é desfeita).
*/
begin;

-- Corpo de supabase/migrations/20261008140000_agenda_dos_robos_pelo_banco.sql (sem begin/commit):

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regclass('cron.job') is null then
    raise exception 'O pg_cron precisa estar ligado (Database → Extensions → pg_cron).';
  end if;
  if to_regclass('vault.decrypted_secrets') is null then
    raise exception 'O Supabase Vault precisa estar ligado (extensão supabase_vault).';
  end if;
  if to_regclass('public."TL_EXPURGO_ANEXO_CHAT"') is null then
    raise exception 'Aplique antes 20261007250000_expurgo_diario_dos_anexos_do_chat.sql.';
  end if;
end;
$$;

-- 1. pg_net -------------------------------------------------------------------------------
create extension if not exists pg_net with schema extensions;

-- 2. Registro dos disparos ------------------------------------------------------------------
create table public."TL_DISPARO_ROBO" (
  "CO_DISPARO" bigint generated always as identity,
  "NO_WORKFLOW" text not null,
  "DT_DISPARO" timestamptz not null default now(),
  "CO_PEDIDO_HTTP" bigint,
  "TP_SITUACAO" text not null,
  "NU_STATUS_HTTP" integer,
  "DT_RESPOSTA" timestamptz,
  "DS_MENSAGEM" text,
  constraint "PK_TL_DISPARO_ROBO" primary key ("CO_DISPARO"),
  constraint "CK_DISPROBO_NOWORKFLOW" check ("NO_WORKFLOW" in (
    'sincronizar-entrevistas.yml', 'sincronizar-selecao.yml', 'conferencias.yml',
    'expurgo-anexos-chat.yml', 'robo-empregare.yml', 'pre-classificacao.yml')),
  constraint "CK_DISPROBO_TPSITUACAO" check ("TP_SITUACAO" in ('PEDIDO', 'ACEITO', 'FALHOU', 'SEM_TOKEN')),
  constraint "CK_DISPROBO_PEDIDO" check (
    ("TP_SITUACAO" = 'SEM_TOKEN' and "CO_PEDIDO_HTTP" is null)
    or ("TP_SITUACAO" in ('PEDIDO', 'ACEITO') and "CO_PEDIDO_HTTP" is not null)
    or "TP_SITUACAO" = 'FALHOU'),
  constraint "CK_DISPROBO_NUSTATUS" check ("NU_STATUS_HTTP" is null or "NU_STATUS_HTTP" between 100 and 599),
  constraint "CK_DISPROBO_DSMENSAGEM" check (coalesce(length("DS_MENSAGEM"), 0) <= 300)
);
comment on table public."TL_DISPARO_ROBO" is
  'Pedidos de execução dos robôs (workflow_dispatch do GitHub) feitos pelo banco na hora da agenda (pg_cron → FC_DISPARAR_ROBO, 20261008140000). Uma linha por pedido; nunca guarda a chave. Fechada por FC_CONFERIR_DISPAROS_ROBO (net._http_response); linhas com mais de 30 dias saem. Leitura só por get_saude_das_cargas.';
comment on column public."TL_DISPARO_ROBO"."CO_DISPARO" is 'Identificador do pedido (sequencial).';
comment on column public."TL_DISPARO_ROBO"."NO_WORKFLOW" is 'Arquivo do workflow pedido (lista fixa: os 6 robôs de ROBOS_DE_CARGA).';
comment on column public."TL_DISPARO_ROBO"."DT_DISPARO" is 'Quando o banco fez o pedido.';
comment on column public."TL_DISPARO_ROBO"."CO_PEDIDO_HTTP" is 'Id do pedido no pg_net (net._http_response.id); nulo em SEM_TOKEN.';
comment on column public."TL_DISPARO_ROBO"."TP_SITUACAO" is 'PEDIDO (aguardando a resposta), ACEITO (o GitHub respondeu 2xx — 204), FALHOU (outro código, tempo esgotado ou sem resposta) ou SEM_TOKEN (sem a chave github_disparo_robos no Vault; nada foi pedido).';
comment on column public."TL_DISPARO_ROBO"."NU_STATUS_HTTP" is 'Código HTTP da resposta do GitHub (204 = aceito; 401 = chave inválida ou expirada; 403/404 = chave sem permissão no repositório; 422 = input recusado).';
comment on column public."TL_DISPARO_ROBO"."DT_RESPOSTA" is 'Quando a resposta chegou (ou quando o pedido foi dado como sem resposta).';
comment on column public."TL_DISPARO_ROBO"."DS_MENSAGEM" is 'Motivo curto da falha (a mensagem do GitHub, "tempo esgotado"…); nunca a chave.';
comment on constraint "PK_TL_DISPARO_ROBO" on public."TL_DISPARO_ROBO" is 'Uma linha por pedido.';
comment on constraint "CK_DISPROBO_NOWORKFLOW" on public."TL_DISPARO_ROBO" is 'Só os workflows da lista fixa.';
comment on constraint "CK_DISPROBO_TPSITUACAO" on public."TL_DISPARO_ROBO" is 'Situações válidas.';
comment on constraint "CK_DISPROBO_PEDIDO" on public."TL_DISPARO_ROBO" is 'SEM_TOKEN não tem pedido no pg_net; PEDIDO e ACEITO sempre têm.';
comment on constraint "CK_DISPROBO_NUSTATUS" on public."TL_DISPARO_ROBO" is 'Código HTTP entre 100 e 599.';
comment on constraint "CK_DISPROBO_DSMENSAGEM" on public."TL_DISPARO_ROBO" is 'Mensagem até 300 caracteres.';

create index "IN_DISPROBO_DTDISPARO" on public."TL_DISPARO_ROBO" ("DT_DISPARO" desc);
comment on index public."IN_DISPROBO_DTDISPARO" is 'Os últimos disparos primeiro (Status das atualizações) e a limpeza de 30 dias.';
create index "IN_DISPROBO_PEDIDO_ABERTO" on public."TL_DISPARO_ROBO" ("CO_PEDIDO_HTTP") where "TP_SITUACAO" = 'PEDIDO';
comment on index public."IN_DISPROBO_PEDIDO_ABERTO" is 'Pedidos ainda sem resposta (FC_CONFERIR_DISPAROS_ROBO).';

alter table public."TL_DISPARO_ROBO" enable row level security;
revoke all on public."TL_DISPARO_ROBO" from public, anon, authenticated, service_role;

-- 3. O disparo ------------------------------------------------------------------------------
create function private."FC_DISPARAR_ROBO"(p_workflow text, p_inputs jsonb default '{}'::jsonb)
returns bigint
language plpgsql
volatile
security definer
set search_path to ''
as $function$
declare
  -- Lista fixa: workflow → inputs que ele aceita (além de disparado_por, sempre AGENDA).
  c_aceitos constant jsonb := jsonb_build_object(
    'sincronizar-entrevistas.yml', jsonb_build_array('modo'),
    'sincronizar-selecao.yml', jsonb_build_array('modo'),
    'conferencias.yml', jsonb_build_array('modo'),
    'expurgo-anexos-chat.yml', jsonb_build_array('modo'),
    'robo-empregare.yml', jsonb_build_array('modo', 'editais', 'vagas', 'limite'),
    'pre-classificacao.yml', jsonb_build_array('modo', 'editais'));
  v_inputs jsonb := coalesce(p_inputs, '{}'::jsonb);
  v_chave text;
  v_pedido bigint;
  v_disparo bigint;
begin
  if p_workflow is null or not (c_aceitos ? p_workflow) then
    raise exception 'Workflow fora da lista fixa dos robôs' using errcode = '22023';
  end if;
  if jsonb_typeof(v_inputs) <> 'object'
     or exists (
       select 1 from jsonb_each(v_inputs) i
        where not ((c_aceitos -> p_workflow) ? i.key)
           or jsonb_typeof(i.value) <> 'string'
           or length(i.value #>> '{}') > 200) then
    raise exception 'Inputs inválidos para %', p_workflow using errcode = '22023';
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
    insert into public."TL_DISPARO_ROBO" ("NO_WORKFLOW", "TP_SITUACAO", "DS_MENSAGEM")
    values (p_workflow, 'SEM_TOKEN', 'Sem a chave github_disparo_robos no Vault.')
    returning "CO_DISPARO" into v_disparo;
    return v_disparo;
  end if;

  begin
    v_pedido := net.http_post(
      url := 'https://api.github.com/repos/AgSUS-COGIP/agsus-monitora/actions/workflows/' || p_workflow || '/dispatches',
      body := jsonb_build_object(
        'ref', 'main',
        'inputs', v_inputs || jsonb_build_object('disparado_por', 'AGENDA')),
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
    insert into public."TL_DISPARO_ROBO" ("NO_WORKFLOW", "TP_SITUACAO", "DT_RESPOSTA", "DS_MENSAGEM")
    values (p_workflow, 'FALHOU', now(), 'O pg_net recusou o pedido (' || sqlstate || ').')
    returning "CO_DISPARO" into v_disparo;
    return v_disparo;
  end;
  v_chave := null;

  insert into public."TL_DISPARO_ROBO" ("NO_WORKFLOW", "CO_PEDIDO_HTTP", "TP_SITUACAO")
  values (p_workflow, v_pedido, 'PEDIDO')
  returning "CO_DISPARO" into v_disparo;
  return v_disparo;
end;
$function$;
comment on function private."FC_DISPARAR_ROBO"(text, jsonb) is
  'Agenda dos robôs (20261008140000): pede ao GitHub (workflow_dispatch, ramo main, disparado_por = AGENDA) a execução de um workflow da lista fixa, com os inputs que ele aceita (texto até 200). Lê a chave github_disparo_robos do Vault na hora e só a entrega ao pg_net; sem a chave, registra SEM_TOKEN e sai sem erro. Grava o pedido em TL_DISPARO_ROBO e devolve o CO_DISPARO. 22023 para workflow fora da lista ou input recusado. Só o dono (pg_cron).';
revoke all on function private."FC_DISPARAR_ROBO"(text, jsonb) from public, anon, authenticated, service_role;

-- 4. A conferência das respostas -------------------------------------------------------------
create function private."FC_CONFERIR_DISPAROS_ROBO"()
returns integer
language plpgsql
volatile
security definer
set search_path to ''
as $function$
declare
  v_fechados integer := 0;
  v_sem_resposta integer := 0;
begin
  update public."TL_DISPARO_ROBO" d
     set "TP_SITUACAO" = case
           when r.status_code between 200 and 299 and not coalesce(r.timed_out, false) then 'ACEITO'
           else 'FALHOU' end,
         "NU_STATUS_HTTP" = case when r.status_code between 100 and 599 then r.status_code end,
         "DT_RESPOSTA" = coalesce(r.created, now()),
         "DS_MENSAGEM" = case
           when r.status_code between 200 and 299 and not coalesce(r.timed_out, false) then null
           when coalesce(r.timed_out, false) then 'Tempo esgotado esperando o GitHub.'
           when r.error_msg is not null then left('Erro de rede: ' || r.error_msg, 300)
           else left(coalesce(
             'GitHub ' || r.status_code || ': '
               || substring(r.content from '"message"\s*:\s*"([^"]{1,200})"'),
             'GitHub ' || coalesce(r.status_code::text, '?')), 300) end
    from net._http_response r
   where r.id = d."CO_PEDIDO_HTTP"
     and d."TP_SITUACAO" = 'PEDIDO';
  get diagnostics v_fechados = row_count;

  -- A resposta não veio (ou já saiu da tabela do pg_net): falha, para a tela avisar.
  update public."TL_DISPARO_ROBO" d
     set "TP_SITUACAO" = 'FALHOU',
         "DT_RESPOSTA" = now(),
         "DS_MENSAGEM" = 'Sem resposta do GitHub em 1 h.'
   where d."TP_SITUACAO" = 'PEDIDO'
     and d."DT_DISPARO" < now() - interval '1 hour';
  get diagnostics v_sem_resposta = row_count;

  delete from public."TL_DISPARO_ROBO" d
   where d."DT_DISPARO" < now() - interval '30 days';

  return v_fechados + v_sem_resposta;
end;
$function$;
comment on function private."FC_CONFERIR_DISPAROS_ROBO"() is
  'Agenda dos robôs (20261008140000): fecha os pedidos de TL_DISPARO_ROBO pela resposta em net._http_response (2xx = ACEITO — o GitHub responde 204; outro código ou tempo esgotado = FALHOU, com a mensagem curta do GitHub), dá como FALHOU o pedido sem resposta há mais de 1 h e apaga as linhas com mais de 30 dias. Devolve quantos fechou. Só o dono (pg_cron, a cada 5 min).';
revoke all on function private."FC_CONFERIR_DISPAROS_ROBO"() from public, anon, authenticated, service_role;

-- 5. A agenda (pg_cron, horário UTC = Brasília + 3 h) -----------------------------------------
-- PARA MUDAR UM HORÁRIO: troque a agenda na linha abaixo e rode só este bloco (ele cria ou
-- atualiza pelo nome), ou, direto no SQL Editor:
--   select cron.alter_job((select jobid from cron.job where jobname = 'agsus_robo_sincronizar_selecao'),
--                         schedule => '10 11,16,21 * * *');
-- Guia: docs/agenda-dos-robos.md.
--
--   tarefa                               agenda (UTC)        Brasília
--   agsus_robo_sincronizar_entrevistas   5 * * * *           de hora em hora, aos :05
--   agsus_robo_sincronizar_selecao       10 11,16,21 * * *   8h10, 13h10 e 18h10
--   agsus_robo_conferencias              0 9 * * *           6h
--   agsus_robo_expurgo_anexos_chat       30 9 * * *          6h30
--   agsus_robo_conferir_disparos         a cada 5 min        fecha os pedidos (lê as respostas)
do $$
declare
  v_agenda constant jsonb := jsonb_build_array(
    jsonb_build_array('agsus_robo_sincronizar_entrevistas', '5 * * * *',
      'select private."FC_DISPARAR_ROBO"(''sincronizar-entrevistas.yml'', ''{"modo": "normal"}'');'),
    jsonb_build_array('agsus_robo_sincronizar_selecao', '10 11,16,21 * * *',
      'select private."FC_DISPARAR_ROBO"(''sincronizar-selecao.yml'', ''{"modo": "normal"}'');'),
    jsonb_build_array('agsus_robo_conferencias', '0 9 * * *',
      'select private."FC_DISPARAR_ROBO"(''conferencias.yml'', ''{"modo": "normal"}'');'),
    jsonb_build_array('agsus_robo_expurgo_anexos_chat', '30 9 * * *',
      'select private."FC_DISPARAR_ROBO"(''expurgo-anexos-chat.yml'', ''{"modo": "normal"}'');'),
    jsonb_build_array('agsus_robo_conferir_disparos', '*/5 * * * *',
      'select private."FC_CONFERIR_DISPAROS_ROBO"();'));
  v_tarefa jsonb;
  v_id bigint;
begin
  for v_tarefa in select * from jsonb_array_elements(v_agenda) loop
    select jobid into v_id from cron.job where jobname = v_tarefa ->> 0;
    if v_id is null then
      perform cron.schedule(v_tarefa ->> 0, v_tarefa ->> 1, v_tarefa ->> 2);
    else
      perform cron.alter_job(v_id, schedule => v_tarefa ->> 1, command => v_tarefa ->> 2);
    end if;
  end loop;
end;
$$;

-- 6. Status das atualizações: a agenda dos robôs ---------------------------------------------
CREATE OR REPLACE FUNCTION public.get_saude_das_cargas()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_tarefas json;
  v_chave_cadastrada boolean;
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

  -- [agenda-dos-robos] só se a chave existe (nunca o valor); null se o Vault não deixar ver.
  begin
    select exists (select 1 from vault.secrets s where s.name = 'github_disparo_robos')
      into v_chave_cadastrada;
  exception when others then
    v_chave_cadastrada := null;
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
    -- [expurgo-diario] o job diário do expurgo dos anexos do chat (20261007250000)
    'expurgo_chat', (
      select coalesce(json_agg(json_build_object(
          'inicio', x."DT_INICIO",
          'fim', x."DT_FIM",
          'situacao', x."TP_SITUACAO",
          'linhas', x."QT_CONFIRMADO",
          'mensagem', x."DS_MENSAGEM",
          'disparo', x."TP_DISPARO",
          'lotes', x."QT_LOTE",
          'removidos', x."QT_REMOVIDO",
          'confirmados', x."QT_CONFIRMADO",
          'falhas', x."QT_FALHA",
          'pendentes', x."QT_PENDENTE",
          'execucao', x."DS_URL_EXECUCAO"
        ) order by x."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_EXPURGO_ANEXO_CHAT" t order by t."DT_INICIO" desc limit 10) x
    ),
    -- [agenda-dos-robos] os pedidos do banco ao GitHub (20261008140000)
    'agenda_dos_robos', json_build_object(
      'chave_cadastrada', v_chave_cadastrada,
      'ultimo_aceito', (select max(d."DT_DISPARO") from public."TL_DISPARO_ROBO" d where d."TP_SITUACAO" = 'ACEITO'),
      'falhas_24h', (select count(*) from public."TL_DISPARO_ROBO" d
                      where d."TP_SITUACAO" = 'FALHOU' and d."DT_DISPARO" > now() - interval '24 hours'),
      'sem_chave_24h', (select count(*) from public."TL_DISPARO_ROBO" d
                         where d."TP_SITUACAO" = 'SEM_TOKEN' and d."DT_DISPARO" > now() - interval '24 hours'),
      'disparos', (
        select coalesce(json_agg(json_build_object(
            'workflow', x."NO_WORKFLOW",
            'inicio', x."DT_DISPARO",
            'fim', x."DT_RESPOSTA",
            'situacao', x."TP_SITUACAO",
            'http', x."NU_STATUS_HTTP",
            'mensagem', x."DS_MENSAGEM"
          ) order by x."DT_DISPARO" desc, x."CO_DISPARO" desc), '[]'::json)
          from (select * from public."TL_DISPARO_ROBO" t
                 order by t."DT_DISPARO" desc, t."CO_DISPARO" desc limit 20) x
      )
    ),
    'tarefas', v_tarefas
  );
end;
$function$;
comment on function public.get_saude_das_cargas() is
  'Saúde das cargas (Configurações, só administrador global): as últimas 10 execuções de cada carga das análises (por origem, com encerrada_por_inatividade — 20261007170000), das entrevistas, da seleção, do robô da Empregare (com vagas pedidas/baixadas/falhas/recusadas e quem disparou), das conferências de consistência (avisos novos, abertos e resolvidos), da pré-classificação da Avaliação documental (editais, vagas, inscritos e lote), do expurgo diário dos anexos do chat (lotes, removidos, confirmados, falhas e pendentes — 20261007250000) da agenda dos robôs pelo banco (chave cadastrada, último disparo aceito, falhas e sem chave em 24 h, os 20 últimos pedidos — 20261008140000) e das tarefas agsus_* do pg_cron (nulas sem acesso ao pg_cron). Só leitura.';

-- E1 Permissões e agenda ----------------------------------------------------------------------
do $$
declare
  v_papel text;
begin
  foreach v_papel in array array['anon', 'authenticated', 'service_role'] loop
    if has_function_privilege(v_papel, 'private."FC_DISPARAR_ROBO"(text, jsonb)', 'execute')
       or has_function_privilege(v_papel, 'private."FC_CONFERIR_DISPAROS_ROBO"()', 'execute')
       or has_table_privilege(v_papel, 'public."TL_DISPARO_ROBO"', 'select')
       or has_table_privilege(v_papel, 'public."TL_DISPARO_ROBO"', 'insert') then
      raise exception 'FALHOU E1: % tem acesso', v_papel;
    end if;
  end loop;
  if not (select relrowsecurity from pg_class where oid = 'public."TL_DISPARO_ROBO"'::regclass) then
    raise exception 'FALHOU E1: RLS desligada';
  end if;
  if not (select prosecdef from pg_proc where oid = 'private."FC_DISPARAR_ROBO"(text, jsonb)'::regprocedure) then
    raise exception 'FALHOU E1: FC_DISPARAR_ROBO não é SECURITY DEFINER';
  end if;
  if (select count(*) from cron.job where jobname like 'agsus\_robo\_%') <> 5 then
    raise exception 'FALHOU E1: esperava 5 tarefas agsus_robo_*';
  end if;
  raise notice 'ok E1';
end;
$$;

-- E2 Sem a chave: SEM_TOKEN, sem erro e sem HTTP; lista fixa ------------------------------------
do $$
declare
  v_id bigint;
  v_antes bigint;
begin
  -- Trava de segurança: o ensaio nunca lê a chave nem dispara HTTP. A chave já está no Vault;
  -- a função procura, só nesta transação, um nome que não existe (o Vault não muda).
  perform set_config('agsus.segredo_disparo_robos', 'github_disparo_robos_ausente_no_ensaio', true);
  if exists (select 1 from vault.secrets where name = 'github_disparo_robos_ausente_no_ensaio') then
    raise exception 'ENSAIO INTERROMPIDO: o nome alternativo existe no Vault.';
  end if;
  select count(*) into v_antes from net.http_request_queue;
  v_id := private."FC_DISPARAR_ROBO"('conferencias.yml', '{"modo": "normal"}');
  if (select "TP_SITUACAO" from public."TL_DISPARO_ROBO" where "CO_DISPARO" = v_id) <> 'SEM_TOKEN'
     or (select "CO_PEDIDO_HTTP" from public."TL_DISPARO_ROBO" where "CO_DISPARO" = v_id) is not null then
    raise exception 'FALHOU E2: esperava SEM_TOKEN sem pedido';
  end if;
  if (select count(*) from net.http_request_queue) <> v_antes then
    raise exception 'FALHOU E2: entrou pedido na fila do pg_net';
  end if;
  begin
    perform private."FC_DISPARAR_ROBO"('deploy.yml', '{}');
    raise exception 'FALHOU E2: aceitou workflow fora da lista';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform private."FC_DISPARAR_ROBO"('conferencias.yml', '{"editais": "93/2026"}');
    raise exception 'FALHOU E2: aceitou input que o workflow não tem';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform private."FC_DISPARAR_ROBO"('sincronizar-selecao.yml', '{"modo": 1}');
    raise exception 'FALHOU E2: aceitou input que não é texto';
  exception when sqlstate '22023' then null;
  end;
  raise notice 'ok E2';
end;
$$;

-- E3 Conferência das respostas (respostas falsas na tabela do pg_net, desfeitas no rollback) -----
do $$
declare
  v_aceito bigint;
  v_recusado bigint;
  v_perdido bigint;
  v_velho bigint;
begin
  insert into net._http_response (id, status_code, content, timed_out, created)
  values (-9001, 204, '', false, now()),
         (-9002, 401, '{"message":"Bad credentials","documentation_url":"https://docs.github.com"}', false, now());
  insert into public."TL_DISPARO_ROBO" ("NO_WORKFLOW", "CO_PEDIDO_HTTP", "TP_SITUACAO")
  values ('sincronizar-selecao.yml', -9001, 'PEDIDO') returning "CO_DISPARO" into v_aceito;
  insert into public."TL_DISPARO_ROBO" ("NO_WORKFLOW", "CO_PEDIDO_HTTP", "TP_SITUACAO")
  values ('sincronizar-entrevistas.yml', -9002, 'PEDIDO') returning "CO_DISPARO" into v_recusado;
  insert into public."TL_DISPARO_ROBO" ("NO_WORKFLOW", "DT_DISPARO", "CO_PEDIDO_HTTP", "TP_SITUACAO")
  values ('expurgo-anexos-chat.yml', now() - interval '2 hours', -9003, 'PEDIDO') returning "CO_DISPARO" into v_perdido;
  insert into public."TL_DISPARO_ROBO" ("NO_WORKFLOW", "DT_DISPARO", "TP_SITUACAO")
  values ('conferencias.yml', now() - interval '31 days', 'SEM_TOKEN') returning "CO_DISPARO" into v_velho;

  perform private."FC_CONFERIR_DISPAROS_ROBO"();

  if (select "TP_SITUACAO" || ':' || "NU_STATUS_HTTP" from public."TL_DISPARO_ROBO" where "CO_DISPARO" = v_aceito) <> 'ACEITO:204' then
    raise exception 'FALHOU E3: 204 devia ser ACEITO';
  end if;
  if (select "TP_SITUACAO" || ':' || "NU_STATUS_HTTP" || ':' || "DS_MENSAGEM" from public."TL_DISPARO_ROBO" where "CO_DISPARO" = v_recusado)
     <> 'FALHOU:401:GitHub 401: Bad credentials' then
    raise exception 'FALHOU E3: 401 devia ser FALHOU com a mensagem do GitHub';
  end if;
  if (select "TP_SITUACAO" from public."TL_DISPARO_ROBO" where "CO_DISPARO" = v_perdido) <> 'FALHOU' then
    raise exception 'FALHOU E3: pedido sem resposta há 2 h devia ser FALHOU';
  end if;
  if exists (select 1 from public."TL_DISPARO_ROBO" where "CO_DISPARO" = v_velho) then
    raise exception 'FALHOU E3: linha de 31 dias devia sair';
  end if;
  raise notice 'ok E3';
end;
$$;

-- E4 Status das atualizações como um administrador global (sem mostrar quem) --------------------
select set_config('ensaio.admin', (
  select p.user_id::text from public."TB_PERFIL_USUARIO" p
    join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
   where p.ativo is true and a."ST_ADMIN_GLOBAL" and p.user_id is not null
   order by p.user_id limit 1), true);

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('ensaio.admin'), 'role', 'authenticated')::text, true);

with saude as (select public.get_saude_das_cargas() as j)
select
  j -> 'agenda_dos_robos' ->> 'chave_cadastrada' as chave_cadastrada,
  (j -> 'agenda_dos_robos' ->> 'ultimo_aceito') is not null as tem_ultimo_aceito,
  j -> 'agenda_dos_robos' ->> 'falhas_24h' as falhas_24h,
  j -> 'agenda_dos_robos' ->> 'sem_chave_24h' as sem_chave_24h,
  (select string_agg(d ->> 'situacao', ',' order by d ->> 'inicio' desc) from json_array_elements(j -> 'agenda_dos_robos' -> 'disparos') d) as situacoes,
  (select count(*) from json_array_elements(j -> 'tarefas') t where t ->> 'nome' like 'agsus\_robo\_%') as tarefas_da_agenda,
  json_typeof(j -> 'expurgo_chat') as expurgo_continua,
  (select count(*) from pg_extension where extname = 'pg_net') as pg_net_no_ensaio
  from saude;

rollback;
