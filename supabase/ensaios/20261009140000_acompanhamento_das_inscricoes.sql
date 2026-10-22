/*
  ENSAIO de 20261009140000_acompanhamento_das_inscricoes.sql — begin … rollback.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, aplica o corpo da migration (copiado sem
  mudança, sem o begin/commit dela) e confere, com uma vaga fictícia
  (999114001) ligada ao 114/2026 e a chave do GitHub AUSENTE simulada
  (agsus.segredo_disparo_robos aponta para um nome que não existe no Vault:
  nenhum pedido HTTP sai, os pedidos ficam SEM_TOKEN):
    E1  a tabela sem acesso direto e as permissões das funções;
    E2  listar_vagas_empregare acha a vaga ligada pelo número do edital
        (origem ligada) e as vagas do 93/2026 não mudam;
    E3  gravar_retrato_inscricoes grava, substitui o retrato do dia e recusa
        vaga de outro edital, contagem maior que os inscritos, texto e
        execução inexistente;
    E4  obter_acompanhamento_inscricoes como um administrador global;
    E5  a tarefa agsus_robo_inscricoes_114_2026 (7h e 13h de Brasília) e
        FC_AGENDA_DAS_INSCRICOES: até a data pede o robô da Empregare (SEM_TOKEN
        aqui); depois dela, desliga a tarefa; nenhum pedido HTTP.
  Termina em ROLLBACK: nada fica gravado. A última linha diz também quantas
  vagas passariam a entrar no "Rodar agora" sem filtro pela origem ligada.

  Precisa de: 20261008140000 aplicada, o edital 114/2026
  (bcecfb08-88ef-4e06-8401-bcad6bf88fd0) e um administrador global ativo.

  Resultado esperado: a linha "ENSAIO OK".
  Mantenha em sincronia: tests/acompanhamento-das-inscricoes-migration.test.js
  confere que o corpo da migration aqui é idêntico ao do arquivo da migration.
*/
begin;

-- Antes da migration: quantas vagas o 93/2026 tem na lista do robô.
select set_config('ensaio.vagas_93',
  (select count(*)::text from jsonb_array_elements(public.listar_vagas_empregare(array['93/2026'], null, 60) -> 'vagas')), true);

-- ===== corpo da migration (sem begin/commit) =====

set local lock_timeout = '10s';

-- 1. O retrato ---------------------------------------------------------------------------------
create table public."TH_INSCRICAO_VAGA_EDITAL" (
  "CO_MONITORAMENTO" uuid not null,
  "CO_VAGA" character varying(20) not null,
  "DT_RETRATO" date not null,
  "QT_INSCRITO" integer not null,
  "QT_FINALIZADO" integer,
  "QT_APTO" integer,
  "QT_ELIMINADO" integer,
  "ST_PREVIA" character varying(1) not null default 'N',
  "CO_EXECUCAO" character varying(80) not null,
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TH_INSCRICAO_VAGA_EDITAL" primary key ("CO_MONITORAMENTO", "CO_VAGA", "DT_RETRATO"),
  constraint "FK_MONITORAMENTO_INSCRVAGA" foreign key ("CO_MONITORAMENTO")
    references public."TB_MONITORAMENTO_INDIGENA" (id) on delete cascade,
  constraint "CK_INSCRVAGA_COVAGA" check ("CO_VAGA" ~ '^[0-9]{1,20}$'),
  constraint "CK_INSCRVAGA_QT" check (
    "QT_INSCRITO" between 0 and 100000
    and coalesce("QT_FINALIZADO", 0) between 0 and "QT_INSCRITO"
    and coalesce("QT_APTO", 0) between 0 and "QT_INSCRITO"
    and coalesce("QT_ELIMINADO", 0) between 0 and "QT_INSCRITO"),
  constraint "CK_INSCRVAGA_STPREVIA" check ("ST_PREVIA" in ('S', 'N')),
  constraint "CK_INSCRVAGA_COEXECUCAO" check ("CO_EXECUCAO" ~ '^[A-Za-z0-9_-]{8,80}$')
);
comment on table public."TH_INSCRICAO_VAGA_EDITAL" is
  'Retrato diário das inscrições de cada vaga da Empregare de um edital (20261009140000): só contagens, nunca dado pessoal. Gravado pelo job da pré-classificação (gravar_retrato_inscricoes) durante as inscrições do cronograma; uma linha por edital, vaga e dia (o último retrato do dia vale). Lido por obter_acompanhamento_inscricoes (cartão Inscrições da aba Pré-classificação).';
