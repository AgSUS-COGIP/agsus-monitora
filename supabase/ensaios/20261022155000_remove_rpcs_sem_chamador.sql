/*
  ENSAIO de 20261022155000_remove_rpcs_sem_chamador.sql — begin … rollback.

  Cole no SQL Editor do Supabase (papel postgres). Confere:
    1. a migration tira as 7 funções sem chamador e nenhuma outra;
    2. a v1 de salvar_monitoramento_com_cronograma fica, sem EXECUTE de
       authenticated, e a _v2 (SECURITY DEFINER do postgres, a do front)
       continua executável por authenticated;
    3. o rollback devolve as 7 iguais (privilégios e corpo, sem contar o CR das quebras de linha) e o EXECUTE da v1.
  Termina em rollback: nada fica gravado.
*/
begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create temporary table ensaio_funcoes on commit drop as
  select p.oid::regprocedure::text as sig, p.proacl::text as acl, md5(replace(p.prosrc, chr(13), '')) as corpo
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('atualizar_acesso_usuario', 'get_acessos_config_master', 'set_my_avatar_choice',
                       'salvar_configuracoes_e_paineis', 'historico_do_registro', 'revogar_paineis_usuario',
                       'atualizar_indicadores_dashboard');
create temporary table ensaio_total on commit drop as
  select count(*) as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public';

do $ensaio$
begin
  assert (select count(*) from ensaio_funcoes) = 7, 'esperava 7 funções antes';
end;
$ensaio$;

-- 1. A migration (corpo de supabase/migrations/20261022155000_…).

drop function if exists public.atualizar_acesso_usuario(uuid,text,jsonb,uuid[],text);
drop function if exists public.atualizar_indicadores_dashboard(uuid);
drop function if exists public.get_acessos_config_master(integer,integer,integer);
drop function if exists public.historico_do_registro(uuid);
drop function if exists public.revogar_paineis_usuario(uuid,uuid[],text);
drop function if exists public.salvar_configuracoes_e_paineis(jsonb,jsonb);
drop function if exists public.set_my_avatar_choice(text,text,jsonb);

revoke execute on function public.salvar_monitoramento_com_cronograma(jsonb,jsonb) from public, anon, authenticated;

do $ensaio$
declare
  v_v1 oid := 'public.salvar_monitoramento_com_cronograma(jsonb,jsonb)'::regprocedure;
  v_v2 oid := 'public.salvar_monitoramento_com_cronograma_v2(jsonb,jsonb,text,text)'::regprocedure;
