-- Desfaz 20261020170000_inscricoes_congeladas.sql:
--   FC_DISPARAR_ROBO volta à de 20261020130000 (3 parâmetros; sem p_origem: pedido sem usuário = AGENDA);
--   as tarefas agsus_* voltam a chamar FC_DISPARAR_ROBO sem p_origem;
--   FC_AGENDA_DAS_INSCRICOES, listar_vagas_empregare, FC_EMPREGARE_ABRIR_VAGA,
--   pre_classificacao_ler_editais, disparar_robo e get_saude_das_cargas voltam às de antes;
--   saem obter/alterar_congelamento_inscricoes, registrar_uso_liberacao_congelamento,
--   registrar_disparo_externo, FC_INSCRICOES_CONGELADAS, FC_LIBERACAO_CONGELAMENTO_VALIDA,
--   FC_EXECUCAO_LIBERADA_NO_CONGELAMENTO e as tabelas TB/TH_CONGELAMENTO_INSCRICAO
--   (guarde antes o histórico: select * from public."TH_CONGELAMENTO_INSCRICAO");
--   TL_DISPARO_ROBO: as linhas GITHUB saem, as MANUAL voltam a AGENDA, saem NO_ATOR_GITHUB e
--   DS_URL_EXECUCAO e voltam as restrições de 20261008140000.
-- Antes, volte o front e os workflows/robô para a versão anterior (eles chamam as RPCs novas;
-- o robô e a pré-classificação novos caem para as antigas se a função nova não existir).
begin;

set local lock_timeout = '10s';

-- Os disparos
drop function if exists public.registrar_disparo_externo(text, text, text, text);
delete from public."TL_DISPARO_ROBO" where "TP_ORIGEM" = 'GITHUB';
update public."TL_DISPARO_ROBO" set "TP_ORIGEM" = 'AGENDA' where "TP_ORIGEM" = 'MANUAL';
drop index if exists public."UK_DISPROBO_DSURL_GITHUB";
alter table public."TL_DISPARO_ROBO"
  drop constraint "CK_DISPROBO_DSURL",
  drop constraint "CK_DISPROBO_GITHUB",
  drop constraint "CK_DISPROBO_PEDIDO",
  drop constraint "CK_DISPROBO_TPSITUACAO",
  drop constraint "CK_DISPROBO_TPORIGEM",
  drop column "DS_URL_EXECUCAO",
  drop column "NO_ATOR_GITHUB",
  alter column "TP_ORIGEM" set default 'AGENDA',
  add constraint "CK_DISPROBO_TPORIGEM" check ("TP_ORIGEM" in ('AGENDA', 'MONITORA')),
  add constraint "CK_DISPROBO_TPSITUACAO" check ("TP_SITUACAO" in ('PEDIDO', 'ACEITO', 'FALHOU', 'SEM_TOKEN')),
  add constraint "CK_DISPROBO_PEDIDO" check (
    ("TP_SITUACAO" = 'SEM_TOKEN' and "CO_PEDIDO_HTTP" is null)
    or ("TP_SITUACAO" in ('PEDIDO', 'ACEITO') and "CO_PEDIDO_HTTP" is not null)
    or "TP_SITUACAO" = 'FALHOU');
comment on table public."TL_DISPARO_ROBO" is
  'Pedidos de execução dos robôs (workflow_dispatch do GitHub) feitos pelo banco: na hora da agenda (pg_cron) e no Rodar agora / Opções / Recalcular do MONITORA (disparar_robo), sempre por FC_DISPARAR_ROBO (20261008140000). Uma linha por pedido; nunca guarda a chave. Fechada por FC_CONFERIR_DISPAROS_ROBO (net._http_response); linhas com mais de 30 dias saem. Leitura só por get_saude_das_cargas e situacao_do_disparo_robo.';
