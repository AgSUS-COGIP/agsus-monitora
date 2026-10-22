begin;

-- Presença online no padrão SIGAV: uma única batida por usuário, sobrescrita.
-- Não acumula histórico e não expõe a tabela pela Data API.
create table if not exists public.presenca_online_monitora (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_view text,
  seen_at timestamptz not null default timezone('utc', now())
);

create index if not exists presenca_online_monitora_seen_idx
  on public.presenca_online_monitora (seen_at desc);

alter table public.presenca_online_monitora enable row level security;
revoke all on table public.presenca_online_monitora from public, anon, authenticated;

create or replace function public.registrar_presenca_monitora(
  p_current_view text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := coalesce(auth.jwt() ->> 'email', '');
begin
  if v_user_id is null then
    raise exception 'Sessão não localizada.' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.perfis_usuarios p
    where p.ativo is true
      and (
        p.user_id = v_user_id
        or lower(p.email) = lower(v_email)
      )
  ) then
    raise exception 'Perfil institucional não localizado.' using errcode = 'P0002';
  end if;

  insert into public.presenca_online_monitora (user_id, current_view, seen_at)
  values (v_user_id, left(nullif(trim(p_current_view), ''), 120), timezone('utc', now()))
  on conflict (user_id) do update
    set current_view = excluded.current_view,
        seen_at = excluded.seen_at;

  return jsonb_build_object('status', 'OK');
end;
$$;

revoke all on function public.registrar_presenca_monitora(text) from public, anon;
grant execute on function public.registrar_presenca_monitora(text) to authenticated;

create or replace function public.listar_presenca_online_monitora()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_result jsonb;
  v_user_id uuid := auth.uid();
  v_email text := coalesce(auth.jwt() ->> 'email', '');
begin
  if v_user_id is null then
    raise exception 'Sessão não localizada.' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.perfis_usuarios p
    where p.ativo is true
      and (
        p.user_id = v_user_id
        or lower(p.email) = lower(v_email)
      )
      and (
        lower(coalesce(p.perfil, '')) = 'master'
        or p.p_config is true
        or p.p_admin is true
      )
  ) then
    raise exception 'Acesso restrito aos perfis autorizados para ver presença.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(person) order by person."fullName", person."userId"), '[]'::jsonb)
  into v_result
  from (
    select
      po.user_id as "userId",
      coalesce(nullif(trim(p.nome), ''), split_part(coalesce(p.email, ''), '@', 1), 'Usuário AgSUS') as "fullName",
      coalesce(
        case when p.avatar_source in ('GOOGLE', 'UPLOADED') then p.avatar_url end,
        p.google_avatar_url
      ) as "avatarUrl",
      case when lower(coalesce(p.perfil, '')) = 'master' then 'Master'
           else initcap(coalesce(nullif(p.perfil, ''), 'Usuário')) end as "profileLabel",
      po.current_view as "currentView",
      po.seen_at as "onlineAt"
    from public.presenca_online_monitora po
    join lateral (
      select profile.*
      from public.perfis_usuarios profile
      where profile.ativo is true
        and (
          profile.user_id = po.user_id
          or lower(profile.email) = lower(coalesce(
            (select email from auth.users where id = po.user_id),
            ''
          ))
        )
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
$$;

revoke all on function public.listar_presenca_online_monitora() from public, anon;
grant execute on function public.listar_presenca_online_monitora() to authenticated;

comment on table public.presenca_online_monitora is
  'Última batida de presença de cada usuário do AgSUS Monitora; dado descartável, sem histórico.';
comment on function public.registrar_presenca_monitora(text) is
  'Registra a própria presença autenticada; não aceita identificador fornecido pelo cliente.';
comment on function public.listar_presenca_online_monitora() is
  'Lista usuários ativos nos últimos dois minutos para perfis administrativos autorizados.';

notify pgrst, 'reload schema';

commit;
