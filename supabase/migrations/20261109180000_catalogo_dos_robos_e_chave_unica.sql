/*
  CATÁLOGO DOS ROBÔS E A CHAVE DA AUTOMAÇÃO COMO ÚNICA FONTE DO QUE ESTÁ LIGADO

  Pedido de 09/11/2026 (revisão do Status das atualizações e da Automação).

  O PROBLEMA
    1. O catálogo dos robôs estava espalhado em listas fixas que tinham de ser
       mudadas juntas a cada workflow novo: c_aceitos de FC_DISPARAR_ROBO, o
       CHECK CK_DISPROBO_NOWORKFLOW, FC_CHAVE_DO_WORKFLOW, FC_CHAVE_DA_TAREFA e
       a lista de registrar_disparo_externo. FC_DISPARAR_ROBO foi recopiada
       inteira 19 vezes em 10 migrations; cada cópia podia desfazer uma correção.
    2. "Ligada" tinha dois estados que podiam divergir: TB_CHAVE_AUTOMACAO e o
       cron.job.active. Os pedidos ao GitHub conferem a chave (FC_DISPARAR_ROBO),
       mas as tarefas só de SQL (Pacotes dos painéis, Manutenção, KPIs) obedeciam
       só ao active: uma migration com cron.schedule ou alter_job(active => true)
       as religava com a chave desligada, e a tela seguia dizendo "Desligada".

  O QUE MUDA
    1. Catálogo em duas tabelas, só de leitura para o app (sem RPC de escrita:
       o que o banco pode pedir ao GitHub continua decidido por migration):
         TB_ROBO_WORKFLOW     workflow → nome, chave, inputs aceitos, se o banco
                              pode pedir (ST_DISPARAVEL) e se o workflow pode se
                              registrar (ST_REGISTRO_EXTERNO, origem GITHUB).
         TB_TAREFA_AGENDADA   tarefa do pg_cron (nome ou prefixo) → rótulo, chave
                              e o workflow que ela pede em todo horário.
       As linhas são exatamente as listas fixas de hoje (a guarda do passo 3
       confere). Workflow novo passa a ser um INSERT numa migration.
    2. FC_DISPARAR_ROBO, FC_CHAVE_DO_WORKFLOW, FC_CHAVE_DA_TAREFA e
       registrar_disparo_externo leem o catálogo, com as MESMAS assinaturas e
       respostas: quem as chama (disparar_robo, FC_PAINEIS_RODADA, contratação,
       classificação, obter_chaves_da_automacao) não muda. FC_DISPARAR_ROBO e
       registrar_disparo_externo são o corpo de antes com só a lista trocada.
    3. CK_DISPROBO_NOWORKFLOW vira a chave estrangeira FK_DISPROBO_ROBOWKF.
    4. A chave manda: private."FC_ALINHAR_TAREFAS_DAS_CHAVES" põe cada tarefa do
       pg_cron com chave no estado da chave (cron.alter_job active). Roda em
       alterar_chave_da_automacao (no lugar do laço de antes; mesmas tarefas,
       mesmo histórico) e sozinha a cada 5 min (agsus_alinhar_chaves_da_automacao,
       sem chave). Quando a rodada sozinha acerta alguma tarefa, grava o evento em
       TH_CHAVE_AUTOMACAO (sem usuário). Tarefa sem chave nunca é tocada.
    5. public.obter_catalogo_dos_robos(): o catálogo para a tela (nomes dos
       workflows e das tarefas), só administrador global.

  GUARDAS (a migration não aplica nada se falhar)
    - Já aplicada (TB_ROBO_WORKFLOW existe).
    - As cinco funções trocadas não são as que esta migration conhece (md5 do
      corpo): alguém as mudou depois; junte as mudanças antes de aplicar.
    - Algum pedido em TL_DISPARO_ROBO com workflow fora do catálogo.
    - Chave LIGADA com tarefa do pg_cron PARADA: o alinhador a religaria. Decida
      antes, pela tela (desligue a chave) ou religue a tarefa.
    Chave DESLIGADA com tarefa ATIVA é o defeito que esta migration corrige: a
    tarefa é desligada e o evento fica no histórico da chave.

  Ensaio: supabase/ensaios/20261109180000_catalogo_dos_robos_e_chave_unica.sql
  Rollback: supabase/rollback/20261109180000_catalogo_dos_robos_e_chave_unica.sql
  Testes: tests/catalogo-dos-robos-migration.test.ts (estáticos) e
          tests/catalogo-dos-robos-no-banco.test.ts (Postgres de verdade, PGlite:
          antes × depois × rollback com as mesmas respostas).
*/
begin;

