-- ENSAIO de supabase/migrations/20261103230000_presenca_enxuta.sql: roda o corpo e desfaz (rollback).
-- Como administrador global, Gestor e pessoa sem permissão: a batida com a lista e eventos de carona,
-- a chamada só com os nove nomes de antes (front já publicado), a lista igual à de
-- listar_presenca_online_monitora, o limite de 6 min ("online" a 5 min, fora a 7 min) e o que ficou
-- em TL_EVENTO_ACESSO. Sem carga em lote: só as poucas linhas das chamadas, desfeitas no fim.
-- O resultado (json) traz só números e verdadeiro/falso.
begin;

set local statement_timeout = '60s';

-- ═══ CORPO DA MIGRATION (início) ═══

set local lock_timeout = '5s';

do $$
begin
  if to_regprocedure('public.registrar_presenca_monitora(text)') is null
     or to_regprocedure('public.registrar_evento_acesso(text, text, text, jsonb, text, text, text)') is null
     or to_regprocedure('public.listar_presenca_online_monitora()') is null
     or to_regprocedure('private.is_master()') is null then
    raise exception 'Faltam as RPCs de presença, auditoria ou a verificação do administrador global.';
  end if;
end;
$$;

-- 1. "Online" por 6 min (duas batidas de 150 s e um minuto de folga) ------------------------------
create or replace function public.listar_presenca_online_monitora()
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
declare
  v_result jsonb;
  v_user_id uuid := (select auth.uid());
  v_email text := coalesce((select auth.jwt() ->> 'email'), '');
begin
  if v_user_id is null then
    raise exception 'Sessão não localizada.' using errcode = '28000';
  end if;

  if not (
    private.is_master()
    or exists (
      select 1 from public."TB_PERFIL_USUARIO" p
       where p.ativo is true
         and lower(coalesce(p.perfil, '')) = 'edital_gestor'
         and (p.user_id = v_user_id or lower(p.email) = lower(v_email))
    )
  ) then
    raise exception 'Acesso restrito ao administrador global e ao Gestor.'
      using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(person) order by person."fullName", person."userId"), '[]'::jsonb)
    into v_result
    from (
      select po.user_id as "userId",
             coalesce(nullif(trim(p.nome), ''), split_part(coalesce(p.email, ''), '@', 1), 'Usuário AgSUS') as "fullName",
             coalesce(case when p.avatar_source in ('GOOGLE', 'UPLOADED') then p.avatar_url end,
                      p.google_avatar_url) as "avatarUrl",
             initcap(coalesce(nullif(p.perfil, ''), 'Usuário')) as "profileLabel",
             po.current_view as "currentView",
             po.seen_at as "onlineAt"
        from public."TB_PRESENCA_ONLINE_MONITORA" po
        join lateral (
          select profile.* from public."TB_PERFIL_USUARIO" profile
           where profile.ativo is true
             and (profile.user_id = po.user_id
                  or lower(profile.email) = lower(coalesce(
                    (select email from auth.users where id = po.user_id), '')))
           order by case when profile.user_id = po.user_id then 0 else 1 end,
                    profile.updated_at desc nulls last
           limit 1
        ) p on true
       where po.seen_at > timezone('utc', now()) - interval '6 minutes'
       order by po.seen_at desc
       limit 200
    ) person;
  return v_result;
end;
$function$;

comment on function public.listar_presenca_online_monitora() is
  'Quem está online agora: presença nos últimos 6 min (a batida é a cada 150 s; uma perdida não derruba ninguém). Só administrador global ou Gestor.';

-- 2. A batida numa chamada: presença, eventos e, se pedida, a lista ------------------------------
drop function if exists public.registrar_navegacao_monitora(text, text, jsonb, text, text, text, text, boolean, text);

create function public.registrar_navegacao_monitora(
  p_evento text default null,
  p_tela text default null,
  p_detalhes jsonb default '{}'::jsonb,
  p_client_session_id text default null,
  p_user_agent text default null,
  p_app_version text default null,
  p_origem text default 'index',
  p_presenca boolean default true,
  p_current_view text default null,
  p_eventos jsonb default null,
  p_listar boolean default false
)
 returns jsonb
 language plpgsql
 security invoker
 set search_path to ''
 set statement_timeout to '3s'
