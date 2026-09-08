begin;

create or replace function private.definir_fundo_acesso_monitora(
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
    ('auth_access_background_url', coalesce(v_url, ''), 'Arte institucional da tela de acesso'),
    ('auth_access_background_path', coalesce(v_caminho, ''), 'Caminho da arte de acesso no Supabase Storage')
  on conflict (chave) do update
  set valor = excluded.valor,
      descricao = excluded.descricao;

  return jsonb_build_object('url', v_url, 'caminho', v_caminho);
end;
$$;

revoke all on function private.definir_fundo_acesso_monitora(text, text) from public, anon;
grant execute on function private.definir_fundo_acesso_monitora(text, text) to authenticated;

create or replace function public.definir_fundo_acesso_monitora(
  p_url text default null,
  p_caminho text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.definir_fundo_acesso_monitora(p_url, p_caminho);
$$;

revoke all on function public.definir_fundo_acesso_monitora(text, text) from public, anon;
grant execute on function public.definir_fundo_acesso_monitora(text, text) to authenticated;

comment on function public.definir_fundo_acesso_monitora(text, text) is
  'Endpoint invoker para a rotina privada que valida o perfil Master.';

commit;
