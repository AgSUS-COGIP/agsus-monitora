begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'platform-assets',
  'platform-assets',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into public.configuracoes (chave, valor, descricao)
values (
  'auth_access_background_path',
  '',
  'Caminho da arte de acesso no Supabase Storage'
)
on conflict (chave) do nothing;

update public.configuracoes
set valor = '/assets/access-background-default.svg',
    descricao = 'Arte institucional da tela de acesso'
where chave = 'auth_access_background_url'
  and (
    nullif(btrim(valor), '') is null
    or valor like 'https://envajznrzfuuumcdtvcj.supabase.co/%'
  );

drop policy if exists "monitora_branding_select_master" on storage.objects;
create policy "monitora_branding_select_master"
on storage.objects for select
to authenticated
using (
  bucket_id = 'platform-assets'
  and (storage.foldername(name))[1] = 'branding'
  and (select private.is_master())
);

drop policy if exists "monitora_branding_insert_master" on storage.objects;
create policy "monitora_branding_insert_master"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'platform-assets'
  and (storage.foldername(name))[1] = 'branding'
  and (select private.is_master())
);

drop policy if exists "monitora_branding_update_master" on storage.objects;
create policy "monitora_branding_update_master"
on storage.objects for update
to authenticated
using (
  bucket_id = 'platform-assets'
  and (storage.foldername(name))[1] = 'branding'
  and (select private.is_master())
)
with check (
  bucket_id = 'platform-assets'
  and (storage.foldername(name))[1] = 'branding'
  and (select private.is_master())
);

drop policy if exists "monitora_branding_delete_master" on storage.objects;
create policy "monitora_branding_delete_master"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'platform-assets'
  and (storage.foldername(name))[1] = 'branding'
  and (select private.is_master())
);

create or replace function public.definir_fundo_acesso_monitora(
  p_url text default null,
  p_caminho text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := nullif(btrim(coalesce(p_url, '')), '');
  v_caminho text := nullif(btrim(coalesce(p_caminho, '')), '');
begin
  if not private.is_master() then
    raise exception 'Acesso restrito ao perfil Master.' using errcode = '42501';
  end if;

  if (v_url is null) <> (v_caminho is null) then
    raise exception 'Informe a URL e o caminho da arte em conjunto.' using errcode = '22023';
  end if;
  if v_url is not null and v_url not like 'https://%' then
    raise exception 'A imagem precisa ser servida por HTTPS.' using errcode = '22023';
  end if;
  if v_caminho is not null and v_caminho !~ '^branding/[A-Za-z0-9._-]+$' then
    raise exception 'Caminho de armazenamento inválido.' using errcode = '22023';
  end if;

  insert into public.configuracoes (chave, valor, descricao)
  values
    (
      'auth_access_background_url',
      coalesce(v_url, ''),
      'Arte institucional da tela de acesso'
    ),
    (
      'auth_access_background_path',
      coalesce(v_caminho, ''),
      'Caminho da arte de acesso no Supabase Storage'
    )
  on conflict (chave) do update
  set valor = excluded.valor,
      descricao = excluded.descricao;

  return jsonb_build_object('url', v_url, 'caminho', v_caminho);
end;
$$;

revoke all on function public.definir_fundo_acesso_monitora(text, text) from public, anon;
grant execute on function public.definir_fundo_acesso_monitora(text, text) to authenticated;

comment on function public.definir_fundo_acesso_monitora(text, text) is
  'Grava somente a arte de acesso do Monitora sem sobrescrever outras configurações.';

commit;