comment on column public."TL_DISPARO_ROBO"."TP_ORIGEM" is 'AGENDA (pg_cron) ou MONITORA (Rodar agora, Opções ou Recalcular de quem está logado).';
comment on column public."TL_DISPARO_ROBO"."CO_USUARIO" is 'Quem pediu pelo MONITORA (auth.users.id; vai ao workflow como disparado_por); nulo na agenda.';
comment on column public."TL_DISPARO_ROBO"."TP_SITUACAO" is 'PEDIDO (aguardando a resposta), ACEITO (o GitHub respondeu 2xx — 204), FALHOU (outro código, tempo esgotado ou sem resposta) ou SEM_TOKEN (sem a chave github_disparo_robos no Vault; nada foi pedido).';
comment on constraint "CK_DISPROBO_TPORIGEM" on public."TL_DISPARO_ROBO" is 'Origens válidas.';
comment on constraint "CK_DISPROBO_TPSITUACAO" on public."TL_DISPARO_ROBO" is 'Situações válidas.';
comment on constraint "CK_DISPROBO_PEDIDO" on public."TL_DISPARO_ROBO" is 'SEM_TOKEN não tem pedido no pg_net; PEDIDO e ACEITO sempre têm.';

do $$
declare
  r record;
begin
  for r in select j.jobid, j.command from cron.job j where j.command like '%, p_origem => ''AGENDA'');%' loop
    perform cron.alter_job(r.jobid, command => replace(r.command, ', p_origem => ''AGENDA'');', ');'));
  end loop;
end;
$$;

drop function private."FC_DISPARAR_ROBO"(text, jsonb, uuid, text);
create function private."FC_DISPARAR_ROBO"(p_workflow text, p_inputs jsonb default '{}'::jsonb, p_usuario uuid default null)
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
    'robo-empregare.yml', jsonb_build_array('modo', 'editais', 'vagas', 'limite', 'anexos', 'candidatos', 'seco'),
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
  'Único caminho até o GitHub (20261008140000): pede a execução (workflow_dispatch, ramo main) de um workflow da lista fixa, com os inputs que ele aceita (texto até 20000; o robô da Empregare aceita modo, editais, vagas, limite, anexos, candidatos e seco desde 20261020130000) e disparado_por = AGENDA (sem p_usuario, a agenda do pg_cron) ou o id de quem pediu (disparar_robo). Lê a chave github_disparo_robos do Vault na hora e só a entrega ao pg_net; sem a chave, registra SEM_TOKEN e sai sem erro. Grava o pedido em TL_DISPARO_ROBO e devolve o CO_DISPARO. 22023 para workflow fora da lista ou input recusado. Só o dono (pg_cron e as RPCs SECURITY DEFINER).';
revoke all on function private."FC_DISPARAR_ROBO"(text, jsonb, uuid) from public, anon, authenticated, service_role;

create or replace function private."FC_AGENDA_DAS_INSCRICOES"(p_tarefa text, p_editais text, p_ate date)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_tarefa is null or p_tarefa !~ '^agsus_robo_inscricoes_[a-z0-9_]{1,40}$' then
    raise exception 'Tarefa da agenda das inscrições inválida' using errcode = '22023';
  end if;
  if p_ate is null or coalesce(btrim(p_editais), '') = '' then
    raise exception 'Informe os editais e a data final' using errcode = '22023';
  end if;
  -- Passou a data (Brasília): a tarefa desliga a si mesma e não pede nada.
  if (now() at time zone 'America/Sao_Paulo')::date > p_ate then
    if exists (select 1 from cron.job where jobname = p_tarefa) then
      perform cron.unschedule(p_tarefa);
    end if;
    return null;
  end if;
  -- O robô da Empregare, ao fim de uma carga normal, roda a pré-classificação dos
  -- editais carregados (robo-empregare.yml, --apos-robo), que grava o retrato.
  return private."FC_DISPARAR_ROBO"('robo-empregare.yml',
    jsonb_build_object('modo', 'normal', 'editais', btrim(p_editais)));
