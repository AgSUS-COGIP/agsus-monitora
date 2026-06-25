-- AgSUS Monitora: solicitacoes de acesso e permissao por painel externo.
-- Mudanca aditiva: nao altera o funcionamento atual dos paineis existentes.

create table if not exists public.solicitacoes_acesso (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  nome text,
  setor text,
  justificativa text,
  perfil_solicitado text not null default 'leitor'
    check (perfil_solicitado in ('leitor', 'editor', 'admin')),
  status text not null default 'pendente'
    check (status in ('pendente', 'aprovado', 'recusado', 'cancelado')),
  avaliado_por uuid references auth.users(id),
  avaliado_em timestamptz,
  observacao_admin text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists solicitacoes_acesso_user_pendente_uidx
  on public.solicitacoes_acesso(user_id)
  where status = 'pendente';

create index if not exists solicitacoes_acesso_status_created_idx
  on public.solicitacoes_acesso(status, created_at desc);

create table if not exists public.solicitacoes_acesso_paineis (
  solicitacao_id uuid not null references public.solicitacoes_acesso(id) on delete cascade,
  painel_id uuid not null references public.paineis_externos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (solicitacao_id, painel_id)
);

create table if not exists public.perfis_paineis_externos (
  perfil_usuario_id uuid not null references public.perfis_usuarios(id) on delete cascade,
  painel_id uuid not null references public.paineis_externos(id) on delete cascade,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (perfil_usuario_id, painel_id)
);

create index if not exists perfis_paineis_externos_painel_idx
  on public.perfis_paineis_externos(painel_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_solicitacoes_acesso_updated_at on public.solicitacoes_acesso;
create trigger trg_solicitacoes_acesso_updated_at
before update on public.solicitacoes_acesso
for each row execute function public.set_updated_at();

drop trigger if exists trg_perfis_paineis_externos_updated_at on public.perfis_paineis_externos;
create trigger trg_perfis_paineis_externos_updated_at
before update on public.perfis_paineis_externos
for each row execute function public.set_updated_at();

alter table public.solicitacoes_acesso enable row level security;
alter table public.solicitacoes_acesso_paineis enable row level security;
alter table public.perfis_paineis_externos enable row level security;

grant select, insert, update, delete on public.solicitacoes_acesso to authenticated;
grant select, insert, update, delete on public.solicitacoes_acesso_paineis to authenticated;
grant select, insert, update, delete on public.perfis_paineis_externos to authenticated;

-- O administrador precisa criar/atualizar perfis ao aprovar solicitacoes.
drop policy if exists perfis_insert_admin on public.perfis_usuarios;
create policy perfis_insert_admin on public.perfis_usuarios
for insert to authenticated
with check (private.has_perm('admin') or private.has_perm('config'));

drop policy if exists perfis_select_admin on public.perfis_usuarios;
create policy perfis_select_admin on public.perfis_usuarios
for select to authenticated
using (private.has_perm('admin') or private.has_perm('config'));

drop policy if exists perfis_update_admin on public.perfis_usuarios;
create policy perfis_update_admin on public.perfis_usuarios
for update to authenticated
using (private.has_perm('admin') or private.has_perm('config'))
with check (private.has_perm('admin') or private.has_perm('config'));

drop policy if exists solicitacoes_select_own_or_admin on public.solicitacoes_acesso;
create policy solicitacoes_select_own_or_admin on public.solicitacoes_acesso
for select to authenticated
using (
  user_id = auth.uid()
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or private.has_perm('admin')
  or private.has_perm('config')
);

drop policy if exists solicitacoes_insert_own on public.solicitacoes_acesso;
create policy solicitacoes_insert_own on public.solicitacoes_acesso
for insert to authenticated
with check (
  user_id = auth.uid()
  and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  and status = 'pendente'
);

drop policy if exists solicitacoes_update_admin on public.solicitacoes_acesso;
create policy solicitacoes_update_admin on public.solicitacoes_acesso
for update to authenticated
using (private.has_perm('admin') or private.has_perm('config'))
with check (private.has_perm('admin') or private.has_perm('config'));

drop policy if exists solicitacoes_delete_admin on public.solicitacoes_acesso;
create policy solicitacoes_delete_admin on public.solicitacoes_acesso
for delete to authenticated
using (private.has_perm('admin') or private.has_perm('config'));

drop policy if exists solicitacoes_paineis_select_own_or_admin on public.solicitacoes_acesso_paineis;
create policy solicitacoes_paineis_select_own_or_admin on public.solicitacoes_acesso_paineis
for select to authenticated
using (
  exists (
    select 1
    from public.solicitacoes_acesso s
    where s.id = solicitacao_id
      and (
        s.user_id = auth.uid()
        or lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        or private.has_perm('admin')
        or private.has_perm('config')
      )
  )
);

drop policy if exists solicitacoes_paineis_insert_own_pending on public.solicitacoes_acesso_paineis;
create policy solicitacoes_paineis_insert_own_pending on public.solicitacoes_acesso_paineis
for insert to authenticated
with check (
  exists (
    select 1
    from public.solicitacoes_acesso s
    where s.id = solicitacao_id
      and s.status = 'pendente'
      and s.user_id = auth.uid()
  )
);

drop policy if exists solicitacoes_paineis_delete_own_pending_or_admin on public.solicitacoes_acesso_paineis;
create policy solicitacoes_paineis_delete_own_pending_or_admin on public.solicitacoes_acesso_paineis
for delete to authenticated
using (
  private.has_perm('admin')
  or private.has_perm('config')
  or exists (
    select 1
    from public.solicitacoes_acesso s
    where s.id = solicitacao_id
      and s.status = 'pendente'
      and s.user_id = auth.uid()
  )
);

drop policy if exists perfis_paineis_select_own_or_admin on public.perfis_paineis_externos;
create policy perfis_paineis_select_own_or_admin on public.perfis_paineis_externos
for select to authenticated
using (
  private.has_perm('admin')
  or private.has_perm('config')
  or exists (
    select 1
    from public.perfis_usuarios p
    where p.id = perfil_usuario_id
      and p.ativo = true
      and (
        p.user_id = auth.uid()
        or lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);

drop policy if exists perfis_paineis_insert_admin on public.perfis_paineis_externos;
create policy perfis_paineis_insert_admin on public.perfis_paineis_externos
for insert to authenticated
with check (private.has_perm('admin') or private.has_perm('config'));

drop policy if exists perfis_paineis_update_admin on public.perfis_paineis_externos;
create policy perfis_paineis_update_admin on public.perfis_paineis_externos
for update to authenticated
using (private.has_perm('admin') or private.has_perm('config'))
with check (private.has_perm('admin') or private.has_perm('config'));

drop policy if exists perfis_paineis_delete_admin on public.perfis_paineis_externos;
create policy perfis_paineis_delete_admin on public.perfis_paineis_externos
for delete to authenticated
using (private.has_perm('admin') or private.has_perm('config'));

-- Backfill: quem ja tinha permissao geral de paineis continua vendo todos os paineis ativos.
insert into public.perfis_paineis_externos (perfil_usuario_id, painel_id, ativo)
select p.id, pe.id, true
from public.perfis_usuarios p
cross join public.paineis_externos pe
where p.ativo = true
  and p.p_paineis = true
  and pe.ativo = true
on conflict (perfil_usuario_id, painel_id)
do update set ativo = excluded.ativo, updated_at = now();
