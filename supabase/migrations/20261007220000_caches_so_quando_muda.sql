/*
  CACHES DOS PAINÉIS SÓ QUANDO OS DADOS MUDAM (07/10/2026)

  Pedido: "temos que parar de sobrecarregar o banco". Medição real
  (pg_stat_statements de 02/10 a 07/10/2026, ~5,5 dias):

    tarefa / RPC                                   chamadas   média     total
    agsus_aprovados_cache_por_area (2 em 2 min)      3.951   1.042 ms  4.118 s
    agsus_entrevistas_cache_do_painel (2 em 2 min)   3.953     686 ms  2.711 s
    agsus_analises_cache_do_painel (2 em 2 min)      3.952     613 ms  2.422 s
    obter_marcos_da_area (Visão geral)                  426   2.957 ms  1.260 s
    WAL gerado: 4,5 GB, dos quais 1,8 GB do manifesto da comparação das análises
    (TM_MANIFESTO_ANALISE) e ~2 GB dos três caches (JSON grande reescrito a cada
    remontagem). O realtime.list_changes (327.849 chamadas, 3.107 s) decodifica
    esse WAL todo, mesmo sem nenhuma tabela dele na publicação.

  Por que custava
    - Aprovados: a cada 2 min, private."FC_VERSAO_APROVADOS_AREA" lia e somava o
      xmin de todos os candidatos das listas vigentes de cada área (até ~2 s em
      sessão nova — cada execução do pg_cron é uma sessão nova), só para descobrir
      que nada tinha mudado.
    - Análises e Entrevistas: a "versão" era a contagem de syncs terminados. Todo
      sync (144 por dia em Projetos, 2/3 sem nenhuma mudança) remontava o painel
      de análises E o de entrevistas da área, mais a remontagem fixa a cada 6 h.

  O que muda
    1. private."TL_ALTERACAO_CACHE": marca "este cache desta área precisa ser
       refeito". Quem grava é um gatilho POR COMANDO (não por linha), com as
       tabelas de transição, nas tabelas de origem de cada cache:
         APROVADOS   TB_LISTA_APROVADO, TB_CANDIDATO_APROVADO,
                     TB_MONITORAMENTO_INDIGENA (edital, unidade ou área mudou)
         ANALISES    TB_ANALISE_CURRICULAR, TB_EDITAL_ANALISE (só linha que mudou
                     de fato: o sync regrava os editais iguais a cada execução)
         ENTREVISTAS TB_ENTREVISTA, TB_ENTREVISTA_NOTA, TL_SYNC_ENTREVISTA
                     (carga concluída), TB_MONITORAMENTO_INDIGENA (edital,
                     unidade ou área), TB_ANALISE_CURRICULAR (só análise
                     'Aprovado' ou ligada a uma entrevista — as únicas que o
                     pacote mostra)
         todos       TB_AREA
       Só insere (nunca atualiza): o gatilho não disputa linha com ninguém.
    2. Quem remonta (atualizar_cache_*) apaga as marcas da área ANTES de montar.
       Mudança que confirmar durante a montagem deixa marca nova e o pacote é
       refeito na rodada seguinte (nunca fica um pacote velho com cara de novo).
       DS_VERSAO_DADOS passa a ser o instante da montagem (em microssegundos).
    3. As três tarefas (mesmos nomes e horários) só remontam a área com marca, sem
       pacote ou com pacote de mais de 24 h (rede de segurança no lugar das 6 h e
       dos 30 min). Sem mudança: uma consulta num índice, ~1 ms.
    4. listar_candidatos_aprovados_compacto e get_analises_dashboard_payload_v2
       usam a marca no lugar das funções de versão (que saem). A versão entregue
       à tela de aprovados continua opaca: a do pacote, mais a contagem/última
       marca pendente, mais o recorte por coordenação.
    5. obter_marcos_da_area (2,96 s por chamada: varria a VW_ANALISES_DASHBOARD_BASE_TODOS
       da área inteira) lê as concluídas por ano guardadas no pacote do painel de
       análises (coluna nova DS_CONCLUIDAS_POR_ANO, montada junto). Sem o pacote,
       conta na hora como antes.
    6. Os três caches e as duas tabelas de passagem das análises
       (TM_ANALISE_CURRICULAR, TM_MANIFESTO_ANALISE) ficam UNLOGGED: são
       refeitos a partir das tabelas de origem e não geram mais WAL. Se o banco
       cair, o Postgres os esvazia; os caches são remontados (a RPC monta na hora
       enquanto isso) e o sync interrompido é encerrado pela tarefa
       agsus_analises_encerrar_inativas, como qualquer sync abandonado.
    7. finalizar_sync_analises_incremental só regrava o edital que mudou (antes
       regravava todos, com updated_at = now(), a cada sync).
       'analises_editais_upsert' passa a contar só os editais gravados de fato.

  Assinaturas das RPCs da tela iguais (src/lib/rpc-contrato.js não muda).
  Ensaio (begin … rollback) com o resultado comparado ao cálculo completo: ver
  docs/python-no-monitora.md, seção "Carga do banco".
*/
begin;

-- 1. Marcas -------------------------------------------------------------------------------------
create table private."TL_ALTERACAO_CACHE" (
  "CO_ALTERACAO_CACHE" bigint generated always as identity,
  "TP_CACHE" varchar(20) not null,
  "CO_AREA" text not null,
  "NO_TABELA_ORIGEM" varchar(63) not null,
  "DT_ALTERACAO" timestamptz not null default now(),
  constraint "PK_TL_ALTERACAO_CACHE" primary key ("CO_ALTERACAO_CACHE"),
  constraint "CK_TLALTERCACHE_TPCACHE" check ("TP_CACHE" in ('APROVADOS', 'ANALISES', 'ENTREVISTAS'))
);
create index "IN_TLALTERCACHE_TPCACHE_AREA" on private."TL_ALTERACAO_CACHE" ("TP_CACHE", "CO_AREA");
alter table private."TL_ALTERACAO_CACHE" enable row level security;
revoke all on table private."TL_ALTERACAO_CACHE" from public, anon, authenticated;

comment on table private."TL_ALTERACAO_CACHE" is
  'Marcas de cache a refazer (20261007220000): uma linha por comando que mudou uma tabela de origem de um cache dos painéis, por tipo de cache e área. Gravada pelos gatilhos TG_*_CACHE; apagada por quem remonta o cache (atualizar_cache_*). Sem linha para o tipo e a área = cache em dia.';
comment on column private."TL_ALTERACAO_CACHE"."CO_ALTERACAO_CACHE" is 'Identificador da marca (sequencial).';
comment on column private."TL_ALTERACAO_CACHE"."TP_CACHE" is 'Cache a refazer: APROVADOS (TA_CANDIDATO_APROVADO_AREA), ANALISES (TA_PAINEL_ANALISE) ou ENTREVISTAS (TA_PAINEL_ENTREVISTA).';
comment on column private."TL_ALTERACAO_CACHE"."CO_AREA" is 'Área do cache (TB_AREA.CO_AREA).';
comment on column private."TL_ALTERACAO_CACHE"."NO_TABELA_ORIGEM" is 'Tabela cuja mudança gerou a marca (diagnóstico).';
comment on column private."TL_ALTERACAO_CACHE"."DT_ALTERACAO" is 'Quando a mudança foi gravada.';

