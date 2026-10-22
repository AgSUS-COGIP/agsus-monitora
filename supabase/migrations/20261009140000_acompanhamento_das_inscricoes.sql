/*
  ACOMPANHAMENTO DAS INSCRIÇÕES (cartão "Inscrições" da aba Pré-classificação)

  Pedido da coordenação (09/10/2026, edital 114/2026, inscrições até 14/10):
  acompanhar, durante as inscrições, quantos se inscreveram e quantos estão
  aptos para análise pela regra, por vaga e no total, com a EVOLUÇÃO diária.
  A pré-classificação guarda só o resultado da última execução
  (TB_PRE_CLASSIF_VAGA); a série vem de um RETRATO pequeno gravado pelo job
  Python a cada execução (só contagens, nunca dado pessoal).

  O QUE MUDA
    1. TH_INSCRICAO_VAGA_EDITAL: um retrato por edital × vaga × dia (o último
       do dia vale): inscritos, finalizaram o questionário, aptos pela regra,
       eliminados e se os aptos vêm de uma prévia (regra ainda a conferir). O
       job só grava da véspera do início das inscrições a 3 dias depois do fim
       (python/monitora/avaliacao_documental/retrato_das_inscricoes.py).
    2. public.gravar_retrato_inscricoes(p_execucao, p_edital, p_vagas)
       (service_role): o job da pré-classificação grava o retrato do edital na
       execução aberta; valida vaga do edital e contagens.
    3. public.obter_acompanhamento_inscricoes(p_edital) (authenticated, quem lê
       a Avaliação documental do edital, como obter_pre_classificacao): o
       cronograma, as vagas (com o cargo) e os retratos dos últimos 60 dias.
    4. public.listar_vagas_empregare: terceira fonte, as vagas já LIGADAS ao
       edital em TB_EMPREGARE_VAGA (origem 'ligada'). Edital em inscrição não
       tem análise curricular (de onde o quadro tira o código da vaga) nem
       Seleção: com as vagas ligadas uma vez (correção de dados ou carga
       anterior), o robô as acha pelo número do edital (`editais`).
    5. private."FC_AGENDA_DAS_INSCRICOES"(p_tarefa, p_editais, p_ate): pede o
       robô da Empregare dos editais (que, no fim, roda a pré-classificação
       deles: robo-empregare.yml, --apos-robo) até a data p_ate (Brasília); no
       dia seguinte, desliga a própria tarefa do pg_cron (cron.unschedule).
    6. Tarefa agsus_robo_inscricoes_114_2026: 7h e 13h de Brasília (10h e 16h
       UTC) até 15/10/2026, com editais = 114/2026. Desliga sozinha em 16/10.

  Guia: docs/agenda-dos-robos.md (seção "Agenda das inscrições").
  Rollback: supabase/rollback/20261009140000_acompanhamento_das_inscricoes.sql.
  Ensaio: supabase/ensaios/20261009140000_acompanhamento_das_inscricoes.sql.
  Dependentes: scripts/pre_classificacao/pre_classificacao.py (grava),
  src/modulos/avaliacao-documental/inscricoes-do-edital.tsx (lê),
  src/lib/rpc-contrato.js, scripts/robo-empregare/robo_empregare.py (origem).
*/
begin;

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

commit;
