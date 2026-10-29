/*
  ROLLBACK de 20261029160000_pacotes_dos_paineis_em_python.sql

  Volta a rodada do pg_cron a montar os pacotes no banco (PR_REMONTAR_CACHE_AGENDADO de antes),
  tira pacotes-dos-paineis.yml da lista fixa de FC_DISPARAR_ROBO, de FC_CHAVE_DO_WORKFLOW e do
  CK_DISPROBO_NOWORKFLOW (os registros de pedidos dele em TL_DISPARO_ROBO saem antes) e apaga as RPCs
  do job. Os pacotes já gravados pelo job continuam valendo (mesmo formato); as marcas que estiverem em
  TL_ALTERACAO_CACHE são consumidas pela próxima rodada, como antes.
  Depois: desligar/retirar o workflow .github/workflows/pacotes-dos-paineis.yml (sem pedido do banco, ele
  só roda pelo Run workflow e, sem as RPCs, falha sem gravar).
*/
begin;

set local lock_timeout = '5s';

CREATE OR REPLACE PROCEDURE private."PR_REMONTAR_CACHE_AGENDADO"(IN p_cache text)
 LANGUAGE plpgsql
AS $procedure$
declare
  v_resposta jsonb;
  v_falhas text;
begin
  perform pg_catalog.set_config('search_path', '', true);
  -- A mesma trava de antes: uma rodada de cada vez.
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtext(case p_cache
       when 'ANALISES' then 'agsus_analises_cache_do_painel'
       when 'APROVADOS' then 'agsus_aprovados_cache_por_area'
       when 'ENTREVISTAS' then 'agsus_entrevistas_cache_do_painel' end)) then
    return;
  end if;
  v_resposta := case p_cache
    when 'ANALISES' then public.atualizar_cache_painel_analises_vencidos()
    when 'APROVADOS' then public.atualizar_cache_aprovados_vencidos()
    when 'ENTREVISTAS' then public.atualizar_cache_painel_entrevistas()
  end;
  if v_resposta is null then
    raise exception 'Cache desconhecido: %', p_cache using errcode = '22023';
  end if;
  v_falhas := private."FC_FALHAS_DO_CACHE"(v_resposta);
  -- O que deu certo fica gravado; a falha vai para a execução do job (Status das atualizações).
  commit;
  if v_falhas is not null then
    raise exception 'Pacote % não remontado: %', lower(p_cache), left(v_falhas, 400);
  end if;
end;
$procedure$;

comment on procedure private."PR_REMONTAR_CACHE_AGENDADO"(text) is
  'Remonta os pacotes vencidos (ANALISES, APROVADOS ou ENTREVISTAS) pelo pg_cron, grava o que deu certo e termina com erro se alguma área falhou, para a execução aparecer como falha no Status das atualizações (20261022185000).';

drop function if exists private."FC_PAINEIS_RODADA"(text);
drop function if exists public.paineis_gravar_pacote(text, text, timestamptz, bigint[], json, text);
drop function if exists private."FC_LINHAS_VALIDAS"(json, integer[]);
drop function if exists public.paineis_ler_fontes(text, text);
drop function if exists public.paineis_ler_pendentes();
drop function if exists private."FC_PAINEIS_VENCIDOS"(text);

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
    'contratacao-dos-aprovados.yml', jsonb_build_array('modo'));
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

CREATE OR REPLACE FUNCTION private."FC_CHAVE_DO_WORKFLOW"(p_workflow text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case p_workflow
    when 'sincronizar-entrevistas.yml' then 'entrevistas'
    when 'sincronizar-selecao.yml' then 'selecao'
    when 'conferencias.yml' then 'conferencias'
    when 'robo-empregare.yml' then 'robo_de_inscricoes'
    when 'pre-classificacao.yml' then 'pre_classificacao'
    when 'classificacao.yml' then 'classificacao'
    when 'contratacao-dos-aprovados.yml' then 'conferencias'
  end;
$function$;

delete from public."TL_DISPARO_ROBO" where "NO_WORKFLOW" = 'pacotes-dos-paineis.yml';
alter table public."TL_DISPARO_ROBO" drop constraint "CK_DISPROBO_NOWORKFLOW";
alter table public."TL_DISPARO_ROBO" add constraint "CK_DISPROBO_NOWORKFLOW" check ("NO_WORKFLOW" = any (array[
  'sincronizar-entrevistas.yml', 'sincronizar-selecao.yml', 'conferencias.yml', 'expurgo-anexos-chat.yml',
  'robo-empregare.yml', 'pre-classificacao.yml', 'leitura-de-arquivos.yml', 'classificacao.yml',
  'contratacao-dos-aprovados.yml']));
comment on constraint "CK_DISPROBO_NOWORKFLOW" on public."TL_DISPARO_ROBO" is
  'Workflows que o banco pede (lista fixa de FC_DISPARAR_ROBO) ou registra; contratacao-dos-aprovados.yml desde 20261024120000.';

commit;
