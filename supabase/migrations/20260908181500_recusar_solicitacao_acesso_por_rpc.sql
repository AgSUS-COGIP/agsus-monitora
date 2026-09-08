begin;

-- ---------------------------------------------------------------------------
-- Fecha a assimetria da administracao de acesso.
--
-- Aprovar, atualizar, desativar e revogar paineis ja passavam por RPC com
-- guarda `private.is_master()`. **Recusar** era a excecao: o navegador escrevia
-- direto em `public.solicitacoes_acesso`, definindo `status`, `avaliado_por` e
-- `avaliado_em` por conta propria, com apenas a RLS no caminho. A autorizacao da
-- mesma decisao ficava, portanto, em dois lugares diferentes.
--
-- Esta migration cria `public.recusar_solicitacao_acesso`, espelhando a guarda e
-- o formato de retorno das funcoes irmas. Nao altera dados, nao remove nenhum
-- objeto e nao mexe em grants de tabela.
--
-- SOBRE `updated_at`
--   `aprovar_solicitacao_acesso` escreve `updated_at = now()` no mesmo update;
--   esta funcao nao escreve. A diferenca e deliberada e sem efeito pratico: a
--   tabela tem o gatilho `trg_solicitacoes_acesso_updated_at`, criado em
--   20260624_access_requests_and_panel_permissions.sql, que e
--   `before update ... for each row` e faz `new.updated_at = now()`
--   incondicionalmente. A atribuicao explicita da funcao irma e portanto
--   redundante — o gatilho a sobrescreve depois do SET, em toda atualizacao.
--   Escrever a coluna aqui apenas repetiria essa redundancia.
--
-- DEPENDENTES
--   - `private.is_master()` (criada em restrict_access_management_to_master.sql)
--   - tabela `public.solicitacoes_acesso`, colunas status, avaliado_por,
--     avaliado_em e observacao_admin (conferidas no banco real em 08/09/2026)
--   - gatilho `trg_solicitacoes_acesso_updated_at` para a coluna updated_at
--   - frontend: `denyAccessRequest()` em src/modules/legacy-app.js
--   - contrato: `recusar_solicitacao_acesso` em src/lib/rpc-contrato.js
--
-- ROLLBACK
--   begin;
--     drop function if exists public.recusar_solicitacao_acesso(uuid, text);
--   commit;
--   O frontend anterior a este PR volta a escrever direto na tabela; nenhum dado
--   precisa ser revertido, porque a funcao grava exatamente as mesmas colunas.
-- ---------------------------------------------------------------------------

create or replace function public.recusar_solicitacao_acesso(
  p_solicitacao_id uuid,
  p_observacao_admin text default null
)
returns jsonb
language plpgsql
set search_path to 'public', 'private', 'auth'
as $$
declare
  v_req public.solicitacoes_acesso%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if not private.is_master() then
    raise exception 'Somente perfil master pode recusar solicitacao de acesso';
  end if;

  select * into v_req
  from public.solicitacoes_acesso
  where id = p_solicitacao_id
  for update;

  if not found then
    raise exception 'Solicitacao de acesso nao encontrada';
  end if;

  -- Decidir duas vezes a mesma solicitacao seria sobrescrever quem avaliou antes.
  if lower(coalesce(v_req.status, '')) <> 'pendente' then
    raise exception 'Solicitacao ja foi avaliada (status atual: %)', v_req.status;
  end if;

  update public.solicitacoes_acesso
  set status = 'recusado',
      avaliado_por = auth.uid(),
      avaliado_em = now(),
      observacao_admin = nullif(btrim(p_observacao_admin), '')
  where id = p_solicitacao_id;

  return jsonb_build_object(
    'ok', true,
    'solicitacao_id', v_req.id,
    'email', v_req.email,
    'status', 'recusado'
  );
end;
$$;

revoke all on function public.recusar_solicitacao_acesso(uuid, text) from public;
grant execute on function public.recusar_solicitacao_acesso(uuid, text) to authenticated;

comment on function public.recusar_solicitacao_acesso(uuid, text) is
  'Recusa solicitacao de acesso. Somente perfil master. Substitui a escrita direta que o frontend fazia em solicitacoes_acesso.';

commit;
