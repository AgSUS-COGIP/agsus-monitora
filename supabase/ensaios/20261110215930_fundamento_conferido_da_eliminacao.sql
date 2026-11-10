/*
  ENSAIO de 20261110215930_fundamento_conferido_da_eliminacao.sql

  Roda no SQL Editor (papel postgres) ANTES de aplicar, e só por pedido de quem opera o
  banco. Termina em rollback: nada fica gravado.

  O que confere:
    A. Antes do corpo, guarda o retrato (md5) da Triagem gravada: TB_PRE_CLASSIFICACAO
       (situação, motivo, notas, lote), TH_PRE_CLASSIFICACAO, as regras da Triagem e as
       decisões de lote.
    B. Aplica o corpo da migration, igual ao arquivo (o teste confere).
    C. Reprova se:
       - o retrato da Triagem mudou (motivos, notas, decisões ou resultados);
       - a migration criou alguma conferência (nada é escolhido automaticamente);
       - algum motivo de algum edital já sair com fundamento (sem conferência não há);
       - no Edital 114/2026: o item da nota mínima do lote (esperado 8.2.6) for aceito
         sem justificativa numa eliminação administrativa; alguém sem sessão conseguir
         conferir; a conferência simulada (administrador global, item fictício 0.0) não
         registrar papel e responsável, não chegar ao comunicado ou puder ser alterada.
       Mostra (NOTICE) a regra da Triagem do 114/2026 e o item de cada motivo nela, os
       eliminados por motivo (administrativos: QUESTIONARIO, CANCELADO,
       REPROVADO_EMPREGARE; demais) e quantos ficaram fora do lote pela nota (RANQUEADO).
  Ok = termina com NOTICE "Ensaio 20261110215930 ok" e ROLLBACK.
*/
begin;

-- A. O retrato da Triagem antes ------------------------------------------------------------------
create function pg_temp.ensaio_retrato()
returns text
language sql
as $ensaio$
  select md5(concat_ws('#',
    (select md5(coalesce(string_agg(concat_ws('|', a."CO_MONITORAMENTO", a."CO_EMPREGARE_CANDIDATO", a."NU_VERSAO_REGRA",
              a."TP_SITUACAO", a."CO_MOTIVO_ELIMINACAO", a."DS_MOTIVO_ELIMINACAO", a."VL_ART", a."VL_NOTA_ORDEM",
              a."VL_NOTA_DECLARADA", a."NU_POSICAO", a."NU_LOTE", a."TP_ENTRADA_LOTE", a."DT_ATUALIZACAO"),
              ',' order by a."CO_MONITORAMENTO", a."CO_EMPREGARE_CANDIDATO"), ''))
       from public."TB_PRE_CLASSIFICACAO" a),
    (select count(*)::text from public."TH_PRE_CLASSIFICACAO"),
    (select md5(coalesce(string_agg(concat_ws('|', t."CO_MONITORAMENTO", t."NU_VERSAO_VIGENTE", t."TP_SITUACAO", t."DT_ATUALIZACAO"),
              ',' order by t."CO_MONITORAMENTO"), '')) from public."TB_REGRA_TRIAGEM" t),
    (select count(*)::text from public."TH_REGRA_TRIAGEM"),
    (select count(*)::text from public."TB_DECISAO_LOTE")));
$ensaio$;

create temp table "ENSAIO_ANTES" on commit drop as select pg_temp.ensaio_retrato() as "RETRATO";

-- B. O corpo da migration (igual ao arquivo, entre os marcadores) --------------------------------
-- >>> corpo da migration

set local lock_timeout = '5s';

-- 0. Guardas ---------------------------------------------------------------------------------
do $$
begin
  if to_regclass('public."TH_FUNDAMENTO_ELIMINACAO"') is not null then
    raise exception 'A migration 20261110215930 já foi aplicada (TH_FUNDAMENTO_ELIMINACAO existe).';
  end if;
  if to_regclass('public."TB_MONITORAMENTO_INDIGENA"') is null
     or to_regclass('public."TB_REGRA_TRIAGEM"') is null
     or to_regclass('public."TH_REGRA_TRIAGEM"') is null
     or to_regclass('public."TB_PRE_CLASSIFICACAO"') is null
     or to_regclass('public."TB_PERFIL_USUARIO"') is null
     or to_regprocedure('private.is_master()') is null
     or to_regprocedure('private.current_profile()') is null
     or to_regprocedure('private."FC_MOTIVO_COM_SENTIDO"(text)') is null
     or to_regprocedure('private."FC_REINICIO_TREINAMENTO_PERMITE"(text, jsonb)') is null then
    raise exception 'Faltam dependências (regra própria da Triagem, 20261029160000, e as funções de sessão).';
  end if;
  -- As funções abaixo partem das que estão no banco (retrato de 10/11/2026).
  if md5((select prosrc from pg_proc where oid = to_regprocedure('public.conferir_eliminados_pre_classificacao(uuid, text[])')))
       is distinct from 'b941a59c2b954d68edfa90ac091171a8'
     or md5((select prosrc from pg_proc where oid = to_regprocedure('private."FC_GESTOR_DO_EDITAL"(uuid, uuid)')))
       is distinct from 'fbc2328c946493ef6d1b402dc522ea3d'
     or md5((select prosrc from pg_proc where oid = to_regprocedure('private."FC_EXIGIR_COORD_AVALIACAO"(uuid)')))
       is distinct from '1f46ed29124066d0b3f5ade9d93320db' then
    raise exception 'conferir_eliminados_pre_classificacao, FC_GESTOR_DO_EDITAL ou FC_EXIGIR_COORD_AVALIACAO mudou depois do retrato de 10/11/2026: junte as mudanças antes de aplicar.';
  end if;
