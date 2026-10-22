/*
  Rollback de 20261005130000_recurso_ajusta_pontuacao.sql.

  O QUE DESFAZ
    - As RPCs do ajuste (obter_ajustes_pontuacao_recurso, obter_dados_previa_ajuste,
      propor_, aprovar_ e cancelar_ajuste_pontuacao), as funções private
      (FC_AJUSTE_PONTUACAO_JSON, FC_DADOS_CLASSIFICACAO_EDITAL e os gatilhos) e
      as tabelas TB_ITEM_AJUSTE_PONTUACAO e TB_AJUSTE_PONTUACAO_RECURSO saem.
    - obter_classificacao_do_edital volta ao corpo de
      20261002150000_classificacao.sql (copiado de lá, sem mudança).
    - O CHECK de TH_RECURSO_CANDIDATO."TP_ACAO" volta ao de 20261001170000 (sem
      'ajuste') e ST_MUDOU_CLASSIFICACAO volta a ser manual.

  PARA NÃO PERDER O RASTRO: se já houver algum ajuste gravado, o rollback PARA
  (exporte TB_AJUSTE_PONTUACAO_RECURSO, TB_ITEM_AJUSTE_PONTUACAO e o histórico
  'ajuste' antes). Para descartar mesmo assim, rode antes, na mesma sessão:
    select set_config('monitora.rollback_descarta_ajustes', 'S', false);
  (o histórico 'ajuste' do recurso é apagado, porque o CHECK antigo não o aceita).
*/
begin;

do $$
begin
  if exists (select 1 from public."TB_AJUSTE_PONTUACAO_RECURSO")
     and coalesce(current_setting('monitora.rollback_descarta_ajustes', true), '') <> 'S' then
    raise exception 'Há ajustes da pontuação gravados: exporte antes (ver o cabeçalho deste rollback).';
  end if;
end;
$$;

drop function public.cancelar_ajuste_pontuacao(uuid, text);
drop function public.aprovar_ajuste_pontuacao(uuid, jsonb);
drop function public.propor_ajuste_pontuacao(uuid, jsonb);
drop function public.obter_dados_previa_ajuste(uuid);
drop function public.obter_ajustes_pontuacao_recurso(uuid);

drop trigger "TG_RECURSOCANDIDATO_AJUSTE" on public."TB_RECURSO_CANDIDATO";
drop function private."FC_TG_AJUSTE_DO_RECURSO"();

drop table public."TB_ITEM_AJUSTE_PONTUACAO";
drop table public."TB_AJUSTE_PONTUACAO_RECURSO";
drop function private."FC_TG_AJUSTE_PONTUACAO_IMUTAVEL"();

delete from public."TH_RECURSO_CANDIDATO" where "TP_ACAO" = 'ajuste';
alter table public."TH_RECURSO_CANDIDATO" drop constraint "CK_HISTRECURSO_TPACAO";
alter table public."TH_RECURSO_CANDIDATO" add constraint "CK_HISTRECURSO_TPACAO"
  check ("TP_ACAO" in ('criacao', 'edicao', 'etapa', 'exclusao', 'anexo', 'resposta', 'parecer'));
comment on constraint "CK_HISTRECURSO_TPACAO" on public."TH_RECURSO_CANDIDATO" is
  'Ações registradas: criacao, edicao, etapa, exclusao, anexo, resposta e parecer (transições do fluxo jurídico).';
comment on column public."TH_RECURSO_CANDIDATO"."TP_ACAO" is
  'criacao, edicao, etapa, exclusao, anexo, resposta ou parecer.';
comment on column public."TH_RECURSO_CANDIDATO"."DS_CAMPO" is
  'Campo editado, etapa, ação do anexo (inclusao, arquivamento), da resposta (criacao, enviar_revisao, aprovar, devolver, reabrir, marcar_enviada) ou do parecer (enviar_parecer, devolver, deferir, deferir_parcialmente, indeferir, reabrir). Nulo na criação e na exclusão do recurso.';
comment on column public."TB_RECURSO_CANDIDATO"."ST_MUDOU_CLASSIFICACAO" is 'S: o recurso mudou a classificação do candidato (marcado pelo analista).';