set local lock_timeout = '5s';

-- 0. Guardas ---------------------------------------------------------------------------------
do $$
begin
  if to_regclass('public."TB_ROBO_WORKFLOW"') is not null then
    raise exception 'A migration 20261109180000 já foi aplicada (TB_ROBO_WORKFLOW existe).';
  end if;
  if to_regclass('cron.job') is null then
    raise exception 'O pg_cron precisa estar ligado (Database → Extensions → pg_cron).';
  end if;
  if to_regclass('public."TB_CHAVE_AUTOMACAO"') is null
     or to_regclass('public."TH_CHAVE_AUTOMACAO"') is null
     or to_regclass('public."TL_DISPARO_ROBO"') is null
     or to_regprocedure('private."FC_AUTOMACAO_LIGADA"(text)') is null
     or to_regprocedure('private."FC_MOTIVO_COM_SENTIDO"(text)') is null
     or to_regprocedure('public.obter_chaves_da_automacao()') is null then
    raise exception 'Aplique antes 20261022190000, 20261030090000 e 20261103213000.';
  end if;
  -- As funções abaixo partem das que estão no banco: se outra migration (ou um ajuste à mão)
  -- as mudou depois, o corpo não bate e nada é aplicado.
  if md5((select prosrc from pg_proc where oid = to_regprocedure('private."FC_DISPARAR_ROBO"(text, jsonb, uuid, text)')))
       is distinct from 'df009c3fc64590e321d9b90aaf409d4d'
     or md5((select prosrc from pg_proc where oid = to_regprocedure('private."FC_CHAVE_DO_WORKFLOW"(text)')))
       is distinct from '6cb3e6b7cb3583fa3beae3565746a754'
     or md5((select prosrc from pg_proc where oid = to_regprocedure('private."FC_CHAVE_DA_TAREFA"(text)')))
       is distinct from '3a93374670cda37cabbc12f63e90e724'
     or md5((select prosrc from pg_proc where oid = to_regprocedure('public.registrar_disparo_externo(text, text, text, text)')))
       is distinct from 'f24d5f873ef0ea2a5b01c8b001f6e192'
     or md5((select prosrc from pg_proc where oid = to_regprocedure('public.alterar_chave_da_automacao(text, boolean, text)')))
       is distinct from 'e2ade3be541c70ca54e1b541ed32ffea' then
    raise exception 'FC_DISPARAR_ROBO, FC_CHAVE_DO_WORKFLOW, FC_CHAVE_DA_TAREFA, registrar_disparo_externo ou alterar_chave_da_automacao mudou depois de 20261103213000: junte as mudanças antes de aplicar.';
  end if;
end;
$$;

-- 1. O catálogo dos workflows ----------------------------------------------------------------
create table public."TB_ROBO_WORKFLOW" (
  "NO_WORKFLOW" character varying(60) not null,
  "NO_ROBO" character varying(80) not null,
  "CO_CHAVE" character varying(40),
  "DS_INPUT_ACEITO" text[] not null default '{}',
  "ST_DISPARAVEL" character varying(1) not null,
  "ST_REGISTRO_EXTERNO" character varying(1) not null,
  "DT_CRIACAO" timestamptz not null default now(),
  constraint "PK_TB_ROBO_WORKFLOW" primary key ("NO_WORKFLOW"),
  constraint "FK_ROBOWKF_CHAVEAUTOM" foreign key ("CO_CHAVE")
    references public."TB_CHAVE_AUTOMACAO" ("CO_CHAVE") on delete restrict,
  constraint "CK_ROBOWKF_NOWORKFLOW" check ("NO_WORKFLOW" ~ '^[a-z0-9]+(-[a-z0-9]+)*\.yml$'),
  constraint "CK_ROBOWKF_STDISPARAVEL" check ("ST_DISPARAVEL" in ('S', 'N')),
  constraint "CK_ROBOWKF_STREGEXTERNO" check ("ST_REGISTRO_EXTERNO" in ('S', 'N')),
  constraint "CK_ROBOWKF_DSINPUTACEITO" check (
    cardinality("DS_INPUT_ACEITO") <= 20
    and array_to_string("DS_INPUT_ACEITO", ',') ~ '^([a-z_]+(,[a-z_]+)*)?$'
    and not ('disparado_por' = any ("DS_INPUT_ACEITO"))
    and ("ST_DISPARAVEL" = 'S' or cardinality("DS_INPUT_ACEITO") = 0))
);
comment on table public."TB_ROBO_WORKFLOW" is
  'Catálogo dos workflows do GitHub Actions que o banco conhece (20261109180000): os que FC_DISPARAR_ROBO pode pedir (ST_DISPARAVEL), com os inputs aceitos e a chave da automação que manda nos pedidos da agenda, e os que podem se registrar por registrar_disparo_externo (ST_REGISTRO_EXTERNO). Substitui as listas fixas de FC_DISPARAR_ROBO, CK_DISPROBO_NOWORKFLOW, FC_CHAVE_DO_WORKFLOW e registrar_disparo_externo. Escrita só por migration.';
