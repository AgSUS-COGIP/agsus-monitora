/*
  Rollback de 20261022140100_solicitacao_de_acesso_so_pela_rpc.sql: devolve INSERT, UPDATE e
  DELETE a authenticated nas duas tabelas do pedido de acesso e recria as policies de escrita
  como estavam no banco em 22/10/2026 (pg_policies). Nada de dados muda.
*/
begin;

grant insert, update, delete on table public."TB_SOLICITACAO_ACESSO" to authenticated;
grant insert, update, delete on table public."RL_SOLIC_ACESSO_PAINEL" to authenticated;

drop policy if exists solicitacoes_insert_own on public."TB_SOLICITACAO_ACESSO";
create policy solicitacoes_insert_own on public."TB_SOLICITACAO_ACESSO"
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and lower(email) = lower(coalesce(((select auth.jwt()) ->> 'email'::text), ''::text))
    and status = 'pendente'::text
  );

drop policy if exists solicitacoes_update_admin on public."TB_SOLICITACAO_ACESSO";
create policy solicitacoes_update_admin on public."TB_SOLICITACAO_ACESSO"
  for update to authenticated
  using (private.is_master())
  with check (private.is_master());

drop policy if exists solicitacoes_delete_admin on public."TB_SOLICITACAO_ACESSO";
create policy solicitacoes_delete_admin on public."TB_SOLICITACAO_ACESSO"
  for delete to authenticated
  using (private.is_master());

drop policy if exists solicitacoes_paineis_insert_own_pending on public."RL_SOLIC_ACESSO_PAINEL";
create policy solicitacoes_paineis_insert_own_pending on public."RL_SOLIC_ACESSO_PAINEL"
  for insert to authenticated
  with check (exists (
    select 1 from public."TB_SOLICITACAO_ACESSO" s
     where s.id = "RL_SOLIC_ACESSO_PAINEL".solicitacao_id
       and s.status = 'pendente'::text
       and s.user_id = (select auth.uid())));

drop policy if exists solicitacoes_paineis_delete_own_pending_or_admin on public."RL_SOLIC_ACESSO_PAINEL";
create policy solicitacoes_paineis_delete_own_pending_or_admin on public."RL_SOLIC_ACESSO_PAINEL"
  for delete to authenticated
  using (
    (select private.has_perm('admin'::text))
    or (select private.has_perm('config'::text))
    or exists (
      select 1 from public."TB_SOLICITACAO_ACESSO" s
       where s.id = "RL_SOLIC_ACESSO_PAINEL".solicitacao_id
         and s.status = 'pendente'::text
         and s.user_id = (select auth.uid())));

commit;
