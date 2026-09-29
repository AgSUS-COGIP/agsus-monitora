/*
  ENTREVISTAS VIRAM ABA NATIVA (FASE 1: O PAINEL, COM OS DADOS DA PLANILHA)

  O painel "Entrevistas" era externo (Apps Script sobre a planilha
  "[dash] entrevistados", aba Entrevistados, montada por outro script que lê
  uma planilha de entrevista por vaga). Nesta fase a entrevista continua sendo
  feita nas planilhas; o que muda é que o resultado vem para o banco e a aba
  Entrevistas de cada área o mostra com a cara do painel de análises, ligado
  à análise curricular do candidato.

  O QUE ENTRA
    - public."TB_ENTREVISTA": um candidato entrevistado numa vaga de um edital.
      Liga ao edital (TB_MONITORAMENTO_INDIGENA) pelo número do edital + área
      (desempate pela unidade) e à análise curricular (TB_ANALISE_CURRICULAR)
      pelo código do candidato + código da vaga — o "Código" da planilha é o
      id_origem da análise; sem código, pelo nome sem acento na mesma vaga.
      Nome, vaga e cargo ficam como vieram (a entrevista pode existir sem
      análise ligada; o painel avisa).
    - public."TB_ENTREVISTA_NOTA": a nota de cada critério (média da banca,
      como está na coluna J da planilha de entrevista).
    - public."TL_SYNC_ENTREVISTA": cada carga vinda da planilha (quando, quantas
      linhas, quantas ligadas à análise, quantas saíram).
    - Carga (só service_role, chamada pelo Apps Script
      apps-script/saude-indigena/5-entrevistas-para-supabase.gs):
        sincronizar_entrevistas(p_sync, p_area, p_linhas)  um lote de linhas
        finalizar_sync_entrevistas(p_sync, p_area, p_forcar) liga e fecha a carga
      Quem sumiu da planilha fica com "ST_ATIVO" = 'N' (nada é apagado). A
      carga que trouxer menos da metade das linhas ativas é recusada sem
      p_forcar (protege contra uma leitura quebrada da planilha).
    - Leitura: get_entrevistas_da_area(p_area) (json), com o recurso de
      permissão novo 'entrevistas' (>= leitor), a área e o recorte da
      coordenação (FC_EDITAIS_VISIVEIS), como os Recursos.
    - Permissão: 'entrevistas' em FC_RECURSOS_MODULO e o nível de cada grupo:
      admin = admin; gestor de edital e coordenador = editor; contratador e
      usuário = leitor. (Nesta fase ninguém grava pela tela.)
    - Catálogo de abas: 'entrevistas' em TB_ABA (ordem 6, depois de Análises;
      Recursos passa a 7) e nas três áreas, espelho de ABAS_DO_MENU. Entra
      desligada; 20260930090000_liga_aba_entrevistas.sql liga com o front.

  O QUE NÃO MUDA
    O painel externo "Entrevistas" (TB_PAINEL_EXTERNO) continua ativo; sai
    depois da aprovação da aba nova, como foi com Recursos.

  Rollback: supabase/rollback/20260929235000_entrevistas.sql
*/
begin;

-- 1. Permissão: recurso 'entrevistas' ----------------------------------------------
create or replace function private."FC_RECURSOS_MODULO"()
 returns text[]
 language sql
 immutable
 set search_path to ''
as $function$
  select array['dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes','acessos','recursos','entrevistas']::text[];
$function$;

insert into public."TA_GRUPO_ACESSO_RECURSO" ("CO_GRUPO_ACESSO", "NO_RECURSO", "TP_NIVEL")
select g, 'entrevistas', n
  from (values ('admin','admin'), ('edital_gestor','editor'), ('coordenador','editor'),
               ('contratador','leitor'), ('usuario','leitor')) v(g, n)
 where exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = v.g)
on conflict ("CO_GRUPO_ACESSO", "NO_RECURSO") do nothing;

