/*
  COORDENAÇÕES (permissões, parte 2)

  Coordenação = subdivisão de uma área (TB_AREA). Cada usuário fica em no
  máximo uma (TB_PERFIL_USUARIO."CO_COORDENACAO"); sem coordenação, continua
  vendo as áreas liberadas inteiras (RL_PERFIL_USUARIO_AREA), como antes.

  O que a coordenação C (área A) vê — só editais da área A e:
    * sem responsável, sem unidades e sem editais  -> a área A inteira;
    * só editais                                   -> só esses editais;
    * com responsável e/ou unidades                -> os editais que casam a
      regra (dimensões em AND; dimensão vazia não restringe) + os editais
      listados.
  Calculado na hora (coordenações podem se sobrepor). Vale para tudo que
  deriva do edital (cronograma, listas, candidatos, convocação, vagas, anexos,
  histórico) e para as análises: análise visível se a unidade está nas
  unidades da coordenação ou o edital (texto normalizado) é de um edital
  visível.

  Helpers (STABLE; nas policies/RPCs vão dentro de `(select …)` para virar
  InitPlan, uma chamada por consulta):
    FC_COORDENACAO_USUARIO()       coordenação do usuário logado (null p/ admin)
    FC_AREAS_DO_PERFIL(id)         áreas de um usuário (admin: todas;
                                   com coordenação: a dela; senão as da RL)
    FC_AREAS_USUARIO()             redefinida: áreas do usuário logado
    FC_EDITAIS_DA_COORDENACAO(c)   uuid[] dos editais visíveis; null = sem recorte
    FC_EDITAIS_VISIVEIS()          idem para o usuário logado
    FC_PODE_VER_EDITAL(id)         escalar, para as RPCs
    FC_EDITAIS_NORM_VISIVEIS()     texto normalizado dos editais visíveis (análises)
    FC_UNIDADES_NORM_VISIVEIS()    unidades normalizadas da coordenação (análises)

  Esta parte troca as policies de leitura direta (editais e análises; as
  tabelas filhas já leem pela policy da mãe) e o contexto do usuário. As RPCs
  SECURITY DEFINER passam a usar o recorte na parte 3.

  ROLLBACK
    begin;
    -- reaplicar FC_AREAS_USUARIO e obter_contexto_monitora de 20260925180000,
    -- as policies de 20260925181000 e proteger_proprio_acesso de 20260916102000;
    drop function private."FC_UNIDADES_NORM_VISIVEIS"(), private."FC_EDITAIS_NORM_VISIVEIS"(),
      private."FC_PODE_VER_EDITAL"(uuid), private."FC_EDITAIS_VISIVEIS"(),
      private."FC_EDITAIS_DA_COORDENACAO"(text), private."FC_AREAS_DO_PERFIL"(uuid),
      private."FC_COORDENACAO_USUARIO"();
    alter table public."TB_SOLICITACAO_ACESSO" drop column "CO_COORDENACAO";
    alter table public."TB_PERFIL_USUARIO" drop column "CO_COORDENACAO";
    drop table public."RL_COORDENACAO_EDITAL", public."RL_COORDENACAO_UNIDADE", public."TB_COORDENACAO";
    commit;
*/
begin;

