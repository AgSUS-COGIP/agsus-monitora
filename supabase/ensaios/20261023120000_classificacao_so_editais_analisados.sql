-- ENSAIO de supabase/migrations/20261023120000_classificacao_so_editais_analisados.sql: roda o corpo e desfaz (rollback).
-- Esperado: em cada área, o seletor só com editais que têm análise ativa ou lista gerada (nenhum com
-- candidatos = 0 e sem lista); nenhum edital com análise sumiu; ordem ativo, fora do treinamento,
-- em andamento antes de encerrado. Lido como um administrador global (sub do JWT abaixo).
-- O resultado (json) traz, por área, o número de editais antes × depois e a lista de depois
-- (número do edital, candidatos, encerrado, treinamento); nenhum nome de candidato.
begin;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"df5b852c-f981-4486-94b9-67857fff8f93","role":"authenticated"}', true);

create temp table t_antes on commit drop as
select a."CO_AREA" as area, public.listar_editais_classificacao(a."CO_AREA")::jsonb as r
  from public."TB_AREA" a;

reset role;

-- ═══ CORPO DA MIGRATION (início) ═══

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.listar_editais_classificacao(text)') is null
     or to_regprocedure('private."FC_EH_TREINAMENTO"(text)') is null
     or to_regclass('public."TH_REGRA_CLASSIFICACAO"') is null then
    raise exception 'Aplique antes 20261002150000_classificacao.sql, 20261007230000_edital_de_treinamento.sql e 20261008180000_nome_das_versoes_das_regras.sql.';
  end if;
end;
$$;

-- 1. Os editais da área com análises (ou lista gerada) ----------------------------------
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
               private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO") as treinamento,
               coalesce(m.status, '') in ('Concluído', 'Cancelado') as encerrado
          from public."TB_MONITORAMENTO_INDIGENA" m
         where m."CO_AREA" = p_area and (v_editais is null or m.id = any (v_editais))
      ),
      an as (
        select private."FC_NUMERO_EDITAL"(a.edital) as numero, count(*)::integer as qt
          from public."TB_ANALISE_CURRICULAR" a
         where a."CO_AREA" = p_area and a.ativo
         group by 1
      ),
      ul as (
        select distinct on (l."CO_MONITORAMENTO") l."CO_MONITORAMENTO" as id,
               json_build_object('tipo', l."TP_LISTA", 'em', l."DT_GERACAO", 'publicada', l."ST_PUBLICADA" = 'S') as lista
          from public."TB_LISTA_CLASSIFICACAO" l
         where l."CO_MONITORAMENTO" in (select m.id from m)
         order by l."CO_MONITORAMENTO", l."DT_GERACAO" desc
      )
      select coalesce(json_agg(json_build_object(
               'id', m.id, 'edital', m.edital, 'unidade', m.unidade, 'ativo', m.ativo,
               'treinamento', m.treinamento,
               'candidatos', coalesce(an.qt, 0),
               'versao_regra', r."NU_VERSAO_VIGENTE",
               'nome_regra', h."NO_VERSAO",
               'ultima_lista', ul.lista)
             order by m.ativo desc, m.treinamento, m.encerrado, m.edital), '[]'::json)
        from m
        left join an on an.numero = m.numero
        left join ul on ul.id = m.id
        left join public."TB_REGRA_CLASSIFICACAO" r on r."CO_MONITORAMENTO" = m.id
        left join public."TH_REGRA_CLASSIFICACAO" h
          on h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
       where coalesce(an.qt, 0) > 0 or ul.id is not null
    )
  );
end;
$function$;
comment on function public.listar_editais_classificacao(text) is
  'Editais da área para a aba Classificação (json): só os que têm análise curricular ativa (qualquer origem) ou lista de classificação gerada; candidatos nas análises, treinamento, versão e nome da versão da regra e a última lista gerada. Ordem: ativo, fora do treinamento, em andamento antes de encerrado, número. Exige classificacao >= leitor, a área e o recorte da coordenação (20261023120000).';
-- ═══ CORPO DA MIGRATION (fim) ═══

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"df5b852c-f981-4486-94b9-67857fff8f93","role":"authenticated"}', true);

create temp table t_depois on commit drop as
select a."CO_AREA" as area, public.listar_editais_classificacao(a."CO_AREA")::jsonb as r
  from public."TB_AREA" a;

do $$
begin
  if exists (select 1 from t_depois d, jsonb_array_elements(d.r -> 'editais') e
              where (e ->> 'candidatos')::int = 0 and e -> 'ultima_lista' = 'null'::jsonb) then
    raise exception 'FALHOU: edital sem análise e sem lista no seletor';
  end if;
  if exists (select 1 from t_antes b, jsonb_array_elements(b.r -> 'editais') e
              where ((e ->> 'candidatos')::int > 0 or e -> 'ultima_lista' <> 'null'::jsonb)
                and not exists (select 1 from t_depois d, jsonb_array_elements(d.r -> 'editais') x
                                 where d.area = b.area and x ->> 'id' = e ->> 'id')) then
    raise exception 'FALHOU: edital com análise ou lista sumiu do seletor';
  end if;
  if exists (select 1 from t_antes b join t_depois d using (area)
              where (b.r - 'editais') <> (d.r - 'editais')) then
    raise exception 'FALHOU: área ou pode_editar mudaram';
  end if;
end;
$$;

select json_object_agg(d.area, json_build_object(
         'antes', jsonb_array_length(b.r -> 'editais'),
         'depois', jsonb_array_length(d.r -> 'editais'),
         'editais', (select json_agg(json_build_object(
                       'edital', e ->> 'edital', 'candidatos', (e ->> 'candidatos')::int,
                       'treinamento', (e ->> 'treinamento')::boolean,
                       'lista', e -> 'ultima_lista' ->> 'tipo') order by o)
                       from jsonb_array_elements(d.r -> 'editais') with ordinality x(e, o))
       )) as resultado
  from t_depois d join t_antes b using (area);

rollback;