comment on column public."TB_ROBO_WORKFLOW"."NO_WORKFLOW" is 'Arquivo do workflow em .github/workflows (ex.: conferencias.yml).';
comment on column public."TB_ROBO_WORKFLOW"."NO_ROBO" is 'Nome do robô na tela (Status das atualizações).';
comment on column public."TB_ROBO_WORKFLOW"."CO_CHAVE" is 'Chave da automação (TB_CHAVE_AUTOMACAO) que, desligada, impede os pedidos da agenda (origem AGENDA); nulo = sem chave.';
comment on column public."TB_ROBO_WORKFLOW"."DS_INPUT_ACEITO" is 'Inputs do workflow_dispatch que o banco aceita mandar (além de disparado_por, que o banco sempre põe).';
comment on column public."TB_ROBO_WORKFLOW"."ST_DISPARAVEL" is 'S = FC_DISPARAR_ROBO pode pedir este workflow; N = só registro (ex.: leitura-de-arquivos.yml) ou histórico.';
comment on column public."TB_ROBO_WORKFLOW"."ST_REGISTRO_EXTERNO" is 'S = a execução iniciada direto no GitHub pode se registrar (registrar_disparo_externo, origem GITHUB).';
comment on column public."TB_ROBO_WORKFLOW"."DT_CRIACAO" is 'Quando entrou no catálogo.';
comment on constraint "PK_TB_ROBO_WORKFLOW" on public."TB_ROBO_WORKFLOW" is 'Um workflow por linha.';
comment on constraint "FK_ROBOWKF_CHAVEAUTOM" on public."TB_ROBO_WORKFLOW" is 'Chave da automação do workflow.';
comment on constraint "CK_ROBOWKF_NOWORKFLOW" on public."TB_ROBO_WORKFLOW" is 'Nome de arquivo .yml em kebab-case (vai na URL da API do GitHub).';
comment on constraint "CK_ROBOWKF_STDISPARAVEL" on public."TB_ROBO_WORKFLOW" is 'S ou N.';
comment on constraint "CK_ROBOWKF_STREGEXTERNO" on public."TB_ROBO_WORKFLOW" is 'S ou N.';
comment on constraint "CK_ROBOWKF_DSINPUTACEITO" on public."TB_ROBO_WORKFLOW" is 'Até 20 inputs em snake_case, sem disparado_por; workflow que o banco não pede não aceita input.';
create index "IN_ROBOWKF_COCHAVE" on public."TB_ROBO_WORKFLOW" ("CO_CHAVE");
comment on index public."IN_ROBOWKF_COCHAVE" is 'Índice da chave estrangeira para a chave da automação.';
alter table public."TB_ROBO_WORKFLOW" enable row level security;
revoke all on public."TB_ROBO_WORKFLOW" from public, anon, authenticated, service_role;

insert into public."TB_ROBO_WORKFLOW"
       ("NO_WORKFLOW", "NO_ROBO", "CO_CHAVE", "DS_INPUT_ACEITO", "ST_DISPARAVEL", "ST_REGISTRO_EXTERNO")
values
  ('sincronizar-entrevistas.yml', 'Entrevistas', 'entrevistas', '{modo}', 'S', 'S'),
  ('sincronizar-selecao.yml', 'Seleção', 'selecao', '{modo}', 'S', 'S'),
  ('conferencias.yml', 'Conferências', 'conferencias', '{modo}', 'S', 'S'),
  ('robo-empregare.yml', 'Robô da Empregare', 'robo_de_inscricoes',
   '{modo,editais,vagas,limite,anexos,candidatos,seco,forcar_congelado}', 'S', 'S'),
  ('pre-classificacao.yml', 'Triagem', 'pre_classificacao', '{modo,editais,forcar_congelado}', 'S', 'S'),
  ('classificacao.yml', 'Classificação em Python', 'classificacao', '{modo,listas}', 'S', 'S'),
  ('contratacao-dos-aprovados.yml', 'Contratado em outra lista', 'conferencias', '{modo}', 'S', 'N'),
  ('pacotes-dos-paineis.yml', 'Pacotes dos painéis', 'paineis', '{modo}', 'S', 'N'),
  ('casamento-da-lista.yml', 'Casamento da lista de aprovados', null, '{modo,pedido}', 'S', 'N'),
  ('leitura-de-arquivos.yml', 'Leitura dos arquivos', null, '{}', 'N', 'S'),
  ('expurgo-anexos-chat.yml', 'Expurgo dos anexos do chat (saiu com o chat)', null, '{}', 'N', 'N');

