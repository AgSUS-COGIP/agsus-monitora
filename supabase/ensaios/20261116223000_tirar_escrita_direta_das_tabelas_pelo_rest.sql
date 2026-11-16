/*
  ENSAIO de 20261116223000_tirar_escrita_direta_das_tabelas_pelo_rest: guarda os
  grants de agora, aplica a migration, prova que `authenticated` e `anon` não
  gravam mais (e que o registro de acessos continua), aplica o rollback, confere
  que os grants voltaram iguais e termina em rollback (não grava nada).
*/
begin;

set local lock_timeout = '5s';

create temp table tmp_grants_antes on commit drop as
select o.objeto, p.papel, o.privilegio
  from (
    select c.relname as objeto, x.grantee, x.privilege_type as privilegio
      from pg_class c, aclexplode(c.relacl) x
     where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
    union all
    select c.relname || '.' || a.attname, x.grantee, x.privilege_type
      from pg_class c join pg_attribute a on a.attrelid = c.oid, aclexplode(a.attacl) x
     where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
  ) o
  cross join lateral (select case when o.grantee = 0 then 'PUBLIC' else o.grantee::regrole::text end as papel) p;

-- ── a migration (o mesmo texto, sem begin/commit) ──

do $guarda$
declare
  v_dependentes text;
begin
  select string_agg(n.nspname || '.' || p.proname, ', ' order by n.nspname, p.proname)
    into v_dependentes
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private')
     and not p.prosecdef
     and p.proname <> 'registrar_evento_acesso'
     and has_function_privilege('authenticated', p.oid, 'EXECUTE')
     and p.prosrc ~* '(insert\s+into|update|delete\s+from|merge\s+into)\s+(public\.)?"?(RL_PERFIL_USUARIO_PAINEL_EXT|TB_CONFIGURACAO|TB_CONFIG_MAPA_SAUDE_INDIG|TB_MONITORAMENTO_INDIGENA|TB_PAINEL_EXTERNO|TB_PERFIL_USUARIO|TL_SYNC_ANALISE|TM_ANALISE_CURRICULAR|TL_EVENTO_ACESSO)';
  if v_dependentes is not null then
    raise exception 'Função INVOKER de quem tem login grava nas tabelas: %', v_dependentes
      using errcode = '55000';
  end if;
end
$guarda$;

revoke insert, update, delete on table
  public."RL_PERFIL_USUARIO_PAINEL_EXT",
  public."TB_CONFIGURACAO",
  public."TB_CONFIG_MAPA_SAUDE_INDIG",
  public."TB_MONITORAMENTO_INDIGENA",
  public."TB_PAINEL_EXTERNO",
  public."TB_PERFIL_USUARIO",
  public."TL_SYNC_ANALISE",
  public."TM_ANALISE_CURRICULAR"
from authenticated;

revoke insert (id, user_id, evento, tela, origem, detalhes, client_session_id, user_agent, app_version)
  on table public."TL_EVENTO_ACESSO"
from anon;

-- Conferência: nada de escrita para quem tem login ou para anon, exceto o registro de acessos.
do $conferencia$
declare
  v_sobrou text;
begin
  select string_agg(c.relname || ' ' || r.papel || ' ' || r.priv, ', ')
    into v_sobrou
    from pg_class c
    cross join (values ('authenticated', 'INSERT'), ('authenticated', 'UPDATE'), ('authenticated', 'DELETE'),
                       ('anon', 'INSERT'), ('anon', 'UPDATE'), ('anon', 'DELETE')) as r(papel, priv)
   where c.relnamespace = 'public'::regnamespace
     and c.relkind in ('r', 'p')
     and not (c.relname = 'TL_EVENTO_ACESSO' and r.papel = 'authenticated' and r.priv = 'INSERT')
     and (has_table_privilege(r.papel, c.oid, r.priv)
          or (r.priv in ('INSERT', 'UPDATE') and has_any_column_privilege(r.papel, c.oid, r.priv)));
  if v_sobrou is not null then
    raise exception 'Ainda há escrita direta: %', v_sobrou;
  end if;
  if not has_table_privilege('authenticated', 'public."TL_EVENTO_ACESSO"', 'INSERT') then
    raise exception 'registrar_evento_acesso perderia o INSERT em TL_EVENTO_ACESSO';
  end if;
end
$conferencia$;

-- ── prova pelo papel de quem tem login ──
set local role authenticated;
do $prova_authenticated$
begin
  begin
    update public."TB_CONFIGURACAO" set valor = valor where false;
    raise exception 'authenticated ainda faz UPDATE em TB_CONFIGURACAO';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public."TL_SYNC_ANALISE" default values;
    raise exception 'authenticated ainda faz INSERT em TL_SYNC_ANALISE';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public."TB_CONFIG_MAPA_SAUDE_INDIG" where false;
    raise exception 'authenticated ainda faz DELETE em TB_CONFIG_MAPA_SAUDE_INDIG';
  exception when insufficient_privilege then null;
  end;
  -- A leitura (sob RLS) continua: sem sessão, a policy só não devolve linhas.
  perform 1 from public."TB_CONFIGURACAO" limit 1;
  perform 1 from public."TB_PAINEL_EXTERNO" limit 1;
end
$prova_authenticated$;
reset role;

set local role anon;
do $prova_anon$
begin
  begin
    insert into public."TL_EVENTO_ACESSO" (evento) values ('ensaio');
    raise exception 'anon ainda faz INSERT em TL_EVENTO_ACESSO';
  exception when insufficient_privilege then null;
  end;
end
$prova_anon$;
reset role;

-- ── o rollback devolve exatamente o que havia ──

grant insert, update, delete on table public."RL_PERFIL_USUARIO_PAINEL_EXT" to authenticated;
grant insert, update on table public."TB_CONFIGURACAO" to authenticated;
grant insert, update, delete on table public."TB_CONFIG_MAPA_SAUDE_INDIG" to authenticated;
grant insert, update on table public."TB_MONITORAMENTO_INDIGENA" to authenticated;
grant update on table public."TB_PAINEL_EXTERNO" to authenticated;
grant insert, update on table public."TB_PERFIL_USUARIO" to authenticated;
grant insert, update, delete on table public."TL_SYNC_ANALISE" to authenticated;
grant insert, delete on table public."TM_ANALISE_CURRICULAR" to authenticated;

grant insert (id, user_id, evento, tela, origem, detalhes, client_session_id, user_agent, app_version)
  on table public."TL_EVENTO_ACESSO"
to anon;

do $volta$
declare
  v_diferentes text;
begin
  with agora as (
    select c.relname as objeto, x.grantee, x.privilege_type as privilegio
      from pg_class c, aclexplode(c.relacl) x
     where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
    union all
    select c.relname || '.' || a.attname, x.grantee, x.privilege_type
      from pg_class c join pg_attribute a on a.attrelid = c.oid, aclexplode(a.attacl) x
     where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
  ), agora_nomeado as (
    select objeto, case when grantee = 0 then 'PUBLIC' else grantee::regrole::text end as papel, privilegio from agora
  ), diferenca as (
    (select * from tmp_grants_antes except select * from agora_nomeado)
    union all
    (select * from agora_nomeado except select * from tmp_grants_antes)
  )
  select string_agg(distinct objeto || ' ' || papel || ' ' || privilegio, ', ') into v_diferentes from diferenca;
  if v_diferentes is not null then
    raise exception 'O rollback não devolve os grants de antes: %', v_diferentes;
  end if;
  raise notice 'Ensaio ok: a migration tira a escrita direta e o rollback devolve os mesmos grants.';
end
$volta$;

rollback;
