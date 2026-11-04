-- ENSAIO de supabase/migrations/20261104120000_cronograma_demandas_internas.sql: roda o corpo e desfaz (rollback).
-- Como administrador global, Gestor só da Saúde Indígena e pessoa comum da Saúde Indígena: criar,
-- editar, concluir, reabrir e excluir demandas internas; as recusas (outra área, período invertido,
-- título curto, responsável sem acesso, edital de outra área); o que cada um vê na lista; os
-- responsáveis pelo edital; o histórico gravado e os privilégios. Sem carga em lote: só as poucas
-- linhas das chamadas, desfeitas no fim. O resultado (json) traz só números, códigos e verdadeiro/falso.
begin;

set local statement_timeout = '60s';

-- ═══ CORPO DA MIGRATION (início) ═══

set local lock_timeout = '5s';

-- 0. Pré-requisitos ---------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('private.is_master()') is null
     or to_regprocedure('private.pode_recurso(text, integer)') is null
     or to_regprocedure('private."FC_PODE_AREA"(text)') is null
     or to_regprocedure('private."FC_PODE_VER_EDITAL"(uuid)') is null
     or to_regprocedure('private."FC_AREAS_USUARIO"()') is null
     or to_regprocedure('private."FC_AREAS_DO_PERFIL"(uuid)') is null
     or to_regprocedure('private."FC_PERFIL_VE_EDITAL"(uuid, uuid)') is null
     or to_regprocedure('private."FC_NOME_USUARIO"(uuid)') is null
     or to_regprocedure('private.current_profile()') is null then
    raise exception 'Faltam as funções de permissão (is_master, pode_recurso, FC_PODE_AREA, FC_PODE_VER_EDITAL, FC_AREAS_*, FC_PERFIL_VE_EDITAL, FC_NOME_USUARIO).';
  end if;
  if to_regclass('public."TB_AREA"') is null
     or to_regclass('public."TB_MONITORAMENTO_INDIGENA"') is null
     or to_regclass('public."TB_CRONOGRAMA_MONIT_INDIG"') is null
     or to_regclass('public."TB_PERFIL_USUARIO"') is null then
    raise exception 'Faltam TB_AREA, TB_MONITORAMENTO_INDIGENA, TB_CRONOGRAMA_MONIT_INDIG ou TB_PERFIL_USUARIO.';
  end if;
end;
$$;

-- 1. Demandas internas -------------------------------------------------------------------------
create table public."TB_DEMANDA_INTERNA" (
  "CO_DEMANDA_INTERNA" uuid not null default gen_random_uuid(),
  "CO_AREA" text not null,
  "CO_MONITORAMENTO" uuid,
  "NO_DEMANDA" character varying(200) not null,
  "DS_DEMANDA" character varying(2000),
  "DT_INICIO" date not null,
  "DT_FIM" date not null,
  "ST_CONCLUIDA" character varying(1) not null default 'N',
  "DT_CONCLUSAO" timestamptz,
  "CO_USUARIO_CONCLUSAO" uuid,
  "ST_ATIVO" character varying(1) not null default 'S',
  "CO_USUARIO_CRIACAO" uuid,
  "DT_CRIACAO" timestamptz not null default now(),
  "CO_USUARIO_ATUALIZACAO" uuid,
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_DEMANDA_INTERNA" primary key ("CO_DEMANDA_INTERNA"),
  constraint "FK_AREA_DEMANDAINTERNA" foreign key ("CO_AREA") references public."TB_AREA" ("CO_AREA"),
  constraint "FK_MONITORAMENTO_DEMANDAINTERNA" foreign key ("CO_MONITORAMENTO")
    references public."TB_MONITORAMENTO_INDIGENA" (id) on delete set null,
  constraint "CK_DEMANDAINTERNA_NODEMANDA" check (length(btrim("NO_DEMANDA")) between 3 and 200),
  constraint "CK_DEMANDAINTERNA_PERIODO" check ("DT_FIM" >= "DT_INICIO"),
  constraint "CK_DEMANDAINTERNA_STCONCLUIDA" check ("ST_CONCLUIDA" in ('S', 'N')),
  constraint "CK_DEMANDAINTERNA_CONCLUSAO" check (("ST_CONCLUIDA" = 'S') = ("DT_CONCLUSAO" is not null)),
  constraint "CK_DEMANDAINTERNA_STATIVO" check ("ST_ATIVO" in ('S', 'N'))
);
comment on table public."TB_DEMANDA_INTERNA" is
  'Demandas internas do Cronograma (20261104120000): itens próprios da equipe, por área e opcionalmente ligados a um edital. Escrita só por salvar_demanda_interna, concluir_demanda_interna e excluir_demanda_interna; cada mudança em TH_DEMANDA_INTERNA.';
comment on column public."TB_DEMANDA_INTERNA"."CO_DEMANDA_INTERNA" is 'Identificador da demanda.';
comment on column public."TB_DEMANDA_INTERNA"."CO_AREA" is 'Área dona da demanda (TB_AREA).';
comment on column public."TB_DEMANDA_INTERNA"."CO_MONITORAMENTO" is 'Edital ligado (TB_MONITORAMENTO_INDIGENA.id), opcional; da mesma área.';
comment on column public."TB_DEMANDA_INTERNA"."NO_DEMANDA" is 'Título (3 a 200 caracteres).';
comment on column public."TB_DEMANDA_INTERNA"."DS_DEMANDA" is 'Descrição, opcional.';
comment on column public."TB_DEMANDA_INTERNA"."DT_INICIO" is 'Primeiro dia (data única: início = fim).';
comment on column public."TB_DEMANDA_INTERNA"."DT_FIM" is 'Último dia; não concluída com fim no passado = atrasada.';
comment on column public."TB_DEMANDA_INTERNA"."ST_CONCLUIDA" is 'S = concluída; N = em aberto.';
comment on column public."TB_DEMANDA_INTERNA"."DT_CONCLUSAO" is 'Quando foi concluída (nulo se em aberto).';
comment on column public."TB_DEMANDA_INTERNA"."CO_USUARIO_CONCLUSAO" is 'Quem concluiu (auth.users.id).';
comment on column public."TB_DEMANDA_INTERNA"."ST_ATIVO" is 'S = vale; N = excluída (exclusão lógica).';
comment on column public."TB_DEMANDA_INTERNA"."CO_USUARIO_CRIACAO" is 'Quem criou (auth.users.id).';
comment on column public."TB_DEMANDA_INTERNA"."DT_CRIACAO" is 'Quando foi criada.';
comment on column public."TB_DEMANDA_INTERNA"."CO_USUARIO_ATUALIZACAO" is 'Quem fez a última mudança (auth.users.id).';
comment on column public."TB_DEMANDA_INTERNA"."DT_ATUALIZACAO" is 'Última mudança.';
comment on constraint "PK_TB_DEMANDA_INTERNA" on public."TB_DEMANDA_INTERNA" is 'Identificador da demanda.';
comment on constraint "FK_AREA_DEMANDAINTERNA" on public."TB_DEMANDA_INTERNA" is 'Área da demanda.';
comment on constraint "FK_MONITORAMENTO_DEMANDAINTERNA" on public."TB_DEMANDA_INTERNA" is 'Edital ligado; se o edital for apagado, a demanda fica sem edital.';
comment on constraint "CK_DEMANDAINTERNA_NODEMANDA" on public."TB_DEMANDA_INTERNA" is 'Título de 3 a 200 caracteres.';
comment on constraint "CK_DEMANDAINTERNA_PERIODO" on public."TB_DEMANDA_INTERNA" is 'Fim no início ou depois.';
comment on constraint "CK_DEMANDAINTERNA_STCONCLUIDA" on public."TB_DEMANDA_INTERNA" is 'S ou N.';
comment on constraint "CK_DEMANDAINTERNA_CONCLUSAO" on public."TB_DEMANDA_INTERNA" is 'Concluída tem data de conclusão; em aberto, não.';
comment on constraint "CK_DEMANDAINTERNA_STATIVO" on public."TB_DEMANDA_INTERNA" is 'S ou N.';
create index "IN_DEMANDAINTERNA_AREA_FIM" on public."TB_DEMANDA_INTERNA" ("CO_AREA", "DT_FIM") where "ST_ATIVO" = 'S';
comment on index public."IN_DEMANDAINTERNA_AREA_FIM" is 'Demandas ativas por área e fim (Cronograma).';
create index "IN_FKDEMANDAINTERNA_MONITORAMENTO" on public."TB_DEMANDA_INTERNA" ("CO_MONITORAMENTO") where "CO_MONITORAMENTO" is not null;
comment on index public."IN_FKDEMANDAINTERNA_MONITORAMENTO" is 'Demandas de um edital (e a FK).';
alter table public."TB_DEMANDA_INTERNA" enable row level security;
revoke all on public."TB_DEMANDA_INTERNA" from public, anon, authenticated, service_role;

