/*
  SELEÇÃO VIRA ABA NATIVA (FASE 1: O FUNIL POR VAGA, COM OS DADOS DA AUDITORIA)

  O painel externo "Seleção" (TB_PAINEL_EXTERNO) mostrava o funil de cada vaga
  a partir da planilha "Auditoria", aba Resultado. Agora essa aba vem para o
  banco todo dia (scripts/sincronizar-selecao.mjs, GitHub Actions, conta de
  serviço do Google) e a aba Seleção de cada área mostra o funil.

  O QUE VEM DA PLANILHA (aba Resultado, uma linha por vaga)
    A Vaga · B Edital · C Nome da Unidade · F Inscritos · G Aptos para análise ·
    H Cancelados · I Reprovados por não finalizar o questionário · J Eliminados
    por nota · K Reprovados na Análise · L Triados · P Total de Eliminados ·
    T Observação · U Nome do cargo · V Total convocados para entrevista.
    Editais de outras bancas (04/2026, 96/2025, 97/2025, FGV 2025, FCC) trazem
    o nome do cargo na coluna A e só inscritos e eliminados: não é erro, o
    processo é outro. Nelas CO_VAGA fica nulo e a chave usa o nome do cargo.

  O QUE NÃO VEM DA PLANILHA (calculado na leitura, get_selecao_da_area)
    Convocados para entrevista (V): o edital que tem entrevista em
      TB_ENTREVISTA (planilha ou sistema, ativas) usa só a tabela: a contagem
      das linhas da vaga, e 0 para a vaga sem nenhuma (não houve convocado —
      decisão de 30/09/2026). Edital sem nenhuma entrevista na tabela usa o V
      da planilha (dado antigo, de antes do controle das pastas).
    Aprovados (W), contratados (X) e não contratados (Y): da lista de aprovados
      vigente do edital (TB_LISTA_APROVADO × TB_CANDIDATO_APROVADO, sem os
      removidos), pela vaga. X = status Contratado ou Migração; Y = W − X.
      Edital sem lista vigente: nulos ("—" na tela).

  ÁREA E EDITAL (finalizar_sync_selecao)
    A área vem da unidade (TA_UNIDADE_AREA; unidade fora dela é da Saúde
    Indígena, como diz a tabela). O edital é o de mesmo número
    (FC_NUMERO_EDITAL) em TB_MONITORAMENTO_INDIGENA, de preferência na mesma
    área e da mesma unidade; achado, a área passa a ser a dele.

  O QUE ENTRA
    public."TB_SELECAO_VAGA"      uma vaga da aba Resultado
    public."TL_SYNC_SELECAO"      cada carga (quando, quantas linhas, situação)
    sincronizar_selecao / finalizar_sync_selecao   carga, só service_role
    get_selecao_da_area(p_area)   leitura, recurso 'selecao' >= leitor, área e
                                  recorte da coordenação
    Recurso de permissão 'selecao' (os mesmos níveis de 'entrevistas') e a aba
    'selecao' no catálogo, DESLIGADA: 20261001090500_liga_aba_selecao.sql liga
    junto com o front.

  O QUE NÃO MUDA
    O painel externo "Seleção" continua ativo; sai depois da aprovação da aba
    nova, como foi com Recursos e Entrevistas.

  Rollback: supabase/rollback/20261001090000_selecao.sql
*/
begin;

-- 1. Permissão: recurso 'selecao' ---------------------------------------------------
create or replace function private."FC_RECURSOS_MODULO"()
 returns text[]
 language sql
 immutable
 set search_path to ''
as $function$
  select array['dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes','acessos','recursos','entrevistas','selecao']::text[];
$function$;

insert into public."TA_GRUPO_ACESSO_RECURSO" ("CO_GRUPO_ACESSO", "NO_RECURSO", "TP_NIVEL")
select g, 'selecao', n
  from (values ('admin','admin'), ('edital_gestor','editor'), ('coordenador','editor'),
               ('contratador','leitor'), ('usuario','leitor')) v(g, n)
 where exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = v.g)
on conflict ("CO_GRUPO_ACESSO", "NO_RECURSO") do nothing;