as $function$
declare
  v_evento_id bigint;
  v_eventos bigint[] := '{}';
  v_item jsonb;
  v_presenca jsonb := '{}'::jsonb;
  v_resposta jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sessao nao localizada.' using errcode = '28000';
  end if;

  -- O mesmo registro de registrar_evento_acesso (TL_EVENTO_ACESSO).
  if nullif(btrim(p_evento), '') is not null then
    v_evento_id := public.registrar_evento_acesso(
      p_evento, p_tela, p_origem, p_detalhes,
      p_client_session_id, p_user_agent, p_app_version
    );
  end if;

  -- Eventos de carona (até 10), cada um a mesma linha; um recusado não desfaz o resto.
  if jsonb_typeof(p_eventos) = 'array' then
    for v_item in
      select t.e from jsonb_array_elements(p_eventos) with ordinality as t(e, n) where t.n <= 10
    loop
      continue when jsonb_typeof(v_item) <> 'object'
                 or nullif(btrim(v_item ->> 'evento'), '') is null;
      begin
        v_eventos := v_eventos || public.registrar_evento_acesso(
          v_item ->> 'evento',
          coalesce(nullif(btrim(v_item ->> 'tela'), ''), p_tela),
          coalesce(nullif(btrim(v_item ->> 'origem'), ''), p_origem),
          case when jsonb_typeof(v_item -> 'detalhes') = 'object' then v_item -> 'detalhes' else '{}'::jsonb end,
          coalesce(nullif(btrim(v_item ->> 'client_session_id'), ''), p_client_session_id),
          p_user_agent,
          coalesce(nullif(btrim(v_item ->> 'app_version'), ''), p_app_version)
        );
      exception when others then
        null;
      end;
    end loop;
  end if;

  -- A mesma linha de registrar_presenca_monitora; a falha dela não desfaz os eventos.
  if p_presenca then
    begin
      v_presenca := public.registrar_presenca_monitora(p_current_view);
    exception when others then
      v_presenca := jsonb_build_object(
        'presenca_erro', jsonb_build_object('codigo', sqlstate, 'mensagem', sqlerrm)
      );
    end;
  end if;

  v_resposta := coalesce(v_presenca, '{}'::jsonb) || jsonb_build_object('evento_id', v_evento_id);
  if cardinality(v_eventos) > 0 then
    v_resposta := v_resposta || jsonb_build_object('eventos_ids', to_jsonb(v_eventos));
  end if;

  -- "Pessoas online" de carona: a mesma função, com a mesma permissão.
  if p_listar then
    begin
      v_resposta := v_resposta
        || jsonb_build_object('pessoas', public.listar_presenca_online_monitora());
    exception when others then
      v_resposta := v_resposta || jsonb_build_object(
        'pessoas_erro', jsonb_build_object('codigo', sqlstate, 'mensagem', sqlerrm)
      );
    end;
  end if;

  return v_resposta;
end;
$function$;

comment on function public.registrar_navegacao_monitora(text, text, jsonb, text, text, text, text, boolean, text, jsonb, boolean) is
  'A batida e a navegação numa chamada: o evento de auditoria (registrar_evento_acesso), até 10 eventos de carona (p_eventos), a presença (registrar_presenca_monitora, com a versão do catálogo de abas) e, com p_listar, a lista de Pessoas online (listar_presenca_online_monitora). Falha da presença volta em presenca_erro e a da lista em pessoas_erro; nenhuma desfaz os eventos.';

revoke all on function public.registrar_navegacao_monitora(text, text, jsonb, text, text, text, text, boolean, text, jsonb, boolean) from public, anon;
grant execute on function public.registrar_navegacao_monitora(text, text, jsonb, text, text, text, text, boolean, text, jsonb, boolean) to authenticated;

-- ═══ CORPO DA MIGRATION (fim) ═══

create temp table t_ensaio (chave text primary key, valor jsonb) on commit drop;
grant all on t_ensaio to authenticated;