create table public."RL_DEMANDA_INTERNA_RESPONSAVEL" (
  "CO_DEMANDA_INTERNA" uuid not null,
  "CO_PERFIL_USUARIO" uuid not null,
  "CO_USUARIO_INCLUSAO" uuid,
  "DT_INCLUSAO" timestamptz not null default now(),
  constraint "PK_RL_DEMANDA_INTERNA_RESPONSAVEL" primary key ("CO_DEMANDA_INTERNA", "CO_PERFIL_USUARIO"),
  constraint "FK_DEMANDAINTERNA_RLDEMANDARESP" foreign key ("CO_DEMANDA_INTERNA")
    references public."TB_DEMANDA_INTERNA" ("CO_DEMANDA_INTERNA") on delete cascade,
  constraint "FK_PERFILUSUARIO_RLDEMANDARESP" foreign key ("CO_PERFIL_USUARIO")
    references public."TB_PERFIL_USUARIO" (id) on delete cascade
);
comment on table public."RL_DEMANDA_INTERNA_RESPONSAVEL" is
  'Responsáveis de cada demanda interna (20261104120000): perfis do sistema com acesso à área (e ao edital, se houver).';
comment on column public."RL_DEMANDA_INTERNA_RESPONSAVEL"."CO_DEMANDA_INTERNA" is 'Demanda (TB_DEMANDA_INTERNA).';
comment on column public."RL_DEMANDA_INTERNA_RESPONSAVEL"."CO_PERFIL_USUARIO" is 'Responsável (TB_PERFIL_USUARIO.id).';
comment on column public."RL_DEMANDA_INTERNA_RESPONSAVEL"."CO_USUARIO_INCLUSAO" is 'Quem incluiu (auth.users.id).';
comment on column public."RL_DEMANDA_INTERNA_RESPONSAVEL"."DT_INCLUSAO" is 'Quando foi incluído.';
comment on constraint "PK_RL_DEMANDA_INTERNA_RESPONSAVEL" on public."RL_DEMANDA_INTERNA_RESPONSAVEL" is 'Uma pessoa uma vez por demanda.';
comment on constraint "FK_DEMANDAINTERNA_RLDEMANDARESP" on public."RL_DEMANDA_INTERNA_RESPONSAVEL" is 'Demanda do vínculo.';
comment on constraint "FK_PERFILUSUARIO_RLDEMANDARESP" on public."RL_DEMANDA_INTERNA_RESPONSAVEL" is 'Perfil do responsável; sai junto se o perfil for apagado.';
create index "IN_FKRLDEMANDARESP_PERFIL" on public."RL_DEMANDA_INTERNA_RESPONSAVEL" ("CO_PERFIL_USUARIO");
comment on index public."IN_FKRLDEMANDARESP_PERFIL" is 'Demandas de uma pessoa (e a FK).';
alter table public."RL_DEMANDA_INTERNA_RESPONSAVEL" enable row level security;
revoke all on public."RL_DEMANDA_INTERNA_RESPONSAVEL" from public, anon, authenticated, service_role;

create table public."TH_DEMANDA_INTERNA" (
  "CO_EVENTO" bigint generated always as identity,
  "CO_DEMANDA_INTERNA" uuid not null,
  "TP_ACAO" character varying(12) not null,
  "DS_ANTES" jsonb,
  "DS_DEPOIS" jsonb not null,
  "CO_USUARIO" uuid,
  "DT_EVENTO" timestamptz not null default now(),
  constraint "PK_TH_DEMANDA_INTERNA" primary key ("CO_EVENTO"),
  constraint "FK_DEMANDAINTERNA_THDEMANDAINTERNA" foreign key ("CO_DEMANDA_INTERNA")
    references public."TB_DEMANDA_INTERNA" ("CO_DEMANDA_INTERNA"),
  constraint "CK_THDEMANDAINTERNA_TPACAO" check ("TP_ACAO" in ('CRIACAO', 'EDICAO', 'CONCLUSAO', 'REABERTURA', 'EXCLUSAO'))
);
comment on table public."TH_DEMANDA_INTERNA" is
  'Histórico das demandas internas (20261104120000): cada criação, edição, conclusão, reabertura e exclusão, com antes/depois, quem e quando. Só cresce.';
comment on column public."TH_DEMANDA_INTERNA"."CO_EVENTO" is 'Identificador do evento (sequencial).';
comment on column public."TH_DEMANDA_INTERNA"."CO_DEMANDA_INTERNA" is 'Demanda (TB_DEMANDA_INTERNA).';
comment on column public."TH_DEMANDA_INTERNA"."TP_ACAO" is 'CRIACAO, EDICAO, CONCLUSAO, REABERTURA ou EXCLUSAO.';
comment on column public."TH_DEMANDA_INTERNA"."DS_ANTES" is 'A demanda antes (json, com responsáveis); nulo na criação.';
comment on column public."TH_DEMANDA_INTERNA"."DS_DEPOIS" is 'A demanda depois (json, com responsáveis).';
comment on column public."TH_DEMANDA_INTERNA"."CO_USUARIO" is 'Quem fez (auth.users.id).';
comment on column public."TH_DEMANDA_INTERNA"."DT_EVENTO" is 'Quando aconteceu.';
comment on constraint "PK_TH_DEMANDA_INTERNA" on public."TH_DEMANDA_INTERNA" is 'Um evento por linha.';
comment on constraint "FK_DEMANDAINTERNA_THDEMANDAINTERNA" on public."TH_DEMANDA_INTERNA" is 'Demanda do evento (a demanda nunca é apagada de fato).';
comment on constraint "CK_THDEMANDAINTERNA_TPACAO" on public."TH_DEMANDA_INTERNA" is 'Ações válidas.';
create index "IN_FKTHDEMANDAINTERNA_DEMANDA" on public."TH_DEMANDA_INTERNA" ("CO_DEMANDA_INTERNA", "DT_EVENTO" desc);
comment on index public."IN_FKTHDEMANDAINTERNA_DEMANDA" is 'Histórico de uma demanda, do mais novo ao mais antigo (e a FK).';
alter table public."TH_DEMANDA_INTERNA" enable row level security;
revoke all on public."TH_DEMANDA_INTERNA" from public, anon, authenticated, service_role;

-- 2. Responsáveis pelo edital ------------------------------------
create table public."RL_RESPONSAVEL_EDITAL" (
  "CO_MONITORAMENTO" uuid not null,
  "CO_PERFIL_USUARIO" uuid not null,
  "CO_USUARIO_INCLUSAO" uuid,
  "DT_INCLUSAO" timestamptz not null default now(),
  constraint "PK_RL_RESPONSAVEL_EDITAL" primary key ("CO_MONITORAMENTO", "CO_PERFIL_USUARIO"),
  constraint "FK_MONITORAMENTO_RLRESPEDITAL" foreign key ("CO_MONITORAMENTO")
    references public."TB_MONITORAMENTO_INDIGENA" (id) on delete cascade,
  constraint "FK_PERFILUSUARIO_RLRESPEDITAL" foreign key ("CO_PERFIL_USUARIO")
    references public."TB_PERFIL_USUARIO" (id) on delete cascade
);
comment on table public."RL_RESPONSAVEL_EDITAL" is
  'Responsáveis pelo edital (20261104120000): pessoas do sistema que veem o edital. Não substitui a coluna legada TB_MONITORAMENTO_INDIGENA.responsavel (USI/CORES). Escrita só por salvar_responsaveis_do_edital.';
