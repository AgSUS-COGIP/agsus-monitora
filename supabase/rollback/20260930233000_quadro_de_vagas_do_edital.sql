/*
  Rollback de 20260930233000_quadro_de_vagas_do_edital.sql.
  obter_entrevistas_do_edital volta ao que era em 20260930220000 (vagas imediatas
  só da entrevista e da lista de convocação). O quadro importado se perde.
*/
begin;
create or replace function public.obter_entrevistas_do_edital(p_edital uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text := private."FC_EXIGIR_ENTREVISTAS_EDITAL"(p_edital, 1);
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_cfg public."TB_ENTREVISTA_EDITAL";
  v_eu uuid;
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  select * into v_cfg from public."TB_ENTREVISTA_EDITAL" where "CO_MONITORAMENTO" = p_edital;
  select p.id into v_eu from private.current_profile() p;
  return json_build_object(
    'edital', json_build_object('id', v_m.id, 'edital', v_m.edital, 'unidade', v_m.unidade, 'area', v_area),
    'pode_editar', private.pode_recurso('entrevistas', 2),
    'admin_global', private.is_master(),
    'meu_perfil', v_eu,
    'configuracao', case when v_cfg."CO_MONITORAMENTO" is null then null else json_build_object(
        'roteiro', private."FC_ROTEIRO_JSON"(v_cfg."CO_ROTEIRO"), 'convocacao', v_cfg."DS_CONVOCACAO",
        'banca', v_cfg."DS_BANCA", 'lancamento', v_cfg."TP_LANCAMENTO", 'atualizado_em', v_cfg."DT_ATUALIZACAO") end,
    'vagas', coalesce((
      select json_agg(json_build_object('vaga', v.codigo_vaga, 'cargo', v.cargo, 'aprovados', v.aprovados,
               'vagas_imediatas', coalesce(ev."QT_VAGA_IMEDIATA",
                  (select vi."QT_VAGA_IMEDIATA" from public."TB_VAGA_IMEDIATA" vi
                    where vi."CO_EDITAL" = p_edital::text and (vi."CO_VAGA" = v.codigo_vaga or upper(vi."NO_CARGO") = upper(v.cargo)) limit 1)),
               'vagas_imediatas_salvas', ev."QT_VAGA_IMEDIATA" is not null) order by v.cargo)
        from (select a.codigo_vaga, min(a.nome_vaga) cargo, count(*) filter (where a.status_consolidado = 'Aprovado') aprovados
                from public."TB_ANALISE_CURRICULAR" a
               where a."CO_AREA" = v_area and a.ativo
                 and private."FC_NUMERO_EDITAL"(a.edital) = private."FC_NUMERO_EDITAL"(v_m.edital)
               group by a.codigo_vaga) v
        left join public."TB_ENTREVISTA_VAGA" ev on ev."CO_MONITORAMENTO" = p_edital and ev."CO_VAGA" = v.codigo_vaga), '[]'::json),
    'candidatos', coalesce((
      select json_agg(json_build_object('analise_id', c.id, 'candidato', c.candidato, 'codigo', c.id_origem,
               'vaga', c.codigo_vaga, 'cargo', c.nome_vaga, 'nota_analise', c.nota_final_ajustada,
               'modalidade', c.modalidade_concorrencia, 'pcd', c.pcd, 'posicao', c.posicao)
             order by c.codigo_vaga, c.posicao)
        from (select a.*, row_number() over (partition by a.codigo_vaga
                                             order by a.nota_final_ajustada desc nulls last, a.candidato) posicao
                from public."TB_ANALISE_CURRICULAR" a
               where a."CO_AREA" = v_area and a.ativo and a.status_consolidado = 'Aprovado'
                 and private."FC_NUMERO_EDITAL"(a.edital) = private."FC_NUMERO_EDITAL"(v_m.edital)) c), '[]'::json),
    'avaliadores', coalesce((
      select json_agg(json_build_object('id', b."CO_AVALIADOR", 'nome', b."NO_AVALIADOR", 'origem', b."NO_ORIGEM",
               'banca', b."NU_BANCA", 'perfil', b."CO_PERFIL_USUARIO", 'ativo', b."ST_ATIVO" = 'S') order by b."NU_BANCA", b."NO_ORIGEM", b."NO_AVALIADOR")
        from public."TB_ENTREVISTA_AVALIADOR" b where b."CO_MONITORAMENTO" = p_edital), '[]'::json),
    'convocados', coalesce((
      select json_agg(json_build_object('id', e."CO_ENTREVISTA", 'analise_id', e."CO_ANALISE_CURRICULAR",
               'candidato', e."NO_CANDIDATO", 'codigo', e."CO_CANDIDATO", 'vaga', e."CO_VAGA", 'cargo', e."NO_CARGO",
               'modalidade', e."DS_MODALIDADE", 'banca', e."NU_BANCA", 'compareceu', e."ST_COMPARECEU",
               'nota', e."VL_NOTA_TOTAL", 'parecer', e."TP_PARECER", 'nota_analise', a.nota_final_ajustada,
               'avaliacoes', coalesce((select json_agg(json_build_object('competencia', x."CO_COMPETENCIA",
                      'avaliador', x."CO_AVALIADOR", 'nota', x."VL_NOTA"))
                   from public."TB_ENTREVISTA_AVALIACAO" x where x."CO_ENTREVISTA" = e."CO_ENTREVISTA"), '[]'::json),
               'notas', coalesce((select json_agg(json_build_array(n."NU_ORDEM", n."VL_NOTA") order by n."NU_ORDEM")
                   from public."TB_ENTREVISTA_NOTA" n where n."CO_ENTREVISTA" = e."CO_ENTREVISTA"), '[]'::json))
             order by e."CO_VAGA", e."NO_CANDIDATO")
        from public."TB_ENTREVISTA" e
        left join public."TB_ANALISE_CURRICULAR" a on a.id = e."CO_ANALISE_CURRICULAR"
       where e."CO_MONITORAMENTO" = p_edital and e."TP_ORIGEM" = 'sistema' and e."ST_ATIVO" = 'S'), '[]'::json)
  );
end;
$function$
;
drop function if exists public.salvar_quadro_de_vagas(uuid, jsonb);
drop function if exists public.obter_quadro_de_vagas(uuid);
drop function if exists private."FC_QUADRO_DA_VAGA"(uuid, text);
drop function if exists private."FC_TOKENS_VAGA"(text);
drop table if exists public."TB_QUADRO_VAGA_EDITAL";
commit;
