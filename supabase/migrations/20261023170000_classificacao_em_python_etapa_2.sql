/*
  CLASSIFICAÇÃO EM PYTHON (ETAPA 2a): O RELATÓRIO DE DESEMPATE DE TODA LISTA GERADA (23/10/2026)

  O QUE MUDA PARA QUEM USA
  Ao gerar uma lista em Classificação › Listas, o banco registra a lista (como
  antes) e pede ao GitHub o job da classificação em Python
  (.github/workflows/classificacao.yml, scripts/classificacao/classificacao.py
  --desempate). O job lê a lista registrada e os dados do edital, calcula a
  lista de novo em Python e, só se o retrato que ele calcula for IGUAL ao
  registrado, grava o relatório de desempate dela (o hash da lista é
  conferido de novo na gravação). Enquanto isso, a tela mostra "Relatório de
  desempate sendo preparado…"; quando chega, os botões do relatório aparecem.
  O cálculo da lista na tela continua com o motor.ts (a etapa 2b troca isso).

  1. classificacao_ler_edital (só service_role) passa a devolver os NOMES REAIS
     (decisão do usuário de 23/10/2026): a ordem alfabética do desempate final
     é calculada no Python como o motor.ts (localeCompare "pt-BR"), e o retrato
     conferido tem os nomes. Os nomes não vão para o log do Actions nem para as
     mensagens de erro. A collation private."CL_NOME_PT_BR_BASE", que só servia
     ao apelido, sai.
  2. Chave da automação nova, "classificacao" (Classificação em Python), nasce
     ligada: desligada, gerar a lista não pede o relatório (o preparo fica
     DESLIGADA). FC_CHAVE_DO_WORKFLOW e a lista fixa de FC_DISPARAR_ROBO ganham
     classificacao.yml (inputs: modo, listas); TL_DISPARO_ROBO aceita o workflow.
  3. public."TB_PREPARO_DESEMPATE": o preparo do relatório de cada lista
     gerada (PEDIDO, PREPARANDO, PRONTO, NAO_CONFERE, FALHOU, DESLIGADA,
     SEM_DISPARO), com a mensagem curta e sem dado pessoal.
  4. private."FC_PEDIR_DESEMPATE"(lista, usuário): confere a chave, pede o
     workflow (FC_DISPARAR_ROBO, origem MONITORA) e grava o preparo. Nunca
     derruba o registro da lista: falha vira SEM_DISPARO.
  5. registrar_lista_classificacao: o mesmo corpo (20261016160000) + o pedido
     do relatório depois de gravar a lista. Mesma assinatura.
  6. Job (só service_role): classificacao_ler_pedidos_desempate (os preparos
     pendentes, ou as listas pedidas), classificacao_ler_lista (o retrato
     registrado, o hash, o tipo e a versão da regra) e
     classificacao_marcar_preparo (PREPARANDO, NAO_CONFERE, FALHOU).
     classificacao_gravar_desempate: o mesmo corpo (20261023140000) + o preparo
     vira PRONTO.
  7. obter_desempate_da_lista (a tela): o relatório, como antes, e o preparo
     (situação, quando foi pedido, mensagem); null só quando a lista não tem
     nem relatório nem preparo.

  PRÉ-REQUISITOS: 20261023140000 (relatório de desempate) e 20261022190000
  (chaves da automação).

  Ensaio: supabase/ensaios/20261023170000_classificacao_em_python_etapa_2.sql
  Rollback: supabase/rollback/20261023170000_classificacao_em_python_etapa_2.sql
*/
begin;

set local lock_timeout = '5s';

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.classificacao_gravar_desempate(text, uuid, text, jsonb, text)') is null
     or to_regclass('public."TB_RELATORIO_DESEMPATE"') is null then
    raise exception 'Aplique antes 20261023140000_classificacao_em_python_e_relatorio_de_desempate.sql.';
  end if;
  if to_regclass('public."TB_CHAVE_AUTOMACAO"') is null
     or to_regprocedure('private."FC_AUTOMACAO_LIGADA"(text)') is null
     or to_regprocedure('private."FC_DISPARAR_ROBO"(text, jsonb, uuid, text)') is null then
    raise exception 'Aplique antes 20261022190000_chaves_da_automacao.sql.';
  end if;
end;
$$;