-- 2. Vaga da aba Resultado ----------------------------------------------------------
create table public."TB_SELECAO_VAGA" (
  "CO_SELECAO_VAGA" uuid not null default gen_random_uuid(),
  "CO_AREA" text not null,
  "CO_MONITORAMENTO" uuid,
  "DS_EDITAL" text not null,
  "CO_VAGA" text,
  "DS_VAGA_PLANILHA" text not null,
  "NO_UNIDADE" text,
  "NO_CARGO" text,
  "QT_INSCRITO" integer,
  "QT_APTO_ANALISE" integer,
  "QT_CANCELADO" integer,
  "QT_REPROVADO_QUESTIONARIO" integer,
  "QT_ELIMINADO_NOTA" integer,
  "QT_REPROVADO_ANALISE" integer,
  "QT_TRIADO" integer,
  "QT_TOTAL_ELIMINADO" integer,
  "QT_CONVOCADO_PLANILHA" integer,
  "DS_OBSERVACAO" text,
  "DS_CHAVE_ORIGEM" text not null,
  "CO_SYNC" text,
  "ST_REGISTRO_ATIVO" varchar(1) not null default 'S',
  "DT_CRIACAO" timestamptz not null default now(),
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_SELECAO_VAGA" primary key ("CO_SELECAO_VAGA"),
  constraint "UK_SELECAOVAGA_CHAVEORIGEM" unique ("DS_CHAVE_ORIGEM"),
  constraint "FK_AREA_SELECAOVAGA" foreign key ("CO_AREA") references public."TB_AREA" ("CO_AREA"),
  constraint "FK_MONITORAMENTO_SELECAOVAGA" foreign key ("CO_MONITORAMENTO") references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "CK_SELECAOVAGA_COVAGA" check ("CO_VAGA" is null or "CO_VAGA" ~ '^[0-9]{1,20}$'),
  constraint "CK_SELECAOVAGA_STREGATIVO" check ("ST_REGISTRO_ATIVO" in ('S', 'N')),
  constraint "CK_SELECAOVAGA_TAMANHOS" check (
    length("DS_EDITAL") <= 120 and length("DS_VAGA_PLANILHA") <= 400
    and coalesce(length("NO_UNIDADE"), 0) <= 200 and coalesce(length("NO_CARGO"), 0) <= 400
    and coalesce(length("DS_OBSERVACAO"), 0) <= 1000
  )
);
comment on table public."TB_SELECAO_VAGA" is
  'Uma vaga da aba Resultado da planilha "Auditoria" (aba Seleção): o funil da vaga (inscritos, aptos, eliminados, triados) e os convocados antigos. Convocados atuais, aprovados e contratados são calculados na leitura (get_selecao_da_area).';
