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
    E5  disparar_robo e situacao_do_disparo_robo: anon sem execute; quem não é
        administrador global nem coordena o edital → 42501; o administrador
        global pede Seleção/Conferências e o robô da Empregare com opções →
        SEM_TOKEN (chave ausente simulada) e origem MONITORA; modo, vaga, edital,
        limite e robô fora da lista → 22023; pedido repetido em 2 min → 55006;
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
  "TP_ORIGEM" text not null default 'AGENDA',
  "CO_USUARIO" uuid,
  "CO_PEDIDO_HTTP" bigint,
  "TP_SITUACAO" text not null,
  "NU_STATUS_HTTP" integer,
  "DT_RESPOSTA" timestamptz,
  "DS_MENSAGEM" text,
  constraint "PK_TL_DISPARO_ROBO" primary key ("CO_DISPARO"),
  constraint "CK_DISPROBO_NOWORKFLOW" check ("NO_WORKFLOW" in (
    'sincronizar-entrevistas.yml', 'sincronizar-selecao.yml', 'conferencias.yml',
    'expurgo-anexos-chat.yml', 'robo-empregare.yml', 'pre-classificacao.yml')),
  constraint "CK_DISPROBO_TPORIGEM" check ("TP_ORIGEM" in ('AGENDA', 'MONITORA')),
  constraint "CK_DISPROBO_USUARIO" check (("TP_ORIGEM" = 'MONITORA') = ("CO_USUARIO" is not null)),
  constraint "CK_DISPROBO_TPSITUACAO" check ("TP_SITUACAO" in ('PEDIDO', 'ACEITO', 'FALHOU', 'SEM_TOKEN')),
  constraint "CK_DISPROBO_PEDIDO" check (
    ("TP_SITUACAO" = 'SEM_TOKEN' and "CO_PEDIDO_HTTP" is null)
    or ("TP_SITUACAO" in ('PEDIDO', 'ACEITO') and "CO_PEDIDO_HTTP" is not null)
    or "TP_SITUACAO" = 'FALHOU'),
  constraint "CK_DISPROBO_NUSTATUS" check ("NU_STATUS_HTTP" is null or "NU_STATUS_HTTP" between 100 and 599),
  constraint "CK_DISPROBO_DSMENSAGEM" check (coalesce(length("DS_MENSAGEM"), 0) <= 300)
);
comment on table public."TL_DISPARO_ROBO" is
  'Pedidos de execução dos robôs (workflow_dispatch do GitHub) feitos pelo banco: na hora da agenda (pg_cron) e no Rodar agora / Opções / Recalcular do MONITORA (disparar_robo), sempre por FC_DISPARAR_ROBO (20261008140000). Uma linha por pedido; nunca guarda a chave. Fechada por FC_CONFERIR_DISPAROS_ROBO (net._http_response); linhas com mais de 30 dias saem. Leitura só por get_saude_das_cargas e situacao_do_disparo_robo.';
