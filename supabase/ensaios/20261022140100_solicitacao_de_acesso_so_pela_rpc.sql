/*
  ENSAIO de 20261022140100_solicitacao_de_acesso_so_pela_rpc.sql — begin … rollback.

  Aplica a migration dentro da transação e confere, com uma conta de teste criada na própria
  transação (papel authenticated, claims do JWT; nada de dados pessoais):
    1. grants: anon e authenticated sem INSERT/UPDATE/DELETE nas duas tabelas; SELECT mantido;
       nenhuma policy de escrita sobra;
    2. registrar_solicitacao_acesso grava o pedido; a pessoa lê o próprio pedido;
    3. INSERT, UPDATE e DELETE diretos em TB_SOLICITACAO_ACESSO e INSERT em
       RL_SOLIC_ACESSO_PAINEL são recusados (42501);
    4. cancelar_minha_solicitacao_acesso continua funcionando.
  Termina em rollback: nada fica gravado.
*/
begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

revoke insert, update, delete, truncate on table public."TB_SOLICITACAO_ACESSO" from anon, authenticated;
revoke insert, update, delete, truncate on table public."RL_SOLIC_ACESSO_PAINEL" from anon, authenticated;

drop policy if exists solicitacoes_insert_own on public."TB_SOLICITACAO_ACESSO";
drop policy if exists solicitacoes_update_admin on public."TB_SOLICITACAO_ACESSO";
drop policy if exists solicitacoes_delete_admin on public."TB_SOLICITACAO_ACESSO";
drop policy if exists solicitacoes_paineis_insert_own_pending on public."RL_SOLIC_ACESSO_PAINEL";
drop policy if exists solicitacoes_paineis_delete_own_pending_or_admin on public."RL_SOLIC_ACESSO_PAINEL";

-- 1. Grants e policies.
do $grants$
declare
  v_tabela text;
  v_papel text;
  v_priv text;
begin
  foreach v_tabela in array array['public."TB_SOLICITACAO_ACESSO"', 'public."RL_SOLIC_ACESSO_PAINEL"'] loop
    foreach v_papel in array array['anon', 'authenticated'] loop
      foreach v_priv in array array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] loop
        assert not has_table_privilege(v_papel, v_tabela, v_priv), v_papel || ' ainda tem ' || v_priv || ' em ' || v_tabela;
      end loop;
    end loop;
    assert has_table_privilege('authenticated', v_tabela, 'SELECT'), 'authenticated perdeu SELECT em ' || v_tabela;
  end loop;
  assert not exists (select 1 from pg_policies
                      where schemaname = 'public'
                        and tablename in ('TB_SOLICITACAO_ACESSO', 'RL_SOLIC_ACESSO_PAINEL')
                        and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')), 'sobrou policy de escrita';
  assert exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'TB_SOLICITACAO_ACESSO' and cmd = 'SELECT'),
    'a policy de leitura do pedido sumiu';
end;
$grants$;

-- Conta de teste (só nesta transação).
insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-4000-a000-0000221401a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.pedido@ensaio.invalid');
select set_config('ensaio.usuario', json_build_object('sub', '00000000-0000-4000-a000-0000221401a1',
                  'email', 'ensaio.pedido@ensaio.invalid', 'role', 'authenticated')::text, true);
select set_config('ensaio.projeto', (select x."NO_UNIDADE" from public."TA_UNIDADE_AREA" x where x."CO_AREA" = 'projetos' order by 1 limit 1), true);
select set_config('ensaio.painel', coalesce((select p.id::text from public."TB_PAINEL_EXTERNO" p order by 1 limit 1), ''), true);

set local role authenticated;

do $ensaio$
declare
  v_r jsonb;
  v_id uuid;
  v_falhou boolean;
begin
  perform set_config('request.jwt.claims', current_setting('ensaio.usuario'), true);

  -- 2. Pela RPC: grava e a pessoa lê.
  v_r := public.registrar_solicitacao_acesso('Pessoa do Ensaio', 'projetos', 'APOIO', null,
                                             current_setting('ensaio.projeto'),
                                             'Apoio a equipe do projeto no acompanhamento dos editais.', null);
  assert (v_r ->> 'ok')::boolean and v_r ->> 'status' = 'pendente', 'registrar: ' || v_r::text;
  v_id := (v_r ->> 'id')::uuid;
  assert exists (select 1 from public."TB_SOLICITACAO_ACESSO" s where s.id = v_id), 'a pessoa não lê o próprio pedido';

  -- 3. Direto na tabela: recusado.
  begin
    insert into public."TB_SOLICITACAO_ACESSO" (user_id, email, nome, justificativa, perfil_solicitado, status)
    values ('00000000-0000-4000-a000-0000221401a1', 'ensaio.pedido@ensaio.invalid', 'Pedido direto',
            'texto qualquer', 'usuario', 'pendente');
    v_falhou := false;
  exception when sqlstate '42501' then v_falhou := true;
  end;
  assert v_falhou, 'INSERT direto em TB_SOLICITACAO_ACESSO passou';

  begin
    update public."TB_SOLICITACAO_ACESSO" set status = 'aprovado' where id = v_id;
    v_falhou := false;
  exception when sqlstate '42501' then v_falhou := true;
  end;
  assert v_falhou, 'UPDATE direto em TB_SOLICITACAO_ACESSO passou';

  begin
    delete from public."TB_SOLICITACAO_ACESSO" where id = v_id;
    v_falhou := false;
  exception when sqlstate '42501' then v_falhou := true;
  end;
  assert v_falhou, 'DELETE direto em TB_SOLICITACAO_ACESSO passou';

  if current_setting('ensaio.painel') <> '' then
    begin
      insert into public."RL_SOLIC_ACESSO_PAINEL" (solicitacao_id, painel_id)
      values (v_id, current_setting('ensaio.painel')::uuid);
      v_falhou := false;
    exception when sqlstate '42501' then v_falhou := true;
    end;
    assert v_falhou, 'INSERT direto em RL_SOLIC_ACESSO_PAINEL passou';
  end if;

  -- 4. Cancelar pela RPC continua.
  v_r := public.cancelar_minha_solicitacao_acesso();
  assert exists (select 1 from public."TB_SOLICITACAO_ACESSO" s where s.id = v_id and s.status = 'cancelado'),
    'cancelar não gravou: ' || coalesce(v_r::text, '<nulo>');
end;
$ensaio$;

reset role;

select 'ensaio ok' as resultado;

rollback;