comment on column public."RL_RESPONSAVEL_EDITAL"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA.id).';
comment on column public."RL_RESPONSAVEL_EDITAL"."CO_PERFIL_USUARIO" is 'Responsável (TB_PERFIL_USUARIO.id).';
comment on column public."RL_RESPONSAVEL_EDITAL"."CO_USUARIO_INCLUSAO" is 'Quem incluiu (auth.users.id).';
comment on column public."RL_RESPONSAVEL_EDITAL"."DT_INCLUSAO" is 'Quando foi incluído.';
comment on constraint "PK_RL_RESPONSAVEL_EDITAL" on public."RL_RESPONSAVEL_EDITAL" is 'Uma pessoa uma vez por edital.';
comment on constraint "FK_MONITORAMENTO_RLRESPEDITAL" on public."RL_RESPONSAVEL_EDITAL" is 'Edital do vínculo; sai junto se o edital for apagado.';
comment on constraint "FK_PERFILUSUARIO_RLRESPEDITAL" on public."RL_RESPONSAVEL_EDITAL" is 'Perfil do responsável; sai junto se o perfil for apagado.';
create index "IN_FKRLRESPEDITAL_PERFIL" on public."RL_RESPONSAVEL_EDITAL" ("CO_PERFIL_USUARIO");
comment on index public."IN_FKRLRESPEDITAL_PERFIL" is 'Editais de uma pessoa (e a FK).';
alter table public."RL_RESPONSAVEL_EDITAL" enable row level security;
revoke all on public."RL_RESPONSAVEL_EDITAL" from public, anon, authenticated, service_role;

create table public."TH_RESPONSAVEL_EDITAL" (
  "CO_EVENTO" bigint generated always as identity,
  "CO_MONITORAMENTO" uuid not null,
  "DS_ANTES" jsonb not null,
  "DS_DEPOIS" jsonb not null,
  "CO_USUARIO" uuid,
  "DT_EVENTO" timestamptz not null default now(),
  constraint "PK_TH_RESPONSAVEL_EDITAL" primary key ("CO_EVENTO")
);
comment on table public."TH_RESPONSAVEL_EDITAL" is
  'Histórico dos responsáveis pelo edital (20261104120000): antes/depois, quem e quando. Sem FK para o edital: o histórico fica mesmo se o edital for apagado. Só cresce.';
comment on column public."TH_RESPONSAVEL_EDITAL"."CO_EVENTO" is 'Identificador do evento (sequencial).';
comment on column public."TH_RESPONSAVEL_EDITAL"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA.id).';
comment on column public."TH_RESPONSAVEL_EDITAL"."DS_ANTES" is 'Antes: {responsaveis: [{id, nome}]}.';
comment on column public."TH_RESPONSAVEL_EDITAL"."DS_DEPOIS" is 'Depois, no mesmo formato.';
comment on column public."TH_RESPONSAVEL_EDITAL"."CO_USUARIO" is 'Quem fez (auth.users.id).';
comment on column public."TH_RESPONSAVEL_EDITAL"."DT_EVENTO" is 'Quando aconteceu.';
comment on constraint "PK_TH_RESPONSAVEL_EDITAL" on public."TH_RESPONSAVEL_EDITAL" is 'Um evento por linha.';
create index "IN_THRESPEDITAL_MONITORAMENTO" on public."TH_RESPONSAVEL_EDITAL" ("CO_MONITORAMENTO", "DT_EVENTO" desc);
comment on index public."IN_THRESPEDITAL_MONITORAMENTO" is 'Histórico de um edital, do mais novo ao mais antigo.';
alter table public."TH_RESPONSAVEL_EDITAL" enable row level security;
revoke all on public."TH_RESPONSAVEL_EDITAL" from public, anon, authenticated, service_role;

-- 3. Permissões ---------------------------------------------------------------------------------
create function private."FC_PODE_EDITAR_CRONOGRAMA_AREA"(p_area text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select private.is_master()
      or ((private.pode_recurso('calendario', 2) or private.pode_recurso('nucleo', 2))
          and private."FC_PODE_AREA"(p_area));
$function$;
comment on function private."FC_PODE_EDITAR_CRONOGRAMA_AREA"(text) is
  'Quem lê pode criar/editar demandas internas e responsáveis do edital na área: administrador global; ou editor em calendario/nucleo com acesso à área. 20261104120000.';
revoke all on function private."FC_PODE_EDITAR_CRONOGRAMA_AREA"(text) from public, anon, authenticated, service_role;

create function private."FC_PODE_VER_DEMANDA"(p_area text, p_edital uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select private.is_master()
      or (private.pode_recurso('calendario', 1)
          and private."FC_PODE_AREA"(p_area)
          and (p_edital is null or private."FC_PODE_VER_EDITAL"(p_edital)));
$function$;
comment on function private."FC_PODE_VER_DEMANDA"(text, uuid) is
  'Quem lê vê a demanda interna: administrador global; ou leitor em calendario com acesso à área e, se houver, ao edital. 20261104120000.';
revoke all on function private."FC_PODE_VER_DEMANDA"(text, uuid) from public, anon, authenticated, service_role;

create function private."FC_PODE_EDITAR_DEMANDA"(p_area text, p_edital uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select private.is_master()
      or (private."FC_PODE_EDITAR_CRONOGRAMA_AREA"(p_area)
          and (p_edital is null or private."FC_PODE_VER_EDITAL"(p_edital)));
$function$;
comment on function private."FC_PODE_EDITAR_DEMANDA"(text, uuid) is
  'Quem lê edita a demanda interna: administrador global; ou editor da área que também vê o edital ligado. 20261104120000.';
revoke all on function private."FC_PODE_EDITAR_DEMANDA"(text, uuid) from public, anon, authenticated, service_role;

create function private."FC_PERFIL_PODE_SER_RESPONSAVEL"(p_perfil uuid, p_area text, p_edital uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public."TB_PERFIL_USUARIO" u
     where u.id = p_perfil and u.ativo
       and p_area = any (coalesce(private."FC_AREAS_DO_PERFIL"(u.id), '{}'))
       and (p_edital is null or private."FC_PERFIL_VE_EDITAL"(u.id, p_edital)));
$function$;
comment on function private."FC_PERFIL_PODE_SER_RESPONSAVEL"(uuid, text, uuid) is
  'O perfil está ativo e vê a área (e o edital, se houver): pode ser responsável. 20261104120000.';
revoke all on function private."FC_PERFIL_PODE_SER_RESPONSAVEL"(uuid, text, uuid) from public, anon, authenticated, service_role;

-- 4. Leitura de uma demanda (json) -------------------------------------------------------------
create function private."FC_DEMANDA_INTERNA_JSON"(p_demanda uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'id', d."CO_DEMANDA_INTERNA",
    'area', d."CO_AREA",
    'edital_id', d."CO_MONITORAMENTO",
    'edital', m.edital,
    'unidade', m.unidade,
    'titulo', d."NO_DEMANDA",
    'descricao', d."DS_DEMANDA",
    'data_inicio', d."DT_INICIO",
    'data_fim', d."DT_FIM",
    'concluida', d."ST_CONCLUIDA" = 'S',
    'concluida_em', d."DT_CONCLUSAO",
    'concluida_por', private."FC_NOME_USUARIO"(d."CO_USUARIO_CONCLUSAO"),
    'ativo', d."ST_ATIVO" = 'S',
    'criada_em', d."DT_CRIACAO",
    'criada_por', private."FC_NOME_USUARIO"(d."CO_USUARIO_CRIACAO"),
    'atualizada_em', d."DT_ATUALIZACAO",
    'atualizada_por', private."FC_NOME_USUARIO"(d."CO_USUARIO_ATUALIZACAO"),
    'responsaveis', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', u.id,
               'nome', coalesce(nullif(btrim(u.nome), ''), u.email))
             order by coalesce(nullif(btrim(u.nome), ''), u.email))
        from public."RL_DEMANDA_INTERNA_RESPONSAVEL" r
        join public."TB_PERFIL_USUARIO" u on u.id = r."CO_PERFIL_USUARIO"
       where r."CO_DEMANDA_INTERNA" = d."CO_DEMANDA_INTERNA"), '[]'::jsonb))
  from public."TB_DEMANDA_INTERNA" d
  left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = d."CO_MONITORAMENTO"
  where d."CO_DEMANDA_INTERNA" = p_demanda;