-- 2. Entrevista ----------------------------------------------------------------------
create table public."TB_ENTREVISTA" (
  "CO_ENTREVISTA" uuid not null default gen_random_uuid(),
  "CO_AREA" text not null,
  "CO_MONITORAMENTO" uuid,
  "CO_ANALISE_CURRICULAR" uuid,
  "TP_LIGACAO_ANALISE" text,
  "NO_UNIDADE" text not null,
  "DS_EDITAL" text not null,
  "CO_VAGA" text not null,
  "NO_CANDIDATO" text not null,
  "CO_CANDIDATO" text,
  "DS_MODALIDADE" text,
  "NO_CARGO" text,
  "VL_NOTA_TOTAL" numeric(6,2),
  "TP_PARECER" text not null default 'SEM_PARECER',
  "ST_COMPARECEU" varchar(1),
  "DS_LINK_PLANILHA" text,
  "TP_ORIGEM" text not null default 'planilha',
  "DS_CHAVE_ORIGEM" text not null,
  "CO_SYNC" text,
  "ST_ATIVO" varchar(1) not null default 'S',
  "DT_CRIACAO" timestamptz not null default now(),
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_ENTREVISTA" primary key ("CO_ENTREVISTA"),
  constraint "UK_ENTREVISTA_CHAVEORIGEM" unique ("DS_CHAVE_ORIGEM"),
  constraint "FK_AREA_ENTREVISTA" foreign key ("CO_AREA") references public."TB_AREA" ("CO_AREA"),
  constraint "FK_MONITORAMENTO_ENTREVISTA" foreign key ("CO_MONITORAMENTO") references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "FK_ANALISECURRICULAR_ENTREVISTA" foreign key ("CO_ANALISE_CURRICULAR") references public."TB_ANALISE_CURRICULAR" (id),
  constraint "CK_ENTREVISTA_TPPARECER" check ("TP_PARECER" in ('APTO', 'INAPTO', 'SEM_PARECER')),
  constraint "CK_ENTREVISTA_STCOMPARECEU" check ("ST_COMPARECEU" in ('S', 'N')),
  constraint "CK_ENTREVISTA_TPORIGEM" check ("TP_ORIGEM" in ('planilha', 'sistema')),
  constraint "CK_ENTREVISTA_TPLIGACAO" check (
    ("CO_ANALISE_CURRICULAR" is null and "TP_LIGACAO_ANALISE" is null)
    or ("CO_ANALISE_CURRICULAR" is not null and "TP_LIGACAO_ANALISE" in ('codigo', 'nome'))
  ),
  constraint "CK_ENTREVISTA_STATIVO" check ("ST_ATIVO" in ('S', 'N')),
  constraint "CK_ENTREVISTA_TAMANHOS" check (
    length("NO_UNIDADE") <= 200 and length("DS_EDITAL") <= 120
    and length("CO_VAGA") <= 60 and length("NO_CANDIDATO") <= 200
    and coalesce(length("CO_CANDIDATO"), 0) <= 60
    and coalesce(length("DS_MODALIDADE"), 0) <= 300
    and coalesce(length("NO_CARGO"), 0) <= 400
    and coalesce(length("DS_LINK_PLANILHA"), 0) <= 500
  )
);
comment on table public."TB_ENTREVISTA" is
  'Candidato entrevistado numa vaga de um edital (aba Entrevistas). Na fase 1 vem da planilha "[dash] entrevistados" (TP_ORIGEM planilha); liga ao edital e à análise curricular do candidato.';
comment on column public."TB_ENTREVISTA"."CO_ENTREVISTA" is 'Identificador da entrevista.';
comment on column public."TB_ENTREVISTA"."CO_AREA" is 'Área (TB_AREA) de onde veio a carga.';
comment on column public."TB_ENTREVISTA"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA.id), achado pelo número do edital + área (desempate pela unidade). Nulo: edital não cadastrado.';
comment on column public."TB_ENTREVISTA"."CO_ANALISE_CURRICULAR" is 'Análise curricular do candidato na vaga (TB_ANALISE_CURRICULAR.id). Nula: candidato não achado nas análises.';
comment on column public."TB_ENTREVISTA"."TP_LIGACAO_ANALISE" is 'Como a análise foi achada: codigo (código do candidato + vaga) ou nome (nome sem acento + vaga).';
comment on column public."TB_ENTREVISTA"."NO_UNIDADE" is 'Unidade (DSEI) como veio da planilha.';
comment on column public."TB_ENTREVISTA"."DS_EDITAL" is 'Edital como veio da planilha (ex.: 39/2026 (sanitarista)).';
comment on column public."TB_ENTREVISTA"."CO_VAGA" is 'Código da vaga.';
comment on column public."TB_ENTREVISTA"."NO_CANDIDATO" is 'Nome do candidato como veio da planilha.';
comment on column public."TB_ENTREVISTA"."CO_CANDIDATO" is 'Código do candidato (o id_origem da análise curricular).';
comment on column public."TB_ENTREVISTA"."DS_MODALIDADE" is 'Modalidade de concorrência (várias separadas por " / ").';
comment on column public."TB_ENTREVISTA"."NO_CARGO" is 'Cargo da vaga como veio da planilha.';
comment on column public."TB_ENTREVISTA"."VL_NOTA_TOTAL" is 'Nota total da entrevista (soma das médias dos critérios; máximo 20 no roteiro da Saúde Indígena).';
comment on column public."TB_ENTREVISTA"."TP_PARECER" is 'APTO, INAPTO ou SEM_PARECER.';
comment on column public."TB_ENTREVISTA"."ST_COMPARECEU" is 'S: compareceu; N: faltou; nulo: não informado.';
comment on column public."TB_ENTREVISTA"."DS_LINK_PLANILHA" is 'Link da planilha de entrevista da vaga (fase 1).';
comment on column public."TB_ENTREVISTA"."TP_ORIGEM" is 'planilha (carga do Apps Script) ou sistema (fase 2, entrevista feita no MONITORA).';
comment on column public."TB_ENTREVISTA"."DS_CHAVE_ORIGEM" is 'Chave natural da linha: área | edital | vaga | código do candidato (ou nome sem acento). A carga faz upsert por ela.';
comment on column public."TB_ENTREVISTA"."CO_SYNC" is 'Última carga (TL_SYNC_ENTREVISTA) que trouxe a linha.';
comment on column public."TB_ENTREVISTA"."ST_ATIVO" is 'S: está na planilha; N: saiu da planilha numa carga (fica para o histórico).';
comment on column public."TB_ENTREVISTA"."DT_CRIACAO" is 'Primeira carga da linha.';
comment on column public."TB_ENTREVISTA"."DT_ATUALIZACAO" is 'Última carga que mudou ou confirmou a linha.';
comment on constraint "UK_ENTREVISTA_CHAVEORIGEM" on public."TB_ENTREVISTA" is 'Uma linha por chave natural.';
comment on constraint "FK_AREA_ENTREVISTA" on public."TB_ENTREVISTA" is 'Área da entrevista.';
comment on constraint "FK_MONITORAMENTO_ENTREVISTA" on public."TB_ENTREVISTA" is 'Edital da entrevista.';
comment on constraint "FK_ANALISECURRICULAR_ENTREVISTA" on public."TB_ENTREVISTA" is 'Análise do candidato. Sem ON DELETE: o sync das análises só faz upsert.';
comment on constraint "CK_ENTREVISTA_TPPARECER" on public."TB_ENTREVISTA" is 'Pareceres válidos.';
comment on constraint "CK_ENTREVISTA_STCOMPARECEU" on public."TB_ENTREVISTA" is 'Flag S/N (nulo = não informado).';
comment on constraint "CK_ENTREVISTA_TPORIGEM" on public."TB_ENTREVISTA" is 'Origens válidas.';
comment on constraint "CK_ENTREVISTA_TPLIGACAO" on public."TB_ENTREVISTA" is 'O modo de ligação existe só com a análise ligada.';
comment on constraint "CK_ENTREVISTA_STATIVO" on public."TB_ENTREVISTA" is 'Flag S/N.';
comment on constraint "CK_ENTREVISTA_TAMANHOS" on public."TB_ENTREVISTA" is 'Limites de tamanho dos textos.';