-- Quem conferir: administrador global, Gestor (sem ser administrador global) e pessoa comum,
-- o perfil mais recente de cada tipo.
create temp table t_pessoas on commit drop as
select distinct on (tipo) tipo, user_id, email from (
  select case
           when g."ST_ADMIN_GLOBAL" then 'admin_global'
           when lower(p.perfil) = 'edital_gestor' then 'gestor'
           else 'comum'
         end tipo,
         p.user_id, p.email, p.updated_at
    from public."TB_PERFIL_USUARIO" p
    join public."TB_GRUPO_ACESSO" g on g."CO_GRUPO_ACESSO" = p.perfil
   where p.ativo and p.user_id is not null
) x
order by tipo, updated_at desc nulls last;
grant select on t_pessoas to authenticated;
insert into t_ensaio select 'pessoas_do_ensaio', jsonb_object_agg(tipo, true) from t_pessoas;

create or replace function pg_temp.conferir(p_tipo text) returns void language plpgsql as $f$
declare
  v_inicio timestamptz;
  v_r jsonb;
  v_lista jsonb;
  v_ms numeric;
begin
  -- A batida com a lista e três eventos de carona (um válido, um escalar e um sem nome).
  v_inicio := clock_timestamp();
  v_r := public.registrar_navegacao_monitora(
    p_client_session_id => 'ensaio', p_user_agent => 'ensaio', p_app_version => 'ensaio',
    p_current_view => 'Recursos · SEDE',
    p_eventos => jsonb_build_array(
      jsonb_build_object('evento', 'frontend_performance', 'tela', 'monitora', 'origem', 'frontend',
                         'detalhes', jsonb_build_object('ensaio', true),
                         'client_session_id', 'performance-monitor', 'app_version', 'frontend-performance-v1'),
      1,
      jsonb_build_object('evento', '')),
    p_listar => true);
  v_ms := round(extract(epoch from clock_timestamp() - v_inicio) * 1000, 1);
  begin
    v_lista := public.listar_presenca_online_monitora();
  exception when others then
    v_lista := null;
  end;
  insert into t_ensaio values ('batida_' || p_tipo, jsonb_build_object(
    'ms', v_ms,
    'status', v_r ->> 'status',
    'tem_versao_do_catalogo', v_r ? 'versao_do_catalogo',
    'eventos_gravados', jsonb_array_length(coalesce(v_r -> 'eventos_ids', '[]')),
    'evento_principal', v_r -> 'evento_id',
    'pessoas', case when jsonb_typeof(v_r -> 'pessoas') = 'array' then jsonb_array_length(v_r -> 'pessoas') end,
    'pessoas_igual_a_listar', v_lista is not null and (v_r -> 'pessoas') is not distinct from v_lista,
    'eu_na_lista', exists (select 1 from jsonb_array_elements(case when jsonb_typeof(v_r -> 'pessoas') = 'array' then v_r -> 'pessoas' else '[]' end) e
                            where e ->> 'userId' = auth.uid()::text),
    'pessoas_erro', v_r #>> '{pessoas_erro,codigo}',
    'presenca_erro', v_r #>> '{presenca_erro,codigo}'));

  -- O front já publicado: só os nove nomes de antes (sem p_eventos, sem p_listar).
  v_r := public.registrar_navegacao_monitora(
    p_evento => 'abertura_tela', p_tela => 'aprovados', p_detalhes => '{"ensaio":true}'::jsonb,
    p_client_session_id => 'ensaio', p_user_agent => 'ensaio', p_app_version => 'ensaio',
    p_origem => 'index', p_presenca => true, p_current_view => 'Lista de aprovados · SEDE');
  insert into t_ensaio values ('nove_nomes_' || p_tipo, jsonb_build_object(
    'status', v_r ->> 'status',
    'evento', jsonb_typeof(v_r -> 'evento_id') = 'number',
    'sem_lista', not (v_r ? 'pessoas') and not (v_r ? 'pessoas_erro')));
end;
$f$;
grant execute on function pg_temp.conferir(text) to authenticated;

select set_config('request.jwt.claims', json_build_object('sub', user_id, 'email', email, 'role', 'authenticated')::text, true),
       set_config('request.jwt.claim.sub', user_id::text, true)
  from t_pessoas where tipo = 'admin_global';
set local role authenticated;
select pg_temp.conferir('admin_global');
reset role;

select set_config('request.jwt.claims', json_build_object('sub', user_id, 'email', email, 'role', 'authenticated')::text, true),
       set_config('request.jwt.claim.sub', user_id::text, true)
  from t_pessoas where tipo = 'gestor';
set local role authenticated;
select pg_temp.conferir('gestor') from t_pessoas where tipo = 'gestor';
reset role;

select set_config('request.jwt.claims', json_build_object('sub', user_id, 'email', email, 'role', 'authenticated')::text, true),
       set_config('request.jwt.claim.sub', user_id::text, true)
  from t_pessoas where tipo = 'comum';
set local role authenticated;
select pg_temp.conferir('comum');
reset role;

-- O limite de 6 min: a pessoa comum vista há 5 min conta; há 7 min, não (lido como administrador global).
create or replace function pg_temp.na_lista(p_user uuid) returns boolean language sql as $f$
  select exists (select 1 from jsonb_array_elements(public.listar_presenca_online_monitora()) e
                  where e ->> 'userId' = p_user::text);
$f$;
grant execute on function pg_temp.na_lista(uuid) to authenticated;

update public."TB_PRESENCA_ONLINE_MONITORA" o
   set seen_at = timezone('utc', now()) - interval '5 minutes'
  from t_pessoas t where t.tipo = 'comum' and o.user_id = t.user_id;
select set_config('request.jwt.claims', json_build_object('sub', user_id, 'email', email, 'role', 'authenticated')::text, true),
       set_config('request.jwt.claim.sub', user_id::text, true)
  from t_pessoas where tipo = 'admin_global';
set local role authenticated;
insert into t_ensaio select 'online_ha_5_min', to_jsonb(pg_temp.na_lista((select user_id from t_pessoas where tipo = 'comum')));
reset role;
update public."TB_PRESENCA_ONLINE_MONITORA" o
   set seen_at = timezone('utc', now()) - interval '7 minutes'
  from t_pessoas t where t.tipo = 'comum' and o.user_id = t.user_id;
set local role authenticated;
insert into t_ensaio select 'online_ha_7_min', to_jsonb(pg_temp.na_lista((select user_id from t_pessoas where tipo = 'comum')));
reset role;

-- O que as chamadas gravaram: os eventos de carona com a origem, a aba e a versão de quem os mandou.
insert into t_ensaio
select 'gravado', jsonb_build_object(
  'eventos_de_carona', (select count(*) from public."TL_EVENTO_ACESSO" e
                         where e.created_at >= now() and e.evento = 'frontend_performance'
                           and e.origem = 'frontend' and e.client_session_id = 'performance-monitor'
                           and e.app_version = 'frontend-performance-v1' and e.user_agent = 'ensaio'
                           and e.detalhes = '{"ensaio": true}'::jsonb),
  'eventos_sem_nome', (select count(*) from public."TL_EVENTO_ACESSO" e
                        where e.created_at >= now() and e.user_agent = 'ensaio'
                          and e.evento not in ('frontend_performance', 'abertura_tela')),
  'aberturas', (select count(*) from public."TL_EVENTO_ACESSO" e
                 where e.created_at >= now() and e.evento = 'abertura_tela' and e.client_session_id = 'ensaio'),
  'presencas', (select count(*) from public."TB_PRESENCA_ONLINE_MONITORA" o
                 join t_pessoas t on t.user_id = o.user_id
                where o.current_view = 'Lista de aprovados · SEDE'));

-- Uma função só com esse nome; anon sem execute.
insert into t_ensaio
select 'assinatura', jsonb_build_object(
  'funcoes', (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'registrar_navegacao_monitora'),
  'anon_executa', has_function_privilege('anon', 'public.registrar_navegacao_monitora(text, text, jsonb, text, text, text, text, boolean, text, jsonb, boolean)', 'execute'),
  'authenticated_executa', has_function_privilege('authenticated', 'public.registrar_navegacao_monitora(text, text, jsonb, text, text, text, text, boolean, text, jsonb, boolean)', 'execute'),
  'listar_anon_executa', has_function_privilege('anon', 'public.listar_presenca_online_monitora()', 'execute'),
  'listar_authenticated_executa', has_function_privilege('authenticated', 'public.listar_presenca_online_monitora()', 'execute'));

-- Sem sessão: recusa.
do $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.registrar_navegacao_monitora(p_listar => true);
    insert into t_ensaio values ('sem_sessao', '"aceitou"');
  exception when sqlstate '28000' then
    insert into t_ensaio values ('sem_sessao', '"recusou"');
  end;
end;
$$;

select jsonb_object_agg(chave, valor order by chave) as ensaio from t_ensaio;

rollback;