begin
  assert not exists (select 1 from pg_proc p join ensaio_funcoes e on p.oid::regprocedure::text = e.sig),
         'sobrou função sem chamador';
  assert (select n from ensaio_total) - 7
         = (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'),
         'outra função saiu junto';
  assert not has_function_privilege('authenticated', v_v1, 'execute'), 'v1 ainda executável por authenticated';
  assert has_function_privilege('service_role', v_v1, 'execute'), 'v1 perdeu a service_role';
  assert has_function_privilege('authenticated', v_v2, 'execute'), 'v2 perdeu authenticated';
  assert (select prosecdef and pg_get_userbyid(proowner) = 'postgres' from pg_proc where oid = v_v2),
         'v2 não é SECURITY DEFINER do postgres (não chamaria a v1)';
end;
$ensaio$;

-- 2. O rollback (corpo de supabase/rollback/20261022155000_…).

set local check_function_bodies = off;
-- public.atualizar_acesso_usuario(uuid,text,jsonb,uuid[],text)
CREATE OR REPLACE FUNCTION public.atualizar_acesso_usuario(p_perfil_usuario_id uuid, p_perfil text DEFAULT 'usuario'::text, p_permissoes jsonb DEFAULT '{}'::jsonb, p_paineis uuid[] DEFAULT '{}'::uuid[], p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_perfil text := lower(nullif(btrim(coalesce(p_perfil, '')), ''));
  v_admin boolean;
  v_email text;
begin
  if (select auth.uid()) is null then raise exception 'Usuario nao autenticado'; end if;
  if not private.is_master() then raise exception 'Somente perfil admin pode atualizar acesso de usuario'; end if;
  if v_perfil not in ('usuario', 'edital_gestor', 'contratador', 'admin') then
    raise exception 'Perfil invalido: %', v_perfil;
  end if;
  if p_perfil_usuario_id is null then raise exception 'Perfil de usuario nao informado'; end if;
  v_admin := v_perfil = 'admin';

  update public."TB_PERFIL_USUARIO"
  set perfil = v_perfil, ativo = true, p_ind = true, p_cores = true, p_paineis = true,
      p_config = v_admin, p_admin = v_admin, updated_at = now()
  where id = p_perfil_usuario_id
  returning email into v_email;
  if not found then raise exception 'Perfil de usuario nao encontrado'; end if;

  delete from public."RL_PERFIL_USUARIO_PAINEL_EXT" where perfil_usuario_id = p_perfil_usuario_id;
  insert into public."RL_PERFIL_USUARIO_PAINEL_EXT"(perfil_usuario_id, painel_id, ativo)
  select p_perfil_usuario_id, pe.id, true
  from public."TB_PAINEL_EXTERNO" pe
  where pe.ativo is true
  on conflict (perfil_usuario_id, painel_id) do update
    set ativo = true, updated_at = now();

  return jsonb_build_object(
    'ok', true, 'perfil_usuario_id', p_perfil_usuario_id, 'email', v_email,
    'perfil', v_perfil, 'motivo', nullif(btrim(p_motivo), '')
  );
end;
$function$;
revoke all on function public.atualizar_acesso_usuario(uuid,text,jsonb,uuid[],text) from public;
grant execute on function public.atualizar_acesso_usuario(uuid,text,jsonb,uuid[],text) to authenticated;

-- public.atualizar_indicadores_dashboard(uuid)
CREATE OR REPLACE FUNCTION public.atualizar_indicadores_dashboard(p_sync_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_result jsonb := jsonb_build_object('ok', false, 'sync_id', p_sync_id,
    'motivo', 'Desativada em 30/09/2026: os KPIs do edital vêm da Seleção nativa (FC_ATUALIZAR_KPIS_PELA_SELECAO). Desligue o gatilho desta planilha.');
begin
  update public."TL_SYNC_MONIT_INDIGENA"
     set status = 'ignorado', resultado = v_result, erro = null, finished_at = now(), updated_at = now()
   where sync_id = p_sync_id;
  delete from public."TM_DASHBOARD_MONIT_INDIG" where sync_id = p_sync_id;
  return v_result;
end;
$function$;
comment on function public.atualizar_indicadores_dashboard(uuid) is $comentario$Desativada (30/09/2026): registra a carga do script antigo como ignorada; os KPIs vêm da Seleção nativa.$comentario$;
revoke all on function public.atualizar_indicadores_dashboard(uuid) from public;
grant execute on function public.atualizar_indicadores_dashboard(uuid) to service_role;

-- public.get_acessos_config_master(integer,integer,integer)
CREATE OR REPLACE FUNCTION public.get_acessos_config_master(p_online_minutes integer DEFAULT 15, p_recent_limit integer DEFAULT 20, p_days integer DEFAULT 14)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
 SET statement_timeout TO '5s'
 SET lock_timeout TO '2s'
AS $function$
declare
  v_online_minutes integer := least(greatest(coalesce(p_online_minutes, 15), 1), 120);
  v_recent_limit integer := least(greatest(coalesce(p_recent_limit, 20), 1), 100);
  v_days integer := least(greatest(coalesce(p_days, 14), 1), 90);
  v_is_master boolean;
  v_result jsonb;
begin
  if not (private.is_master()) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  select exists (
    select 1
    from public."TB_PERFIL_USUARIO" p
    where p.ativo is true
      and lower(coalesce(p.perfil, '')) = 'admin'
      and (
        p.user_id = auth.uid()
        or lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  ) into v_is_master;

  if not coalesce(v_is_master, false) then
    raise exception 'Sem permissao para visualizar acessos do sistema';
  end if;

  with params as (
    select
      now() as agora_utc,
      now() at time zone 'America/Sao_Paulo' as agora_sp,
      make_interval(mins => v_online_minutes) as janela_online,
      make_interval(days => v_days) as janela_dias
  ),
  resumo_base as (
    select
      (select count(*) from auth.users where deleted_at is null) as usuarios_auth_total,
      (select count(*) from public."TB_PERFIL_USUARIO") as perfis_total,
      (select count(*) from public."TB_PERFIL_USUARIO" where ativo is true) as perfis_ativos,
      (select count(*) from public."TL_EVENTO_ACESSO") as eventos_total,
      (select count(distinct user_id) from public."TL_EVENTO_ACESSO" where user_id is not null) as usuarios_com_evento_total,
      (
        select count(distinct user_id)
        from public."TL_EVENTO_ACESSO"
        where user_id is not null
          and (created_at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date
      ) as usuarios_unicos_hoje,
      (
        select count(*)
        from public."TL_EVENTO_ACESSO"
        where (created_at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date
      ) as eventos_hoje,
      (
        select count(distinct user_id)
        from public."TL_EVENTO_ACESSO", params
        where user_id is not null
          and created_at >= params.agora_utc - params.janela_online
      ) as usuarios_online
  ),
  resumo as (
    select jsonb_build_object(
      'usuarios_auth_total', usuarios_auth_total,
      'perfis_total', perfis_total,
      'perfis_ativos', perfis_ativos,
      'eventos_total', eventos_total,
      'usuarios_com_evento_total', usuarios_com_evento_total,
      'usuarios_unicos_hoje', usuarios_unicos_hoje,
      'usuarios_hoje', usuarios_unicos_hoje,
      'eventos_hoje', eventos_hoje,
      'usuarios_online', usuarios_online,
      'online_agora', usuarios_online,
      'janela_online_minutos', v_online_minutes,
      'retencao_heartbeat_dias', 30,
      'retencao_eventos_dias', 365
    ) as dados
    from resumo_base
  ),
  online as (
    select coalesce(jsonb_agg(to_jsonb(t) order by t.ultima_atividade desc), '[]'::jsonb) as dados
    from (
      select
        e.user_id,
        coalesce(p.nome, u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', u.email) as nome,
        coalesce(p.email, u.email) as email,
        p.perfil,
        max(e.created_at) as ultima_atividade,
        max(e.created_at) as ultimo_acesso,
        max(e.created_at) at time zone 'America/Sao_Paulo' as ultima_atividade_sp,
        max(e.created_at) at time zone 'America/Sao_Paulo' as ultimo_acesso_sp,
        (array_agg(case
          when e.tela is null or btrim(e.tela) = '' then coalesce(e.evento, '-')
          when e.tela = 'dashboard' then 'Dashboard'
          when e.tela = 'config' then 'Configurações'
          when e.tela = 'nucleo' then 'Equipe Núcleo'
          when e.tela = 'analises' then 'Análises'
          when e.tela = 'oauth' then 'Login Google'
          when e.tela = 'panel:analises' then 'Painel: Análises'
          when e.tela like 'panel:%' then 'Painel: ' || initcap(replace(substring(e.tela from 7), '_', ' '))
          else initcap(replace(e.tela, '_', ' '))
        end order by e.created_at desc))[1] as ultimo_evento,
        (array_agg(e.evento order by e.created_at desc))[1] as tipo_ultimo_evento,
        (array_agg(e.tela order by e.created_at desc))[1] as ultima_tela,
        (array_agg(case
          when e.tela is null or btrim(e.tela) = '' then coalesce(e.evento, '-')
          when e.tela = 'dashboard' then 'Dashboard'
          when e.tela = 'config' then 'Configurações'
          when e.tela = 'nucleo' then 'Equipe Núcleo'
          when e.tela = 'analises' then 'Análises'
          when e.tela = 'oauth' then 'Login Google'
          when e.tela = 'panel:analises' then 'Painel: Análises'
          when e.tela like 'panel:%' then 'Painel: ' || initcap(replace(substring(e.tela from 7), '_', ' '))
          else initcap(replace(e.tela, '_', ' '))
        end order by e.created_at desc))[1] as tela_atual,
        count(*) as eventos_na_janela,
        count(*) as eventos_online
      from public."TL_EVENTO_ACESSO" e
      join params on true
      left join auth.users u on u.id = e.user_id
      left join public."TB_PERFIL_USUARIO" p on p.user_id = e.user_id
      where e.user_id is not null
        and e.created_at >= params.agora_utc - params.janela_online
      group by e.user_id, p.nome, p.email, p.perfil, u.email, u.raw_user_meta_data
      order by max(e.created_at) desc
      limit v_recent_limit
    ) t
  ),
  recentes as (
    select coalesce(jsonb_agg(to_jsonb(t) order by t.ultima_atividade desc), '[]'::jsonb) as dados
    from (
      select
        e.user_id,
        coalesce(p.nome, u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', u.email) as nome,
        coalesce(p.email, u.email) as email,
        p.perfil,
        p.ativo,
        max(e.created_at) as ultima_atividade,
        max(e.created_at) as ultimo_acesso,
        max(e.created_at) at time zone 'America/Sao_Paulo' as ultima_atividade_sp,
        max(e.created_at) at time zone 'America/Sao_Paulo' as ultimo_acesso_sp,
        (array_agg(case
          when e.tela is null or btrim(e.tela) = '' then coalesce(e.evento, '-')
          when e.tela = 'dashboard' then 'Dashboard'
          when e.tela = 'config' then 'Configurações'
          when e.tela = 'nucleo' then 'Equipe Núcleo'
          when e.tela = 'analises' then 'Análises'
          when e.tela = 'oauth' then 'Login Google'
          when e.tela = 'panel:analises' then 'Painel: Análises'
          when e.tela like 'panel:%' then 'Painel: ' || initcap(replace(substring(e.tela from 7), '_', ' '))
          else initcap(replace(e.tela, '_', ' '))
        end order by e.created_at desc))[1] as ultimo_evento,
        (array_agg(e.evento order by e.created_at desc))[1] as tipo_ultimo_evento,
        (array_agg(e.tela order by e.created_at desc))[1] as ultima_tela,
        (array_agg(case
          when e.tela is null or btrim(e.tela) = '' then coalesce(e.evento, '-')
          when e.tela = 'dashboard' then 'Dashboard'
          when e.tela = 'config' then 'Configurações'
          when e.tela = 'nucleo' then 'Equipe Núcleo'
          when e.tela = 'analises' then 'Análises'
          when e.tela = 'oauth' then 'Login Google'
          when e.tela = 'panel:analises' then 'Painel: Análises'
          when e.tela like 'panel:%' then 'Painel: ' || initcap(replace(substring(e.tela from 7), '_', ' '))
          else initcap(replace(e.tela, '_', ' '))
        end order by e.created_at desc))[1] as tela_atual,
        count(*) as total_eventos
      from public."TL_EVENTO_ACESSO" e
      left join auth.users u on u.id = e.user_id
      left join public."TB_PERFIL_USUARIO" p on p.user_id = e.user_id
      where e.user_id is not null
      group by e.user_id, p.nome, p.email, p.perfil, p.ativo, u.email, u.raw_user_meta_data
      order by max(e.created_at) desc
      limit v_recent_limit
    ) t
  ),
  por_dia as (
    select coalesce(jsonb_agg(to_jsonb(t) order by t.dia desc), '[]'::jsonb) as dados
    from (
      select
        (created_at at time zone 'America/Sao_Paulo')::date as dia,
        count(*) as eventos,
        count(distinct user_id) filter (where user_id is not null) as usuarios_unicos,
        count(distinct user_id) filter (where user_id is not null and created_at >= now() - make_interval(mins => v_online_minutes)) as online_maximo,
        count(distinct client_session_id) filter (where client_session_id is not null) as sessoes_cliente
      from public."TL_EVENTO_ACESSO", params
      where created_at >= params.agora_utc - params.janela_dias
      group by 1
      order by 1 desc
      limit v_days
    ) t
  ),
  por_evento as (
    select coalesce(jsonb_agg(to_jsonb(t) order by t.total desc), '[]'::jsonb) as dados
    from (
      select
        evento,
        count(*) as total,
        count(*) filter (where created_at >= now() - interval '7 days') as ultimos_7_dias,
        count(distinct user_id) filter (where user_id is not null) as usuarios_unicos
      from public."TL_EVENTO_ACESSO"
      group by evento
      order by total desc
      limit 20
    ) t
  ),
  armazenamento as (
    select jsonb_build_object(
      'tamanho_total', pg_size_pretty(pg_total_relation_size('public."TL_EVENTO_ACESSO"'::regclass)),
      'total_size', pg_size_pretty(pg_total_relation_size('public."TL_EVENTO_ACESSO"'::regclass)),
      'tamanho_tabela', pg_size_pretty(pg_relation_size('public."TL_EVENTO_ACESSO"'::regclass)),
      'table_size', pg_size_pretty(pg_relation_size('public."TL_EVENTO_ACESSO"'::regclass)),
      'tamanho_indices', pg_size_pretty(pg_indexes_size('public."TL_EVENTO_ACESSO"'::regclass)),
      'index_size', pg_size_pretty(pg_indexes_size('public."TL_EVENTO_ACESSO"'::regclass))
    ) as dados
  )
  select jsonb_build_object(
    'consultado_em_sp', (select agora_sp from params),
    'online_minutes', v_online_minutes,
    'resumo', (select dados from resumo),
    'online', (select dados from online),
    'usuarios_online', (select dados from online),
    'recentes', (select dados from recentes),
    'usuarios_recentes', (select dados from recentes),
    'por_dia', (select dados from por_dia),
    'estatisticas_diarias', (select dados from por_dia),
    'por_evento', (select dados from por_evento),
    'eventos_por_tipo', (select dados from por_evento),
    'armazenamento', (select dados from armazenamento)
  ) into v_result;

  return v_result;
end;
$function$;
revoke all on function public.get_acessos_config_master(integer,integer,integer) from public;
grant execute on function public.get_acessos_config_master(integer,integer,integer) to authenticated;

-- public.historico_do_registro(uuid)
CREATE OR REPLACE FUNCTION public.historico_do_registro(p_id uuid)
 RETURNS TABLE(id uuid, usuario_email text, evento text, created_at timestamp with time zone, snapshot_json jsonb)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'auth', 'private'
AS $function$
  select
    h.id,
    h.usuario_email,
    h.evento,
    h.created_at,
    h.snapshot_json
  from public."TH_MONITORAMENTO" h
  where h.id_registro = p_id
    and (
      private.has_perm('ind')
      or private.has_perm('cores')
      or private.has_perm('config')
      or private.has_perm('admin')
    )
  order by h.created_at desc
  limit 50;
$function$;
revoke all on function public.historico_do_registro(uuid) from public;
grant execute on function public.historico_do_registro(uuid) to authenticated;

-- public.revogar_paineis_usuario(uuid,uuid[],text)
CREATE OR REPLACE FUNCTION public.revogar_paineis_usuario(p_perfil_usuario_id uuid, p_paineis uuid[] DEFAULT NULL::uuid[], p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private', 'auth'
AS $function$
declare
  v_total integer := 0;
  v_restantes integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if not private.is_master() then
    raise exception 'Somente perfil master pode revogar paineis';
  end if;

  if p_perfil_usuario_id is null then
    raise exception 'Perfil de usuario nao informado';
  end if;

  if p_paineis is null or coalesce(array_length(p_paineis, 1), 0) = 0 then
    update public."RL_PERFIL_USUARIO_PAINEL_EXT"
    set ativo = false,
        updated_at = now()
    where perfil_usuario_id = p_perfil_usuario_id
      and ativo is true;
  else
    update public."RL_PERFIL_USUARIO_PAINEL_EXT"
    set ativo = false,
        updated_at = now()
    where perfil_usuario_id = p_perfil_usuario_id
      and painel_id = any(p_paineis)
      and ativo is true;
  end if;

  get diagnostics v_total = row_count;

  select count(*)::integer into v_restantes
  from public."RL_PERFIL_USUARIO_PAINEL_EXT"
  where perfil_usuario_id = p_perfil_usuario_id
    and ativo is true;

  if v_restantes = 0 then
    update public."TB_PERFIL_USUARIO"
    set p_paineis = false,
        updated_at = now()
    where id = p_perfil_usuario_id;
  end if;

  return jsonb_build_object('ok', true, 'perfil_usuario_id', p_perfil_usuario_id, 'paineis_revogados', v_total, 'paineis_ativos_restantes', v_restantes, 'motivo', nullif(btrim(p_motivo), ''));
end;
$function$;
comment on function public.revogar_paineis_usuario(uuid,uuid[],text) is $comentario$Revoga todos ou alguns paineis externos de um perfil. Nao apaga historico; marca vinculos como inativos.$comentario$;
revoke all on function public.revogar_paineis_usuario(uuid,uuid[],text) from public;
grant execute on function public.revogar_paineis_usuario(uuid,uuid[],text) to authenticated;

-- public.salvar_configuracoes_e_paineis(jsonb,jsonb)
CREATE OR REPLACE FUNCTION public.salvar_configuracoes_e_paineis(p_config_rows jsonb, p_paineis jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth'
AS $function$
declare
  r jsonb;
begin
  if not (private.pode_recurso('configuracoes',2)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if not private.has_perm('config') then
    raise exception 'Sem permissao para salvar "TB_CONFIGURACAO"';
  end if;

  for r in select * from jsonb_array_elements(coalesce(p_config_rows, '[]'::jsonb)) loop
    insert into public."TB_CONFIGURACAO"(chave, valor, descricao)
    values (r ->> 'chave', r ->> 'valor', r ->> 'descricao')
    on conflict (chave) do update
      set valor = excluded.valor,
          descricao = excluded.descricao,
          updated_at = now();
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_paineis, '[]'::jsonb)) loop
    update public."TB_PAINEL_EXTERNO"
    set titulo = coalesce(nullif(r ->> 'titulo', ''), titulo),
        url = r ->> 'url',
        ativo = coalesce((r ->> 'ativo')::boolean, ativo),
        em_manutencao = coalesce((r ->> 'em_manutencao')::boolean, em_manutencao),
        updated_at = now()
    where id = nullif(r ->> 'id', '')::uuid;
  end loop;

  return true;
end;
$function$;
revoke all on function public.salvar_configuracoes_e_paineis(jsonb,jsonb) from public;
grant execute on function public.salvar_configuracoes_e_paineis(jsonb,jsonb) to authenticated;

-- public.set_my_avatar_choice(text,text,jsonb)
CREATE OR REPLACE FUNCTION public.set_my_avatar_choice(p_source text, p_avatar_url text DEFAULT NULL::text, p_avatar_config jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(avatar_source text, avatar_url text, avatar_config jsonb, google_avatar_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
declare
  v_source text := upper(trim(coalesce(p_source, '')));
  v_url text := nullif(trim(coalesce(p_avatar_url, '')), '');
  v_config jsonb := coalesce(p_avatar_config, '{}'::jsonb);
begin
  if auth.uid() is null then
    raise exception 'Sessão não localizada.' using errcode = '28000';
  end if;

  if v_source not in ('GOOGLE', 'UPLOADED', 'GENERATED', 'INITIALS') then
    raise exception 'Origem de avatar inválida.' using errcode = '22023';
  end if;

  if v_source in ('GOOGLE', 'UPLOADED')
    and (v_url is null or v_url !~* '^https://') then
    raise exception 'A imagem selecionada precisa usar HTTPS.' using errcode = '22023';
  end if;

  if v_url is not null and length(v_url) > 2048 then
    raise exception 'URL de avatar inválida.' using errcode = '22023';
  end if;

  if jsonb_typeof(v_config) <> 'object' then
    raise exception 'Configuração de avatar inválida.' using errcode = '22023';
  end if;

  update public."TB_PERFIL_USUARIO" p
  set
    avatar_source = v_source,
    avatar_url = case
      when v_source in ('GOOGLE', 'UPLOADED') then v_url
      else null
    end,
    avatar_config = case
      when v_source = 'GENERATED' then v_config
      else p.avatar_config
    end,
    google_avatar_url = case
      when v_source = 'GOOGLE' then v_url
      else p.google_avatar_url
    end,
    updated_at = now()
  where p.ativo = true
    and (
      p.user_id = auth.uid()
      or lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );

  if not found then
    raise exception 'Perfil institucional não localizado.' using errcode = 'P0002';
  end if;

  return query
  select
    p.avatar_source,
    p.avatar_url,
    p.avatar_config,
    coalesce(
      p.google_avatar_url,
      auth.jwt() -> 'user_metadata' ->> 'avatar_url',
      auth.jwt() -> 'user_metadata' ->> 'picture'
    )
  from public."TB_PERFIL_USUARIO" p
  where p.ativo = true
    and (
      p.user_id = auth.uid()
      or lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  limit 1;
end;
$function$;
revoke all on function public.set_my_avatar_choice(text,text,jsonb) from public;
grant execute on function public.set_my_avatar_choice(text,text,jsonb) to authenticated;

grant execute on function public.salvar_monitoramento_com_cronograma(jsonb,jsonb) to authenticated;

do $ensaio$
begin
  assert not exists (
    select 1 from ensaio_funcoes e
     where not exists (select 1 from pg_proc p
                        where p.oid::regprocedure::text = e.sig
                          and p.proacl::text is not distinct from e.acl
                          and md5(replace(p.prosrc, chr(13), '')) = e.corpo)),
    'o rollback não devolveu alguma função igual';
  assert has_function_privilege('authenticated',
           'public.salvar_monitoramento_com_cronograma(jsonb,jsonb)'::regprocedure, 'execute'),
         'o rollback não devolveu o EXECUTE da v1';
end;
$ensaio$;

select 'ensaio ok' as resultado;

rollback;
