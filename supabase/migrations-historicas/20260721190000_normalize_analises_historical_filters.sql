create or replace function public.get_analises_dashboard_filtrado(
  p_scope text,
  p_unidades text[] default null,
  p_editais text[] default null,
  p_offset integer default 0,
  p_limit integer default 1000,
  p_include_total boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'private', 'pg_temp'
set statement_timeout = '20s'
as $function$
declare
  v_scope text := lower(btrim(coalesce(p_scope, '')));
  v_unidades text[];
  v_editais text[];
  v_unidades_norm text[];
  v_editais_norm text[];
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_limit integer := least(greatest(coalesce(p_limit, 1000), 1), 1000);
  v_total bigint := null;
  v_rows jsonb := '[]'::jsonb;
  v_can_view boolean;
begin
  select (
    private.has_perm('paineis')
    or private.has_perm('ind')
    or private.has_perm('config')
    or private.has_perm('admin')
  ) into v_can_view;

  if not coalesce(v_can_view, false) then
    raise exception 'Sem permissao para visualizar painel de analises';
  end if;

  if v_scope not in ('inativo', 'todos') then
    raise exception 'Escopo invalido. Use inativo ou todos.';
  end if;

  select
    array_agg(distinct btrim(value) order by btrim(value)),
    array_agg(distinct public.analises_norm_key(value) order by public.analises_norm_key(value))
  into v_unidades, v_unidades_norm
  from unnest(coalesce(p_unidades, array[]::text[])) as item(value)
  where btrim(value) <> '';

  select
    array_agg(distinct btrim(value) order by btrim(value)),
    array_agg(distinct public.analises_norm_key(value) order by public.analises_norm_key(value))
  into v_editais, v_editais_norm
  from unnest(coalesce(p_editais, array[]::text[])) as item(value)
  where btrim(value) <> '';

  if coalesce(cardinality(v_unidades_norm), 0) = 0
     and coalesce(cardinality(v_editais_norm), 0) = 0 then
    raise exception 'Selecione pelo menos uma unidade ou um edital antes da consulta.';
  end if;

  if coalesce(p_include_total, true) then
    select count(*)
      into v_total
    from public.vw_analises_dashboard_base_todos as base
    where (v_scope = 'todos' or base.edital_ativo is false)
      and (
        coalesce(cardinality(v_unidades_norm), 0) = 0
        or public.analises_norm_key(base.unidade) = any(v_unidades_norm)
      )
      and (
        coalesce(cardinality(v_editais_norm), 0) = 0
        or public.analises_norm_key(base.edital) = any(v_editais_norm)
      );
  end if;

  select coalesce(jsonb_agg(to_jsonb(filtered)), '[]'::jsonb)
    into v_rows
  from (
    select base.*
    from public.vw_analises_dashboard_base_todos as base
    where (v_scope = 'todos' or base.edital_ativo is false)
      and (
        coalesce(cardinality(v_unidades_norm), 0) = 0
        or public.analises_norm_key(base.unidade) = any(v_unidades_norm)
      )
      and (
        coalesce(cardinality(v_editais_norm), 0) = 0
        or public.analises_norm_key(base.edital) = any(v_editais_norm)
      )
    order by base.unidade, base.edital, base.codigo_vaga, base.candidato, base.id
    offset v_offset
    limit v_limit
  ) as filtered;

  return jsonb_build_object(
    'scope', v_scope,
    'rows', v_rows,
    'total', v_total,
    'offset', v_offset,
    'limit', v_limit,
    'has_more', jsonb_array_length(v_rows) = v_limit,
    'filters', jsonb_build_object(
      'unidades', coalesce(to_jsonb(v_unidades), '[]'::jsonb),
      'editais', coalesce(to_jsonb(v_editais), '[]'::jsonb)
    ),
    'generated_at', now()
  );
end;
$function$;

revoke all on function public.get_analises_dashboard_filtrado(text, text[], text[], integer, integer, boolean) from public;
revoke all on function public.get_analises_dashboard_filtrado(text, text[], text[], integer, integer, boolean) from anon;
grant execute on function public.get_analises_dashboard_filtrado(text, text[], text[], integer, integer, boolean) to authenticated;
grant execute on function public.get_analises_dashboard_filtrado(text, text[], text[], integer, integer, boolean) to service_role;

comment on function public.get_analises_dashboard_filtrado(text, text[], text[], integer, integer, boolean)
is 'Retorna pagina do historico de analises com filtros normalizados de unidade e edital, ignorando caixa e espacos duplicados.';
