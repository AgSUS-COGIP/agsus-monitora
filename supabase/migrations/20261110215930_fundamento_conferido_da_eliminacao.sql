/*
  FUNDAMENTO NORMATIVO CONFERIDO DA ELIMINAÇÃO NA TRIAGEM (issue #593, continuação do PR #592)

  O PROBLEMA
    O comunicado de eliminação antes da análise documental (PDF da Avaliação
    documental › Triagem › Eliminados) cita o motivo gravado pelo job, mas não
    tinha de onde tirar o item oficial do edital que fundamenta a eliminação. O
    PR #592 deixou o campo item_edital no comunicado, sem nenhuma fonte: hoje
    nenhum comunicado traz fundamento. Presumir o item (por exemplo, o subitem
    8.2.6 do Edital 114/2026, que é o da nota mínima do lote) seria inventar
    fundamento jurídico para eliminações administrativas (QUESTIONARIO,
    CANCELADO, REPROVADO_EMPREGARE), que não decorrem de nota.

  O QUE MUDA
    1. public."TH_FUNDAMENTO_ELIMINACAO": histórico imutável das conferências.
       Cada linha é uma decisão de quem tem a autoridade (gestor ou coordenador
       do edital, por private."FC_GESTOR_DO_EDITAL", ou administrador global, por
       private.is_master()): edital, motivo da eliminação, item oficial do edital,
       fonte (o documento oficial em que o item foi conferido), a versão da regra
       da Triagem e o retrato da entrada do motivo nessa versão, o papel, quem e
       quando. Retificação é uma linha nova com justificativa; nada se altera nem
       se apaga (gatilho; só o reinício do edital de treinamento apaga).
    2. private."FC_FUNDAMENTO_DA_ELIMINACAO"(edital, motivo): o fundamento da
       última conferência, CONFERIDO enquanto a regra da Triagem vigente estiver
       conferida e a entrada do motivo nela for igual à conferida; RECONFERIR
       quando a regra mudou o motivo (ou voltou a "Conferir"); nulo sem conferência.
    3. public.conferir_fundamento_da_eliminacao(...): grava a conferência. Só
       gestor/coordenador do edital ou administrador global (42501 para os demais,
       inclusive coordenador da equipe e analista). Exige a regra da Triagem
       conferida, a versão que a tela mostrou (40001 se mudou), o motivo na regra,
       item no formato "8.2.6" e fonte. Justificativa obrigatória para retificar
       (item ou fonte diferentes da conferência anterior) e para usar o item da
       nota mínima do lote (lote.item_edital da regra) numa eliminação da Triagem.
    4. public.obter_fundamentos_da_eliminacao(edital): o quadro da tela, para a
       coordenação da avaliação (quem emite os comunicados): os motivos da regra
       vigente com quantos eliminados cada um tem, o fundamento de cada um, os
       motivos gravados que não estão na regra, quantos ficaram fora do lote pela
       nota (RANQUEADO: não são eliminados e não recebem comunicado), o histórico
       e se a pessoa pode conferir.
    5. public.conferir_eliminados_pre_classificacao: mesmo corpo, com o campo
       "fundamento" em cada candidato (só o CONFERIDO; senão nulo). É daí que o
       PDF tira o item_edital.

  O QUE NÃO MUDA (de propósito)
    - Nenhum motivo, nota, situação, decisão, lote ou resultado. TB_PRE_CLASSIFICACAO,
      TH_PRE_CLASSIFICACAO, as regras e as listas não são tocadas (o ensaio confere).
    - Nenhum fundamento é criado aqui: a migration não escolhe item para ninguém.

  GUARDAS
    - Já aplicada (TH_FUNDAMENTO_ELIMINACAO existe).
    - Dependências ausentes.
    - conferir_eliminados_pre_classificacao, FC_GESTOR_DO_EDITAL ou
      FC_EXIGIR_COORD_AVALIACAO diferentes do retrato de 10/11/2026 (md5 do corpo):
      junte as mudanças antes de aplicar.

  Ensaio:   supabase/ensaios/20261110215930_fundamento_conferido_da_eliminacao.sql
  Rollback: supabase/rollback/20261110215930_fundamento_conferido_da_eliminacao.sql
  Testes:   tests/fundamento-da-eliminacao-no-banco.test.ts (PGlite: permissões de
            gestor, coordenador, administrador global, coordenador da equipe e
            analista; auditoria; retificação; comunicado; rollback) e
            tests/lib/fundamento-da-eliminacao.test.ts.
*/
begin;

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

commit;
