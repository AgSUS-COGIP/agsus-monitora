begin;

-- Lista de aprovados + RBAC simplificado.
-- Dependentes: Equipe Núcleo, Lista de Aprovados e Configurações > Acessos.
-- Rollback: preservar dados e restaurar as RPCs/perfis anteriores a partir do
-- histórico de migrations. Não remover tabelas com dados em produção.

-- ---------------------------------------------------------------------------
-- 1. Perfis: somente usuario, edital_gestor, contratador e admin.
-- ---------------------------------------------------------------------------

do $$
declare
  v_constraint record;
begin
  if to_regclass('public.perfis_usuarios') is not null then
    for v_constraint in
      select c.conname
      from pg_constraint c
      where c.conrelid = 'public.perfis_usuarios'::regclass
        and c.contype = 'c'
        and pg_get_constraintdef(c.oid) ilike '%perfil%'
    loop
      execute format('alter table public.perfis_usuarios drop constraint %I', v_constraint.conname);
    end loop;
  end if;
end;
$$;

alter table public.solicitacoes_acesso
  drop constraint if exists solicitacoes_acesso_perfil_solicitado_check;

update public.perfis_usuarios
set perfil = case lower(coalesce(perfil, ''))
  when 'master' then 'admin'
  when 'admin' then 'admin'
  when 'editor' then 'edital_gestor'
  when 'edital_gestor' then 'edital_gestor'
  when 'contratador' then 'contratador'
  when 'leitor' then 'usuario'
  when 'usuario' then 'usuario'
  else 'usuario'
end,
p_ind = true,
p_cores = true,
p_paineis = true,
p_config = case when lower(coalesce(perfil, '')) in ('master', 'admin') then true else false end,
p_admin = case when lower(coalesce(perfil, '')) in ('master', 'admin') then true else false end,
updated_at = now();

update public.solicitacoes_acesso
set perfil_solicitado = case lower(coalesce(perfil_solicitado, ''))
  when 'master' then 'admin'
  when 'admin' then 'admin'
  when 'editor' then 'edital_gestor'
  when 'edital_gestor' then 'edital_gestor'
  when 'contratador' then 'contratador'
  when 'leitor' then 'usuario'
  when 'usuario' then 'usuario'
  else 'usuario'
end;

alter table public.perfis_usuarios
  alter column perfil set default 'usuario';
alter table public.perfis_usuarios
  add constraint perfis_usuarios_perfil_check
  check (perfil in ('usuario', 'edital_gestor', 'contratador', 'admin'));

alter table public.solicitacoes_acesso
  alter column perfil_solicitado set default 'usuario';
alter table public.solicitacoes_acesso
  add constraint solicitacoes_acesso_perfil_solicitado_check
  check (perfil_solicitado in ('usuario', 'edital_gestor', 'contratador', 'admin'));

create or replace function private.monitora_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case lower(coalesce(p.perfil, ''))
    when 'master' then 'admin'
    when 'admin' then 'admin'
    when 'editor' then 'edital_gestor'
    when 'edital_gestor' then 'edital_gestor'
    when 'contratador' then 'contratador'
    when 'leitor' then 'usuario'
    when 'usuario' then 'usuario'
    else ''
  end
  from public.perfis_usuarios p
  where p.ativo is true
    and (
      p.user_id = (select auth.uid())
      or lower(p.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
    )
  order by case when p.user_id = (select auth.uid()) then 0 else 1 end,
           p.updated_at desc nulls last
  limit 1;
$$;

create or replace function private.monitora_role_in(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.monitora_role() = any(p_roles), false);
$$;

-- Mantém o nome legado porque várias policies/RPCs existentes dependem dele.
create or replace function private.is_master()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.monitora_role() = 'admin';
$$;

revoke all on function private.monitora_role() from public;
revoke all on function private.monitora_role_in(text[]) from public;
revoke all on function private.is_master() from public;
grant execute on function private.monitora_role() to authenticated;
grant execute on function private.monitora_role_in(text[]) to authenticated;
grant execute on function private.is_master() to authenticated;

-- Todos os quatro perfis visualizam os módulos e painéis ativos. Config/Admin só admin.
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
    from public.perfis_usuarios p
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
    from public.paineis_externos pe
    where pe.ativo is true
  )
  select jsonb_build_object(
    'profile', to_jsonb(p),
    'panel_ids', coalesce(
      (select jsonb_agg(pp.painel_id order by pp.painel_id) from paineis_permitidos pp),
      '[]'::jsonb
    ),
    'modules', jsonb_build_object(
      'ind', true,
      'cores', true,
      'paineis', true,
      'config', lower(coalesce(p.perfil, '')) = 'admin',
      'admin', lower(coalesce(p.perfil, '')) = 'admin'
    )
  )
  from perfil_atual p;
