-- Desfaz 20261001130000_selecao_aprovados_outras_bancas: volta get_selecao_da_area
-- à versão de 20261001090000 (aprovados só pelo código numérico da vaga).
begin;

create or replace function public.get_selecao_da_area(p_area text)
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
  if not private.pode_recurso('selecao', 1) then
    raise exception 'Sem permissão para Seleção' using errcode = '42501';
  end if;
  if not private."FC_PODE_AREA"(p_area) then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  v_editais := (select private."FC_EDITAIS_VISIVEIS"())::uuid[];

  return (
    with s as (
      select s.*, private."FC_NUMERO_EDITAL"(s."DS_EDITAL") as numero
        from public."TB_SELECAO_VAGA" s
       where s."CO_AREA" = p_area and s."ST_REGISTRO_ATIVO" = 'S'
         and (v_editais is null or s."CO_MONITORAMENTO" = any (v_editais))
    ),
    -- Convocados: entrevistas ativas (planilha ou sistema) por edital e vaga.
    convocados as (
      select private."FC_NUMERO_EDITAL"(e."DS_EDITAL") as numero, e."CO_VAGA" as vaga, count(*)::integer as qt
        from public."TB_ENTREVISTA" e
       where e."CO_AREA" = p_area and e."ST_ATIVO" = 'S'
       group by 1, 2
    ),
    editais_com_entrevista as (
      select distinct c.numero from convocados c where c.numero is not null
    ),
    -- Lista de aprovados vigente dos editais ligados.
    listas as (
      select l.id, l.edital_id
        from public."TB_LISTA_APROVADO" l
       where l.vigente is true
         and l.edital_id in (select s."CO_MONITORAMENTO"::text from s where s."CO_MONITORAMENTO" is not null)
    ),
    aprovados as (
      select l.edital_id, regexp_replace(coalesce(c.codigo_vaga, ''), '[^0-9]', '', 'g') as vaga,
             count(*)::integer as total,
             (count(*) filter (where c.status in ('Contratado', 'Migração')))::integer as contratados
        from listas l
        join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
       group by 1, 2
    ),
    linhas as (
      select s.*,
             m.edital as edital_cadastrado,
             (s.numero is not null and s.numero in (select x.numero from editais_com_entrevista x)) as usa_entrevistas,
             cv.qt as qt_convocado_entrevistas,
             exists (select 1 from listas l where l.edital_id = s."CO_MONITORAMENTO"::text) as tem_lista,
             ap.total as qt_aprovado,
             ap.contratados as qt_contratado
        from s
        left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = s."CO_MONITORAMENTO"
        left join convocados cv on cv.numero = s.numero and cv.vaga = s."CO_VAGA"
        left join aprovados ap on ap.edital_id = s."CO_MONITORAMENTO"::text and ap.vaga = s."CO_VAGA"
    )
    select json_build_object(
      'schema_version', 1,
      'area', p_area,
      'gerado_em', now(),
      'ultima_carga', (
        select json_build_object('em', t."DT_FIM", 'linhas', t."QT_LINHA", 'sem_edital', t."QT_SEM_EDITAL")
          from public."TL_SYNC_SELECAO" t
         where t."TP_SITUACAO" = 'CONCLUIDA'
         order by t."DT_FIM" desc limit 1
      ),
      'vagas', (
        select coalesce(json_agg(json_build_object(
            'id', l."CO_SELECAO_VAGA",
            'edital_id', l."CO_MONITORAMENTO",
            'edital', coalesce(l.edital_cadastrado, l."DS_EDITAL"),
            'edital_planilha', l."DS_EDITAL",
            'unidade', l."NO_UNIDADE",
            'vaga', l."CO_VAGA",
            'vaga_planilha', l."DS_VAGA_PLANILHA",
            'cargo', l."NO_CARGO",
            'inscritos', l."QT_INSCRITO",
            'aptos', l."QT_APTO_ANALISE",
            'cancelados', l."QT_CANCELADO",
            'reprovados_questionario', l."QT_REPROVADO_QUESTIONARIO",
            'eliminados_nota', l."QT_ELIMINADO_NOTA",
            'reprovados_analise', l."QT_REPROVADO_ANALISE",
            'triados', l."QT_TRIADO",
            'total_eliminados', l."QT_TOTAL_ELIMINADO",
            'observacao', l."DS_OBSERVACAO",
            'convocados', case when l.usa_entrevistas then coalesce(l.qt_convocado_entrevistas, 0)
                               else l."QT_CONVOCADO_PLANILHA" end,
            'origem_convocados', case when l.usa_entrevistas then 'entrevistas' else 'planilha' end,
            'aprovados', case when l.tem_lista then coalesce(l.qt_aprovado, 0) end,
            'contratados', case when l.tem_lista then coalesce(l.qt_contratado, 0) end,
            'nao_contratados', case when l.tem_lista then coalesce(l.qt_aprovado, 0) - coalesce(l.qt_contratado, 0) end
          ) order by coalesce(l.edital_cadastrado, l."DS_EDITAL"), l."NO_UNIDADE", l."NO_CARGO", l."CO_VAGA"), '[]'::json)
          from linhas l
      )
    )
  );
end;
$function$;
comment on function public.get_selecao_da_area(text) is
  'Leitura da aba Seleção de uma área (json): o funil de cada vaga (aba Resultado da Auditoria), os convocados (TB_ENTREVISTA quando o edital tem entrevista; senão o V da planilha) e aprovados/contratados/não contratados da lista vigente. Exige selecao >= leitor, a área e o recorte da coordenação.';
revoke all on function public.get_selecao_da_area(text) from public, anon;
grant execute on function public.get_selecao_da_area(text) to authenticated, service_role;

commit;