create index "IN_ENTREVISTA_AREA_ATIVO" on public."TB_ENTREVISTA" ("CO_AREA") where "ST_ATIVO" = 'S';
create index "IN_FKENTREVISTA_COMONITORAMENTO" on public."TB_ENTREVISTA" ("CO_MONITORAMENTO");
create index "IN_FKENTREVISTA_COANALISE" on public."TB_ENTREVISTA" ("CO_ANALISE_CURRICULAR");
comment on index public."IN_ENTREVISTA_AREA_ATIVO" is 'Entrevistas ativas por área (leitura da aba).';
comment on index public."IN_FKENTREVISTA_COMONITORAMENTO" is 'Chave estrangeira para TB_MONITORAMENTO_INDIGENA.';
comment on index public."IN_FKENTREVISTA_COANALISE" is 'Chave estrangeira para TB_ANALISE_CURRICULAR (e "aprovados sem entrevista").';

-- A ligação entrevista -> análise procura pela vaga (24 mil análises, sem índice na vaga).
create index if not exists "IN_ANALISECURRICULAR_VAGA" on public."TB_ANALISE_CURRICULAR" (codigo_vaga, "CO_AREA");
comment on index public."IN_ANALISECURRICULAR_VAGA" is 'Análises por vaga e área (ligação com as entrevistas e aprovados sem entrevista).';

-- 3. Nota por critério ---------------------------------------------------------------
create table public."TB_ENTREVISTA_NOTA" (
  "CO_ENTREVISTA" uuid not null,
  "NU_ORDEM" smallint not null,
  "DS_CRITERIO" text not null,
  "VL_NOTA" numeric(5,2),
  constraint "PK_TB_ENTREVISTA_NOTA" primary key ("CO_ENTREVISTA", "NU_ORDEM"),
  constraint "FK_ENTREVISTA_ENTREVISTANOTA" foreign key ("CO_ENTREVISTA") references public."TB_ENTREVISTA" ("CO_ENTREVISTA"),
  constraint "CK_ENTREVISTANOTA_NUORDEM" check ("NU_ORDEM" between 1 and 20),
  constraint "CK_ENTREVISTANOTA_TAMANHO" check (length("DS_CRITERIO") between 1 and 600)
);
comment on table public."TB_ENTREVISTA_NOTA" is 'Nota de cada critério da entrevista (média da banca).';
comment on column public."TB_ENTREVISTA_NOTA"."CO_ENTREVISTA" is 'Entrevista (TB_ENTREVISTA).';
comment on column public."TB_ENTREVISTA_NOTA"."NU_ORDEM" is 'Ordem do critério no roteiro (1 a 20).';
comment on column public."TB_ENTREVISTA_NOTA"."DS_CRITERIO" is 'Critério (competência) como está no roteiro.';
comment on column public."TB_ENTREVISTA_NOTA"."VL_NOTA" is 'Média da banca no critério. Nula: critério que saiu do roteiro numa carga posterior.';
comment on constraint "FK_ENTREVISTA_ENTREVISTANOTA" on public."TB_ENTREVISTA_NOTA" is 'Entrevista da nota.';
comment on constraint "CK_ENTREVISTANOTA_NUORDEM" on public."TB_ENTREVISTA_NOTA" is 'Até 20 critérios.';
comment on constraint "CK_ENTREVISTANOTA_TAMANHO" on public."TB_ENTREVISTA_NOTA" is 'Critério entre 1 e 600 caracteres.';