comment on column public."TH_INSCRICAO_VAGA_EDITAL"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA.id).';
comment on column public."TH_INSCRICAO_VAGA_EDITAL"."CO_VAGA" is 'Código da vaga na Empregare (TB_EMPREGARE_VAGA.CO_VAGA).';
comment on column public."TH_INSCRICAO_VAGA_EDITAL"."DT_RETRATO" is 'Dia do retrato (data de Brasília).';
comment on column public."TH_INSCRICAO_VAGA_EDITAL"."QT_INSCRITO" is 'Candidatos ativos na vaga da Empregare (quem saiu do arquivo não conta).';
comment on column public."TH_INSCRICAO_VAGA_EDITAL"."QT_FINALIZADO" is 'Ativos com o questionário finalizado (colunas "SITUAÇÃO - <questionário>" = FINALIZADO); nulo quando o arquivo não tem a coluna.';
comment on column public."TH_INSCRICAO_VAGA_EDITAL"."QT_APTO" is 'Aptos para análise pela regra: no lote por nota mínima, não eliminados com a nota ≥ mínima; nas outras bases, no lote pela regra + acima do corte. Nulo sem regra.';
comment on column public."TH_INSCRICAO_VAGA_EDITAL"."QT_ELIMINADO" is 'Eliminados pela regra entre os ativos. Nulo sem regra.';
comment on column public."TH_INSCRICAO_VAGA_EDITAL"."ST_PREVIA" is 'S = aptos e eliminados de uma prévia (regra ainda não conferida; nada da classificação foi gravado).';
comment on column public."TH_INSCRICAO_VAGA_EDITAL"."CO_EXECUCAO" is 'Execução da pré-classificação que gravou (TL_PRE_CLASSIFICACAO.CO_EXECUCAO).';
comment on column public."TH_INSCRICAO_VAGA_EDITAL"."DT_ATUALIZACAO" is 'Quando o retrato do dia foi gravado pela última vez.';
comment on constraint "PK_TH_INSCRICAO_VAGA_EDITAL" on public."TH_INSCRICAO_VAGA_EDITAL" is 'Um retrato por edital, vaga e dia.';
comment on constraint "FK_MONITORAMENTO_INSCRVAGA" on public."TH_INSCRICAO_VAGA_EDITAL" is 'O edital do retrato.';
comment on constraint "CK_INSCRVAGA_COVAGA" on public."TH_INSCRICAO_VAGA_EDITAL" is 'Código da vaga só com dígitos.';
comment on constraint "CK_INSCRVAGA_QT" on public."TH_INSCRICAO_VAGA_EDITAL" is 'Contagens não negativas e nunca maiores que os inscritos.';
comment on constraint "CK_INSCRVAGA_STPREVIA" on public."TH_INSCRICAO_VAGA_EDITAL" is 'S ou N.';
comment on constraint "CK_INSCRVAGA_COEXECUCAO" on public."TH_INSCRICAO_VAGA_EDITAL" is 'Identificador de execução da pré-classificação.';

alter table public."TH_INSCRICAO_VAGA_EDITAL" enable row level security;
revoke all on public."TH_INSCRICAO_VAGA_EDITAL" from public, anon, authenticated, service_role;