create function private."FC_MARCAR_CACHE"(p_tipos text[], p_areas text[], p_tabela text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private."TL_ALTERACAO_CACHE" ("TP_CACHE", "CO_AREA", "NO_TABELA_ORIGEM")
  select t.tipo, a.area, left(p_tabela, 63)
    from unnest(p_tipos) as t(tipo)
   cross join (select distinct x from unnest(p_areas) as u(x) where x is not null) as a(area)
   order by 1, 2;
$$;
revoke all on function private."FC_MARCAR_CACHE"(text[], text[], text) from public, anon, authenticated;
comment on function private."FC_MARCAR_CACHE"(text[], text[], text) is
  'Marca os caches p_tipos das áreas p_areas como a refazer (TL_ALTERACAO_CACHE). Chamada pelos gatilhos por comando das tabelas de origem.';

create function private."FC_CACHE_DESATUALIZADO"(p_tipo text, p_area text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private."TL_ALTERACAO_CACHE" t
     where t."TP_CACHE" = p_tipo and t."CO_AREA" = p_area
  );
$$;
revoke all on function private."FC_CACHE_DESATUALIZADO"(text, text) from public, anon, authenticated;
comment on function private."FC_CACHE_DESATUALIZADO"(text, text) is
  'Verdadeiro quando há marca (TL_ALTERACAO_CACHE) para o cache p_tipo da área p_area: alguma tabela de origem mudou depois da última montagem.';

-- 2. Gatilhos por comando nas tabelas de origem --------------------------------------------------

/*
  Em cada função, a tabela de transição só é lida no ramo do evento que a tem
  (o PL/pgSQL prepara cada comando só quando ele roda): INSERT tem só `novas`,
  DELETE só `antigas`, UPDATE as duas.
*/

-- TB_ANALISE_CURRICULAR → ANALISES (toda mudança) e ENTREVISTAS (análise Aprovado ou ligada).
create function private."FC_TG_CACHE_ANALISE"()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_analises text[];
  v_entrevistas text[];
  v_a text[];
  v_e text[];
begin
  if tg_op in ('INSERT', 'UPDATE') then
    select array_agg(distinct n."CO_AREA"),
           array_agg(distinct n."CO_AREA") filter (
             where n.status_consolidado = 'Aprovado'
                or exists (select 1 from public."TB_ENTREVISTA" e where e."CO_ANALISE_CURRICULAR" = n.id))
      into v_analises, v_entrevistas
      from novas n;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    select array_agg(distinct o."CO_AREA"),
           array_agg(distinct o."CO_AREA") filter (
             where o.status_consolidado = 'Aprovado'
                or exists (select 1 from public."TB_ENTREVISTA" e where e."CO_ANALISE_CURRICULAR" = o.id))
      into v_a, v_e
      from antigas o;
    v_analises := v_analises || v_a;
    v_entrevistas := v_entrevistas || v_e;
  end if;
  perform private."FC_MARCAR_CACHE"(array['ANALISES'], v_analises, tg_table_name);
  perform private."FC_MARCAR_CACHE"(array['ENTREVISTAS'], v_entrevistas, tg_table_name);
  return null;
end;
$$;

-- TB_EDITAL_ANALISE → ANALISES (só o edital que mudou; área pelo grupo).
create function private."FC_TG_CACHE_EDITAL_ANALISE"()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grupos text[];
begin
  if tg_op = 'INSERT' then
    select array_agg(distinct n.grupo_norm) into v_grupos from novas n;
  elsif tg_op = 'DELETE' then
    select array_agg(distinct o.grupo_norm) into v_grupos from antigas o;
  else
    select array_agg(distinct u.g) into v_grupos
      from novas n
      join antigas o on o.id = n.id
     cross join lateral unnest(array[n.grupo_norm, o.grupo_norm]) as u(g)
     where (n.grupo, n.unidade, n.edital, n.ativo, n.data_inicio_analise, n.data_fim_analise,
            n.grupo_norm, n.unidade_norm, n.edital_norm)
           is distinct from
           (o.grupo, o.unidade, o.edital, o.ativo, o.data_inicio_analise, o.data_fim_analise,
            o.grupo_norm, o.unidade_norm, o.edital_norm);
  end if;
  if v_grupos is null then
    return null;
  end if;
  perform private."FC_MARCAR_CACHE"(
    array['ANALISES'],
    array(select a."CO_AREA" from public."TB_AREA" a
           where public.analises_norm_key(a."NO_GRUPO_PLANILHA") = any (v_grupos)),
    tg_table_name);
  return null;
end;
$$;

-- TB_LISTA_APROVADO → APROVADOS (área pelo edital).
create function private."FC_TG_CACHE_LISTA_APROVADO"()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_editais text[];
  v_antigos text[];
begin
  if tg_op in ('INSERT', 'UPDATE') then
    select array_agg(distinct n.edital_id) into v_editais from novas n;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    select array_agg(distinct o.edital_id) into v_antigos from antigas o;
    v_editais := v_editais || v_antigos;
  end if;
  if v_editais is null then
    return null;
  end if;
  perform private."FC_MARCAR_CACHE"(
    array['APROVADOS'],
    array(select m."CO_AREA" from public."TB_MONITORAMENTO_INDIGENA" m where m.id::text = any (v_editais)),
    tg_table_name);
  return null;
end;
$$;

-- TB_CANDIDATO_APROVADO → APROVADOS (área pela lista e pelo edital).
create function private."FC_TG_CACHE_CANDIDATO_APROVADO"()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listas uuid[];
  v_antigas uuid[];
begin
  if tg_op in ('INSERT', 'UPDATE') then
    select array_agg(distinct n.lista_id) into v_listas from novas n;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    select array_agg(distinct o.lista_id) into v_antigas from antigas o;
    v_listas := v_listas || v_antigas;
  end if;
  if v_listas is null then
    return null;
  end if;
  perform private."FC_MARCAR_CACHE"(
    array['APROVADOS'],
    array(select m."CO_AREA"
            from public."TB_LISTA_APROVADO" l
            join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
           where l.id = any (v_listas)),
    tg_table_name);
  return null;
end;
$$;

-- TB_MONITORAMENTO_INDIGENA → APROVADOS e ENTREVISTAS (só quando edital, unidade ou área mudam:
-- a carga diária dos KPIs regrava as linhas sem mexer nesses campos).
create function private."FC_TG_CACHE_MONITORAMENTO"()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_areas text[];
begin
  if tg_op = 'INSERT' then
    select array_agg(distinct n."CO_AREA") into v_areas from novas n;
  elsif tg_op = 'DELETE' then
    select array_agg(distinct o."CO_AREA") into v_areas from antigas o;
  else
    select array_agg(distinct u.a) into v_areas
      from novas n
      join antigas o on o.id = n.id
     cross join lateral unnest(array[n."CO_AREA", o."CO_AREA"]) as u(a)
     where (n.edital, n.unidade, n."CO_AREA") is distinct from (o.edital, o.unidade, o."CO_AREA");
  end if;
  perform private."FC_MARCAR_CACHE"(array['APROVADOS', 'ENTREVISTAS'], v_areas, tg_table_name);
  return null;
end;
$$;

-- TB_ENTREVISTA → ENTREVISTAS.
create function private."FC_TG_CACHE_ENTREVISTA"()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_areas text[];
  v_antigas text[];
begin
  if tg_op in ('INSERT', 'UPDATE') then
    select array_agg(distinct n."CO_AREA") into v_areas from novas n;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    select array_agg(distinct o."CO_AREA") into v_antigas from antigas o;
    v_areas := v_areas || v_antigas;
  end if;
  perform private."FC_MARCAR_CACHE"(array['ENTREVISTAS'], v_areas, tg_table_name);
  return null;
end;
$$;

-- TB_ENTREVISTA_NOTA → ENTREVISTAS (área pela entrevista).
create function private."FC_TG_CACHE_ENTREVISTA_NOTA"()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entrevistas uuid[];
  v_antigas uuid[];
begin
  if tg_op in ('INSERT', 'UPDATE') then
    select array_agg(distinct n."CO_ENTREVISTA") into v_entrevistas from novas n;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    select array_agg(distinct o."CO_ENTREVISTA") into v_antigas from antigas o;
    v_entrevistas := v_entrevistas || v_antigas;
  end if;
  if v_entrevistas is null then
    return null;
  end if;
  perform private."FC_MARCAR_CACHE"(
    array['ENTREVISTAS'],
    array(select e."CO_AREA" from public."TB_ENTREVISTA" e where e."CO_ENTREVISTA" = any (v_entrevistas)),
    tg_table_name);
  return null;
end;
$$;

-- TL_SYNC_ENTREVISTA → ENTREVISTAS (o pacote mostra a última carga concluída).
create function private."FC_TG_CACHE_SYNC_ENTREVISTA"()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_areas text[];
begin
  select array_agg(distinct n."CO_AREA") into v_areas
    from novas n
   where n."TP_SITUACAO" = 'CONCLUIDA';
  perform private."FC_MARCAR_CACHE"(array['ENTREVISTAS'], v_areas, tg_table_name);
  return null;
end;
$$;

-- TB_AREA → os três (o grupo da planilha define o recorte das análises).
create function private."FC_TG_CACHE_AREA"()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_areas text[];
begin
  select array_agg(distinct n."CO_AREA") into v_areas from novas n;
  perform private."FC_MARCAR_CACHE"(array['APROVADOS', 'ANALISES', 'ENTREVISTAS'], v_areas, tg_table_name);
  return null;
end;
$$;

revoke all on function private."FC_TG_CACHE_ANALISE"() from public, anon, authenticated;
revoke all on function private."FC_TG_CACHE_EDITAL_ANALISE"() from public, anon, authenticated;
revoke all on function private."FC_TG_CACHE_LISTA_APROVADO"() from public, anon, authenticated;
revoke all on function private."FC_TG_CACHE_CANDIDATO_APROVADO"() from public, anon, authenticated;
revoke all on function private."FC_TG_CACHE_MONITORAMENTO"() from public, anon, authenticated;
revoke all on function private."FC_TG_CACHE_ENTREVISTA"() from public, anon, authenticated;
revoke all on function private."FC_TG_CACHE_ENTREVISTA_NOTA"() from public, anon, authenticated;
revoke all on function private."FC_TG_CACHE_SYNC_ENTREVISTA"() from public, anon, authenticated;
revoke all on function private."FC_TG_CACHE_AREA"() from public, anon, authenticated;

comment on function private."FC_TG_CACHE_ANALISE"() is 'Gatilho por comando de TB_ANALISE_CURRICULAR: marca ANALISES da área e ENTREVISTAS quando a análise é Aprovado ou está ligada a uma entrevista (antes ou depois da mudança).';
comment on function private."FC_TG_CACHE_EDITAL_ANALISE"() is 'Gatilho por comando de TB_EDITAL_ANALISE: marca ANALISES da área do grupo, só pelos editais que mudaram de fato.';
comment on function private."FC_TG_CACHE_LISTA_APROVADO"() is 'Gatilho por comando de TB_LISTA_APROVADO: marca APROVADOS da área do edital.';
comment on function private."FC_TG_CACHE_CANDIDATO_APROVADO"() is 'Gatilho por comando de TB_CANDIDATO_APROVADO: marca APROVADOS da área da lista.';
comment on function private."FC_TG_CACHE_MONITORAMENTO"() is 'Gatilho por comando de TB_MONITORAMENTO_INDIGENA: marca APROVADOS e ENTREVISTAS quando edital, unidade ou área mudam (ou a linha entra/sai).';
comment on function private."FC_TG_CACHE_ENTREVISTA"() is 'Gatilho por comando de TB_ENTREVISTA: marca ENTREVISTAS da área.';
comment on function private."FC_TG_CACHE_ENTREVISTA_NOTA"() is 'Gatilho por comando de TB_ENTREVISTA_NOTA: marca ENTREVISTAS da área da entrevista.';
comment on function private."FC_TG_CACHE_SYNC_ENTREVISTA"() is 'Gatilho por comando de TL_SYNC_ENTREVISTA: marca ENTREVISTAS da área quando uma carga é concluída.';
comment on function private."FC_TG_CACHE_AREA"() is 'Gatilho por comando de TB_AREA: marca os três caches da área.';

-- Um gatilho por evento (as tabelas de transição de INSERT, UPDATE e DELETE são diferentes).
create trigger "TG_ANALISE_CACHE_INS" after insert on public."TB_ANALISE_CURRICULAR"
  referencing new table as novas for each statement execute function private."FC_TG_CACHE_ANALISE"();
create trigger "TG_ANALISE_CACHE_UPD" after update on public."TB_ANALISE_CURRICULAR"
  referencing old table as antigas new table as novas for each statement execute function private."FC_TG_CACHE_ANALISE"();
create trigger "TG_ANALISE_CACHE_DEL" after delete on public."TB_ANALISE_CURRICULAR"
  referencing old table as antigas for each statement execute function private."FC_TG_CACHE_ANALISE"();

create trigger "TG_EDITALANALISE_CACHE_INS" after insert on public."TB_EDITAL_ANALISE"
  referencing new table as novas for each statement execute function private."FC_TG_CACHE_EDITAL_ANALISE"();
create trigger "TG_EDITALANALISE_CACHE_UPD" after update on public."TB_EDITAL_ANALISE"
  referencing old table as antigas new table as novas for each statement execute function private."FC_TG_CACHE_EDITAL_ANALISE"();
create trigger "TG_EDITALANALISE_CACHE_DEL" after delete on public."TB_EDITAL_ANALISE"
  referencing old table as antigas for each statement execute function private."FC_TG_CACHE_EDITAL_ANALISE"();

create trigger "TG_LISTAAPROV_CACHE_INS" after insert on public."TB_LISTA_APROVADO"
  referencing new table as novas for each statement execute function private."FC_TG_CACHE_LISTA_APROVADO"();
create trigger "TG_LISTAAPROV_CACHE_UPD" after update on public."TB_LISTA_APROVADO"
  referencing old table as antigas new table as novas for each statement execute function private."FC_TG_CACHE_LISTA_APROVADO"();
create trigger "TG_LISTAAPROV_CACHE_DEL" after delete on public."TB_LISTA_APROVADO"
  referencing old table as antigas for each statement execute function private."FC_TG_CACHE_LISTA_APROVADO"();

create trigger "TG_CANDAPROV_CACHE_INS" after insert on public."TB_CANDIDATO_APROVADO"
  referencing new table as novas for each statement execute function private."FC_TG_CACHE_CANDIDATO_APROVADO"();
create trigger "TG_CANDAPROV_CACHE_UPD" after update on public."TB_CANDIDATO_APROVADO"
  referencing old table as antigas new table as novas for each statement execute function private."FC_TG_CACHE_CANDIDATO_APROVADO"();
create trigger "TG_CANDAPROV_CACHE_DEL" after delete on public."TB_CANDIDATO_APROVADO"
  referencing old table as antigas for each statement execute function private."FC_TG_CACHE_CANDIDATO_APROVADO"();

create trigger "TG_MONITINDIG_CACHE_INS" after insert on public."TB_MONITORAMENTO_INDIGENA"
  referencing new table as novas for each statement execute function private."FC_TG_CACHE_MONITORAMENTO"();
create trigger "TG_MONITINDIG_CACHE_UPD" after update on public."TB_MONITORAMENTO_INDIGENA"
  referencing old table as antigas new table as novas for each statement execute function private."FC_TG_CACHE_MONITORAMENTO"();
create trigger "TG_MONITINDIG_CACHE_DEL" after delete on public."TB_MONITORAMENTO_INDIGENA"
  referencing old table as antigas for each statement execute function private."FC_TG_CACHE_MONITORAMENTO"();

create trigger "TG_ENTREVISTA_CACHE_INS" after insert on public."TB_ENTREVISTA"
  referencing new table as novas for each statement execute function private."FC_TG_CACHE_ENTREVISTA"();
create trigger "TG_ENTREVISTA_CACHE_UPD" after update on public."TB_ENTREVISTA"
  referencing old table as antigas new table as novas for each statement execute function private."FC_TG_CACHE_ENTREVISTA"();
create trigger "TG_ENTREVISTA_CACHE_DEL" after delete on public."TB_ENTREVISTA"
  referencing old table as antigas for each statement execute function private."FC_TG_CACHE_ENTREVISTA"();

create trigger "TG_ENTREVNOTA_CACHE_INS" after insert on public."TB_ENTREVISTA_NOTA"
  referencing new table as novas for each statement execute function private."FC_TG_CACHE_ENTREVISTA_NOTA"();
create trigger "TG_ENTREVNOTA_CACHE_UPD" after update on public."TB_ENTREVISTA_NOTA"
  referencing old table as antigas new table as novas for each statement execute function private."FC_TG_CACHE_ENTREVISTA_NOTA"();
create trigger "TG_ENTREVNOTA_CACHE_DEL" after delete on public."TB_ENTREVISTA_NOTA"
  referencing old table as antigas for each statement execute function private."FC_TG_CACHE_ENTREVISTA_NOTA"();

create trigger "TG_SYNCENTREV_CACHE_INS" after insert on public."TL_SYNC_ENTREVISTA"
  referencing new table as novas for each statement execute function private."FC_TG_CACHE_SYNC_ENTREVISTA"();
create trigger "TG_SYNCENTREV_CACHE_UPD" after update on public."TL_SYNC_ENTREVISTA"
  referencing old table as antigas new table as novas for each statement execute function private."FC_TG_CACHE_SYNC_ENTREVISTA"();

create trigger "TG_AREA_CACHE_INS" after insert on public."TB_AREA"
  referencing new table as novas for each statement execute function private."FC_TG_CACHE_AREA"();
create trigger "TG_AREA_CACHE_UPD" after update on public."TB_AREA"
  referencing old table as antigas new table as novas for each statement execute function private."FC_TG_CACHE_AREA"();

-- 3. Caches e tabelas de passagem sem WAL -------------------------------------------------------
alter table private."TA_CANDIDATO_APROVADO_AREA" set unlogged;
alter table private."TA_PAINEL_ANALISE" set unlogged;
alter table private."TA_PAINEL_ENTREVISTA" set unlogged;
alter table public."TM_ANALISE_CURRICULAR" set unlogged;
alter table public."TM_MANIFESTO_ANALISE" set unlogged;

-- 4. Painel de análises: concluídas por ano no pacote (para os marcos) ---------------------------
alter table private."TA_PAINEL_ANALISE" add column "DS_CONCLUIDAS_POR_ANO" json;
comment on column private."TA_PAINEL_ANALISE"."DS_CONCLUIDAS_POR_ANO" is
  'Análises concluídas (Aprovado ou Reprovado) do escopo por ano da data da análise: {"2026": n, "sem_data": n}. Lido por obter_marcos_da_area (20261007220000).';
comment on column private."TA_PAINEL_ANALISE"."DS_VERSAO_DADOS" is
  'Instante da montagem em microssegundos desde 1970 (20261007220000). Se o pacote está em dia diz a TL_ALTERACAO_CACHE.';
comment on column private."TA_CANDIDATO_APROVADO_AREA"."DS_VERSAO_DADOS" is
  'Instante da montagem em microssegundos desde 1970 (20261007220000). Se o pacote está em dia diz a TL_ALTERACAO_CACHE.';
comment on column private."TA_PAINEL_ENTREVISTA"."DS_VERSAO_DADOS" is
  'Instante da montagem em microssegundos desde 1970 (20261007220000). Se o pacote está em dia diz a TL_ALTERACAO_CACHE.';

drop function private."FC_MONTAR_PAINEL_ANALISE"(text, text[], boolean);
create function private."FC_MONTAR_PAINEL_ANALISE"(p_area text, p_escopos text[], p_so_visiveis boolean default false)
returns table (
  "TP_ESCOPO" text, "DS_LINHAS" json, "QT_LINHAS" integer, "DS_EDITAIS" json,
  "DT_ULTIMA_ATUALIZACAO" timestamptz, "DS_CONCLUIDAS_POR_ANO" json
)
language plpgsql
stable
set search_path = public, private, pg_temp
set work_mem = '64MB'
set jit = off
as $function$
declare
  v_area text := lower(btrim(coalesce(p_area, 'saude-indigena')));
  v_grupo text;
  v_grupos_norm text[];
  v_editais json;
  v_restrito boolean;
  v_editais_norm text[];
  v_unidades_norm text[];
begin
  if p_escopos is null or cardinality(p_escopos) = 0
     or not (p_escopos <@ array['ativo', 'inativo', 'desativadas']) then
    raise exception 'Escopo invalido. Use ativo, inativo ou desativadas.';
  end if;

  select a."NO_GRUPO_PLANILHA" into v_grupo
    from public."TB_AREA" a
   where a."CO_AREA" = v_area;
  if not found then
    raise exception 'Área inválida: %', v_area using errcode = '22023';
  end if;

  -- O mesmo recorte de FC_GRUPOS_ANALISES_DA_AREA, sem a checagem de permissão.
  v_grupos_norm := array[public.analises_norm_key(v_grupo)];

  -- Recorte por coordenação só quando pedido (a RPC, para quem tem recorte);
  -- o pacote guardado é o da área inteira.
  v_restrito := coalesce(p_so_visiveis, false) and private."FC_EDITAIS_VISIVEIS"() is not null;
  if v_restrito then
    v_editais_norm := coalesce(private."FC_EDITAIS_NORM_VISIVEIS"(), '{}');
    v_unidades_norm := coalesce(private."FC_UNIDADES_NORM_VISIVEIS"(), '{}');
  end if;

  select coalesce(json_agg(json_build_object(
    'grupo', e.grupo,
    'unidade', e.unidade,
    'edital', e.edital,
    'ativo', e.ativo,
    'data_inicio_analise', e.data_inicio_analise,
    'data_fim_analise', e.data_fim_analise
  ) order by e.unidade, e.edital), '[]'::json)
  into v_editais
  from public."TB_EDITAL_ANALISE" e
  where e.grupo_norm = any (v_grupos_norm)
    and (not v_restrito
      or e.edital_norm = any (v_editais_norm)
      or e.unidade_norm = any (v_unidades_norm));

  -- Colunas na ordem de `columns` de get_analises_dashboard_payload_v2. A ordem
  -- das linhas é a de sempre, com o id no fim para desempatar (a mesma análise
  -- repetida para o candidato trocava de lugar entre uma montagem e outra).
  return query
  with linhas as materialized (
    select
      case
        when v.edital_ativo is false then 'inativo'
        when v.ativo is true then 'ativo'
        else 'desativadas'
      end as escopo,
      v.id, v.unidade, v.edital, v.codigo_vaga, v.candidato,
      v.status_consolidado, v.data_analise,
      coalesce(v.updated_at, v.ultima_atualizacao) as atualizado_em,
      json_build_array(
        v.id, v.unidade, v.edital, v.codigo_vaga, v.nome_vaga, v.candidato,
        v.categoria, v.modalidade_concorrencia, v.status_consolidado, v.etapa,
        v.responsavel_analise, v.data_analise, v.nota_final_ajustada,
        v.pdf_status, nullif(btrim(v.link_pdf), '') is not null
      ) as linha
    from public."VW_ANALISES_DASHBOARD_BASE_TODOS" v
    join public."TB_ANALISE_CURRICULAR" ac on ac.id = v.id
    where ac.grupo_norm = any (v_grupos_norm)
      and (not v_restrito
        or ac.edital_norm = any (v_editais_norm)
        or ac.unidade_norm = any (v_unidades_norm))
  ),
  agregado as (
    select l.escopo,
           json_agg(l.linha order by l.unidade, l.edital, l.codigo_vaga, l.candidato, l.id) as linhas,
           count(*)::integer as total,
           max(l.atualizado_em) as atualizado_em
      from linhas l
     where l.escopo = any (p_escopos)
     group by l.escopo
  ),
  concluidas as (
    select q.escopo, json_object_agg(q.ano, q.total order by q.ano) as por_ano
      from (
        select l.escopo,
               coalesce(extract(year from l.data_analise)::integer::text, 'sem_data') as ano,
               count(*)::integer as total
          from linhas l
         where l.escopo = any (p_escopos)
           and l.status_consolidado in ('Aprovado', 'Reprovado')
         group by 1, 2
      ) q
     group by q.escopo
  )
  select pedido.escopo, coalesce(a.linhas, '[]'::json), coalesce(a.total, 0), v_editais,
         a.atualizado_em, coalesce(c.por_ano, '{}'::json)
    from unnest(p_escopos) as pedido(escopo)
    left join agregado a on a.escopo = pedido.escopo
    left join concluidas c on c.escopo = pedido.escopo;
end;
$function$;
revoke all on function private."FC_MONTAR_PAINEL_ANALISE"(text, text[], boolean) from public, anon, authenticated;
comment on function private."FC_MONTAR_PAINEL_ANALISE"(text, text[], boolean) is
  'Monta o painel de análises da área por escopo (linhas compactas, editais, total, última atualização e concluídas por ano). Sem checagem de permissão: só atualizar_cache_painel_analises e get_analises_dashboard_payload_v2 chamam.';

-- 5. Quem remonta ---------------------------------------------------------------------------------
create or replace function public.atualizar_cache_aprovados(p_area text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
set lock_timeout = '3s'
as $function$
declare
  v_area text;
  v_inicio timestamptz;
  v_montado record;
  v_resultado jsonb := '[]'::jsonb;
begin
  if p_area is not null
     and not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = lower(btrim(p_area))) then
    raise exception 'Área inválida: %', p_area using errcode = '22023';
  end if;

  for v_area in
    select a."CO_AREA" from public."TB_AREA" a
     where p_area is null or a."CO_AREA" = lower(btrim(p_area))
     order by a."CO_AREA"
  loop
    -- Uma montagem por área de cada vez (a RPC que já tem a trava a reobtém).
    if not pg_try_advisory_xact_lock(hashtext('aprovados_area:' || v_area)::bigint) then
      v_resultado := v_resultado || jsonb_build_object('area', v_area, 'ok', false, 'erro', 'ocupado');
      continue;
    end if;
    begin
      v_inicio := clock_timestamp();
      -- As marcas saem ANTES da montagem: mudança confirmada durante a montagem
      -- deixa marca nova e o pacote é refeito na próxima rodada.
      delete from private."TL_ALTERACAO_CACHE" t
       where t."TP_CACHE" = 'APROVADOS' and t."CO_AREA" = v_area;
      select * into v_montado from private."FC_MONTAR_APROVADOS_AREA"(v_area, null);

      insert into private."TA_CANDIDATO_APROVADO_AREA" as c (
        "CO_AREA", "DS_LISTAS", "DS_DICIONARIOS", "DS_LINHAS", "QT_CANDIDATOS",
        "DS_VERSAO_DADOS", "DT_GERACAO", "NU_DURACAO_MS"
      ) values (
        v_area, v_montado.p_listas, v_montado.p_dicionarios, v_montado.p_linhas,
        v_montado.p_total, (extract(epoch from v_inicio) * 1000000)::bigint::text, v_inicio,
        (extract(epoch from clock_timestamp() - v_inicio) * 1000)::integer
      )
      on conflict ("CO_AREA") do update set
        "DS_LISTAS" = excluded."DS_LISTAS",
        "DS_DICIONARIOS" = excluded."DS_DICIONARIOS",
        "DS_LINHAS" = excluded."DS_LINHAS",
        "QT_CANDIDATOS" = excluded."QT_CANDIDATOS",
        "DS_VERSAO_DADOS" = excluded."DS_VERSAO_DADOS",
        "DT_GERACAO" = excluded."DT_GERACAO",
        "NU_DURACAO_MS" = excluded."NU_DURACAO_MS";

      v_resultado := v_resultado || jsonb_build_object(
        'area', v_area, 'ok', true, 'candidatos', v_montado.p_total,
        'ms', (extract(epoch from clock_timestamp() - v_inicio) * 1000)::integer);
    exception when others then
      -- Nunca derruba quem chamou: a RPC monta na hora (e as marcas voltam).
      raise warning 'Pacote da lista de aprovados (%) não foi remontado: % (%)', v_area, sqlerrm, sqlstate;
      v_resultado := v_resultado || jsonb_build_object('area', v_area, 'ok', false, 'erro', sqlerrm);
    end;
  end loop;

  return v_resultado;
end;
$function$;

create or replace function public.atualizar_cache_aprovados_vencidos()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_area text;
  v_resultado jsonb := '[]'::jsonb;
begin
  -- Só a área com marca (TL_ALTERACAO_CACHE), sem pacote ou com pacote de mais
  -- de 24 h (rede de segurança). Sem mudança: nada a fazer.
  for v_area in
    select a."CO_AREA"
      from public."TB_AREA" a
      left join private."TA_CANDIDATO_APROVADO_AREA" c on c."CO_AREA" = a."CO_AREA"
     where c."CO_AREA" is null
        or c."DT_GERACAO" < now() - interval '24 hours'
        or private."FC_CACHE_DESATUALIZADO"('APROVADOS', a."CO_AREA")
     order by a."CO_AREA"
  loop
    v_resultado := v_resultado || public.atualizar_cache_aprovados(v_area);
  end loop;
  return v_resultado;
end;
$function$;

create or replace function public.atualizar_cache_painel_analises(p_area text default null, p_escopos text[] default null)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $function$
declare
  v_area text;
  v_escopos text[] := coalesce(p_escopos, array['ativo', 'inativo', 'desativadas']);
  v_todos boolean;
  v_inicio timestamptz;
  v_versao text;
  v_parte record;
  v_ms integer;
  v_resultado jsonb := '[]'::jsonb;
begin
  if p_area is not null
     and not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = lower(btrim(p_area))) then
    raise exception 'Área inválida: %', p_area using errcode = '22023';
  end if;
  v_todos := array['ativo', 'inativo', 'desativadas'] <@ v_escopos;

  for v_area in
    select a."CO_AREA" from public."TB_AREA" a
     where p_area is null or a."CO_AREA" = lower(btrim(p_area))
     order by a."CO_AREA"
  loop
    begin
      v_inicio := clock_timestamp();
      v_versao := (extract(epoch from v_inicio) * 1000000)::bigint::text;
      -- As marcas saem ANTES da montagem (ver atualizar_cache_aprovados); só quando
      -- os três escopos são refeitos (a RPC refaz um escopo só quando falta).
      if v_todos then
        delete from private."TL_ALTERACAO_CACHE" t
         where t."TP_CACHE" = 'ANALISES' and t."CO_AREA" = v_area;
      end if;

      for v_parte in
        select * from private."FC_MONTAR_PAINEL_ANALISE"(v_area, v_escopos, false)
      loop
        v_ms := (extract(epoch from clock_timestamp() - v_inicio) * 1000)::integer;
        insert into private."TA_PAINEL_ANALISE" as c (
          "CO_AREA", "TP_ESCOPO", "DS_LINHAS", "DS_EDITAIS", "QT_LINHAS",
          "DS_VERSAO_DADOS", "DT_GERACAO", "NU_DURACAO_MS", "DT_ULTIMA_ATUALIZACAO",
          "DS_CONCLUIDAS_POR_ANO"
        ) values (
          v_area, v_parte."TP_ESCOPO", v_parte."DS_LINHAS", v_parte."DS_EDITAIS",
          v_parte."QT_LINHAS", v_versao, v_inicio, v_ms, v_parte."DT_ULTIMA_ATUALIZACAO",
          v_parte."DS_CONCLUIDAS_POR_ANO"
        )
        on conflict ("CO_AREA", "TP_ESCOPO") do update set
          "DS_LINHAS" = excluded."DS_LINHAS",
          "DS_EDITAIS" = excluded."DS_EDITAIS",
          "QT_LINHAS" = excluded."QT_LINHAS",
          "DS_VERSAO_DADOS" = excluded."DS_VERSAO_DADOS",
          "DT_GERACAO" = excluded."DT_GERACAO",
          "NU_DURACAO_MS" = excluded."NU_DURACAO_MS",
          "DT_ULTIMA_ATUALIZACAO" = excluded."DT_ULTIMA_ATUALIZACAO",
          "DS_CONCLUIDAS_POR_ANO" = excluded."DS_CONCLUIDAS_POR_ANO";

        v_resultado := v_resultado || jsonb_build_object(
          'area', v_area, 'escopo', v_parte."TP_ESCOPO", 'ok', true,
          'linhas', v_parte."QT_LINHAS", 'ms', v_ms);
      end loop;
    exception when others then
      -- Nunca derruba quem chamou (agendamento, RPC): as marcas voltam e o
      -- guardado é remontado depois, ou o painel monta na hora.
      raise warning 'Cache do painel de análises (%) não foi remontado: % (%)', v_area, sqlerrm, sqlstate;
      v_resultado := v_resultado || jsonb_build_object(
        'area', v_area, 'escopos', to_jsonb(v_escopos), 'ok', false, 'erro', sqlerrm);
    end;
  end loop;

  return v_resultado;
