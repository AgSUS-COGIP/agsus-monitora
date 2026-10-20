begin;

-- Permissão por módulo: de um perfil global para um nível em cada módulo.
--
-- Até aqui cada pessoa tinha UM perfil (usuario, edital_gestor, contratador,
-- admin) que valia para o sistema inteiro. Passa a ter um nível por módulo,
-- como o painel de RH já faz.
--
-- A tabela nasce SEMEADA com exatamente o que os quatro perfis já concedem
-- hoje. No instante em que esta migration corre, ninguém ganha nem perde
-- acesso; só depois é que faz sentido editar célula a célula. O espelho desta
-- matriz no frontend é `src/lib/permissoes-por-modulo.js`, e há teste que
-- compara os dois.
--
-- `perfis_usuarios.perfil` NÃO é removido. Continua a ser a origem do fallback
-- quando um módulo não tem linha — um módulo novo não pode trancar toda a
-- gente fora no instante em que é criado — e continua a ser o que as policies
-- antigas leem enquanto não forem migradas uma a uma.
--
-- Rollback: `drop table public.permissoes_por_modulo cascade;` e o mesmo para
-- o histórico, mais o drop das três funções criadas abaixo. Nada do que já
-- existia é alterado, por isso o rollback não perde dado anterior a esta
-- migration — mas perde as edições feitas na matriz depois dela.

-- ---------------------------------------------------------------------------
-- 1. A tabela
-- ---------------------------------------------------------------------------

create table if not exists public.permissoes_por_modulo (
  perfil_usuario_id uuid not null
    references public.perfis_usuarios(id) on delete cascade,
  modulo text not null,
  nivel text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (perfil_usuario_id, modulo),
  constraint permissoes_por_modulo_modulo_check check (
    modulo in (
      'dashboard',
      'analises',
      'nucleo',
      'calendario',
      'aprovados',
      'paineis',
      'configuracoes'
    )
  ),
  constraint permissoes_por_modulo_nivel_check check (
    nivel in ('sem_acesso', 'leitor', 'editor', 'admin')
  )
);

create index if not exists permissoes_por_modulo_modulo_idx
  on public.permissoes_por_modulo(modulo);

-- Quem mudou o quê, quando. A tela do modelo mostra histórico, e uma matriz de
-- permissão sem registo de alteração não permite auditar um acesso indevido.
create table if not exists public.permissoes_por_modulo_historico (
  id bigint generated always as identity primary key,
  perfil_usuario_id uuid not null,
  modulo text not null,
  nivel_anterior text,
  nivel_novo text not null,
  realizado_por uuid,
  realizado_em timestamptz not null default now()
);

create index if not exists permissoes_por_modulo_historico_perfil_idx
  on public.permissoes_por_modulo_historico(perfil_usuario_id, realizado_em desc);

-- ---------------------------------------------------------------------------
-- 2. A semente — cópia fiel do que os perfis concedem hoje
-- ---------------------------------------------------------------------------
--
-- Lido de `20260915150000_lista_aprovados_e_perfis.sql`, que grava em
-- perfis_usuarios:
--
--     p_ind, p_cores, p_paineis = true  para todos os perfis
--     p_config, p_admin         = true  só para admin
--
-- Daí: quem tem perfil lê todos os módulos, e só o admin entra em
-- Configurações. As duas únicas células que não saem das colunas `p_*` são
-- `calendario` e `aprovados`, que vêm da intenção escrita em
-- `perfis-de-acesso.js` (podeGerirEditais e podeAlterarListaAprovados). Sem
-- elas um contratador não consegue trabalhar.
--
-- `on conflict do nothing` deixa a migration ser re-aplicada sem desfazer
-- edições já feitas à mão na matriz.

with perfil_normalizado as (
  select
    p.id,
    case lower(coalesce(p.perfil, ''))
      when 'master' then 'admin'
      when 'administrador' then 'admin'
      when 'admin' then 'admin'
      when 'editor' then 'edital_gestor'
      when 'gestor' then 'edital_gestor'
      when 'edital_gestor' then 'edital_gestor'
      when 'contratador' then 'contratador'
      when 'leitor' then 'usuario'
      when 'visualizador' then 'usuario'
      when 'usuario' then 'usuario'
      else ''
    end as perfil
  from public.perfis_usuarios p
),
modulo as (
  select unnest(array[
    'dashboard',
    'analises',
    'nucleo',
    'calendario',
    'aprovados',
    'paineis',
    'configuracoes'
  ]) as modulo
)
insert into public.permissoes_por_modulo (perfil_usuario_id, modulo, nivel)
select
  p.id,
  m.modulo,
  case
    -- Sem perfil não é `usuario`: é ausência de acesso.
    when p.perfil = '' then 'sem_acesso'
    when p.perfil = 'admin' then 'admin'
    when m.modulo = 'configuracoes' then 'sem_acesso'
    when m.modulo = 'calendario'
      and p.perfil in ('edital_gestor', 'contratador') then 'editor'
    when m.modulo = 'aprovados' and p.perfil = 'contratador' then 'editor'
    else 'leitor'
  end
