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

create or replace function public.atualizar_acesso_usuario(
  p_perfil_usuario_id uuid,
  p_perfil text default 'leitor',
  p_permissoes jsonb default '{}'::jsonb,
  p_paineis uuid[] default '{}'::uuid[],
  p_motivo text default null
)
returns jsonb
language plpgsql
set search_path to 'public', 'private', 'auth'
as $$
declare
  v_usuario public.perfis_usuarios%rowtype;
  v_perfil text;
  v_p_ind boolean;
  v_p_cores boolean;
  v_p_paineis boolean;
  v_p_config boolean;
  v_p_admin boolean;
  v_painel_id uuid;
  v_paineis_ativos integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if not private.is_master() then
    raise exception 'Somente perfil master pode atualizar acesso de usuario';
  end if;

  if p_perfil_usuario_id is null then
    raise exception 'Perfil de usuario nao informado';
  end if;

  select *
    into v_usuario
  from public.perfis_usuarios
  where id = p_perfil_usuario_id
  for update;

  if not found then
    raise exception 'Perfil de usuario nao encontrado';
  end if;

  if lower(coalesce(v_usuario.perfil, '')) = 'master' then
    raise exception 'Perfil master nao pode ser alterado por esta tela';
  end if;

  v_perfil := lower(coalesce(nullif(btrim(p_perfil), ''), v_usuario.perfil, 'leitor'));
  if v_perfil not in ('leitor', 'editor', 'admin') then
    raise exception 'Perfil invalido: %', v_perfil;
  end if;

  v_p_ind := coalesce((p_permissoes ->> 'p_ind')::boolean, false);
  v_p_cores := coalesce((p_permissoes ->> 'p_cores')::boolean, false);
  v_p_paineis := coalesce((p_permissoes ->> 'p_paineis')::boolean, false);
  v_p_config := coalesce((p_permissoes ->> 'p_config')::boolean, false);
  v_p_admin := coalesce((p_permissoes ->> 'p_admin')::boolean, false);

  update public.perfis_usuarios
  set perfil = v_perfil,
      ativo = true,
      p_ind = v_p_ind,
      p_cores = v_p_cores,
      p_paineis = v_p_paineis,
      p_config = v_p_config,
      p_admin = v_p_admin,
      updated_at = now()
  where id = p_perfil_usuario_id;

  delete from public.perfis_paineis_externos
  where perfil_usuario_id = p_perfil_usuario_id;

  if v_p_paineis and coalesce(array_length(p_paineis, 1), 0) > 0 then
    foreach v_painel_id in array p_paineis loop
      insert into public.perfis_paineis_externos(perfil_usuario_id, painel_id, ativo)
      select p_perfil_usuario_id, p.id, true
      from public.paineis_externos p
      where p.id = v_painel_id
        and p.ativo is true
      on conflict (perfil_usuario_id, painel_id) do update
        set ativo = true,
            updated_at = now();
    end loop;
  end if;

  select count(*)::integer
    into v_paineis_ativos
  from public.perfis_paineis_externos
  where perfil_usuario_id = p_perfil_usuario_id
    and ativo is true;

  return jsonb_build_object(
    'ok', true,
    'perfil_usuario_id', p_perfil_usuario_id,
    'email', v_usuario.email,
    'perfil', v_perfil,
    'permissoes', jsonb_build_object(
      'p_ind', v_p_ind,
      'p_cores', v_p_cores,
      'p_paineis', v_p_paineis,
      'p_config', v_p_config,
      'p_admin', v_p_admin
    ),
    'paineis_ativos', v_paineis_ativos,
    'motivo', nullif(btrim(p_motivo), '')
  );
end;
$$;

grant execute on function public.atualizar_acesso_usuario(uuid, text, jsonb, uuid[], text) to authenticated;