-- 2. A gravação (job da pré-classificação) ----------------------------------------------------
create function public.gravar_retrato_inscricoes(p_execucao text, p_edital uuid, p_vagas jsonb)
returns json
language plpgsql
volatile
security definer
set search_path to ''
as $function$
declare
  v_exec public."TL_PRE_CLASSIFICACAO" := private."FC_EXIGIR_EXECUCAO_PRECLASSIF"(p_execucao);
  v_hoje constant date := (now() at time zone 'America/Sao_Paulo')::date;
  v_qt integer;
begin
  if jsonb_typeof(p_vagas) is distinct from 'array' or jsonb_array_length(p_vagas) > 1000 then
    raise exception 'Retrato inválido (lista de até 1000 vagas)' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_vagas) e
     where jsonb_typeof(e) <> 'object'
        or coalesce(e ->> 'vaga', '') !~ '^[0-9]{1,20}$'
        or jsonb_typeof(e -> 'inscritos') is distinct from 'number'
        or exists (select 1 from unnest(array['finalizados', 'aptos', 'eliminados']) k
                    where jsonb_typeof(coalesce(e -> k, 'null'::jsonb)) not in ('number', 'null'))
        or jsonb_typeof(coalesce(e -> 'previa', 'false'::jsonb)) <> 'boolean') then
    raise exception 'Retrato inválido: cada vaga leva o código e as contagens' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_vagas) e
              where not exists (select 1 from public."TB_EMPREGARE_VAGA" v
                                 where v."CO_VAGA" = e ->> 'vaga' and v."CO_MONITORAMENTO" = p_edital)) then
    raise exception 'Há vaga no retrato que não é do edital' using errcode = '22023';
  end if;
  if (select count(distinct e ->> 'vaga') from jsonb_array_elements(p_vagas) e) <> jsonb_array_length(p_vagas) then
    raise exception 'Vaga repetida no retrato' using errcode = '22023';
  end if;

  begin
    insert into public."TH_INSCRICAO_VAGA_EDITAL" as t
      ("CO_MONITORAMENTO", "CO_VAGA", "DT_RETRATO", "QT_INSCRITO", "QT_FINALIZADO", "QT_APTO", "QT_ELIMINADO",
       "ST_PREVIA", "CO_EXECUCAO")
    select p_edital, e ->> 'vaga', v_hoje, (e ->> 'inscritos')::integer, (e ->> 'finalizados')::integer,
           (e ->> 'aptos')::integer, (e ->> 'eliminados')::integer,
           case when coalesce((e ->> 'previa')::boolean, false) then 'S' else 'N' end, v_exec."CO_EXECUCAO"
      from jsonb_array_elements(p_vagas) e
    on conflict ("CO_MONITORAMENTO", "CO_VAGA", "DT_RETRATO") do update
       set "QT_INSCRITO" = excluded."QT_INSCRITO", "QT_FINALIZADO" = excluded."QT_FINALIZADO",
           "QT_APTO" = excluded."QT_APTO", "QT_ELIMINADO" = excluded."QT_ELIMINADO",
           "ST_PREVIA" = excluded."ST_PREVIA", "CO_EXECUCAO" = excluded."CO_EXECUCAO", "DT_ATUALIZACAO" = now();
    get diagnostics v_qt = row_count;
  exception when check_violation or invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Retrato inválido: contagem fora do intervalo' using errcode = '22023';
  end;
  return json_build_object('vagas', v_qt, 'dia', v_hoje);
end;
$function$;
comment on function public.gravar_retrato_inscricoes(text, uuid, jsonb) is
  'Job da pré-classificação (service_role, 20261009140000): grava o retrato do dia (Brasília) das vagas do edital em TH_INSCRICAO_VAGA_EDITAL — p_vagas = [{vaga, inscritos, finalizados, aptos, eliminados, previa}], só contagens. Exige a execução aberta (FC_EXIGIR_EXECUCAO_PRECLASSIF) e vagas do edital; o retrato do mesmo dia é substituído. Devolve {vagas, dia}. 22023 para retrato inválido.';
