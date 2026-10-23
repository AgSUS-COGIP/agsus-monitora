/*
  ROLLBACK de supabase/migrations/20261023120000_classificacao_so_editais_analisados.sql

  Volta public.listar_editais_classificacao à versão de
  20261008180000_nome_das_versoes_das_regras.sql: todos os editais da área,
  com e sem análise.
*/
begin;

create or replace function public.listar_editais_classificacao(p_area text)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_editais uuid[];
begin
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if not private.pode_recurso('classificacao', 1) then
    raise exception 'Sem permissão para Classificação' using errcode = '42501';
  end if;
  if not private."FC_PODE_AREA"(p_area) then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  v_editais := (select private."FC_EDITAIS_VISIVEIS"())::uuid[];

  return json_build_object(
    'area', p_area,
    'pode_editar', private.pode_recurso('classificacao', 2),
    'editais', (
      with m as (
        select m.id, m.edital, m.unidade, m.ativo, private."FC_NUMERO_EDITAL"(m.edital) as numero,
               private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO") as treinamento
          from public."TB_MONITORAMENTO_INDIGENA" m
         where m."CO_AREA" = p_area and (v_editais is null or m.id = any (v_editais))
      ),
      an as (
        select private."FC_NUMERO_EDITAL"(a.edital) as numero, count(*)::integer as qt
          from public."TB_ANALISE_CURRICULAR" a
         where a."CO_AREA" = p_area and a.ativo
         group by 1
      )
      select coalesce(json_agg(json_build_object(
               'id', m.id, 'edital', m.edital, 'unidade', m.unidade, 'ativo', m.ativo,
               'treinamento', m.treinamento,
               'candidatos', coalesce(an.qt, 0),
               'versao_regra', r."NU_VERSAO_VIGENTE",
               'nome_regra', h."NO_VERSAO",
               'ultima_lista', (
                 select json_build_object('tipo', l."TP_LISTA", 'em', l."DT_GERACAO", 'publicada', l."ST_PUBLICADA" = 'S')
                   from public."TB_LISTA_CLASSIFICACAO" l
                  where l."CO_MONITORAMENTO" = m.id
                  order by l."DT_GERACAO" desc limit 1))
             order by m.ativo desc, coalesce(an.qt, 0) = 0, m.edital), '[]'::json)
        from m
        left join an on an.numero = m.numero
        left join public."TB_REGRA_CLASSIFICACAO" r on r."CO_MONITORAMENTO" = m.id
        left join public."TH_REGRA_CLASSIFICACAO" h
          on h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
    )
  );
end;
$function$;
comment on function public.listar_editais_classificacao(text) is
  'Editais da área para a aba Classificação (json): candidatos nas análises, treinamento, versão e nome da versão da regra e a última lista gerada. Exige classificacao >= leitor, a área e o recorte da coordenação.';

commit;