-- 1. Leitura do edital para o job, com os nomes reais ------------------------------------
create or replace function public.classificacao_ler_edital(p_edital uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text;
  v_dados jsonb;
begin
  select m."CO_AREA" into v_area from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital;
  if v_area is null then
    raise exception 'Edital não encontrado' using errcode = '22023';
  end if;
  v_dados := private."FC_DADOS_CLASSIFICACAO_EDITAL"(p_edital, v_area)::jsonb;

  return jsonb_build_object(
    'schema_version', 2,
    'gerado_em', now(),
    'edital', v_dados->'edital',
    'regra', case when v_dados->'regra' is null or jsonb_typeof(v_dados->'regra') = 'null' then null
                  else jsonb_build_object('versao', v_dados#>'{regra,versao}', 'configuracao', v_dados#>'{regra,configuracao}') end,
    'cronograma', v_dados->'cronograma',
    'quadro', v_dados->'quadro',
    -- Os nomes reais (o motor ordena por eles no desempate final e o retrato os leva).
    'candidatos', coalesce(v_dados->'candidatos', '[]'::jsonb),
    'entrevistas', coalesce(v_dados->'entrevistas', '[]'::jsonb),
    'desempates', coalesce((
      select jsonb_agg(d.value - 'por' order by d.ordinality)
        from jsonb_array_elements(coalesce(v_dados->'desempates', '[]'::jsonb)) with ordinality d), '[]'::jsonb),
    'ajustes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', j.value->'id', 'recurso_id', j.value->'recurso_id', 'numero', j.value->'numero',
               'analise_id', j.value->'analise_id', 'aprovado_em', j.value->'aprovado_em',
               'itens', coalesce((select jsonb_agg(i.value - 'justificativa' order by i.ordinality)
                                    from jsonb_array_elements(coalesce(j.value->'itens', '[]'::jsonb)) with ordinality i), '[]'::jsonb))
             order by j.ordinality)
        from jsonb_array_elements(coalesce(v_dados->'ajustes', '[]'::jsonb)) with ordinality j), '[]'::jsonb),
    'listas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', l."CO_LISTA_CLASSIFICACAO", 'tipo', l."TP_LISTA", 'versao_regra', l."NU_VERSAO_REGRA",
               'hash', l."DS_HASH", 'gerada_em', l."DT_GERACAO", 'publicada', l."ST_PUBLICADA" = 'S')
             order by l."DT_GERACAO" desc)
        from public."TB_LISTA_CLASSIFICACAO" l
       where l."CO_MONITORAMENTO" = p_edital), '[]'::jsonb),
    'convocacao', jsonb_build_object(
      'configuracoes', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'edital_id', c."CO_EDITAL",
                 'proporcionalidade', c."TP_CONVOCACAO" = 'COM_PROPORCIONALIDADE',
                 'modelo_id', c."CO_MODELO",
                 'padrao_imediata', c."QT_PADRAO_IMEDIATA",
                 'vagas', coalesce((
                   select jsonb_agg(jsonb_build_object(
                            'codigo_vaga', v."CO_VAGA", 'cargo', v."NO_CARGO", 'imediatas', v."QT_VAGA_IMEDIATA",
                            'manual', v."ST_QUADRO_MANUAL" = 'S', 'quadro', v."DS_QUADRO_MANUAL")
                          order by v."CO_VAGA")
                     from public."TB_VAGA_IMEDIATA" v
                    where v."CO_EDITAL" = c."CO_EDITAL"), '[]'::jsonb)))
          from public."TB_CONVOCACAO_EDITAL" c
         where c."CO_EDITAL" = p_edital::text), '[]'::jsonb),
      'modelos', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'modelo_id', m."CO_MODELO",
                 'nome', m."NO_MODELO",
                 'distribuicao', lower(m."TP_DISTRIBUICAO"),
                 'cota_multipla', lower(m."TP_COTA_MULTIPLA"),
                 'categorias', coalesce((
                   select jsonb_agg(jsonb_build_object(
                            'id', k."CO_CATEGORIA", 'rotulo', k."NO_CATEGORIA", 'sigla', k."SG_CATEGORIA",
                            'ampla', k."ST_AMPLA" = 'S', 'acumulavel', k."ST_ACUMULAVEL" = 'S',
                            'percentual', k."TX_RESERVA", 'arredondamento', lower(k."TP_ARREDONDAMENTO"),
                            'teto', k."TX_TETO", 'minimo', k."QT_MINIMA_RESERVA", 'termos', k."DS_TERMO",
                            'posicoes', k."DS_POSICAO", 'intervalo', k."QT_INTERVALO", 'cascata', k."DS_CASCATA")
                          order by k."NU_ORDEM", k."CO_CATEGORIA")
                     from public."TB_CATEGORIA_CONVOCACAO" k
                    where k."CO_MODELO" = m."CO_MODELO"), '[]'::jsonb))
               order by m."NO_MODELO")
          from public."TB_MODELO_CONVOCACAO" m
         where m."CO_MODELO" in (select c."CO_MODELO" from public."TB_CONVOCACAO_EDITAL" c where c."CO_EDITAL" = p_edital::text)),
        '[]'::jsonb)));
end;
$function$;
comment on function public.classificacao_ler_edital(uuid) is
  'Job da classificação em Python (scripts/classificacao/): o json de obter_classificacao_do_edital com os nomes reais dos candidatos (decisão de 23/10/2026: a ordem alfabética do desempate final é calculada no Python, como o motor.ts; os nomes não vão para o log), sem o conteúdo das listas geradas (id, tipo, hash), sem quem registrou desempates nem autores e justificativas dos ajustes, e com a configuração de convocação do edital. Só service_role.';