end;
$function$;
revoke all on function private."FC_AGENDA_DAS_INSCRICOES"(text, text, date) from public, anon, authenticated, service_role;

-- As funções da trava voltam às de antes
drop function public.listar_vagas_empregare(text[], text[], integer, text, uuid);
create function public.listar_vagas_empregare(p_editais text[] DEFAULT NULL::text[], p_vagas text[] DEFAULT NULL::text[], p_limite integer DEFAULT 60)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_limite integer := least(greatest(coalesce(p_limite, 60), 1), 500);
  v_vagas text[] := coalesce(p_vagas, '{}');
  v_editais text[];
  v_modo text;
begin
  if exists (select 1 from unnest(v_vagas) v where v !~ '^[0-9]{1,20}$') then
    raise exception 'Código de vaga inválido: use só dígitos' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct private."FC_NUMERO_EDITAL"(e)), '{}') into v_editais
    from unnest(coalesce(p_editais, '{}')) e;
  if exists (select 1 from unnest(v_editais) e where e is null) then
    raise exception 'Edital inválido: use o número, como 80/2026' using errcode = '22023';
  end if;
  v_modo := case when cardinality(v_vagas) > 0 then 'VAGAS'
                 when cardinality(v_editais) > 0 then 'EDITAIS'
                 else 'PADRAO' end;

  return (
    with quadro as (
      select q.vaga, m.id as edital_id, m.edital, m.unidade, q.cargo, m."CO_AREA" as area,
             m.ativo as edital_ativo, 'quadro'::text as origem
        from private."FC_EMPREGARE_VAGAS_DO_QUADRO"() q
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = q.edital_id
    ),
    selecao as (
      select distinct on (s."CO_VAGA")
             s."CO_VAGA" as vaga, s."CO_MONITORAMENTO" as edital_id, s."DS_EDITAL" as edital,
             s."NO_UNIDADE" as unidade, s."NO_CARGO" as cargo, s."CO_AREA" as area,
             m.ativo as edital_ativo, 'selecao'::text as origem
        from public."TB_SELECAO_VAGA" s
        left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = s."CO_MONITORAMENTO"
       where s."ST_REGISTRO_ATIVO" = 'S' and s."CO_VAGA" is not null
       order by s."CO_VAGA", (s."CO_MONITORAMENTO" is null), s."DT_ATUALIZACAO" desc
    ),
    -- Vagas já ligadas ao edital na Empregare (correção de dados ou carga anterior):
    -- o edital em inscrição ainda não tem análise (código do quadro) nem Seleção.
    ligadas as (
      select v."CO_VAGA" as vaga, m.id as edital_id, m.edital, m.unidade, null::text as cargo,
             m."CO_AREA" as area, m.ativo as edital_ativo, 'ligada'::text as origem
        from public."TB_EMPREGARE_VAGA" v
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = v."CO_MONITORAMENTO"
    ),
    -- Mesmo código em mais de uma fonte: fica a do quadro, depois a da Seleção.
    fontes as (
      select f.*,
             (select max(coalesce(c.data_fim, c.data_inicio)::date)
                from public."TB_CRONOGRAMA_MONIT_INDIG" c
               where c.monitoramento_id = f.edital_id) as fim_do_cronograma
        from (select * from quadro
              union all
              select s.* from selecao s where not exists (select 1 from quadro q where q.vaga = s.vaga)
              union all
              select l.* from ligadas l
               where not exists (select 1 from quadro q where q.vaga = l.vaga)
                 and not exists (select 1 from selecao s where s.vaga = l.vaga)) f
    ),
    escolhidas as (
      select s.vaga, s.edital_id, s.edital, s.unidade, s.cargo, s.area, s.origem
        from fontes s
       where (v_modo = 'VAGAS' and s.vaga = any (v_vagas))
          or (v_modo = 'EDITAIS' and private."FC_NUMERO_EDITAL"(s.edital) = any (v_editais))
          or (v_modo = 'PADRAO' and s.edital_ativo is true
              and not private."FC_EDITAL_EH_TREINAMENTO"(s.edital_id)
              and (s.fim_do_cronograma is null or s.fim_do_cronograma >= current_date - 30))
      union all
      -- Código pedido que não está em nenhuma fonte: vai mesmo assim, sem edital.
      select v, null::uuid, null, null, null, null, 'pedida'
        from unnest(v_vagas) v
       where v_modo = 'VAGAS' and not exists (select 1 from fontes s where s.vaga = v)
    ),
    ordenadas as (
      select e.*, ev."DT_ULTIMA_CARGA" as ultima_carga
        from escolhidas e
        left join public."TB_EMPREGARE_VAGA" ev on ev."CO_VAGA" = e.vaga
       order by ev."DT_ULTIMA_CARGA" nulls first, e.edital nulls last, e.vaga
       limit v_limite
    )
    select jsonb_build_object(
      'modo', v_modo,
      'limite', v_limite,
      'vagas', coalesce(jsonb_agg(jsonb_build_object(
          'vaga', o.vaga, 'edital_id', o.edital_id, 'edital', o.edital, 'unidade', o.unidade,
          'cargo', o.cargo, 'area', o.area, 'ultima_carga', o.ultima_carga, 'origem', o.origem
        ) order by o.ultima_carga nulls first, o.edital nulls last, o.vaga), '[]'::jsonb)
    )
      from ordenadas o
  );
