/*
  CHAVES DA AUTOMAÇÃO (uma por aba)

  Pedido de 22/10/2026: o administrador global liga e desliga, em
  Configurações › Automação, o que roda sozinho para cada aba, com motivo, e
  vê quem mudou e quando. Até aqui, pausar uma sincronização era um
  `update cron.job set active = false` à mão (as tarefas 22 e 23, Entrevistas
  e Seleção, estão assim de propósito desde 16/10/2026), sem rastro na tela;
  o Status das atualizações mostrava "Atrasada" em vez de "desligada".

  AS CHAVES (lista fixa; private."FC_CHAVE_DA_TAREFA" e "FC_CHAVE_DO_WORKFLOW")
    entrevistas         agsus_robo_sincronizar_entrevistas → sincronizar-entrevistas.yml
    selecao             agsus_robo_sincronizar_selecao → sincronizar-selecao.yml
    kpis_do_edital      agsus_kpis_do_edital_pela_selecao
    robo_de_inscricoes  agsus_robo_inscricoes_* → robo-empregare.yml
    pre_classificacao   pre-classificacao.yml chamado no fim do robo-empregare.yml
                        (apos_robo; confere automacao_ligada) e o da agenda
    conferencias        agsus_robo_conferencias → conferencias.yml
    paineis             agsus_analises_cache_do_painel, agsus_aprovados_cache_por_area,
                        agsus_entrevistas_cache_do_painel
    manutencao          agsus_analises_analyze_diario, agsus_fila_estatisticas,
                        agsus_analises_encerrar_inativas, agsus_eventos_acesso_limpeza_mensal
  Fora das chaves (sempre ligada): agsus_robo_conferir_disparos, que fecha os
  pedidos do "Rodar agora". Os gatilhos do Apps Script das planilhas de análises
  ficam no Google (docs/agenda-dos-robos.md).

  O QUE "DESLIGADA" FAZ
    1. alterar_chave_da_automacao desliga (cron.alter_job active) as tarefas do
       pg_cron da chave e, ao ligar, religa; grava o estado em
       TB_CHAVE_AUTOMACAO e o evento, com as tarefas mexidas, em TH_CHAVE_AUTOMACAO.
    2. FC_DISPARAR_ROBO não pede nada ao GitHub quando a origem é AGENDA e a
       chave do workflow está desligada (devolve nulo): vale mesmo que alguém
       religue a tarefa direto no pg_cron.
    3. O "Rodar agora" (disparar_robo, origem MONITORA) continua: a tela pede
       confirmação quando a chave está desligada.

  O ESTADO DE HOJE (sem religar nada): cada chave nasce desligada quando tem
  tarefas no pg_cron e todas estão com active = false; senão, ligada. Nenhuma
  tarefa do pg_cron é alterada por esta migration.

  Ensaio: supabase/ensaios/20261022190000_chaves_da_automacao.sql
  Rollback: supabase/rollback/20261022190000_chaves_da_automacao.sql
*/
begin;

set local lock_timeout = '5s';

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regclass('cron.job') is null then
    raise exception 'O pg_cron precisa estar ligado (Database → Extensions → pg_cron).';
  end if;
  if to_regprocedure('private."FC_DISPARAR_ROBO"(text, jsonb, uuid, text)') is null then
    raise exception 'Aplique antes 20261020170000_inscricoes_congeladas.sql.';
  end if;
  if to_regprocedure('private."FC_NOME_USUARIO"(uuid)') is null
     or to_regprocedure('private.is_master()') is null then
    raise exception 'Faltam private."FC_NOME_USUARIO" ou private.is_master.';
  end if;
end;
$$;

-- 1. As tabelas -------------------------------------------------------------------------
create table public."TB_CHAVE_AUTOMACAO" (
  "CO_CHAVE" character varying(40) not null,
  "NO_CHAVE" character varying(80) not null,
  "NU_ORDEM" smallint not null,
  "ST_LIGADA" character varying(1) not null default 'S',
  "DS_MOTIVO" character varying(500) not null,
  "CO_USUARIO_ATUALIZACAO" uuid,
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_CHAVE_AUTOMACAO" primary key ("CO_CHAVE"),
  constraint "CK_CHAVEAUTOM_COCHAVE" check ("CO_CHAVE" in (
    'entrevistas', 'selecao', 'kpis_do_edital', 'robo_de_inscricoes',
    'pre_classificacao', 'conferencias', 'paineis', 'manutencao')),
  constraint "CK_CHAVEAUTOM_STLIGADA" check ("ST_LIGADA" in ('S', 'N')),
  constraint "CK_CHAVEAUTOM_DSMOTIVO" check (length(btrim("DS_MOTIVO")) between 10 and 500)
);
comment on table public."TB_CHAVE_AUTOMACAO" is
  'Chaves da automação (20261022190000): uma por aba, liga (S) ou desliga (N) o que roda sozinho — as tarefas do pg_cron da chave e os pedidos da agenda (FC_DISPARAR_ROBO, origem AGENDA). O Rodar agora do administrador continua. Escrita só por alterar_chave_da_automacao; cada mudança fica em TH_CHAVE_AUTOMACAO.';