-- 2. O catálogo das tarefas do pg_cron --------------------------------------------------------
create table public."TB_TAREFA_AGENDADA" (
  "NO_TAREFA" character varying(63) not null,
  "ST_PREFIXO" character varying(1) not null default 'N',
  "DS_ROTULO" character varying(120) not null,
  "CO_CHAVE" character varying(40),
  "NO_WORKFLOW" character varying(60),
  "DT_CRIACAO" timestamptz not null default now(),
  constraint "PK_TB_TAREFA_AGENDADA" primary key ("NO_TAREFA"),
  constraint "FK_TAREFAGEND_CHAVEAUTOM" foreign key ("CO_CHAVE")
    references public."TB_CHAVE_AUTOMACAO" ("CO_CHAVE") on delete restrict,
  constraint "FK_TAREFAGEND_ROBOWKF" foreign key ("NO_WORKFLOW")
    references public."TB_ROBO_WORKFLOW" ("NO_WORKFLOW") on delete restrict,
  constraint "CK_TAREFAGEND_NOTAREFA" check ("NO_TAREFA" ~ '^agsus_[a-z0-9_]+$'),
  constraint "CK_TAREFAGEND_STPREFIXO" check ("ST_PREFIXO" in ('S', 'N'))
);
comment on table public."TB_TAREFA_AGENDADA" is
  'Catálogo das tarefas do pg_cron do MONITORA (20261109180000): rótulo na tela, a chave da automação que liga e desliga a tarefa (FC_CHAVE_DA_TAREFA, FC_ALINHAR_TAREFAS_DAS_CHAVES) e o workflow que ela pede ao GitHub em todo horário. Substitui a lista fixa de FC_CHAVE_DA_TAREFA. Escrita só por migration.';
comment on column public."TB_TAREFA_AGENDADA"."NO_TAREFA" is 'cron.job.jobname, ou o começo dele quando ST_PREFIXO = S (ex.: agsus_robo_inscricoes_).';
comment on column public."TB_TAREFA_AGENDADA"."ST_PREFIXO" is 'S = vale para toda tarefa cujo nome começa por NO_TAREFA; N = nome exato. O nome exato ganha do prefixo.';
comment on column public."TB_TAREFA_AGENDADA"."DS_ROTULO" is 'Nome da tarefa na tela (Status das atualizações).';
comment on column public."TB_TAREFA_AGENDADA"."CO_CHAVE" is 'Chave da automação (TB_CHAVE_AUTOMACAO) que liga e desliga a tarefa; nulo = sempre ligada.';
comment on column public."TB_TAREFA_AGENDADA"."NO_WORKFLOW" is 'Workflow que a tarefa pede ao GitHub em todo horário (TB_ROBO_WORKFLOW); nulo = só SQL, ou pede só às vezes (pacotes dos painéis).';
comment on column public."TB_TAREFA_AGENDADA"."DT_CRIACAO" is 'Quando entrou no catálogo.';
comment on constraint "PK_TB_TAREFA_AGENDADA" on public."TB_TAREFA_AGENDADA" is 'Uma tarefa (ou prefixo) por linha.';
comment on constraint "FK_TAREFAGEND_CHAVEAUTOM" on public."TB_TAREFA_AGENDADA" is 'Chave da automação da tarefa.';
comment on constraint "FK_TAREFAGEND_ROBOWKF" on public."TB_TAREFA_AGENDADA" is 'Workflow que a tarefa pede.';
comment on constraint "CK_TAREFAGEND_NOTAREFA" on public."TB_TAREFA_AGENDADA" is 'Tarefas do MONITORA começam por agsus_.';
comment on constraint "CK_TAREFAGEND_STPREFIXO" on public."TB_TAREFA_AGENDADA" is 'S ou N.';
create index "IN_TAREFAGEND_COCHAVE" on public."TB_TAREFA_AGENDADA" ("CO_CHAVE");
comment on index public."IN_TAREFAGEND_COCHAVE" is 'Índice da chave estrangeira para a chave da automação.';
create index "IN_TAREFAGEND_NOWORKFLOW" on public."TB_TAREFA_AGENDADA" ("NO_WORKFLOW");
comment on index public."IN_TAREFAGEND_NOWORKFLOW" is 'Índice da chave estrangeira para o workflow.';
alter table public."TB_TAREFA_AGENDADA" enable row level security;
revoke all on public."TB_TAREFA_AGENDADA" from public, anon, authenticated, service_role;