end;
$function$;
revoke all on function public.listar_vagas_empregare(text[], text[], integer) from public, anon, authenticated;
grant execute on function public.listar_vagas_empregare(text[], text[], integer) to service_role;

create or replace function private."FC_EMPREGARE_ABRIR_VAGA"(p_sync text, p_vaga text, p_total integer)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_vaga public."TB_EMPREGARE_VAGA";
  v_forcada boolean;
  v_ativos integer;
  v_edital uuid;
begin
  -- Vaga já aberta nesta execução (2º lote em diante e o fechamento): nada a procurar.
  select * into v_vaga from public."TB_EMPREGARE_VAGA" v
   where v."CO_VAGA" = p_vaga and v."CO_SYNC" = p_sync
     for update;
  if found then
    return v_vaga."TP_SITUACAO";
  end if;

  select (s."ST_FORCADA" = 'S') into v_forcada from public."TL_SYNC_EMPREGARE" s where s."CO_SYNC" = p_sync;
  select q.edital_id into v_edital from private."FC_EMPREGARE_VAGAS_DO_QUADRO"(p_vaga) q limit 1;
  if v_edital is null then
    select s."CO_MONITORAMENTO" into v_edital
      from public."TB_SELECAO_VAGA" s
     where s."CO_VAGA" = p_vaga and s."ST_REGISTRO_ATIVO" = 'S'
     order by (s."CO_MONITORAMENTO" is null), s."DT_ATUALIZACAO" desc
     limit 1;
  end if;

  insert into public."TB_EMPREGARE_VAGA" ("CO_VAGA", "CO_MONITORAMENTO")
  values (p_vaga, v_edital)
  on conflict ("CO_VAGA") do nothing;
  select * into v_vaga from public."TB_EMPREGARE_VAGA" v where v."CO_VAGA" = p_vaga for update;

  if v_vaga."CO_SYNC" is not distinct from p_sync then
    return v_vaga."TP_SITUACAO";
  end if;

  select count(*) into v_ativos
    from public."TB_EMPREGARE_CANDIDATO" c
   where c."CO_VAGA" = p_vaga and c."ST_REGISTRO_ATIVO" = 'S';

  if not v_forcada and v_ativos > 0 and p_total * 2 < v_ativos then
    update public."TB_EMPREGARE_VAGA" set
      "TP_SITUACAO" = 'RECUSADA', "CO_SYNC" = p_sync, "QT_LINHA_ARQUIVO" = p_total, "QT_RECEBIDA" = 0,
      "CO_MONITORAMENTO" = coalesce(v_edital, "CO_MONITORAMENTO"),
      "DS_MENSAGEM" = format('Arquivo com %s candidatos e a vaga tem %s ativos: menos da metade. Nada foi gravado nem desativado.', p_total, v_ativos),
      "DT_ATUALIZACAO" = now()
     where "CO_VAGA" = p_vaga;
    update public."TL_SYNC_EMPREGARE" set "QT_VAGA_RECUSADA" = "QT_VAGA_RECUSADA" + 1 where "CO_SYNC" = p_sync;
    return 'RECUSADA';
  end if;

  update public."TB_EMPREGARE_VAGA" set
    "TP_SITUACAO" = 'EM_CARGA', "CO_SYNC" = p_sync, "QT_LINHA_ARQUIVO" = p_total, "QT_RECEBIDA" = 0,
    "CO_MONITORAMENTO" = coalesce(v_edital, "CO_MONITORAMENTO"), "DS_MENSAGEM" = null, "DT_ATUALIZACAO" = now()
   where "CO_VAGA" = p_vaga;
  return 'EM_CARGA';