comment on column public."TB_CHAVE_AUTOMACAO"."CO_CHAVE" is 'Código da chave (lista fixa).';
comment on column public."TB_CHAVE_AUTOMACAO"."NO_CHAVE" is 'Nome na tela.';
comment on column public."TB_CHAVE_AUTOMACAO"."NU_ORDEM" is 'Ordem na tela.';
comment on column public."TB_CHAVE_AUTOMACAO"."ST_LIGADA" is 'S = a automação roda sozinha; N = desligada pelo administrador.';
comment on column public."TB_CHAVE_AUTOMACAO"."DS_MOTIVO" is 'Motivo da última mudança (10 a 500 caracteres).';
comment on column public."TB_CHAVE_AUTOMACAO"."CO_USUARIO_ATUALIZACAO" is 'Quem fez a última mudança (auth.users.id); no estado inicial, a conta do setor ou nulo.';
comment on column public."TB_CHAVE_AUTOMACAO"."DT_ATUALIZACAO" is 'Última mudança.';
comment on constraint "PK_TB_CHAVE_AUTOMACAO" on public."TB_CHAVE_AUTOMACAO" is 'Uma linha por chave.';
comment on constraint "CK_CHAVEAUTOM_COCHAVE" on public."TB_CHAVE_AUTOMACAO" is 'Só as chaves da lista fixa.';
comment on constraint "CK_CHAVEAUTOM_STLIGADA" on public."TB_CHAVE_AUTOMACAO" is 'S ou N.';
comment on constraint "CK_CHAVEAUTOM_DSMOTIVO" on public."TB_CHAVE_AUTOMACAO" is 'Motivo de 10 a 500 caracteres.';
alter table public."TB_CHAVE_AUTOMACAO" enable row level security;
revoke all on public."TB_CHAVE_AUTOMACAO" from public, anon, authenticated, service_role;

create table public."TH_CHAVE_AUTOMACAO" (
  "CO_EVENTO" bigint generated always as identity,
  "CO_CHAVE" character varying(40) not null,
  "ST_LIGADA" character varying(1) not null,
  "DS_MOTIVO" character varying(500) not null,
  "CO_USUARIO" uuid,
  "DS_TAREFAS" text[] not null default '{}',
  "DT_EVENTO" timestamptz not null default now(),
  constraint "PK_TH_CHAVE_AUTOMACAO" primary key ("CO_EVENTO"),
  constraint "FK_CHAVEAUTOM_HISTCHAVEAUTOM" foreign key ("CO_CHAVE")
    references public."TB_CHAVE_AUTOMACAO" ("CO_CHAVE") on delete cascade,
  constraint "CK_HISTCHAVEAUTOM_STLIGADA" check ("ST_LIGADA" in ('S', 'N')),
  constraint "CK_HISTCHAVEAUTOM_DSMOTIVO" check (length(btrim("DS_MOTIVO")) between 10 and 500)
);
comment on table public."TH_CHAVE_AUTOMACAO" is
  'Histórico das chaves da automação (20261022190000): cada ligar/desligar, com quem, quando, motivo e as tarefas do pg_cron mexidas. Só cresce.';
