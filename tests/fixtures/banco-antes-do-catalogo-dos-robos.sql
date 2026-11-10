/*
  O banco ANTES de 20261109180000 (catálogo dos robôs), no que os testes do catálogo usam.

  As migrations antigas saíram do repositório (continuam aplicadas no banco). Este arquivo guarda,
  copiados delas sem mudança, os trechos de que o banco de teste (tests/apoio/banco-dos-robos.ts) e
  tests/catalogo-dos-robos-migration.test.ts precisam: a última definição de cada função, o último
  comentário de cada objeto e as duas CHECKs com as listas fixas. Não é migration: não aplicar.
  Origem de cada trecho no comentário "-- de" acima dele.
*/

-- de 20261103213000_limpeza_da_auditoria.sql
create or replace function private."FC_MOTIVO_COM_SENTIDO"(p_motivo text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $function$
  with t as (select lower(btrim(coalesce(p_motivo, ''))) as m),
  p as (
    select regexp_replace(w, '[^[:alpha:]]', '', 'g') as letras
      from t, regexp_split_to_table(t.m, '\s+') w
     where w <> ''
  )
  select length(t.m) between 15 and 500
     and (select count(*) from p) >= 3
     and (select count(*) from p
           where length(p.letras) >= 3
             and p.letras ~ '[aeiouyáàâãäéèêëíìîïóòôõöúùûü]'
             and p.letras !~ '[^aeiouyáàâãäéèêëíìîïóòôõöúùûü]{5}'
             and p.letras !~ '(.)\1\1') >= 2
     and (select count(distinct c) from p, regexp_split_to_table(p.letras, '') c where c <> '') >= 5
    from t;
$function$;

-- de 20261022190000_chaves_da_automacao.sql
create or replace function private."FC_AUTOMACAO_LIGADA"(p_chave text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce((select c."ST_LIGADA" = 'S' from public."TB_CHAVE_AUTOMACAO" c where c."CO_CHAVE" = p_chave), true);
$function$;

-- de 20261022190000_chaves_da_automacao.sql
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

-- de 20261029180000_pacotes_dos_paineis_em_python.sql
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

-- de 20261030090000_lista_de_aprovados_substituir_preserva_o_estado.sql
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

-- de 20261023200000_classificacao_em_python_etapa_2b.sql
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

-- de 20261103213000_limpeza_da_auditoria.sql
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

-- de 20261022190000_chaves_da_automacao.sql
create or replace function public.obter_chaves_da_automacao()
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

-- de 20261022190000_chaves_da_automacao.sql
create or replace function public.automacao_ligada(p_chave text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select private."FC_AUTOMACAO_LIGADA"(p_chave);
$function$;

-- de 20261023200000_classificacao_em_python_etapa_2b.sql
create or replace function public.disparar_robo(p_robo text, p_inputs jsonb DEFAULT '{}'::jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  c_robos constant jsonb := jsonb_build_object(
    'empregare', jsonb_build_object('nome', 'Robô da Empregare', 'workflow', 'robo-empregare.yml',
      'modos', jsonb_build_array('normal', 'seco', 'fumaca', 'forcar', 'sondar', 'anexos'),
      'editais', 'numero', 'vagas', true, 'limite', true, 'anexos', true, 'candidatos', true, 'seco', true,
      'forcar_congelado', true, 'motivo', true, 'modos_que_gravam', jsonb_build_array('normal', 'forcar'),
      'modos_que_gravam_sem_seco', jsonb_build_array('anexos')),
    'selecao', jsonb_build_object('nome', 'Seleção', 'workflow', 'sincronizar-selecao.yml',
      'modos', jsonb_build_array('normal')),
    'entrevistas', jsonb_build_object('nome', 'Entrevistas', 'workflow', 'sincronizar-entrevistas.yml',
      'modos', jsonb_build_array('normal')),
    'conferencias', jsonb_build_object('nome', 'Conferências de consistência', 'workflow', 'conferencias.yml',
      'modos', jsonb_build_array('normal', 'seco')),
    'pre_classificacao', jsonb_build_object('nome', 'Pré-classificação (Avaliação documental)', 'workflow', 'pre-classificacao.yml',
      'modos', jsonb_build_array('normal', 'seco', 'refazer_lote'),
      'editais', 'numero_ou_id', 'por_edital', true,
      'forcar_congelado', true, 'motivo', true, 'modos_que_gravam', jsonb_build_array('normal', 'refazer_lote')),
    -- [classificacao-python] (20261023200000) reprocessa os relatórios de desempate e os cálculos pendentes.
    'classificacao_desempate', jsonb_build_object('nome', 'Relatório de desempate (Classificação em Python)',
      'workflow', 'classificacao.yml', 'modos', jsonb_build_array('normal')));
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
  v_candidatos text[] := '{}';
  v_limite integer;
  v_anexos boolean;
  v_seco boolean;
  v_saida jsonb;
  v_forcar_congelado boolean := false;
  v_motivo text;
  v_congelados uuid[] := '{}';
  v_rotulos text;
  v_liberacao uuid;
  v_disparo bigint;
  v_grava boolean;
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
    if v_chave not in ('modo', 'editais', 'vagas', 'limite', 'anexos', 'candidatos', 'seco', 'forcar_congelado', 'motivo')
       or (v_chave <> 'modo' and v_robo -> v_chave is null
           and not (jsonb_typeof(v_valor) = 'null'
                    or v_valor in ('""'::jsonb, '[]'::jsonb, 'false'::jsonb, '"false"'::jsonb))) then
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

  -- Candidatos (modo anexos): códigos da Empregare, só dígitos.
  if v_robo ? 'candidatos' and coalesce(jsonb_typeof(v_in -> 'candidatos'), 'null') <> 'null' then
    v_valor := v_in -> 'candidatos';
    if jsonb_typeof(v_valor) = 'array' then
      if exists (select 1 from jsonb_array_elements(v_valor) e where jsonb_typeof(e) <> 'string') then
        raise exception 'Código de candidato inválido (só dígitos).' using errcode = '22023';
      end if;
      select coalesce(array_agg(e), '{}') into v_itens from jsonb_array_elements_text(v_valor) e;
    elsif jsonb_typeof(v_valor) = 'string' then
      v_itens := regexp_split_to_array(v_valor #>> '{}', '[\s,;]+');
    else
      raise exception 'Código de candidato inválido (só dígitos).' using errcode = '22023';
    end if;
    foreach v_item in array v_itens loop
      v_item := btrim(v_item);
      continue when v_item = '';
      if v_item !~ '^\d{1,20}$' then
        raise exception 'Código de candidato inválido: % (só dígitos).', left(v_item, 30) using errcode = '22023';
      end if;
      if not v_item = any (v_candidatos) then
        v_candidatos := v_candidatos || v_item;
      end if;
    end loop;
    if cardinality(v_candidatos) > 1000 then
      raise exception 'No máximo 1.000 candidatos por vez.' using errcode = '22023';
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

  -- Anexos (robô da Empregare): true/false ou "true"/"false"; só nos modos normal e forcar.
  if v_robo ? 'anexos' and coalesce(jsonb_typeof(v_in -> 'anexos'), 'null') <> 'null' then
    if v_in -> 'anexos' in ('true'::jsonb, '"true"'::jsonb) then
      v_anexos := true;
    elsif v_in -> 'anexos' in ('false'::jsonb, '"false"'::jsonb, '""'::jsonb) then
      v_anexos := false;
    else
      raise exception 'Opção “anexos” inválida (sim ou não).' using errcode = '22023';
    end if;
    if v_anexos and v_modo not in ('normal', 'forcar') then
      raise exception 'Guardar os links dos anexos só nos modos Normal e Forçar.' using errcode = '22023';
    end if;
  end if;

  -- Seco (modo anexos): true/false ou "true"/"false".
  if v_robo ? 'seco' and coalesce(jsonb_typeof(v_in -> 'seco'), 'null') <> 'null' then
    if v_in -> 'seco' in ('true'::jsonb, '"true"'::jsonb) then
      v_seco := true;
    elsif v_in -> 'seco' in ('false'::jsonb, '"false"'::jsonb, '""'::jsonb) then
      v_seco := false;
    else
      raise exception 'Opção “seco” inválida (sim ou não).' using errcode = '22023';
    end if;
  end if;

  -- Forçar edital congelado (20261020170000): true/false ou "true"/"false", com motivo.
  if v_robo ? 'forcar_congelado' and coalesce(jsonb_typeof(v_in -> 'forcar_congelado'), 'null') <> 'null' then
    if v_in -> 'forcar_congelado' in ('true'::jsonb, '"true"'::jsonb) then
      v_forcar_congelado := true;
    elsif v_in -> 'forcar_congelado' not in ('false'::jsonb, '"false"'::jsonb, '""'::jsonb) then
      raise exception 'Opção “forcar_congelado” inválida (sim ou não).' using errcode = '22023';
    end if;
  end if;
  if v_robo ? 'motivo' and coalesce(jsonb_typeof(v_in -> 'motivo'), 'null') <> 'null' then
    if jsonb_typeof(v_in -> 'motivo') <> 'string' then
      raise exception 'Motivo inválido.' using errcode = '22023';
    end if;
    v_motivo := nullif(btrim(v_in ->> 'motivo'), '');
  end if;
  if v_motivo is not null and not v_forcar_congelado then
    raise exception 'O motivo só vale com “Forçar edital com inscrições congeladas”.' using errcode = '22023';
  end if;

  -- Só anexos: relê os anexos do questionário sem exportar; pede vagas ou editais.
  if v_modo = 'anexos' then
    if cardinality(v_vagas) = 0 and cardinality(v_editais) = 0 then
      raise exception 'O modo Só anexos pede vagas ou editais.' using errcode = '22023';
    end if;
  elsif cardinality(v_candidatos) > 0 or coalesce(v_seco, false) then
    raise exception 'Candidatos e "só comparar" só no modo Só anexos.' using errcode = '22023';
  end if;

  -- Sondar (como o workflow exige): uma única vaga, sem editais, limite de 1 a 3 candidatos.
  if v_modo = 'sondar' then
    if cardinality(v_vagas) <> 1 or cardinality(v_editais) > 0 then
      raise exception 'O modo Sondar pede um único código de vaga (sem editais).' using errcode = '22023';
    end if;
    if v_limite is not null and v_limite > 3 then
      raise exception 'No modo Sondar, o limite é de 1 a 3 candidatos.' using errcode = '22023';
    end if;
  end if;

  -- Quem pode (o banco decide, como em api/rodar-carga.js).
  if not public.pode_disparar_carga() then
    if not coalesce((v_robo ->> 'por_edital')::boolean, false) then
      raise exception 'Só o administrador global roda as cargas.' using errcode = '42501';
    end if;
    if v_modo <> 'normal' or cardinality(v_vagas) > 0 or v_limite is not null or v_forcar_congelado
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

  -- [pendente-no-grupo] (20261022170000) O GitHub guarda UMA execução esperando por grupo de
  -- concorrência: um pedido novo cancela, sem aviso, o que já esperava. Com uma execução
  -- rodando e outra já pedida depois dela, recusa em vez de trocar uma pela outra.
  if private."FC_EXECUCAO_PENDENTE_NO_GRUPO"(v_robo ->> 'workflow') then
    raise exception 'Já há uma execução desta carga esperando a que está rodando terminar; um pedido novo cancelaria aquela. Aguarde.'
      using errcode = '55006';
  end if;

  -- [congeladas] Inscrições congeladas (20261020170000): nos modos que gravam, o edital ou a
  -- vaga pedidos explicitamente de edital congelado são recusados; o administrador global
  -- pode forçar, com motivo (a LIBERACAO vale 12 h e vai ao workflow como forcar_congelado).
  -- Sem edital nem vaga, o robô e a pré-classificação pulam os congelados sozinhos.
  -- (20261022170000) O Só anexos grava também (respostas e anexos): só com a liberação, ou
  -- com "só comparar" (seco), que não grava nada.
  v_grava := (v_robo -> 'modos_que_gravam') ? v_modo
             or ((v_robo -> 'modos_que_gravam_sem_seco') ? v_modo and not coalesce(v_seco, false));
  if v_grava then
    select coalesce(array_agg(distinct m.id), '{}'),
           string_agg(distinct coalesce(private."FC_NUMERO_EDITAL"(m.edital), m.edital), ', ')
      into v_congelados, v_rotulos
      from public."TB_CONGELAMENTO_INSCRICAO" c
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = c."CO_MONITORAMENTO"
     where c."ST_INSCRICOES_CONGELADAS" = 'S'
       and (m.id::text = any (v_editais)
            or private."FC_NUMERO_EDITAL"(m.edital) = any (v_editais)
            or exists (select 1 from public."TB_EMPREGARE_VAGA" v
                        where v."CO_MONITORAMENTO" = m.id and v."CO_VAGA" = any (v_vagas)));
    if cardinality(v_congelados) > 0 and not v_forcar_congelado and v_modo = 'anexos' then
      raise exception 'Inscrições congeladas: %. O Só anexos só grava neste edital com a liberação do administrador global (com motivo); para conferir sem gravar, use "só comparar".', v_rotulos
        using errcode = '55000';
    end if;
    if cardinality(v_congelados) > 0 and not v_forcar_congelado then
      raise exception 'Inscrições congeladas: %. O robô e a pré-classificação não mexem neste edital; tire-o do pedido (só o administrador global força, com motivo).', v_rotulos
        using errcode = '55000';
    end if;
    if v_forcar_congelado then
      if not public.pode_disparar_carga() then
        raise exception 'Só o administrador global força edital com inscrições congeladas.' using errcode = '42501';
      end if;
      if v_motivo is null or length(v_motivo) not between 10 and 500 then
        raise exception 'Informe o motivo para forçar (10 a 500 caracteres).' using errcode = '22023';
      end if;
      if cardinality(v_congelados) = 0 then
        raise exception 'Nenhum edital ou vaga pedida está com as inscrições congeladas.' using errcode = '22023';
      end if;
      v_liberacao := gen_random_uuid();
      insert into public."TH_CONGELAMENTO_INSCRICAO"
             ("CO_MONITORAMENTO", "TP_EVENTO", "DS_MOTIVO", "CO_USUARIO", "CO_LIBERACAO", "DT_VALIDADE")
      select x, 'LIBERACAO', v_motivo, v_uid, v_liberacao, now() + interval '12 hours'
        from unnest(v_congelados) x;
    end if;
  elsif v_forcar_congelado then
    raise exception 'Forçar edital congelado só nos modos que gravam (no Só anexos, sem "só comparar").' using errcode = '22023';
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
  if v_anexos is not null then
    v_saida := v_saida || jsonb_build_object('anexos', case when v_anexos then 'true' else 'false' end);
  end if;
  if cardinality(v_candidatos) > 0 then
    v_saida := v_saida || jsonb_build_object('candidatos', array_to_string(v_candidatos, ','));
  end if;
  if v_modo = 'anexos' then
    v_saida := v_saida || jsonb_build_object('seco', case when coalesce(v_seco, false) then 'true' else 'false' end);
  end if;

  if v_liberacao is not null then
    v_saida := v_saida || jsonb_build_object('forcar_congelado', v_liberacao::text);
  end if;

  v_disparo := private."FC_DISPARAR_ROBO"(v_robo ->> 'workflow', v_saida, v_uid);
  if v_liberacao is not null then
    update public."TH_CONGELAMENTO_INSCRICAO" h set "CO_DISPARO" = v_disparo
     where h."CO_LIBERACAO" = v_liberacao and h."TP_EVENTO" = 'LIBERACAO';
  end if;
  return v_disparo;
end;
$function$;

-- de 20261030090000_lista_de_aprovados_substituir_preserva_o_estado.sql
alter table public."TL_DISPARO_ROBO" add constraint "CK_DISPROBO_NOWORKFLOW" check ("NO_WORKFLOW" = any (array[
  'sincronizar-entrevistas.yml', 'sincronizar-selecao.yml', 'conferencias.yml', 'expurgo-anexos-chat.yml',
  'robo-empregare.yml', 'pre-classificacao.yml', 'leitura-de-arquivos.yml', 'classificacao.yml',
  'contratacao-dos-aprovados.yml', 'pacotes-dos-paineis.yml', 'casamento-da-lista.yml']));

-- de 20261023200000_classificacao_em_python_etapa_2b.sql
alter table public."TB_CHAVE_AUTOMACAO" add constraint "CK_CHAVEAUTOM_COCHAVE" check ("CO_CHAVE" in (
  'entrevistas', 'selecao', 'kpis_do_edital', 'robo_de_inscricoes',
  'pre_classificacao', 'conferencias', 'paineis', 'manutencao', 'classificacao', 'classificacao_calculo'));

-- Comentários vigentes antes de 20261109180000
comment on function private."FC_DISPARAR_ROBO"(text, jsonb, uuid, text) is
  'Único caminho do banco até o GitHub (20261008140000): pede a execução (workflow_dispatch, ramo main) de um workflow da lista fixa, com os inputs que ele aceita (texto até 20000; o robô da Empregare aceita modo, editais, vagas, limite, anexos, candidatos, seco e forcar_congelado; a pré-classificação, modo, editais e forcar_congelado; a classificação em Python, desde 20261023170000, modo e listas). Origem (20261020170000): MONITORA com p_usuario (vai como disparado_por); AGENDA só do pg_cron (p_origem = AGENDA nas tarefas ou a sessão pg_cron; disparado_por = AGENDA); MANUAL quando chamada direto pelo SQL, sem usuário (disparado_por = manual). Chaves da automação (20261022190000): na origem AGENDA, com a chave do workflow desligada (FC_CHAVE_DO_WORKFLOW, TB_CHAVE_AUTOMACAO), não pede nada e devolve nulo. Lê a chave github_disparo_robos do Vault na hora e só a entrega ao pg_net; sem a chave, registra SEM_TOKEN e sai sem erro. Grava o pedido em TL_DISPARO_ROBO e devolve o CO_DISPARO. 22023 para workflow fora da lista, origem ou input recusado. Só o dono (pg_cron e as RPCs SECURITY DEFINER).';
comment on function private."FC_CHAVE_DO_WORKFLOW"(text) is
  'Chave da automação que manda nos pedidos da agenda (origem AGENDA) de cada workflow da lista fixa de FC_DISPARAR_ROBO. 20261022190000; classificacao.yml desde 20261023170000.';
comment on function private."FC_CHAVE_DA_TAREFA"(text) is
  'Chave da automação (TB_CHAVE_AUTOMACAO) que liga e desliga a tarefa do pg_cron; nulo = sempre ligada (ex.: agsus_robo_conferir_disparos). 20261022190000.';
comment on function private."FC_AUTOMACAO_LIGADA"(text) is
  'true quando a chave da automação está ligada (ou não existe: chave nula ou fora da lista). 20261022190000.';
comment on function private."FC_MOTIVO_COM_SENTIDO"(text) is
  'Motivo com sentido (20261103213000): 15 a 500 caracteres, 3 palavras ou mais, ao menos 2 palavras de verdade (3+ letras, com vogal, sem 5 consoantes nem 3 letras iguais seguidas) e 5 letras diferentes. Recusa teclado batido. A tela usa a mesma regra (src/lib/chaves-da-automacao.ts).';
comment on function public.registrar_disparo_externo(text, text, text, text) is
  'Workflows do GitHub Actions (service_role, 20261020170000): no início de uma execução iniciada direto no GitHub (Run workflow, gh workflow run — disparado_por vazio), registra em TL_DISPARO_ROBO a origem GITHUB, a situação INICIADO, o ator (github.triggering_actor, login válido ou nulo), o endereço da execução e um resumo curto (até 300). Uma linha por execução (repetir devolve a mesma). 22023 para workflow fora da lista ou endereço inválido. O workflow nunca falha por causa deste registro.';
comment on function public.alterar_chave_da_automacao(text, boolean, text) is
  'Liga (p_ligar = true) ou desliga uma chave da automação (20261022190000), com motivo de verdade (private."FC_MOTIVO_COM_SENTIDO", 20261103213000: 15 a 500 caracteres, 3 palavras ou mais, sem teclado batido): liga ou desliga junto as tarefas do pg_cron da chave (cron.alter_job active), grava o estado em TB_CHAVE_AUTOMACAO e o evento, com as tarefas mexidas, em TH_CHAVE_AUTOMACAO, e devolve obter_chaves_da_automacao. Só o administrador global. 28000 sem sessão, 42501 sem permissão, 22023 entrada inválida, 55000 já está no estado pedido.';
comment on function public.obter_chaves_da_automacao() is
  'Configurações › Automação (20261022190000): as chaves da automação (ligada, motivo, em, por), as tarefas do pg_cron de cada uma (agenda, ativa, última execução), o último pedido da agenda ao GitHub, a última pré-classificação automática, as tarefas sem chave (sempre ligadas) e os 50 últimos eventos. Só o administrador global (28000 sem sessão, 42501 os demais).';
comment on function public.automacao_ligada(text) is
  'Workflows do GitHub Actions (service_role, 20261022190000): a chave da automação está ligada? A pré-classificação chamada no fim do robô da Empregare (pre-classificacao.yml, apos_robo) pergunta pre_classificacao antes de rodar (python/monitora/chave_da_automacao.py). Chave fora da lista = ligada.';
comment on function public.disparar_robo(text, jsonb) is
  'Rodar agora, Opções (Status das atualizações) e Recalcular (pré-classificação) pelo banco (20261008140000; substitui api/rodar-carga.js): confere quem pede (administrador global: qualquer robô e opções; coordenação: só a pré-classificação de um edital pelo id, modo normal), a lista branca do robô (modo, editais, vagas, limite, anexos; no robô da Empregare o modo "anexos" — só relê os anexos do questionário, sem exportar nem pré-classificar; pede vagas ou editais — com "candidatos" e "seco", que só valem nele; desde 20261023200000, o relatório de desempate da Classificação em Python, "classificacao_desempate", só no modo normal: prepara os relatórios e os cálculos pendentes), o pedido repetido em 2 min (55006) e, desde 20261022170000, a execução que já espera a vez no grupo de concorrência do GitHub (55006: o pedido novo a cancelaria). Inscrições congeladas (20261020170000): nos modos que gravam (robô: normal, forcar e, desde 20261022170000, anexos sem "seco"; pré-classificação: normal e refazer_lote), edital ou vaga pedidos de edital congelado dão 55000, salvo forcar_congelado = true com motivo (10 a 500), só do administrador global — grava a LIBERACAO em TH_CONGELAMENTO_INSCRICAO (12 h) e manda o token como forcar_congelado. Pede o workflow por FC_DISPARAR_ROBO com disparado_por = id de quem pediu e devolve o CO_DISPARO de TL_DISPARO_ROBO (acompanhe por situacao_do_disparo_robo). 28000 sem sessão, 42501 sem permissão, 22023 para opção inválida.';
comment on constraint "CK_DISPROBO_NOWORKFLOW" on public."TL_DISPARO_ROBO" is
  'Workflows que o banco pede (lista fixa de FC_DISPARAR_ROBO) ou registra; pacotes-dos-paineis.yml desde 20261029180000; casamento-da-lista.yml desde 20261030090000.';
comment on column public."TL_DISPARO_ROBO"."NO_WORKFLOW" is 'Arquivo do workflow pedido (lista fixa: os 6 robôs de ROBOS_DE_CARGA).';
