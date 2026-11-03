-- ENSAIO de supabase/migrations/20261103120000_fechar_view_das_analises_e_admin_global_passa.sql: roda o corpo e desfaz (rollback).
-- Antes do corpo, guarda o nível de cada pessoa em cada recurso (pela FC_NIVEL_EFETIVO e pela nivel_recurso, como a
-- própria pessoa) e o pacote do Painel das análises de cada área e escopo (private."FC_MONTAR_PAINEL_ANALISE"). Depois:
--   E1. authenticated sem perfil não lê nada da view: sem privilégio (42501) e, mesmo com o SELECT devolvido dentro do
--       ensaio, 0 linhas (security_invoker: vale a RLS das tabelas);
--   E2. todo administrador global ativo passa pode_recurso nível 3 em todo módulo — em especial 'calendario',
--       'recursos' e 'acessos' — e chama listar_modelos_resposta_recurso como authenticated;
--   E3. quem não é administrador global tem os mesmos níveis de antes, em todas as pessoas × recursos;
--   E4. os pacotes do painel saem iguais aos de antes, e as RPCs que leem a view (texto, marcos, detalhe, payload)
--       respondem como authenticated; paineis_ler_fontes responde como service_role.
-- Qualquer conferência que falhe levanta exceção. O resultado (json) traz só números e verdadeiro/falso.
begin;

set local lock_timeout = '5s';

-- ═══ ANTES ═══

create temp table t_recurso on commit drop as
select distinct r as recurso
  from (select unnest(private."FC_RECURSOS_MODULO"())
        union all select g.recurso from public."TB_PERMISSAO_RECURSO" g
        union all select t."NO_RECURSO" from public."TA_GRUPO_ACESSO_RECURSO" t
        union all select 'painel:' || e.id from public."TB_PAINEL_EXTERNO" e
        union all select 'area:' || a."CO_AREA" from public."TB_AREA" a) x(r);

-- Nível pela função base, para todos os perfis (ativos ou não).
create temp table t_efetivo_antes on commit drop as
select u.id, u.perfil, r.recurso, private."FC_NIVEL_EFETIVO"(u.id, u.perfil, r.recurso) as nivel
  from public."TB_PERFIL_USUARIO" u cross join t_recurso r;

-- Nível como a própria pessoa vê (nivel_recurso com o JWT dela).
create temp table t_visto (fase text, id uuid, recurso text, nivel text) on commit drop;

create or replace function pg_temp.ensaio_niveis_vistos(p_fase text) returns void
language plpgsql as $$
declare
  u record;
begin
  for u in select p.id, p.user_id, p.email from public."TB_PERFIL_USUARIO" p loop
    perform set_config('request.jwt.claims', json_build_object(
      'sub', coalesce(u.user_id, gen_random_uuid()), 'role', 'authenticated', 'email', u.email)::text, true);
    insert into t_visto
    select p_fase, u.id, r.recurso, private.nivel_recurso(r.recurso) from t_recurso r;
  end loop;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

select pg_temp.ensaio_niveis_vistos('antes');

-- O administrador do E2: de preferência um rebaixado por permissão individual em calendario/recursos.
do $$
declare
  v_admin record;
begin
  select u.user_id, u.email into v_admin
    from public."TB_PERFIL_USUARIO" u
    join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = u.perfil
   where a."ST_ADMIN_GLOBAL" and u.ativo is true and u.user_id is not null
   order by exists (select 1 from public."TB_PERMISSAO_RECURSO" g
                     where g.perfil_usuario_id = u.id and g.recurso in ('calendario', 'recursos')
                       and g.nivel <> 'admin') desc,
            u.id
   limit 1;
  if v_admin.user_id is null then
    raise exception 'E2: nenhum administrador global ativo com login para o ensaio.';
  end if;
  perform set_config('ensaio.admin_claims', json_build_object(
    'sub', v_admin.user_id, 'role', 'authenticated', 'email', v_admin.email)::text, true);

  -- Como estava: o nível 3 do administrador escolhido antes da migration (só para o resultado).
  perform set_config('request.jwt.claims', current_setting('ensaio.admin_claims'), true);
  perform set_config('ensaio.admin_antes', json_build_object(
    'calendario', private.pode_recurso('calendario', 3),
    'recursos', private.pode_recurso('recursos', 3),
    'acessos', private.pode_recurso('acessos', 3))::text, true);
  perform set_config('request.jwt.claims', '', true);

  -- Uma linha real para o detalhe (E4).
  perform set_config('ensaio.analise_id', (
    select v.id::text from public."VW_ANALISES_DASHBOARD_BASE_TODOS" v
     order by v.ativo desc nulls last, v.id limit 1), true);