end;
$$;

-- 1. O histórico das conferências ------------------------------------------------------------
create table public."TH_FUNDAMENTO_ELIMINACAO" (
  "CO_HISTORICO" bigint generated always as identity,
  "CO_MONITORAMENTO" uuid not null,
  "CO_MOTIVO_ELIMINACAO" character varying(30) not null,
  "NU_VERSAO_REGRA" integer not null,
  "DS_HASH_REGRA" character varying(64) not null,
  "DS_REGRA_MOTIVO" jsonb not null,
  "DS_ITEM_EDITAL" character varying(30) not null,
  "DS_FONTE" character varying(500) not null,
  "DS_JUSTIFICATIVA" character varying(500),
  "TP_PAPEL" character varying(15) not null,
  "CO_USUARIO" uuid not null,
  "DT_CONFERENCIA" timestamptz not null default now(),
  constraint "PK_TH_FUNDAMENTO_ELIMINACAO" primary key ("CO_HISTORICO"),
  constraint "FK_THFUNDELIM_MONITORAMENTO" foreign key ("CO_MONITORAMENTO")
    references public."TB_MONITORAMENTO_INDIGENA" (id) on delete restrict,
  constraint "CK_THFUNDELIM_COMOTIVO" check ("CO_MOTIVO_ELIMINACAO" ~ '^[A-Z][A-Z0-9_]{1,29}$'),
  constraint "CK_THFUNDELIM_NUVERSAO" check ("NU_VERSAO_REGRA" >= 1),
  constraint "CK_THFUNDELIM_DSHASH" check ("DS_HASH_REGRA" ~ '^[0-9a-f]{64}$'),
  constraint "CK_THFUNDELIM_REGRAMOTIVO" check (jsonb_typeof("DS_REGRA_MOTIVO") = 'object'),
  constraint "CK_THFUNDELIM_ITEM" check ("DS_ITEM_EDITAL" ~ '^[0-9]{1,3}(\.[0-9]{1,3}){0,6}$'),
  constraint "CK_THFUNDELIM_FONTE" check (length(btrim("DS_FONTE")) between 10 and 500 and "DS_FONTE" = btrim("DS_FONTE")),
  constraint "CK_THFUNDELIM_JUSTIFICATIVA" check ("DS_JUSTIFICATIVA" is null
    or (length(btrim("DS_JUSTIFICATIVA")) between 15 and 500 and "DS_JUSTIFICATIVA" = btrim("DS_JUSTIFICATIVA"))),
  constraint "CK_THFUNDELIM_TPPAPEL" check ("TP_PAPEL" in ('EDITAL_GESTOR', 'COORDENADOR', 'ADMIN_GLOBAL'))
);

create index "IX_THFUNDELIM_EDITAL_MOTIVO"
  on public."TH_FUNDAMENTO_ELIMINACAO" ("CO_MONITORAMENTO", "CO_MOTIVO_ELIMINACAO", "CO_HISTORICO" desc);

alter table public."TH_FUNDAMENTO_ELIMINACAO" enable row level security;
revoke all on table public."TH_FUNDAMENTO_ELIMINACAO" from public, anon, authenticated;