end;
$function$;

create or replace function public.atualizar_cache_painel_analises_vencidos()
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $function$
declare
  v_area text;
  v_resultado jsonb := '[]'::jsonb;
begin
  -- Só a área com marca, sem um dos três escopos ou com pacote de mais de 24 h.
  for v_area in
    select a."CO_AREA"
      from public."TB_AREA" a
     where private."FC_CACHE_DESATUALIZADO"('ANALISES', a."CO_AREA")
        or (select count(*) < 3 or min(c."DT_GERACAO") < now() - interval '24 hours'
              from private."TA_PAINEL_ANALISE" c
             where c."CO_AREA" = a."CO_AREA"
               and c."TP_ESCOPO" in ('ativo', 'inativo', 'desativadas'))
     order by a."CO_AREA"
  loop
    v_resultado := v_resultado || public.atualizar_cache_painel_analises(v_area);
  end loop;
  return v_resultado;
end;
$function$;

create or replace function public.atualizar_cache_painel_entrevistas(p_area text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_area text;
  v_inicio timestamptz;
  v_payload json;
  v_feitas jsonb := '[]'::jsonb;
begin
  -- Só a área com marca, sem pacote ou com pacote de mais de 24 h.
  for v_area in
    select a."CO_AREA"
      from public."TB_AREA" a
      left join private."TA_PAINEL_ENTREVISTA" c on c."CO_AREA" = a."CO_AREA"
     where (p_area is null or a."CO_AREA" = p_area)
       and (c."CO_AREA" is null
            or c."DT_GERACAO" < now() - interval '24 hours'
            or private."FC_CACHE_DESATUALIZADO"('ENTREVISTAS', a."CO_AREA"))
     order by a."CO_AREA"
  loop
    begin
      v_inicio := clock_timestamp();
      delete from private."TL_ALTERACAO_CACHE" t
       where t."TP_CACHE" = 'ENTREVISTAS' and t."CO_AREA" = v_area;
      v_payload := private."FC_MONTAR_ENTREVISTAS_AREA"(v_area, null);
      insert into private."TA_PAINEL_ENTREVISTA" as c
        ("CO_AREA", "DS_PAYLOAD", "QT_ENTREVISTA", "DS_VERSAO_DADOS", "DT_GERACAO", "NU_DURACAO_MS")
      values (v_area, v_payload, json_array_length(v_payload->'entrevistas'),
              (extract(epoch from v_inicio) * 1000000)::bigint::text, v_inicio,
              (extract(epoch from clock_timestamp() - v_inicio) * 1000)::integer)
      on conflict ("CO_AREA") do update set
        "DS_PAYLOAD" = excluded."DS_PAYLOAD", "QT_ENTREVISTA" = excluded."QT_ENTREVISTA",
        "DS_VERSAO_DADOS" = excluded."DS_VERSAO_DADOS", "DT_GERACAO" = excluded."DT_GERACAO",
        "NU_DURACAO_MS" = excluded."NU_DURACAO_MS";
      v_feitas := v_feitas || to_jsonb(v_area);
    exception when others then
      raise warning 'Pacote das entrevistas (%) não foi remontado: % (%)', v_area, sqlerrm, sqlstate;
    end;
  end loop;
  return jsonb_build_object('remontadas', v_feitas);
end;
$function$;

-- 6. Quem serve ----------------------------------------------------------------------------------
create or replace function public.listar_candidatos_aprovados_compacto(p_area text default null, p_versao text default null)
returns json
language plpgsql
security definer
set search_path = ''
set work_mem = '64MB'
set jit = off
as $function$
declare
  v_listas json;
  v_linhas json;
  v_area text;
  v_visiveis uuid[];
  v_versao text;
  v_cache private."TA_CANDIDATO_APROVADO_AREA";
  v_tem_cache boolean := false;
  v_sujo boolean;
  v_dicionarios json;
  v_total integer;
  v_gerado_em timestamptz := now();
begin
  if not (private.pode_recurso('aprovados',1)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if private.papel_recurso('aprovados') = '' then
    raise exception 'Perfil sem acesso ao sistema';
  end if;

  -- Sem área: a resposta de antes (formato 1), para o front publicado até o deploy.
  if p_area is null then
    -- Dados da lista vão uma vez por lista (≈110), não repetidos em cada candidato.
    select coalesce(json_object_agg(l.id, json_build_array(
             l.edital_id, m.edital, m.unidade, l.ativo, l.arquivo_nome, l.importado_em
           )), '{}'::json)
      into v_listas
    from public."TB_LISTA_APROVADO" l
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
    where l.vigente is true
      and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
        and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]));

    select coalesce(json_agg(
             case when c.alterado_judicialmente then json_build_array(
               c.id, l.id, c.cargo, c.classificacao, c.nota, c.nome, c.modalidade,
               c.status, c.processo_sei, c.matricula, c.sub_judice, c.codigo_vaga,
               true, c.nota_original, c.modalidade_original, c.classificacao_original
             ) else json_build_array(
               c.id, l.id, c.cargo, c.classificacao, c.nota, c.nome, c.modalidade,
               c.status, c.processo_sei, c.matricula, c.sub_judice, c.codigo_vaga
             ) end
           order by m.edital, c.cargo, c.classificacao nulls last, c.nome), '[]'::json)
      into v_linhas
    from public."TB_LISTA_APROVADO" l
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
    join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id
    where l.vigente is true
      and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
        and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
      and c.removido_em is null;

    return json_build_object(
      'colunas_da_lista', json_build_array(
        'edital_id', 'edital', 'unidade', 'lista_ativa', 'arquivo_nome', 'importado_em'
      ),
      'listas', v_listas,
      'colunas', json_build_array(
        'candidato_id', 'lista_id', 'cargo', 'classificacao', 'nota', 'nome',
        'modalidade', 'status', 'processo_sei', 'matricula', 'sub_judice',
        'codigo_vaga', 'alterado_judicialmente', 'nota_original',
        'modalidade_original', 'classificacao_original'
      ),
      'linhas', v_linhas,
      'total', json_array_length(v_linhas)
    );
  end if;

  -- Área válida e do usuário: 22023/42501 antes de qualquer leitura.
  v_area := lower(btrim(p_area));
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
    raise exception 'Área inválida: %', p_area using errcode = '22023';
  end if;
  if not (v_area = any ((select private."FC_AREAS_USUARIO"())::text[])) then
    raise exception 'Sem permissão para a lista de aprovados desta área' using errcode = '42501';
  end if;

  v_visiveis := private."FC_EDITAIS_VISIVEIS"();
  select * into v_cache from private."TA_CANDIDATO_APROVADO_AREA" c where c."CO_AREA" = v_area;
  v_tem_cache := found;
  v_sujo := private."FC_CACHE_DESATUALIZADO"('APROVADOS', v_area);

  -- Quem vê a área inteira e encontrou o pacote vencido (ou sem pacote) remonta e
  -- grava. Falhou a gravação (transação só de leitura, trava), monta na hora abaixo.
  if v_visiveis is null and (v_sujo or not v_tem_cache)
     and pg_try_advisory_xact_lock(hashtext('aprovados_area:' || v_area)::bigint) then
    perform public.atualizar_cache_aprovados(v_area);
    select * into v_cache from private."TA_CANDIDATO_APROVADO_AREA" c where c."CO_AREA" = v_area;
    v_tem_cache := found;
    v_sujo := private."FC_CACHE_DESATUALIZADO"('APROVADOS', v_area);
  end if;

  -- Versão: a do pacote; com mudança pendente, mais a contagem e a última marca
  -- (a cópia do navegador não vale); com recorte por coordenação, mais o recorte.
  v_versao := coalesce(v_cache."DS_VERSAO_DADOS", '0')
    || case when v_sujo then
         '+' || (select count(*)::text || '.' || max(t."CO_ALTERACAO_CACHE")::text
                   from private."TL_ALTERACAO_CACHE" t
                  where t."TP_CACHE" = 'APROVADOS' and t."CO_AREA" = v_area)
       else '' end
    || case when v_visiveis is null then ''
            else ':' || md5(array(select x from unnest(v_visiveis) x order by x)::text) end;

  if p_versao is not null and p_versao = v_versao then
    return json_build_object('formato', 2, 'area', v_area, 'versao', v_versao, 'inalterado', true);
  end if;

  if v_visiveis is null and v_tem_cache and not v_sujo then
    v_listas := v_cache."DS_LISTAS";
    v_dicionarios := v_cache."DS_DICIONARIOS";
    v_linhas := v_cache."DS_LINHAS";
    v_total := v_cache."QT_CANDIDATOS";
    v_gerado_em := v_cache."DT_GERACAO";
  else
    -- Com recorte, ou pacote ainda sem a mudança de agora: montada na hora.
    v_tem_cache := false;
    select m.p_listas, m.p_dicionarios, m.p_linhas, m.p_total
      into v_listas, v_dicionarios, v_linhas, v_total
      from private."FC_MONTAR_APROVADOS_AREA"(v_area, v_visiveis) m;
  end if;

  return json_build_object(
    'formato', 2,
    'area', v_area,
    'versao', v_versao,
    'inalterado', false,
    'cache', json_build_object('hit', v_tem_cache, 'gerado_em', v_gerado_em),
    'colunas_da_lista', json_build_array(
      'lista_id', 'edital_id', 'edital', 'unidade', 'lista_ativa', 'arquivo_nome', 'importado_em'
    ),
    'listas', v_listas,
    'colunas', json_build_array(
      'candidato_id', 'lista_id', 'cargo', 'classificacao', 'nota', 'nome',
      'modalidade', 'status', 'processo_sei', 'matricula', 'sub_judice',
      'codigo_vaga', 'alterado_judicialmente', 'nota_original',
      'modalidade_original', 'classificacao_original'
    ),
    'dicionarios', v_dicionarios,
    'linhas', v_linhas,
    'total', v_total
  );