revoke all on function public.gravar_retrato_inscricoes(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.gravar_retrato_inscricoes(text, uuid, jsonb) to service_role;

-- 3. A leitura (cartão Inscrições) ------------------------------------------------------------
create function public.obter_acompanhamento_inscricoes(p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
  v_hoje constant date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  return json_build_object(
    'schema_version', 1,
    'hoje', v_hoje,
    'cronograma', coalesce((
      select json_agg(json_build_object('atividade', c.atividade, 'inicio', c.data_inicio, 'fim', c.data_fim) order by c.ordem)
        from public."TB_CRONOGRAMA_MONIT_INDIG" c where c.monitoramento_id = p_edital), '[]'::json),
    -- O cargo: o do quadro do edital; sem ele, o nome do questionário da Empregare
    -- (coluna "SITUAÇÃO - <questionário>" do arquivo; só o nome da coluna).
    'vagas', coalesce((
      select json_agg(json_build_object(
               'codigo', v."CO_VAGA",
               'cargo', coalesce(nullif(concat_ws(' — ', q."NO_CARGO", q."NO_LOTACAO"), ''),
                                 (select btrim(substr(x, length('SITUAÇÃO - ') + 1))
                                    from jsonb_array_elements_text(v."DS_COLUNA") x
                                   where upper(x) like 'SITUAÇÃO - %' limit 1)),
               'ultima_carga', v."DT_ULTIMA_CARGA")
             order by v."CO_VAGA")
        from public."TB_EMPREGARE_VAGA" v
        left join lateral (select * from private."FC_QUADRO_DA_VAGA_EMPREGARE"(p_edital, v."CO_VAGA")) q on true
       where v."CO_MONITORAMENTO" = p_edital), '[]'::json),
    'retratos', coalesce((
      select json_agg(json_build_object(
               'vaga', r."CO_VAGA", 'data', r."DT_RETRATO", 'inscritos', r."QT_INSCRITO",
               'finalizados', r."QT_FINALIZADO", 'aptos', r."QT_APTO", 'eliminados', r."QT_ELIMINADO",
               'previa', r."ST_PREVIA" = 'S', 'em', r."DT_ATUALIZACAO")
             order by r."DT_RETRATO", r."CO_VAGA")
        from public."TH_INSCRICAO_VAGA_EDITAL" r
       where r."CO_MONITORAMENTO" = p_edital and r."DT_RETRATO" >= v_hoje - 60), '[]'::json)
  );
end;
$function$;
comment on function public.obter_acompanhamento_inscricoes(uuid) is
  'Cartão Inscrições da aba Pré-classificação (20261009140000): quem lê a Avaliação documental do edital (FC_EXIGIR_AVALIACAO_EDITAL nível 1) recebe o cronograma, as vagas da Empregare do edital (código, cargo do quadro ou nome do questionário, última carga) e os retratos diários dos últimos 60 dias (TH_INSCRICAO_VAGA_EDITAL). Só contagens. 42501 sem permissão, 22023 edital inexistente.';
revoke all on function public.obter_acompanhamento_inscricoes(uuid) from public, anon;
grant execute on function public.obter_acompanhamento_inscricoes(uuid) to authenticated;

-- 4. O robô acha as vagas já ligadas ao edital ------------------------------------------------
CREATE OR REPLACE FUNCTION public.listar_vagas_empregare(p_editais text[] DEFAULT NULL::text[], p_vagas text[] DEFAULT NULL::text[], p_limite integer DEFAULT 60)
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
comment on function public.listar_vagas_empregare(text[], text[], integer) is
  'Robô da Empregare (service_role): as vagas a carregar, de três fontes — o quadro de vagas do edital (código pelas análises do edital), a Seleção (TB_SELECAO_VAGA) e as vagas já ligadas ao edital em TB_EMPREGARE_VAGA (origem ligada, 20261009140000: edital em inscrição, sem análise nem Seleção). Sem filtro: editais ativos e em curso (fim do cronograma há até 30 dias), sem o treinamento; p_editais pelos números; p_vagas pelos códigos (fora das fontes: origem pedida, sem edital). As nunca carregadas e as mais antigas primeiro, até p_limite.';

-- 5. A agenda das inscrições ------------------------------------------------------------------
create function private."FC_AGENDA_DAS_INSCRICOES"(p_tarefa text, p_editais text, p_ate date)
returns bigint
language plpgsql
volatile
security definer
set search_path to ''
as $function$
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
comment on function private."FC_AGENDA_DAS_INSCRICOES"(text, text, date) is
  'Agenda das inscrições (20261009140000): chamada por uma tarefa agsus_robo_inscricoes_* do pg_cron, pede o robô da Empregare dos editais (modo normal; no fim ele roda a pré-classificação deles e o retrato das inscrições) por FC_DISPARAR_ROBO até p_ate (data de Brasília) e, no primeiro horário depois, desliga a própria tarefa (cron.unschedule) e devolve nulo. Só o dono (pg_cron).';
revoke all on function private."FC_AGENDA_DAS_INSCRICOES"(text, text, date) from public, anon, authenticated, service_role;

-- 6. A tarefa do 114/2026 (horário UTC = Brasília + 3 h) --------------------------------------
--   tarefa                            agenda (UTC)    Brasília        até
--   agsus_robo_inscricoes_114_2026    0 10,16 * * *   7h e 13h        15/10/2026 (desliga em 16/10)
do $$
declare
  c_tarefa constant text := 'agsus_robo_inscricoes_114_2026';
  c_agenda constant text := '0 10,16 * * *';
  c_comando constant text :=
    'select private."FC_AGENDA_DAS_INSCRICOES"(''agsus_robo_inscricoes_114_2026'', ''114/2026'', date ''2026-10-15'');';
  v_id bigint;
begin
  select jobid into v_id from cron.job where jobname = c_tarefa;
  if v_id is null then
    perform cron.schedule(c_tarefa, c_agenda, c_comando);
  else
    perform cron.alter_job(v_id, schedule => c_agenda, command => c_comando);
  end if;
end;
$$;

-- ===== fim do corpo da migration =====

-- O ensaio usa uma vaga fictícia ligada ao 114/2026 e simula a chave ausente.
select set_config('agsus.segredo_disparo_robos', 'github_disparo_robos_ausente_no_ensaio', true);
select set_config('ensaio.fila_http', (select count(*)::text from net.http_request_queue), true);
select set_config('ensaio.admin', (
  select p.user_id::text from public."TB_PERFIL_USUARIO" p
    join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
   where p.ativo is true and a."ST_ADMIN_GLOBAL" and p.user_id is not null
   order by p.user_id limit 1), true);

-- E1. Tabela e permissões.
do $$
begin
  if exists (select 1 from vault.secrets where name = 'github_disparo_robos_ausente_no_ensaio') then
    raise exception 'ENSAIO INTERROMPIDO: o nome alternativo existe no Vault.';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public."TH_INSCRICAO_VAGA_EDITAL"'::regclass)
     or has_table_privilege('authenticated', 'public."TH_INSCRICAO_VAGA_EDITAL"', 'select')
     or has_table_privilege('anon', 'public."TH_INSCRICAO_VAGA_EDITAL"', 'select')
     or has_table_privilege('service_role', 'public."TH_INSCRICAO_VAGA_EDITAL"', 'insert') then
    raise exception 'FALHOU E1: a tabela não pode ter acesso direto';
  end if;
  if has_function_privilege('authenticated', 'public.gravar_retrato_inscricoes(text, uuid, jsonb)', 'execute')
     or has_function_privilege('anon', 'public.gravar_retrato_inscricoes(text, uuid, jsonb)', 'execute')
     or not has_function_privilege('service_role', 'public.gravar_retrato_inscricoes(text, uuid, jsonb)', 'execute')
     or has_function_privilege('anon', 'public.obter_acompanhamento_inscricoes(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.obter_acompanhamento_inscricoes(uuid)', 'execute')
     or has_function_privilege('authenticated', 'private."FC_AGENDA_DAS_INSCRICOES"(text, text, date)', 'execute')
     or has_function_privilege('service_role', 'private."FC_AGENDA_DAS_INSCRICOES"(text, text, date)', 'execute')
     or has_function_privilege('authenticated', 'public.listar_vagas_empregare(text[], text[], integer)', 'execute')
     or not has_function_privilege('service_role', 'public.listar_vagas_empregare(text[], text[], integer)', 'execute') then
    raise exception 'FALHOU E1: permissões das funções';
  end if;
  raise notice 'ok E1';
end;
$$;

-- E2. O robô acha a vaga ligada ao 114/2026 pelo número do edital (origem ligada); o 93 segue igual.
insert into public."TB_EMPREGARE_VAGA" ("CO_VAGA", "CO_MONITORAMENTO")
values ('999114001', 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0');
do $$
declare
  v jsonb := public.listar_vagas_empregare(array['114/2026'], null, 60);
  v93 jsonb := public.listar_vagas_empregare(array['93/2026'], null, 60);
begin
  if jsonb_array_length(v -> 'vagas') <> 1
     or v #>> '{vagas,0,vaga}' <> '999114001' or v #>> '{vagas,0,origem}' <> 'ligada'
     or v #>> '{vagas,0,edital_id}' <> 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0' then
    raise exception 'FALHOU E2: a vaga ligada não veio pelo edital: %', v;
  end if;
  if exists (select 1 from jsonb_array_elements(v93 -> 'vagas') e where e ->> 'origem' = 'ligada')
     or (select count(*) from jsonb_array_elements(v93 -> 'vagas')) <> current_setting('ensaio.vagas_93')::int then
    raise exception 'FALHOU E2: as vagas do 93 mudaram: %', v93;
  end if;
  if public.listar_vagas_empregare(null, array['999114001'], 60) #>> '{vagas,0,origem}' <> 'ligada' then
    raise exception 'FALHOU E2: o código pedido devia vir como ligada';
  end if;
  raise notice 'ok E2';
end;
$$;

-- E3. O retrato: grava, substitui no mesmo dia e recusa o que não cabe.
insert into public."TL_PRE_CLASSIFICACAO" ("CO_EXECUCAO", "TP_DISPARO") values ('precl-ensaio-114', 'GITHUB');
do $$
declare
  r json;
begin
  r := public.gravar_retrato_inscricoes('precl-ensaio-114', 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0',
         '[{"vaga": "999114001", "inscritos": 10, "finalizados": 7, "aptos": 4, "eliminados": 1, "previa": true}]');
  r := public.gravar_retrato_inscricoes('precl-ensaio-114', 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0',
         '[{"vaga": "999114001", "inscritos": 12, "finalizados": null, "aptos": null, "eliminados": null}]');
  if (r ->> 'vagas')::int <> 1
     or (select count(*) from public."TH_INSCRICAO_VAGA_EDITAL" where "CO_VAGA" = '999114001') <> 1
     or (select "QT_INSCRITO" from public."TH_INSCRICAO_VAGA_EDITAL" where "CO_VAGA" = '999114001') <> 12
     or (select "ST_PREVIA" from public."TH_INSCRICAO_VAGA_EDITAL" where "CO_VAGA" = '999114001') <> 'N' then
    raise exception 'FALHOU E3: o retrato do dia devia ser substituído';
  end if;
  begin
    perform public.gravar_retrato_inscricoes('precl-ensaio-114', 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0',
              '[{"vaga": "179698", "inscritos": 1}]');
    raise exception 'FALHOU E3: aceitou vaga de outro edital';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.gravar_retrato_inscricoes('precl-ensaio-114', 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0',
              '[{"vaga": "999114001", "inscritos": 2, "aptos": 3}]');
    raise exception 'FALHOU E3: aceitou aptos maior que inscritos';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.gravar_retrato_inscricoes('precl-ensaio-114', 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0',
              '[{"vaga": "999114001", "inscritos": "dez"}]');
    raise exception 'FALHOU E3: aceitou contagem em texto';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.gravar_retrato_inscricoes('precl-execucao-inexistente', 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0',
              '[{"vaga": "999114001", "inscritos": 1}]');
    raise exception 'FALHOU E3: aceitou execução que não existe';
  exception when sqlstate '22023' then null;
  end;
  raise notice 'ok E3';
end;
$$;

-- E4. A leitura, como o administrador global.
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('ensaio.admin'), 'role', 'authenticated')::text, true);
do $$
declare
  r json := public.obter_acompanhamento_inscricoes('bcecfb08-88ef-4e06-8401-bcad6bf88fd0');
begin
  if json_array_length(r -> 'retratos') <> 1 or (r #>> '{retratos,0,inscritos}')::int <> 12
     or json_array_length(r -> 'vagas') <> 1 or r #>> '{vagas,0,codigo}' <> '999114001'
     or json_array_length(r -> 'cronograma') < 3 then
    raise exception 'FALHOU E4: leitura do acompanhamento: %', r;
  end if;
  raise notice 'ok E4';
end;
$$;
reset role;

-- E5. A agenda: até a data pede o robô do 114 (sem chave = SEM_TOKEN); depois, desliga a tarefa.
do $$
declare
  v_id bigint;
  v_job cron.job;
begin
  select * into v_job from cron.job where jobname = 'agsus_robo_inscricoes_114_2026';
  if v_job.jobid is null or v_job.schedule <> '0 10,16 * * *'
     or v_job.command not like '%FC_AGENDA_DAS_INSCRICOES%114/2026%2026-10-15%' then
    raise exception 'FALHOU E5: a tarefa do pg_cron não foi criada como devia';
  end if;
  v_id := private."FC_AGENDA_DAS_INSCRICOES"('agsus_robo_inscricoes_114_2026', '114/2026', date '2099-12-31');
  if (select "NO_WORKFLOW" || ':' || "TP_SITUACAO" from public."TL_DISPARO_ROBO" where "CO_DISPARO" = v_id)
     <> 'robo-empregare.yml:SEM_TOKEN' then
    raise exception 'FALHOU E5: devia pedir o robô da Empregare';
  end if;
  v_id := private."FC_AGENDA_DAS_INSCRICOES"('agsus_robo_inscricoes_114_2026', '114/2026', date '2026-01-01');
  if v_id is not null or exists (select 1 from cron.job where jobname = 'agsus_robo_inscricoes_114_2026') then
    raise exception 'FALHOU E5: depois da data a tarefa devia se desligar';
  end if;
  begin
    perform private."FC_AGENDA_DAS_INSCRICOES"('outra_tarefa', '114/2026', date '2099-12-31');
    raise exception 'FALHOU E5: aceitou tarefa fora do padrão';
  exception when sqlstate '22023' then null;
  end;
  if (select count(*) from net.http_request_queue) <> current_setting('ensaio.fila_http')::bigint then
    raise exception 'FALHOU E5: o ensaio pôs pedido na fila do pg_net';
  end if;
  raise notice 'ok E5';
end;
$$;

select 'ENSAIO OK' as resultado,
       (select count(*) from jsonb_array_elements(public.listar_vagas_empregare(null, null, 500) -> 'vagas') e
         where e ->> 'origem' = 'ligada') as ligadas_no_padrao,
       (select string_agg(e ->> 'vaga', ',') from jsonb_array_elements(public.listar_vagas_empregare(null, null, 500) -> 'vagas') e
         where e ->> 'origem' = 'ligada') as quais;

rollback;
