-- ENSAIO de supabase/migrations/20261029121700_navegacao_e_inicio_da_sessao_numa_chamada.sql: roda o corpo e desfaz (rollback).
-- Compara cada parte de obter_inicio_da_sessao com a consulta de antes (como administrador global e
-- como pessoa sem esse grupo, pela RLS de sempre), grava a navegação (evento + presença, só evento,
-- só presença e conta sem perfil ativo) e confere o que ficou em TL_EVENTO_ACESSO e
-- TB_PRESENCA_ONLINE_MONITORA. O resultado (json) traz só números e verdadeiro/falso.
begin;

-- ═══ CORPO DA MIGRATION (início) ═══

set local lock_timeout = '5s';

do $$
begin
  if to_regprocedure('public.registrar_presenca_monitora(text)') is null
     or to_regprocedure('public.registrar_evento_acesso(text, text, text, jsonb, text, text, text)') is null
     or to_regprocedure('public.listar_abas_do_menu()') is null
     or to_regprocedure('public.obter_situacao_do_sistema()') is null then
    raise exception 'Faltam as RPCs de presença, auditoria, catálogo de abas ou situação do sistema.';
  end if;
end;
$$;

-- 1. A navegação numa chamada: o evento de auditoria e a presença ---------------------------------
create or replace function public.registrar_navegacao_monitora(
  p_evento text default null,
  p_tela text default null,
  p_detalhes jsonb default '{}'::jsonb,
  p_client_session_id text default null,
  p_user_agent text default null,
  p_app_version text default null,
  p_origem text default 'index',
  p_presenca boolean default true,
  p_current_view text default null
)
 returns jsonb
 language plpgsql
 security invoker
 set search_path to ''
 set statement_timeout to '3s'
as $function$
declare
  v_evento_id bigint;
  v_presenca jsonb := '{}'::jsonb;
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

  -- A mesma linha de registrar_presenca_monitora; a falha dela não desfaz o evento.
  if p_presenca then
    begin
      v_presenca := public.registrar_presenca_monitora(p_current_view);
    exception when others then
      v_presenca := jsonb_build_object(
        'presenca_erro', jsonb_build_object('codigo', sqlstate, 'mensagem', sqlerrm)
      );
    end;
  end if;

  return coalesce(v_presenca, '{}'::jsonb) || jsonb_build_object('evento_id', v_evento_id);
end;
$function$;

comment on function public.registrar_navegacao_monitora(text, text, jsonb, text, text, text, text, boolean, text) is
  'Uma chamada por navegação: o evento de auditoria (registrar_evento_acesso) e a presença (registrar_presenca_monitora, com a versão do catálogo de abas). Falha da presença volta em presenca_erro e não desfaz o evento.';

revoke all on function public.registrar_navegacao_monitora(text, text, jsonb, text, text, text, text, boolean, text) from public, anon;
grant execute on function public.registrar_navegacao_monitora(text, text, jsonb, text, text, text, text, boolean, text) to authenticated;

-- 2. O início da sessão numa chamada --------------------------------------------------------------
create or replace function public.obter_inicio_da_sessao()
 returns jsonb
 language plpgsql
 stable
 security invoker
 set search_path to ''
 set statement_timeout to '5s'
as $function$
begin
  if auth.uid() is null then
    raise exception 'Sessao nao localizada.' using errcode = '28000';
  end if;

  return jsonb_build_object(
    'configuracao', coalesce((
      select jsonb_agg(jsonb_build_object(
               'chave', c.chave, 'valor', c.valor, 'descricao', c.descricao))
        from public."TB_CONFIGURACAO" c
    ), '[]'::jsonb),
    'paineis', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'codigo', p.codigo, 'titulo', p.titulo, 'icone', p.icone,
               'url', p.url, 'ordem', p.ordem, 'ativo', p.ativo,
               'em_manutencao', p.em_manutencao, 'tipo_abertura', p.tipo_abertura)
             order by p.ordem)
        from public."TB_PAINEL_EXTERNO" p
    ), '[]'::jsonb),
    'abas', public.listar_abas_do_menu()::jsonb,
    'situacao', public.obter_situacao_do_sistema()::jsonb,
    'unidades', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id_unidade', u.id_unidade, 'sigla', u.sigla,
               'nome_oficial', u.nome_oficial, 'tipo', u.tipo,
               'uf_sede', u.uf_sede, 'ativo', u.ativo)
             order by u.tipo, u.nome_oficial)
        from public."TD_UNIDADE" u
       where u.ativo = true
    ), '[]'::jsonb)
  );
end;
$function$;

comment on function public.obter_inicio_da_sessao() is
  'O que a entrada do app lê depois do perfil, numa chamada: configuração (TB_CONFIGURACAO), painéis externos (TB_PAINEL_EXTERNO), catálogo de abas (listar_abas_do_menu), situação do sistema (obter_situacao_do_sistema) e unidades ativas (TD_UNIDADE). SECURITY INVOKER: cada parte passa pela RLS de sempre.';

revoke all on function public.obter_inicio_da_sessao() from public, anon;
grant execute on function public.obter_inicio_da_sessao() to authenticated;

-- ═══ CORPO DA MIGRATION (fim) ═══

create temp table t_ensaio (chave text primary key, valor jsonb) on commit drop;
grant all on t_ensaio to authenticated;