insert into public."TB_TAREFA_AGENDADA" ("NO_TAREFA", "ST_PREFIXO", "DS_ROTULO", "CO_CHAVE", "NO_WORKFLOW")
values
  ('agsus_robo_sincronizar_entrevistas', 'N', 'Agenda: pedir a carga das Entrevistas', 'entrevistas', 'sincronizar-entrevistas.yml'),
  ('agsus_robo_sincronizar_selecao', 'N', 'Agenda: pedir a carga da Seleção', 'selecao', 'sincronizar-selecao.yml'),
  ('agsus_robo_conferencias', 'N', 'Agenda: pedir as conferências', 'conferencias', 'conferencias.yml'),
  ('agsus_robo_inscricoes_', 'S', 'Agenda das inscrições: pedir o robô da Empregare', 'robo_de_inscricoes', 'robo-empregare.yml'),
  ('agsus_kpis_do_edital_pela_selecao', 'N', 'KPIs do edital pela Seleção', 'kpis_do_edital', null),
  ('agsus_analises_cache_do_painel', 'N', 'Painel de análises (pacote pronto)', 'paineis', null),
  ('agsus_aprovados_cache_por_area', 'N', 'Lista de aprovados (pacote por área)', 'paineis', null),
  ('agsus_entrevistas_cache_do_painel', 'N', 'Painel de entrevistas (pacote pronto)', 'paineis', null),
  ('agsus_analises_analyze_diario', 'N', 'Estatísticas das tabelas de análises', 'manutencao', null),
  ('agsus_fila_estatisticas', 'N', 'Estatísticas da fila da Avaliação documental', 'manutencao', null),
  ('agsus_analises_encerrar_inativas', 'N', 'Encerrar cargas de análises paradas', 'manutencao', null),
  ('agsus_eventos_acesso_limpeza_mensal', 'N', 'Limpeza do registro de acessos', 'manutencao', null),
  ('agsus_robo_conferir_disparos', 'N', 'Agenda: conferir as respostas do GitHub', null, null),
  ('agsus_analises_limpar_manifesto', 'N', 'Limpeza do manifesto das cargas de análises', null, null),
  ('agsus_inativar_listas_vencidas', 'N', 'Inativar as listas de aprovados vencidas', null, null),
  ('agsus_cron_limpar_historico', 'N', 'Limpeza do histórico do pg_cron', null, null),
  ('agsus_alinhar_chaves_da_automacao', 'N', 'Alinhar as tarefas com as chaves da automação', null, null);

-- 3. As funções de chave leem o catálogo (mesmas assinaturas e respostas) --------------------
create or replace function private."FC_CHAVE_DO_WORKFLOW"(p_workflow text)
returns text
language sql
stable
set search_path to ''
as $function$
  select w."CO_CHAVE" from public."TB_ROBO_WORKFLOW" w where w."NO_WORKFLOW" = p_workflow;
$function$;
comment on function private."FC_CHAVE_DO_WORKFLOW"(text) is
  'Chave da automação que manda nos pedidos da agenda (origem AGENDA) de um workflow, pelo catálogo TB_ROBO_WORKFLOW (20261109180000; antes, lista fixa desde 20261022190000). Nulo = sem chave ou fora do catálogo.';

create or replace function private."FC_CHAVE_DA_TAREFA"(p_tarefa text)
returns text
language sql
stable
set search_path to ''
as $function$
  select t."CO_CHAVE"
    from public."TB_TAREFA_AGENDADA" t
   where t."NO_TAREFA" = p_tarefa
      or (t."ST_PREFIXO" = 'S' and starts_with(p_tarefa, t."NO_TAREFA"))
   order by (t."NO_TAREFA" = p_tarefa) desc, length(t."NO_TAREFA") desc
   limit 1;
$function$;
comment on function private."FC_CHAVE_DA_TAREFA"(text) is
  'Chave da automação (TB_CHAVE_AUTOMACAO) que liga e desliga a tarefa do pg_cron, pelo catálogo TB_TAREFA_AGENDADA (20261109180000; antes, lista fixa desde 20261022190000): o nome exato ganha do prefixo. Nulo = sempre ligada (ex.: agsus_robo_conferir_disparos) ou fora do catálogo.';