end;
$function$;
revoke all on function private."FC_EMPREGARE_ABRIR_VAGA"(text, text, integer) from public, anon, authenticated;

drop function public.pre_classificacao_ler_editais(text[], boolean, boolean, uuid);
create function public.pre_classificacao_ler_editais(p_editais text[] DEFAULT NULL::text[], p_apos_robo boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_pedidos text[] := array(select btrim(x) from unnest(coalesce(p_editais, '{}')) x where btrim(x) <> '');
  v_ids uuid[];
  v_sync text;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if cardinality(v_pedidos) > 100 then
    raise exception 'Até 100 editais por execução' using errcode = '22023';
  end if;
  if cardinality(v_pedidos) > 0 then
    -- Cada pedido é o id do edital, o número ("93/2026") ou, sem número, o nome ("FCC").
    select coalesce(array_agg(distinct m.id), '{}') into v_ids
      from public."TB_MONITORAMENTO_INDIGENA" m
      join unnest(v_pedidos) p(texto)
        on m.id::text = lower(p.texto)
        or private."FC_NUMERO_EDITAL"(m.edital) = p.texto
        or lower(btrim(m.edital)) = lower(p.texto);
  elsif p_apos_robo then
    -- Os editais das vagas gravadas na última execução fechada do robô.
    select s."CO_SYNC" into v_sync
      from public."TL_SYNC_EMPREGARE" s
     where s."TP_SITUACAO" in ('CONCLUIDA', 'PARCIAL')
     order by s."DT_INICIO" desc limit 1;
    select coalesce(array_agg(distinct v."CO_MONITORAMENTO"), '{}') into v_ids
      from public."TB_EMPREGARE_VAGA" v
     where v."CO_SYNC" = v_sync and v."CO_MONITORAMENTO" is not null
       and not private."FC_EDITAL_EH_TREINAMENTO"(v."CO_MONITORAMENTO");
  else
    select coalesce(array_agg(distinct v."CO_MONITORAMENTO"), '{}') into v_ids
      from public."TB_EMPREGARE_VAGA" v
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = v."CO_MONITORAMENTO"
     where coalesce(m.ativo, false) and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO");
  end if;

  return jsonb_build_object(
    'hoje', v_hoje,
    'sync', v_sync,
    'nao_encontrados', coalesce((
      select jsonb_agg(p.texto order by p.texto)
        from unnest(v_pedidos) p(texto)
       where not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m
                          where m.id::text = lower(p.texto)
                             or private."FC_NUMERO_EDITAL"(m.edital) = p.texto
                             or lower(btrim(m.edital)) = lower(p.texto))), '[]'::jsonb),
    'editais', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id,
               'rotulo', private."FC_ROTULO_DO_EDITAL"(m.edital),
               'area', m."CO_AREA",
               'ativo', coalesce(m.ativo, false),
               'treinamento', private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO"),
               'regra', (select jsonb_build_object('versao', r."NU_VERSAO_VIGENTE", 'situacao', r."TP_SITUACAO",
                                                   'configuracao', h."DS_CONFIGURACAO")
                           from public."TB_REGRA_ANALISE" r
                           join public."TH_REGRA_ANALISE" h
                             on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
                          where r."CO_MONITORAMENTO" = m.id),
               'documental', private."FC_DOCUMENTAL_DO_EDITAL"(m.id),
               -- O cronograma: o job congela a declarada depois do fim das inscrições.
               'cronograma', coalesce((
                 select jsonb_agg(jsonb_build_object('atividade', c.atividade, 'inicio', c.data_inicio, 'fim', c.data_fim)
                        order by c.ordem)
                   from public."TB_CRONOGRAMA_MONIT_INDIG" c where c.monitoramento_id = m.id), '[]'::jsonb),
               -- Refazer o lote do zero: ninguém analisado e TODAS as fichas do edital intocadas
               -- (FC_FICHAS_INICIADAS = 0); fichas_iniciadas vai para a mensagem da recusa (20261013110000).
               'fichas_iniciadas', fi.n,
               'refazer_permitido', fi.n = 0
                                    and not exists (select 1 from public."TB_PRE_CLASSIFICACAO" a
                                                     where a."CO_MONITORAMENTO" = m.id and a."TP_SITUACAO" = 'ANALISADO'),
               -- [sem-mudanca] Só no fim do robô: nada mudou desde a última pré-classificação
               -- CONCLUÍDA de hoje que processou o edital (o job pula o edital).
               'sem_mudanca', p_apos_robo and cardinality(v_pedidos) = 0 and exists (
                 select 1
                   from public."TL_PRE_CLASSIFICACAO" l
                  where l."TP_SITUACAO" = 'CONCLUIDA'
                    and (l."DT_INICIO" at time zone 'America/Sao_Paulo')::date = v_hoje
                    and l."DS_EDITAL" @> jsonb_build_array(jsonb_build_object('edital', m.id, 'situacao', 'PROCESSADO'))
                    and l."DT_INICIO" > coalesce((
                          select max(c."DT_ATUALIZACAO")
                            from public."TB_EMPREGARE_VAGA" v
                            join public."TB_EMPREGARE_CANDIDATO" c on c."CO_VAGA" = v."CO_VAGA"
                           where v."CO_MONITORAMENTO" = m.id), '-infinity'::timestamptz)
                    and l."DT_INICIO" > coalesce((
                          select max(greatest(d."DT_CRIACAO", d."DT_ATUALIZACAO", d."DT_REVOGACAO"))
                            from public."TB_DECISAO_LOTE" d where d."CO_MONITORAMENTO" = m.id), '-infinity'::timestamptz)
                    and l."DT_INICIO" > coalesce((
                          select greatest(r."DT_CRIACAO", r."DT_ATUALIZACAO", r."DT_CONFERENCIA")
                            from public."TB_REGRA_ANALISE" r where r."CO_MONITORAMENTO" = m.id), '-infinity'::timestamptz)
                    and l."DT_INICIO" > coalesce((
                          select max(greatest(q."DT_CRIACAO", q."DT_DESATIVACAO"))
                            from public."TB_QUADRO_VAGA_EDITAL" q where q."CO_MONITORAMENTO" = m.id), '-infinity'::timestamptz)),
               -- Só os metadados da vaga: o cargo e a linha do quadro vêm com os inscritos
               -- (pre_classificacao_ler_candidatos, uma vaga por chamada, desde 20261014110000).
               'vagas', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'codigo', v."CO_VAGA",
                          'situacao_carga', v."TP_SITUACAO",
                          'candidatos_ativos', v."QT_CANDIDATO_ATIVO",
                          'ultima_carga', v."DT_ULTIMA_CARGA",
                          'ultimo_lote', coalesce(pv."NU_ULTIMO_LOTE", 0))
                        order by v."CO_VAGA")
                   from public."TB_EMPREGARE_VAGA" v
                   left join public."TB_PRE_CLASSIF_VAGA" pv on pv."CO_MONITORAMENTO" = m.id and pv."CO_VAGA" = v."CO_VAGA"
                  where v."CO_MONITORAMENTO" = m.id), '[]'::jsonb))
             order by private."FC_ROTULO_DO_EDITAL"(m.edital), m.id)
        from public."TB_MONITORAMENTO_INDIGENA" m
       cross join lateral (select private."FC_FICHAS_INICIADAS"(m.id) as n) fi
       where m.id = any (v_ids)), '[]'::jsonb)
  );
