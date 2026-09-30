/*
  Marcos do ano contam também os editais encerrados.

  obter_marcos_da_area (20260930150000) contava só as análises com
  "ativo" = true, que é a regra do escopo "ativo" do painel: ficavam de fora as
  análises dos editais já encerrados (escopo "inativo"). Em 30/09 dava 7.071
  para a Saúde Indígena; o certo, 22.279.
  Agora vale a regra do painel (private."FC_MONTAR_PAINEL_ANALISE"): conta quem
  está nos escopos ativo ou inativo (edital encerrado OU análise ativa); só as
  "desativadas" (removidas da planilha) ficam de fora.

  Rollback: supabase/rollback/20260930170000_marcos_contam_editais_encerrados.sql
*/
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
      'concluidas_no_ano', count(*) filter (where v.data_analise >= date_trunc('year', now())::date),
      'concluidas_total', count(*),
      'gerado_em', now())
      from public."VW_ANALISES_DASHBOARD_BASE_TODOS" v
      join public."TB_ANALISE_CURRICULAR" a on a.id = v.id
     where a."CO_AREA" = p_area
       and (v.edital_ativo is false or v.ativo is true)
       and v.status_consolidado in ('Aprovado', 'Reprovado')
  );
end;
$function$;

commit;
