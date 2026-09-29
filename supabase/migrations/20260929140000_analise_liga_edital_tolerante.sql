/*
  Análise liga ao edital mesmo com a unidade escrita diferente.

  A view casava análise e edital por grupo + unidade + edital (normalizados).
  Em Projetos, a DIM_EDITAIS tinha "Agora tem Especialistas Caminhoneiros" e a
  FATO "Especialistas Caminhoneiros": as 1.285 análises do 30/2026 não achavam o
  edital e, sem ele, COALESCE(e.ativo, true) as deixava "ativas" — o "ativo = NÃO"
  da planilha nunca chegava.

  Agora: vale o edital de mesma unidade; se não houver, o ÚNICO edital de mesmo
  grupo e número. Nova coluna edital_encontrado (no fim) para o painel avisar
  "análises sem edital cadastrado" em vez de tratá-las como ativas caladas.
*/
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
     LEFT JOIN LATERAL (
       -- O edital da análise: o de mesma unidade; se a unidade estiver escrita
       -- diferente na DIM_EDITAIS, o único edital de mesmo grupo e número.
       SELECT e1.*
         FROM "TB_EDITAL_ANALISE" e1
        WHERE e1.grupo_norm = a.grupo_norm
          AND e1.edital_norm = a.edital_norm
          AND (e1.unidade_norm = a.unidade_norm
               OR (SELECT count(*) FROM "TB_EDITAL_ANALISE" e2
                    WHERE e2.grupo_norm = a.grupo_norm
                      AND e2.edital_norm = a.edital_norm) = 1)
        ORDER BY (e1.unidade_norm = a.unidade_norm) DESC
        LIMIT 1
     ) e ON true;

-- Pacotes prontos do painel remontados com a ligação nova.
select public.atualizar_cache_painel_analises();

commit;