$function$;
comment on function private."FC_DEMANDA_INTERNA_JSON"(uuid) is
  'A demanda interna em json (com edital e responsáveis), para as RPCs e o histórico. 20261104120000.';
revoke all on function private."FC_DEMANDA_INTERNA_JSON"(uuid) from public, anon, authenticated, service_role;

-- 5. RPCs das demandas internas ---------------------------------------------------------------
create function public.listar_demandas_internas()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Sessão não localizada.' using errcode = '28000';
  end if;

  return jsonb_build_object(
    'pode_criar_em', coalesce((
      select jsonb_agg(a."CO_AREA" order by a."NU_ORDEM")
        from public."TB_AREA" a
       where private."FC_PODE_EDITAR_CRONOGRAMA_AREA"(a."CO_AREA")), '[]'::jsonb),
    'demandas', coalesce((
      select jsonb_agg(
               private."FC_DEMANDA_INTERNA_JSON"(d."CO_DEMANDA_INTERNA")
               || jsonb_build_object('pode_editar',
                    private."FC_PODE_EDITAR_DEMANDA"(d."CO_AREA", d."CO_MONITORAMENTO"))
             order by d."DT_INICIO", d."NO_DEMANDA")
        from public."TB_DEMANDA_INTERNA" d
       where d."ST_ATIVO" = 'S'
         and private."FC_PODE_VER_DEMANDA"(d."CO_AREA", d."CO_MONITORAMENTO")), '[]'::jsonb));
end;
$function$;
comment on function public.listar_demandas_internas() is
  'Demandas internas ativas que quem lê vê, com responsáveis e pode_editar, e as áreas onde pode criar (pode_criar_em). Tela Cronograma. 20261104120000.';
revoke all on function public.listar_demandas_internas() from public, anon;
grant execute on function public.listar_demandas_internas() to authenticated;

create function public.salvar_demanda_interna(p_demanda jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
set lock_timeout to '5s'
as $function$
declare
  v_usuario uuid := (select auth.uid());
  v_id uuid;
  v_area text;
  v_edital uuid;
  v_titulo text;
  v_descricao text;
  v_inicio date;
  v_fim date;
  v_responsaveis uuid[];
  v_atual public."TB_DEMANDA_INTERNA";
  v_antes jsonb;
  v_depois jsonb;
begin
  if v_usuario is null then
    raise exception 'Sessão não localizada.' using errcode = '28000';
  end if;
  if jsonb_typeof(p_demanda) is distinct from 'object' then
    raise exception 'Demanda inválida.' using errcode = '22023';
  end if;
  if p_demanda ? 'responsaveis' and jsonb_typeof(p_demanda -> 'responsaveis') not in ('array', 'null') then
    raise exception 'Responsáveis inválidos.' using errcode = '22023';
  end if;

  begin
    v_id := nullif(btrim(p_demanda ->> 'id'), '')::uuid;
    v_edital := nullif(btrim(p_demanda ->> 'edital_id'), '')::uuid;
    v_inicio := nullif(btrim(p_demanda ->> 'data_inicio'), '')::date;
    v_fim := coalesce(nullif(btrim(p_demanda ->> 'data_fim'), '')::date, v_inicio);
    select coalesce(array_agg(distinct x::uuid), '{}')
      into v_responsaveis
      from jsonb_array_elements_text(
             case when jsonb_typeof(p_demanda -> 'responsaveis') = 'array'
                  then p_demanda -> 'responsaveis' else '[]'::jsonb end) x;
  exception when invalid_text_representation or invalid_datetime_format
                 or datetime_field_overflow then
    raise exception 'Demanda com campo inválido (id, edital, data ou responsável).' using errcode = '22023';
  end;

  v_area := nullif(btrim(p_demanda ->> 'area'), '');
  v_titulo := nullif(btrim(regexp_replace(coalesce(p_demanda ->> 'titulo', ''), '\s+', ' ', 'g')), '');
  v_descricao := nullif(btrim(p_demanda ->> 'descricao'), '');

  if v_area is null or not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
    raise exception 'Informe a área da demanda.' using errcode = '22023';
  end if;
  if v_titulo is null or length(v_titulo) < 3 or length(v_titulo) > 200 then
    raise exception 'O título precisa ter de 3 a 200 caracteres.' using errcode = '22023';
  end if;
  if length(coalesce(v_descricao, '')) > 2000 then
    raise exception 'A descrição pode ter até 2.000 caracteres.' using errcode = '22023';
  end if;
  if v_inicio is null then
    raise exception 'Informe a data da demanda.' using errcode = '22023';
  end if;
  if v_fim < v_inicio then
    raise exception 'O fim não pode ser antes do início.' using errcode = '22023';
  end if;
  if v_inicio < date '2020-01-01' or v_fim > date '2100-12-31' then
    raise exception 'Data fora do intervalo aceito.' using errcode = '22023';
  end if;
  if cardinality(v_responsaveis) > 20 then
    raise exception 'No máximo 20 responsáveis.' using errcode = '22023';
  end if;

  if not private."FC_PODE_EDITAR_CRONOGRAMA_AREA"(v_area) then
    raise exception 'Sem permissão para demandas desta área.' using errcode = '42501';
  end if;
  if v_edital is not null then
    if not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m
                    where m.id = v_edital and m."CO_AREA" = v_area) then
      raise exception 'O edital não é desta área.' using errcode = '22023';
    end if;
    if not private."FC_PODE_EDITAR_DEMANDA"(v_area, v_edital) then
      raise exception 'Sem acesso a este edital.' using errcode = '42501';
    end if;
  end if;

  if v_id is not null then
    select * into v_atual from public."TB_DEMANDA_INTERNA" d
     where d."CO_DEMANDA_INTERNA" = v_id for update;
    if v_atual."CO_DEMANDA_INTERNA" is null or v_atual."ST_ATIVO" <> 'S' then
      raise exception 'Demanda não encontrada.' using errcode = 'P0002';
    end if;
    if not private."FC_PODE_EDITAR_DEMANDA"(v_atual."CO_AREA", v_atual."CO_MONITORAMENTO") then
      raise exception 'Sem permissão para esta demanda.' using errcode = '42501';
    end if;
    v_antes := private."FC_DEMANDA_INTERNA_JSON"(v_id);
  end if;

  if exists (select 1 from unnest(v_responsaveis) r
              where not private."FC_PERFIL_PODE_SER_RESPONSAVEL"(r, v_area, v_edital)) then
    raise exception 'Há responsável sem acesso à área ou ao edital da demanda.' using errcode = '22023';
  end if;

  if v_id is null then
    insert into public."TB_DEMANDA_INTERNA" (
      "CO_AREA", "CO_MONITORAMENTO", "NO_DEMANDA", "DS_DEMANDA", "DT_INICIO", "DT_FIM",
      "CO_USUARIO_CRIACAO", "CO_USUARIO_ATUALIZACAO")
    values (v_area, v_edital, v_titulo, v_descricao, v_inicio, v_fim, v_usuario, v_usuario)
    returning "CO_DEMANDA_INTERNA" into v_id;
  else
    update public."TB_DEMANDA_INTERNA" d
       set "CO_AREA" = v_area,
           "CO_MONITORAMENTO" = v_edital,
           "NO_DEMANDA" = v_titulo,
           "DS_DEMANDA" = v_descricao,
           "DT_INICIO" = v_inicio,
           "DT_FIM" = v_fim,
           "CO_USUARIO_ATUALIZACAO" = v_usuario,
           "DT_ATUALIZACAO" = now()
     where d."CO_DEMANDA_INTERNA" = v_id;
  end if;

  delete from public."RL_DEMANDA_INTERNA_RESPONSAVEL" r
   where r."CO_DEMANDA_INTERNA" = v_id and not (r."CO_PERFIL_USUARIO" = any (v_responsaveis));
  insert into public."RL_DEMANDA_INTERNA_RESPONSAVEL" ("CO_DEMANDA_INTERNA", "CO_PERFIL_USUARIO", "CO_USUARIO_INCLUSAO")
  select v_id, r, v_usuario from unnest(v_responsaveis) r
  on conflict do nothing;

  v_depois := private."FC_DEMANDA_INTERNA_JSON"(v_id);
  if v_antes is null or v_antes is distinct from v_depois then
    insert into public."TH_DEMANDA_INTERNA" ("CO_DEMANDA_INTERNA", "TP_ACAO", "DS_ANTES", "DS_DEPOIS", "CO_USUARIO")
    values (v_id, case when v_antes is null then 'CRIACAO' else 'EDICAO' end, v_antes, v_depois, v_usuario);
  end if;

  return v_depois || jsonb_build_object('pode_editar', true);