end;
$function$;

create or replace function public.get_analises_dashboard_payload_v2(p_scope text default 'ativo', p_area text default 'saude-indigena')
returns json
language plpgsql
security definer
set search_path = public, private, pg_temp
set statement_timeout = '15s'
set lock_timeout = '3s'
set work_mem = '64MB'
set jit = off
as $function$
declare
  v_scope text := lower(btrim(coalesce(p_scope, 'ativo')));
  v_area text := lower(btrim(coalesce(p_area, 'saude-indigena')));
  v_area_nome text;
  v_grupo text;
  v_columns json := json_build_array(
    'id', 'unidade', 'edital', 'codigo_vaga', 'nome_vaga', 'candidato',
    'categoria', 'modalidade_concorrencia', 'status_consolidado', 'etapa',
    'responsavel_analise', 'data_analise', 'nota_final_ajustada',
    'pdf_status', 'tem_pdf'
  );
  v_cache private."TA_PAINEL_ANALISE";
  v_tem_cache boolean := false;
  v_hit boolean := false;
  v_rows json;
  v_editais json;
  v_total integer;
  v_atualizado_em timestamptz;
  v_gerado_em timestamptz := now();
begin
  if not (private.pode_recurso('analises')) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;

  -- "Todos" é montado no navegador com os três escopos.
  if v_scope not in ('ativo', 'inativo', 'desativadas') then
    raise exception 'Escopo invalido. Use ativo, inativo ou desativadas.';
  end if;

  -- Área válida e do usuário (ou admin): 22023/42501 antes de qualquer leitura.
  perform private."FC_GRUPOS_ANALISES_DA_AREA"(v_area);
  select a."NO_AREA", a."NO_GRUPO_PLANILHA" into v_area_nome, v_grupo
    from public."TB_AREA" a where a."CO_AREA" = v_area;

  -- Quem tem recorte por coordenação não usa o pronto (que é da área inteira).
  if private."FC_EDITAIS_VISIVEIS"() is null then
    select * into v_cache
      from private."TA_PAINEL_ANALISE" c
     where c."CO_AREA" = v_area and c."TP_ESCOPO" = v_scope;
    v_tem_cache := found;

    if v_tem_cache and v_cache."DT_GERACAO" > now() - interval '24 hours' then
      -- Sempre entrega o guardado, mesmo de antes da última mudança: quem remonta
      -- é o agendamento (a cada 2 min, só a área com marca em TL_ALTERACAO_CACHE).
      v_hit := not private."FC_CACHE_DESATUALIZADO"('ANALISES', v_area);
    elsif pg_try_advisory_xact_lock(hashtext('painel_analise:' || v_area || ':' || v_scope)::bigint) then
      -- Sem guardado (ou agendamento parado há um dia): remonta só este
      -- escopo e grava. Se a gravação falhar, monta na hora, abaixo.
      perform public.atualizar_cache_painel_analises(v_area, array[v_scope]);
      select * into v_cache
        from private."TA_PAINEL_ANALISE" c
       where c."CO_AREA" = v_area and c."TP_ESCOPO" = v_scope;
      v_tem_cache := found and v_cache."DT_GERACAO" > now() - interval '1 hour';
      v_hit := v_tem_cache;
    else
      -- Outra abertura já está remontando: o guardado anterior serve por ora.
      v_hit := false;
    end if;
  end if;

  if v_tem_cache then
    v_rows := v_cache."DS_LINHAS";
    v_editais := v_cache."DS_EDITAIS";
    v_total := v_cache."QT_LINHAS";
    v_atualizado_em := v_cache."DT_ULTIMA_ATUALIZACAO";
    v_gerado_em := v_cache."DT_GERACAO";
  else
    select m."DS_LINHAS", m."DS_EDITAIS", m."QT_LINHAS", m."DT_ULTIMA_ATUALIZACAO"
      into v_rows, v_editais, v_total, v_atualizado_em
      from private."FC_MONTAR_PAINEL_ANALISE"(v_area, array[v_scope], true) m;
  end if;

  return json_build_object(
    'schema_version', 4,
    'scope', v_scope,
    'area', v_area,
    'area_nome', v_area_nome,
    'grupo', v_grupo,
    'edital_status', case when v_scope = 'inativo' then 'Inativo' else 'Ativo' end,
    'columns', v_columns,
    'rows', v_rows,
    'editais', v_editais,
    'total', v_total,
    'textos_sob_demanda', true,
    'detalhe_sob_demanda', true,
    'versao_dados', case when v_tem_cache then v_cache."DS_VERSAO_DADOS" end,
    'atualizado_em', v_atualizado_em,
    'generated_at', v_gerado_em,
    'cache', json_build_object('hit', v_hit, 'refreshed_at', v_gerado_em)
  );