-- 4. FC_DISPARAR_ROBO e registrar_disparo_externo: o corpo de antes, com o catálogo no lugar da lista
CREATE OR REPLACE FUNCTION private."FC_DISPARAR_ROBO"(p_workflow text, p_inputs jsonb DEFAULT '{}'::jsonb, p_usuario uuid DEFAULT NULL::uuid, p_origem text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  -- Catálogo (TB_ROBO_WORKFLOW, 20261109180000): inputs que o workflow aceita (além de disparado_por).
  v_aceitos text[];
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
  select w."DS_INPUT_ACEITO" into v_aceitos
    from public."TB_ROBO_WORKFLOW" w
   where w."NO_WORKFLOW" = p_workflow and w."ST_DISPARAVEL" = 'S';
  if p_workflow is null or v_aceitos is null then
    raise exception 'Workflow fora da lista fixa dos robôs' using errcode = '22023';
  end if;
  if p_origem is not null and p_origem <> 'AGENDA' then
    raise exception 'Origem inválida (só AGENDA, nas tarefas do pg_cron)' using errcode = '22023';
  end if;
  if jsonb_typeof(v_inputs) <> 'object'
     or exists (
       select 1 from jsonb_each(v_inputs) i
        where not (i.key = any (v_aceitos))
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
  'Único caminho do banco até o GitHub (20261008140000): pede a execução (workflow_dispatch, ramo main) de um workflow do catálogo TB_ROBO_WORKFLOW com ST_DISPARAVEL = S (20261109180000; antes, lista fixa), com os inputs que ele aceita (DS_INPUT_ACEITO; texto até 20000). Origem (20261020170000): MONITORA com p_usuario (vai como disparado_por); AGENDA só do pg_cron (p_origem = AGENDA nas tarefas ou a sessão pg_cron; disparado_por = AGENDA); MANUAL quando chamada direto pelo SQL, sem usuário (disparado_por = manual). Chaves da automação (20261022190000): na origem AGENDA, com a chave do workflow desligada (FC_CHAVE_DO_WORKFLOW), não pede nada e devolve nulo. Lê a chave github_disparo_robos do Vault na hora e só a entrega ao pg_net; sem a chave, registra SEM_TOKEN e sai sem erro. Grava o pedido em TL_DISPARO_ROBO e devolve o CO_DISPARO. 22023 para workflow fora do catálogo, origem ou input recusado. Só o dono (pg_cron e as RPCs SECURITY DEFINER).';

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
  if p_workflow is null or not exists (
       select 1 from public."TB_ROBO_WORKFLOW" w
        where w."NO_WORKFLOW" = p_workflow and w."ST_REGISTRO_EXTERNO" = 'S') then
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
  'Workflows do GitHub Actions (service_role, 20261020170000): a execução iniciada direto no GitHub (Run workflow) se registra em TL_DISPARO_ROBO com origem GITHUB, o ator e o link; repetir não duplica. Só workflows do catálogo com ST_REGISTRO_EXTERNO = S (20261109180000; antes, lista fixa). 22023 para workflow fora do catálogo ou link inválido.';

-- 5. O log dos pedidos aponta para o catálogo ------------------------------------------------
do $$
declare
  v_fora text;
begin
  select string_agg(distinct d."NO_WORKFLOW", ', ' order by d."NO_WORKFLOW") into v_fora
    from public."TL_DISPARO_ROBO" d
   where not exists (select 1 from public."TB_ROBO_WORKFLOW" w where w."NO_WORKFLOW" = d."NO_WORKFLOW");
  if v_fora is not null then
    raise exception 'TL_DISPARO_ROBO tem pedidos de workflow fora do catálogo: %. Inclua no catálogo antes.', v_fora;
  end if;
end;
$$;
alter table public."TL_DISPARO_ROBO" drop constraint "CK_DISPROBO_NOWORKFLOW";
alter table public."TL_DISPARO_ROBO" add constraint "FK_DISPROBO_ROBOWKF" foreign key ("NO_WORKFLOW")
  references public."TB_ROBO_WORKFLOW" ("NO_WORKFLOW") on delete restrict;
comment on constraint "FK_DISPROBO_ROBOWKF" on public."TL_DISPARO_ROBO" is
  'Workflow do catálogo TB_ROBO_WORKFLOW (20261109180000; antes, CK_DISPROBO_NOWORKFLOW com a lista fixa).';
create index "IN_DISPROBO_NOWORKFLOW" on public."TL_DISPARO_ROBO" ("NO_WORKFLOW");
comment on index public."IN_DISPROBO_NOWORKFLOW" is 'Índice da chave estrangeira para o catálogo dos workflows.';
comment on column public."TL_DISPARO_ROBO"."NO_WORKFLOW" is 'Arquivo do workflow (catálogo TB_ROBO_WORKFLOW, 20261109180000).';

-- 6. A chave manda no pg_cron ------------------------------------------------------------------
create function private."FC_ALINHAR_TAREFAS_DAS_CHAVES"(p_chave text default null)
returns text[]
language plpgsql
security definer
set search_path to ''
as $function$
declare
  c_motivo constant text :=
    'O banco realinhou ao estado da chave as tarefas do pg_cron que estavam fora dele (FC_ALINHAR_TAREFAS_DAS_CHAVES).';
  v_tarefa record;
  v_mexidas text[] := '{}';
  v_por_chave jsonb := '{}'::jsonb;
  v_chave text;
begin
  -- As chaves ficam travadas para leitura: ninguém muda uma chave no meio do alinhamento.
  for v_tarefa in
    select j.jobid, j.jobname::text as jobname, c."CO_CHAVE" as chave, (c."ST_LIGADA" = 'S') as ligada
      from cron.job j
      join public."TB_CHAVE_AUTOMACAO" c on c."CO_CHAVE" = private."FC_CHAVE_DA_TAREFA"(j.jobname)
     where (p_chave is null or c."CO_CHAVE" = p_chave)
       and j.active is distinct from (c."ST_LIGADA" = 'S')
     order by j.jobname
     for share of c
  loop
    perform cron.alter_job(v_tarefa.jobid, active := v_tarefa.ligada);
    v_mexidas := v_mexidas || v_tarefa.jobname;
    v_por_chave := jsonb_set(v_por_chave, array[v_tarefa.chave],
                             coalesce(v_por_chave -> v_tarefa.chave, '[]'::jsonb) || to_jsonb(v_tarefa.jobname));
  end loop;

  -- A rodada sozinha (sem p_chave) deixa o acerto no histórico da chave; quem chama com a
  -- chave (alterar_chave_da_automacao) grava o próprio evento, com as tarefas devolvidas.
  if p_chave is null then
    for v_chave in select k from jsonb_object_keys(v_por_chave) k order by k loop
      insert into public."TH_CHAVE_AUTOMACAO" ("CO_CHAVE", "ST_LIGADA", "DS_MOTIVO", "CO_USUARIO", "DS_TAREFAS")
      select v_chave, c."ST_LIGADA", c_motivo, null,
             array(select jsonb_array_elements_text(v_por_chave -> v_chave))
        from public."TB_CHAVE_AUTOMACAO" c
       where c."CO_CHAVE" = v_chave;
    end loop;
  end if;
  return v_mexidas;
end;
$function$;
comment on function private."FC_ALINHAR_TAREFAS_DAS_CHAVES"(text) is
  'A chave da automação manda (20261109180000): põe cada tarefa do pg_cron com chave (FC_CHAVE_DA_TAREFA) no estado da chave (cron.alter_job active) e devolve as tarefas mexidas, em ordem de nome. Com p_chave, só as daquela chave (alterar_chave_da_automacao); sem, todas, e grava o acerto em TH_CHAVE_AUTOMACAO sem usuário (tarefa agsus_alinhar_chaves_da_automacao, a cada 5 min). Tarefa sem chave nunca é tocada. Só o dono.';
revoke all on function private."FC_ALINHAR_TAREFAS_DAS_CHAVES"(text) from public, anon, authenticated, service_role;

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

  update public."TB_CHAVE_AUTOMACAO" set
    "ST_LIGADA" = case when p_ligar then 'S' else 'N' end,
    "DS_MOTIVO" = v_motivo,
    "CO_USUARIO_ATUALIZACAO" = v_uid,
    "DT_ATUALIZACAO" = now()
   where "CO_CHAVE" = p_chave;

  -- As tarefas do pg_cron da chave acompanham o estado gravado acima (o que já está nele fica):
  -- o mesmo alinhador da tarefa agsus_alinhar_chaves_da_automacao (20261109180000).
  v_tarefas := private."FC_ALINHAR_TAREFAS_DAS_CHAVES"(p_chave);
  insert into public."TH_CHAVE_AUTOMACAO" ("CO_CHAVE", "ST_LIGADA", "DS_MOTIVO", "CO_USUARIO", "DS_TAREFAS")
  values (p_chave, case when p_ligar then 'S' else 'N' end, v_motivo, v_uid, v_tarefas);

  return public.obter_chaves_da_automacao();
end;
$function$;
comment on function public.alterar_chave_da_automacao(text, boolean, text) is
  'Liga (p_ligar = true) ou desliga uma chave da automação (20261022190000), com motivo de verdade (private."FC_MOTIVO_COM_SENTIDO", 20261103213000: 15 a 500 caracteres, 3 palavras ou mais, sem teclado batido): grava o estado em TB_CHAVE_AUTOMACAO, põe as tarefas do pg_cron da chave no mesmo estado (FC_ALINHAR_TAREFAS_DAS_CHAVES, 20261109180000), grava o evento, com as tarefas mexidas, em TH_CHAVE_AUTOMACAO, e devolve obter_chaves_da_automacao. Só o administrador global. 28000 sem sessão, 42501 sem permissão, 22023 entrada inválida, 55000 já está no estado pedido.';

-- 7. O estado de hoje: chave ligada com tarefa parada pede decisão; desligada com tarefa ativa se corrige
do $$
declare
  v_paradas text;
  v_acertadas text[];
begin
  select string_agg(j.jobname || ' (chave ' || c."CO_CHAVE" || ')', ', ' order by j.jobname) into v_paradas
    from cron.job j
    join public."TB_CHAVE_AUTOMACAO" c on c."CO_CHAVE" = private."FC_CHAVE_DA_TAREFA"(j.jobname)
   where c."ST_LIGADA" = 'S' and not j.active;
  if v_paradas is not null then
    raise exception 'Chave ligada com tarefa parada no pg_cron: %. O alinhador religaria a tarefa. Decida antes: desligue a chave em Configurações › Automação ou religue a tarefa; depois aplique de novo.', v_paradas;
  end if;
  v_acertadas := private."FC_ALINHAR_TAREFAS_DAS_CHAVES"();
  if cardinality(v_acertadas) > 0 then
    raise notice 'Tarefas desligadas porque a chave delas está desligada: %', array_to_string(v_acertadas, ', ');
  end if;
end;
$$;

do $$
declare
  v_comando constant text :=
    'select private."FC_ALINHAR_TAREFAS_DAS_CHAVES"() where pg_try_advisory_xact_lock(hashtext(''agsus_alinhar_chaves_da_automacao''));';
  v_id bigint;
begin
  select jobid into v_id from cron.job where jobname = 'agsus_alinhar_chaves_da_automacao';
  if v_id is null then
    perform cron.schedule('agsus_alinhar_chaves_da_automacao', '*/5 * * * *', v_comando);
  else
    perform cron.alter_job(v_id, schedule => '*/5 * * * *', command => v_comando, active => true);
  end if;
end;
$$;

-- 8. O catálogo para a tela -------------------------------------------------------------------
create function public.obter_catalogo_dos_robos()
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Entre no MONITORA de novo.' using errcode = '28000';
  end if;
  if not private.is_master() then
    raise exception 'Somente o administrador global vê o catálogo dos robôs' using errcode = '42501';
  end if;
  return json_build_object(
    'schema_version', 1,
    'workflows', (
      select coalesce(json_agg(json_build_object(
          'workflow', w."NO_WORKFLOW",
          'nome', w."NO_ROBO",
          'chave', w."CO_CHAVE",
          'disparavel', w."ST_DISPARAVEL" = 'S'
        ) order by w."NO_WORKFLOW"), '[]'::json)
        from public."TB_ROBO_WORKFLOW" w),
    'tarefas', (
      select coalesce(json_agg(json_build_object(
          'tarefa', t."NO_TAREFA",
          'prefixo', t."ST_PREFIXO" = 'S',
          'rotulo', t."DS_ROTULO",
          'chave', t."CO_CHAVE",
          'workflow', t."NO_WORKFLOW"
        ) order by t."NO_TAREFA"), '[]'::json)
        from public."TB_TAREFA_AGENDADA" t)
  );
end;
$function$;
comment on function public.obter_catalogo_dos_robos() is
  'Status das atualizações (20261109180000): o catálogo dos robôs — nome de cada workflow (TB_ROBO_WORKFLOW) e rótulo, chave e workflow de cada tarefa do pg_cron (TB_TAREFA_AGENDADA). Só o administrador global (28000 sem sessão, 42501 os demais).';
revoke all on function public.obter_catalogo_dos_robos() from public, anon;
grant execute on function public.obter_catalogo_dos_robos() to authenticated;

commit;
