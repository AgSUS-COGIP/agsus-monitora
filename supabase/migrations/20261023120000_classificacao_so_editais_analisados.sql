/*
  CLASSIFICAÇÃO: SÓ OS EDITAIS ANALISADOS NO SELETOR (23/10/2026)

  O QUE ESTAVA ERRADO
  public.listar_editais_classificacao devolvia TODOS os editais da área
  (TB_MONITORAMENTO_INDIGENA), com a contagem de análises ao lado. Em Projetos,
  o seletor "Edital" mostrava 14 editais; 10 sem nenhuma análise ativa
  (04/2026, 23/2025, 29/2025, 62/2025, 63/2025, 96/2025, 97/2025, 98/2026,
  99/2026, FCC) — abertos, a classificação ficava vazia. A ordem era ativo,
  "tem análise", número do edital: o encerrado e o treinamento se misturavam
  aos em andamento.

  A REGRA
  Entra no seletor o edital da área (e do recorte da coordenação) que tem:
    - análise curricular ATIVA (TB_ANALISE_CURRICULAR.ativo) com o mesmo número
      de edital — de qualquer origem (MONITORA ou planilha): é dessas análises
      que a classificação lê os candidatos (FC_DADOS_CLASSIFICACAO_EDITAL), sem
      filtro de origem; ou
    - lista de classificação já gerada (TB_LISTA_CLASSIFICACAO), para o
      histórico não sumir se as análises forem desativadas.
  Ter só a regra de classificação não basta: a regra-padrão foi semeada em
  todos os editais (20261002-regras-de-classificacao-todos-os-editais.sql).
  Ordem: ativo; fora do treinamento; em andamento antes de encerrado
  (status Concluído ou Cancelado); depois o número do edital.

  O resto do retorno (campos, permissões, recorte) não muda.

  Ensaio: supabase/ensaios/20261023120000_classificacao_so_editais_analisados.sql
  Rollback: supabase/rollback/20261023120000_classificacao_so_editais_analisados.sql
*/
begin;

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

commit;