end;
$function$;

create or replace function public.obter_marcos_da_area(p_area text)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_ano integer := extract(year from now() at time zone 'America/Sao_Paulo')::integer;
  v_escopos integer;
  v_no_ano bigint;
  v_total bigint;
begin
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if not private."FC_PODE_AREA"(p_area) then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;

  -- Concluídas de editais inativos (escopo 'inativo') e análises ativas de editais
  -- ativos (escopo 'ativo'), lidas do pacote do painel de análises.
  select count(distinct c."TP_ESCOPO"),
         coalesce(sum(x.value::bigint) filter (where x.key ~ '^\d+$' and x.key::integer >= v_ano), 0),
         coalesce(sum(x.value::bigint), 0)
    into v_escopos, v_no_ano, v_total
    from private."TA_PAINEL_ANALISE" c
    left join lateral json_each_text(c."DS_CONCLUIDAS_POR_ANO") x on true
   where c."CO_AREA" = p_area
     and c."TP_ESCOPO" in ('ativo', 'inativo')
     and c."DS_CONCLUIDAS_POR_ANO" is not null;

  if v_escopos < 2 then
    -- Sem o pacote (banco recém-reiniciado, área nova): conta na hora.
    select count(*) filter (where v.data_analise >= make_date(v_ano, 1, 1)), count(*)
      into v_no_ano, v_total
      from public."VW_ANALISES_DASHBOARD_BASE_TODOS" v
      join public."TB_ANALISE_CURRICULAR" a on a.id = v.id
     where a."CO_AREA" = p_area
       and (v.edital_ativo is false or v.ativo is true)
       and v.status_consolidado in ('Aprovado', 'Reprovado');
  end if;

  return json_build_object(
    'area', p_area,
    'ano', v_ano,
    'concluidas_no_ano', v_no_ano,
    'concluidas_total', v_total,
    'gerado_em', now());
