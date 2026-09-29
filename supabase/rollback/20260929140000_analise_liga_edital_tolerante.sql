-- Volta a ligação estrita (grupo + unidade + edital) da view de análises.
begin;

create or replace view public."VW_ANALISES_DASHBOARD_BASE_TODOS"
with (security_invoker = true) as
SELECT a.id,
    a.grupo,
    a.unidade,
    a.edital,
    a.codigo_vaga,
    a.nome_vaga,
    a.candidato,
    a.categoria,
    a.modalidade_concorrencia,
    a.status_consolidado,
    a.etapa,
    a.responsavel_analise,
    a.data_analise,
    a.nota_final_ajustada,
    a.pontuacao_escolaridade,
    a.pontuacao_cursos_aperfeicoamento,
    a.pontuacao_experiencia_profissional,
    a.pontuacao_criterio_etnico,
    a.experiencia_saude_indigena_total,
    a.experiencia_atencao_basica_total,
    a.analise,
    a.link_pdf,
    a.pdf_status,
    a.erro_pdf,
    a.origem_url,
    e.data_inicio_analise,
    e.data_fim_analise,
        CASE
            WHEN a.data_analise IS NULL THEN 'SEM_DATA'::text
            WHEN e.data_inicio_analise IS NULL AND e.data_fim_analise IS NULL THEN 'SEM_JANELA'::text
            WHEN e.data_inicio_analise IS NOT NULL AND a.data_analise < e.data_inicio_analise OR e.data_fim_analise IS NOT NULL AND a.data_analise > e.data_fim_analise THEN 'FORA_PERIODO'::text
            ELSE 'DENTRO_PERIODO'::text
        END AS data_validacao_status,
    a.updated_at,
    a.ultima_atualizacao,
    a.origem_arquivo_id,
    a.origem_planilha,
    a.pdf_gerado,
    a.data_geracao_pdf,
    a.pdf_file_id,
    a.pdf_ultima_tentativa,
    a.pdf_hash_origem,
    a.chave_natural,
    COALESCE(e.ativo, true) AS edital_ativo,
        CASE
            WHEN COALESCE(e.ativo, true) IS TRUE THEN 'Ativo'::text
            ELSE 'Inativo'::text
        END AS edital_status,
    COALESCE(a.ativo, false) AS ativo,
        CASE
            WHEN COALESCE(e.ativo, true) IS TRUE THEN 'Ativo'::text
            ELSE 'Inativo'::text
        END AS situacao_processo,
    COALESCE(e.ativo, true) AS edital_cadastro_ativo,
        CASE
            WHEN COALESCE(e.ativo, true) IS TRUE THEN 'Ativo'::text
            ELSE 'Inativo'::text
        END AS edital_cadastro_status,
    e.id IS NOT NULL AS edital_encontrado
   FROM "TB_ANALISE_CURRICULAR" a
     LEFT JOIN "TB_EDITAL_ANALISE" e ON e.grupo_norm = a.grupo_norm AND e.unidade_norm = a.unidade_norm AND e.edital_norm = a.edital_norm;

select public.atualizar_cache_painel_analises();

commit;