revoke all on function public.classificacao_ler_edital(uuid) from public, anon, authenticated;
grant execute on function public.classificacao_ler_edital(uuid) to service_role;

-- O apelido saiu: a collation que só servia a ele também.
drop collation if exists private."CL_NOME_PT_BR_BASE";

-- 2. A chave da automação "Classificação em Python" ---------------------------------------
alter table public."TB_CHAVE_AUTOMACAO" drop constraint "CK_CHAVEAUTOM_COCHAVE";
alter table public."TB_CHAVE_AUTOMACAO" add constraint "CK_CHAVEAUTOM_COCHAVE" check ("CO_CHAVE" in (
  'entrevistas', 'selecao', 'kpis_do_edital', 'robo_de_inscricoes',
  'pre_classificacao', 'conferencias', 'paineis', 'manutencao', 'classificacao'));
comment on constraint "CK_CHAVEAUTOM_COCHAVE" on public."TB_CHAVE_AUTOMACAO" is 'Só as chaves da lista fixa.';

do $$
declare
  c_setor constant uuid := 'a01afddb-f64b-47d9-80e8-476a1ed14e43';
  c_motivo constant text := 'Criada ligada pela migração 20261023170000: o relatório de desempate de cada lista gerada, pelo Python.';
  v_autor uuid;
begin
  select u.id into v_autor from auth.users u where u.id = c_setor;
  insert into public."TB_CHAVE_AUTOMACAO"
         ("CO_CHAVE", "NO_CHAVE", "NU_ORDEM", "ST_LIGADA", "DS_MOTIVO", "CO_USUARIO_ATUALIZACAO")
  values ('classificacao', 'Classificação em Python', 9, 'S', c_motivo, v_autor)
  on conflict ("CO_CHAVE") do nothing;
  if found then
    insert into public."TH_CHAVE_AUTOMACAO" ("CO_CHAVE", "ST_LIGADA", "DS_MOTIVO", "CO_USUARIO", "DS_TAREFAS")
    values ('classificacao', 'S', c_motivo, v_autor, '{}');
  end if;
end;
$$;

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
  end;
$function$;
comment on function private."FC_CHAVE_DO_WORKFLOW"(text) is
  'Chave da automação que manda nos pedidos da agenda (origem AGENDA) de cada workflow da lista fixa de FC_DISPARAR_ROBO. 20261022190000; classificacao.yml desde 20261023170000.';
revoke all on function private."FC_CHAVE_DO_WORKFLOW"(text) from public, anon, authenticated, service_role;

-- 3. O workflow da classificação na lista fixa dos robôs ----------------------------------
alter table public."TL_DISPARO_ROBO" drop constraint "CK_DISPROBO_NOWORKFLOW";
alter table public."TL_DISPARO_ROBO" add constraint "CK_DISPROBO_NOWORKFLOW" check ("NO_WORKFLOW" = any (array[
  'sincronizar-entrevistas.yml', 'sincronizar-selecao.yml', 'conferencias.yml', 'expurgo-anexos-chat.yml',
  'robo-empregare.yml', 'pre-classificacao.yml', 'leitura-de-arquivos.yml', 'classificacao.yml']));

-- Corpo de 20261022190000 + classificacao.yml (modo, listas) em c_aceitos.
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
    'pre-classificacao.yml', jsonb_build_array('modo', 'editais', 'forcar_congelado'),
    'classificacao.yml', jsonb_build_array('modo', 'listas'));
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
revoke all on function private."FC_DISPARAR_ROBO"(text, jsonb, uuid, text) from public, anon, authenticated, service_role;

-- 4. O preparo do relatório de cada lista gerada ------------------------------------------
create table public."TB_PREPARO_DESEMPATE" (
  "CO_LISTA_CLASSIFICACAO" uuid not null,
  "TP_SITUACAO" varchar(20) not null,
  "DS_MENSAGEM" varchar(300),
  "CO_DISPARO" bigint,
  "CO_EXECUCAO" varchar(80),
  "DT_PEDIDO" timestamptz not null default now(),
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_PREPARO_DESEMPATE" primary key ("CO_LISTA_CLASSIFICACAO"),
  constraint "FK_LISTACLASSIF_PREPARODESEMP" foreign key ("CO_LISTA_CLASSIFICACAO")
    references public."TB_LISTA_CLASSIFICACAO" ("CO_LISTA_CLASSIFICACAO"),
  constraint "CK_PREPARODESEMP_TPSITUACAO" check ("TP_SITUACAO" in (
    'PEDIDO', 'PREPARANDO', 'PRONTO', 'NAO_CONFERE', 'FALHOU', 'DESLIGADA', 'SEM_DISPARO')),
  constraint "CK_PREPARODESEMP_DSMENSAGEM" check ("DS_MENSAGEM" is null or "DS_MENSAGEM" !~ '@|[0-9]{11}'),
  constraint "CK_PREPARODESEMP_COEXECUCAO" check ("CO_EXECUCAO" is null or "CO_EXECUCAO" ~ '^[A-Za-z0-9_.:-]{1,80}$')
);
comment on table public."TB_PREPARO_DESEMPATE" is
  'Preparo do relatório de desempate de cada lista gerada (20261023170000): registrar_lista_classificacao pede (FC_PEDIR_DESEMPATE), o job da classificação em Python marca PREPARANDO, NAO_CONFERE ou FALHOU (classificacao_marcar_preparo) e a gravação do relatório marca PRONTO (classificacao_gravar_desempate). A tela lê por obter_desempate_da_lista. Sem dado pessoal.';