comment on column public."TB_SELECAO_VAGA"."CO_SELECAO_VAGA" is 'Identificador da linha.';
comment on column public."TB_SELECAO_VAGA"."CO_AREA" is 'Área da vaga: a do edital ligado; sem edital, a da unidade (TA_UNIDADE_AREA; fora dela, saude-indigena).';
comment on column public."TB_SELECAO_VAGA"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA.id) de mesmo número, de preferência na mesma área e unidade. Nulo: edital não cadastrado.';
comment on column public."TB_SELECAO_VAGA"."DS_EDITAL" is 'Edital como veio da planilha (coluna B; ex.: 39/2026 (sanitarista), FGV 2025).';
comment on column public."TB_SELECAO_VAGA"."CO_VAGA" is 'Código numérico da vaga (coluna A). Nulo nas outras bancas, que trazem o nome do cargo na coluna A.';
comment on column public."TB_SELECAO_VAGA"."DS_VAGA_PLANILHA" is 'Coluna A como veio (código da vaga ou, nas outras bancas, o nome do cargo).';
comment on column public."TB_SELECAO_VAGA"."NO_UNIDADE" is 'Nome da unidade (coluna C).';
comment on column public."TB_SELECAO_VAGA"."NO_CARGO" is 'Nome do cargo (coluna U; sem ela, a coluna A).';
comment on column public."TB_SELECAO_VAGA"."QT_INSCRITO" is 'Inscritos (coluna F).';
comment on column public."TB_SELECAO_VAGA"."QT_APTO_ANALISE" is 'Aptos para análise (coluna G).';
comment on column public."TB_SELECAO_VAGA"."QT_CANCELADO" is 'Cancelados (coluna H).';
comment on column public."TB_SELECAO_VAGA"."QT_REPROVADO_QUESTIONARIO" is 'Reprovados por não finalizar o questionário (coluna I).';
comment on column public."TB_SELECAO_VAGA"."QT_ELIMINADO_NOTA" is 'Eliminados por nota (coluna J).';
comment on column public."TB_SELECAO_VAGA"."QT_REPROVADO_ANALISE" is 'Reprovados na análise (coluna K).';
comment on column public."TB_SELECAO_VAGA"."QT_TRIADO" is 'Triados (coluna L).';
comment on column public."TB_SELECAO_VAGA"."QT_TOTAL_ELIMINADO" is 'Total de eliminados (coluna P).';
comment on column public."TB_SELECAO_VAGA"."QT_CONVOCADO_PLANILHA" is 'Total convocados para entrevista na planilha (coluna V). Só vale para edital sem entrevista em TB_ENTREVISTA.';
comment on column public."TB_SELECAO_VAGA"."DS_OBSERVACAO" is 'Observação (coluna T).';
comment on column public."TB_SELECAO_VAGA"."DS_CHAVE_ORIGEM" is 'Chave natural: número do edital | código da vaga (ou cargo:<nome sem acento>), com #2, #3… para vaga de mesmo nome e números diferentes. A carga faz upsert por ela.';
comment on column public."TB_SELECAO_VAGA"."CO_SYNC" is 'Última carga (TL_SYNC_SELECAO) que trouxe a linha.';
comment on column public."TB_SELECAO_VAGA"."ST_REGISTRO_ATIVO" is 'S: está na planilha; N: saiu numa carga (fica para o histórico).';
comment on column public."TB_SELECAO_VAGA"."DT_CRIACAO" is 'Primeira carga da linha.';
comment on column public."TB_SELECAO_VAGA"."DT_ATUALIZACAO" is 'Última carga que mudou ou confirmou a linha.';
comment on constraint "UK_SELECAOVAGA_CHAVEORIGEM" on public."TB_SELECAO_VAGA" is 'Uma linha por chave natural.';
comment on constraint "FK_AREA_SELECAOVAGA" on public."TB_SELECAO_VAGA" is 'Área da vaga.';
comment on constraint "FK_MONITORAMENTO_SELECAOVAGA" on public."TB_SELECAO_VAGA" is 'Edital da vaga.';
comment on constraint "CK_SELECAOVAGA_COVAGA" on public."TB_SELECAO_VAGA" is 'Código da vaga só com dígitos.';
comment on constraint "CK_SELECAOVAGA_STREGATIVO" on public."TB_SELECAO_VAGA" is 'Flag S/N.';
comment on constraint "CK_SELECAOVAGA_TAMANHOS" on public."TB_SELECAO_VAGA" is 'Limites de tamanho dos textos.';

create index "IN_SELECAOVAGA_COAREA" on public."TB_SELECAO_VAGA" ("CO_AREA") where "ST_REGISTRO_ATIVO" = 'S';
create index "IN_FKSELECAOVAGA_COMONITOR" on public."TB_SELECAO_VAGA" ("CO_MONITORAMENTO");
comment on index public."IN_SELECAOVAGA_COAREA" is 'Vagas ativas por área (leitura da aba).';
comment on index public."IN_FKSELECAOVAGA_COMONITOR" is 'Chave estrangeira para TB_MONITORAMENTO_INDIGENA.';