end;
$function$;
revoke all on function public.pre_classificacao_ler_editais(text[], boolean) from public, anon, authenticated;
grant execute on function public.pre_classificacao_ler_editais(text[], boolean) to service_role;

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
      'editais', 'numero', 'vagas', true, 'limite', true, 'anexos', true, 'candidatos', true, 'seco', true),
    'selecao', jsonb_build_object('nome', 'Seleção', 'workflow', 'sincronizar-selecao.yml',
      'modos', jsonb_build_array('normal')),
    'entrevistas', jsonb_build_object('nome', 'Entrevistas', 'workflow', 'sincronizar-entrevistas.yml',
      'modos', jsonb_build_array('normal')),
    'conferencias', jsonb_build_object('nome', 'Conferências de consistência', 'workflow', 'conferencias.yml',
      'modos', jsonb_build_array('normal', 'seco')),
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
  v_candidatos text[] := '{}';
  v_limite integer;
  v_anexos boolean;
  v_seco boolean;
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
    if v_chave not in ('modo', 'editais', 'vagas', 'limite', 'anexos', 'candidatos', 'seco')
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
  if v_anexos is not null then
    v_saida := v_saida || jsonb_build_object('anexos', case when v_anexos then 'true' else 'false' end);
  end if;
  if cardinality(v_candidatos) > 0 then
    v_saida := v_saida || jsonb_build_object('candidatos', array_to_string(v_candidatos, ','));
  end if;
  if v_modo = 'anexos' then
    v_saida := v_saida || jsonb_build_object('seco', case when coalesce(v_seco, false) then 'true' else 'false' end);
  end if;

  return private."FC_DISPARAR_ROBO"(v_robo ->> 'workflow', v_saida, v_uid);
end;
$function$;
revoke all on function public.disparar_robo(text, jsonb) from public, anon;
grant execute on function public.disparar_robo(text, jsonb) to authenticated;

create or replace function public.get_saude_das_cargas()
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
        from (select * from public."TL_PRE_CLASSIFICACAO" t where not private."FC_EXECUCAO_EH_TREINAMENTO"(t."CO_EXECUCAO") order by t."DT_INICIO" desc limit 10) p
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

-- A trava
drop function public.registrar_uso_liberacao_congelamento(uuid, text);
drop function public.alterar_congelamento_inscricoes(uuid, boolean, text);
drop function public.obter_congelamento_inscricoes(uuid);
drop function private."FC_EXECUCAO_LIBERADA_NO_CONGELAMENTO"(text, uuid);
drop function private."FC_LIBERACAO_CONGELAMENTO_VALIDA"(uuid, uuid);
drop function private."FC_INSCRICOES_CONGELADAS"(uuid);
drop table public."TH_CONGELAMENTO_INSCRICAO";
drop table public."TB_CONGELAMENTO_INSCRICAO";

commit;