comment on column public."TB_PREPARO_DESEMPATE"."CO_LISTA_CLASSIFICACAO" is 'Lista gerada (TB_LISTA_CLASSIFICACAO).';
comment on column public."TB_PREPARO_DESEMPATE"."TP_SITUACAO" is 'PEDIDO (o workflow foi pedido), PREPARANDO (o job começou), PRONTO (relatório gravado), NAO_CONFERE (o retrato calculado pelo Python não é o da lista registrada), FALHOU (erro no job), DESLIGADA (chave "classificacao" desligada ao gerar), SEM_DISPARO (o pedido ao GitHub não saiu).';
comment on column public."TB_PREPARO_DESEMPATE"."DS_MENSAGEM" is 'Mensagem curta para a tela (até 300 caracteres, sem "@" nem 11 dígitos seguidos; nunca nome).';
comment on column public."TB_PREPARO_DESEMPATE"."CO_DISPARO" is 'Pedido ao GitHub (TL_DISPARO_ROBO.CO_DISPARO), quando houve.';
comment on column public."TB_PREPARO_DESEMPATE"."CO_EXECUCAO" is 'Execução do job que mexeu por último (monitora.execucao.identificador).';
comment on column public."TB_PREPARO_DESEMPATE"."DT_PEDIDO" is 'Quando o relatório foi pedido (a geração da lista).';
comment on column public."TB_PREPARO_DESEMPATE"."DT_ATUALIZACAO" is 'Última mudança de situação.';
comment on constraint "PK_TB_PREPARO_DESEMPATE" on public."TB_PREPARO_DESEMPATE" is 'Um preparo por lista.';
comment on constraint "FK_LISTACLASSIF_PREPARODESEMP" on public."TB_PREPARO_DESEMPATE" is 'Lista do preparo.';
comment on constraint "CK_PREPARODESEMP_TPSITUACAO" on public."TB_PREPARO_DESEMPATE" is 'Situações da lista fixa.';
comment on constraint "CK_PREPARODESEMP_DSMENSAGEM" on public."TB_PREPARO_DESEMPATE" is 'Mensagem sem e-mail nem 11 dígitos seguidos.';
comment on constraint "CK_PREPARODESEMP_COEXECUCAO" on public."TB_PREPARO_DESEMPATE" is 'Identificador de execução seguro para log.';
create index "IN_PREPARODESEMP_TPSITUACAO" on public."TB_PREPARO_DESEMPATE" ("TP_SITUACAO", "DT_PEDIDO");
comment on index public."IN_PREPARODESEMP_TPSITUACAO" is 'Os preparos pendentes, do mais antigo ao mais novo (classificacao_ler_pedidos_desempate).';
alter table public."TB_PREPARO_DESEMPATE" enable row level security;
revoke all on table public."TB_PREPARO_DESEMPATE" from public, anon, authenticated;

comment on table public."TB_RELATORIO_DESEMPATE" is
  'Relatório de desempate de uma lista de classificação gerada (TB_LISTA_CLASSIFICACAO), calculado pelo Python: por vaga, lista e nota, os grupos de empate, os critérios aplicados, o valor de cada candidato, o critério que decidiu cada par e quem ficou empatado até o fim. Candidato = id da análise, código de inscrição e nome (documento interno da comissão, 20261023170000); sem CPF, contato nem data de nascimento. Grava classificacao_gravar_desempate; a tela lê por obter_desempate_da_lista.';

-- 5. O pedido do relatório ----------------------------------------------------------------
create function private."FC_PEDIR_DESEMPATE"(p_lista uuid, p_usuario uuid)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_situacao text := 'PEDIDO';
  v_mensagem text;
  v_disparo bigint;
  v_estado text;
