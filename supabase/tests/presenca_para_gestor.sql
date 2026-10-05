-- Ensaio com as identidades existentes, sem alterar perfis ou presença.
begin;
do $$
declare
  v record;
  v_resposta jsonb;
  v_gestores integer := 0;
  v_admins integer := 0;
  v_negados integer := 0;
begin
  for v in
    select u.id, u.email,
           bool_or(p.ativo and (p.perfil = 'edital_gestor' or coalesce(g."ST_ADMIN_GLOBAL", false))) as permitido,
           bool_or(p.ativo and p.perfil = 'edital_gestor') as gestor,
           bool_or(p.ativo and coalesce(g."ST_ADMIN_GLOBAL", false)) as admin_global
      from public."TB_PERFIL_USUARIO" p
      join auth.users u on p.user_id = u.id or lower(p.email) = lower(u.email)
      left join public."TB_GRUPO_ACESSO" g on g."CO_GRUPO_ACESSO" = p.perfil
     group by u.id, u.email
  loop
    perform set_config('request.jwt.claims', json_build_object('sub', v.id, 'email', v.email, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v.id::text, true);
    if v.permitido then
      v_resposta := public.listar_presenca_online_monitora();
      if jsonb_typeof(v_resposta) <> 'array' then raise exception 'Resposta não é uma lista'; end if;
      if v.gestor then v_gestores := v_gestores + 1;
      elsif v.admin_global then v_admins := v_admins + 1;
      end if;
    else
      begin
        perform public.listar_presenca_online_monitora();
        raise exception 'Perfil não autorizado conseguiu listar presença';
      exception when insufficient_privilege then v_negados := v_negados + 1;
      end;
    end if;
  end loop;
  if v_gestores = 0 or v_admins = 0 or v_negados = 0 then
    raise exception 'Ensaio incompleto: faltam perfis Gestor, admin global ou comum';
  end if;
  perform set_config('request.jwt.claims', '{}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.listar_presenca_online_monitora();
    raise exception 'Sessão ausente conseguiu listar presença';
  exception when sqlstate '28000' then null;
  end;
  if has_function_privilege('anon', 'public.listar_presenca_online_monitora()', 'execute') then
    raise exception 'Anon tem acesso à RPC';
  end if;
end;
$$;
rollback;
