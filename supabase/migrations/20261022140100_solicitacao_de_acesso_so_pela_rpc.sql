/*
  Pedido de acesso: só as RPCs gravam em TB_SOLICITACAO_ACESSO e RL_SOLIC_ACESSO_PAINEL.

  As duas tabelas ainda tinham INSERT/UPDATE/DELETE para authenticated e as policies da época
  em que o navegador gravava direto (solicitacoes_insert_own, solicitacoes_paineis_insert_own_
  pending...). Com isso, qualquer conta autenticada podia inserir um pedido pelo REST sem
  passar pelas validações de registrar_solicitacao_acesso (área, cargo da lista, lotação,
  justificativa de 20 a 2.000 caracteres, edição do pendente em vez de duplicar).

  Quem grava hoje é só SECURITY DEFINER do postgres: registrar_solicitacao_acesso,
  cancelar_minha_solicitacao_acesso, aprovar_solicitacao_acesso, recusar_solicitacao_acesso,
  reativar_acesso_usuario e remover_grupo_acesso. Nenhum .from('TB_SOLICITACAO_ACESSO') nem
  .from('RL_SOLIC_ACESSO_PAINEL') em src/, api/ ou server/ (tests/fronteira-de-dados.test.js
  já impede o primeiro).

  1. revoke insert, update, delete, truncate das duas tabelas para anon e authenticated
     (anon já não tinha; fica explícito). SELECT continua, com as policies de leitura
     (a própria pessoa, admin/config).
  2. drop das policies de escrita, que sem o grant não valem mais: solicitacoes_insert_own,
     solicitacoes_update_admin, solicitacoes_delete_admin (TB_SOLICITACAO_ACESSO),
     solicitacoes_paineis_insert_own_pending e solicitacoes_paineis_delete_own_pending_or_admin
     (RL_SOLIC_ACESSO_PAINEL).

  Nenhuma RPC muda (rpc-contrato.js igual). Depende de 20261021140000 (já aplicada).
  Ensaio: supabase/ensaios/20261022140100_solicitacao_de_acesso_so_pela_rpc.sql
  Rollback: supabase/rollback/20261022140100_solicitacao_de_acesso_so_pela_rpc.sql
*/
begin;

revoke insert, update, delete, truncate on table public."TB_SOLICITACAO_ACESSO" from anon, authenticated;
revoke insert, update, delete, truncate on table public."RL_SOLIC_ACESSO_PAINEL" from anon, authenticated;

drop policy if exists solicitacoes_insert_own on public."TB_SOLICITACAO_ACESSO";
drop policy if exists solicitacoes_update_admin on public."TB_SOLICITACAO_ACESSO";
drop policy if exists solicitacoes_delete_admin on public."TB_SOLICITACAO_ACESSO";
drop policy if exists solicitacoes_paineis_insert_own_pending on public."RL_SOLIC_ACESSO_PAINEL";
drop policy if exists solicitacoes_paineis_delete_own_pending_or_admin on public."RL_SOLIC_ACESSO_PAINEL";

commit;