begin
  if not private."FC_AUTOMACAO_LIGADA"('classificacao') then
    v_situacao := 'DESLIGADA';
  else
    begin
      v_disparo := private."FC_DISPARAR_ROBO"(
        'classificacao.yml', jsonb_build_object('modo', 'desempate', 'listas', p_lista::text), p_usuario);
      select d."TP_SITUACAO" into v_estado from public."TL_DISPARO_ROBO" d where d."CO_DISPARO" = v_disparo;
      if v_estado is distinct from 'PEDIDO' then
        v_situacao := 'SEM_DISPARO';
        v_mensagem := 'O pedido ao GitHub não saiu (' || coalesce(v_estado, 'sem registro') || ').';
      end if;
    exception when others then
      -- Nunca derruba o registro da lista: só o código do erro.
      v_situacao := 'SEM_DISPARO';
      v_mensagem := 'O pedido ao GitHub não saiu (' || sqlstate || ').';
      v_disparo := null;
    end;
  end if;

  insert into public."TB_PREPARO_DESEMPATE" as p
    ("CO_LISTA_CLASSIFICACAO", "TP_SITUACAO", "DS_MENSAGEM", "CO_DISPARO", "DT_PEDIDO", "DT_ATUALIZACAO")
  values (p_lista, v_situacao, v_mensagem, v_disparo, now(), now())
  on conflict ("CO_LISTA_CLASSIFICACAO") do update
    set "TP_SITUACAO" = excluded."TP_SITUACAO", "DS_MENSAGEM" = excluded."DS_MENSAGEM",
        "CO_DISPARO" = excluded."CO_DISPARO", "CO_EXECUCAO" = null,
        "DT_PEDIDO" = now(), "DT_ATUALIZACAO" = now();
  return v_situacao;
end;
$function$;
comment on function private."FC_PEDIR_DESEMPATE"(uuid, uuid) is
  'Pede o relatório de desempate de uma lista gerada (20261023170000): com a chave "classificacao" ligada, pede classificacao.yml (modo desempate, a lista) por FC_DISPARAR_ROBO em nome de quem gerou; grava o preparo (PEDIDO, DESLIGADA ou SEM_DISPARO) em TB_PREPARO_DESEMPATE e devolve a situação. Nunca levanta erro. Só o dono (registrar_lista_classificacao).';
revoke all on function private."FC_PEDIR_DESEMPATE"(uuid, uuid) from public, anon, authenticated, service_role;

-- 6. Registrar a lista pede o relatório ---------------------------------------------------
-- Corpo de 20261016160000 + o pedido do relatório (FC_PEDIR_DESEMPATE) depois de gravar.
create or replace function public.registrar_lista_classificacao(p_edital uuid, p_tipo text, p_versao integer, p_resultado jsonb)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 2);
  v_regra public."TB_REGRA_CLASSIFICACAO";
  v_id uuid;
  v_totais jsonb := coalesce(p_resultado -> 'totais', '{}'::jsonb);
  v_qt integer[];
begin
  if p_tipo is null or p_tipo not in ('PRELIMINAR', 'CONVOCACAO', 'ENTREVISTA', 'FINAL') then
    raise exception 'Tipo de lista inválido' using errcode = '22023';
  end if;
  select * into v_regra from public."TB_REGRA_CLASSIFICACAO" where "CO_MONITORAMENTO" = p_edital;
  if v_regra."CO_REGRA_CLASSIFICACAO" is null then
    raise exception 'Salve a regra do edital antes de gerar a lista.' using errcode = '22023';
  end if;
  if p_versao is distinct from v_regra."NU_VERSAO_VIGENTE" then
    raise exception 'A regra mudou (versão %); gere de novo.', v_regra."NU_VERSAO_VIGENTE" using errcode = 'PT409';
  end if;
  if jsonb_typeof(p_resultado) is distinct from 'object' or jsonb_typeof(p_resultado -> 'vagas') is distinct from 'array'
     or p_resultado ->> 'tipo' is distinct from p_tipo then
    raise exception 'Lista inválida.' using errcode = '22023';
  end if;
  if pg_column_size(p_resultado) > 8000000 then
    raise exception 'Lista grande demais para registrar.' using errcode = '22023';
  end if;
  -- Os candidatos do retrato são análises ativas deste edital (20261006070000).
  perform private."FC_EXIGIR_CANDIDATOS_DO_EDITAL"(p_edital, p_resultado);
  select array_agg(case when jsonb_typeof(v_totais -> k) = 'number'
                        then greatest(0, least(1000000, (v_totais ->> k)::numeric))::integer else 0 end order by o)
    into v_qt
    from unnest(array['elegiveis', 'eliminados', 'avisos', 'pendencias']) with ordinality t(k, o);

  insert into public."TB_LISTA_CLASSIFICACAO"
    ("CO_MONITORAMENTO", "TP_LISTA", "CO_REGRA_CLASSIFICACAO", "NU_VERSAO_REGRA", "DS_RESULTADO", "DS_HASH",
     "QT_ELEGIVEL", "QT_ELIMINADO", "QT_AVISO", "QT_PENDENCIA", "CO_USUARIO")
  values (p_edital, p_tipo, v_regra."CO_REGRA_CLASSIFICACAO", v_regra."NU_VERSAO_VIGENTE", p_resultado,
          encode(sha256(convert_to(p_resultado::text, 'UTF8')), 'hex'),
          v_qt[1], v_qt[2], v_qt[3], v_qt[4], (select auth.uid()))
  returning "CO_LISTA_CLASSIFICACAO" into v_id;

  -- O relatório de desempate desta lista, pelo Python (20261023170000).
  perform private."FC_PEDIR_DESEMPATE"(v_id, (select auth.uid()));

  return private."FC_LISTA_CLASSIFICACAO_JSON"(v_id);
