alter table public.perfis_usuarios
  add column if not exists avatar_source text,
  add column if not exists avatar_url text,
  add column if not exists avatar_config jsonb,
  add column if not exists google_avatar_url text;

update public.perfis_usuarios
set
  avatar_source = coalesce(avatar_source, 'INITIALS'),
  avatar_config = coalesce(avatar_config, '{}'::jsonb)
where avatar_source is null or avatar_config is null;

alter table public.perfis_usuarios
  alter column avatar_source set default 'INITIALS',
  alter column avatar_source set not null,
  alter column avatar_config set default '{}'::jsonb,
  alter column avatar_config set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'perfis_usuarios_avatar_source_check'
      and conrelid = 'public.perfis_usuarios'::regclass
  ) then
    alter table public.perfis_usuarios
      add constraint perfis_usuarios_avatar_source_check
      check (avatar_source in ('GOOGLE', 'UPLOADED', 'GENERATED', 'INITIALS'));
  end if;
end
$$;

drop function if exists public.meu_usuario();

create function public.meu_usuario()
returns table(
  id uuid,
  user_id uuid,
  email text,
  nome text,
  perfil text,
  ativo boolean,
  p_ind boolean,
  p_cores boolean,
  p_paineis boolean,
  p_config boolean,
  p_admin boolean,
  avatar_source text,
  avatar_url text,
  avatar_config jsonb,
  google_avatar_url text
)
language sql
stable
set search_path = public, auth
set statement_timeout = '3s'
as $$
  select
    p.id,
    p.user_id,
    p.email,
    p.nome,
    p.perfil,
    p.ativo,
    p.p_ind,
    p.p_cores,
    p.p_paineis,
    p.p_config,
    p.p_admin,
    p.avatar_source,
    p.avatar_url,
    p.avatar_config,
    coalesce(
      p.google_avatar_url,
      auth.jwt() -> 'user_metadata' ->> 'avatar_url',
      auth.jwt() -> 'user_metadata' ->> 'picture'
    ) as google_avatar_url
  from public.perfis_usuarios p
  where p.ativo = true
    and (
      p.user_id = auth.uid()
      or lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  limit 1;
$$;

revoke all on function public.meu_usuario() from public, anon;
grant execute on function public.meu_usuario() to authenticated;

create or replace function public.set_my_avatar_choice(
  p_source text,
  p_avatar_url text default null,
  p_avatar_config jsonb default '{}'::jsonb
)
returns table(
  avatar_source text,
  avatar_url text,
  avatar_config jsonb,
  google_avatar_url text
)
language plpgsql
security definer
set search_path = public, auth
set statement_timeout = '5s'
as $$
declare
  v_source text := upper(trim(coalesce(p_source, '')));
  v_url text := nullif(trim(coalesce(p_avatar_url, '')), '');
  v_config jsonb := coalesce(p_avatar_config, '{}'::jsonb);
begin
  if auth.uid() is null then
    raise exception 'Sessão não localizada.' using errcode = '28000';
  end if;

  if v_source not in ('GOOGLE', 'UPLOADED', 'GENERATED', 'INITIALS') then
    raise exception 'Origem de avatar inválida.' using errcode = '22023';
  end if;

  if v_source in ('GOOGLE', 'UPLOADED')
    and (v_url is null or v_url !~* '^https://') then
    raise exception 'A imagem selecionada precisa usar HTTPS.' using errcode = '22023';
  end if;

  if v_url is not null and length(v_url) > 2048 then
    raise exception 'URL de avatar inválida.' using errcode = '22023';
  end if;

  if jsonb_typeof(v_config) <> 'object' then
    raise exception 'Configuração de avatar inválida.' using errcode = '22023';
  end if;

  update public.perfis_usuarios p
  set
    avatar_source = v_source,
    avatar_url = case
      when v_source in ('GOOGLE', 'UPLOADED') then v_url
      else null
    end,
    avatar_config = case
      when v_source = 'GENERATED' then v_config
      else p.avatar_config
    end,
    google_avatar_url = case
      when v_source = 'GOOGLE' then v_url
      else p.google_avatar_url
    end,
    updated_at = now()
  where p.ativo = true
    and (
      p.user_id = auth.uid()
      or lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );

  if not found then
    raise exception 'Perfil institucional não localizado.' using errcode = 'P0002';
  end if;

  return query
  select
    p.avatar_source,
    p.avatar_url,
    p.avatar_config,
    coalesce(
      p.google_avatar_url,
      auth.jwt() -> 'user_metadata' ->> 'avatar_url',
      auth.jwt() -> 'user_metadata' ->> 'picture'
    )
  from public.perfis_usuarios p
  where p.ativo = true
    and (
      p.user_id = auth.uid()
      or lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  limit 1;
end;
$$;

revoke all on function public.set_my_avatar_choice(text, text, jsonb) from public, anon;
grant execute on function public.set_my_avatar_choice(text, text, jsonb) to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'monitora-avatars',
  'monitora-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "monitora_avatar_insert_own" on storage.objects;
drop policy if exists "monitora_avatar_update_own" on storage.objects;
drop policy if exists "monitora_avatar_delete_own" on storage.objects;

create policy "monitora_avatar_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'monitora-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "monitora_avatar_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'monitora-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'monitora-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "monitora_avatar_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'monitora-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
