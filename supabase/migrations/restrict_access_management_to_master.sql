-- Source-of-truth migration for access-management ownership.
-- Keeps all high-impact access actions restricted to the master profile.

create or replace function private.is_master()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.perfis_usuarios p
    where p.ativo is true
      and lower(coalesce(p.perfil, '')) = 'master'
      and (
        p.user_id = auth.uid()
        or lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  );
$$;

revoke all on function private.is_master() from public;
grant execute on function private.is_master() to authenticated;

create or replace function public.aprovar_solicitacao_acesso(
  p_solicitacao_id uuid,
  p_perfil text default 'leitor',
  p_permissoes jsonb default '{}'::jsonb,
  p_paineis uuid[] default '{}'::uuid[],
  p_observacao_admin text default null
)
returns jsonb
language plpgsql
set search_path to 'public', 'private', 'auth'
as $$
declare
  v_req public.solicitacoes_acesso%rowtype;
  v_perfil_id uuid;
  v_perfil text;
  v_p_ind boolean;
  v_p_cores boolean;
  v_p_paineis boolean;
  v_p_config boolean;
  v_p_admin boolean;
  v_painel_id uuid;
  v_paineis_inseridos integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if not private.is_master() then
    raise exception 'Somente perfil master pode aprovar solicitacao de acesso';
  end if;

  select * into v_req
  from public.solicitacoes_acesso
  where id = p_solicitacao_id
  for update;

  if not found then
    raise exception 'Solicitacao de acesso nao encontrada';
  end if;

  v_perfil := lower(coalesce(nullif(btrim(p_perfil), ''), v_req.perfil_solicitado, 'leitor'));
  if v_perfil not in ('leitor', 'editor', 'admin') then
    raise exception 'Perfil invalido: %', v_perfil;
  end if;

  v_p_ind := coalesce((p_permissoes ->> 'p_ind')::boolean, false);
  v_p_cores := coalesce((p_permissoes ->> 'p_cores')::boolean, false);
  v_p_paineis := coalesce((p_permissoes ->> 'p_paineis')::boolean, false);
  v_p_config := coalesce((p_permissoes ->> 'p_config')::boolean, false);
  v_p_admin := coalesce((p_permissoes ->> 'p_admin')::boolean, false);

  select id into v_perfil_id
  from public.perfis_usuarios
  where (v_req.user_id is not null and user_id = v_req.user_id)
     or lower(email) = lower(v_req.email)
  order by case when user_id = v_req.user_id then 0 else 1 end, updated_at desc
  limit 1
  for update;

  if v_perfil_id is null then
    insert into public.perfis_usuarios(user_id,email,nome,perfil,ativo,p_ind,p_cores,p_paineis,p_config,p_admin)
    values (
      v_req.user_id,
      v_req.email,
      coalesce(nullif(btrim(v_req.nome), ''), v_req.email),
      v_perfil,
      true,
      v_p_ind,
      v_p_cores,
      v_p_paineis,
      v_p_config,
      v_p_admin
    )
    returning id into v_perfil_id;
  else
    update public.perfis_usuarios
    set user_id = coalesce(public.perfis_usuarios.user_id, v_req.user_id),
        email = v_req.email,
        nome = coalesce(nullif(btrim(v_req.nome), ''), public.perfis_usuarios.nome, v_req.email),
        perfil = v_perfil,
        ativo = true,
        p_ind = v_p_ind,
        p_cores = v_p_cores,
        p_paineis = v_p_paineis,
        p_config = v_p_config,
        p_admin = v_p_admin,
        updated_at = now()
    where id = v_perfil_id;
  end if;

  delete from public.perfis_paineis_externos
  where perfil_usuario_id = v_perfil_id;

  if v_p_paineis and coalesce(array_length(p_paineis, 1), 0) > 0 then
    foreach v_painel_id in array p_paineis loop
      insert into public.perfis_paineis_externos(perfil_usuario_id, painel_id, ativo)
      select v_perfil_id, p.id, true
      from public.paineis_externos p
      where p.id = v_painel_id
        and p.ativo is true
      on conflict (perfil_usuario_id, painel_id) do update
        set ativo = true,
            updated_at = now();

      if found then
        v_paineis_inseridos := v_paineis_inseridos + 1;
      end if;
    end loop;
  end if;

  update public.solicitacoes_acesso
  set status = 'aprovado',
      avaliado_por = auth.uid(),
      avaliado_em = now(),
      observacao_admin = nullif(btrim(p_observacao_admin), ''),
      updated_at = now()
  where id = v_req.id;

  return jsonb_build_object(
    'ok', true,
    'solicitacao_id', v_req.id,
    'perfil_usuario_id', v_perfil_id,
    'email', v_req.email,
    'perfil', v_perfil,
    'paineis_inseridos', v_paineis_inseridos
  );