comment on column public."TL_DISPARO_ROBO"."CO_DISPARO" is 'Identificador do pedido (sequencial).';
comment on column public."TL_DISPARO_ROBO"."NO_WORKFLOW" is 'Arquivo do workflow pedido (lista fixa: os 6 robôs de ROBOS_DE_CARGA).';
comment on column public."TL_DISPARO_ROBO"."DT_DISPARO" is 'Quando o banco fez o pedido.';
comment on column public."TL_DISPARO_ROBO"."TP_ORIGEM" is 'AGENDA (pg_cron) ou MONITORA (Rodar agora, Opções ou Recalcular de quem está logado).';
comment on column public."TL_DISPARO_ROBO"."CO_USUARIO" is 'Quem pediu pelo MONITORA (auth.users.id; vai ao workflow como disparado_por); nulo na agenda.';
comment on column public."TL_DISPARO_ROBO"."CO_PEDIDO_HTTP" is 'Id do pedido no pg_net (net._http_response.id); nulo em SEM_TOKEN.';
comment on column public."TL_DISPARO_ROBO"."TP_SITUACAO" is 'PEDIDO (aguardando a resposta), ACEITO (o GitHub respondeu 2xx — 204), FALHOU (outro código, tempo esgotado ou sem resposta) ou SEM_TOKEN (sem a chave github_disparo_robos no Vault; nada foi pedido).';
comment on column public."TL_DISPARO_ROBO"."NU_STATUS_HTTP" is 'Código HTTP da resposta do GitHub (204 = aceito; 401 = chave inválida ou expirada; 403/404 = chave sem permissão no repositório; 422 = input recusado).';
comment on column public."TL_DISPARO_ROBO"."DT_RESPOSTA" is 'Quando a resposta chegou (ou quando o pedido foi dado como sem resposta).';
comment on column public."TL_DISPARO_ROBO"."DS_MENSAGEM" is 'Motivo curto da falha (a mensagem do GitHub, "tempo esgotado"…); nunca a chave.';
comment on constraint "PK_TL_DISPARO_ROBO" on public."TL_DISPARO_ROBO" is 'Uma linha por pedido.';
comment on constraint "CK_DISPROBO_NOWORKFLOW" on public."TL_DISPARO_ROBO" is 'Só os workflows da lista fixa.';
comment on constraint "CK_DISPROBO_TPORIGEM" on public."TL_DISPARO_ROBO" is 'Origens válidas.';
comment on constraint "CK_DISPROBO_USUARIO" on public."TL_DISPARO_ROBO" is 'Usuário só (e sempre) no pedido pelo MONITORA.';
comment on constraint "CK_DISPROBO_TPSITUACAO" on public."TL_DISPARO_ROBO" is 'Situações válidas.';
comment on constraint "CK_DISPROBO_PEDIDO" on public."TL_DISPARO_ROBO" is 'SEM_TOKEN não tem pedido no pg_net; PEDIDO e ACEITO sempre têm.';
comment on constraint "CK_DISPROBO_NUSTATUS" on public."TL_DISPARO_ROBO" is 'Código HTTP entre 100 e 599.';
comment on constraint "CK_DISPROBO_DSMENSAGEM" on public."TL_DISPARO_ROBO" is 'Mensagem até 300 caracteres.';

create index "IN_DISPROBO_DTDISPARO" on public."TL_DISPARO_ROBO" ("DT_DISPARO" desc);
comment on index public."IN_DISPROBO_DTDISPARO" is 'Os últimos disparos primeiro (Status das atualizações) e a limpeza de 30 dias.';
create index "IN_DISPROBO_PEDIDO_ABERTO" on public."TL_DISPARO_ROBO" ("CO_PEDIDO_HTTP") where "TP_SITUACAO" = 'PEDIDO';
comment on index public."IN_DISPROBO_PEDIDO_ABERTO" is 'Pedidos ainda sem resposta (FC_CONFERIR_DISPAROS_ROBO).';
create index "IN_DISPROBO_WORKFLOW_DTDISPARO" on public."TL_DISPARO_ROBO" ("NO_WORKFLOW", "DT_DISPARO" desc);
comment on index public."IN_DISPROBO_WORKFLOW_DTDISPARO" is 'Pedido repetido do mesmo robô em poucos minutos (disparar_robo).';

alter table public."TL_DISPARO_ROBO" enable row level security;
revoke all on public."TL_DISPARO_ROBO" from public, anon, authenticated, service_role;

-- 3. O disparo (único caminho até o GitHub) -------------------------------------------------
create function private."FC_DISPARAR_ROBO"(
  p_workflow text,
  p_inputs jsonb default '{}'::jsonb,
  p_usuario uuid default null)