end;
$function$;

-- 7. As RPCs do job (service_role) ---------------------------------------------------------
create function public.classificacao_ler_pedidos_desempate(p_listas uuid[] default null)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
           'lista', l."CO_LISTA_CLASSIFICACAO", 'edital', l."CO_MONITORAMENTO", 'tipo', l."TP_LISTA",
           'situacao', p."TP_SITUACAO", 'pedido_em', p."DT_PEDIDO")
         order by coalesce(p."DT_PEDIDO", l."DT_GERACAO"), l."CO_LISTA_CLASSIFICACAO"), '[]'::jsonb)
    from (
      select l.*
        from public."TB_LISTA_CLASSIFICACAO" l
       -- As pedidas (input "listas"), em qualquer situação, e todas as que esperam (2 dias):
       -- o GitHub guarda só uma execução na fila do grupo, então cada execução leva as pendentes.
       where l."CO_LISTA_CLASSIFICACAO" = any (coalesce(p_listas, '{}'::uuid[]))
          or exists (select 1 from public."TB_PREPARO_DESEMPATE" x
                      where x."CO_LISTA_CLASSIFICACAO" = l."CO_LISTA_CLASSIFICACAO"
                        and x."TP_SITUACAO" in ('PEDIDO', 'PREPARANDO')
                        and x."DT_PEDIDO" > now() - interval '2 days')
       order by l."DT_GERACAO"
       limit 50
    ) l
    left join public."TB_PREPARO_DESEMPATE" p on p."CO_LISTA_CLASSIFICACAO" = l."CO_LISTA_CLASSIFICACAO";
$function$;
comment on function public.classificacao_ler_pedidos_desempate(uuid[]) is
  'Job da classificação em Python (--desempate, 20261023170000): as listas a preparar — as pedidas (p_listas, em qualquer situação) e todas as que esperam (PEDIDO ou PREPARANDO nos últimos 2 dias; o GitHub guarda só uma execução na fila do grupo, então cada execução leva as pendentes) — com o edital, o tipo e a situação; no máximo 50, da mais antiga à mais nova. Só service_role.';
revoke all on function public.classificacao_ler_pedidos_desempate(uuid[]) from public, anon, authenticated;
grant execute on function public.classificacao_ler_pedidos_desempate(uuid[]) to service_role;

create function public.classificacao_ler_lista(p_lista uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v public."TB_LISTA_CLASSIFICACAO";
begin
  select * into v from public."TB_LISTA_CLASSIFICACAO" l where l."CO_LISTA_CLASSIFICACAO" = p_lista;
  if v."CO_LISTA_CLASSIFICACAO" is null then
    raise exception 'Lista não encontrada' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'id', v."CO_LISTA_CLASSIFICACAO",
    'edital', v."CO_MONITORAMENTO",
    'tipo', v."TP_LISTA",
    'versao_regra', v."NU_VERSAO_REGRA",
    'hash', v."DS_HASH",
    'gerada_em', v."DT_GERACAO",
    'resultado', v."DS_RESULTADO");
end;
$function$;
comment on function public.classificacao_ler_lista(uuid) is
  'Job da classificação em Python (--desempate, 20261023170000): a lista gerada como foi registrada — o retrato (DS_RESULTADO, com os nomes), o hash, o tipo, a versão da regra e o edital — para conferir com o cálculo do Python antes de gravar o relatório de desempate. Só service_role.';
revoke all on function public.classificacao_ler_lista(uuid) from public, anon, authenticated;
grant execute on function public.classificacao_ler_lista(uuid) to service_role;

