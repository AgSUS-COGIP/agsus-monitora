begin;

-- A tela já permite admin global e Gestor; a RPC ainda usava p_config/p_admin.
-- Mantém o formato da resposta e a janela de dois minutos, sem expor a tabela.
create or replace function public.listar_presenca_online_monitora()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
  v_user_id uuid := (select auth.uid());
  v_email text := coalesce((select auth.jwt() ->> 'email'), '');
begin
  if v_user_id is null then
    raise exception 'Sessão não localizada.' using errcode = '28000';
  end if;

  if not (
    private.is_master()
    or exists (
      select 1 from public."TB_PERFIL_USUARIO" p
       where p.ativo is true
         and lower(coalesce(p.perfil, '')) = 'edital_gestor'
         and (p.user_id = v_user_id or lower(p.email) = lower(v_email))
    )
  ) then
    raise exception 'Acesso restrito ao administrador global e ao Gestor.'
      using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(person) order by person."fullName", person."userId"), '[]'::jsonb)
    into v_result
    from (
      select po.user_id as "userId",
             coalesce(nullif(trim(p.nome), ''), split_part(coalesce(p.email, ''), '@', 1), 'Usuário AgSUS') as "fullName",
             coalesce(case when p.avatar_source in ('GOOGLE', 'UPLOADED') then p.avatar_url end,
                      p.google_avatar_url) as "avatarUrl",
             initcap(coalesce(nullif(p.perfil, ''), 'Usuário')) as "profileLabel",
             po.current_view as "currentView",
             po.seen_at as "onlineAt"
        from public."TB_PRESENCA_ONLINE_MONITORA" po
        join lateral (
          select profile.* from public."TB_PERFIL_USUARIO" profile
           where profile.ativo is true
             and (profile.user_id = po.user_id
                  or lower(profile.email) = lower(coalesce(
                    (select email from auth.users where id = po.user_id), '')))
           order by case when profile.user_id = po.user_id then 0 else 1 end,
                    profile.updated_at desc nulls last
           limit 1
        ) p on true
       where po.seen_at > timezone('utc', now()) - interval '2 minutes'
       order by po.seen_at desc
       limit 200
    ) person;
  return v_result;
end;
$function$;

revoke all on function public.listar_presenca_online_monitora() from public, anon;
grant execute on function public.listar_presenca_online_monitora() to authenticated;
comment on function public.listar_presenca_online_monitora() is
  'Pessoas online nos últimos dois minutos, apenas para administrador global ou Gestor com perfil ativo. A tabela permanece protegida por RLS e sem acesso direto pela Data API.';
notify pgrst, 'reload schema';
commit;
