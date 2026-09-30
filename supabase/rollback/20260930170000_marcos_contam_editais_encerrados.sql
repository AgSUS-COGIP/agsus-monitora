-- Volta a contagem dos marcos a só análises ativas (20260930150000).
begin;

create or replace function public.obter_marcos_da_area(p_area text)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if not private."FC_PODE_AREA"(p_area) then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  return (
    select json_build_object(
      'area', p_area,
      'ano', extract(year from now())::integer,
      'concluidas_no_ano', count(*) filter (where a.data_analise >= date_trunc('year', now())::date),
      'concluidas_total', count(*),
      'gerado_em', now())
      from public."TB_ANALISE_CURRICULAR" a
     where a."CO_AREA" = p_area
       and a.ativo
       and a.status_consolidado in ('Aprovado', 'Reprovado')
  );
end;
$function$;

commit;