-- 3. Log das cargas -----------------------------------------------------------------
create table public."TL_SYNC_SELECAO" (
  "CO_SYNC" text not null,
  "DT_INICIO" timestamptz not null default now(),
  "DT_FIM" timestamptz,
  "QT_LINHA" integer not null default 0,
  "QT_SEM_EDITAL" integer,
  "QT_DESATIVADA" integer,
  "TP_SITUACAO" text not null default 'EM_ANDAMENTO',
  "DS_MENSAGEM" text,
  constraint "PK_TL_SYNC_SELECAO" primary key ("CO_SYNC"),
  constraint "CK_SYNCSELECAO_COSYNC" check ("CO_SYNC" ~ '^[A-Za-z0-9_-]{8,80}$'),
  constraint "CK_SYNCSELECAO_TPSITUACAO" check ("TP_SITUACAO" in ('EM_ANDAMENTO', 'CONCLUIDA', 'RECUSADA'))
);
comment on table public."TL_SYNC_SELECAO" is 'Log das cargas da aba Resultado da planilha "Auditoria" (aba Seleção).';
comment on column public."TL_SYNC_SELECAO"."CO_SYNC" is 'Identificador da carga (gerado pelo script).';
comment on column public."TL_SYNC_SELECAO"."DT_INICIO" is 'Primeiro lote recebido.';
comment on column public."TL_SYNC_SELECAO"."DT_FIM" is 'Fechamento (finalizar_sync_selecao).';
comment on column public."TL_SYNC_SELECAO"."QT_LINHA" is 'Linhas recebidas (sem repetidas).';
comment on column public."TL_SYNC_SELECAO"."QT_SEM_EDITAL" is 'Vagas ativas sem edital cadastrado, no fechamento.';
comment on column public."TL_SYNC_SELECAO"."QT_DESATIVADA" is 'Vagas que saíram da planilha nesta carga.';
comment on column public."TL_SYNC_SELECAO"."TP_SITUACAO" is 'EM_ANDAMENTO, CONCLUIDA ou RECUSADA (carga pequena demais sem forçar).';
comment on column public."TL_SYNC_SELECAO"."DS_MENSAGEM" is 'Motivo da recusa ou observação.';
comment on constraint "CK_SYNCSELECAO_COSYNC" on public."TL_SYNC_SELECAO" is 'Identificador de 8 a 80 caracteres seguros.';
comment on constraint "CK_SYNCSELECAO_TPSITUACAO" on public."TL_SYNC_SELECAO" is 'Situações válidas.';

-- 4. Acesso: só as funções abaixo ----------------------------------------------------
alter table public."TB_SELECAO_VAGA" enable row level security;
alter table public."TL_SYNC_SELECAO" enable row level security;
revoke all on public."TB_SELECAO_VAGA", public."TL_SYNC_SELECAO" from public, anon, authenticated;