returns bigint
language plpgsql
volatile
security definer
set search_path to ''
as $function$
declare
  -- Lista fixa: workflow → inputs que ele aceita (além de disparado_por).
  c_aceitos constant jsonb := jsonb_build_object(
    'sincronizar-entrevistas.yml', jsonb_build_array('modo'),
    'sincronizar-selecao.yml', jsonb_build_array('modo'),
    'conferencias.yml', jsonb_build_array('modo'),
    'expurgo-anexos-chat.yml', jsonb_build_array('modo'),
    'robo-empregare.yml', jsonb_build_array('modo', 'editais', 'vagas', 'limite'),
    'pre-classificacao.yml', jsonb_build_array('modo', 'editais'));
  v_inputs jsonb := coalesce(p_inputs, '{}'::jsonb);
  v_origem constant text := case when p_usuario is null then 'AGENDA' else 'MONITORA' end;
  -- disparado_por: AGENDA na agenda; o id de quem pediu no MONITORA.
  v_disparado_por constant text := coalesce(p_usuario::text, 'AGENDA');
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
           or length(i.value #>> '{}') > 20000) then
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
comment on function private."FC_DISPARAR_ROBO"(text, jsonb, uuid) is
  'Único caminho até o GitHub (20261008140000): pede a execução (workflow_dispatch, ramo main) de um workflow da lista fixa, com os inputs que ele aceita (texto até 20000) e disparado_por = AGENDA (sem p_usuario, a agenda do pg_cron) ou o id de quem pediu (disparar_robo). Lê a chave github_disparo_robos do Vault na hora e só a entrega ao pg_net; sem a chave, registra SEM_TOKEN e sai sem erro. Grava o pedido em TL_DISPARO_ROBO e devolve o CO_DISPARO. 22023 para workflow fora da lista ou input recusado. Só o dono (pg_cron e as RPCs SECURITY DEFINER).';
revoke all on function private."FC_DISPARAR_ROBO"(text, jsonb, uuid) from public, anon, authenticated, service_role;

-- 4. A conferência das respostas -------------------------------------------------------------
create function private."FC_CONFERIR_DISPAROS_ROBO"(p_disparo bigint default null)
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
     and d."TP_SITUACAO" = 'PEDIDO'
     and (p_disparo is null or d."CO_DISPARO" = p_disparo);
  get diagnostics v_fechados = row_count;

  -- A resposta não veio (ou já saiu da tabela do pg_net): falha, para a tela avisar.
  update public."TL_DISPARO_ROBO" d
     set "TP_SITUACAO" = 'FALHOU',
         "DT_RESPOSTA" = now(),
         "DS_MENSAGEM" = 'Sem resposta do GitHub em 1 h.'
   where d."TP_SITUACAO" = 'PEDIDO'
     and d."DT_DISPARO" < now() - interval '1 hour'
     and (p_disparo is null or d."CO_DISPARO" = p_disparo);
  get diagnostics v_sem_resposta = row_count;

  if p_disparo is null then
    delete from public."TL_DISPARO_ROBO" d
     where d."DT_DISPARO" < now() - interval '30 days';
  end if;

  return v_fechados + v_sem_resposta;
end;
$function$;
comment on function private."FC_CONFERIR_DISPAROS_ROBO"(bigint) is
  'Agenda dos robôs (20261008140000): fecha os pedidos de TL_DISPARO_ROBO (todos, ou só p_disparo) pela resposta em net._http_response (2xx = ACEITO — o GitHub responde 204; outro código ou tempo esgotado = FALHOU, com a mensagem curta do GitHub), dá como FALHOU o pedido sem resposta há mais de 1 h e, na rodada geral, apaga as linhas com mais de 30 dias. Devolve quantos fechou. Só o dono (pg_cron a cada 5 min e situacao_do_disparo_robo).';
revoke all on function private."FC_CONFERIR_DISPAROS_ROBO"(bigint) from public, anon, authenticated, service_role;

-- 4b. Rodar agora, Opções e Recalcular pelo banco ---------------------------------------------
/*
  As mesmas regras de api/rodar-carga.js + validarOpcoes (src/lib/robos-de-carga.js),
  que saem: quem pode, a lista branca de cada robô e o formato de cada opção.
    - administrador global (pode_disparar_carga): qualquer robô, com opções;
    - coordenação (pode_recalcular_pre_classificacao): só a pré-classificação,
      de um edital pelo id, no modo normal, sem vagas nem limite.
  p_inputs: { modo, editais, vagas, limite } (editais e vagas em lista ou texto
  separado por vírgula). O workflow recebe disparado_por = id de quem pediu.
*/
create function public.disparar_robo(p_robo text, p_inputs jsonb default '{}'::jsonb)
returns bigint
language plpgsql
volatile
security definer
set search_path to ''
as $function$
declare
  c_robos constant jsonb := jsonb_build_object(
    'empregare', jsonb_build_object('nome', 'Robô da Empregare', 'workflow', 'robo-empregare.yml',
      'modos', jsonb_build_array('normal', 'seco', 'fumaca', 'forcar'),
      'editais', 'numero', 'vagas', true, 'limite', true),
    'selecao', jsonb_build_object('nome', 'Seleção', 'workflow', 'sincronizar-selecao.yml',
      'modos', jsonb_build_array('normal')),
    'entrevistas', jsonb_build_object('nome', 'Entrevistas', 'workflow', 'sincronizar-entrevistas.yml',
      'modos', jsonb_build_array('normal')),
    'conferencias', jsonb_build_object('nome', 'Conferências de consistência', 'workflow', 'conferencias.yml',
      'modos', jsonb_build_array('normal', 'seco')),
    'expurgo_chat', jsonb_build_object('nome', 'Expurgo dos anexos do chat', 'workflow', 'expurgo-anexos-chat.yml',
      'modos', jsonb_build_array('normal')),
    'pre_classificacao', jsonb_build_object('nome', 'Pré-classificação (Avaliação documental)', 'workflow', 'pre-classificacao.yml',
      'modos', jsonb_build_array('normal', 'seco', 'refazer_lote'),
      'editais', 'numero_ou_id', 'por_edital', true));
  c_uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_uid uuid := (select auth.uid());
  v_robo jsonb := c_robos -> p_robo;
  v_in jsonb := coalesce(p_inputs, '{}'::jsonb);
  v_chave text;
  v_valor jsonb;
  v_itens text[];
  v_item text;
  v_modo text;
  v_editais text[] := '{}';
  v_vagas text[] := '{}';
  v_limite integer;
  v_saida jsonb;
begin
  if v_uid is null then
    raise exception 'Entre no MONITORA de novo para rodar a carga.' using errcode = '28000';
  end if;
  if v_robo is null then
    raise exception 'Carga desconhecida.' using errcode = '22023';
  end if;
  if jsonb_typeof(v_in) <> 'object' then
    raise exception 'Opções inválidas.' using errcode = '22023';
  end if;

  -- Opção que o robô não aceita (vazia passa, como em validarOpcoes).
  for v_chave, v_valor in select * from jsonb_each(v_in) loop
    if v_chave not in ('modo', 'editais', 'vagas', 'limite')
       or (v_chave <> 'modo' and v_robo -> v_chave is null
           and not (jsonb_typeof(v_valor) = 'null'
                    or v_valor in ('""'::jsonb, '[]'::jsonb))) then
      raise exception '% não aceita “%”.', v_robo ->> 'nome', left(v_chave, 30) using errcode = '22023';
    end if;
  end loop;

  -- Modo
  if jsonb_typeof(v_in -> 'modo') not in ('string', 'null') then
    raise exception 'Modo inválido para este robô.' using errcode = '22023';
  end if;
  v_modo := coalesce(nullif(btrim(v_in ->> 'modo'), ''), 'normal');
  if not ((v_robo -> 'modos') ? v_modo) then
    raise exception 'Modo inválido para este robô.' using errcode = '22023';
  end if;

  -- Editais: número (93/2026) ou, na pré-classificação, também o id.
  if v_robo ? 'editais' and coalesce(jsonb_typeof(v_in -> 'editais'), 'null') <> 'null' then
    v_valor := v_in -> 'editais';
    if jsonb_typeof(v_valor) = 'array' then
      if exists (select 1 from jsonb_array_elements(v_valor) e where jsonb_typeof(e) <> 'string') then
        raise exception 'Edital inválido.' using errcode = '22023';
      end if;
      select coalesce(array_agg(e), '{}') into v_itens from jsonb_array_elements_text(v_valor) e;
    elsif jsonb_typeof(v_valor) = 'string' then
      v_itens := string_to_array(v_valor #>> '{}', ',');
    else
      raise exception 'Edital inválido.' using errcode = '22023';
    end if;
    foreach v_item in array v_itens loop
      v_item := btrim(v_item);
      continue when v_item = '';
      if lower(v_item) ~ c_uuid and v_robo ->> 'editais' = 'numero_ou_id' then
        v_item := lower(v_item);
      elsif v_item !~ '^\d{1,4}/\d{4}$' then
        raise exception 'Edital inválido: %.', left(v_item, 40) using errcode = '22023';
      end if;
      if not v_item = any (v_editais) then
        v_editais := v_editais || v_item;
      end if;
    end loop;
    if cardinality(v_editais) > 100 then
      raise exception 'No máximo 100 editais por vez.' using errcode = '22023';
    end if;
  end if;

  -- Vagas: códigos da Empregare, só dígitos.
  if v_robo ? 'vagas' and coalesce(jsonb_typeof(v_in -> 'vagas'), 'null') <> 'null' then
    v_valor := v_in -> 'vagas';
    if jsonb_typeof(v_valor) = 'array' then
      if exists (select 1 from jsonb_array_elements(v_valor) e where jsonb_typeof(e) <> 'string') then
        raise exception 'Código de vaga inválido (só dígitos).' using errcode = '22023';
      end if;
      select coalesce(array_agg(e), '{}') into v_itens from jsonb_array_elements_text(v_valor) e;
    elsif jsonb_typeof(v_valor) = 'string' then
      v_itens := regexp_split_to_array(v_valor #>> '{}', '[\s,;]+');
    else
      raise exception 'Código de vaga inválido (só dígitos).' using errcode = '22023';
    end if;
    foreach v_item in array v_itens loop
      v_item := btrim(v_item);
      continue when v_item = '';
      if v_item !~ '^\d{1,20}$' then
        raise exception 'Código de vaga inválido: % (só dígitos).', left(v_item, 30) using errcode = '22023';
      end if;
      if not v_item = any (v_vagas) then
        v_vagas := v_vagas || v_item;
      end if;
    end loop;
    if cardinality(v_vagas) > 500 then
      raise exception 'No máximo 500 vagas por vez.' using errcode = '22023';
    end if;
  end if;

  -- Limite: 1 a 500 vagas.
  if v_robo ? 'limite' and coalesce(jsonb_typeof(v_in -> 'limite'), 'null') <> 'null'
     and btrim(v_in ->> 'limite') <> '' then
    if btrim(v_in ->> 'limite') !~ '^\d{1,3}$'
       or (btrim(v_in ->> 'limite'))::integer not between 1 and 500 then
      raise exception 'Limite de 1 a 500 vagas.' using errcode = '22023';
    end if;
    v_limite := (btrim(v_in ->> 'limite'))::integer;
  end if;

  -- Quem pode (o banco decide, como em api/rodar-carga.js).
  if not public.pode_disparar_carga() then
    if not coalesce((v_robo ->> 'por_edital')::boolean, false) then
      raise exception 'Só o administrador global roda as cargas.' using errcode = '42501';
    end if;
    if v_modo <> 'normal' or cardinality(v_vagas) > 0 or v_limite is not null
       or cardinality(v_editais) <> 1 or v_editais[1] !~ c_uuid then
      raise exception 'Só o administrador global roda as cargas com opções.' using errcode = '42501';
    end if;
    if not public.pode_recalcular_pre_classificacao(v_editais[1]::uuid) then
      raise exception 'Só a coordenação da avaliação do edital recalcula a pré-classificação.' using errcode = '42501';
    end if;
  end if;

  -- Duplo clique: o mesmo robô pedido há menos de 2 min (e ainda não recusado).
  if exists (
    select 1 from public."TL_DISPARO_ROBO" d
     where d."NO_WORKFLOW" = v_robo ->> 'workflow'
       and d."TP_SITUACAO" in ('PEDIDO', 'ACEITO')
       and d."DT_DISPARO" > now() - interval '2 minutes') then
    raise exception 'Esta carga acabou de ser pedida. Aguarde alguns minutos.' using errcode = '55006';
  end if;

  v_saida := jsonb_build_object('modo', v_modo);
  if coalesce((v_robo ->> 'por_edital')::boolean, false) or cardinality(v_editais) > 0 then
    v_saida := v_saida || jsonb_build_object('editais', array_to_string(v_editais, ','));
  end if;
  if cardinality(v_vagas) > 0 then
    v_saida := v_saida || jsonb_build_object('vagas', array_to_string(v_vagas, ','));
  end if;
  if v_limite is not null then
    v_saida := v_saida || jsonb_build_object('limite', v_limite::text);
  end if;

  return private."FC_DISPARAR_ROBO"(v_robo ->> 'workflow', v_saida, v_uid);
end;
$function$;
comment on function public.disparar_robo(text, jsonb) is
  'Rodar agora, Opções (Status das atualizações) e Recalcular (pré-classificação) pelo banco (20261008140000; substitui api/rodar-carga.js): confere quem pede (administrador global: qualquer robô e opções; coordenação: só a pré-classificação de um edital pelo id, modo normal), a lista branca do robô (modo, editais, vagas, limite) e o pedido repetido em 2 min (55006), e pede o workflow por FC_DISPARAR_ROBO com disparado_por = id de quem pediu. Devolve o CO_DISPARO de TL_DISPARO_ROBO (acompanhe por situacao_do_disparo_robo). 28000 sem sessão, 42501 sem permissão, 22023 para opção inválida.';
revoke all on function public.disparar_robo(text, jsonb) from public, anon;
grant execute on function public.disparar_robo(text, jsonb) to authenticated;

create function public.situacao_do_disparo_robo(p_disparo bigint)
returns json
language plpgsql
volatile
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Entre no MONITORA de novo.' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public."TL_DISPARO_ROBO" d
     where d."CO_DISPARO" = p_disparo
       and (d."CO_USUARIO" = v_uid or private.is_master())) then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;
  perform private."FC_CONFERIR_DISPAROS_ROBO"(p_disparo);
  return (
    select json_build_object(
      'disparo', d."CO_DISPARO",
      'workflow', d."NO_WORKFLOW",
      'inicio', d."DT_DISPARO",
      'fim', d."DT_RESPOSTA",
      'situacao', d."TP_SITUACAO",
      'http', d."NU_STATUS_HTTP",
      'mensagem', d."DS_MENSAGEM")
      from public."TL_DISPARO_ROBO" d
     where d."CO_DISPARO" = p_disparo);
end;
$function$;
comment on function public.situacao_do_disparo_robo(bigint) is
  'Situação de um pedido de disparar_robo (20261008140000), para a tela acompanhar: fecha o pedido pela resposta do GitHub em net._http_response, se já chegou, e devolve {disparo, workflow, inicio, fim, situacao (PEDIDO, ACEITO, FALHOU, SEM_TOKEN), http, mensagem}. Só quem pediu ou o administrador global (P0002 para os demais).';
revoke all on function public.situacao_do_disparo_robo(bigint) from public, anon;
grant execute on function public.situacao_do_disparo_robo(bigint) to authenticated;

comment on function public.pode_disparar_carga() is
  'true quando quem chama é o administrador global: disparar_robo confere antes de pedir qualquer robô (20261008140000).';
comment on function public.pode_recalcular_pre_classificacao(uuid) is
  'true quando quem chama coordena a avaliação documental do edital (ou é o administrador global): disparar_robo confere antes de pedir a pré-classificação de um edital (20261008140000).';

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
            'origem', x."TP_ORIGEM",
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
  'Saúde das cargas (Configurações, só administrador global): as últimas 10 execuções de cada carga das análises (por origem, com encerrada_por_inatividade — 20261007170000), das entrevistas, da seleção, do robô da Empregare (com vagas pedidas/baixadas/falhas/recusadas e quem disparou), das conferências de consistência (avisos novos, abertos e resolvidos), da pré-classificação da Avaliação documental (editais, vagas, inscritos e lote), do expurgo diário dos anexos do chat (lotes, removidos, confirmados, falhas e pendentes — 20261007250000), da agenda dos robôs pelo banco (chave cadastrada, último disparo aceito, falhas e sem chave em 24 h, os 20 últimos pedidos — 20261008140000) e das tarefas agsus_* do pg_cron (nulas sem acesso ao pg_cron). Só leitura.';

-- E1 Permissões e agenda ----------------------------------------------------------------------
do $$
declare
  v_papel text;
begin
  foreach v_papel in array array['anon', 'authenticated', 'service_role'] loop
    if has_function_privilege(v_papel, 'private."FC_DISPARAR_ROBO"(text, jsonb, uuid)', 'execute')
       or has_function_privilege(v_papel, 'private."FC_CONFERIR_DISPAROS_ROBO"(bigint)', 'execute')
       or has_table_privilege(v_papel, 'public."TL_DISPARO_ROBO"', 'select')
       or has_table_privilege(v_papel, 'public."TL_DISPARO_ROBO"', 'insert') then
      raise exception 'FALHOU E1: % tem acesso', v_papel;
    end if;
  end loop;
  if not (select relrowsecurity from pg_class where oid = 'public."TL_DISPARO_ROBO"'::regclass) then
    raise exception 'FALHOU E1: RLS desligada';
  end if;
  if not (select prosecdef from pg_proc where oid = 'private."FC_DISPARAR_ROBO"(text, jsonb, uuid)'::regprocedure) then
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

-- E3 Conferência das respostas (o 204 de mentira trava um novo pedido da Seleção por 2 min — E5 confere) (respostas falsas na tabela do pg_net, desfeitas no rollback) -----
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

-- E5 Rodar agora pelo banco: disparar_robo e situacao_do_disparo_robo (chave ausente simulada) --
do $$
begin
  if has_function_privilege('anon', 'public.disparar_robo(text, jsonb)', 'execute')
     or has_function_privilege('anon', 'public.situacao_do_disparo_robo(bigint)', 'execute')
     or not has_function_privilege('authenticated', 'public.disparar_robo(text, jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'public.situacao_do_disparo_robo(bigint)', 'execute') then
    raise exception 'FALHOU E5: permissões das RPCs';
  end if;
end;
$$;

-- Quem não é administrador global nem coordena o edital: 42501.
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-4000-a000-0000000000e5', 'role', 'authenticated')::text, true);
do $$
begin
  begin
    perform public.disparar_robo('selecao', '{}');
    raise exception 'FALHOU E5: quem não é admin rodou a Seleção';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform public.disparar_robo('pre_classificacao', '{"editais": ["00000000-0000-4000-a000-0000000000e5"]}');
    raise exception 'FALHOU E5: quem não coordena recalculou';
  exception when sqlstate '42501' then null;
  end;
  raise notice 'ok E5 permissão';
end;
$$;
reset role;

-- O administrador global: pedidos com a chave ausente (SEM_TOKEN) e as opções conferidas.
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('ensaio.admin'), 'role', 'authenticated')::text, true);
do $$
declare
  v_id bigint;
  v_situacao json;
begin
  v_id := public.disparar_robo('conferencias', '{}');
  v_situacao := public.situacao_do_disparo_robo(v_id);
  if v_situacao ->> 'situacao' <> 'SEM_TOKEN' or v_situacao ->> 'workflow' <> 'conferencias.yml' then
    raise exception 'FALHOU E5: esperava SEM_TOKEN das conferências';
  end if;
  v_id := public.disparar_robo('empregare',
    '{"modo": "seco", "editais": ["93/2026", "93/2026"], "vagas": "177979, 180231;177979", "limite": "10"}');
  if public.situacao_do_disparo_robo(v_id) ->> 'situacao' <> 'SEM_TOKEN' then
    raise exception 'FALHOU E5: esperava SEM_TOKEN do robô da Empregare';
  end if;
  begin
    perform public.disparar_robo('selecao', '{"modo": "seco"}');
    raise exception 'FALHOU E5: aceitou modo que a Seleção não tem';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.disparar_robo('empregare', '{"vagas": ["12a"]}');
    raise exception 'FALHOU E5: aceitou código de vaga com letra';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.disparar_robo('conferencias', '{"editais": "93/2026"}');
    raise exception 'FALHOU E5: aceitou edital nas conferências';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.disparar_robo('empregare', '{"limite": "501"}');
    raise exception 'FALHOU E5: aceitou limite 501';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.disparar_robo('deploy', '{}');
    raise exception 'FALHOU E5: aceitou robô fora da lista';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.disparar_robo('selecao', '{}');
    raise exception 'FALHOU E5: aceitou pedido repetido em 2 min';
  exception when sqlstate '55006' then null;
  end;
  raise notice 'ok E5 admin';
end;
$$;
reset role;

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
  (select count(*) from pg_extension where extname = 'pg_net') as pg_net_no_ensaio,
  (select count(*) from json_array_elements(j -> 'agenda_dos_robos' -> 'disparos') d where d ->> 'origem' = 'MONITORA') as pedidos_do_monitora
  from saude;

rollback;