comment on table public."TH_FUNDAMENTO_ELIMINACAO" is 'Histórico imutável das conferências do fundamento normativo de cada motivo de eliminação da Triagem (issue #593, 20261110215930): o item oficial do edital escolhido por quem tem a autoridade (gestor ou coordenador do edital, ou administrador global), a fonte, a versão da regra da Triagem e o retrato do motivo nela, o papel, quem e quando. A vigente é a última de cada edital e motivo (private."FC_FUNDAMENTO_DA_ELIMINACAO"). Retificação = linha nova com justificativa. Grava só conferir_fundamento_da_eliminacao; lê obter_fundamentos_da_eliminacao. Nunca altera motivo, nota, decisão ou resultado.';
comment on column public."TH_FUNDAMENTO_ELIMINACAO"."CO_HISTORICO" is 'Identificador e ordem da conferência.';
comment on column public."TH_FUNDAMENTO_ELIMINACAO"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA.id).';
comment on column public."TH_FUNDAMENTO_ELIMINACAO"."CO_MOTIVO_ELIMINACAO" is 'Código do motivo de eliminação da Triagem (TB_PRE_CLASSIFICACAO.CO_MOTIVO_ELIMINACAO; requisitos.eliminacao_automatica[].codigo da regra).';
comment on column public."TH_FUNDAMENTO_ELIMINACAO"."NU_VERSAO_REGRA" is 'Versão da regra da Triagem (TH_REGRA_TRIAGEM.NU_VERSAO), vigente e conferida no momento da conferência.';
comment on column public."TH_FUNDAMENTO_ELIMINACAO"."DS_HASH_REGRA" is 'Hash dessa versão da regra (TH_REGRA_TRIAGEM.DS_HASH).';
comment on column public."TH_FUNDAMENTO_ELIMINACAO"."DS_REGRA_MOTIVO" is 'Retrato da entrada do motivo na regra conferida (requisitos.eliminacao_automatica[]). O fundamento vale enquanto a regra vigente tiver a mesma entrada.';
comment on column public."TH_FUNDAMENTO_ELIMINACAO"."DS_ITEM_EDITAL" is 'Item oficial do edital (ex.: 6.4 ou 8.2.6), escolhido por quem confere; nunca presumido.';
comment on column public."TH_FUNDAMENTO_ELIMINACAO"."DS_FONTE" is 'Fonte em que o item foi conferido (ex.: Edital nº 114/2026 publicado em …, retificação nº …).';
comment on column public."TH_FUNDAMENTO_ELIMINACAO"."DS_JUSTIFICATIVA" is 'Justificativa: obrigatória para retificar uma conferência anterior e para usar o item da nota mínima do lote numa eliminação da Triagem.';
comment on column public."TH_FUNDAMENTO_ELIMINACAO"."TP_PAPEL" is 'Autoridade com que conferiu: EDITAL_GESTOR ou COORDENADOR (FC_GESTOR_DO_EDITAL) ou ADMIN_GLOBAL (is_master).';
comment on column public."TH_FUNDAMENTO_ELIMINACAO"."CO_USUARIO" is 'Quem conferiu (auth.users.id).';
comment on column public."TH_FUNDAMENTO_ELIMINACAO"."DT_CONFERENCIA" is 'Quando conferiu.';
comment on constraint "CK_THFUNDELIM_ITEM" on public."TH_FUNDAMENTO_ELIMINACAO" is 'Item numérico do edital, de 1 a 7 níveis (8, 8.2, 8.2.6…).';
comment on constraint "CK_THFUNDELIM_FONTE" on public."TH_FUNDAMENTO_ELIMINACAO" is 'Fonte de 10 a 500 caracteres, sem espaço nas pontas.';
comment on constraint "CK_THFUNDELIM_JUSTIFICATIVA" on public."TH_FUNDAMENTO_ELIMINACAO" is 'Justificativa ausente ou de 15 a 500 caracteres.';
comment on constraint "CK_THFUNDELIM_TPPAPEL" on public."TH_FUNDAMENTO_ELIMINACAO" is 'Papéis com autoridade para conferir.';

-- 2. Imutável --------------------------------------------------------------------------------
create function private."FC_TG_FUNDAMENTO_IMUTAVEL"()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and private."FC_REINICIO_TREINAMENTO_PERMITE"(tg_table_name, to_jsonb(old)) then
    return old;
  end if;
  raise exception 'A conferência do fundamento da eliminação não se altera nem se apaga: retifique com uma conferência nova.'
    using errcode = '42501';
end;
$$;

comment on function private."FC_TG_FUNDAMENTO_IMUTAVEL"() is 'Gatilho de TH_FUNDAMENTO_ELIMINACAO: recusa UPDATE e DELETE (só o reinício do edital de treinamento apaga). 20261110215930.';
revoke all on function private."FC_TG_FUNDAMENTO_IMUTAVEL"() from public, anon, authenticated;

create trigger "TG_THFUNDELIM_IMUTAVEL"
  before update or delete on public."TH_FUNDAMENTO_ELIMINACAO"
  for each row execute function private."FC_TG_FUNDAMENTO_IMUTAVEL"();

comment on trigger "TG_THFUNDELIM_IMUTAVEL" on public."TH_FUNDAMENTO_ELIMINACAO" is 'Histórico imutável (FC_TG_FUNDAMENTO_IMUTAVEL).';