-- 4. Log das cargas ------------------------------------------------------------------
create table public."TL_SYNC_ENTREVISTA" (
  "CO_SYNC" text not null,
  "CO_AREA" text not null,
  "DT_INICIO" timestamptz not null default now(),
  "DT_FIM" timestamptz,
  "QT_LINHA" integer not null default 0,
  "QT_LIGADA_ANALISE" integer,
  "QT_SEM_ANALISE" integer,
  "QT_SEM_EDITAL" integer,
  "QT_DESATIVADA" integer,
  "TP_SITUACAO" text not null default 'EM_ANDAMENTO',
  "DS_MENSAGEM" text,
  constraint "PK_TL_SYNC_ENTREVISTA" primary key ("CO_SYNC"),
  constraint "FK_AREA_SYNCENTREVISTA" foreign key ("CO_AREA") references public."TB_AREA" ("CO_AREA"),
  constraint "CK_SYNCENTREVISTA_COSYNC" check ("CO_SYNC" ~ '^[A-Za-z0-9_-]{8,80}$'),
  constraint "CK_SYNCENTREVISTA_TPSITUACAO" check ("TP_SITUACAO" in ('EM_ANDAMENTO', 'CONCLUIDA', 'RECUSADA'))
);
comment on table public."TL_SYNC_ENTREVISTA" is 'Log das cargas de entrevistas vindas da planilha.';
comment on column public."TL_SYNC_ENTREVISTA"."CO_SYNC" is 'Identificador da carga (gerado pelo Apps Script).';
comment on column public."TL_SYNC_ENTREVISTA"."CO_AREA" is 'Área da carga.';
comment on column public."TL_SYNC_ENTREVISTA"."DT_INICIO" is 'Primeiro lote recebido.';
comment on column public."TL_SYNC_ENTREVISTA"."DT_FIM" is 'Fechamento (finalizar_sync_entrevistas).';
comment on column public."TL_SYNC_ENTREVISTA"."QT_LINHA" is 'Linhas recebidas.';
comment on column public."TL_SYNC_ENTREVISTA"."QT_LIGADA_ANALISE" is 'Entrevistas ativas ligadas à análise curricular no fechamento.';
comment on column public."TL_SYNC_ENTREVISTA"."QT_SEM_ANALISE" is 'Entrevistas ativas sem análise ligada no fechamento.';
comment on column public."TL_SYNC_ENTREVISTA"."QT_SEM_EDITAL" is 'Entrevistas ativas sem edital cadastrado no fechamento.';
comment on column public."TL_SYNC_ENTREVISTA"."QT_DESATIVADA" is 'Linhas que saíram da planilha nesta carga (ST_ATIVO = N).';
comment on column public."TL_SYNC_ENTREVISTA"."TP_SITUACAO" is 'EM_ANDAMENTO, CONCLUIDA ou RECUSADA (carga pequena demais sem forçar).';
comment on column public."TL_SYNC_ENTREVISTA"."DS_MENSAGEM" is 'Motivo da recusa ou observação.';
comment on constraint "FK_AREA_SYNCENTREVISTA" on public."TL_SYNC_ENTREVISTA" is 'Área da carga.';
comment on constraint "CK_SYNCENTREVISTA_COSYNC" on public."TL_SYNC_ENTREVISTA" is 'Identificador de 8 a 80 caracteres seguros.';
comment on constraint "CK_SYNCENTREVISTA_TPSITUACAO" on public."TL_SYNC_ENTREVISTA" is 'Situações válidas.';

-- 5. Acesso: só as funções abaixo ----------------------------------------------------
alter table public."TB_ENTREVISTA" enable row level security;
alter table public."TB_ENTREVISTA_NOTA" enable row level security;
alter table public."TL_SYNC_ENTREVISTA" enable row level security;
revoke all on public."TB_ENTREVISTA", public."TB_ENTREVISTA_NOTA", public."TL_SYNC_ENTREVISTA" from public, anon, authenticated;

-- 6. Carga (service_role) ------------------------------------------------------------
create function private."FC_NUMERO_EDITAL"(p_texto text)
returns text
language sql
immutable
parallel safe
set search_path to ''
as $function$
  -- "06/2026", "6/2026 (sanitarista)", "Edital 06/2026" -> "6/2026"
  select ltrim(m[1], '0') || '/' || m[2]
    from regexp_match(coalesce(p_texto, ''), '(\d{1,4})\s*/\s*(\d{4})') m;
$function$;
comment on function private."FC_NUMERO_EDITAL"(text) is
  'Número do edital sem zero à esquerda e sem complemento (06/2026 (sanitarista) -> 6/2026), para ligar textos de edital diferentes.';

