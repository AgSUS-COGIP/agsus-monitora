/*
  ÍNDICES SEM USO NAS TABELAS QUE O SYNC MAIS ESCREVE (07/10/2026)

  pg_stat_user_indexes com o banco no ar desde 02/10/2026 01:22 (5,5 dias, ~1.150
  syncs das análises): estes índices tiveram ZERO leituras. Cada linha que o sync
  grava ou atualiza em TB_ANALISE_CURRICULAR mexe em 19 índices; tirar os que
  ninguém lê deixa a escrita (e o WAL) mais leve. Nenhum é de constraint.

    TB_ANALISE_CURRICULAR
      idx_analises_curriculares_ativo_chave           2,3 MB  (chave_natural) parcial:
                                                              a única uq_analises_curriculares_chave_natural já cobre
      idx_analises_curriculares_ativo_ordem_dashboard 1,8 MB  (unidade, edital, vaga, candidato) parcial:
                                                              o painel lê o pacote pronto
      idx_analises_curriculares_ativo_unidade_edital  0,8 MB  prefixo de idx_analises_curriculares_ativo_lookup
      idx_analises_curriculares_status                0,7 MB  status_consolidado: sempre lido com área/planilha
      idx_analises_curriculares_data_analise          0,6 MB  data_analise: marcos agora vêm do pacote
    TB_CANDIDATO_APROVADO
      lista_aprovados_candidatos_nome_idx             2,4 MB  lower(nome): nenhuma consulta filtra por ele

  O rollback recria os seis com a mesma definição.
*/
begin;

drop index public.idx_analises_curriculares_ativo_chave;
drop index public.idx_analises_curriculares_ativo_ordem_dashboard;
drop index public.idx_analises_curriculares_ativo_unidade_edital;
drop index public.idx_analises_curriculares_status;
drop index public.idx_analises_curriculares_data_analise;
drop index public.lista_aprovados_candidatos_nome_idx;

commit;
