/*
  EDITAIS DA CLASSIFICAÇÃO SEM FUNÇÃO POR ANÁLISE (26/11/2026)

  POR QUE
  listar_editais_classificacao (a entrada da Classificação e da Lista de aprovados) leva 1,3 s
  em média e 8 s no pior caso (pg_stat_statements desde 16/11). O CTE `an` agrupava todas as
  análises ativas da área por private."FC_NUMERO_EDITAL"(edital): uma regex, numa função com SET
  (nunca expandida), por análise. Medido em 26/11/2026, Saúde Indígena: 2.068 ms com a função,
  9 ms sem ela, em 13.205 análises (docs/_arquivo/consultas-lentas-2026-11-26.md).

  O QUE MUDA
    - `an` conta, para cada número de edital distinto da área (o CTE `m`, ~200), as análises
      ativas com private."FC_NUMERO_EDITAL"(edital) = o número. É a expressão do índice
      IN_ANALISECURR_AREANUMEDITAL ("CO_AREA", FC_NUMERO_EDITAL(edital)) WHERE ativo: vira
      condição do índice, a função roda uma vez por número e não por análise.
    - A saída é a mesma: número sem análise conta 0, e o coalesce(an.qt, 0) já tratava a falta da
      linha como 0; o número nulo nunca casava (an.numero = m.numero). Assinatura, permissões,
      ordem e comentário não mudam. Nenhum índice novo.

  GUARDA: o corpo de listar_editais_classificacao é o do retrato de 26/11/2026 (md5 do prosrc
  sem \r).
  Ensaio: supabase/ensaios/20261126190000_editais_da_classificacao_sem_funcao_por_analise.sql
  Rollback: supabase/rollback/20261126190000_editais_da_classificacao_sem_funcao_por_analise.sql
  Teste: tests/repositorio-e-banco.test.ts (bloco consultas-lentas-no-banco)
*/

begin;

set local lock_timeout = '5s';

do $guarda$
begin
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.listar_editais_classificacao(text)')), E'\r', ''))
       is distinct from '33a2a3adf41b161b89202166b267d33d' then
    raise exception 'listar_editais_classificacao mudou desde 26/11/2026: refaça a migration a partir do banco' using errcode = '55000';
  end if;
end
$guarda$;

create or replace function public.listar_editais_classificacao(p_area text) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
      -- Uma contagem por número de edital da área, com o número como condição do índice
      -- IN_ANALISECURR_AREANUMEDITAL: FC_NUMERO_EDITAL não roda mais por análise
      -- (com ela, 2,1 s para 13.205 análises da Saúde Indígena; sem ela, 9 ms). Número sem
      -- análise conta 0, como a falta da linha contava no coalesce abaixo.
      an as (
        select n.numero,
               (select count(*)::integer
                  from public."TB_ANALISE_CURRICULAR" a
                 where a."CO_AREA" = p_area and a.ativo
                   and private."FC_NUMERO_EDITAL"(a.edital) = n.numero) as qt
          from (select distinct m.numero from m where m.numero is not null) n
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
$$;

commit;