from perfil_normalizado p
cross join modulo m
on conflict (perfil_usuario_id, modulo) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Quem é o autor da chamada
-- ---------------------------------------------------------------------------
--
-- Mesma regra de `private.monitora_role()`: casa por user_id e, em falta dele,
-- pelo e-mail do JWT — há linhas antigas gravadas antes de o user_id existir.

create or replace function private.meu_perfil_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.perfis_usuarios p
  where (
    p.user_id = (select auth.uid())
    or lower(p.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
  order by case when p.user_id = (select auth.uid()) then 0 else 1 end,
           p.updated_at desc nulls last
  limit 1;
$$;

revoke all on function private.meu_perfil_id() from public, anon;

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
--
-- Uma tabela de permissões legível por qualquer autenticado entrega o mapa de
-- quem pode o quê no sistema inteiro. Cada pessoa lê a sua linha; o admin lê
-- todas. Ninguém escreve por SQL direto: a escrita passa pela RPC abaixo, que
-- é onde ficam a verificação e o histórico.

alter table public.permissoes_por_modulo enable row level security;
alter table public.permissoes_por_modulo_historico enable row level security;

drop policy if exists permissoes_por_modulo_leitura on public.permissoes_por_modulo;
create policy permissoes_por_modulo_leitura
  on public.permissoes_por_modulo
  for select
  to authenticated
  using (
    perfil_usuario_id = private.meu_perfil_id()
    or private.is_master()
  );

drop policy if exists permissoes_por_modulo_historico_leitura
  on public.permissoes_por_modulo_historico;
create policy permissoes_por_modulo_historico_leitura
  on public.permissoes_por_modulo_historico
  for select
  to authenticated
  using (private.is_master());

-- ---------------------------------------------------------------------------
-- 5. Leitura da própria matriz
-- ---------------------------------------------------------------------------

create or replace function public.minhas_permissoes_por_modulo()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_object_agg(pm.modulo, pm.nivel),
    '{}'::jsonb
  )
  from public.permissoes_por_modulo pm
  where pm.perfil_usuario_id = private.meu_perfil_id();
$$;

revoke all on function public.minhas_permissoes_por_modulo() from public, anon;
grant execute on function public.minhas_permissoes_por_modulo() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Alterar uma célula
-- ---------------------------------------------------------------------------
--
-- Só admin. E um admin não pode retirar a si próprio o `admin` em
-- Configurações: foi essa a regra que
-- `20260916102000_proteger_proprio_acesso_admin.sql` estabeleceu, e sem ela
-- um clique distraído tranca todo o sistema fora da administração.

create or replace function public.definir_nivel_do_modulo(
  p_perfil_usuario_id uuid,
  p_modulo text,
  p_nivel text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_modulo text := lower(nullif(btrim(coalesce(p_modulo, '')), ''));
  v_nivel text := lower(nullif(btrim(coalesce(p_nivel, '')), ''));
  v_anterior text;
  v_eu uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Usuario nao autenticado';
  end if;
  if not private.is_master() then
    raise exception 'Somente perfil admin pode alterar permissoes';
  end if;
  if v_modulo not in (
    'dashboard', 'analises', 'nucleo', 'calendario',
    'aprovados', 'paineis', 'configuracoes'
  ) then
    raise exception 'Modulo invalido: %', coalesce(v_modulo, '(vazio)');
  end if;
  if v_nivel not in ('sem_acesso', 'leitor', 'editor', 'admin') then
    raise exception 'Nivel invalido: %', coalesce(v_nivel, '(vazio)');
  end if;

  v_eu := private.meu_perfil_id();
  if p_perfil_usuario_id = v_eu
     and v_modulo = 'configuracoes'
     and v_nivel <> 'admin' then
    raise exception 'Um admin nao pode retirar o proprio acesso a Configuracoes';
  end if;

  select pm.nivel into v_anterior
  from public.permissoes_por_modulo pm
  where pm.perfil_usuario_id = p_perfil_usuario_id
    and pm.modulo = v_modulo;

  insert into public.permissoes_por_modulo
    (perfil_usuario_id, modulo, nivel, updated_at, updated_by)
  values
    (p_perfil_usuario_id, v_modulo, v_nivel, now(), (select auth.uid()))
  on conflict (perfil_usuario_id, modulo) do update
    set nivel = excluded.nivel,
        updated_at = now(),
        updated_by = excluded.updated_by;

  -- Só regista quando mudou de facto; senão o histórico enche de ruído.
  if v_anterior is distinct from v_nivel then
    insert into public.permissoes_por_modulo_historico
      (perfil_usuario_id, modulo, nivel_anterior, nivel_novo, realizado_por)
    values
      (p_perfil_usuario_id, v_modulo, v_anterior, v_nivel, (select auth.uid()));
  end if;

  return jsonb_build_object(
    'perfil_usuario_id', p_perfil_usuario_id,
    'modulo', v_modulo,
    'nivel_anterior', v_anterior,
    'nivel', v_nivel
  );
end;
$$;

revoke all on function public.definir_nivel_do_modulo(uuid, text, text)
  from public, anon;
grant execute on function public.definir_nivel_do_modulo(uuid, text, text)
  to authenticated;

commit;
