/*
  ENSAIO de 20261007220200_indices_sem_uso.sql — begin … rollback.

  Cole no SQL Editor do Supabase (papel postgres). Confere, ANTES de tirar, que os
  seis continuam sem leitura e sem constraint; depois, que saíram. Termina em ROLLBACK.
*/
begin;

select json_agg(json_build_object('indice', s.indexrelname, 'leituras', s.idx_scan,
                                  'constraint', exists (select 1 from pg_constraint c where c.conindid = s.indexrelid)))
  from pg_stat_user_indexes s
 where s.schemaname = 'public'
   and s.indexrelname in ('idx_analises_curriculares_ativo_chave', 'idx_analises_curriculares_ativo_ordem_dashboard',
                          'idx_analises_curriculares_ativo_unidade_edital', 'idx_analises_curriculares_status',
                          'idx_analises_curriculares_data_analise', 'lista_aprovados_candidatos_nome_idx');

drop index public.idx_analises_curriculares_ativo_chave;
drop index public.idx_analises_curriculares_ativo_ordem_dashboard;
drop index public.idx_analises_curriculares_ativo_unidade_edital;
drop index public.idx_analises_curriculares_status;
drop index public.idx_analises_curriculares_data_analise;
drop index public.lista_aprovados_candidatos_nome_idx;

select count(*) as restam
  from pg_indexes
 where indexname in ('idx_analises_curriculares_ativo_chave', 'idx_analises_curriculares_ativo_ordem_dashboard',
                     'idx_analises_curriculares_ativo_unidade_edital', 'idx_analises_curriculares_status',
                     'idx_analises_curriculares_data_analise', 'lista_aprovados_candidatos_nome_idx');

rollback;
