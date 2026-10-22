/*
  REMOVE RPCs SEM CHAMADOR

  Por quê: funções do schema public que ninguém chama — nem o front, nem os
  robôs, nem as planilhas, nem outra função ou tarefa do banco — e que, na
  maioria, ainda eram executáveis por authenticated (superfície de ataque
  sem uso):
    atualizar_acesso_usuario           authenticated
    atualizar_indicadores_dashboard    só service_role
    get_acessos_config_master          authenticated
    historico_do_registro              authenticated
    revogar_paineis_usuario            authenticated
    salvar_configuracoes_e_paineis     authenticated
    set_my_avatar_choice               authenticated

  Prova (22/10/2026): git grep -w de cada nome em src/ (com
  src/lib/rpc-contrato.js), api/, server/, python/, scripts/, apps-script/,
  .github/, public/ e *.html: nenhum resultado; no banco, nenhuma outra função
  cita o nome no corpo (pg_proc.prosrc), pg_depend não liga nada a elas e
  nenhuma tarefa do pg_cron as chama. Só um teste antigo afirma que o front
  NÃO usa salvar_configuracoes_e_paineis, e docs/banco-de-dados.md as listava
  como "sem migration".

  Ficam (não são mortas): public.salvar_monitoramento_com_cronograma (v1) —
  a _v2 (a que o front chama) a chama por dentro — e
  public.comparar_analises_incremental (v1), chamada pela _v2. A v1 do
  salvar_monitoramento_com_cronograma perde o EXECUTE de authenticated: a _v2
  é SECURITY DEFINER do postgres e continua chamando; ninguém mais a chama
  direto (a v1 não grava o histórico que a _v2 grava).

  Sem CASCADE: se aparecer dependência nova, a migration para.
  Idempotente. Ensaio: supabase/ensaios/20261022155000_remove_rpcs_sem_chamador.sql
  Rollback: supabase/rollback/20261022155000_remove_rpcs_sem_chamador.sql (recria a partir de pg_get_functiondef
  e dos privilégios de 22/10/2026)
*/
begin;

drop function if exists public.atualizar_acesso_usuario(uuid,text,jsonb,uuid[],text);
drop function if exists public.atualizar_indicadores_dashboard(uuid);
drop function if exists public.get_acessos_config_master(integer,integer,integer);
drop function if exists public.historico_do_registro(uuid);
drop function if exists public.revogar_paineis_usuario(uuid,uuid[],text);
drop function if exists public.salvar_configuracoes_e_paineis(jsonb,jsonb);
drop function if exists public.set_my_avatar_choice(text,text,jsonb);

revoke execute on function public.salvar_monitoramento_com_cronograma(jsonb,jsonb) from public, anon, authenticated;

commit;
