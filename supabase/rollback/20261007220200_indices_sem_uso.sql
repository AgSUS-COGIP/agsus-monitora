-- ROLLBACK de supabase/migrations/20261007220200_indices_sem_uso.sql
-- Recria os seis índices com a definição que estava no banco em 07/10/2026 (pg_indexes).
begin;

CREATE INDEX idx_analises_curriculares_ativo_chave ON public."TB_ANALISE_CURRICULAR" USING btree (chave_natural) WHERE (ativo IS TRUE);
CREATE INDEX idx_analises_curriculares_ativo_ordem_dashboard ON public."TB_ANALISE_CURRICULAR" USING btree (unidade, edital, codigo_vaga, candidato) WHERE (ativo IS TRUE);
CREATE INDEX idx_analises_curriculares_ativo_unidade_edital ON public."TB_ANALISE_CURRICULAR" USING btree (ativo, unidade, edital);
CREATE INDEX idx_analises_curriculares_status ON public."TB_ANALISE_CURRICULAR" USING btree (status_consolidado);
CREATE INDEX idx_analises_curriculares_data_analise ON public."TB_ANALISE_CURRICULAR" USING btree (data_analise);
CREATE INDEX lista_aprovados_candidatos_nome_idx ON public."TB_CANDIDATO_APROVADO" USING btree (lower(nome));

commit;
