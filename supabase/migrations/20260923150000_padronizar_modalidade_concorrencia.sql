-- Padroniza a modalidade de concorrência sem perder combinações válidas.
-- A coluna continua text por compatibilidade com o contrato atual do painel,
-- mas toda gravação passa a usar nomes canônicos e o separador " | ".

create or replace function private.normalizar_modalidade_concorrencia(p_valor text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := lower(coalesce(p_valor, ''));
  v_modalidades text[] := array[]::text[];
begin
  if nullif(btrim(coalesce(p_valor, '')), '') is null then
    return null;
  end if;

  if v like '%ampla%' and v like '%concorr%' then
    v_modalidades := array_append(v_modalidades, 'Ampla concorrência');
  end if;

  if v like '%preto%' or v like '%pardo%' then
    v_modalidades := array_append(v_modalidades, 'Pretos e pardos');
  end if;

  if v like '%indígen%' or v like '%indigen%' then
    v_modalidades := array_append(v_modalidades, 'Indígenas');
  end if;

  if v like '%quilomb%' then
    v_modalidades := array_append(v_modalidades, 'Quilombolas');
  end if;

  if v like '%defici%' or v like '%pcd%' then
    v_modalidades := array_append(v_modalidades, 'Pessoas com deficiência (PCD)');
  end if;

  if cardinality(v_modalidades) > 0 then
    return array_to_string(v_modalidades, ' | ');
  end if;

  -- Valor novo/desconhecido: limpa aspas externas, mas preserva o conteúdo
  -- para evitar perda silenciosa de informação.
  return nullif(btrim(regexp_replace(p_valor, '"', '', 'g')), '');
end;
$$;

revoke all on function private.normalizar_modalidade_concorrencia(text) from public, anon, authenticated;

create or replace function private.aplicar_normalizacao_modalidade_concorrencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.modalidade_concorrencia :=
    private.normalizar_modalidade_concorrencia(new.modalidade_concorrencia);
  return new;
end;
$$;

revoke all on function private.aplicar_normalizacao_modalidade_concorrencia() from public, anon, authenticated;

drop trigger if exists trg_normalizar_modalidade_concorrencia
  on public."TB_ANALISE_CURRICULAR";

create trigger trg_normalizar_modalidade_concorrencia
before insert or update of modalidade_concorrencia
on public."TB_ANALISE_CURRICULAR"
for each row
execute function private.aplicar_normalizacao_modalidade_concorrencia();

update public."TB_ANALISE_CURRICULAR"
set modalidade_concorrencia =
  private.normalizar_modalidade_concorrencia(modalidade_concorrencia)
where modalidade_concorrencia is distinct from
  private.normalizar_modalidade_concorrencia(modalidade_concorrencia);