-- 5. Carga (service_role) ------------------------------------------------------------
create function public.sincronizar_selecao(p_sync text, p_linhas jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_qt integer;
begin
  if p_sync is null or p_sync !~ '^[A-Za-z0-9_-]{8,80}$' then
    raise exception 'Identificador de carga inválido' using errcode = '22023';
  end if;
  if jsonb_typeof(p_linhas) is distinct from 'array' or jsonb_array_length(p_linhas) not between 1 and 1000 then
    raise exception 'Envie de 1 a 1000 linhas por lote' using errcode = '22023';
  end if;

  insert into public."TL_SYNC_SELECAO" ("CO_SYNC") values (p_sync) on conflict ("CO_SYNC") do nothing;
  if exists (select 1 from public."TL_SYNC_SELECAO" s
              where s."CO_SYNC" = p_sync and s."TP_SITUACAO" <> 'EM_ANDAMENTO') then
    raise exception 'Carga % já fechada', p_sync using errcode = '22023';
  end if;

  create temporary table if not exists pg_temp.tmp_selecao_lote (
    chave text, edital text, vaga text, co_vaga text, unidade text, cargo text,
    inscritos integer, aptos integer, cancelados integer, reprovados_questionario integer,
    eliminados_nota integer, reprovados_analise integer, triados integer,
    total_eliminados integer, convocados integer, observacao text
  ) on commit drop;
  truncate pg_temp.tmp_selecao_lote;

  -- Números: o script já manda inteiros; aqui só se aceita inteiro (ou nulo).
  insert into pg_temp.tmp_selecao_lote
  select distinct on (x.chave) x.*
    from (
      select
        coalesce(private."FC_NUMERO_EDITAL"(l.edital), private."FC_TEXTO_BUSCA_RECURSO"(l.edital)) || '|' ||
          case when btrim(l.vaga) ~ '^[0-9]{1,20}$' then btrim(l.vaga)
               else 'cargo:' || private."FC_TEXTO_BUSCA_RECURSO"(l.vaga) end ||
          -- Vaga de mesmo nome e números diferentes (outras bancas): 2ª, 3ª…
          case when l.repeticao ~ '^[0-9]{1,3}$' and l.repeticao::integer > 1 then '#' || l.repeticao else '' end as chave,
        btrim(l.edital) as edital,
        btrim(l.vaga) as vaga,
        case when btrim(l.vaga) ~ '^[0-9]{1,20}$' then btrim(l.vaga) end as co_vaga,
        nullif(btrim(l.unidade), '') as unidade,
        coalesce(nullif(btrim(l.cargo), ''), btrim(l.vaga)) as cargo,
        case when l.inscritos ~ '^-?[0-9]{1,9}$' then l.inscritos::integer end,
        case when l.aptos ~ '^-?[0-9]{1,9}$' then l.aptos::integer end,
        case when l.cancelados ~ '^-?[0-9]{1,9}$' then l.cancelados::integer end,
        case when l.reprovados_questionario ~ '^-?[0-9]{1,9}$' then l.reprovados_questionario::integer end,
        case when l.eliminados_nota ~ '^-?[0-9]{1,9}$' then l.eliminados_nota::integer end,
        case when l.reprovados_analise ~ '^-?[0-9]{1,9}$' then l.reprovados_analise::integer end,
        case when l.triados ~ '^-?[0-9]{1,9}$' then l.triados::integer end,
        case when l.total_eliminados ~ '^-?[0-9]{1,9}$' then l.total_eliminados::integer end,
        case when l.convocados ~ '^-?[0-9]{1,9}$' then l.convocados::integer end,
        nullif(btrim(l.observacao), '') as observacao
      from jsonb_to_recordset(p_linhas) as l(
        edital text, vaga text, unidade text, cargo text, inscritos text, aptos text,
        cancelados text, reprovados_questionario text, eliminados_nota text,
        reprovados_analise text, triados text, total_eliminados text, convocados text,
        observacao text, repeticao text)
      where btrim(coalesce(l.edital, '')) <> '' and btrim(coalesce(l.vaga, '')) <> ''
    ) x
   order by x.chave;

  insert into public."TB_SELECAO_VAGA" as s (
    "CO_AREA", "DS_EDITAL", "CO_VAGA", "DS_VAGA_PLANILHA", "NO_UNIDADE", "NO_CARGO",
    "QT_INSCRITO", "QT_APTO_ANALISE", "QT_CANCELADO", "QT_REPROVADO_QUESTIONARIO",
    "QT_ELIMINADO_NOTA", "QT_REPROVADO_ANALISE", "QT_TRIADO", "QT_TOTAL_ELIMINADO",
    "QT_CONVOCADO_PLANILHA", "DS_OBSERVACAO", "DS_CHAVE_ORIGEM", "CO_SYNC", "ST_REGISTRO_ATIVO")
  select
    -- Área provisória pela unidade; finalizar_sync_selecao acerta pelo edital.
    coalesce((select u."CO_AREA" from public."TA_UNIDADE_AREA" u
               where private."FC_TEXTO_BUSCA_RECURSO"(u."NO_UNIDADE") = private."FC_TEXTO_BUSCA_RECURSO"(t.unidade)
               limit 1), 'saude-indigena'),
    left(t.edital, 120), t.co_vaga, left(t.vaga, 400), left(t.unidade, 200), left(t.cargo, 400),
    t.inscritos, t.aptos, t.cancelados, t.reprovados_questionario, t.eliminados_nota,
    t.reprovados_analise, t.triados, t.total_eliminados, t.convocados, left(t.observacao, 1000),
    t.chave, p_sync, 'S'
    from pg_temp.tmp_selecao_lote t
  on conflict ("DS_CHAVE_ORIGEM") do update set
    "DS_EDITAL" = excluded."DS_EDITAL",
    "DS_VAGA_PLANILHA" = excluded."DS_VAGA_PLANILHA",
    "NO_UNIDADE" = excluded."NO_UNIDADE",
    "NO_CARGO" = excluded."NO_CARGO",
    "QT_INSCRITO" = excluded."QT_INSCRITO",
    "QT_APTO_ANALISE" = excluded."QT_APTO_ANALISE",
    "QT_CANCELADO" = excluded."QT_CANCELADO",
    "QT_REPROVADO_QUESTIONARIO" = excluded."QT_REPROVADO_QUESTIONARIO",
    "QT_ELIMINADO_NOTA" = excluded."QT_ELIMINADO_NOTA",
    "QT_REPROVADO_ANALISE" = excluded."QT_REPROVADO_ANALISE",
    "QT_TRIADO" = excluded."QT_TRIADO",
    "QT_TOTAL_ELIMINADO" = excluded."QT_TOTAL_ELIMINADO",
    "QT_CONVOCADO_PLANILHA" = excluded."QT_CONVOCADO_PLANILHA",
    "DS_OBSERVACAO" = excluded."DS_OBSERVACAO",
    "CO_SYNC" = excluded."CO_SYNC",
    "ST_REGISTRO_ATIVO" = 'S',
    "DT_ATUALIZACAO" = now();

  select count(*) into v_qt from pg_temp.tmp_selecao_lote;
  update public."TL_SYNC_SELECAO" set "QT_LINHA" = "QT_LINHA" + v_qt where "CO_SYNC" = p_sync;
  return jsonb_build_object('recebidas', jsonb_array_length(p_linhas), 'gravadas', v_qt);
end;
$function$;
comment on function public.sincronizar_selecao(text, jsonb) is
  'Recebe um lote (até 1000) de linhas da aba Resultado da planilha "Auditoria" e faz upsert em TB_SELECAO_VAGA. Só service_role (scripts/sincronizar-selecao.mjs). Fechar com finalizar_sync_selecao.';

create function public.finalizar_sync_selecao(p_sync text, p_forcar boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_sync public."TL_SYNC_SELECAO";
  v_ativas integer;
  v_desativadas integer;
  v_sem_edital integer;
begin
  select * into v_sync from public."TL_SYNC_SELECAO" s where s."CO_SYNC" = p_sync for update;
  if v_sync."CO_SYNC" is null or v_sync."TP_SITUACAO" <> 'EM_ANDAMENTO' then
    raise exception 'Carga % não encontrada ou já fechada', p_sync using errcode = '22023';
  end if;

  select count(*) into v_ativas from public."TB_SELECAO_VAGA" s where s."ST_REGISTRO_ATIVO" = 'S';
  if not coalesce(p_forcar, false) and v_ativas > 0 and v_sync."QT_LINHA" * 2 < v_ativas then
    update public."TL_SYNC_SELECAO" set "TP_SITUACAO" = 'RECUSADA', "DT_FIM" = now(),
      "DS_MENSAGEM" = format('Carga com %s linhas e %s ativas no banco: menos da metade. Nada foi desativado; confira a planilha ou rode com forçar.', v_sync."QT_LINHA", v_ativas)
     where "CO_SYNC" = p_sync;
    return jsonb_build_object('situacao', 'RECUSADA', 'linhas', v_sync."QT_LINHA", 'ativas', v_ativas);
  end if;

  update public."TB_SELECAO_VAGA" s set "ST_REGISTRO_ATIVO" = 'N', "DT_ATUALIZACAO" = now()
   where s."ST_REGISTRO_ATIVO" = 'S' and s."CO_SYNC" is distinct from p_sync;
  get diagnostics v_desativadas = row_count;

  -- Edital e área em conjunto (os números calculados uma vez, não por linha).
  with m as materialized (
    select m.id, m."CO_AREA" as area, m.ativo,
           private."FC_NUMERO_EDITAL"(m.edital) as numero,
           private."FC_TEXTO_BUSCA_RECURSO"(m.unidade) as unidade
      from public."TB_MONITORAMENTO_INDIGENA" m
     where private."FC_NUMERO_EDITAL"(m.edital) is not null
  ),
  u as materialized (
    select private."FC_TEXTO_BUSCA_RECURSO"(u."NO_UNIDADE") as unidade, u."CO_AREA" as area
      from public."TA_UNIDADE_AREA" u
  ),
  s as materialized (
    select s."CO_SELECAO_VAGA" as id,
           private."FC_NUMERO_EDITAL"(s."DS_EDITAL") as numero,
           private."FC_TEXTO_BUSCA_RECURSO"(s."NO_UNIDADE") as unidade
      from public."TB_SELECAO_VAGA" s
     where s."ST_REGISTRO_ATIVO" = 'S'
  ),
  com_area as (
    select s.*, coalesce((select u.area from u where u.unidade = s.unidade limit 1), 'saude-indigena') as area_unidade
      from s
  ),
  alvo as (
    select c.id, c.area_unidade, e.id as edital_id, e.area as area_edital
      from com_area c
      left join lateral (
        select m.id, m.area from m
         where c.numero is not null and m.numero = c.numero
         order by (m.area = c.area_unidade) desc, (m.unidade = c.unidade) desc, m.ativo desc
         limit 1
      ) e on true
  )
  update public."TB_SELECAO_VAGA" s set
    "CO_MONITORAMENTO" = alvo.edital_id,
    "CO_AREA" = coalesce(alvo.area_edital, alvo.area_unidade)
    from alvo
   where s."CO_SELECAO_VAGA" = alvo.id
     and (s."CO_MONITORAMENTO" is distinct from alvo.edital_id
          or s."CO_AREA" is distinct from coalesce(alvo.area_edital, alvo.area_unidade));

  select count(*) filter (where s."CO_MONITORAMENTO" is null) into v_sem_edital
    from public."TB_SELECAO_VAGA" s where s."ST_REGISTRO_ATIVO" = 'S';

  update public."TL_SYNC_SELECAO" set
    "TP_SITUACAO" = 'CONCLUIDA', "DT_FIM" = now(),
    "QT_SEM_EDITAL" = v_sem_edital, "QT_DESATIVADA" = v_desativadas,
    "DS_MENSAGEM" = case when coalesce(p_forcar, false) then 'Fechada com forçar.' end
   where "CO_SYNC" = p_sync;

  return jsonb_build_object('situacao', 'CONCLUIDA', 'linhas', v_sync."QT_LINHA",
    'sem_edital', v_sem_edital, 'desativadas', v_desativadas);
end;
$function$;
comment on function public.finalizar_sync_selecao(text, boolean) is
  'Fecha uma carga da aba Seleção: desativa (ST_REGISTRO_ATIVO = N) o que saiu da planilha, liga o edital, acerta a área e grava os totais no log. Recusa carga com menos da metade das linhas ativas sem p_forcar. Só service_role.';

revoke all on function public.sincronizar_selecao(text, jsonb) from public, anon, authenticated;
revoke all on function public.finalizar_sync_selecao(text, boolean) from public, anon, authenticated;
grant execute on function public.sincronizar_selecao(text, jsonb) to service_role;
grant execute on function public.finalizar_sync_selecao(text, boolean) to service_role;

-- 6. Leitura da aba ------------------------------------------------------------------
create function public.get_selecao_da_area(p_area text)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_editais uuid[];
begin
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if not private.pode_recurso('selecao', 1) then
    raise exception 'Sem permissão para Seleção' using errcode = '42501';
  end if;
  if not private."FC_PODE_AREA"(p_area) then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  v_editais := (select private."FC_EDITAIS_VISIVEIS"())::uuid[];

  return (
    with s as (
      select s.*, private."FC_NUMERO_EDITAL"(s."DS_EDITAL") as numero
        from public."TB_SELECAO_VAGA" s
       where s."CO_AREA" = p_area and s."ST_REGISTRO_ATIVO" = 'S'
         and (v_editais is null or s."CO_MONITORAMENTO" = any (v_editais))
    ),
    -- Convocados: entrevistas ativas (planilha ou sistema) por edital e vaga.
    convocados as (
      select private."FC_NUMERO_EDITAL"(e."DS_EDITAL") as numero, e."CO_VAGA" as vaga, count(*)::integer as qt
        from public."TB_ENTREVISTA" e
       where e."CO_AREA" = p_area and e."ST_ATIVO" = 'S'
       group by 1, 2
    ),
    editais_com_entrevista as (
      select distinct c.numero from convocados c where c.numero is not null
    ),
    -- Lista de aprovados vigente dos editais ligados.
    listas as (
      select l.id, l.edital_id
        from public."TB_LISTA_APROVADO" l
       where l.vigente is true
         and l.edital_id in (select s."CO_MONITORAMENTO"::text from s where s."CO_MONITORAMENTO" is not null)
    ),
    aprovados as (
      select l.edital_id, regexp_replace(coalesce(c.codigo_vaga, ''), '[^0-9]', '', 'g') as vaga,
             count(*)::integer as total,
             (count(*) filter (where c.status in ('Contratado', 'Migração')))::integer as contratados
        from listas l
        join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
       group by 1, 2
    ),
    linhas as (
      select s.*,
             m.edital as edital_cadastrado,
             (s.numero is not null and s.numero in (select x.numero from editais_com_entrevista x)) as usa_entrevistas,
             cv.qt as qt_convocado_entrevistas,
             exists (select 1 from listas l where l.edital_id = s."CO_MONITORAMENTO"::text) as tem_lista,
             ap.total as qt_aprovado,
             ap.contratados as qt_contratado
        from s
        left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = s."CO_MONITORAMENTO"
        left join convocados cv on cv.numero = s.numero and cv.vaga = s."CO_VAGA"
        left join aprovados ap on ap.edital_id = s."CO_MONITORAMENTO"::text and ap.vaga = s."CO_VAGA"
    )
    select json_build_object(
      'schema_version', 1,
      'area', p_area,
      'gerado_em', now(),
      'ultima_carga', (
        select json_build_object('em', t."DT_FIM", 'linhas', t."QT_LINHA", 'sem_edital', t."QT_SEM_EDITAL")
          from public."TL_SYNC_SELECAO" t
         where t."TP_SITUACAO" = 'CONCLUIDA'
         order by t."DT_FIM" desc limit 1
      ),
      'vagas', (
        select coalesce(json_agg(json_build_object(
            'id', l."CO_SELECAO_VAGA",
            'edital_id', l."CO_MONITORAMENTO",
            'edital', coalesce(l.edital_cadastrado, l."DS_EDITAL"),
            'edital_planilha', l."DS_EDITAL",
            'unidade', l."NO_UNIDADE",
            'vaga', l."CO_VAGA",
            'vaga_planilha', l."DS_VAGA_PLANILHA",
            'cargo', l."NO_CARGO",
            'inscritos', l."QT_INSCRITO",
            'aptos', l."QT_APTO_ANALISE",
            'cancelados', l."QT_CANCELADO",
            'reprovados_questionario', l."QT_REPROVADO_QUESTIONARIO",
            'eliminados_nota', l."QT_ELIMINADO_NOTA",
            'reprovados_analise', l."QT_REPROVADO_ANALISE",
            'triados', l."QT_TRIADO",
            'total_eliminados', l."QT_TOTAL_ELIMINADO",
            'observacao', l."DS_OBSERVACAO",
            'convocados', case when l.usa_entrevistas then coalesce(l.qt_convocado_entrevistas, 0)
                               else l."QT_CONVOCADO_PLANILHA" end,
            'origem_convocados', case when l.usa_entrevistas then 'entrevistas' else 'planilha' end,
            'aprovados', case when l.tem_lista then coalesce(l.qt_aprovado, 0) end,
            'contratados', case when l.tem_lista then coalesce(l.qt_contratado, 0) end,
            'nao_contratados', case when l.tem_lista then coalesce(l.qt_aprovado, 0) - coalesce(l.qt_contratado, 0) end
          ) order by coalesce(l.edital_cadastrado, l."DS_EDITAL"), l."NO_UNIDADE", l."NO_CARGO", l."CO_VAGA"), '[]'::json)
          from linhas l
      )
    )
  );
end;
$function$;
comment on function public.get_selecao_da_area(text) is
  'Leitura da aba Seleção de uma área (json): o funil de cada vaga (aba Resultado da Auditoria), os convocados (TB_ENTREVISTA quando o edital tem entrevista; senão o V da planilha) e aprovados/contratados/não contratados da lista vigente. Exige selecao >= leitor, a área e o recorte da coordenação.';
revoke all on function public.get_selecao_da_area(text) from public, anon;
grant execute on function public.get_selecao_da_area(text) to authenticated, service_role;

-- 7. Catálogo de abas ----------------------------------------------------------------
-- A aba entra DESLIGADA (ST_ATIVO = 'N'): o front publicado ainda não tem a
-- view 'selecao'. Liga junto com o merge do front
-- (20261001090500_liga_aba_selecao.sql).
insert into public."TB_ABA" ("CO_ABA", "NO_ABA", "DS_ICONE", "NU_ORDEM", "CO_VIEW", "CO_RECURSO", "TP_ABA", "ST_ATIVO")
values ('selecao', 'Seleção', 'funnel', 8, 'selecao', 'selecao', 'nativa', 'N');
insert into public."RL_ABA_AREA" ("CO_ABA", "CO_AREA", "ST_ATIVO")
select 'selecao', a."CO_AREA", 'S' from public."TB_AREA" a
on conflict do nothing;

commit;