-- Quem conferir: um administrador global e uma pessoa ativa sem o grupo de administrador global.
create temp table t_pessoas on commit drop as
select tipo, user_id, email from (
  select 'admin_global' tipo, p.user_id, p.email,
         row_number() over (order by p.updated_at desc nulls last) n
    from public."TB_PERFIL_USUARIO" p
    join public."TB_GRUPO_ACESSO" g on g."CO_GRUPO_ACESSO" = p.perfil
   where p.ativo and p.user_id is not null and g."ST_ADMIN_GLOBAL"
  union all
  select 'sem_admin_global', p.user_id, p.email,
         row_number() over (order by p.updated_at desc nulls last)
    from public."TB_PERFIL_USUARIO" p
    join public."TB_GRUPO_ACESSO" g on g."CO_GRUPO_ACESSO" = p.perfil
   where p.ativo and p.user_id is not null and not g."ST_ADMIN_GLOBAL"
) x where n = 1;
grant select on t_pessoas to authenticated;

create or replace function pg_temp.conferir(p_tipo text) returns void language plpgsql as $f$
declare
  v_inicio timestamptz;
  v_r jsonb;
  v_ms numeric;
begin
  v_inicio := clock_timestamp();
  v_r := public.obter_inicio_da_sessao();
  v_ms := round(extract(epoch from clock_timestamp() - v_inicio) * 1000);
  insert into t_ensaio values ('inicio_' || p_tipo, jsonb_build_object(
    'ms', v_ms,
    'bytes', octet_length(v_r::text),
    'configuracao_igual', (select jsonb_agg(e order by e ->> 'chave') from jsonb_array_elements(v_r -> 'configuracao') e)
       is not distinct from (select jsonb_agg(jsonb_build_object('chave', c.chave, 'valor', c.valor, 'descricao', c.descricao) order by c.chave) from public."TB_CONFIGURACAO" c),
    'paineis_iguais', v_r -> 'paineis' = coalesce((select jsonb_agg(to_jsonb(p) - 'created_at' - 'updated_at' order by p.ordem) from public."TB_PAINEL_EXTERNO" p), '[]'::jsonb),
    'paineis', jsonb_array_length(v_r -> 'paineis'),
    'abas_iguais', v_r -> 'abas' = public.listar_abas_do_menu()::jsonb,
    'situacao_igual', v_r -> 'situacao' = public.obter_situacao_do_sistema()::jsonb,
    'unidades_iguais', v_r -> 'unidades' = coalesce((select jsonb_agg(to_jsonb(u) - 'created_at' - 'updated_at' order by u.tipo, u.nome_oficial) from public."TD_UNIDADE" u where u.ativo), '[]'::jsonb),
    'unidades', jsonb_array_length(v_r -> 'unidades')));

  v_r := public.registrar_navegacao_monitora(
    p_evento => 'abertura_tela', p_tela => 'aprovados', p_detalhes => '{"ensaio":true}'::jsonb,
    p_client_session_id => 'ensaio', p_user_agent => 'ensaio', p_app_version => 'ensaio',
    p_current_view => 'Lista de aprovados · Saúde Indígena');
  insert into t_ensaio values ('navegacao_' || p_tipo, v_r);

  v_r := public.registrar_navegacao_monitora(p_presenca => false, p_evento => 'heartbeat');
  insert into t_ensaio values ('so_evento_' || p_tipo, v_r);

  v_r := public.registrar_navegacao_monitora(p_current_view => 'Visão geral');
  insert into t_ensaio values ('so_presenca_' || p_tipo, v_r);
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
  from t_pessoas where tipo = 'sem_admin_global';
set local role authenticated;
select pg_temp.conferir('sem_admin_global');
reset role;

-- Conta sem perfil ativo: a presença recusa (P0002) e o evento fica, como quando eram duas chamadas.
select set_config('request.jwt.claims', json_build_object('sub', s.id, 'email', '', 'role', 'authenticated')::text, true),
       set_config('request.jwt.claim.sub', s.id::text, true)
  from (select u.id from auth.users u
         where not exists (select 1 from public."TB_PERFIL_USUARIO" p
                            where p.ativo and (p.user_id = u.id or lower(p.email) = lower(u.email)))
         limit 1) s;
set local role authenticated;
insert into t_ensaio select 'sem_perfil', public.registrar_navegacao_monitora(p_evento => 'abertura_tela', p_tela => 'ensaio', p_current_view => 'Visão geral');
reset role;

-- O que as chamadas gravaram (como antes: TL_EVENTO_ACESSO e TB_PRESENCA_ONLINE_MONITORA).
insert into t_ensaio
select 'gravado', jsonb_build_object(
  'eventos_do_ensaio', (select count(*) from public."TL_EVENTO_ACESSO" e where e.created_at >= now()),
  'presenca_do_ensaio', (select jsonb_agg(jsonb_build_object('tipo', t.tipo, 'view', o.current_view, 'agora', o.seen_at >= now()))
                           from public."TB_PRESENCA_ONLINE_MONITORA" o join t_pessoas t on t.user_id = o.user_id));

-- Sem sessão: as duas recusam.
do $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.obter_inicio_da_sessao();
    insert into t_ensaio values ('sem_sessao', '"aceitou"');
  exception when sqlstate '28000' then
    insert into t_ensaio values ('sem_sessao', '"recusou"');
  end;
end;
$$;

select jsonb_object_agg(chave, valor order by chave) as ensaio from t_ensaio;

rollback;