end;
$function$;
comment on function public.salvar_demanda_interna(jsonb) is
  'Cria (sem id) ou edita uma demanda interna: {id?, area, edital_id?, titulo, descricao?, data_inicio, data_fim?, responsaveis: [perfil]}. Gestor da área ou administrador global; grava TH_DEMANDA_INTERNA. 20261104120000.';
revoke all on function public.salvar_demanda_interna(jsonb) from public, anon;
grant execute on function public.salvar_demanda_interna(jsonb) to authenticated;

create function public.concluir_demanda_interna(p_id uuid, p_concluida boolean default true)
returns jsonb
language plpgsql
security definer
set search_path to ''
set lock_timeout to '5s'
as $function$
declare
  v_usuario uuid := (select auth.uid());
  v_atual public."TB_DEMANDA_INTERNA";
  v_antes jsonb;
  v_depois jsonb;
  v_concluir boolean := coalesce(p_concluida, true);
begin
  if v_usuario is null then
    raise exception 'Sessão não localizada.' using errcode = '28000';
  end if;
  select * into v_atual from public."TB_DEMANDA_INTERNA" d
   where d."CO_DEMANDA_INTERNA" = p_id for update;
  if v_atual."CO_DEMANDA_INTERNA" is null or v_atual."ST_ATIVO" <> 'S' then
    raise exception 'Demanda não encontrada.' using errcode = 'P0002';
  end if;
  if not private."FC_PODE_EDITAR_DEMANDA"(v_atual."CO_AREA", v_atual."CO_MONITORAMENTO") then
    raise exception 'Sem permissão para esta demanda.' using errcode = '42501';
  end if;

  if (v_atual."ST_CONCLUIDA" = 'S') = v_concluir then
    return private."FC_DEMANDA_INTERNA_JSON"(p_id) || jsonb_build_object('pode_editar', true);
  end if;

  v_antes := private."FC_DEMANDA_INTERNA_JSON"(p_id);
  update public."TB_DEMANDA_INTERNA" d
     set "ST_CONCLUIDA" = case when v_concluir then 'S' else 'N' end,
         "DT_CONCLUSAO" = case when v_concluir then now() end,
         "CO_USUARIO_CONCLUSAO" = case when v_concluir then v_usuario end,
         "CO_USUARIO_ATUALIZACAO" = v_usuario,
         "DT_ATUALIZACAO" = now()
   where d."CO_DEMANDA_INTERNA" = p_id;
  v_depois := private."FC_DEMANDA_INTERNA_JSON"(p_id);
  insert into public."TH_DEMANDA_INTERNA" ("CO_DEMANDA_INTERNA", "TP_ACAO", "DS_ANTES", "DS_DEPOIS", "CO_USUARIO")
  values (p_id, case when v_concluir then 'CONCLUSAO' else 'REABERTURA' end, v_antes, v_depois, v_usuario);

  return v_depois || jsonb_build_object('pode_editar', true);
end;
$function$;
comment on function public.concluir_demanda_interna(uuid, boolean) is
  'Conclui (true) ou reabre (false) uma demanda interna, com quem e quando. Gestor da área ou administrador global; grava TH_DEMANDA_INTERNA. 20261104120000.';
revoke all on function public.concluir_demanda_interna(uuid, boolean) from public, anon;
grant execute on function public.concluir_demanda_interna(uuid, boolean) to authenticated;

create function public.excluir_demanda_interna(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
set lock_timeout to '5s'
as $function$
declare
  v_usuario uuid := (select auth.uid());
  v_atual public."TB_DEMANDA_INTERNA";
  v_antes jsonb;
begin
  if v_usuario is null then
    raise exception 'Sessão não localizada.' using errcode = '28000';
  end if;
  select * into v_atual from public."TB_DEMANDA_INTERNA" d
   where d."CO_DEMANDA_INTERNA" = p_id for update;
  if v_atual."CO_DEMANDA_INTERNA" is null or v_atual."ST_ATIVO" <> 'S' then
    raise exception 'Demanda não encontrada.' using errcode = 'P0002';
  end if;
  if not private."FC_PODE_EDITAR_DEMANDA"(v_atual."CO_AREA", v_atual."CO_MONITORAMENTO") then
    raise exception 'Sem permissão para esta demanda.' using errcode = '42501';
  end if;

  v_antes := private."FC_DEMANDA_INTERNA_JSON"(p_id);
  update public."TB_DEMANDA_INTERNA" d
     set "ST_ATIVO" = 'N',
         "CO_USUARIO_ATUALIZACAO" = v_usuario,
         "DT_ATUALIZACAO" = now()
   where d."CO_DEMANDA_INTERNA" = p_id;
  insert into public."TH_DEMANDA_INTERNA" ("CO_DEMANDA_INTERNA", "TP_ACAO", "DS_ANTES", "DS_DEPOIS", "CO_USUARIO")
  values (p_id, 'EXCLUSAO', v_antes, private."FC_DEMANDA_INTERNA_JSON"(p_id), v_usuario);

  return jsonb_build_object('ok', true, 'id', p_id);
end;
$function$;
comment on function public.excluir_demanda_interna(uuid) is
  'Exclusão lógica (ST_ATIVO = N) de uma demanda interna. Gestor da área ou administrador global; grava TH_DEMANDA_INTERNA. 20261104120000.';
revoke all on function public.excluir_demanda_interna(uuid) from public, anon;
grant execute on function public.excluir_demanda_interna(uuid) to authenticated;

create function public.listar_pessoas_da_area(p_area text, p_edital uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Sessão não localizada.' using errcode = '28000';
  end if;
  if not private."FC_PODE_EDITAR_CRONOGRAMA_AREA"(p_area) then
    raise exception 'Sem permissão para esta área.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object('id', u.id, 'nome', coalesce(nullif(btrim(u.nome), ''), u.email))
                     order by coalesce(nullif(btrim(u.nome), ''), u.email))
      from public."TB_PERFIL_USUARIO" u
     where u.ativo
       and private."FC_PERFIL_PODE_SER_RESPONSAVEL"(u.id, p_area, p_edital)), '[]'::jsonb);
end;
$function$;
comment on function public.listar_pessoas_da_area(text, uuid) is
  'Pessoas ativas que veem a área (e o edital, se informado): as opções de responsável. Só para quem edita na área. 20261104120000.';
revoke all on function public.listar_pessoas_da_area(text, uuid) from public, anon;
grant execute on function public.listar_pessoas_da_area(text, uuid) to authenticated;