create function public.classificacao_marcar_preparo(p_execucao text, p_lista uuid, p_situacao text, p_mensagem text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_mensagem text := nullif(btrim(coalesce(p_mensagem, '')), '');
begin
  if coalesce(p_execucao, '') !~ '^[A-Za-z0-9_.:-]{1,80}$' then
    raise exception 'Execução inválida' using errcode = '22023';
  end if;
  if p_situacao is null or p_situacao not in ('PREPARANDO', 'NAO_CONFERE', 'FALHOU') then
    raise exception 'Situação inválida (PREPARANDO, NAO_CONFERE ou FALHOU)' using errcode = '22023';
  end if;
  if v_mensagem is not null and (length(v_mensagem) > 300 or v_mensagem ~ '@|[0-9]{11}') then
    raise exception 'Mensagem longa demais ou com dado que parece pessoal' using errcode = '22023';
  end if;
  if not exists (select 1 from public."TB_LISTA_CLASSIFICACAO" l where l."CO_LISTA_CLASSIFICACAO" = p_lista) then
    raise exception 'Lista não encontrada' using errcode = '22023';
  end if;
  insert into public."TB_PREPARO_DESEMPATE" as p
    ("CO_LISTA_CLASSIFICACAO", "TP_SITUACAO", "DS_MENSAGEM", "CO_EXECUCAO", "DT_PEDIDO", "DT_ATUALIZACAO")
  values (p_lista, p_situacao, v_mensagem, p_execucao, now(), now())
  on conflict ("CO_LISTA_CLASSIFICACAO") do update
    set "TP_SITUACAO" = excluded."TP_SITUACAO", "DS_MENSAGEM" = excluded."DS_MENSAGEM",
        "CO_EXECUCAO" = excluded."CO_EXECUCAO", "DT_ATUALIZACAO" = now();
  return jsonb_build_object('lista', p_lista, 'situacao', p_situacao);
end;
$function$;
comment on function public.classificacao_marcar_preparo(text, uuid, text, text) is
  'Job da classificação em Python (--desempate, 20261023170000): marca o preparo do relatório de desempate de uma lista — PREPARANDO (começou), NAO_CONFERE (o retrato calculado não é o registrado) ou FALHOU — com mensagem curta (até 300, sem "@" nem 11 dígitos). PRONTO só pela gravação do relatório. Só service_role.';
revoke all on function public.classificacao_marcar_preparo(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.classificacao_marcar_preparo(text, uuid, text, text) to service_role;

-- Corpo de 20261023140000 + o preparo vira PRONTO.
create or replace function public.classificacao_gravar_desempate(p_execucao text, p_lista uuid, p_hash text,
                                                                p_relatorio jsonb, p_texto text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_lista public."TB_LISTA_CLASSIFICACAO";
  v_grupos integer;
  v_empatados integer;
  v_pendentes integer;
  v_fora integer;
begin
  if coalesce(p_execucao, '') !~ '^[A-Za-z0-9_.:-]{1,80}$' then
    raise exception 'Execução inválida' using errcode = '22023';
  end if;
  select * into v_lista from public."TB_LISTA_CLASSIFICACAO" l where l."CO_LISTA_CLASSIFICACAO" = p_lista;
  if v_lista."CO_LISTA_CLASSIFICACAO" is null then
    raise exception 'Lista não encontrada' using errcode = '22023';
  end if;
  if p_hash is distinct from v_lista."DS_HASH" then
    raise exception 'A lista mudou desde o cálculo do relatório (hash diferente)' using errcode = '22023';
  end if;
  if p_relatorio is null or jsonb_typeof(p_relatorio) <> 'object'
     or coalesce(jsonb_typeof(p_relatorio->'versao'), '') <> 'number' or (p_relatorio->>'versao')::numeric <> 1
     or p_relatorio->>'tipo' is distinct from v_lista."TP_LISTA"
     or coalesce(jsonb_typeof(p_relatorio->'vagas'), '') <> 'array'
     or coalesce(jsonb_typeof(p_relatorio->'totais'), '') <> 'object' then
    raise exception 'Relatório de desempate inválido (versão, tipo ou forma)' using errcode = '22023';
  end if;
  if coalesce(p_texto, '') = '' or octet_length(p_texto) > 8000000 or octet_length(p_relatorio::text) > 8000000 then
    raise exception 'Relatório de desempate vazio ou grande demais' using errcode = '22023';
  end if;
  -- Sem contato nem documento: nada de e-mail nem 11 dígitos seguidos (fora os ids das análises).
  if regexp_replace(p_relatorio::text || p_texto, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '', 'g')
     ~ '@|[0-9]{11}' then
    raise exception 'Relatório de desempate com dado que parece pessoal (@ ou 11 dígitos)' using errcode = '22023';
  end if;
  -- Cada candidato do relatório está na lista gerada.
  select count(*) into v_fora
    from jsonb_path_query(p_relatorio, '$.vagas[*].grupos[*].candidatos[*].analiseId') r(id)
   where not exists (
     select 1 from jsonb_path_query(v_lista."DS_RESULTADO", '$.vagas[*].geral[*].analise_id') g(id) where g.id = r.id
     union all
     select 1 from jsonb_path_query(v_lista."DS_RESULTADO", '$.vagas[*].listas.*[*].analise_id') m(id) where m.id = r.id);
  if v_fora > 0 then
    raise exception 'Relatório de desempate com % candidato(s) fora da lista', v_fora using errcode = '22023';
  end if;
  select count(*) into v_grupos from jsonb_path_query(p_relatorio, '$.vagas[*].grupos[*]');
  v_empatados := coalesce((p_relatorio#>>'{totais,empatadosAteOFim}')::integer, -1);
  v_pendentes := coalesce((p_relatorio#>>'{totais,pendentes}')::integer, -1);
  if v_grupos is distinct from (p_relatorio#>>'{totais,grupos}')::integer or v_empatados < 0 or v_pendentes < 0 then
    raise exception 'Totais do relatório de desempate não batem com os grupos' using errcode = '22023';
  end if;

  insert into public."TB_RELATORIO_DESEMPATE" as r
    ("CO_LISTA_CLASSIFICACAO", "NU_VERSAO_RELATORIO", "DS_RELATORIO", "DS_TEXTO", "DS_HASH_LISTA",
     "QT_GRUPO", "QT_EMPATE_FINAL", "QT_PENDENCIA", "CO_EXECUCAO", "DT_GERACAO")
  values (p_lista, 1, p_relatorio, p_texto, p_hash, v_grupos, v_empatados, v_pendentes, p_execucao, now())
  on conflict ("CO_LISTA_CLASSIFICACAO") do update
    set "NU_VERSAO_RELATORIO" = excluded."NU_VERSAO_RELATORIO", "DS_RELATORIO" = excluded."DS_RELATORIO",
        "DS_TEXTO" = excluded."DS_TEXTO", "DS_HASH_LISTA" = excluded."DS_HASH_LISTA",
        "QT_GRUPO" = excluded."QT_GRUPO", "QT_EMPATE_FINAL" = excluded."QT_EMPATE_FINAL",
        "QT_PENDENCIA" = excluded."QT_PENDENCIA", "CO_EXECUCAO" = excluded."CO_EXECUCAO", "DT_GERACAO" = now();

  -- O preparo da lista fica pronto (20261023170000).
  insert into public."TB_PREPARO_DESEMPATE" as p
    ("CO_LISTA_CLASSIFICACAO", "TP_SITUACAO", "DS_MENSAGEM", "CO_EXECUCAO", "DT_PEDIDO", "DT_ATUALIZACAO")
  values (p_lista, 'PRONTO', null, p_execucao, now(), now())
  on conflict ("CO_LISTA_CLASSIFICACAO") do update
    set "TP_SITUACAO" = 'PRONTO', "DS_MENSAGEM" = null, "CO_EXECUCAO" = excluded."CO_EXECUCAO", "DT_ATUALIZACAO" = now();

  return jsonb_build_object('lista', p_lista, 'grupos', v_grupos, 'empatados', v_empatados, 'pendentes', v_pendentes);
end;
$function$;
comment on function public.classificacao_gravar_desempate(text, uuid, text, jsonb, text) is
  'Job da classificação em Python: grava (ou troca) o relatório de desempate de uma lista gerada e marca o preparo PRONTO (TB_PREPARO_DESEMPATE, 20261023170000). Confere o hash da lista, a versão e o tipo do relatório, que cada candidato está na lista, os totais e a ausência de contato ou documento (@ ou 11 dígitos fora dos ids). Só service_role.';
revoke all on function public.classificacao_gravar_desempate(text, uuid, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.classificacao_gravar_desempate(text, uuid, text, jsonb, text) to service_role;

-- 8. A leitura da tela: o relatório e o preparo --------------------------------------------
create or replace function public.obter_desempate_da_lista(p_lista uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_edital uuid;
  v_hash text;
  v_preparo json;
  v_relatorio json;
begin
  select l."CO_MONITORAMENTO", l."DS_HASH" into v_edital, v_hash
    from public."TB_LISTA_CLASSIFICACAO" l where l."CO_LISTA_CLASSIFICACAO" = p_lista;
  if v_edital is null then
    raise exception 'Lista não encontrada' using errcode = '22023';
  end if;
  perform private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(v_edital, 1);
  select json_build_object('situacao', p."TP_SITUACAO", 'pedido_em', p."DT_PEDIDO",
                           'atualizado_em', p."DT_ATUALIZACAO", 'mensagem', p."DS_MENSAGEM")
    into v_preparo
    from public."TB_PREPARO_DESEMPATE" p where p."CO_LISTA_CLASSIFICACAO" = p_lista;
  select json_build_object(
           'versao', r."NU_VERSAO_RELATORIO",
           'gerado_em', r."DT_GERACAO",
           'da_lista_atual', r."DS_HASH_LISTA" = v_hash,
           'grupos', r."QT_GRUPO",
           'empatados', r."QT_EMPATE_FINAL",
           'pendentes', r."QT_PENDENCIA",
           'relatorio', r."DS_RELATORIO",
           'texto', r."DS_TEXTO")
    into v_relatorio
    from public."TB_RELATORIO_DESEMPATE" r where r."CO_LISTA_CLASSIFICACAO" = p_lista;
  if v_preparo is null and v_relatorio is null then
    return null;
  end if;
  return (jsonb_build_object('lista_id', p_lista, 'preparo', v_preparo)
          || coalesce(v_relatorio::jsonb, '{}'::jsonb))::json;
end;
$function$;
comment on function public.obter_desempate_da_lista(uuid) is
  'O relatório de desempate de uma lista gerada (json e texto, com nome e código dos candidatos) e o preparo dele (situação, pedido_em, atualizado_em, mensagem; 20261023170000), para Classificação › Listas; null quando a lista não tem nem relatório nem preparo. Exige classificacao >= leitor, a área e o recorte da coordenação do edital.';
revoke all on function public.obter_desempate_da_lista(uuid) from public, anon;
grant execute on function public.obter_desempate_da_lista(uuid) to authenticated, service_role;

commit;
