begin;

-- Correção recuperável do lote indevido do Edital 101/2026 / DSEI Vilhena.
-- Os registros saem da base operacional, mas o JSON integral permanece em
-- quarentena para auditoria e restauração controlada, se necessária.
create table if not exists public.analises_curriculares_quarentena (
  original_id uuid primary key,
  payload jsonb not null,
  motivo text not null,
  quarantined_at timestamptz not null default timezone('utc', now())
);

alter table public.analises_curriculares_quarentena enable row level security;
revoke all on table public.analises_curriculares_quarentena
  from public, anon, authenticated;

create table if not exists public.analises_importacoes_bloqueadas (
  grupo_norm text not null,
  unidade_norm text not null,
  edital_norm text not null,
  motivo text not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (grupo_norm, unidade_norm, edital_norm)
);

alter table public.analises_importacoes_bloqueadas enable row level security;
revoke all on table public.analises_importacoes_bloqueadas
  from public, anon, authenticated;

insert into public.analises_importacoes_bloqueadas (
  grupo_norm,
  unidade_norm,
  edital_norm,
  motivo
)
values (
  public.analises_norm_key('Saúde Indígena'),
  public.analises_norm_key('DSEI Vilhena'),
  public.analises_norm_key('101/2026'),
  'Carga indevida confirmada pela gestão em 01/09/2026.'
)
on conflict (grupo_norm, unidade_norm, edital_norm) do update
set motivo = excluded.motivo;

create or replace function private.bloquear_importacao_analises_configurada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.analises_importacoes_bloqueadas b
    where b.grupo_norm = public.analises_norm_key(new.grupo)
      and b.unidade_norm = public.analises_norm_key(new.unidade)
      and b.edital_norm = public.analises_norm_key(new.edital)
  ) then
    return null;
  end if;
  return new;
end;
$$;

revoke all on function private.bloquear_importacao_analises_configurada()
  from public, anon, authenticated;

drop trigger if exists trg_bloquear_importacao_analises_configurada
  on public.analises_curriculares;
create trigger trg_bloquear_importacao_analises_configurada
before insert or update on public.analises_curriculares
for each row execute function private.bloquear_importacao_analises_configurada();

do $$
declare
  v_quantidade integer;
begin
  select count(*)::integer
  into v_quantidade
  from public.analises_curriculares a
  where a.grupo_norm = public.analises_norm_key('Saúde Indígena')
    and a.unidade_norm = public.analises_norm_key('DSEI Vilhena')
    and a.edital_norm = public.analises_norm_key('101/2026');

  if v_quantidade < 469 then
    raise exception
      'Correção cancelada: esperados pelo menos 469 registros do Edital 101/2026, encontrados %.',
      v_quantidade;
  end if;
end;
$$;

insert into public.analises_curriculares_quarentena (
  original_id,
  payload,
  motivo
)
select
  a.id,
  to_jsonb(a),
  'Edital 101/2026 do DSEI Vilhena carregado indevidamente em 28/08/2026.'
from public.analises_curriculares a
where a.grupo_norm = public.analises_norm_key('Saúde Indígena')
  and a.unidade_norm = public.analises_norm_key('DSEI Vilhena')
  and a.edital_norm = public.analises_norm_key('101/2026')
on conflict (original_id) do nothing;

delete from public.analises_curriculares a
where a.grupo_norm = public.analises_norm_key('Saúde Indígena')
  and a.unidade_norm = public.analises_norm_key('DSEI Vilhena')
  and a.edital_norm = public.analises_norm_key('101/2026');

comment on table public.analises_curriculares_quarentena is
  'Cópia integral e protegida de cargas retiradas da base de Análises por decisão administrativa.';
comment on table public.analises_importacoes_bloqueadas is
  'Chaves naturais impedidas de entrar em analises_curriculares.';
comment on function private.bloquear_importacao_analises_configurada() is
  'Cancela silenciosamente inserts e updates de chaves explicitamente bloqueadas pela gestão.';

commit;

-- Recuperação do Edital 101/2026, se autorizada no futuro:
-- 1. remover a chave de analises_importacoes_bloqueadas;
-- 2. restaurar os payloads da quarentena com lista explícita de colunas,
--    excluindo grupo_norm, unidade_norm e edital_norm (colunas geradas).