comment on column public."TH_CHAVE_AUTOMACAO"."CO_EVENTO" is 'Identificador do evento (sequencial).';
comment on column public."TH_CHAVE_AUTOMACAO"."CO_CHAVE" is 'Chave (TB_CHAVE_AUTOMACAO.CO_CHAVE).';
comment on column public."TH_CHAVE_AUTOMACAO"."ST_LIGADA" is 'Estado depois do evento: S ligada, N desligada.';
comment on column public."TH_CHAVE_AUTOMACAO"."DS_MOTIVO" is 'Motivo (10 a 500 caracteres).';
comment on column public."TH_CHAVE_AUTOMACAO"."CO_USUARIO" is 'Quem mudou (auth.users.id); no estado inicial, a conta do setor ou nulo.';
comment on column public."TH_CHAVE_AUTOMACAO"."DS_TAREFAS" is 'Tarefas do pg_cron ligadas ou desligadas junto (cron.job.jobname).';
comment on column public."TH_CHAVE_AUTOMACAO"."DT_EVENTO" is 'Quando aconteceu.';
comment on constraint "PK_TH_CHAVE_AUTOMACAO" on public."TH_CHAVE_AUTOMACAO" is 'Um evento por linha.';
comment on constraint "FK_CHAVEAUTOM_HISTCHAVEAUTOM" on public."TH_CHAVE_AUTOMACAO" is 'Chave do evento.';
comment on constraint "CK_HISTCHAVEAUTOM_STLIGADA" on public."TH_CHAVE_AUTOMACAO" is 'S ou N.';
comment on constraint "CK_HISTCHAVEAUTOM_DSMOTIVO" on public."TH_CHAVE_AUTOMACAO" is 'Motivo de 10 a 500 caracteres.';
create index "IN_HISTCHAVEAUTOM_DTEVENTO" on public."TH_CHAVE_AUTOMACAO" ("DT_EVENTO" desc);
comment on index public."IN_HISTCHAVEAUTOM_DTEVENTO" is 'O histórico do mais novo ao mais antigo.';
alter table public."TH_CHAVE_AUTOMACAO" enable row level security;
revoke all on public."TH_CHAVE_AUTOMACAO" from public, anon, authenticated, service_role;