-- 6. RPCs dos responsáveis pelo edital ---------------------------------------------------------
create function private."FC_RESPONSAVEIS_DO_EDITAL_JSON"(p_edital uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce((
    select jsonb_agg(jsonb_build_object('id', u.id, 'nome', coalesce(nullif(btrim(u.nome), ''), u.email))
                     order by coalesce(nullif(btrim(u.nome), ''), u.email), u.id)
      from public."RL_RESPONSAVEL_EDITAL" r
      join public."TB_PERFIL_USUARIO" u on u.id = r."CO_PERFIL_USUARIO"
     where r."CO_MONITORAMENTO" = p_edital), '[]'::jsonb);
$function$;
comment on function private."FC_RESPONSAVEIS_DO_EDITAL_JSON"(uuid) is
  'Responsáveis pelo edital em json ([{id, nome}]), para a leitura e o histórico. 20261104120000.';
revoke all on function private."FC_RESPONSAVEIS_DO_EDITAL_JSON"(uuid) from public, anon, authenticated, service_role;

create function public.obter_responsaveis_do_edital(p_edital uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text;
begin
  if (select auth.uid()) is null then
    raise exception 'Sessão não localizada.' using errcode = '28000';
  end if;
  select m."CO_AREA" into v_area from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital;
  if v_area is null then
    raise exception 'Edital não encontrado.' using errcode = 'P0002';
  end if;
  if not (private.is_master() or private."FC_PODE_VER_EDITAL"(p_edital)) then
    raise exception 'Sem permissão para editais desta área ou coordenação' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'area', v_area,
    'pode_editar', private."FC_PODE_EDITAR_DEMANDA"(v_area, p_edital),
    'responsaveis', private."FC_RESPONSAVEIS_DO_EDITAL_JSON"(p_edital));
end;
$function$;
comment on function public.obter_responsaveis_do_edital(uuid) is
  'Responsáveis pelo edital ({area, pode_editar, responsaveis: [{id, nome}]}). Quem vê o edital. 20261104120000.';
revoke all on function public.obter_responsaveis_do_edital(uuid) from public, anon;
grant execute on function public.obter_responsaveis_do_edital(uuid) to authenticated;

create function public.salvar_responsaveis_do_edital(p_edital uuid, p_responsaveis uuid[])
returns jsonb
language plpgsql
security definer
set search_path to ''
set lock_timeout to '5s'
as $function$
declare
  v_usuario uuid := (select auth.uid());
  v_area text;
  v_responsaveis uuid[];
  v_antes jsonb;
  v_depois jsonb;
begin
  if v_usuario is null then
    raise exception 'Sessão não localizada.' using errcode = '28000';
  end if;
  select m."CO_AREA" into v_area from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital;
  if v_area is null then
    raise exception 'Edital não encontrado.' using errcode = 'P0002';
  end if;
  if not private."FC_PODE_EDITAR_DEMANDA"(v_area, p_edital) then
    raise exception 'Sem permissão para editar este edital.' using errcode = '42501';
  end if;
  -- Duas gravações do mesmo edital ao mesmo tempo: uma espera a outra (sem travar a linha do edital).
  perform pg_advisory_xact_lock(hashtext('responsaveis_do_edital:' || p_edital::text)::bigint);

  select coalesce(array_agg(distinct r), '{}') into v_responsaveis
    from unnest(coalesce(p_responsaveis, '{}')) r where r is not null;
  if cardinality(v_responsaveis) > 20 then
    raise exception 'No máximo 20 responsáveis.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_responsaveis) r
              where not private."FC_PERFIL_PODE_SER_RESPONSAVEL"(r, v_area, p_edital)) then
    raise exception 'Há responsável sem acesso a este edital.' using errcode = '22023';
  end if;

  v_antes := private."FC_RESPONSAVEIS_DO_EDITAL_JSON"(p_edital);

  delete from public."RL_RESPONSAVEL_EDITAL" r
   where r."CO_MONITORAMENTO" = p_edital and not (r."CO_PERFIL_USUARIO" = any (v_responsaveis));
  insert into public."RL_RESPONSAVEL_EDITAL" ("CO_MONITORAMENTO", "CO_PERFIL_USUARIO", "CO_USUARIO_INCLUSAO")
  select p_edital, r, v_usuario from unnest(v_responsaveis) r
  on conflict do nothing;

  v_depois := private."FC_RESPONSAVEIS_DO_EDITAL_JSON"(p_edital);
  if v_antes is distinct from v_depois then
    insert into public."TH_RESPONSAVEL_EDITAL" ("CO_MONITORAMENTO", "DS_ANTES", "DS_DEPOIS", "CO_USUARIO")
    values (p_edital, jsonb_build_object('responsaveis', v_antes),
            jsonb_build_object('responsaveis', v_depois), v_usuario);
  end if;

  return public.obter_responsaveis_do_edital(p_edital);
end;
$function$;
comment on function public.salvar_responsaveis_do_edital(uuid, uuid[]) is
  'Grava os responsáveis pelo edital (a lista inteira; vazia tira todos). Gestor da área ou administrador global; grava TH_RESPONSAVEL_EDITAL quando muda. 20261104120000.';
revoke all on function public.salvar_responsaveis_do_edital(uuid, uuid[]) from public, anon;
grant execute on function public.salvar_responsaveis_do_edital(uuid, uuid[]) to authenticated;

-- ═══ CORPO DA MIGRATION (fim) ═══

create temp table t_ensaio (chave text primary key, valor jsonb) on commit drop;
create temp table t_ids (chave text primary key, id uuid) on commit drop;
grant all on t_ensaio, t_ids to authenticated;

-- Quem conferir (o perfil mais recente de cada tipo): administrador global; Gestor só da Saúde
-- Indígena; pessoa comum (grupo usuario) da Saúde Indígena; e alguém sem a Saúde Indígena.
create temp table t_pessoas on commit drop as
select distinct on (tipo) tipo, id as perfil, user_id, email from (
  select case
           when g."ST_ADMIN_GLOBAL" then 'admin_global'
           when p.perfil = 'edital_gestor' and private."FC_AREAS_DO_PERFIL"(p.id) = array['saude-indigena'] then 'gestor'
           when p.perfil = 'usuario' and private."FC_AREAS_DO_PERFIL"(p.id) = array['saude-indigena'] then 'comum'
           when not ('saude-indigena' = any (private."FC_AREAS_DO_PERFIL"(p.id))) then 'fora'
         end tipo,
         p.id, p.user_id, p.email, p.updated_at
    from public."TB_PERFIL_USUARIO" p
    join public."TB_GRUPO_ACESSO" g on g."CO_GRUPO_ACESSO" = p.perfil
   where p.ativo and p.user_id is not null and p."CO_COORDENACAO" is null
) x
where tipo is not null
order by tipo, updated_at desc nulls last;
grant select on t_pessoas to authenticated;

-- Um edital ativo da Saúde Indígena que o Gestor e a pessoa comum veem.
insert into t_ids
select 'edital', m.id from public."TB_MONITORAMENTO_INDIGENA" m
 where m.ativo and m."CO_AREA" = 'saude-indigena'
   and private."FC_PERFIL_VE_EDITAL"((select perfil from t_pessoas where tipo = 'gestor'), m.id)
   and private."FC_PERFIL_VE_EDITAL"((select perfil from t_pessoas where tipo = 'comum'), m.id)
 order by m.updated_at desc limit 1;
insert into t_ids select 'p_' || tipo, perfil from t_pessoas;
-- Um edital de outra área (lido aqui: authenticated não lê a tabela).
insert into t_ids
select 'edital_outra_area', m.id from public."TB_MONITORAMENTO_INDIGENA" m
 where m."CO_AREA" <> 'saude-indigena' order by m.updated_at desc limit 1;

insert into t_ensaio select 'pessoas_do_ensaio', jsonb_build_object(
  'tipos', (select jsonb_agg(tipo order by tipo) from t_pessoas),
  'edital', exists (select 1 from t_ids where chave = 'edital'),
  'edital_outra_area', exists (select 1 from t_ids where chave = 'edital_outra_area'),
  'niveis_calendario', (select jsonb_object_agg(t.tipo, private."FC_NIVEL_EFETIVO"(p.id, p.perfil, 'calendario'))
                          from t_pessoas t join public."TB_PERFIL_USUARIO" p on p.id = t.perfil));

