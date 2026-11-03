/*
  Rollback de 20261103182000_sem_conferencia_ler_classificacao: recria a RPC como estava no
  banco em 03/11/2026 (20261007230000), com a mesma permissão e o mesmo comentário.
*/
begin;

CREATE OR REPLACE FUNCTION public.conferencia_ler_classificacao()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with ultimas as (
    select distinct on (l."CO_MONITORAMENTO", l."TP_LISTA")
           l."CO_LISTA_CLASSIFICACAO", l."CO_MONITORAMENTO", l."TP_LISTA", l."DT_GERACAO",
           l."QT_PENDENCIA", l."ST_PUBLICADA", l."DS_RESULTADO"
      from public."TB_LISTA_CLASSIFICACAO" l
     where not private."FC_EDITAL_EH_TREINAMENTO"(l."CO_MONITORAMENTO")
     order by l."CO_MONITORAMENTO", l."TP_LISTA", l."DT_GERACAO" desc, l."CO_LISTA_CLASSIFICACAO" desc
  ),
  analises as (
    select e.edital_id, max(a.updated_at) as alterada_em
      from public."TB_ANALISE_CURRICULAR" a
      join private."FC_EDITAIS_POR_NUMERO"() e
        on e.area = a."CO_AREA" and e.numero = private."FC_NUMERO_EDITAL"(a.edital)
     where a.ativo and not private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)
     group by e.edital_id
  ),
  vagas as (
    select distinct e.edital_id, m."CO_AREA" as area, nullif(btrim(a.codigo_vaga), '') as codigo, a.nome_vaga
      from public."TB_ANALISE_CURRICULAR" a
      join private."FC_EDITAIS_POR_NUMERO"() e
        on e.area = a."CO_AREA" and e.numero = private."FC_NUMERO_EDITAL"(a.edital)
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = e.edital_id
     where a.ativo and not private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)
       and coalesce(m.ativo, false) and nullif(btrim(a.nome_vaga), '') is not null
  )
  select jsonb_build_object(
    'schema_version', 1,
    'listas', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', u."CO_LISTA_CLASSIFICACAO", 'edital', u."CO_MONITORAMENTO", 'area', m."CO_AREA",
          'tipo', u."TP_LISTA", 'gerada_em', u."DT_GERACAO", 'pendencias', u."QT_PENDENCIA",
          'publicada', u."ST_PUBLICADA" = 'S',
          'vagas_pendentes', (select coalesce(jsonb_agg(distinct p ->> 'vaga'), '[]'::jsonb)
                                from jsonb_array_elements(case when jsonb_typeof(u."DS_RESULTADO" -> 'pendencias') = 'array'
                                                               then u."DS_RESULTADO" -> 'pendencias' else '[]'::jsonb end) p
                               where p ->> 'vaga' is not null))), '[]'::jsonb)
        from ultimas u
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = u."CO_MONITORAMENTO"
    ),
    'analises_alteradas', (
      select coalesce(jsonb_agg(jsonb_build_object('edital', a.edital_id, 'alterada_em', a.alterada_em)), '[]'::jsonb)
        from analises a
    ),
    'vagas_sem_quadro', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'edital', v.edital_id, 'area', v.area, 'vaga', coalesce(v.codigo, 'sem-codigo'))), '[]'::jsonb)
        from vagas v
       where private."FC_QUADRO_DA_VAGA"(v.edital_id, v.nome_vaga) is null
    ),
    'ajustes', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', j."CO_AJUSTE_PONTUACAO", 'edital', j."CO_MONITORAMENTO", 'area', m."CO_AREA",
          'tipo', j."TP_LISTA", 'aprovado_em', j."DT_APROVACAO")), '[]'::jsonb)
        from public."TB_AJUSTE_PONTUACAO_RECURSO" j
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = j."CO_MONITORAMENTO"
       where j."TP_SITUACAO" = 'APROVADO'
         and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
    )
  );
$function$;

revoke all on function public.conferencia_ler_classificacao() from public, anon, authenticated;
grant execute on function public.conferencia_ler_classificacao() to service_role;
comment on function public.conferencia_ler_classificacao() is
  'Conferências (job Python): a última lista de cada tipo por edital (data, pendências de desempate e as vagas delas), a última alteração das análises de cada edital, as vagas das análises dos editais ativos sem linha no quadro de vagas (FC_QUADRO_DA_VAGA) e os ajustes de recurso aprovados. Sem dado pessoal. Só service_role.';

commit;
