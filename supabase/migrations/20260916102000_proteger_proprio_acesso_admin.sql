-- Impede que um usuário autenticado altere os próprios campos de autorização.
-- A proteção fica no banco, então vale para RPC, REST direto e qualquer tela.

create or replace function private.proteger_proprio_acesso()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text := lower(coalesce((select auth.jwt() ->> 'email'), ''));
  v_proprio boolean;
begin
  -- Rotinas administrativas executadas sem JWT (por exemplo, SQL Editor) não
  -- são bloqueadas; esta trava protege alterações originadas por uma sessão.
  if v_uid is null and v_email = '' then
    return new;
  end if;

  v_proprio :=
    (v_uid is not null and old.user_id = v_uid)
    or (v_email <> '' and lower(coalesce(old.email, '')) = v_email);

  if v_proprio and (
    new.perfil is distinct from old.perfil
    or new.ativo is distinct from old.ativo
    or new.p_ind is distinct from old.p_ind
    or new.p_cores is distinct from old.p_cores
    or new.p_paineis is distinct from old.p_paineis
    or new.p_config is distinct from old.p_config
    or new.p_admin is distinct from old.p_admin
  ) then
    raise exception 'Nao e permitido alterar o proprio perfil de acesso';
  end if;

  return new;
end;
$$;

revoke all on function private.proteger_proprio_acesso() from public;

drop trigger if exists trg_proteger_proprio_acesso on public.perfis_usuarios;
create trigger trg_proteger_proprio_acesso
before update on public.perfis_usuarios
for each row
execute function private.proteger_proprio_acesso();
