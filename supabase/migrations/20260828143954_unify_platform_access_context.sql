-- Contexto único de identidade, módulos e painéis do AgSUS Monitora.
-- O frontend passa a resolver a autorização em uma chamada, como no AgSUS Pesquisas.

create index if not exists perfis_usuarios_user_id_ativo_idx
  on public.perfis_usuarios (user_id)
  where ativo is true and user_id is not null;

create index if not exists perfis_usuarios_email_normalizado_ativo_idx
  on public.perfis_usuarios ((lower(email)))
  where ativo is true;

create index if not exists perfis_paineis_externos_perfil_ativo_idx
  on public.perfis_paineis_externos (perfil_usuario_id, painel_id)
  where ativo is true;

create or replace function public.obter_contexto_monitora()
returns jsonb
language sql
stable
security invoker
set search_path = ''
set statement_timeout = '3s'
as $$
  with perfil_atual as (
    select p.*
    from public.perfis_usuarios as p
    where p.ativo is true
      and (
        p.user_id = (select auth.uid())
        or lower(p.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
      )
    order by case when p.user_id = (select auth.uid()) then 0 else 1 end,
             p.updated_at desc nulls last
    limit 1
  ),
  paineis_permitidos as (
    select pe.id::text as painel_id
    from perfil_atual as p
    join public.paineis_externos as pe
      on pe.ativo is true
    where lower(coalesce(p.perfil, '')) = 'master'

    union

    select pp.painel_id::text
    from perfil_atual as p
    join public.perfis_paineis_externos as pp
      on pp.perfil_usuario_id = p.id
     and pp.ativo is true
    join public.paineis_externos as pe
      on pe.id = pp.painel_id
     and pe.ativo is true
    where lower(coalesce(p.perfil, '')) <> 'master'
  )
  select jsonb_build_object(
    'profile', to_jsonb(p),
    'panel_ids', coalesce(
      (select jsonb_agg(pp.painel_id order by pp.painel_id) from paineis_permitidos as pp),
      '[]'::jsonb
    ),
    'modules', jsonb_build_object(
      'ind', p.p_ind or lower(coalesce(p.perfil, '')) = 'master',
      'cores', p.p_cores or lower(coalesce(p.perfil, '')) = 'master',
      'paineis', p.p_paineis or lower(coalesce(p.perfil, '')) = 'master',
      'config', p.p_config or lower(coalesce(p.perfil, '')) = 'master',
      'admin', p.p_admin or lower(coalesce(p.perfil, '')) = 'master'
    )
  )
  from perfil_atual as p;
$$;

revoke all on function public.obter_contexto_monitora() from public, anon;
grant execute on function public.obter_contexto_monitora() to authenticated;

comment on function public.obter_contexto_monitora()
is 'Resolve em uma chamada o perfil ativo, os módulos e os painéis externos permitidos ao usuário autenticado.';

-- Upload com upsert exige SELECT, INSERT e UPDATE. A migration anterior tinha
-- INSERT/UPDATE, mas não SELECT para o próprio caminho do usuário.
drop policy if exists "monitora_avatar_select_own" on storage.objects;
create policy "monitora_avatar_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'monitora-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