-- 3. O fundamento vigente de um motivo -------------------------------------------------------
create function private."FC_FUNDAMENTO_DA_ELIMINACAO"(p_edital uuid, p_motivo text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with regra as (
    select t."TP_SITUACAO" as situacao,
           (select e
              from jsonb_array_elements(
                     case when jsonb_typeof(h."DS_CONFIGURACAO" #> '{requisitos,eliminacao_automatica}') = 'array'
                          then h."DS_CONFIGURACAO" #> '{requisitos,eliminacao_automatica}'
                          else '[]'::jsonb end) e
             where e ->> 'codigo' = p_motivo
             limit 1) as entrada
      from public."TB_REGRA_TRIAGEM" t
      join public."TH_REGRA_TRIAGEM" h
        on h."CO_REGRA_TRIAGEM" = t."CO_REGRA_TRIAGEM" and h."NU_VERSAO" = t."NU_VERSAO_VIGENTE"
     where t."CO_MONITORAMENTO" = p_edital
  ),
  ultimo as (
    select f.*
      from public."TH_FUNDAMENTO_ELIMINACAO" f
     where f."CO_MONITORAMENTO" = p_edital and f."CO_MOTIVO_ELIMINACAO" = p_motivo
     order by f."CO_HISTORICO" desc
     limit 1
  )
  select jsonb_build_object(
           'situacao', case when r.situacao = 'CONFERIDA' and r.entrada is not null
                             and r.entrada = u."DS_REGRA_MOTIVO" then 'CONFERIDO' else 'RECONFERIR' end,
           'motivo_codigo', u."CO_MOTIVO_ELIMINACAO",
           'item_edital', u."DS_ITEM_EDITAL",
           'versao_regra', u."NU_VERSAO_REGRA",
           'fonte', u."DS_FONTE",
           'conferido_em', u."DT_CONFERENCIA")
    from ultimo u
    left join regra r on true;
$$;

comment on function private."FC_FUNDAMENTO_DA_ELIMINACAO"(uuid, text) is 'O fundamento da última conferência de um motivo de eliminação da Triagem (TH_FUNDAMENTO_ELIMINACAO): situacao CONFERIDO enquanto a regra da Triagem vigente estiver conferida e tiver a mesma entrada do motivo; RECONFERIR quando mudou; nulo sem conferência. Nunca presume item. 20261110215930.';
revoke all on function private."FC_FUNDAMENTO_DA_ELIMINACAO"(uuid, text) from public, anon, authenticated;

-- 4. Conferir (gravar) o fundamento ----------------------------------------------------------
create function public.conferir_fundamento_da_eliminacao(
  p_edital uuid,
  p_motivo text,
  p_versao_regra integer,
  p_item_edital text,
  p_fonte text,
  p_justificativa text default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_perfil public."TB_PERFIL_USUARIO";
  v_papel text;
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_item text := btrim(coalesce(p_item_edital, ''));
  v_fonte text := btrim(coalesce(p_fonte, ''));
  v_justificativa text := nullif(btrim(coalesce(p_justificativa, '')), '');
  v_versao integer;
  v_situacao text;
  v_hash text;
  v_config jsonb;
  v_entrada jsonb;
  v_item_da_nota text;
  v_ultimo public."TH_FUNDAMENTO_ELIMINACAO";
begin
  if v_uid is null then
    raise exception 'Entre no sistema para conferir o fundamento.' using errcode = '42501';
  end if;
  if p_edital is null or not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital) then
    raise exception 'Edital não encontrado.' using errcode = '22023';
  end if;

  -- A autoridade: gestor ou coordenador do edital, ou administrador global.
  if private.is_master() then
    v_papel := 'ADMIN_GLOBAL';
  else
    v_perfil := private.current_profile();
    if v_perfil.id is null or not private."FC_GESTOR_DO_EDITAL"(v_perfil.id, p_edital) then
      raise exception 'Só o gestor ou o coordenador do edital, ou o administrador global, confere o fundamento da eliminação.'
        using errcode = '42501';
    end if;
    v_papel := case v_perfil.perfil when 'coordenador' then 'COORDENADOR' else 'EDITAL_GESTOR' end;
  end if;

  if v_motivo !~ '^[A-Z][A-Z0-9_]{1,29}$' then
    raise exception 'Motivo de eliminação inválido.' using errcode = '22023';
  end if;
  if v_item !~ '^[0-9]{1,3}(\.[0-9]{1,3}){0,6}$' then
    raise exception 'Informe o item do edital como no texto oficial (ex.: 6.4 ou 8.2.6).' using errcode = '22023';
  end if;
  if length(v_fonte) not between 10 and 500 then
    raise exception 'Informe a fonte em que o item foi conferido (10 a 500 caracteres).' using errcode = '22023';
  end if;
  if v_justificativa is not null
     and not private."FC_MOTIVO_COM_SENTIDO"(v_justificativa) then
    raise exception 'A justificativa precisa explicar a decisão em palavras (15 a 500 caracteres).' using errcode = '22023';
  end if;

  -- Uma conferência por vez em cada edital e motivo.
  perform pg_advisory_xact_lock(hashtextextended('fundamento_eliminacao:' || p_edital::text || ':' || v_motivo, 0));

  select t."NU_VERSAO_VIGENTE", t."TP_SITUACAO", h."DS_HASH", h."DS_CONFIGURACAO"
    into v_versao, v_situacao, v_hash, v_config
    from public."TB_REGRA_TRIAGEM" t
    join public."TH_REGRA_TRIAGEM" h
      on h."CO_REGRA_TRIAGEM" = t."CO_REGRA_TRIAGEM" and h."NU_VERSAO" = t."NU_VERSAO_VIGENTE"
   where t."CO_MONITORAMENTO" = p_edital;
  if not found then
    raise exception 'O edital não tem regra da Triagem.' using errcode = '22023';
  end if;
  if v_situacao is distinct from 'CONFERIDA' then
    raise exception 'Confira a regra da Triagem (versão %) antes de conferir o fundamento.', v_versao using errcode = '22023';
  end if;
  if p_versao_regra is distinct from v_versao then
    raise exception 'A regra da Triagem mudou (versão vigente: %). Atualize a tela e confira de novo.', v_versao
      using errcode = '40001';
  end if;
  select e into v_entrada
    from jsonb_array_elements(
           case when jsonb_typeof(v_config #> '{requisitos,eliminacao_automatica}') = 'array'
                then v_config #> '{requisitos,eliminacao_automatica}' else '[]'::jsonb end) e
   where e ->> 'codigo' = v_motivo
   limit 1;
  if v_entrada is null or jsonb_typeof(v_entrada) <> 'object' then
    raise exception 'O motivo % não está na regra da Triagem (versão %).', v_motivo, v_versao using errcode = '22023';
  end if;

  -- O item da nota mínima do lote não fundamenta eliminação da Triagem sem justificativa expressa.
  v_item_da_nota := nullif(btrim(coalesce(v_config #>> '{lote,item_edital}', '')), '');
  if v_item = v_item_da_nota and v_justificativa is null then
    raise exception 'O item % é o da nota mínima do lote nesta regra; a eliminação da Triagem não decorre da nota. Para usá-lo, justifique.', v_item
      using errcode = '22023';
  end if;

  select f.* into v_ultimo
    from public."TH_FUNDAMENTO_ELIMINACAO" f
   where f."CO_MONITORAMENTO" = p_edital and f."CO_MOTIVO_ELIMINACAO" = v_motivo
   order by f."CO_HISTORICO" desc
   limit 1;
  if v_ultimo."CO_HISTORICO" is not null then
    if v_ultimo."DS_ITEM_EDITAL" = v_item and v_ultimo."DS_FONTE" = v_fonte
       and v_ultimo."NU_VERSAO_REGRA" = v_versao and v_ultimo."DS_REGRA_MOTIVO" = v_entrada then
      return json_build_object('ok', true, 'sem_mudanca', true,
        'fundamento', private."FC_FUNDAMENTO_DA_ELIMINACAO"(p_edital, v_motivo));
    end if;
    if (v_ultimo."DS_ITEM_EDITAL" <> v_item or v_ultimo."DS_FONTE" <> v_fonte) and v_justificativa is null then
      raise exception 'Já há fundamento conferido (item %). Para retificar, justifique.', v_ultimo."DS_ITEM_EDITAL"
        using errcode = '22023';
    end if;
  end if;

  insert into public."TH_FUNDAMENTO_ELIMINACAO" (
    "CO_MONITORAMENTO", "CO_MOTIVO_ELIMINACAO", "NU_VERSAO_REGRA", "DS_HASH_REGRA", "DS_REGRA_MOTIVO",
    "DS_ITEM_EDITAL", "DS_FONTE", "DS_JUSTIFICATIVA", "TP_PAPEL", "CO_USUARIO")
  values (p_edital, v_motivo, v_versao, v_hash, v_entrada, v_item, v_fonte, v_justificativa, v_papel, v_uid);

  return json_build_object('ok', true, 'sem_mudanca', false,
    'fundamento', private."FC_FUNDAMENTO_DA_ELIMINACAO"(p_edital, v_motivo));
end;
$$;

comment on function public.conferir_fundamento_da_eliminacao(uuid, text, integer, text, text, text) is 'Confere o fundamento normativo (item oficial do edital e fonte) de um motivo de eliminação da Triagem, na versão vigente e conferida da regra da Triagem (p_versao_regra = a que a tela mostrou; outra = 40001). Só gestor ou coordenador do edital (FC_GESTOR_DO_EDITAL) ou administrador global (is_master); os demais = 42501. Grava uma linha nova em TH_FUNDAMENTO_ELIMINACAO (papel, quem, quando, versão, hash e retrato do motivo). Justificativa obrigatória para retificar e para usar o item da nota mínima do lote. Não altera motivo, nota, decisão nem resultado. 20261110215930.';
revoke all on function public.conferir_fundamento_da_eliminacao(uuid, text, integer, text, text, text) from public, anon;
grant execute on function public.conferir_fundamento_da_eliminacao(uuid, text, integer, text, text, text) to authenticated;

-- 5. O quadro da tela ------------------------------------------------------------------------
create function public.obter_fundamentos_da_eliminacao(p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_area text := private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);
  v_perfil public."TB_PERFIL_USUARIO";
  v_pode boolean;
  v_versao integer;
  v_situacao text;
  v_config jsonb;
begin
  if private.is_master() then
    v_pode := true;
  else
    v_perfil := private.current_profile();
    v_pode := v_perfil.id is not null and private."FC_GESTOR_DO_EDITAL"(v_perfil.id, p_edital);
  end if;

  select t."NU_VERSAO_VIGENTE", t."TP_SITUACAO", h."DS_CONFIGURACAO"
    into v_versao, v_situacao, v_config
    from public."TB_REGRA_TRIAGEM" t
    join public."TH_REGRA_TRIAGEM" h
      on h."CO_REGRA_TRIAGEM" = t."CO_REGRA_TRIAGEM" and h."NU_VERSAO" = t."NU_VERSAO_VIGENTE"
   where t."CO_MONITORAMENTO" = p_edital;

  return (
    with na_regra as (
      select e ->> 'codigo' as codigo, e ->> 'motivo' as motivo,
             nullif(btrim(coalesce(e ->> 'item_edital', '')), '') as item_na_regra, o.n as ordem
        from jsonb_array_elements(
               case when jsonb_typeof(v_config #> '{requisitos,eliminacao_automatica}') = 'array'
                    then v_config #> '{requisitos,eliminacao_automatica}' else '[]'::jsonb end)
             with ordinality o(e, n)
       where jsonb_typeof(e) = 'object' and coalesce(e ->> 'codigo', '') <> ''
    ),
    gravados as (
      select a."CO_MOTIVO_ELIMINACAO" as codigo, min(a."DS_MOTIVO_ELIMINACAO") as motivo, count(*)::int as n
        from public."TB_PRE_CLASSIFICACAO" a
       where a."CO_MONITORAMENTO" = p_edital and a."TP_SITUACAO" = 'ELIMINADO'
       group by a."CO_MOTIVO_ELIMINACAO"
    )
    select json_build_object(
      'schema_version', 1,
      'edital', p_edital,
      'pode_conferir', v_pode,
      'regra', case when v_versao is null then null else json_build_object(
        'versao', v_versao, 'situacao', v_situacao,
        'item_da_nota', nullif(btrim(coalesce(v_config #>> '{lote,item_edital}', '')), '')) end,
      'motivos', coalesce((
        select json_agg(json_build_object(
                 'codigo', r.codigo, 'motivo', coalesce(r.motivo, g.motivo), 'item_na_regra', r.item_na_regra,
                 'eliminados', coalesce(g.n, 0),
                 'fundamento', private."FC_FUNDAMENTO_DA_ELIMINACAO"(p_edital, r.codigo))
               order by r.ordem)
          from na_regra r left join gravados g on g.codigo = r.codigo), '[]'::json),
      'fora_da_regra', coalesce((
        select json_agg(json_build_object('codigo', g.codigo, 'motivo', g.motivo, 'eliminados', g.n) order by g.codigo)
          from gravados g where not exists (select 1 from na_regra r where r.codigo = g.codigo)), '[]'::json),
      'fora_do_lote_por_nota', (
        select count(*)::int from public."TB_PRE_CLASSIFICACAO" a
         where a."CO_MONITORAMENTO" = p_edital and a."TP_SITUACAO" = 'RANQUEADO'),
      'historico', coalesce((
        select json_agg(json_build_object(
                 'id', f."CO_HISTORICO", 'motivo_codigo', f."CO_MOTIVO_ELIMINACAO", 'item_edital', f."DS_ITEM_EDITAL",
                 'versao_regra', f."NU_VERSAO_REGRA", 'fonte', f."DS_FONTE", 'justificativa', f."DS_JUSTIFICATIVA",
                 'papel', f."TP_PAPEL", 'por', coalesce(p.nome, p.email), 'em', f."DT_CONFERENCIA")
               order by f."CO_HISTORICO" desc)
          from public."TH_FUNDAMENTO_ELIMINACAO" f
          left join lateral (
            select u.nome, u.email from public."TB_PERFIL_USUARIO" u
             where u.user_id = f."CO_USUARIO" order by u.ativo desc limit 1) p on true
         where f."CO_MONITORAMENTO" = p_edital), '[]'::json)));
end;
$$;

comment on function public.obter_fundamentos_da_eliminacao(uuid) is 'O quadro do fundamento das eliminações da Triagem: regra vigente (versão, situação, item da nota mínima do lote), cada motivo da regra com quantos eliminados e o fundamento (CONFERIDO, RECONFERIR ou nulo), os motivos gravados fora da regra, quantos ficaram fora do lote pela nota (RANQUEADO, sem comunicado de eliminação), o histórico das conferências e pode_conferir (gestor ou coordenador do edital, ou administrador global). Coordenação da avaliação do edital (FC_EXIGIR_COORD_AVALIACAO). 20261110215930.';
revoke all on function public.obter_fundamentos_da_eliminacao(uuid) from public, anon;
grant execute on function public.obter_fundamentos_da_eliminacao(uuid) to authenticated;

-- 6. O comunicado lê o fundamento conferido --------------------------------------------------
CREATE OR REPLACE FUNCTION public.conferir_eliminados_pre_classificacao(p_edital uuid, p_chaves text[])
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  v_area text := private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);
begin
  if cardinality(p_chaves) > 10000 then
    raise exception 'No máximo 10.000 por vez.' using errcode = '22023';
  end if;
  return (
    with pedidas as (
      select split_part(k, '|', 1) as vaga, split_part(k, '|', 2) as codigo
        from unnest(coalesce(p_chaves, '{}')) k
    ),
    base as (
      select a."CO_VAGA"::text as vaga, c."CO_CANDIDATO_EMPREGARE"::text as codigo, c."NO_CANDIDATO" as nome,
             a."TP_SITUACAO" as situacao, a."DS_MOTIVO_ELIMINACAO" as motivo, a."CO_MOTIVO_ELIMINACAO" as motivo_codigo,
             a."NO_MODALIDADE" as modalidade, a."VL_ART" as art, a."VL_NOTA_DECLARADA" as declarada,
             a."VL_NOTA_ORDEM" as nota, a."TP_ORIGEM_NOTA" as origem_nota
        from pedidas p
        join public."TB_EMPREGARE_CANDIDATO" c on c."CO_VAGA" = p.vaga and c."CO_CANDIDATO_EMPREGARE"::text = p.codigo
        join public."TB_PRE_CLASSIFICACAO" a
          on a."CO_MONITORAMENTO" = p_edital and a."CO_EMPREGARE_CANDIDATO" = c."CO_EMPREGARE_CANDIDATO"
    ),
    -- O fundamento só quando conferido (gestor/coordenador do edital ou administrador global); nunca presumido.
    fundamentos as (
      select m.motivo_codigo, private."FC_FUNDAMENTO_DA_ELIMINACAO"(p_edital, m.motivo_codigo) as f
        from (select distinct b.motivo_codigo from base b where b.situacao = 'ELIMINADO' and b.motivo_codigo is not null) m
    ),
    linhas as (
      select b.*,
             case when b.situacao = 'ELIMINADO' and fu.f ->> 'situacao' = 'CONFERIDO' then fu.f end as fundamento
        from base b
        left join fundamentos fu on fu.motivo_codigo = b.motivo_codigo
    )
    select json_build_object(
      'schema_version', 1,
      'edital', p_edital,
      'candidatos', coalesce((select json_agg(row_to_json(l)) from linhas l), '[]'::json),
      'vagas', coalesce((
        select json_agg(json_build_object('codigo', pv."CO_VAGA", 'cargo', pv."NO_CARGO"))
          from public."TB_PRE_CLASSIF_VAGA" pv
         where pv."CO_MONITORAMENTO" = p_edital and pv."CO_VAGA" in (select distinct l.vaga from linhas l)), '[]'::json)));
end;
$$;

comment on function public.conferir_eliminados_pre_classificacao(uuid, text[]) is 'Comunicados de eliminação: a situação de agora só dos marcados (chaves vaga|código) e o cargo das vagas deles, em vez de reler a pré-classificação inteira. Cada candidato traz fundamento (item_edital, versao_regra, fonte, conferido_em) só quando o motivo tem fundamento CONFERIDO pelo gestor/coordenador do edital ou administrador global (TH_FUNDAMENTO_ELIMINACAO, 20261110215930); senão nulo. Coordenação do edital.';

-- <<< corpo da migration

-- C. Conferências --------------------------------------------------------------------------------
do $ensaio$
declare
  v_edital uuid;
  v_regra jsonb;
  v_versao integer;
  v_situacao text;
  v_item_da_nota text;
  v_linha record;
  v_master uuid;
  v_chave text;
  v_r json;
  v_c json;
  v_falhou boolean;
begin
  if (select "RETRATO" from "ENSAIO_ANTES") is distinct from pg_temp.ensaio_retrato() then
    raise exception 'ENSAIO REPROVADO: a Triagem gravada mudou (motivos, notas, decisões ou resultados).';
  end if;
  if exists (select 1 from public."TH_FUNDAMENTO_ELIMINACAO") then
    raise exception 'ENSAIO REPROVADO: a migration criou conferência de fundamento.';
  end if;
  if exists (
    select 1 from (select distinct a."CO_MONITORAMENTO" as e, a."CO_MOTIVO_ELIMINACAO" as m
                     from public."TB_PRE_CLASSIFICACAO" a where a."TP_SITUACAO" = 'ELIMINADO') x
     where private."FC_FUNDAMENTO_DA_ELIMINACAO"(x.e, x.m) is not null) then
    raise exception 'ENSAIO REPROVADO: há motivo com fundamento sem conferência.';
  end if;

  -- Edital 114/2026 -------------------------------------------------------------------------
  select m.id into v_edital from public."TB_MONITORAMENTO_INDIGENA" m
   where m.edital ~ '(^|[^0-9])114/2026([^0-9]|$)' order by m.id limit 1;
  if v_edital is null then
    raise notice 'Edital 114/2026 não encontrado: conferências do 114 puladas.';
  else
    select h."DS_CONFIGURACAO", t."NU_VERSAO_VIGENTE", t."TP_SITUACAO" into v_regra, v_versao, v_situacao
      from public."TB_REGRA_TRIAGEM" t
      join public."TH_REGRA_TRIAGEM" h on h."CO_REGRA_TRIAGEM" = t."CO_REGRA_TRIAGEM" and h."NU_VERSAO" = t."NU_VERSAO_VIGENTE"
     where t."CO_MONITORAMENTO" = v_edital;
    v_item_da_nota := nullif(btrim(coalesce(v_regra #>> '{lote,item_edital}', '')), '');
    raise notice '114/2026: regra da Triagem versão % (%), item da nota mínima do lote: %',
      v_versao, v_situacao, coalesce(v_item_da_nota, '(nenhum)');
    for v_linha in
      select e ->> 'codigo' as codigo, e ->> 'motivo' as motivo, coalesce(e ->> 'item_edital', '') as item
        from jsonb_array_elements(coalesce(v_regra #> '{requisitos,eliminacao_automatica}', '[]')) e
    loop
      raise notice '114/2026: motivo da regra % (%): item na regra "%"', v_linha.codigo, v_linha.motivo, v_linha.item;
      if v_item_da_nota is not null and v_linha.item = v_item_da_nota then
        raise notice '114/2026: ATENÇÃO, o motivo % traz na regra o item da nota (%); ele NÃO vira fundamento sem conferência.',
          v_linha.codigo, v_item_da_nota;
      end if;
    end loop;
    for v_linha in
      select a."CO_MOTIVO_ELIMINACAO" as codigo, count(*) as n,
             a."CO_MOTIVO_ELIMINACAO" in ('QUESTIONARIO', 'CANCELADO', 'REPROVADO_EMPREGARE') as administrativo
        from public."TB_PRE_CLASSIFICACAO" a
       where a."CO_MONITORAMENTO" = v_edital and a."TP_SITUACAO" = 'ELIMINADO'
       group by 1 order by 1
    loop
      raise notice '114/2026: eliminados por % = % (%)', v_linha.codigo, v_linha.n,
        case when v_linha.administrativo then 'administrativo' else 'outro motivo' end;
    end loop;
    raise notice '114/2026: fora do lote pela nota (RANQUEADO, sem comunicado de eliminação) = %',
      (select count(*) from public."TB_PRE_CLASSIFICACAO" a
        where a."CO_MONITORAMENTO" = v_edital and a."TP_SITUACAO" = 'RANQUEADO');

    -- Sem sessão não confere.
    perform set_config('request.jwt.claims', '', true);
    perform set_config('request.jwt.claim.sub', '', true);
    v_falhou := false;
    begin
      perform public.conferir_fundamento_da_eliminacao(v_edital, 'QUESTIONARIO', v_versao, '0.0',
        'Ensaio: fonte fictícia do teste', null);
    exception when insufficient_privilege then v_falhou := true;
    end;
    if not v_falhou then
      raise exception 'ENSAIO REPROVADO: conferência sem sessão foi aceita.';
    end if;

    -- Conferência simulada como administrador global (item fictício 0.0; tudo volta no rollback).
    select p.user_id into v_master
      from public."TB_PERFIL_USUARIO" p
      join public."TB_GRUPO_ACESSO" g on g."CO_GRUPO_ACESSO" = p.perfil
     where p.ativo and g."ST_ADMIN_GLOBAL" and p.user_id is not null
     limit 1;
    select a."CO_VAGA" || '|' || c."CO_CANDIDATO_EMPREGARE" into v_chave
      from public."TB_PRE_CLASSIFICACAO" a
      join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
     where a."CO_MONITORAMENTO" = v_edital and a."TP_SITUACAO" = 'ELIMINADO' and a."CO_MOTIVO_ELIMINACAO" = 'QUESTIONARIO'
     limit 1;
    if v_master is null or v_chave is null or v_situacao is distinct from 'CONFERIDA'
       or not exists (select 1 from jsonb_array_elements(coalesce(v_regra #> '{requisitos,eliminacao_automatica}', '[]')) e
                       where e ->> 'codigo' = 'QUESTIONARIO') then
      raise notice '114/2026: sem administrador global, eliminado por QUESTIONARIO, regra conferida ou o motivo na regra: simulação pulada.';
    else
      perform set_config('request.jwt.claims', json_build_object('sub', v_master, 'role', 'authenticated')::text, true);
      perform set_config('request.jwt.claim.sub', v_master::text, true);
      if v_item_da_nota is not null then
        v_falhou := false;
        begin
          perform public.conferir_fundamento_da_eliminacao(v_edital, 'QUESTIONARIO', v_versao, v_item_da_nota,
            'Ensaio: fonte fictícia do teste', null);
        exception when invalid_parameter_value then v_falhou := true;
        end;
        if not v_falhou then
          raise exception 'ENSAIO REPROVADO: o item da nota (%) foi aceito sem justificativa numa eliminação administrativa.',
            v_item_da_nota;
        end if;
      end if;
      v_r := public.conferir_fundamento_da_eliminacao(v_edital, 'QUESTIONARIO', v_versao, '0.0',
        'Ensaio: fonte fictícia do teste', null);
      if (v_r -> 'fundamento' ->> 'situacao') is distinct from 'CONFERIDO' then
        raise exception 'ENSAIO REPROVADO: a conferência simulada não ficou CONFERIDO: %', v_r;
      end if;
      if (select f."TP_PAPEL" from public."TH_FUNDAMENTO_ELIMINACAO" f order by f."CO_HISTORICO" desc limit 1)
           is distinct from 'ADMIN_GLOBAL'
         or (select f."CO_USUARIO" from public."TH_FUNDAMENTO_ELIMINACAO" f order by f."CO_HISTORICO" desc limit 1)
           is distinct from v_master then
        raise exception 'ENSAIO REPROVADO: a auditoria não registrou papel e responsável.';
      end if;
      v_c := public.conferir_eliminados_pre_classificacao(v_edital, array[v_chave]);
      if (v_c -> 'candidatos' -> 0 -> 'fundamento' ->> 'item_edital') is distinct from '0.0' then
        raise exception 'ENSAIO REPROVADO: o fundamento conferido não chegou ao comunicado: %', v_c;
      end if;
      v_falhou := false;
      begin
        update public."TH_FUNDAMENTO_ELIMINACAO" set "DS_ITEM_EDITAL" = '0.1';
      exception when insufficient_privilege then v_falhou := true;
      end;
      if not v_falhou then
        raise exception 'ENSAIO REPROVADO: a conferência gravada foi alterada.';
      end if;
      raise notice '114/2026: conferência simulada ok (item fictício 0.0 até o comunicado; desfeita no rollback).';
    end if;
  end if;

  if (select "RETRATO" from "ENSAIO_ANTES") is distinct from pg_temp.ensaio_retrato() then
    raise exception 'ENSAIO REPROVADO: a Triagem gravada mudou depois da conferência simulada.';
  end if;
  raise notice 'Ensaio 20261110215930 ok';
end;
$ensaio$;

rollback;