end;
$$;

create temp table t_painel_antes on commit drop as
select a."CO_AREA" as area, m."TP_ESCOPO" as escopo, m."QT_LINHAS" as qt, md5(m::text) as assinatura
  from public."TB_AREA" a,
       private."FC_MONTAR_PAINEL_ANALISE"(a."CO_AREA", array['ativo', 'inativo', 'desativadas'], false) m;

-- ═══ CORPO DA MIGRATION (início) ═══

-- 0. Guardas --------------------------------------------------------------------------------------
do $$
declare
  v_corpo text;
  v_leitor regprocedure;
begin
  if to_regclass('public."VW_ANALISES_DASHBOARD_BASE_TODOS"') is null
     or to_regclass('public."VW_ANALISES_DASHBOARD_BASE"') is null then
    raise exception 'Views das análises ausentes: aplique antes 20261022120000.';
  end if;
  if to_regprocedure('private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"(boolean)') is null then
    raise exception 'Aplique antes 20261029170000_marca_barata_das_leituras_por_versao.sql.';
  end if;

  -- FC_NIVEL_EFETIVO: a de antes (20260929121000) ou esta, já aplicada.
  select btrim(regexp_replace(p.prosrc, '\s+', ' ', 'g')) into v_corpo
    from pg_catalog.pg_proc p
   where p.oid = to_regprocedure('private."FC_NIVEL_EFETIVO"(uuid, text, text)');
  if v_corpo is null then
    raise exception 'private."FC_NIVEL_EFETIVO"(uuid, text, text) ausente.';
  end if;
  if md5(v_corpo) <> '58248431dcc1ed9181f8aa54f74c094b'
     and position('ST_ADMIN_GLOBAL' in v_corpo) = 0 then
    raise exception 'private."FC_NIVEL_EFETIVO" diferente da que esta migration conhece: confira antes de aplicar.';
  end if;

  -- Os leitores da view são os conhecidos; um novo pode depender do SELECT de authenticated.
  for v_leitor in
    select p.oid::regprocedure
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private')
       and p.prosrc like '%VW_ANALISES_DASHBOARD_BASE%'
       and p.oid not in (
         to_regprocedure('private."FC_MONTAR_PAINEL_ANALISE"(text, text[], boolean)'),
         to_regprocedure('public.paineis_ler_fontes(text, text)'),
         to_regprocedure('public.get_analise_detalhe_do_painel(uuid)'),
         to_regprocedure('public.get_analises_texto_do_painel(text, text)'),
         to_regprocedure('public.obter_marcos_da_area(text)'))
  loop
    raise exception 'Leitor da view das análises que esta migration não conhece: %', v_leitor;
  end loop;

  -- O leitor SECURITY INVOKER não pode ser chamado por authenticated/anon/service_role direto.
  if has_function_privilege('authenticated', 'private."FC_MONTAR_PAINEL_ANALISE"(text, text[], boolean)', 'execute')
     or has_function_privilege('anon', 'private."FC_MONTAR_PAINEL_ANALISE"(text, text[], boolean)', 'execute') then
    raise exception 'private."FC_MONTAR_PAINEL_ANALISE" executável por authenticated/anon: revise antes.';
  end if;
  -- Os SECURITY DEFINER leem como uma dona com BYPASSRLS.
  if exists (
    select 1
      from pg_catalog.pg_proc p
      join pg_catalog.pg_roles r on r.oid = p.proowner
     where p.oid in (
             to_regprocedure('public.paineis_ler_fontes(text, text)'),
             to_regprocedure('public.get_analise_detalhe_do_painel(uuid)'),
             to_regprocedure('public.get_analises_texto_do_painel(text, text)'),
             to_regprocedure('public.obter_marcos_da_area(text)'),
             to_regprocedure('public.atualizar_cache_painel_analises(text, text[])'),
             to_regprocedure('public.get_analises_dashboard_payload_v2(text, text)'))
       and not (p.prosecdef and (r.rolbypassrls or r.rolsuper))) then
    raise exception 'Leitor da view das análises que não é SECURITY DEFINER de dona com BYPASSRLS.';
  end if;