-- Devolve 'ok' ou o sqlstate do erro.
create function pg_temp.tentar(p_sql text) returns text language plpgsql as $f$
begin
  execute p_sql;
  return 'ok';
exception when others then
  return sqlstate;
end;
$f$;
create function pg_temp.id(p text) returns uuid language sql stable as $f$ select id from t_ids where chave = p $f$;
create function pg_temp.demanda(p_area text, p_titulo text, p_edital uuid, p_inicio date, p_fim date, p_resp uuid[], p_id uuid default null)
returns jsonb language sql stable as $f$
  select jsonb_strip_nulls(jsonb_build_object('id', p_id, 'area', p_area, 'titulo', p_titulo, 'edital_id', p_edital,
                            'data_inicio', p_inicio, 'data_fim', p_fim, 'responsaveis', to_jsonb(p_resp)));
$f$;
create function pg_temp.na_lista(p_id uuid) returns jsonb language sql as $f$
  select (select e from jsonb_array_elements(public.listar_demandas_internas() -> 'demandas') e where e ->> 'id' = p_id::text);
$f$;

-- ── Administrador global ───────────────────────────────────────────────────────────────────
create function pg_temp.passo_admin() returns void language plpgsql as $f$
declare v jsonb; v_id uuid;
begin
  v := public.salvar_demanda_interna(pg_temp.demanda('saude-indigena', 'Ensaio: demanda do administrador', pg_temp.id('edital'),
         current_date - 10, current_date - 2, array[pg_temp.id('p_gestor'), pg_temp.id('p_comum')]));
  v_id := (v ->> 'id')::uuid;
  insert into t_ids values ('A', v_id);
  insert into t_ensaio values ('admin_cria', jsonb_build_object(
    'responsaveis', jsonb_array_length(v -> 'responsaveis'), 'edital', v ->> 'edital_id' = pg_temp.id('edital')::text,
    'concluida', v -> 'concluida', 'criada_por', v ->> 'criada_por' is not null));
  v := public.concluir_demanda_interna(v_id, true);
  insert into t_ensaio values ('admin_conclui', jsonb_build_object('concluida', v -> 'concluida',
    'tem_data', v ->> 'concluida_em' is not null, 'quem', v ->> 'concluida_por' is not null));
  v := public.concluir_demanda_interna(v_id, false);
  insert into t_ensaio values ('admin_reabre', jsonb_build_object('concluida', v -> 'concluida', 'sem_data', v ->> 'concluida_em' is null));
  v := public.salvar_demanda_interna(pg_temp.demanda('saude-indigena', 'Ensaio: demanda do administrador (editada)', pg_temp.id('edital'),
         current_date - 10, current_date - 2, array[pg_temp.id('p_gestor'), pg_temp.id('p_comum')], v_id));
  insert into t_ensaio values ('admin_edita', to_jsonb(v ->> 'titulo' = 'Ensaio: demanda do administrador (editada)'));
  -- Sem vínculo de área: cria na SEDE, sem edital, data única.
  v := public.salvar_demanda_interna(pg_temp.demanda('sede', 'Ensaio: demanda da SEDE', null, current_date, null, '{}'));
  insert into t_ids values ('S', (v ->> 'id')::uuid);
  insert into t_ensaio values ('admin_sede', jsonb_build_object('data_unica', v ->> 'data_inicio' = v ->> 'data_fim'));
  insert into t_ensaio values ('admin_lista', jsonb_build_object(
    'pode_criar_em', public.listar_demandas_internas() -> 'pode_criar_em',
    've_A', pg_temp.na_lista(v_id) is not null, 've_S', pg_temp.na_lista(pg_temp.id('S')) is not null));
  v := public.salvar_responsaveis_do_edital(pg_temp.id('edital'), array[pg_temp.id('p_gestor')]);
  insert into t_ensaio values ('admin_responsaveis_edital', jsonb_build_object(
    'pode_editar', v -> 'pode_editar', 'responsaveis', jsonb_array_length(v -> 'responsaveis')));
end;
$f$;

-- ── Gestor da Saúde Indígena ───────────────────────────────────────────────────────────────
create function pg_temp.passo_gestor() returns void language plpgsql as $f$
declare v jsonb; v_g uuid;
begin
  v := public.listar_demandas_internas();
  insert into t_ensaio values ('gestor_lista', jsonb_build_object(
    'pode_criar_em', v -> 'pode_criar_em',
    've_A', pg_temp.na_lista(pg_temp.id('A')) is not null,
    'pode_editar_A', pg_temp.na_lista(pg_temp.id('A')) -> 'pode_editar',
    've_S', pg_temp.na_lista(pg_temp.id('S')) is not null));
  v := public.salvar_demanda_interna(pg_temp.demanda('saude-indigena', 'Ensaio: demanda do gestor', null,
         current_date, current_date + 5, array[pg_temp.id('p_gestor')]));
  v_g := (v ->> 'id')::uuid;
  insert into t_ids values ('G', v_g);
  insert into t_ensaio values ('gestor_erros', jsonb_build_object(
    'cria_na_sede', pg_temp.tentar(format('select public.salvar_demanda_interna(%L::jsonb)',
       pg_temp.demanda('sede', 'Ensaio: gestor na SEDE', null, current_date, null, '{}'))),
    'conclui_da_sede', pg_temp.tentar(format('select public.concluir_demanda_interna(%L::uuid)', pg_temp.id('S'))),
    'fim_antes_do_inicio', pg_temp.tentar(format('select public.salvar_demanda_interna(%L::jsonb)',
       pg_temp.demanda('saude-indigena', 'Ensaio: período invertido', null, current_date, current_date - 1, '{}'))),
    'titulo_curto', pg_temp.tentar(format('select public.salvar_demanda_interna(%L::jsonb)',
       pg_temp.demanda('saude-indigena', 'ab', null, current_date, null, '{}'))),
    'responsavel_sem_area', pg_temp.tentar(format('select public.salvar_demanda_interna(%L::jsonb)',
       pg_temp.demanda('saude-indigena', 'Ensaio: responsável de fora', null, current_date, null, array[pg_temp.id('p_fora')]))),
    'edital_de_outra_area', pg_temp.tentar(format('select public.salvar_demanda_interna(%L::jsonb)',
       pg_temp.demanda('saude-indigena', 'Ensaio: edital de outra área', pg_temp.id('edital_outra_area'), current_date, null, '{}'))),
    'pessoas_da_sede', pg_temp.tentar('select public.listar_pessoas_da_area(''sede'')'),
    'responsavel_edital_de_fora', pg_temp.tentar(format('select public.salvar_responsaveis_do_edital(%L::uuid, array[%L::uuid])',
       pg_temp.id('edital'), pg_temp.id('p_fora')))));
  v := public.concluir_demanda_interna(pg_temp.id('A'), true);
  insert into t_ensaio values ('gestor_conclui_A', v -> 'concluida');
  v := public.excluir_demanda_interna(v_g);
  insert into t_ensaio values ('gestor_exclui_G', jsonb_build_object('ok', v -> 'ok',
    'some_da_lista', pg_temp.na_lista(v_g) is null,
    'excluir_de_novo', pg_temp.tentar(format('select public.excluir_demanda_interna(%L::uuid)', v_g))));
  v := public.listar_pessoas_da_area('saude-indigena', pg_temp.id('edital'));
  insert into t_ensaio values ('gestor_pessoas', jsonb_build_object(
    'tem_gestor', exists (select 1 from jsonb_array_elements(v) e where e ->> 'id' = pg_temp.id('p_gestor')::text),
    'tem_fora', exists (select 1 from jsonb_array_elements(v) e where e ->> 'id' = pg_temp.id('p_fora')::text)));
  v := public.salvar_responsaveis_do_edital(pg_temp.id('edital'), array[pg_temp.id('p_gestor'), pg_temp.id('p_comum')]);
  v := public.salvar_responsaveis_do_edital(pg_temp.id('edital'), array[pg_temp.id('p_comum'), pg_temp.id('p_gestor'), pg_temp.id('p_gestor')]);
  insert into t_ensaio values ('gestor_responsaveis_edital', jsonb_build_object(
    'responsaveis', jsonb_array_length(v -> 'responsaveis'), 'pode_editar', v -> 'pode_editar'));
