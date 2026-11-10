/*
  ROLLBACK de 20261109180000_catalogo_dos_robos_e_chave_unica.sql

  Volta ao estado de 20261103213000:
    - a tarefa agsus_alinhar_chaves_da_automacao sai do pg_cron;
    - FC_DISPARAR_ROBO, FC_CHAVE_DO_WORKFLOW, FC_CHAVE_DA_TAREFA,
      registrar_disparo_externo e alterar_chave_da_automacao voltam ao corpo de
      antes, letra por letra (copiado das migrations de origem; o teste
      tests/catalogo-dos-robos-migration.test.ts confere), com o comentário de antes;
    - TL_DISPARO_ROBO volta ao CHECK CK_DISPROBO_NOWORKFLOW com a lista fixa;
    - saem obter_catalogo_dos_robos, FC_ALINHAR_TAREFAS_DAS_CHAVES e as tabelas
      TB_TAREFA_AGENDADA e TB_ROBO_WORKFLOW.

  O que NÃO volta (de propósito):
    - O estado das tarefas do pg_cron: uma tarefa que o alinhador desligou porque
      a chave dela estava desligada continua desligada (é o que a chave diz). Para
      religar, ligue a chave pela tela (alterar_chave_da_automacao).
    - Os eventos que o alinhador gravou em TH_CHAVE_AUTOMACAO (histórico).
    - Os pedidos em TL_DISPARO_ROBO (cada um continua com o workflow que tinha).

  Guarda: não roda se a migration não foi aplicada, nem se algum pedido em
  TL_DISPARO_ROBO tiver workflow fora da lista fixa de antes (o CHECK recusaria).
*/
begin;

set local lock_timeout = '5s';

do $$
declare
  v_fora text;
begin
  if to_regclass('public."TB_ROBO_WORKFLOW"') is null then
    raise exception 'A migration 20261109180000 não está aplicada (TB_ROBO_WORKFLOW não existe).';
  end if;
  select string_agg(distinct d."NO_WORKFLOW", ', ' order by d."NO_WORKFLOW") into v_fora
    from public."TL_DISPARO_ROBO" d
   where not (d."NO_WORKFLOW" = any (array['sincronizar-entrevistas.yml', 'sincronizar-selecao.yml', 'conferencias.yml', 'expurgo-anexos-chat.yml', 'robo-empregare.yml', 'pre-classificacao.yml', 'leitura-de-arquivos.yml', 'classificacao.yml', 'contratacao-dos-aprovados.yml', 'pacotes-dos-paineis.yml', 'casamento-da-lista.yml']));
  if v_fora is not null then
    raise exception 'TL_DISPARO_ROBO tem pedidos de workflow fora da lista fixa de antes: %. O CHECK de antes os recusaria.', v_fora;
  end if;
end;
$$;

-- 1. A tarefa do alinhador sai ------------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'agsus_alinhar_chaves_da_automacao') then
    perform cron.unschedule('agsus_alinhar_chaves_da_automacao');
  end if;
end;
$$;

-- 2. As funções voltam ao corpo de antes ---------------------------------------------------------
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
    'pacotes-dos-paineis.yml', jsonb_build_array('modo'),
    -- Casamento da lista de aprovados (20261030090000): pedido a cada prévia, com o id do pedido.
    'casamento-da-lista.yml', jsonb_build_array('modo', 'pedido'));
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
  'Único caminho do banco até o GitHub (20261008140000): pede a execução (workflow_dispatch, ramo main) de um workflow da lista fixa, com os inputs que ele aceita (texto até 20000; o robô da Empregare aceita modo, editais, vagas, limite, anexos, candidatos, seco e forcar_congelado; a pré-classificação, modo, editais e forcar_congelado; a classificação em Python, desde 20261023170000, modo e listas). Origem (20261020170000): MONITORA com p_usuario (vai como disparado_por); AGENDA só do pg_cron (p_origem = AGENDA nas tarefas ou a sessão pg_cron; disparado_por = AGENDA); MANUAL quando chamada direto pelo SQL, sem usuário (disparado_por = manual). Chaves da automação (20261022190000): na origem AGENDA, com a chave do workflow desligada (FC_CHAVE_DO_WORKFLOW, TB_CHAVE_AUTOMACAO), não pede nada e devolve nulo. Lê a chave github_disparo_robos do Vault na hora e só a entrega ao pg_net; sem a chave, registra SEM_TOKEN e sai sem erro. Grava o pedido em TL_DISPARO_ROBO e devolve o CO_DISPARO. 22023 para workflow fora da lista, origem ou input recusado. Só o dono (pg_cron e as RPCs SECURITY DEFINER).';

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
comment on function private."FC_CHAVE_DO_WORKFLOW"(text) is
  'Chave da automação que manda nos pedidos da agenda (origem AGENDA) de cada workflow da lista fixa de FC_DISPARAR_ROBO. 20261022190000; classificacao.yml desde 20261023170000.';

create or replace function private."FC_CHAVE_DA_TAREFA"(p_tarefa text)
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

