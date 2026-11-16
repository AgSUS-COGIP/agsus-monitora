/*
  SEM ESCRITA DIRETA NAS TABELAS PELO REST (revisão de segurança de 16/11/2026)

  POR QUE: quem tem login (`authenticated`) ainda tinha INSERT/UPDATE/DELETE
  direto em 8 tabelas. A RLS limita a quem tem a permissão do módulo, mas essa
  pessoa podia gravar pelo REST (`/rest/v1/<tabela>`) sem a validação, o
  histórico e o registro que a RPC faz. E `anon` (quem nem entrou, só com a
  chave publicável) podia inserir linhas no registro de acessos.

  O QUE MUDA:
  - `authenticated` perde a escrita direta em RL_PERFIL_USUARIO_PAINEL_EXT,
    TB_CONFIGURACAO, TB_CONFIG_MAPA_SAUDE_INDIG, TB_MONITORAMENTO_INDIGENA,
    TB_PAINEL_EXTERNO, TB_PERFIL_USUARIO, TL_SYNC_ANALISE e
    TM_ANALISE_CURRICULAR. A leitura (SELECT, sob RLS) fica: o front lê
    TB_CONFIGURACAO, TB_PAINEL_EXTERNO e TD_UNIDADE direto.
  - `anon` perde o INSERT (por coluna) em TL_EVENTO_ACESSO.
  - FICA o INSERT de `authenticated` em TL_EVENTO_ACESSO:
    `registrar_evento_acesso` é SECURITY INVOKER e a tela a chama (direto e por
    `registrar_navegacao_monitora`).

  QUEM CONTINUA GRAVANDO (nada muda para eles):
  - as RPCs SECURITY DEFINER (rodam como `postgres`, dono das tabelas), os
    gatilhos SECURITY DEFINER e as funções de sincronização das análises (só
    `service_role`);
  - o Apps Script das planilhas, os robôs Python e as funções da Vercel, todos
    com a `service_role`, que tem os próprios grants e ignora a RLS;
  - o front não grava em tabela (só `.rpc` e três leituras com `.from`).

  GUARDA: para se aparecer função SECURITY INVOKER executável por
  `authenticated` que grave numa dessas tabelas (exceto
  `registrar_evento_acesso` em TL_EVENTO_ACESSO): ela passaria a falhar.

  Ensaio: supabase/ensaios/20261116223000_tirar_escrita_direta_das_tabelas_pelo_rest.sql
  Rollback: supabase/rollback/20261116223000_tirar_escrita_direta_das_tabelas_pelo_rest.sql
            (devolve exatamente os grants de 16/11/2026)
*/

begin;

set local lock_timeout = '5s';

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

commit;