-- 1. Tabelas ----------------------------------------------------------------------
create table public."TB_COORDENACAO" (
  "CO_COORDENACAO" text not null,
  "NO_COORDENACAO" text not null,
  "CO_AREA" text not null,
  "TP_RESPONSAVEL" text,
  "ST_ATIVO" boolean not null default true,
  "NU_REVISAO" integer not null default 1,
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_COORDENACAO" primary key ("CO_COORDENACAO"),
  constraint "UK_COORDENACAO_NOME" unique ("NO_COORDENACAO"),
  constraint "FK_AREA_COORDENACAO" foreign key ("CO_AREA") references public."TB_AREA" ("CO_AREA"),
  constraint "CK_COORDENACAO_CODIGO" check ("CO_COORDENACAO" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint "CK_COORDENACAO_RESPONSAVEL" check ("TP_RESPONSAVEL" is null or "TP_RESPONSAVEL" in ('USI','CORES'))
);
create index "IN_FKCOORDENACAO_COAREA" on public."TB_COORDENACAO" ("CO_AREA");
comment on table public."TB_COORDENACAO" is
  'Coordenação: subdivisão de uma área, com filtro por responsável, unidades e editais.';
comment on column public."TB_COORDENACAO"."CO_COORDENACAO" is 'Código da coordenação (minúsculas e hífen).';
comment on column public."TB_COORDENACAO"."NO_COORDENACAO" is 'Nome da coordenação na tela.';
comment on column public."TB_COORDENACAO"."CO_AREA" is 'Área que a coordenação subdivide (TB_AREA).';
comment on column public."TB_COORDENACAO"."TP_RESPONSAVEL" is 'Responsável do edital (USI ou CORES); null não restringe.';
comment on column public."TB_COORDENACAO"."ST_ATIVO" is 'Coordenação em uso. Só se desativa sem usuários.';
comment on column public."TB_COORDENACAO"."NU_REVISAO" is 'Revisão para trava de concorrência na edição.';
comment on column public."TB_COORDENACAO"."DT_ATUALIZACAO" is 'Última alteração.';

create table public."RL_COORDENACAO_UNIDADE" (
  "CO_COORDENACAO" text not null,
  "NO_UNIDADE" text not null,
  constraint "PK_RL_COORDENACAO_UNIDADE" primary key ("CO_COORDENACAO", "NO_UNIDADE"),
  constraint "FK_COORDENACAO_COORDUNIDADE" foreign key ("CO_COORDENACAO")
    references public."TB_COORDENACAO" ("CO_COORDENACAO") on delete cascade on update cascade
);
comment on table public."RL_COORDENACAO_UNIDADE" is
  'Unidades (DSEI, CASAI, unidades do CORES) que a coordenação acompanha. Comparadas por analises_norm_key com TB_MONITORAMENTO_INDIGENA.unidade.';
comment on column public."RL_COORDENACAO_UNIDADE"."CO_COORDENACAO" is 'TB_COORDENACAO.CO_COORDENACAO.';
comment on column public."RL_COORDENACAO_UNIDADE"."NO_UNIDADE" is 'Nome da unidade como gravado no edital (TD_UNIDADE.nome_oficial ou TA_UNIDADE_AREA.NO_UNIDADE).';

create table public."RL_COORDENACAO_EDITAL" (
  "CO_COORDENACAO" text not null,
  "CO_EDITAL" uuid not null,
  constraint "PK_RL_COORDENACAO_EDITAL" primary key ("CO_COORDENACAO", "CO_EDITAL"),
  constraint "FK_COORDENACAO_COORDEDITAL" foreign key ("CO_COORDENACAO")
    references public."TB_COORDENACAO" ("CO_COORDENACAO") on delete cascade on update cascade,
  constraint "FK_MONITINDIG_COORDEDITAL" foreign key ("CO_EDITAL")
    references public."TB_MONITORAMENTO_INDIGENA" (id) on delete cascade
);
create index "IN_FKCOORDEDITAL_COEDITAL" on public."RL_COORDENACAO_EDITAL" ("CO_EDITAL");
comment on table public."RL_COORDENACAO_EDITAL" is 'Editais atribuídos à coordenação, além dos que casam a regra.';
comment on column public."RL_COORDENACAO_EDITAL"."CO_COORDENACAO" is 'TB_COORDENACAO.CO_COORDENACAO.';
comment on column public."RL_COORDENACAO_EDITAL"."CO_EDITAL" is 'TB_MONITORAMENTO_INDIGENA.id.';

alter table public."TB_COORDENACAO" enable row level security;
alter table public."RL_COORDENACAO_UNIDADE" enable row level security;
alter table public."RL_COORDENACAO_EDITAL" enable row level security;
revoke all on public."TB_COORDENACAO", public."RL_COORDENACAO_UNIDADE", public."RL_COORDENACAO_EDITAL"
  from public, anon, authenticated;
-- Leitura e gravação só pelas RPCs (SECURITY DEFINER); nenhuma policy de propósito.

alter table public."TB_PERFIL_USUARIO" add column "CO_COORDENACAO" text;
alter table public."TB_PERFIL_USUARIO"
  add constraint "FK_COORDENACAO_PERFILUSUARIO" foreign key ("CO_COORDENACAO")
  references public."TB_COORDENACAO" ("CO_COORDENACAO") on update cascade;
create index "IN_FKPERFILUSUARIO_COCOORDENACAO" on public."TB_PERFIL_USUARIO" ("CO_COORDENACAO");
comment on column public."TB_PERFIL_USUARIO"."CO_COORDENACAO" is
  'Coordenação do usuário (no máximo uma). Null: vê as áreas de RL_PERFIL_USUARIO_AREA inteiras.';

alter table public."TB_SOLICITACAO_ACESSO" add column "CO_COORDENACAO" text;
alter table public."TB_SOLICITACAO_ACESSO"
  add constraint "FK_COORDENACAO_SOLICACESSO" foreign key ("CO_COORDENACAO")
  references public."TB_COORDENACAO" ("CO_COORDENACAO") on update cascade on delete set null;
create index "IN_FKSOLICACESSO_COCOORDENACAO" on public."TB_SOLICITACAO_ACESSO" ("CO_COORDENACAO");
comment on column public."TB_SOLICITACAO_ACESSO"."CO_COORDENACAO" is
  'Coordenação pedida. O coordenador dela pode aprovar; null só o admin global.';

-- 2. Ninguém muda a própria coordenação ---------------------------------------------
create or replace function private.proteger_proprio_acesso()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text := lower(coalesce((select auth.jwt() ->> 'email'), ''));
  v_proprio boolean;
begin
  -- Rotinas administrativas executadas sem JWT (por exemplo, SQL Editor) não
  -- são bloqueadas; esta trava protege alterações originadas por uma sessão.
  if v_uid is null and v_email = '' then
    return new;
  end if;

  v_proprio :=
    (v_uid is not null and old.user_id = v_uid)
    or (v_email <> '' and lower(coalesce(old.email, '')) = v_email);

  if v_proprio and (
    new.perfil is distinct from old.perfil
    or new.ativo is distinct from old.ativo
    or new."CO_COORDENACAO" is distinct from old."CO_COORDENACAO"
    or new.p_ind is distinct from old.p_ind
    or new.p_cores is distinct from old.p_cores
    or new.p_paineis is distinct from old.p_paineis
    or new.p_config is distinct from old.p_config
    or new.p_admin is distinct from old.p_admin
  ) then
    raise exception 'Nao e permitido alterar o proprio grupo de acesso';
  end if;

  return new;
end;
$$;

-- 3. Helpers de recorte ------------------------------------------------------------------
create function private."FC_COORDENACAO_USUARIO"()
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select case
    when coalesce((select auth.role()) = 'service_role', false) or private.is_master() then null
    else (select p."CO_COORDENACAO" from private.current_profile() p where p.ativo)
  end;
$$;
comment on function private."FC_COORDENACAO_USUARIO"() is
  'Coordenação do usuário logado; null para admin, service_role ou quem não tem coordenação.';

create function private."FC_AREAS_DO_PERFIL"(p_perfil_usuario uuid)
returns text[]
language sql
stable
security definer
set search_path to ''
as $$
  select case
    when a."ST_ADMIN_GLOBAL" is true
      then (select coalesce(array_agg(x."CO_AREA" order by x."NU_ORDEM"), '{}') from public."TB_AREA" x)
    when u."CO_COORDENACAO" is not null
      then coalesce((select array[c."CO_AREA"] from public."TB_COORDENACAO" c where c."CO_COORDENACAO" = u."CO_COORDENACAO"), '{}')
    else coalesce((
      select array_agg(r."CO_AREA" order by x."NU_ORDEM")
        from public."RL_PERFIL_USUARIO_AREA" r
        join public."TB_AREA" x on x."CO_AREA" = r."CO_AREA"
       where r."CO_PERFIL_USUARIO" = u.id), '{}')
  end
  from public."TB_PERFIL_USUARIO" u
  left join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = u.perfil
  where u.id = p_perfil_usuario and u.ativo;
$$;
comment on function private."FC_AREAS_DO_PERFIL"(uuid) is
  'Áreas de um usuário ativo: todas (admin global); a da coordenação; senão as de RL_PERFIL_USUARIO_AREA.';

create or replace function private."FC_AREAS_USUARIO"()
returns text[]
language sql
stable
security definer
set search_path to ''
as $$
  select case
    when coalesce((select auth.role()) = 'service_role', false) or private.is_master()
      then (select coalesce(array_agg(a."CO_AREA" order by a."NU_ORDEM"), '{}') from public."TB_AREA" a)
    else coalesce((select private."FC_AREAS_DO_PERFIL"(p.id) from private.current_profile() p where p.ativo), '{}')
  end;
$$;
comment on function private."FC_AREAS_USUARIO"() is
  'Áreas que o usuário logado vê: todas para admin e service_role; a da coordenação; senão as de RL_PERFIL_USUARIO_AREA.';

create function private."FC_EDITAIS_DA_COORDENACAO"(p_coordenacao text)
returns uuid[]
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_area text;
  v_responsavel text;
  v_unidades text[];
  v_tem_editais boolean;
begin
  if p_coordenacao is null then return null; end if;
  select c."CO_AREA", c."TP_RESPONSAVEL" into v_area, v_responsavel
    from public."TB_COORDENACAO" c where c."CO_COORDENACAO" = p_coordenacao;
  if v_area is null then return '{}'; end if;

  select coalesce(array_agg(distinct public.analises_norm_key(u."NO_UNIDADE")), '{}') into v_unidades
    from public."RL_COORDENACAO_UNIDADE" u where u."CO_COORDENACAO" = p_coordenacao;
  v_tem_editais := exists (select 1 from public."RL_COORDENACAO_EDITAL" e where e."CO_COORDENACAO" = p_coordenacao);

  -- Sem regra e sem editais: a área inteira (o recorte de área já cobre).
  if v_responsavel is null and cardinality(v_unidades) = 0 and not v_tem_editais then
    return null;
  end if;

  return coalesce(array(
    select m.id
      from public."TB_MONITORAMENTO_INDIGENA" m
     where m."CO_AREA" = v_area
       and (
         m.id in (select e."CO_EDITAL" from public."RL_COORDENACAO_EDITAL" e where e."CO_COORDENACAO" = p_coordenacao)
         or (
           (v_responsavel is not null or cardinality(v_unidades) > 0)
           and (v_responsavel is null or upper(btrim(coalesce(m.responsavel, ''))) = v_responsavel)
           and (cardinality(v_unidades) = 0 or public.analises_norm_key(m.unidade) = any (v_unidades))
         )
       )
  ), '{}');
end;
$$;
comment on function private."FC_EDITAIS_DA_COORDENACAO"(text) is
  'Editais visíveis para a coordenação (uuid[]); null = sem recorte além da área.';

create function private."FC_EDITAIS_VISIVEIS"()
returns uuid[]
language sql
stable
security definer
set search_path to ''
as $$
  select private."FC_EDITAIS_DA_COORDENACAO"(private."FC_COORDENACAO_USUARIO"());
$$;
comment on function private."FC_EDITAIS_VISIVEIS"() is
  'Editais visíveis para o usuário logado pela coordenação; null = sem recorte além da área.';

create function private."FC_PODE_VER_EDITAL"(p_edital uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from public."TB_MONITORAMENTO_INDIGENA" m
     where m.id = p_edital
       and m."CO_AREA" = any (private."FC_AREAS_USUARIO"())
       and (private."FC_EDITAIS_VISIVEIS"() is null or m.id = any (private."FC_EDITAIS_VISIVEIS"()))
  );
$$;
comment on function private."FC_PODE_VER_EDITAL"(uuid) is
  'O usuário logado vê o edital (área + coordenação)? Edital inexistente = false.';

create function private."FC_EDITAIS_NORM_VISIVEIS"()
returns text[]
language sql
stable
security definer
set search_path to ''
as $$
  select case when v.ids is null then null else coalesce((
    select array_agg(distinct public.analises_norm_key(m.edital))
      from public."TB_MONITORAMENTO_INDIGENA" m
     where m.id = any (v.ids) and nullif(btrim(m.edital), '') is not null), '{}') end
  from (select private."FC_EDITAIS_VISIVEIS"() ids) v;
$$;
comment on function private."FC_EDITAIS_NORM_VISIVEIS"() is
  'Texto normalizado (analises_norm_key) dos editais visíveis, para recortar análises; null = sem recorte.';

create function private."FC_UNIDADES_NORM_VISIVEIS"()
returns text[]
language sql
stable
security definer
set search_path to ''
as $$
  select case when private."FC_EDITAIS_VISIVEIS"() is null then null else coalesce((
    select array_agg(distinct public.analises_norm_key(u."NO_UNIDADE"))
      from public."RL_COORDENACAO_UNIDADE" u
     where u."CO_COORDENACAO" = private."FC_COORDENACAO_USUARIO"()), '{}') end;
$$;
comment on function private."FC_UNIDADES_NORM_VISIVEIS"() is
  'Unidades normalizadas da coordenação do usuário, para recortar análises; null = sem recorte.';

revoke all on function
  private."FC_COORDENACAO_USUARIO"(), private."FC_AREAS_DO_PERFIL"(uuid),
  private."FC_EDITAIS_DA_COORDENACAO"(text), private."FC_EDITAIS_VISIVEIS"(),
  private."FC_PODE_VER_EDITAL"(uuid), private."FC_EDITAIS_NORM_VISIVEIS"(),
  private."FC_UNIDADES_NORM_VISIVEIS"()
  from public, anon;
-- As policies rodam como o usuário: precisam de execute.
grant execute on function
  private."FC_COORDENACAO_USUARIO"(), private."FC_EDITAIS_VISIVEIS"(),
  private."FC_PODE_VER_EDITAL"(uuid), private."FC_EDITAIS_NORM_VISIVEIS"(),
  private."FC_UNIDADES_NORM_VISIVEIS"()
  to authenticated;
revoke all on function private."FC_AREAS_DO_PERFIL"(uuid), private."FC_EDITAIS_DA_COORDENACAO"(text) from authenticated;

-- 4. Policies de leitura direta -----------------------------------------------------------
drop policy "PL_MONITORAMENTO_INDIGENA_AREA" on public."TB_MONITORAMENTO_INDIGENA";
create policy "PL_MONITORAMENTO_INDIGENA_AREA" on public."TB_MONITORAMENTO_INDIGENA" as restrictive for all to authenticated
  using (
    "CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
    and ((select private."FC_EDITAIS_VISIVEIS"()) is null or id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
  )
  with check ("CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[]));

drop policy "PL_ANALISE_CURRICULAR_AREA" on public."TB_ANALISE_CURRICULAR";
create policy "PL_ANALISE_CURRICULAR_AREA" on public."TB_ANALISE_CURRICULAR" as restrictive for select to authenticated
  using (
    (select private.is_master())
    or (
      "CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
      and (
        (select private."FC_EDITAIS_VISIVEIS"()) is null
        or edital_norm = any ((select private."FC_EDITAIS_NORM_VISIVEIS"())::text[])
        or unidade_norm = any ((select private."FC_UNIDADES_NORM_VISIVEIS"())::text[])
      )
    )
  );

drop policy "PL_EDITAL_ANALISE_AREA" on public."TB_EDITAL_ANALISE";
create policy "PL_EDITAL_ANALISE_AREA" on public."TB_EDITAL_ANALISE" as restrictive for select to authenticated
  using (
    (select private.is_master())
    or (
      grupo_norm in (select public.analises_norm_key(a."NO_GRUPO_PLANILHA") from public."TB_AREA" a
                      where a."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[]))
      and (
        (select private."FC_EDITAIS_VISIVEIS"()) is null
        or edital_norm = any ((select private."FC_EDITAIS_NORM_VISIVEIS"())::text[])
        or unidade_norm = any ((select private."FC_UNIDADES_NORM_VISIVEIS"())::text[])
      )
    )
  );

-- 5. Contexto do usuário: grupo de acesso, admin global e coordenação ---------------------
-- Passa a SECURITY DEFINER: TB_COORDENACAO não tem leitura direta. Tudo aqui
-- continua resolvido pela sessão (current_profile, auth.uid()).
create or replace function public.obter_contexto_monitora()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
select jsonb_build_object('profile', to_jsonb(p) || jsonb_build_object(
    'permissoes', (select jsonb_object_agg(m, private.nivel_recurso(m)) from unnest(private."FC_RECURSOS_MODULO"()) m),
    'areas', to_jsonb(private."FC_AREAS_USUARIO"()),
    'admin_global', private.is_master(),
    'grupo', (select jsonb_build_object('codigo', a."CO_GRUPO_ACESSO", 'nome', a."NO_GRUPO_ACESSO")
                        from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = p.perfil),
    'coordenacao', (select jsonb_build_object('codigo', c."CO_COORDENACAO", 'nome', c."NO_COORDENACAO", 'area', c."CO_AREA")
                      from public."TB_COORDENACAO" c where c."CO_COORDENACAO" = p."CO_COORDENACAO")),
  'panel_ids', coalesce((select jsonb_agg(e.id::text) from public."TB_PAINEL_EXTERNO" e
    where e.ativo and private.pode_recurso('paineis') and private.pode_recurso('painel:'||e.id)), '[]'::jsonb))
from private.current_profile() p where p.id is not null and p.ativo;
$function$;

commit;