end;
$$;

create or replace function public.revogar_paineis_usuario(
  p_perfil_usuario_id uuid,
  p_paineis uuid[] default null,
  p_motivo text default null
)
returns jsonb
language plpgsql
set search_path to 'public', 'private', 'auth'
as $$
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
    update public.perfis_paineis_externos
    set ativo = false,
        updated_at = now()
    where perfil_usuario_id = p_perfil_usuario_id
      and ativo is true;
  else
    update public.perfis_paineis_externos
    set ativo = false,
        updated_at = now()
    where perfil_usuario_id = p_perfil_usuario_id
      and painel_id = any(p_paineis)
      and ativo is true;
  end if;

  get diagnostics v_total = row_count;

  select count(*)::integer into v_restantes
  from public.perfis_paineis_externos
  where perfil_usuario_id = p_perfil_usuario_id
    and ativo is true;

  if v_restantes = 0 then
    update public.perfis_usuarios
    set p_paineis = false,
        updated_at = now()
    where id = p_perfil_usuario_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'perfil_usuario_id', p_perfil_usuario_id,
    'paineis_revogados', v_total,
    'paineis_ativos_restantes', v_restantes,
    'motivo', nullif(btrim(p_motivo), '')
  );
end;
$$;

create or replace function public.desativar_acesso_usuario(
  p_perfil_usuario_id uuid,
  p_motivo text default null
)
returns jsonb
language plpgsql
set search_path to 'public', 'private', 'auth'
as $$
declare
  v_email text;
  v_nome text;
  v_paineis integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if not private.is_master() then
    raise exception 'Somente perfil master pode desativar acesso';
  end if;

  if p_perfil_usuario_id is null then
    raise exception 'Perfil de usuario nao informado';
  end if;

  update public.perfis_usuarios
  set ativo = false,
      p_ind = false,
      p_cores = false,
      p_paineis = false,
      p_config = false,
      p_admin = false,
      updated_at = now()
  where id = p_perfil_usuario_id
    and lower(coalesce(perfil, '')) <> 'master'
    and coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid) <> auth.uid()
  returning email, nome into v_email, v_nome;

  if not found then
    raise exception 'Perfil de usuario nao encontrado, master protegido ou tentativa de auto-desativacao';
  end if;

  update public.perfis_paineis_externos
  set ativo = false,
      updated_at = now()
  where perfil_usuario_id = p_perfil_usuario_id
    and ativo is true;
  get diagnostics v_paineis = row_count;

  return jsonb_build_object(
    'ok', true,
    'perfil_usuario_id', p_perfil_usuario_id,
    'email', v_email,
    'nome', v_nome,
    'paineis_revogados', v_paineis,
    'motivo', nullif(btrim(p_motivo), '')
  );
end;
$$;

grant execute on function public.aprovar_solicitacao_acesso(uuid, text, jsonb, uuid[], text) to authenticated;
grant execute on function public.revogar_paineis_usuario(uuid, uuid[], text) to authenticated;
grant execute on function public.desativar_acesso_usuario(uuid, text) to authenticated;