end;
$$;

-- 1. As views das análises: invoker e só por RPC ------------------------------------------------
alter view public."VW_ANALISES_DASHBOARD_BASE_TODOS" set (security_invoker = true);
alter view public."VW_ANALISES_DASHBOARD_BASE" set (security_invoker = true);

revoke all on public."VW_ANALISES_DASHBOARD_BASE_TODOS" from public, anon, authenticated;
revoke all on public."VW_ANALISES_DASHBOARD_BASE" from public, anon, authenticated;

comment on view public."VW_ANALISES_DASHBOARD_BASE_TODOS" is
  'Base do Painel das análises (todas as situações). security_invoker; sem acesso de anon/authenticated: '
  'lida só pelas RPCs SECURITY DEFINER (painel, texto, detalhe, marcos) e pelo job via paineis_ler_fontes. '
  'Ao recriar com CREATE OR REPLACE VIEW, repetir WITH (security_invoker = true).';
comment on view public."VW_ANALISES_DASHBOARD_BASE" is
  'Recorte ativo da VW_ANALISES_DASHBOARD_BASE_TODOS. security_invoker; sem acesso de anon/authenticated.';

-- 2. Nível efetivo: o administrador global é admin em todo recurso ----------------------------
create or replace function private."FC_NIVEL_EFETIVO"(p_perfil_usuario uuid, p_grupo text, p_recurso text)
 returns text
 language sql
 stable security definer
 set search_path to ''
as $function$
  -- Administrador global faz tudo: o maior nível, acima da permissão individual e do grupo.
  select case
    when exists (select 1 from public."TB_GRUPO_ACESSO" a
                  where a."CO_GRUPO_ACESSO" = p_grupo and a."ST_ADMIN_GLOBAL") then 'admin'
    else coalesce(
      (select g.nivel from public."TB_PERMISSAO_RECURSO" g
        where g.perfil_usuario_id = p_perfil_usuario and g.recurso = p_recurso),
      private."FC_NIVEL_DO_GRUPO"(p_grupo, p_recurso))
  end;
$function$;

revoke all on function private."FC_NIVEL_EFETIVO"(uuid, text, text) from public, anon, authenticated;

comment on function private."FC_NIVEL_EFETIVO"(uuid, text, text) is
  'Nível efetivo de um usuário: administrador global (grupo ST_ADMIN_GLOBAL) = admin; senão a exceção '
  '(TB_PERMISSAO_RECURSO) ?? o nível do grupo.';

-- 3. As leituras por versão (20261029170000) ----------------------------------------------------
-- No ensaio, sem criar gatilhos (TB_GRUPO_ACESSO já é fonte); a migration chama com o padrão.
select private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"(p_gatilhos => false);

-- ═══ CORPO DA MIGRATION (fim) ═══

-- ═══ CONFERÊNCIAS ═══

-- E1. A view: invoker, sem privilégio para anon/authenticated -----------------------------------
do $$
begin
  if not exists (select 1 from pg_catalog.pg_class c
                  where c.oid = 'public."VW_ANALISES_DASHBOARD_BASE_TODOS"'::regclass
                    and 'security_invoker=true' = any (c.reloptions))
     or not exists (select 1 from pg_catalog.pg_class c
                     where c.oid = 'public."VW_ANALISES_DASHBOARD_BASE"'::regclass
                       and 'security_invoker=true' = any (c.reloptions)) then
    raise exception 'E1: as views não ficaram security_invoker.';
  end if;
  if has_table_privilege('authenticated', 'public."VW_ANALISES_DASHBOARD_BASE_TODOS"', 'select')
     or has_table_privilege('anon', 'public."VW_ANALISES_DASHBOARD_BASE_TODOS"', 'select')
     or has_table_privilege('authenticated', 'public."VW_ANALISES_DASHBOARD_BASE"', 'select')
     or has_table_privilege('anon', 'public."VW_ANALISES_DASHBOARD_BASE"', 'select') then
    raise exception 'E1: anon/authenticated ainda leem as views.';
  end if;
  if not has_table_privilege('service_role', 'public."VW_ANALISES_DASHBOARD_BASE_TODOS"', 'select') then
    raise exception 'E1: service_role perdeu a leitura da view.';
  end if;
