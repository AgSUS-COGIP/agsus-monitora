-- Desfaz 20261020150000_detalhe_do_painel_com_espelho.sql:
--   get_analise_detalhe_do_painel volta à de 20260929150000 (sem a chave "espelho"; search_path public, private).
-- O front com a gaveta do espelho continua funcionando: sem "espelho", a gaveta mostra só a nota final e a composição.
begin;

set local lock_timeout = '10s';

CREATE OR REPLACE FUNCTION public.get_analise_detalhe_do_painel(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
 SET statement_timeout TO '5s'
AS $function$
declare
  v_id uuid;
  v_analise text;
  v_chave text;
  v_grupo_norm text;
  v_area text;
  v_detalhe jsonb;
begin
  if not (private.pode_recurso('analises')) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;

  select a.id, a.analise, a.chave_natural, a.grupo_norm
    into v_id, v_analise, v_chave, v_grupo_norm
    from public."TB_ANALISE_CURRICULAR" a
   where a.id = p_id;

  if not found then
    return null;
  end if;

  select ar."CO_AREA" into v_area
    from public."TB_AREA" ar
   where public.analises_norm_key(ar."NO_GRUPO_PLANILHA") = v_grupo_norm;

  if not (private.is_master() or (v_area is not null and private."FC_PODE_AREA"(v_area)
      and (private."FC_EDITAIS_VISIVEIS"() is null or exists (
        select 1 from public."TB_ANALISE_CURRICULAR" x
         where x.id = v_id
           and (x.edital_norm = any (private."FC_EDITAIS_NORM_VISIVEIS"())
                or x.unidade_norm = any (private."FC_UNIDADES_NORM_VISIVEIS"())))))) then
    raise exception 'Sem permissão para as análises desta área' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'grupo', v.grupo,
    'nota_final_ajustada', v.nota_final_ajustada,
    'pontuacao_escolaridade', v.pontuacao_escolaridade,
    'pontuacao_cursos_aperfeicoamento', v.pontuacao_cursos_aperfeicoamento,
    'pontuacao_experiencia_profissional', v.pontuacao_experiencia_profissional,
    'pontuacao_criterio_etnico', v.pontuacao_criterio_etnico,
    'experiencia_saude_indigena_total', v.experiencia_saude_indigena_total,
    'experiencia_atencao_basica_total', v.experiencia_atencao_basica_total,
    'experiencia_profissional_anos', ac.experiencia_profissional_anos,
    'experiencia_profissional_meses', ac.experiencia_profissional_meses,
    'experiencia_profissional_dias', ac.experiencia_profissional_dias,
    'experiencia_profissional_total', ac.experiencia_profissional_total,
    'link_pdf', v.link_pdf,
    'pdf_status', v.pdf_status,
    'erro_pdf', v.erro_pdf,
    'origem_arquivo_id', v.origem_arquivo_id,
    'data_inicio_analise', v.data_inicio_analise,
    'data_fim_analise', v.data_fim_analise,
    'data_validacao_status', v.data_validacao_status,
    'edital_status', v.edital_status,
    'updated_at', v.updated_at,
    'ultima_atualizacao', v.ultima_atualizacao
  )
  into v_detalhe
  from public."VW_ANALISES_DASHBOARD_BASE_TODOS" v
  join public."TB_ANALISE_CURRICULAR" ac on ac.id = v.id
  where v.id = v_id;

  return coalesce(v_detalhe, '{}'::jsonb) || jsonb_build_object(
    'id', v_id,
    'area', v_area,
    'analise', v_analise,
    'chave_natural', v_chave
  );
end;
$function$
;

comment on function public.get_analise_detalhe_do_painel(uuid) is null;

revoke all on function public.get_analise_detalhe_do_painel(uuid) from public, anon;
grant execute on function public.get_analise_detalhe_do_painel(uuid) to authenticated;

commit;