create or replace function public.registrar_disparo_externo(p_workflow text, p_ator text, p_url text, p_resumo text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ator text := nullif(btrim(coalesce(p_ator, '')), '');
  v_resumo text := nullif(left(btrim(coalesce(p_resumo, '')), 300), '');
  v_disparo bigint;
begin
  if p_workflow is null or p_workflow not in (
       'sincronizar-entrevistas.yml', 'sincronizar-selecao.yml', 'conferencias.yml',
       'robo-empregare.yml', 'pre-classificacao.yml', 'leitura-de-arquivos.yml', 'classificacao.yml') then
    raise exception 'Workflow fora da lista fixa dos robôs' using errcode = '22023';
  end if;
  if p_url is null or length(p_url) > 300
     or p_url !~ '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/actions/runs/[0-9]+$' then
    raise exception 'Endereço da execução inválido' using errcode = '22023';
  end if;
  -- Login do GitHub (letras, dígitos, hífen; robôs com [bot]); fora disso, sem ator.
  if v_ator is not null and v_ator !~ '^[A-Za-z0-9][A-Za-z0-9-]{0,38}(\[bot\])?$' then
    v_ator := null;
  end if;

  insert into public."TL_DISPARO_ROBO"
         ("NO_WORKFLOW", "TP_ORIGEM", "CO_USUARIO", "TP_SITUACAO", "NO_ATOR_GITHUB", "DS_URL_EXECUCAO", "DS_MENSAGEM")
  values (p_workflow, 'GITHUB', null, 'INICIADO', v_ator, p_url, v_resumo)
  on conflict ("DS_URL_EXECUCAO") where "TP_ORIGEM" = 'GITHUB' do nothing
  returning "CO_DISPARO" into v_disparo;
  if v_disparo is null then
    select d."CO_DISPARO" into v_disparo
      from public."TL_DISPARO_ROBO" d
     where d."TP_ORIGEM" = 'GITHUB' and d."DS_URL_EXECUCAO" = p_url;
  end if;
  return v_disparo;
end;
$function$;
comment on function public.registrar_disparo_externo(text, text, text, text) is
  'Workflows do GitHub Actions (service_role, 20261020170000): no início de uma execução iniciada direto no GitHub (Run workflow, gh workflow run — disparado_por vazio), registra em TL_DISPARO_ROBO a origem GITHUB, a situação INICIADO, o ator (github.triggering_actor, login válido ou nulo), o endereço da execução e um resumo curto (até 300). Uma linha por execução (repetir devolve a mesma). 22023 para workflow fora da lista ou endereço inválido. O workflow nunca falha por causa deste registro.';

create or replace function public.alterar_chave_da_automacao(p_chave text, p_ligar boolean, p_motivo text)
returns json
language plpgsql
security definer
set search_path = ''
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
  if not private."FC_MOTIVO_COM_SENTIDO"(v_motivo) then
    raise exception 'Escreva o motivo numa frase de verdade: pelo menos 15 caracteres e 3 palavras (até 500).'
      using errcode = '22023';
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
  'Liga (p_ligar = true) ou desliga uma chave da automação (20261022190000), com motivo de verdade (private."FC_MOTIVO_COM_SENTIDO", 20261103213000: 15 a 500 caracteres, 3 palavras ou mais, sem teclado batido): liga ou desliga junto as tarefas do pg_cron da chave (cron.alter_job active), grava o estado em TB_CHAVE_AUTOMACAO e o evento, com as tarefas mexidas, em TH_CHAVE_AUTOMACAO, e devolve obter_chaves_da_automacao. Só o administrador global. 28000 sem sessão, 42501 sem permissão, 22023 entrada inválida, 55000 já está no estado pedido.';

-- 3. TL_DISPARO_ROBO volta à lista fixa ----------------------------------------------------------
alter table public."TL_DISPARO_ROBO" drop constraint "FK_DISPROBO_ROBOWKF";
drop index public."IN_DISPROBO_NOWORKFLOW";
alter table public."TL_DISPARO_ROBO" add constraint "CK_DISPROBO_NOWORKFLOW" check ("NO_WORKFLOW" = any (array['sincronizar-entrevistas.yml', 'sincronizar-selecao.yml', 'conferencias.yml', 'expurgo-anexos-chat.yml', 'robo-empregare.yml', 'pre-classificacao.yml', 'leitura-de-arquivos.yml', 'classificacao.yml', 'contratacao-dos-aprovados.yml', 'pacotes-dos-paineis.yml', 'casamento-da-lista.yml']));
comment on constraint "CK_DISPROBO_NOWORKFLOW" on public."TL_DISPARO_ROBO" is
  'Workflows que o banco pede (lista fixa de FC_DISPARAR_ROBO) ou registra; pacotes-dos-paineis.yml desde 20261029180000; casamento-da-lista.yml desde 20261030090000.';
comment on column public."TL_DISPARO_ROBO"."NO_WORKFLOW" is 'Arquivo do workflow pedido (lista fixa: os 6 robôs de ROBOS_DE_CARGA).';

-- 4. Saem as funções e as tabelas novas ----------------------------------------------------------
drop function public.obter_catalogo_dos_robos();
drop function private."FC_ALINHAR_TAREFAS_DAS_CHAVES"(text);
drop table public."TB_TAREFA_AGENDADA";
drop table public."TB_ROBO_WORKFLOW";

commit;