end;
$$;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-00000000e1e1","role":"authenticated","email":"ensaio.sem.perfil@ensaio.invalid"}', true);
set local role authenticated;

do $$
declare
  v_qt bigint;
begin
  begin
    select count(*) into v_qt from public."VW_ANALISES_DASHBOARD_BASE_TODOS";
    raise exception 'E1: authenticated sem perfil leu % linha(s) da view.', v_qt;
  exception when insufficient_privilege then
    perform set_config('ensaio.e1_sem_privilegio', 'true', true);
  end;
  begin
    select count(*) into v_qt from public."VW_ANALISES_DASHBOARD_BASE";
    raise exception 'E1: authenticated sem perfil leu % linha(s) da view ativa.', v_qt;
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;

-- Mesmo que alguém devolva o SELECT: com security_invoker vale a RLS das tabelas (0 linhas sem perfil).
grant select on public."VW_ANALISES_DASHBOARD_BASE_TODOS" to authenticated;
set local role authenticated;

do $$
declare
  v_view bigint;
  v_tabela bigint;
begin
  select count(*) into v_view from public."VW_ANALISES_DASHBOARD_BASE_TODOS";
  select count(*) into v_tabela from public."TB_ANALISE_CURRICULAR";
  if v_view <> 0 then
    raise exception 'E1: com o SELECT devolvido, authenticated sem perfil leu % linha(s) da view (tabela: %).', v_view, v_tabela;
  end if;
  perform set_config('ensaio.e1_linhas_com_grant', v_view::text, true);
end;
$$;

reset role;
revoke select on public."VW_ANALISES_DASHBOARD_BASE_TODOS" from authenticated;
select set_config('request.jwt.claims', '', true);

-- E2. O administrador global passa nível 3 em todo módulo --------------------------------------
do $$
declare
  u record;
  v_falhas text[] := '{}';
  v_admins int := 0;
begin
  for u in
    select p.user_id, p.email
      from public."TB_PERFIL_USUARIO" p
      join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
     where a."ST_ADMIN_GLOBAL" and p.ativo is true
  loop
    v_admins := v_admins + 1;
    perform set_config('request.jwt.claims', json_build_object(
      'sub', coalesce(u.user_id, gen_random_uuid()), 'role', 'authenticated', 'email', u.email)::text, true);
    if not private.is_master() then
      raise exception 'E2: is_master() falso para um administrador global ativo.';
    end if;
    select v_falhas || coalesce(array_agg(r.recurso), '{}') into v_falhas
      from (select unnest(private."FC_RECURSOS_MODULO"() || array['calendario', 'recursos', 'acessos']) as recurso) r
     where not private.pode_recurso(r.recurso, 3);
  end loop;
  perform set_config('request.jwt.claims', '', true);
  if v_admins = 0 then
    raise exception 'E2: nenhum administrador global ativo.';
  end if;
  if cardinality(v_falhas) > 0 then
    raise exception 'E2: administrador global sem nível 3 em: %', array_to_string(v_falhas, ', ');
  end if;
  perform set_config('ensaio.e2_admins', v_admins::text, true);
end;
$$;

select set_config('request.jwt.claims', current_setting('ensaio.admin_claims'), true);
set local role authenticated;

do $$
begin
  if not (private.pode_recurso('calendario', 3) and private.pode_recurso('recursos', 3)
          and private.pode_recurso('acessos', 3)) then
    raise exception 'E2: como authenticated, o administrador não passa nível 3 em calendario/recursos/acessos.';
  end if;
  -- RPC de nível 3 de recursos (antes recusava o administrador rebaixado).
  perform public.listar_modelos_resposta_recurso();
end;
$$;

reset role;
select set_config('request.jwt.claims', '', true);

-- E3. Quem não é administrador global: mesmos níveis --------------------------------------------
select pg_temp.ensaio_niveis_vistos('depois');

do $$
declare
  v_base_mudou bigint;
  v_visto_mudou bigint;
  v_admin_mudou bigint;
  v_pares bigint;