end;
$f$;

-- ── Pessoa comum da Saúde Indígena: só vê ──────────────────────────────────────────────────
create function pg_temp.passo_comum() returns void language plpgsql as $f$
declare v jsonb;
begin
  v := public.listar_demandas_internas();
  insert into t_ensaio values ('comum_lista', jsonb_build_object(
    'pode_criar_em', v -> 'pode_criar_em',
    've_A', pg_temp.na_lista(pg_temp.id('A')) is not null,
    'pode_editar_A', pg_temp.na_lista(pg_temp.id('A')) -> 'pode_editar',
    'responsaveis_A', jsonb_array_length(pg_temp.na_lista(pg_temp.id('A')) -> 'responsaveis'),
    've_S', pg_temp.na_lista(pg_temp.id('S')) is not null));
  v := public.obter_responsaveis_do_edital(pg_temp.id('edital'));
  insert into t_ensaio values ('comum_responsaveis_edital', jsonb_build_object(
    'pode_editar', v -> 'pode_editar', 'responsaveis', jsonb_array_length(v -> 'responsaveis')));
  insert into t_ensaio values ('comum_erros', jsonb_build_object(
    'cria', pg_temp.tentar(format('select public.salvar_demanda_interna(%L::jsonb)',
       pg_temp.demanda('saude-indigena', 'Ensaio: comum cria', null, current_date, null, '{}'))),
    'edita', pg_temp.tentar(format('select public.salvar_demanda_interna(%L::jsonb)',
       pg_temp.demanda('saude-indigena', 'Ensaio: comum edita', null, current_date, null, '{}', pg_temp.id('A')))),
    'reabre', pg_temp.tentar(format('select public.concluir_demanda_interna(%L::uuid, false)', pg_temp.id('A'))),
    'exclui', pg_temp.tentar(format('select public.excluir_demanda_interna(%L::uuid)', pg_temp.id('A'))),
    'pessoas', pg_temp.tentar('select public.listar_pessoas_da_area(''saude-indigena'')'),
    'responsaveis_edital', pg_temp.tentar(format('select public.salvar_responsaveis_do_edital(%L::uuid, %L::uuid[])',
       pg_temp.id('edital'), '{}'))));
end;
$f$;
grant execute on all functions in schema pg_temp to authenticated;

select set_config('request.jwt.claims', json_build_object('sub', user_id, 'email', email, 'role', 'authenticated')::text, true),
       set_config('request.jwt.claim.sub', user_id::text, true)
  from t_pessoas where tipo = 'admin_global';
set local role authenticated;
select pg_temp.passo_admin();
reset role;

select set_config('request.jwt.claims', json_build_object('sub', user_id, 'email', email, 'role', 'authenticated')::text, true),
       set_config('request.jwt.claim.sub', user_id::text, true)
  from t_pessoas where tipo = 'gestor';
set local role authenticated;
select pg_temp.passo_gestor();
reset role;

select set_config('request.jwt.claims', json_build_object('sub', user_id, 'email', email, 'role', 'authenticated')::text, true),
       set_config('request.jwt.claim.sub', user_id::text, true)
  from t_pessoas where tipo = 'comum';
set local role authenticated;
select pg_temp.passo_comum();
reset role;

-- O que ficou gravado: histórico de cada ação e conclusão com quem e quando.
insert into t_ensaio
select 'gravado', jsonb_build_object(
  'historico_A', (select jsonb_agg(h."TP_ACAO" order by h."CO_EVENTO") from public."TH_DEMANDA_INTERNA" h where h."CO_DEMANDA_INTERNA" = pg_temp.id('A')),
  'historico_G', (select jsonb_agg(h."TP_ACAO" order by h."CO_EVENTO") from public."TH_DEMANDA_INTERNA" h where h."CO_DEMANDA_INTERNA" = pg_temp.id('G')),
  'historico_com_autor', (select bool_and(h."CO_USUARIO" is not null and h."DS_DEPOIS" is not null) from public."TH_DEMANDA_INTERNA" h
                           where h."CO_DEMANDA_INTERNA" in (pg_temp.id('A'), pg_temp.id('G'), pg_temp.id('S'))),
  'A_concluida_pelo_gestor', (select d."ST_CONCLUIDA" = 'S' and d."CO_USUARIO_CONCLUSAO" = (select user_id from t_pessoas where tipo = 'gestor')
                               from public."TB_DEMANDA_INTERNA" d where d."CO_DEMANDA_INTERNA" = pg_temp.id('A')),
  'G_excluida', (select d."ST_ATIVO" from public."TB_DEMANDA_INTERNA" d where d."CO_DEMANDA_INTERNA" = pg_temp.id('G')),
  'responsaveis_A', (select count(*) from public."RL_DEMANDA_INTERNA_RESPONSAVEL" r where r."CO_DEMANDA_INTERNA" = pg_temp.id('A')),
  'historico_responsaveis_edital', (select count(*) from public."TH_RESPONSAVEL_EDITAL" h where h."CO_MONITORAMENTO" = pg_temp.id('edital')),
  'responsaveis_edital', (select count(*) from public."RL_RESPONSAVEL_EDITAL" r where r."CO_MONITORAMENTO" = pg_temp.id('edital')));

-- Privilégios: tabelas fechadas com RLS; RPCs sem anon; auxiliares de private fechadas.
insert into t_ensaio
select 'privilegios', jsonb_build_object(
  'rls_em_todas', (select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace
                    where n.nspname = 'public' and c.relname in ('TB_DEMANDA_INTERNA', 'RL_DEMANDA_INTERNA_RESPONSAVEL',
                      'TH_DEMANDA_INTERNA', 'RL_RESPONSAVEL_EDITAL', 'TH_RESPONSAVEL_EDITAL')),
  'authenticated_le_tabela', (select bool_or(has_table_privilege('authenticated', format('public.%I', t), 'select'))
                               from unnest(array['TB_DEMANDA_INTERNA', 'RL_DEMANDA_INTERNA_RESPONSAVEL', 'TH_DEMANDA_INTERNA',
                                                 'RL_RESPONSAVEL_EDITAL', 'TH_RESPONSAVEL_EDITAL']) t),
  'anon_executa_rpc', (select bool_or(has_function_privilege('anon', f, 'execute')) from unnest(array[
      'public.listar_demandas_internas()', 'public.salvar_demanda_interna(jsonb)',
      'public.concluir_demanda_interna(uuid, boolean)', 'public.excluir_demanda_interna(uuid)',
      'public.listar_pessoas_da_area(text, uuid)', 'public.obter_responsaveis_do_edital(uuid)',
      'public.salvar_responsaveis_do_edital(uuid, uuid[])']) f),
  'authenticated_executa_private', (select bool_or(has_function_privilege('authenticated', p.oid, 'execute'))
                                     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                    where n.nspname = 'private' and p.proname in ('FC_PODE_EDITAR_CRONOGRAMA_AREA', 'FC_PODE_VER_DEMANDA',
                                      'FC_PODE_EDITAR_DEMANDA', 'FC_PERFIL_PODE_SER_RESPONSAVEL', 'FC_DEMANDA_INTERNA_JSON',
                                      'FC_RESPONSAVEIS_DO_EDITAL_JSON')),
  'search_path_vazio', (select bool_and(p.proconfig @> array['search_path=""'])
                          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                         where n.nspname = 'public' and p.proname in ('listar_demandas_internas', 'salvar_demanda_interna',
                           'concluir_demanda_interna', 'excluir_demanda_interna', 'listar_pessoas_da_area',
                           'obter_responsaveis_do_edital', 'salvar_responsaveis_do_edital')));

-- Sem sessão: recusa.
do $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  insert into t_ensaio values ('sem_sessao', to_jsonb(pg_temp.tentar('select public.listar_demandas_internas()')));
end;
$$;

select jsonb_object_agg(chave, valor order by chave) as ensaio from t_ensaio;

rollback;