end;
$function$;
comment on function public.obter_marcos_da_area(text) is
  'Marcos da área para a Visão geral: análises concluídas (Aprovado ou Reprovado) no ano e no total, de análises ativas e de editais inativos. Lê as concluídas por ano do pacote do painel de análises (TA_PAINEL_ANALISE.DS_CONCLUIDAS_POR_ANO, 20261007220000); sem o pacote, conta na hora.';

-- 7. As funções de versão saem (quem diz se o pacote está em dia é a TL_ALTERACAO_CACHE) --------
drop function private."FC_VERSAO_ENTREVISTAS"(text);
drop function private."FC_VERSAO_APROVADOS_AREA"(text);
drop function private."FC_VERSAO_DADOS_ANALISE"(text);

-- 8. Primeira rodada: todos os pacotes ficam a refazer (formato novo da versão e as concluídas).
insert into private."TL_ALTERACAO_CACHE" ("TP_CACHE", "CO_AREA", "NO_TABELA_ORIGEM")
select t.tipo, a."CO_AREA", 'migracao_20261007220000'
  from public."TB_AREA" a
 cross join unnest(array['APROVADOS', 'ANALISES', 'ENTREVISTAS']) as t(tipo)
 order by 1, 2;

comment on function public.atualizar_cache_aprovados(text) is
  'Remonta o pacote da lista de aprovados da área (ou de todas): apaga as marcas de APROVADOS da área antes de montar e grava a versão = instante da montagem. Só service_role (e as RPCs SECURITY DEFINER).';