-- obter_classificacao_do_edital: corpo de 20261002150000_classificacao.sql.
create or replace function public.obter_classificacao_do_edital(p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 1);
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_numero text;
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  v_numero := private."FC_NUMERO_EDITAL"(v_m.edital);
  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'edital', json_build_object('id', v_m.id, 'edital', v_m.edital, 'unidade', v_m.unidade, 'area', v_area, 'numero', v_numero),
    'pode_editar', private.pode_recurso('classificacao', 2),
    'regra', private."FC_REGRA_CLASSIFICACAO_JSON"(p_edital),
    'catalogo', (
      select json_agg(json_build_object('codigo', k."CO_CRITERIO", 'nome', k."NO_CRITERIO", 'tipo', k."TP_VALOR",
               'direcao', k."TP_DIRECAO_PADRAO", 'ativo', k."ST_ATIVO" = 'S') order by k."NU_ORDEM")
        from public."TB_CRITERIO_CLASSIFICACAO" k),
    'cronograma', coalesce((
      select json_agg(json_build_object('ordem', c.ordem, 'atividade', c.atividade, 'inicio', c.data_inicio, 'fim', c.data_fim)
             order by c.ordem)
        from public."TB_CRONOGRAMA_MONIT_INDIG" c where c.monitoramento_id = p_edital), '[]'::json),
    'quadro', coalesce((
      select json_agg(json_build_object('id', q."CO_QUADRO_VAGA", 'ordem', q."NU_ORDEM", 'cargo', q."NO_CARGO",
               'lotacao', q."NO_LOTACAO", 'modalidades', q."DS_MODALIDADE_VAGA", 'vagas_imediatas', q."QT_VAGA_IMEDIATA",
               'cadastro_reserva', q."ST_CADASTRO_RESERVA" = 'S') order by q."NU_ORDEM")
        from public."TB_QUADRO_VAGA_EDITAL" q
       where q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S'), '[]'::json),
    'candidatos', coalesce((
      with a as (
        select a.* from public."TB_ANALISE_CURRICULAR" a
         where a."CO_AREA" = v_area and a.ativo and private."FC_NUMERO_EDITAL"(a.edital) = v_numero
      ),
      vq as (
        select n.nome_vaga, private."FC_QUADRO_DA_VAGA"(p_edital, n.nome_vaga) as quadro
          from (select distinct a.nome_vaga from a) n
      )
      select json_agg(json_build_object(
               'analise_id', a.id, 'codigo', a.id_origem, 'nome', a.candidato, 'vaga', a.codigo_vaga,
               'cargo', a.nome_vaga, 'categoria', a.categoria, 'modalidade', a.modalidade_concorrencia, 'pcd', a.pcd,
               'data_nascimento', a.data_nascimento, 'nota_documental', a.nota_final_ajustada, 'nota_art', a.nota_empregare,
               'pontuacao_formacao', a.pontuacao_escolaridade, 'pontuacao_cursos', a.pontuacao_cursos_aperfeicoamento,
               'pontuacao_experiencia', a.pontuacao_experiencia_profissional, 'pontuacao_etnica', a.pontuacao_criterio_etnico,
               'exp_saude_indigena', a.experiencia_saude_indigena_total, 'exp_atencao_basica', a.experiencia_atencao_basica_total,
               'exp_profissional', a.experiencia_profissional_total, 'status', a.status_consolidado, 'etapa', a.etapa,
               'quadro', vq.quadro)
             order by a.codigo_vaga, a.candidato)
        from a left join vq on vq.nome_vaga is not distinct from a.nome_vaga), '[]'::json),
    'entrevistas', coalesce((
      select json_agg(json_build_object(
               'id', e."CO_ENTREVISTA", 'analise_id', e."CO_ANALISE_CURRICULAR", 'nome', e."NO_CANDIDATO",
               'vaga', e."CO_VAGA", 'nota', e."VL_NOTA_TOTAL", 'parecer', e."TP_PARECER", 'compareceu', e."ST_COMPARECEU",
               'ligacao', e."TP_LIGACAO_ANALISE", 'origem', e."TP_ORIGEM",
               'notas', coalesce((select json_agg(json_build_object('ordem', n."NU_ORDEM", 'criterio', n."DS_CRITERIO", 'nota', n."VL_NOTA")
                                         order by n."NU_ORDEM")
                                    from public."TB_ENTREVISTA_NOTA" n where n."CO_ENTREVISTA" = e."CO_ENTREVISTA"), '[]'::json))
             order by e."CO_VAGA", e."NO_CANDIDATO")
        from public."TB_ENTREVISTA" e
       where e."ST_ATIVO" = 'S'
         and (e."CO_MONITORAMENTO" = p_edital
              or (e."CO_MONITORAMENTO" is null and e."CO_AREA" = v_area
                  and private."FC_NUMERO_EDITAL"(e."DS_EDITAL") = v_numero))), '[]'::json),
    'listas', coalesce((
      select json_agg(private."FC_LISTA_CLASSIFICACAO_JSON"(l."CO_LISTA_CLASSIFICACAO") order by l."DT_GERACAO" desc)
        from (select l."CO_LISTA_CLASSIFICACAO", l."DT_GERACAO"
                from public."TB_LISTA_CLASSIFICACAO" l
               where l."CO_MONITORAMENTO" = p_edital
               order by l."DT_GERACAO" desc limit 60) l), '[]'::json),
    'desempates', coalesce((
      select json_agg(private."FC_DESEMPATE_CLASSIFICACAO_JSON"(d."CO_DESEMPATE_CLASSIFICACAO") order by d."DT_REGISTRO")
        from public."TB_DESEMPATE_CLASSIFICACAO" d
       where d."CO_MONITORAMENTO" = p_edital and d."ST_ATIVO" = 'S'), '[]'::json)
  );
end;
$function$;
comment on function public.obter_classificacao_do_edital(uuid) is
  'Tudo o que o motor de classificação precisa de um edital (json): regra vigente e versões, catálogo de critérios, cronograma (data de corte), quadro de vagas, análises (sem CPF), entrevistas com notas por competência (ligadas por CO_ANALISE_CURRICULAR), listas geradas e desempates registrados; pode_editar. Exige classificacao >= leitor, a área e o recorte da coordenação.';
revoke all on function public.obter_classificacao_do_edital(uuid) from public, anon;
grant execute on function public.obter_classificacao_do_edital(uuid) to authenticated, service_role;

drop function private."FC_DADOS_CLASSIFICACAO_EDITAL"(uuid, text);
drop function private."FC_AJUSTE_PONTUACAO_JSON"(uuid);

commit;