create function public.sincronizar_entrevistas(p_sync text, p_area text, p_linhas jsonb)
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
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if jsonb_typeof(p_linhas) is distinct from 'array' or jsonb_array_length(p_linhas) not between 1 and 1000 then
    raise exception 'Envie de 1 a 1000 linhas por lote' using errcode = '22023';
  end if;

  insert into public."TL_SYNC_ENTREVISTA" ("CO_SYNC", "CO_AREA")
  values (p_sync, p_area)
  on conflict ("CO_SYNC") do nothing;
  if exists (select 1 from public."TL_SYNC_ENTREVISTA" s
              where s."CO_SYNC" = p_sync and (s."CO_AREA" <> p_area or s."TP_SITUACAO" <> 'EM_ANDAMENTO')) then
    raise exception 'Carga % já fechada ou de outra área', p_sync using errcode = '22023';
  end if;

  create temporary table if not exists pg_temp.tmp_entrevista_lote (
    chave text, unidade text, edital text, vaga text, candidato text, codigo text,
    modalidade text, cargo text, nota numeric, parecer text, compareceu text,
    link text, notas jsonb
  ) on commit drop;
  truncate pg_temp.tmp_entrevista_lote;

  insert into pg_temp.tmp_entrevista_lote
  select distinct on (x.chave) x.*
    from (
      select
        p_area || '|' || coalesce(private."FC_NUMERO_EDITAL"(l.edital), lower(l.edital)) || '|' || l.vaga || '|' ||
          coalesce(nullif(l.codigo, ''), 'nome:' || private."FC_TEXTO_BUSCA_RECURSO"(l.candidato)) as chave,
        l.unidade, l.edital, l.vaga, l.candidato, nullif(l.codigo, '') as codigo,
        nullif(array_to_string(array(
          select btrim(t) from unnest(string_to_array(replace(coalesce(l.modalidade, ''), '"', ''), ',')) t
           where btrim(t) <> ''), ' / '), '') as modalidade,
        nullif(l.cargo, '') as cargo,
        case when l.nota ~ '^-?\d+([.,]\d+)?$' then replace(l.nota, ',', '.')::numeric end as nota,
        case
          when private."FC_TEXTO_BUSCA_RECURSO"(l.parecer) ~ '(inapto|reprovad|nao apto)' then 'INAPTO'
          when private."FC_TEXTO_BUSCA_RECURSO"(l.parecer) ~ 'apto' then 'APTO'
          else 'SEM_PARECER' end as parecer,
        case
          when private."FC_TEXTO_BUSCA_RECURSO"(l.compareceu) ~ '^(nao|n|ausente|faltou)' then 'N'
          when private."FC_TEXTO_BUSCA_RECURSO"(l.compareceu) ~ '^(sim|s|compareceu|presente)' then 'S'
          end as compareceu,
        nullif(l.link, '') as link,
        coalesce(l.notas, '[]'::jsonb) as notas
      from jsonb_to_recordset(p_linhas) as l(
        unidade text, edital text, vaga text, candidato text, codigo text, modalidade text,
        cargo text, nota text, parecer text, compareceu text, link text, notas jsonb)
      where btrim(coalesce(l.candidato, '')) <> ''
        and btrim(coalesce(l.vaga, '')) <> ''
        and btrim(coalesce(l.edital, '')) <> ''
    ) x
   order by x.chave;

  insert into public."TB_ENTREVISTA" as e (
    "CO_AREA", "NO_UNIDADE", "DS_EDITAL", "CO_VAGA", "NO_CANDIDATO", "CO_CANDIDATO",
    "DS_MODALIDADE", "NO_CARGO", "VL_NOTA_TOTAL", "TP_PARECER", "ST_COMPARECEU",
    "DS_LINK_PLANILHA", "TP_ORIGEM", "DS_CHAVE_ORIGEM", "CO_SYNC", "ST_ATIVO")
  select p_area, left(coalesce(t.unidade, ''), 200), left(t.edital, 120), left(t.vaga, 60),
         left(t.candidato, 200), left(t.codigo, 60), left(t.modalidade, 300), left(t.cargo, 400),
         t.nota, t.parecer, t.compareceu, left(t.link, 500), 'planilha', t.chave, p_sync, 'S'
    from pg_temp.tmp_entrevista_lote t
  on conflict ("DS_CHAVE_ORIGEM") do update set
    "NO_UNIDADE" = excluded."NO_UNIDADE",
    "DS_EDITAL" = excluded."DS_EDITAL",
    "NO_CANDIDATO" = excluded."NO_CANDIDATO",
    "CO_CANDIDATO" = excluded."CO_CANDIDATO",
    "DS_MODALIDADE" = excluded."DS_MODALIDADE",
    "NO_CARGO" = excluded."NO_CARGO",
    "VL_NOTA_TOTAL" = excluded."VL_NOTA_TOTAL",
    "TP_PARECER" = excluded."TP_PARECER",
    "ST_COMPARECEU" = excluded."ST_COMPARECEU",
    "DS_LINK_PLANILHA" = excluded."DS_LINK_PLANILHA",
    "CO_SYNC" = excluded."CO_SYNC",
    "ST_ATIVO" = 'S',
    "DT_ATUALIZACAO" = now()
  where e."TP_ORIGEM" = 'planilha';

  -- Notas: upsert por ordem; ordem que sumiu fica com nota nula (nada é apagado).
  with n as (
    select e."CO_ENTREVISTA", (c.ord)::smallint as ordem,
           left(btrim(c.item->>'criterio'), 600) as criterio,
           case when (c.item->>'nota') ~ '^-?\d+([.,]\d+)?$' then replace(c.item->>'nota', ',', '.')::numeric end as nota
      from pg_temp.tmp_entrevista_lote t
      join public."TB_ENTREVISTA" e on e."DS_CHAVE_ORIGEM" = t.chave and e."TP_ORIGEM" = 'planilha'
      cross join lateral jsonb_array_elements(t.notas) with ordinality c(item, ord)
     where c.ord between 1 and 20 and btrim(coalesce(c.item->>'criterio', '')) <> ''
  )
  insert into public."TB_ENTREVISTA_NOTA" ("CO_ENTREVISTA", "NU_ORDEM", "DS_CRITERIO", "VL_NOTA")
  select "CO_ENTREVISTA", ordem, criterio, nota from n
  on conflict ("CO_ENTREVISTA", "NU_ORDEM") do update set
    "DS_CRITERIO" = excluded."DS_CRITERIO", "VL_NOTA" = excluded."VL_NOTA";

  update public."TB_ENTREVISTA_NOTA" en set "VL_NOTA" = null
    from pg_temp.tmp_entrevista_lote t
    join public."TB_ENTREVISTA" e on e."DS_CHAVE_ORIGEM" = t.chave and e."TP_ORIGEM" = 'planilha'
   where en."CO_ENTREVISTA" = e."CO_ENTREVISTA"
     and en."NU_ORDEM" > (select count(*) from jsonb_array_elements(t.notas) x
                           where btrim(coalesce(x->>'criterio', '')) <> '')
     and en."VL_NOTA" is not null;

  select count(*) into v_qt from pg_temp.tmp_entrevista_lote;
  update public."TL_SYNC_ENTREVISTA" set "QT_LINHA" = "QT_LINHA" + v_qt where "CO_SYNC" = p_sync;
  return jsonb_build_object('recebidas', jsonb_array_length(p_linhas), 'gravadas', v_qt);