$$;

revoke all on function public.obter_contexto_monitora() from public, anon;
grant execute on function public.obter_contexto_monitora() to authenticated;

-- Todos os perfis ativos podem consultar o módulo de Análises.
create or replace function public.usuario_pode_ler_analises()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.monitora_role() <> '';
$$;

revoke all on function public.usuario_pode_ler_analises() from public, anon;
grant execute on function public.usuario_pode_ler_analises() to authenticated;

-- Aprovação de acesso: assinatura preservada, p_permissoes/p_paineis mantidos
-- apenas por compatibilidade com clientes antigos. O perfil determina tudo.
create or replace function public.aprovar_solicitacao_acesso(
  p_solicitacao_id uuid,
  p_perfil text default 'usuario',
  p_permissoes jsonb default '{}'::jsonb,
  p_paineis uuid[] default '{}'::uuid[],
  p_observacao_admin text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.solicitacoes_acesso%rowtype;
  v_perfil_id uuid;
  v_perfil text := lower(nullif(btrim(coalesce(p_perfil, '')), ''));
  v_admin boolean;
begin
  if (select auth.uid()) is null then raise exception 'Usuario nao autenticado'; end if;
  if not private.is_master() then raise exception 'Somente perfil admin pode aprovar solicitacao de acesso'; end if;
  if v_perfil not in ('usuario', 'edital_gestor', 'contratador', 'admin') then
    raise exception 'Perfil invalido: %', v_perfil;
  end if;
  v_admin := v_perfil = 'admin';

  select * into v_req
  from public.solicitacoes_acesso
  where id = p_solicitacao_id
  for update;
  if not found then raise exception 'Solicitacao de acesso nao encontrada'; end if;

  select id into v_perfil_id
  from public.perfis_usuarios
  where (v_req.user_id is not null and user_id = v_req.user_id)
     or lower(email) = lower(v_req.email)
  order by case when user_id = v_req.user_id then 0 else 1 end, updated_at desc
  limit 1
  for update;

  if v_perfil_id is null then
    insert into public.perfis_usuarios(
      user_id,email,nome,perfil,ativo,p_ind,p_cores,p_paineis,p_config,p_admin
    ) values (
      v_req.user_id, v_req.email,
      coalesce(nullif(btrim(v_req.nome), ''), v_req.email),
      v_perfil, true, true, true, true, v_admin, v_admin
    ) returning id into v_perfil_id;
  else
    update public.perfis_usuarios
    set user_id = coalesce(public.perfis_usuarios.user_id, v_req.user_id),
        email = v_req.email,
        nome = coalesce(nullif(btrim(v_req.nome), ''), public.perfis_usuarios.nome, v_req.email),
        perfil = v_perfil,
        ativo = true,
        p_ind = true,
        p_cores = true,
        p_paineis = true,
        p_config = v_admin,
        p_admin = v_admin,
        updated_at = now()
    where id = v_perfil_id;
  end if;

  delete from public.perfis_paineis_externos where perfil_usuario_id = v_perfil_id;
  insert into public.perfis_paineis_externos(perfil_usuario_id, painel_id, ativo)
  select v_perfil_id, pe.id, true
  from public.paineis_externos pe
  where pe.ativo is true
  on conflict (perfil_usuario_id, painel_id) do update
    set ativo = true, updated_at = now();

  update public.solicitacoes_acesso
  set status = 'aprovado', avaliado_por = (select auth.uid()), avaliado_em = now(),
      observacao_admin = nullif(btrim(p_observacao_admin), ''), updated_at = now()
  where id = v_req.id;

  return jsonb_build_object('ok', true, 'perfil_usuario_id', v_perfil_id, 'perfil', v_perfil);
end;
$$;

create or replace function public.atualizar_acesso_usuario(
  p_perfil_usuario_id uuid,
  p_perfil text default 'usuario',
  p_permissoes jsonb default '{}'::jsonb,
  p_paineis uuid[] default '{}'::uuid[],
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil text := lower(nullif(btrim(coalesce(p_perfil, '')), ''));
  v_admin boolean;
  v_email text;
begin
  if (select auth.uid()) is null then raise exception 'Usuario nao autenticado'; end if;
  if not private.is_master() then raise exception 'Somente perfil admin pode atualizar acesso de usuario'; end if;
  if v_perfil not in ('usuario', 'edital_gestor', 'contratador', 'admin') then
    raise exception 'Perfil invalido: %', v_perfil;
  end if;
  if p_perfil_usuario_id is null then raise exception 'Perfil de usuario nao informado'; end if;
  v_admin := v_perfil = 'admin';

  update public.perfis_usuarios
  set perfil = v_perfil, ativo = true, p_ind = true, p_cores = true, p_paineis = true,
      p_config = v_admin, p_admin = v_admin, updated_at = now()
  where id = p_perfil_usuario_id
  returning email into v_email;
  if not found then raise exception 'Perfil de usuario nao encontrado'; end if;

  delete from public.perfis_paineis_externos where perfil_usuario_id = p_perfil_usuario_id;
  insert into public.perfis_paineis_externos(perfil_usuario_id, painel_id, ativo)
  select p_perfil_usuario_id, pe.id, true
  from public.paineis_externos pe
  where pe.ativo is true
  on conflict (perfil_usuario_id, painel_id) do update
    set ativo = true, updated_at = now();

  return jsonb_build_object(
    'ok', true, 'perfil_usuario_id', p_perfil_usuario_id, 'email', v_email,
    'perfil', v_perfil, 'motivo', nullif(btrim(p_motivo), '')
  );
end;
$$;

grant execute on function public.aprovar_solicitacao_acesso(uuid, text, jsonb, uuid[], text) to authenticated;
grant execute on function public.atualizar_acesso_usuario(uuid, text, jsonb, uuid[], text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Estruturas relacionais da Lista de Aprovados.
-- ---------------------------------------------------------------------------
create table if not exists public.listas_aprovados (
  id uuid primary key default gen_random_uuid(),
  edital_id text not null,
  ativo boolean not null default true,
  vigente boolean not null default true,
  arquivo_nome text not null,
  arquivo_path text not null,
  importado_por uuid not null,
  importado_em timestamptz not null default now(),
  substituido_por uuid,
  substituido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists listas_aprovados_edital_vigente_uidx
  on public.listas_aprovados(edital_id)
  where vigente is true;
create index if not exists listas_aprovados_edital_hist_idx
  on public.listas_aprovados(edital_id, importado_em desc);

create table if not exists public.lista_aprovados_candidatos (
  id uuid primary key default gen_random_uuid(),
  lista_id uuid not null references public.listas_aprovados(id) on delete restrict,
  codigo_vaga text,
  cargo text not null,
  classificacao integer,
  nota numeric not null,
  nome text not null,
  modalidade text,
  status text,
  processo_sei text,
  matricula text,
  sub_judice boolean not null default false,
  removido_em timestamptz,
  removido_por uuid,
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lista_aprovados_classificacao_check
    check (classificacao is null or classificacao > 0),
  constraint lista_aprovados_nota_check check (nota >= 0),
  constraint lista_aprovados_status_check
    check (status is null or status in ('Contratado', 'Desistente', 'Migração', 'Documentação Rejeitada')),
  constraint lista_aprovados_matricula_status_check
    check (status not in ('Contratado', 'Migração') or nullif(btrim(matricula), '') is not null),
  constraint lista_aprovados_importado_campos_check
    check (sub_judice is true or (
      nullif(btrim(codigo_vaga), '') is not null
      and classificacao is not null
      and nullif(btrim(modalidade), '') is not null
    ))
);

create index if not exists lista_aprovados_candidatos_lista_idx
  on public.lista_aprovados_candidatos(lista_id, cargo, classificacao);
create index if not exists lista_aprovados_candidatos_status_idx
  on public.lista_aprovados_candidatos(status) where removido_em is null;
create index if not exists lista_aprovados_candidatos_nome_idx
  on public.lista_aprovados_candidatos(lower(nome));

create table if not exists public.lista_aprovados_historico (
  id uuid primary key default gen_random_uuid(),
  candidato_id uuid not null references public.lista_aprovados_candidatos(id) on delete restrict,
  lista_id uuid not null references public.listas_aprovados(id) on delete restrict,
  status_anterior text,
  status_novo text,
  processo_sei text,
  matricula text,
  alterado_por uuid not null,
  alterado_em timestamptz not null default now()
);

create index if not exists lista_aprovados_historico_candidato_idx
  on public.lista_aprovados_historico(candidato_id, alterado_em desc);

alter table public.listas_aprovados enable row level security;
alter table public.lista_aprovados_candidatos enable row level security;
alter table public.lista_aprovados_historico enable row level security;

revoke all on public.listas_aprovados from anon, authenticated;
revoke all on public.lista_aprovados_candidatos from anon, authenticated;
revoke all on public.lista_aprovados_historico from anon, authenticated;
grant select on public.listas_aprovados to authenticated;
grant select on public.lista_aprovados_candidatos to authenticated;
grant select on public.lista_aprovados_historico to authenticated;

drop policy if exists listas_aprovados_select_perfil_ativo on public.listas_aprovados;
create policy listas_aprovados_select_perfil_ativo on public.listas_aprovados
for select to authenticated using (private.monitora_role() <> '');

drop policy if exists lista_aprovados_candidatos_select_perfil_ativo on public.lista_aprovados_candidatos;
create policy lista_aprovados_candidatos_select_perfil_ativo on public.lista_aprovados_candidatos
for select to authenticated using (private.monitora_role() <> '');

drop policy if exists lista_aprovados_historico_select_admin on public.lista_aprovados_historico;
create policy lista_aprovados_historico_select_admin on public.lista_aprovados_historico
for select to authenticated using (private.monitora_role() = 'admin');

-- ---------------------------------------------------------------------------
-- 3. Storage privado para o XLSX original.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listas-aprovados', 'listas-aprovados', false, 10485760,
  array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "listas_aprovados_storage_select" on storage.objects;
create policy "listas_aprovados_storage_select" on storage.objects
for select to authenticated
using (bucket_id = 'listas-aprovados' and private.monitora_role() <> '');

drop policy if exists "listas_aprovados_storage_insert" on storage.objects;
create policy "listas_aprovados_storage_insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'listas-aprovados'
  and private.monitora_role_in(array['edital_gestor','contratador','admin']::text[])
);

drop policy if exists "listas_aprovados_storage_delete_admin" on storage.objects;
create policy "listas_aprovados_storage_delete_admin" on storage.objects
for delete to authenticated
using (bucket_id = 'listas-aprovados' and private.monitora_role() = 'admin');

-- ---------------------------------------------------------------------------
-- 4. Consultas operacionais.
-- ---------------------------------------------------------------------------
create or replace function public.listar_listas_aprovados()
returns table (
  lista_id uuid,
  edital_id text,
  edital text,
  unidade text,
  ativo boolean,
  arquivo_nome text,
  arquivo_path text,
  importado_em timestamptz,
  total_candidatos bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.monitora_role() = '' then raise exception 'Perfil sem acesso ao sistema'; end if;
  return query
  select l.id, l.edital_id, m.edital, m.unidade, l.ativo, l.arquivo_nome,
         l.arquivo_path, l.importado_em,
         count(c.id) filter (where c.removido_em is null)
  from public.listas_aprovados l
  join public.monitoramento_indigena m on m.id::text = l.edital_id
  left join public.lista_aprovados_candidatos c on c.lista_id = l.id
  where l.vigente is true
  group by l.id, m.edital, m.unidade
  order by m.edital, m.unidade;
end;
$$;

create or replace function public.listar_candidatos_aprovados()
returns table (
  candidato_id uuid,
  lista_id uuid,
  edital_id text,
  edital text,
  unidade text,
  cargo text,
  classificacao integer,
  nota numeric,
  nome text,
  modalidade text,
  status text,
  processo_sei text,
  matricula text,
  sub_judice boolean,
  lista_ativa boolean,
  arquivo_nome text,
  importado_em timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.monitora_role() = '' then raise exception 'Perfil sem acesso ao sistema'; end if;
  return query
  select c.id, l.id, l.edital_id, m.edital, m.unidade, c.cargo, c.classificacao,
         c.nota, c.nome, c.modalidade, c.status, c.processo_sei, c.matricula,
         c.sub_judice, l.ativo, l.arquivo_nome, l.importado_em
  from public.listas_aprovados l
  join public.monitoramento_indigena m on m.id::text = l.edital_id
  join public.lista_aprovados_candidatos c on c.lista_id = l.id
  where l.vigente is true
    and c.removido_em is null
  order by m.edital, c.cargo, c.classificacao nulls last, c.nome;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Importação/substituição e estado da lista.
-- ---------------------------------------------------------------------------
create or replace function public.importar_lista_aprovados(
  p_edital_id text,
  p_ativo boolean,
  p_arquivo_nome text,
  p_arquivo_path text,
  p_candidatos jsonb,
  p_substituir boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := private.monitora_role();
  v_lista_id uuid;
  v_lista_atual uuid;
  v_ja_teve_lista boolean;
  v_total integer;
  v_edital text;
begin
  if (select auth.uid()) is null then raise exception 'Usuario nao autenticado'; end if;
  if v_role not in ('edital_gestor', 'contratador', 'admin') then
    raise exception 'Perfil sem permissao para importar lista de aprovados';
  end if;
  if p_edital_id is null then raise exception 'Edital nao informado'; end if;
  if nullif(btrim(p_arquivo_nome), '') is null or nullif(btrim(p_arquivo_path), '') is null then
    raise exception 'Arquivo XLSX nao informado';
  end if;
  if jsonb_typeof(p_candidatos) <> 'array' or jsonb_array_length(p_candidatos) = 0 then
    raise exception 'A lista precisa conter pelo menos um candidato';
  end if;

  select m.edital into v_edital from public.monitoramento_indigena m where m.id::text = p_edital_id;
  if not found then raise exception 'Edital nao encontrado na Equipe Nucleo'; end if;

  select exists(select 1 from public.listas_aprovados where edital_id = p_edital_id)
    into v_ja_teve_lista;
  select id into v_lista_atual
  from public.listas_aprovados
  where edital_id = p_edital_id and vigente is true
  for update;

  if v_ja_teve_lista and v_role <> 'admin' then
    raise exception 'Somente admin pode substituir ou importar novamente uma lista ja cadastrada';
  end if;
  if v_lista_atual is not null and not coalesce(p_substituir, false) then
    raise exception 'Este edital ja possui lista. Use a opcao de substituicao administrativa';
  end if;
  if coalesce(p_substituir, false) and v_role <> 'admin' then
    raise exception 'Somente admin pode substituir lista de aprovados';
  end if;

  if v_lista_atual is not null then
    update public.listas_aprovados
    set vigente = false, ativo = false, substituido_por = (select auth.uid()),
        substituido_em = now(), updated_at = now()
    where id = v_lista_atual;
  end if;

  insert into public.listas_aprovados(
    edital_id, ativo, vigente, arquivo_nome, arquivo_path, importado_por
  ) values (
    p_edital_id, coalesce(p_ativo, true), true, btrim(p_arquivo_nome),
    btrim(p_arquivo_path), (select auth.uid())
  ) returning id into v_lista_id;

  insert into public.lista_aprovados_candidatos(
    lista_id, codigo_vaga, cargo, classificacao, nota, nome, modalidade,
    sub_judice, created_by, updated_by
  )
  select v_lista_id,
         nullif(btrim(x.codigo_vaga), ''),
         nullif(btrim(x.cargo), ''),
         x.classificacao,
         x.nota,
         nullif(btrim(x.nome), ''),
         nullif(btrim(x.modalidade), ''),
         false,
         (select auth.uid()),
         (select auth.uid())
  from jsonb_to_recordset(p_candidatos) as x(
    codigo_vaga text,
    cargo text,
    classificacao integer,
    nota numeric,
    nome text,
    modalidade text
  );

  get diagnostics v_total = row_count;
  if v_total <> jsonb_array_length(p_candidatos) then
    raise exception 'Nem todos os candidatos puderam ser importados';
  end if;

  return jsonb_build_object(
    'ok', true, 'lista_id', v_lista_id, 'edital_id', p_edital_id,
    'edital', v_edital, 'total', v_total, 'ativo', coalesce(p_ativo, true)
  );
end;
$$;

create or replace function public.definir_lista_aprovados_ativa(
  p_lista_id uuid,
  p_ativo boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := private.monitora_role();
  v_edital_id text;
begin
  if v_role not in ('edital_gestor', 'contratador', 'admin') then
    raise exception 'Perfil sem permissao para alterar a lista';
  end if;
  update public.listas_aprovados
  set ativo = coalesce(p_ativo, false), updated_at = now()
  where id = p_lista_id and vigente is true
  returning edital_id into v_edital_id;
  if not found then raise exception 'Lista vigente nao encontrada'; end if;
  return jsonb_build_object('ok', true, 'lista_id', p_lista_id, 'edital_id', v_edital_id, 'ativo', coalesce(p_ativo, false));
end;
$$;

create or replace function public.remover_lista_aprovados(p_lista_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_edital_id text;
begin
  if private.monitora_role() <> 'admin' then raise exception 'Somente admin pode remover lista de aprovados'; end if;
  update public.listas_aprovados
  set vigente = false, ativo = false, substituido_por = (select auth.uid()),
      substituido_em = now(), updated_at = now()
  where id = p_lista_id and vigente is true
  returning edital_id into v_edital_id;
  if not found then raise exception 'Lista vigente nao encontrada'; end if;
  return jsonb_build_object('ok', true, 'lista_id', p_lista_id, 'edital_id', v_edital_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Status e sub judice.
-- ---------------------------------------------------------------------------
create or replace function public.alterar_status_candidato_aprovado(
  p_candidato_id uuid,
  p_status text,
  p_processo_sei text default null,
  p_matricula text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := private.monitora_role();
  v_candidato public.lista_aprovados_candidatos%rowtype;
  v_lista public.listas_aprovados%rowtype;
  v_status text := nullif(btrim(coalesce(p_status, '')), '');
  v_matricula text := nullif(btrim(coalesce(p_matricula, '')), '');
begin
  if v_role not in ('contratador', 'admin') then raise exception 'Perfil sem permissao para alterar status'; end if;
  if v_status is not null and v_status not in ('Contratado', 'Desistente', 'Migração', 'Documentação Rejeitada') then
    raise exception 'Status invalido';
  end if;
  if v_status in ('Contratado', 'Migração') and v_matricula is null then
    raise exception 'Matricula obrigatoria para Contratado ou Migracao';
  end if;

  select * into v_candidato
  from public.lista_aprovados_candidatos
  where id = p_candidato_id and removido_em is null
  for update;
  if not found then raise exception 'Candidato nao encontrado'; end if;

  select * into v_lista
  from public.listas_aprovados
  where id = v_candidato.lista_id and vigente is true
  for update;
  if not found then raise exception 'Lista vigente nao encontrada'; end if;
  if not v_lista.ativo then raise exception 'A lista esta inativa e nao permite alterar candidatos'; end if;

  insert into public.lista_aprovados_historico(
    candidato_id, lista_id, status_anterior, status_novo, processo_sei, matricula, alterado_por
  ) values (
    v_candidato.id, v_candidato.lista_id, v_candidato.status, v_status,
    nullif(btrim(coalesce(p_processo_sei, '')), ''), v_matricula, (select auth.uid())
  );

  update public.lista_aprovados_candidatos
  set status = v_status,
      processo_sei = nullif(btrim(coalesce(p_processo_sei, '')), ''),
      matricula = case when v_status in ('Contratado', 'Migração') then v_matricula else null end,
      updated_by = (select auth.uid()), updated_at = now()
  where id = v_candidato.id;

  return jsonb_build_object('ok', true, 'candidato_id', v_candidato.id, 'status', v_status, 'matricula', v_matricula);
end;
$$;

create or replace function public.incluir_sub_judice(
  p_edital_id text,
  p_cargo text,
  p_nome text,
  p_nota numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := private.monitora_role();
  v_lista public.listas_aprovados%rowtype;
  v_candidato_id uuid;
begin
  if v_role not in ('contratador', 'admin') then raise exception 'Perfil sem permissao para incluir sub judice'; end if;
  if nullif(btrim(coalesce(p_cargo, '')), '') is null then raise exception 'Cargo obrigatorio'; end if;
  if nullif(btrim(coalesce(p_nome, '')), '') is null then raise exception 'Nome obrigatorio'; end if;
  if p_nota is null or p_nota < 0 then raise exception 'Nota invalida'; end if;

  select * into v_lista
  from public.listas_aprovados
  where edital_id = p_edital_id and vigente is true
  for update;
  if not found then raise exception 'O edital ainda nao possui lista vigente'; end if;
  if not v_lista.ativo then raise exception 'A lista esta inativa e nao permite incluir sub judice'; end if;

  if not exists (
    select 1 from public.lista_aprovados_candidatos
    where lista_id = v_lista.id and removido_em is null and cargo = btrim(p_cargo)
  ) then
    raise exception 'Cargo nao pertence a lista vigente deste edital';
  end if;

  insert into public.lista_aprovados_candidatos(
    lista_id, cargo, nota, nome, sub_judice, created_by, updated_by
  ) values (
    v_lista.id, btrim(p_cargo), p_nota, btrim(p_nome), true,
    (select auth.uid()), (select auth.uid())
  ) returning id into v_candidato_id;

  return jsonb_build_object('ok', true, 'candidato_id', v_candidato_id, 'lista_id', v_lista.id, 'sub_judice', true);
end;
$$;

create or replace function public.remover_sub_judice(p_candidato_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := private.monitora_role();
  v_lista_id uuid;
  v_ativo boolean;
begin
  if v_role not in ('contratador', 'admin') then raise exception 'Perfil sem permissao para remover sub judice'; end if;

  select c.lista_id, l.ativo into v_lista_id, v_ativo
  from public.lista_aprovados_candidatos c
  join public.listas_aprovados l on l.id = c.lista_id and l.vigente is true
  where c.id = p_candidato_id and c.sub_judice is true and c.removido_em is null
  for update of c, l;
  if not found then raise exception 'Candidato sub judice vigente nao encontrado'; end if;
  if not v_ativo then raise exception 'A lista esta inativa e nao permite remover sub judice'; end if;

  update public.lista_aprovados_candidatos
  set removido_em = now(), removido_por = (select auth.uid()),
      updated_by = (select auth.uid()), updated_at = now()
  where id = p_candidato_id;

  return jsonb_build_object('ok', true, 'candidato_id', p_candidato_id, 'lista_id', v_lista_id);
end;
$$;

revoke all on function public.listar_listas_aprovados() from public, anon;
revoke all on function public.listar_candidatos_aprovados() from public, anon;
revoke all on function public.importar_lista_aprovados(text, boolean, text, text, jsonb, boolean) from public, anon;
revoke all on function public.definir_lista_aprovados_ativa(uuid, boolean) from public, anon;
revoke all on function public.remover_lista_aprovados(uuid) from public, anon;
revoke all on function public.alterar_status_candidato_aprovado(uuid, text, text, text) from public, anon;
revoke all on function public.incluir_sub_judice(text, text, text, numeric) from public, anon;
revoke all on function public.remover_sub_judice(uuid) from public, anon;

grant execute on function public.listar_listas_aprovados() to authenticated;
grant execute on function public.listar_candidatos_aprovados() to authenticated;
grant execute on function public.importar_lista_aprovados(text, boolean, text, text, jsonb, boolean) to authenticated;
grant execute on function public.definir_lista_aprovados_ativa(uuid, boolean) to authenticated;
grant execute on function public.remover_lista_aprovados(uuid) to authenticated;
grant execute on function public.alterar_status_candidato_aprovado(uuid, text, text, text) to authenticated;
grant execute on function public.incluir_sub_judice(text, text, text, numeric) to authenticated;
grant execute on function public.remover_sub_judice(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