comment on function public.atualizar_cache_aprovados_vencidos() is
  'Tarefa agsus_aprovados_cache_por_area (a cada 2 min): remonta só a área com marca em TL_ALTERACAO_CACHE, sem pacote ou com pacote de mais de 24 h.';
comment on function public.atualizar_cache_painel_analises(text, text[]) is
  'Remonta o painel de análises da área (ou de todas) nos escopos pedidos; com os três escopos, apaga antes as marcas de ANALISES da área.';
comment on function public.atualizar_cache_painel_analises_vencidos() is
  'Tarefa agsus_analises_cache_do_painel (a cada 2 min): remonta só a área com marca em TL_ALTERACAO_CACHE, sem os três escopos ou com pacote de mais de 24 h.';
comment on function public.atualizar_cache_painel_entrevistas(text) is
  'Tarefa agsus_entrevistas_cache_do_painel (a cada 2 min): remonta o pacote das entrevistas só da área com marca em TL_ALTERACAO_CACHE, sem pacote ou com pacote de mais de 24 h.';

-- 9. finalizar_sync_analises_incremental: só o edital que mudou ------------------------------
CREATE OR REPLACE FUNCTION public.finalizar_sync_analises_incremental(p_sync_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
 SET statement_timeout TO '30s'
 SET lock_timeout TO '2s'
 SET work_mem TO '8MB'
 SET jit TO 'off'
AS $function$
declare
  v_cursor integer:=0;
  v_max integer:=0;
  v_total_staging integer:=0;
  v_esperado integer:=0;
  v_total_fato integer:=0;
  v_total_editais integer:=0;
  v_editais_upsert integer:=0;
  v_editais_inativados integer:=0;
  v_removido integer:=0;
  v_total_ativos_local integer:=0;
  v_result jsonb;
  v_planilha text;
  v_conflitos integer:=0;
  v_duplicadas integer:=0;
  v_ausentes jsonb;
begin
  if p_sync_id is null then raise exception 'p_sync_id obrigatorio'; end if;
  -- [por-planilha]
  v_planilha := public."FC_PLANILHA_DO_SYNC_ANALISE"(p_sync_id);
  if v_planilha is null then raise exception 'Sync incremental nao esta pronto para finalizacao.'; end if;
  if not pg_try_advisory_xact_lock(hashtext('public.processar_sync_analises:'||v_planilha)::bigint) then
    raise exception 'Outro processamento de analises esta em andamento.';
  end if;

  select coalesce(nullif(resultado->>'lote_cursor','')::integer,0),
         coalesce(linhas_staging,0),
         coalesce(nullif(resultado->>'incremental_total_ativos_local','')::integer,0)
    into v_cursor,v_esperado,v_total_ativos_local
  from public."TL_SYNC_ANALISE"
  where sync_id=p_sync_id and modo='INCREMENTAL_ACTIVE' and status in ('carregado','processando')
    and coalesce((resultado->>'incremental_preparado')::boolean,false)=true
  order by id desc limit 1;
  if not found then raise exception 'Sync incremental nao esta pronto para finalizacao.'; end if;

  select coalesce(max(linha_origem) filter(where entidade='FATO_ANALISES'),0),
         count(*)::integer,
         count(*) filter(where entidade='FATO_ANALISES')::integer,
         count(*) filter(where entidade='DIM_EDITAIS')::integer
    into v_max,v_total_staging,v_total_fato,v_total_editais
  from public."TM_ANALISE_CURRICULAR"
  where sync_id=p_sync_id;

  if v_total_staging <> v_esperado then raise exception 'Staging incremental divergente: esperado %, encontrado %.',v_esperado,v_total_staging; end if;
  if v_cursor < v_max then raise exception 'Ainda existem linhas FATO incrementais pendentes: cursor %, max %.',v_cursor,v_max; end if;
  if v_total_editais < 1 then raise exception 'DIM_EDITAIS ausente no incremental.'; end if;

  -- [por-planilha] porteiro antes de gravar editais.
  perform public."FC_VALIDAR_GRUPO_STAGING_ANALISE"(p_sync_id, v_planilha);

  create temporary table tmp_editais_incremental on commit drop as
  with x as (
    select s.id,s.linha_origem,
      public.jsonb_text_or_null(s.payload,'grupo') as grupo,
      coalesce(public.jsonb_text_or_null(s.payload,'unidade'),'Nao informada') as unidade,
      coalesce(public.jsonb_text_or_null(s.payload,'edital'),'Sem edital') as edital,
      coalesce(public.jsonb_bool_or_null(s.payload,'ativo'),true) as ativo,
      public.jsonb_date_or_null(s.payload,'data_inicio_analise') as data_inicio_analise,
      public.jsonb_date_or_null(s.payload,'data_fim_analise') as data_fim_analise
    from public."TM_ANALISE_CURRICULAR" s
    where s.sync_id=p_sync_id and s.entidade='DIM_EDITAIS'
  ), ranked as (
    select *,row_number() over(partition by coalesce(public.analises_norm_key(grupo),''),coalesce(public.analises_norm_key(unidade),''),coalesce(public.analises_norm_key(edital),'') order by coalesce(linha_origem,2147483647),id) rn
    from x
  )
  select grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise
  from ranked where rn=1;

  -- [por-planilha] edital já cadastrado por outra planilha: recusa.
  select count(*)::integer into v_conflitos
  from public."TB_EDITAL_ANALISE" e
  join tmp_editais_incremental x
    on e.grupo_norm=coalesce(public.analises_norm_key(x.grupo),'')
   and e.unidade_norm=coalesce(public.analises_norm_key(x.unidade),'')
   and e.edital_norm=coalesce(public.analises_norm_key(x.edital),'')
  where e."CO_PLANILHA"<>v_planilha;
  if v_conflitos>0 then
    raise exception 'Sync % recusado: % edital(is) do envio ja pertencem a outra planilha.',p_sync_id,v_conflitos
      using errcode = '22023';
  end if;

  insert into public."TB_EDITAL_ANALISE"(grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise,"CO_PLANILHA")
  select grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise,v_planilha
  from tmp_editais_incremental
  -- Pela chave normalizada (uq_analises_editais_norm): "DSEI  Parintins" e
  -- "DSEI Parintins" são o mesmo edital; o texto passa a ser o da planilha.
  on conflict(grupo_norm,unidade_norm,edital_norm) do update set
    grupo=excluded.grupo,
    unidade=excluded.unidade,
    edital=excluded.edital,
    ativo=excluded.ativo,
    data_inicio_analise=excluded.data_inicio_analise,
    data_fim_analise=excluded.data_fim_analise,
    updated_at=now()
  where "TB_EDITAL_ANALISE"."CO_PLANILHA"=excluded."CO_PLANILHA"
    -- Só o edital que mudou (20261007220000): regravar os iguais a cada sync
    -- gerava WAL e remontava o painel de análises à toa.
    and ("TB_EDITAL_ANALISE".grupo,"TB_EDITAL_ANALISE".unidade,"TB_EDITAL_ANALISE".edital,
         "TB_EDITAL_ANALISE".ativo,"TB_EDITAL_ANALISE".data_inicio_analise,"TB_EDITAL_ANALISE".data_fim_analise)
        is distinct from
        (excluded.grupo,excluded.unidade,excluded.edital,
         excluded.ativo,excluded.data_inicio_analise,excluded.data_fim_analise);
  get diagnostics v_editais_upsert=row_count;

  -- [por-planilha] só desativa editais desta planilha.
  update public."TB_EDITAL_ANALISE" e
  set ativo=false,updated_at=now()
  where e.ativo is true
    and e."CO_PLANILHA"=v_planilha
    and not exists(select 1 from tmp_editais_incremental x
      where e.grupo_norm=coalesce(public.analises_norm_key(x.grupo),'')
        and e.unidade_norm=coalesce(public.analises_norm_key(x.unidade),'')
        and e.edital_norm=coalesce(public.analises_norm_key(x.edital),''));
  get diagnostics v_editais_inativados=row_count;

  -- [por-planilha] Mesmo candidato (id_origem) duas vezes na mesma vaga e edital:
  -- fica ativo só o registro mais recente. O incremental só envia o que mudou;
  -- quando o nome é corrigido na planilha, a chave natural muda, entra um
  -- registro novo e o antigo ficava ativo como "Pendente" (14 casos em 30/09).
  with r as (
    select a.id,
           row_number() over (partition by a.edital_norm, a.codigo_vaga, a.id_origem
                              order by a.updated_at desc, a.id desc) as rn
      from public."TB_ANALISE_CURRICULAR" a
     where a.ativo
       and a."CO_PLANILHA" = v_planilha
       and nullif(btrim(a.id_origem), '') is not null
       and nullif(btrim(a.codigo_vaga), '') is not null
  )
  update public."TB_ANALISE_CURRICULAR" a
     set ativo = false, updated_at = now()
    from r
   where a.id = r.id and r.rn > 1;
  get diagnostics v_duplicadas=row_count;

  -- Quem saiu da planilha (manifesto da comparação): ver 20261001140000.
  v_ausentes := public."FC_DESATIVAR_AUSENTES_DA_PLANILHA"(p_sync_id, v_planilha, v_total_ativos_local);
  delete from public."TM_MANIFESTO_ANALISE" where "CO_SYNC" = p_sync_id or "DT_CRIACAO" < now() - interval '2 days';

  delete from public."TM_ANALISE_CURRICULAR" where sync_id=p_sync_id;
  get diagnostics v_removido=row_count;

  v_result=jsonb_build_object(
    'ok',true,
    'sync_id',p_sync_id,
    'modo_processamento','incremental',
    'planilha',v_planilha,
    'total_ativos_local',v_total_ativos_local,
    'fato_analises_enviadas',v_total_fato,
    'analises_editais_recebidos',v_total_editais,
    'analises_editais_upsert',v_editais_upsert,
    'analises_editais_inativados',v_editais_inativados,
    'staging',v_total_staging,
    'staging_removido',v_removido,
    'historico_inativado',coalesce((v_ausentes->>'desativadas')::integer,0),
    'ausentes',v_ausentes,
    'analises_duplicadas_inativadas',v_duplicadas
  );

  update public."TL_SYNC_ANALISE"
  set status='processado',resultado=v_result,erro=null,total_processados=v_total_fato,
      finished_at=now(),updated_at=now()
  where sync_id=p_sync_id and modo='INCREMENTAL_ACTIVE';

  return v_result;
end;
$function$;

notify pgrst, 'reload schema';

commit;