end;
$function$;
comment on function public.sincronizar_entrevistas(text, text, jsonb) is
  'Recebe um lote (até 1000) de linhas da aba Entrevistados e faz upsert em TB_ENTREVISTA/TB_ENTREVISTA_NOTA. Só service_role (Apps Script). Fechar com finalizar_sync_entrevistas.';

create function public.finalizar_sync_entrevistas(p_sync text, p_area text, p_forcar boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_sync public."TL_SYNC_ENTREVISTA";
  v_ativas integer;
  v_desativadas integer;
  v_ligadas integer;
  v_sem_analise integer;
  v_sem_edital integer;
begin
  select * into v_sync from public."TL_SYNC_ENTREVISTA" s where s."CO_SYNC" = p_sync for update;
  if v_sync."CO_SYNC" is null or v_sync."CO_AREA" <> p_area or v_sync."TP_SITUACAO" <> 'EM_ANDAMENTO' then
    raise exception 'Carga % não encontrada, de outra área ou já fechada', p_sync using errcode = '22023';
  end if;

  select count(*) into v_ativas from public."TB_ENTREVISTA" e
   where e."CO_AREA" = p_area and e."TP_ORIGEM" = 'planilha' and e."ST_ATIVO" = 'S';
  if not coalesce(p_forcar, false) and v_ativas > 0 and v_sync."QT_LINHA" * 2 < v_ativas then
    update public."TL_SYNC_ENTREVISTA" set "TP_SITUACAO" = 'RECUSADA', "DT_FIM" = now(),
      "DS_MENSAGEM" = format('Carga com %s linhas e %s ativas no banco: menos da metade. Nada foi desativado; confira a planilha ou rode com forçar.', v_sync."QT_LINHA", v_ativas)
     where "CO_SYNC" = p_sync;
    return jsonb_build_object('situacao', 'RECUSADA', 'linhas', v_sync."QT_LINHA", 'ativas', v_ativas);
  end if;

  update public."TB_ENTREVISTA" e set "ST_ATIVO" = 'N', "DT_ATUALIZACAO" = now()
   where e."CO_AREA" = p_area and e."TP_ORIGEM" = 'planilha' and e."ST_ATIVO" = 'S'
     and e."CO_SYNC" is distinct from p_sync;
  get diagnostics v_desativadas = row_count;

  -- Edital: número + área; com mais de um, o da mesma unidade.
  with alvo as (
    select e."CO_ENTREVISTA", (
      select m1.id from public."TB_MONITORAMENTO_INDIGENA" m1
       where m1."CO_AREA" = e."CO_AREA"
         and private."FC_NUMERO_EDITAL"(m1.edital) = private."FC_NUMERO_EDITAL"(e."DS_EDITAL")
       order by (private."FC_TEXTO_BUSCA_RECURSO"(m1.unidade) = private."FC_TEXTO_BUSCA_RECURSO"(e."NO_UNIDADE")) desc,
                m1.ativo desc
       limit 1) as edital_id
      from public."TB_ENTREVISTA" e
     where e."CO_AREA" = p_area and e."ST_ATIVO" = 'S'
  )
  update public."TB_ENTREVISTA" e set "CO_MONITORAMENTO" = alvo.edital_id
    from alvo
   where e."CO_ENTREVISTA" = alvo."CO_ENTREVISTA"
     and e."CO_MONITORAMENTO" is distinct from alvo.edital_id;

  -- Análise: código do candidato + vaga; senão nome sem acento + vaga.
  with alvo as (
    select e."CO_ENTREVISTA", x.id, x.modo
      from public."TB_ENTREVISTA" e
      left join lateral (
        select c.id, c.modo from (
          select a.id, 'codigo'::text as modo, 1 as prioridade, a.ativo, a.edital
            from public."TB_ANALISE_CURRICULAR" a
           where e."CO_CANDIDATO" is not null
             and a."CO_AREA" = e."CO_AREA" and a.codigo_vaga = e."CO_VAGA" and a.id_origem = e."CO_CANDIDATO"
          union all
          select a.id, 'nome', 2, a.ativo, a.edital
            from public."TB_ANALISE_CURRICULAR" a
           where a."CO_AREA" = e."CO_AREA" and a.codigo_vaga = e."CO_VAGA"
             and private."FC_TEXTO_BUSCA_RECURSO"(a.candidato) = private."FC_TEXTO_BUSCA_RECURSO"(e."NO_CANDIDATO")
        ) c
        order by c.prioridade,
                 (private."FC_NUMERO_EDITAL"(c.edital) = private."FC_NUMERO_EDITAL"(e."DS_EDITAL")) desc,
                 c.ativo desc
        limit 1
      ) x on true
     where e."CO_AREA" = p_area and e."ST_ATIVO" = 'S'
  )
  update public."TB_ENTREVISTA" e set "CO_ANALISE_CURRICULAR" = alvo.id, "TP_LIGACAO_ANALISE" = alvo.modo
    from alvo
   where e."CO_ENTREVISTA" = alvo."CO_ENTREVISTA"
     and (e."CO_ANALISE_CURRICULAR" is distinct from alvo.id or e."TP_LIGACAO_ANALISE" is distinct from alvo.modo);

  select count(*) filter (where e."CO_ANALISE_CURRICULAR" is not null),
         count(*) filter (where e."CO_ANALISE_CURRICULAR" is null),
         count(*) filter (where e."CO_MONITORAMENTO" is null)
    into v_ligadas, v_sem_analise, v_sem_edital
    from public."TB_ENTREVISTA" e
   where e."CO_AREA" = p_area and e."ST_ATIVO" = 'S';

  update public."TL_SYNC_ENTREVISTA" set
    "TP_SITUACAO" = 'CONCLUIDA', "DT_FIM" = now(),
    "QT_LIGADA_ANALISE" = v_ligadas, "QT_SEM_ANALISE" = v_sem_analise,
    "QT_SEM_EDITAL" = v_sem_edital, "QT_DESATIVADA" = v_desativadas,
    "DS_MENSAGEM" = case when coalesce(p_forcar, false) then 'Fechada com forçar.' end
   where "CO_SYNC" = p_sync;

  return jsonb_build_object('situacao', 'CONCLUIDA', 'linhas', v_sync."QT_LINHA",
    'ligadas_analise', v_ligadas, 'sem_analise', v_sem_analise,
    'sem_edital', v_sem_edital, 'desativadas', v_desativadas);
end;
$function$;
comment on function public.finalizar_sync_entrevistas(text, text, boolean) is
  'Fecha uma carga de entrevistas: desativa (ST_ATIVO = N) o que saiu da planilha, liga edital e análise e grava os totais no log. Recusa carga com menos da metade das linhas ativas sem p_forcar. Só service_role.';

revoke all on function public.sincronizar_entrevistas(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.finalizar_sync_entrevistas(text, text, boolean) from public, anon, authenticated;
revoke all on function private."FC_NUMERO_EDITAL"(text) from public, anon, authenticated;
grant execute on function public.sincronizar_entrevistas(text, text, jsonb) to service_role;
grant execute on function public.finalizar_sync_entrevistas(text, text, boolean) to service_role;

-- 7. Leitura da aba ------------------------------------------------------------------
create function public.get_entrevistas_da_area(p_area text)
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
  if not private.pode_recurso('entrevistas', 1) then
    raise exception 'Sem permissão para Entrevistas' using errcode = '42501';
  end if;
  if not private."FC_PODE_AREA"(p_area) then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  v_editais := (select private."FC_EDITAIS_VISIVEIS"())::uuid[];

  return (
    with e as (
      select e.*
        from public."TB_ENTREVISTA" e
       where e."CO_AREA" = p_area and e."ST_ATIVO" = 'S'
         and (v_editais is null or e."CO_MONITORAMENTO" = any (v_editais))
    ),
    criterios as (
      select n."DS_CRITERIO" as criterio, row_number() over (order by min(n."NU_ORDEM"), n."DS_CRITERIO") - 1 as i
        from public."TB_ENTREVISTA_NOTA" n
        join e on e."CO_ENTREVISTA" = n."CO_ENTREVISTA"
       where n."VL_NOTA" is not null
       group by n."DS_CRITERIO"
    ),
    vagas as (
      select distinct e."CO_VAGA" from e
    ),
    sem_entrevista as (
      select a.id, a.candidato, a.id_origem, a.codigo_vaga, a.nome_vaga, a.edital, a.unidade,
             a.nota_final_ajustada, a.modalidade_concorrencia
        from public."TB_ANALISE_CURRICULAR" a
        join vagas v on v."CO_VAGA" = a.codigo_vaga
       where a."CO_AREA" = p_area and a.ativo
         and a.status_consolidado = 'Aprovado'
         and not exists (select 1 from public."TB_ENTREVISTA" x
                          where x."CO_ANALISE_CURRICULAR" = a.id and x."ST_ATIVO" = 'S')
         and (v_editais is null or exists (
               select 1 from public."TB_MONITORAMENTO_INDIGENA" m
                where m.id = any (v_editais) and m."CO_AREA" = a."CO_AREA"
                  and private."FC_NUMERO_EDITAL"(m.edital) = private."FC_NUMERO_EDITAL"(a.edital)))
       order by a.edital, a.codigo_vaga, a.candidato
       limit 3000
    )
    select json_build_object(
      'schema_version', 1,
      'area', p_area,
      'gerado_em', now(),
      'ultima_carga', (
        select json_build_object('em', s."DT_FIM", 'linhas', s."QT_LINHA",
                                 'ligadas_analise', s."QT_LIGADA_ANALISE",
                                 'sem_analise', s."QT_SEM_ANALISE", 'sem_edital', s."QT_SEM_EDITAL")
          from public."TL_SYNC_ENTREVISTA" s
         where s."CO_AREA" = p_area and s."TP_SITUACAO" = 'CONCLUIDA'
         order by s."DT_FIM" desc limit 1
      ),
      'criterios', (select coalesce(json_agg(c.criterio order by c.i), '[]'::json) from criterios c),
      'entrevistas', (
        select coalesce(json_agg(json_build_object(
            'id', e."CO_ENTREVISTA",
            'edital_id', e."CO_MONITORAMENTO",
            'edital', coalesce(m.edital, e."DS_EDITAL"),
            'edital_planilha', e."DS_EDITAL",
            'unidade', coalesce(m.unidade, e."NO_UNIDADE"),
            'vaga', e."CO_VAGA",
            'cargo', coalesce(a.nome_vaga, e."NO_CARGO"),
            'candidato', e."NO_CANDIDATO",
            'codigo', e."CO_CANDIDATO",
            'modalidade', coalesce(a.modalidade_concorrencia, e."DS_MODALIDADE"),
            'nota', e."VL_NOTA_TOTAL",
            'parecer', e."TP_PARECER",
            'compareceu', e."ST_COMPARECEU",
            'link', e."DS_LINK_PLANILHA",
            'notas', (
              select coalesce(json_agg(json_build_array(c.i, n."VL_NOTA") order by n."NU_ORDEM"), '[]'::json)
                from public."TB_ENTREVISTA_NOTA" n
                join criterios c on c.criterio = n."DS_CRITERIO"
               where n."CO_ENTREVISTA" = e."CO_ENTREVISTA" and n."VL_NOTA" is not null
            ),
            'analise', case when a.id is null then null else json_build_object(
              'id', a.id,
              'ligacao', e."TP_LIGACAO_ANALISE",
              'nota', a.nota_final_ajustada,
              'resultado', a.status_consolidado,
              'etapa', a.etapa,
              'responsavel', a.responsavel_analise,
              'ativo', a.ativo
            ) end
          ) order by coalesce(m.edital, e."DS_EDITAL"), e."CO_VAGA", e."VL_NOTA_TOTAL" desc nulls last, e."NO_CANDIDATO"), '[]'::json)
          from e
          left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = e."CO_MONITORAMENTO"
          left join public."TB_ANALISE_CURRICULAR" a on a.id = e."CO_ANALISE_CURRICULAR"
      ),
      'aprovados_sem_entrevista', (
        select coalesce(json_agg(json_build_object(
            'analise_id', s.id,
            'candidato', s.candidato,
            'codigo', s.id_origem,
            'vaga', s.codigo_vaga,
            'cargo', s.nome_vaga,
            'edital', s.edital,
            'unidade', s.unidade,
            'nota', s.nota_final_ajustada,
            'modalidade', s.modalidade_concorrencia
          )), '[]'::json)
          from sem_entrevista s
      )
    )
  );
end;
$function$;
comment on function public.get_entrevistas_da_area(text) is
  'Leitura da aba Entrevistas de uma área (json): entrevistas ativas com as notas por critério (índice em "criterios"), a análise ligada e os aprovados na análise, nas vagas com entrevista, sem entrevista registrada. Exige entrevistas >= leitor, a área e o recorte da coordenação.';
revoke all on function public.get_entrevistas_da_area(text) from public, anon;
grant execute on function public.get_entrevistas_da_area(text) to authenticated, service_role;

-- 8. Catálogo de abas ----------------------------------------------------------------
-- A aba entra DESLIGADA (ST_ATIVO = 'N'): o front publicado ainda não tem a
-- view 'entrevistas'. Liga junto com o merge do front
-- (20260930090000_liga_aba_entrevistas.sql).
update public."TB_ABA" set "NU_ORDEM" = 7, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'recursos';
insert into public."TB_ABA" ("CO_ABA", "NO_ABA", "DS_ICONE", "NU_ORDEM", "CO_VIEW", "CO_RECURSO", "TP_ABA", "ST_ATIVO")
values ('entrevistas', 'Entrevistas', 'messages-square', 6, 'entrevistas', 'entrevistas', 'nativa', 'N');
insert into public."RL_ABA_AREA" ("CO_ABA", "CO_AREA", "ST_ATIVO")
select 'entrevistas', a."CO_AREA", 'S' from public."TB_AREA" a
on conflict do nothing;

commit;
