/*
  ROLLBACK de supabase/migrations/20261126190000_editais_da_classificacao_sem_funcao_por_analise.sql

  Devolve listar_editais_classificacao como estava em 26/11/2026 (o corpo do retrato, letra por
  letra; o md5 do prosrc volta a 33a2a3adf41b161b89202166b267d33d). Não há dado a desfazer.
*/

begin;

set local lock_timeout = '5s';

do $guarda$
begin
  if strpos((select prosrc from pg_proc where oid = to_regprocedure('public.listar_editais_classificacao(text)')),
            'select distinct m.numero from m where m.numero is not null') = 0 then
    raise exception 'A migration 20261126190000 não está aplicada: nada a desfazer' using errcode = '55000';
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
$$;

commit;