begin
  select count(*) into v_base_mudou
    from t_efetivo_antes x
    join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = x.perfil
   where not a."ST_ADMIN_GLOBAL"
     and private."FC_NIVEL_EFETIVO"(x.id, x.perfil, x.recurso) is distinct from x.nivel;

  select count(*) filter (where not coalesce(a."ST_ADMIN_GLOBAL", false)),
         count(*) filter (where a."ST_ADMIN_GLOBAL"),
         (select count(*) from t_visto where fase = 'antes')
    into v_visto_mudou, v_admin_mudou, v_pares
    from t_visto antes
    join t_visto depois on depois.fase = 'depois' and depois.id = antes.id and depois.recurso = antes.recurso
    join public."TB_PERFIL_USUARIO" p on p.id = antes.id
    left join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
   where antes.fase = 'antes' and depois.nivel is distinct from antes.nivel;

  if v_base_mudou > 0 or v_visto_mudou > 0 then
    raise exception 'E3: % nível(is) de quem não é administrador global mudaram (FC_NIVEL_EFETIVO: %).',
      v_visto_mudou, v_base_mudou;
  end if;
  if (select count(*) from t_visto where fase = 'depois') <> v_pares then
    raise exception 'E3: a conferência depois não cobriu as mesmas pessoas × recursos.';
  end if;
  perform set_config('ensaio.e3_pares', v_pares::text, true);
  perform set_config('ensaio.e3_admin_mudou', v_admin_mudou::text, true);
end;
$$;

-- E4. O painel continua montando, igual ---------------------------------------------------------
do $$
declare
  v_diferentes bigint;
  v_linhas bigint;
begin
  select count(*) into v_diferentes
    from t_painel_antes x
    full join (
      select a."CO_AREA" as area, m."TP_ESCOPO" as escopo, md5(m::text) as assinatura
        from public."TB_AREA" a,
             private."FC_MONTAR_PAINEL_ANALISE"(a."CO_AREA", array['ativo', 'inativo', 'desativadas'], false) m) y
      on y.area = x.area and y.escopo = x.escopo
   where x.assinatura is distinct from y.assinatura;
  select coalesce(sum(qt), 0) into v_linhas from t_painel_antes;
  if v_linhas = 0 then
    raise exception 'E4: o pacote do painel não tinha linhas antes (ensaio sem dados).';
  end if;
  if v_diferentes > 0 then
    raise exception 'E4: % pacote(s) do painel mudaram depois da migration.', v_diferentes;
  end if;
  perform set_config('ensaio.e4_linhas', v_linhas::text, true);
end;
$$;

-- As RPCs que leem a view, como o administrador (authenticated).
select set_config('request.jwt.claims', current_setting('ensaio.admin_claims'), true);
set local role authenticated;

do $$
begin
  if public.get_analises_texto_do_painel('ativo', 'saude-indigena') is null then
    raise exception 'E4: get_analises_texto_do_painel vazio.';
  end if;
  if public.obter_marcos_da_area('saude-indigena') is null then
    raise exception 'E4: obter_marcos_da_area vazio.';
  end if;
  if public.get_analise_detalhe_do_painel(current_setting('ensaio.analise_id')::uuid) is null then
    raise exception 'E4: get_analise_detalhe_do_painel vazio.';
  end if;
  if public.get_analises_dashboard_payload_v2('ativo', 'projetos') is null then
    raise exception 'E4: get_analises_dashboard_payload_v2 vazio.';
  end if;
end;
$$;

reset role;

-- O job Python lê como service_role.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;

do $$
begin
  if public.paineis_ler_fontes('ANALISES', 'projetos') is null then
    raise exception 'E4: paineis_ler_fontes vazio para service_role.';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claims', '', true);

-- ═══ RESULTADO ═══
select json_build_object(
  'e1_authenticated_sem_privilegio', current_setting('ensaio.e1_sem_privilegio', true)::boolean,
  'e1_linhas_mesmo_com_grant', current_setting('ensaio.e1_linhas_com_grant', true)::int,
  'e2_admin_antes_nivel_3', current_setting('ensaio.admin_antes', true)::json,
  'e2_admins_conferidos', current_setting('ensaio.e2_admins', true)::int,
  'e3_pares_pessoa_recurso', current_setting('ensaio.e3_pares', true)::int,
  'e3_niveis_de_admin_que_subiram', current_setting('ensaio.e3_admin_mudou', true)::int,
  'e4_linhas_do_painel', current_setting('ensaio.e4_linhas', true)::int,
  'e4_pacotes_iguais', true
) as resultado;

rollback;