-- 2. Qual chave manda em cada tarefa e em cada workflow --------------------------------
create function private."FC_CHAVE_DA_TAREFA"(p_tarefa text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select case
    when p_tarefa = 'agsus_robo_sincronizar_entrevistas' then 'entrevistas'
    when p_tarefa = 'agsus_robo_sincronizar_selecao' then 'selecao'
    when p_tarefa = 'agsus_kpis_do_edital_pela_selecao' then 'kpis_do_edital'
    when p_tarefa like 'agsus\_robo\_inscricoes\_%' then 'robo_de_inscricoes'
    when p_tarefa = 'agsus_robo_conferencias' then 'conferencias'
    when p_tarefa in ('agsus_analises_cache_do_painel', 'agsus_aprovados_cache_por_area',
                      'agsus_entrevistas_cache_do_painel') then 'paineis'
    when p_tarefa in ('agsus_analises_analyze_diario', 'agsus_fila_estatisticas',
                      'agsus_analises_encerrar_inativas', 'agsus_eventos_acesso_limpeza_mensal') then 'manutencao'
  end;
$function$;
comment on function private."FC_CHAVE_DA_TAREFA"(text) is
  'Chave da automação (TB_CHAVE_AUTOMACAO) que liga e desliga a tarefa do pg_cron; nulo = sempre ligada (ex.: agsus_robo_conferir_disparos). 20261022190000.';
revoke all on function private."FC_CHAVE_DA_TAREFA"(text) from public, anon, authenticated, service_role;

create function private."FC_CHAVE_DO_WORKFLOW"(p_workflow text)
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
  end;
$function$;
comment on function private."FC_CHAVE_DO_WORKFLOW"(text) is
  'Chave da automação que manda nos pedidos da agenda (origem AGENDA) de cada workflow da lista fixa de FC_DISPARAR_ROBO. 20261022190000.';
revoke all on function private."FC_CHAVE_DO_WORKFLOW"(text) from public, anon, authenticated, service_role;

create function private."FC_AUTOMACAO_LIGADA"(p_chave text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce((select c."ST_LIGADA" = 'S' from public."TB_CHAVE_AUTOMACAO" c where c."CO_CHAVE" = p_chave), true);
$function$;
comment on function private."FC_AUTOMACAO_LIGADA"(text) is
  'true quando a chave da automação está ligada (ou não existe: chave nula ou fora da lista). 20261022190000.';
revoke all on function private."FC_AUTOMACAO_LIGADA"(text) from public, anon, authenticated, service_role;

-- 3. O estado de hoje, trazido do pg_cron (sem religar nada) ----------------------------
do $$
declare
  c_setor constant uuid := 'a01afddb-f64b-47d9-80e8-476a1ed14e43';
  v_autor uuid;
  v_chave record;
  v_tarefas text[];
  v_ativas integer;
  v_ligada boolean;
  v_motivo text;
begin
  select u.id into v_autor from auth.users u where u.id = c_setor;
  for v_chave in
    select * from (values
      ('entrevistas', 'Entrevistas', 1),
      ('selecao', 'Seleção', 2),
      ('kpis_do_edital', 'KPIs do edital', 3),
      ('robo_de_inscricoes', 'Robô de inscrições', 4),
      ('pre_classificacao', 'Pré-classificação automática', 5),
      ('conferencias', 'Conferências', 6),
      ('paineis', 'Pacotes dos painéis', 7),
      ('manutencao', 'Manutenção do banco', 8)) x(chave, nome, ordem)
  loop
    select coalesce(array_agg(j.jobname order by j.jobname), '{}'),
           count(*) filter (where j.active)
      into v_tarefas, v_ativas
      from cron.job j
     where private."FC_CHAVE_DA_TAREFA"(j.jobname) = v_chave.chave;
    v_ligada := not (cardinality(v_tarefas) > 0 and v_ativas = 0);
    v_motivo := case
      when v_ligada then 'Estado inicial (migração 20261022190000).'
      else 'Já estava desligada no pg_cron (' || array_to_string(v_tarefas, ', ') || ')'
           || case when v_chave.chave in ('entrevistas', 'selecao')
                   then ', pausa de propósito desde 16/10/2026' else '' end
           || '; trazida pela migração 20261022190000 sem religar.' end;
    insert into public."TB_CHAVE_AUTOMACAO"
           ("CO_CHAVE", "NO_CHAVE", "NU_ORDEM", "ST_LIGADA", "DS_MOTIVO", "CO_USUARIO_ATUALIZACAO")
    values (v_chave.chave, v_chave.nome, v_chave.ordem, case when v_ligada then 'S' else 'N' end,
            left(v_motivo, 500), v_autor);
    insert into public."TH_CHAVE_AUTOMACAO" ("CO_CHAVE", "ST_LIGADA", "DS_MOTIVO", "CO_USUARIO", "DS_TAREFAS")
    values (v_chave.chave, case when v_ligada then 'S' else 'N' end, left(v_motivo, 500), v_autor, '{}');
  end loop;
end;
$$;

-- 4. FC_DISPARAR_ROBO: a agenda respeita a chave -----------------------------------------
-- Corpo de 20261020170000 + a checagem [chaves-da-automacao] logo depois das validações.
create or replace function private."FC_DISPARAR_ROBO"(
  p_workflow text,
  p_inputs jsonb default '{}'::jsonb,
  p_usuario uuid default null,
  p_origem text default null)
returns bigint
language plpgsql
security definer
set search_path to ''
as $function$
declare
  -- Lista fixa: workflow → inputs que ele aceita (além de disparado_por).
  c_aceitos constant jsonb := jsonb_build_object(
    'sincronizar-entrevistas.yml', jsonb_build_array('modo'),
    'sincronizar-selecao.yml', jsonb_build_array('modo'),
    'conferencias.yml', jsonb_build_array('modo'),
    'robo-empregare.yml', jsonb_build_array('modo', 'editais', 'vagas', 'limite', 'anexos', 'candidatos', 'seco', 'forcar_congelado'),
    'pre-classificacao.yml', jsonb_build_array('modo', 'editais', 'forcar_congelado'));
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
comment on function private."FC_DISPARAR_ROBO"(text, jsonb, uuid, text) is
  'Único caminho do banco até o GitHub (20261008140000): pede a execução (workflow_dispatch, ramo main) de um workflow da lista fixa, com os inputs que ele aceita (texto até 20000; o robô da Empregare aceita modo, editais, vagas, limite, anexos, candidatos, seco e forcar_congelado; a pré-classificação, modo, editais e forcar_congelado). Origem (20261020170000): MONITORA com p_usuario (vai como disparado_por); AGENDA só do pg_cron (p_origem = AGENDA nas tarefas ou a sessão pg_cron; disparado_por = AGENDA); MANUAL quando chamada direto pelo SQL, sem usuário (disparado_por = manual). Chaves da automação (20261022190000): na origem AGENDA, com a chave do workflow desligada (FC_CHAVE_DO_WORKFLOW, TB_CHAVE_AUTOMACAO), não pede nada e devolve nulo. Lê a chave github_disparo_robos do Vault na hora e só a entrega ao pg_net; sem a chave, registra SEM_TOKEN e sai sem erro. Grava o pedido em TL_DISPARO_ROBO e devolve o CO_DISPARO. 22023 para workflow fora da lista, origem ou input recusado. Só o dono (pg_cron e as RPCs SECURITY DEFINER).';
revoke all on function private."FC_DISPARAR_ROBO"(text, jsonb, uuid, text) from public, anon, authenticated, service_role;

-- 5. Ler as chaves (tela, só administrador global) ---------------------------------------
create function public.obter_chaves_da_automacao()
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_tarefas jsonb;
  v_cron boolean := true;
begin
  if (select auth.uid()) is null then
    raise exception 'Entre no MONITORA de novo.' using errcode = '28000';
  end if;
  if not private.is_master() then
    raise exception 'Somente o administrador global vê as chaves da automação' using errcode = '42501';
  end if;

  -- As tarefas agsus_* do pg_cron, com a chave e a última execução.
  begin
    select coalesce(jsonb_agg(jsonb_build_object(
        'nome', j.jobname,
        'chave', private."FC_CHAVE_DA_TAREFA"(j.jobname),
        'agenda', j.schedule,
        'ativa', j.active,
        'ultima', (select jsonb_build_object('inicio', d.start_time, 'fim', d.end_time, 'situacao', d.status)
                     from cron.job_run_details d
                    where d.jobid = j.jobid
                    order by d.start_time desc limit 1)
      ) order by j.jobname), '[]'::jsonb)
      into v_tarefas
      from cron.job j
     where left(j.jobname, 6) = 'agsus_';
  exception when others then
    v_tarefas := '[]'::jsonb;
    v_cron := false;
  end;

  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'cron_disponivel', v_cron,
    'chaves', (
      select coalesce(json_agg(json_build_object(
          'chave', c."CO_CHAVE",
          'nome', c."NO_CHAVE",
          'ligada', c."ST_LIGADA" = 'S',
          'motivo', c."DS_MOTIVO",
          'em', c."DT_ATUALIZACAO",
          'por', case when c."CO_USUARIO_ATUALIZACAO" is null then null
                      else private."FC_NOME_USUARIO"(c."CO_USUARIO_ATUALIZACAO") end,
          'tarefas', coalesce((select jsonb_agg(t) from jsonb_array_elements(v_tarefas) t
                                where t ->> 'chave' = c."CO_CHAVE"), '[]'::jsonb),
          -- O último pedido da agenda ao GitHub (as chaves de robô).
          'ultimo_pedido', (
            select json_build_object('inicio', d."DT_DISPARO", 'situacao', d."TP_SITUACAO")
              from public."TL_DISPARO_ROBO" d
             where d."TP_ORIGEM" = 'AGENDA'
               and private."FC_CHAVE_DO_WORKFLOW"(d."NO_WORKFLOW") = c."CO_CHAVE"
             order by d."DT_DISPARO" desc limit 1),
          -- A pré-classificação automática roda no fim do robô (TP_DISPARO = ROBO).
          'ultima_pre_classificacao', case when c."CO_CHAVE" = 'pre_classificacao' then (
            select json_build_object('inicio', p."DT_INICIO", 'fim', p."DT_FIM", 'situacao', p."TP_SITUACAO")
              from public."TL_PRE_CLASSIFICACAO" p
             where p."TP_DISPARO" = 'ROBO'
             order by p."DT_INICIO" desc limit 1) end
        ) order by c."NU_ORDEM"), '[]'::json)
        from public."TB_CHAVE_AUTOMACAO" c
    ),
    'sem_chave', coalesce((select jsonb_agg(t - 'chave') from jsonb_array_elements(v_tarefas) t
                            where t ->> 'chave' is null), '[]'::jsonb),
    'historico', (
      select coalesce(json_agg(json_build_object(
          'chave', h."CO_CHAVE",
          'ligada', h."ST_LIGADA" = 'S',
          'motivo', h."DS_MOTIVO",
          'em', h."DT_EVENTO",
          'por', case when h."CO_USUARIO" is null then null else private."FC_NOME_USUARIO"(h."CO_USUARIO") end,
          'tarefas', h."DS_TAREFAS"
        ) order by h."DT_EVENTO" desc, h."CO_EVENTO" desc), '[]'::json)
        from (select * from public."TH_CHAVE_AUTOMACAO" t
               order by t."DT_EVENTO" desc, t."CO_EVENTO" desc limit 50) h
    )
  );
end;
$function$;
comment on function public.obter_chaves_da_automacao() is
  'Configurações › Automação (20261022190000): as chaves da automação (ligada, motivo, em, por), as tarefas do pg_cron de cada uma (agenda, ativa, última execução), o último pedido da agenda ao GitHub, a última pré-classificação automática, as tarefas sem chave (sempre ligadas) e os 50 últimos eventos. Só o administrador global (28000 sem sessão, 42501 os demais).';
revoke all on function public.obter_chaves_da_automacao() from public, anon;
grant execute on function public.obter_chaves_da_automacao() to authenticated;

-- 6. Ligar e desligar (tela, só administrador global) ------------------------------------
create function public.alterar_chave_da_automacao(p_chave text, p_ligar boolean, p_motivo text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_atual text;
  v_tarefa record;
  v_tarefas text[] := '{}';
begin
  if v_uid is null then
    raise exception 'Entre no MONITORA de novo.' using errcode = '28000';
  end if;
  if not private.is_master() then
    raise exception 'Só o administrador global liga ou desliga a automação.' using errcode = '42501';
  end if;
  if p_chave is null or p_ligar is null then
    raise exception 'Informe a chave e se ela fica ligada.' using errcode = '22023';
  end if;
  if length(v_motivo) not between 10 and 500 then
    raise exception 'Informe o motivo (10 a 500 caracteres).' using errcode = '22023';
  end if;

  select c."ST_LIGADA" into v_atual
    from public."TB_CHAVE_AUTOMACAO" c
   where c."CO_CHAVE" = p_chave
     for update;
  if v_atual is null then
    raise exception 'Chave da automação desconhecida.' using errcode = '22023';
  end if;
  if (v_atual = 'S') = p_ligar then
    raise exception 'Esta automação já está %.', case when p_ligar then 'ligada' else 'desligada' end
      using errcode = '55000';
  end if;

  -- As tarefas do pg_cron da chave acompanham (o que já está no estado pedido fica).
  for v_tarefa in
    select j.jobid, j.jobname from cron.job j
     where private."FC_CHAVE_DA_TAREFA"(j.jobname) = p_chave and j.active is distinct from p_ligar
     order by j.jobname
  loop
    perform cron.alter_job(v_tarefa.jobid, active := p_ligar);
    v_tarefas := v_tarefas || v_tarefa.jobname::text;
  end loop;

  update public."TB_CHAVE_AUTOMACAO" set
    "ST_LIGADA" = case when p_ligar then 'S' else 'N' end,
    "DS_MOTIVO" = v_motivo,
    "CO_USUARIO_ATUALIZACAO" = v_uid,
    "DT_ATUALIZACAO" = now()
   where "CO_CHAVE" = p_chave;
  insert into public."TH_CHAVE_AUTOMACAO" ("CO_CHAVE", "ST_LIGADA", "DS_MOTIVO", "CO_USUARIO", "DS_TAREFAS")
  values (p_chave, case when p_ligar then 'S' else 'N' end, v_motivo, v_uid, v_tarefas);

  return public.obter_chaves_da_automacao();
end;
$function$;
comment on function public.alterar_chave_da_automacao(text, boolean, text) is
  'Liga (p_ligar = true) ou desliga uma chave da automação (20261022190000), com motivo de 10 a 500 caracteres: liga ou desliga junto as tarefas do pg_cron da chave (cron.alter_job active), grava o estado em TB_CHAVE_AUTOMACAO e o evento, com as tarefas mexidas, em TH_CHAVE_AUTOMACAO, e devolve obter_chaves_da_automacao. Só o administrador global. 28000 sem sessão, 42501 sem permissão, 22023 entrada inválida, 55000 já está no estado pedido.';
revoke all on function public.alterar_chave_da_automacao(text, boolean, text) from public, anon;
grant execute on function public.alterar_chave_da_automacao(text, boolean, text) to authenticated;

-- 7. A pergunta dos workflows (service_role) --------------------------------------------
create function public.automacao_ligada(p_chave text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select private."FC_AUTOMACAO_LIGADA"(p_chave);
$function$;
comment on function public.automacao_ligada(text) is
  'Workflows do GitHub Actions (service_role, 20261022190000): a chave da automação está ligada? A pré-classificação chamada no fim do robô da Empregare (pre-classificacao.yml, apos_robo) pergunta pre_classificacao antes de rodar (python/monitora/chave_da_automacao.py). Chave fora da lista = ligada.';
revoke all on function public.automacao_ligada(text) from public, anon, authenticated;
grant execute on function public.automacao_ligada(text) to service_role;

commit;
