/*
  ÍNDICES SEM USO SAEM; AS DUAS CHAVES ESTRANGEIRAS SEM ÍNDICE GANHAM UM

  Por quê: pg_stat_user_indexes com as estatísticas desde 02/10/2026 (20 dias,
  com as cargas das planilhas rodando até 16/10 e a Avaliação documental de 15
  a 22/10): estes índices tiveram ZERO leituras. Cada gravação na tabela mexe
  em todos eles (escrita, WAL e espaço no plano NANO). Nenhum é de constraint
  nem sustenta chave estrangeira; nenhum plano de hoje os usa (zero leituras),
  então tirá-los não muda plano nenhum.

    TB_ANALISE_CURRICULAR (a tabela que o painel e o sync mais escrevem)
      idx_analises_curriculares_origem       2,8 MB  (origem_arquivo_id, id_origem):
                                                     nenhuma consulta filtra por
                                                     origem_arquivo_id (o sync só grava)
      idx_analises_curriculares_ativo_lookup 0,6 MB  (ativo, unidade, edital, vaga): ficou
                                                     como prefixo de um índice que saiu
                                                     em 20261009110000; sem leitura
      IN_ANALISECURRICULAR_VAGA              0,6 MB  (codigo_vaga, CO_AREA): sem leitura
                                                     nas montagens das entrevistas e dos
                                                     aprovados
    TL_EVENTO_ACESSO
      idx_eventos_acesso_tela_evento_created_at 0,6 MB
    TH_MONITORAMENTO
      idx_historico_usuario, idx_historico_evento_created  0,1 MB cada

  FICA, apesar de zero leituras:
      IN_CANDAPROVADO_NOMENORM (1,8 MB): é o único caminho de
      private."FC_VINCULOS_DO_APROVADO" para o aprovado sem código do candidato
      (casos dos avisos de conferência, 20261007240000); sem ele, cada chamada
      calcularia o nome normalizado das ~60 mil linhas de TB_CANDIDATO_APROVADO.
      O caso é raro (zero em 20 dias), mas o índice é o que o torna barato.
      Os IN_FK* com zero leituras sustentam chaves estrangeiras e ficam.

  CHAVES ESTRANGEIRAS SEM ÍNDICE (Supabase advisor "unindexed_foreign_keys")
      TB_ENTREVISTA.CO_ROTEIRO         -> IN_FKENTREVISTA_COROTEIRO
      TH_CANDIDATO_APROVADO.lista_id   -> IN_FKHISTCANDAPROV_LISTA
    Apagar um roteiro ou uma lista de aprovados confere os filhos pela chave
    em vez de varrer a tabela. São tabelas pequenas (4,6 mil e 4,5 mil linhas):
    o índice é criado dentro da transação, com trava curta.

  Ensaio: supabase/ensaios/20261022163000_indices_sem_uso_e_chaves_estrangeiras.sql
  Rollback: supabase/rollback/20261022163000_indices_sem_uso_e_chaves_estrangeiras.sql
*/
begin;

drop index if exists public.idx_analises_curriculares_origem;
drop index if exists public.idx_analises_curriculares_ativo_lookup;
drop index if exists public."IN_ANALISECURRICULAR_VAGA";
drop index if exists public.idx_eventos_acesso_tela_evento_created_at;
drop index if exists public.idx_historico_usuario;
drop index if exists public.idx_historico_evento_created;

create index if not exists "IN_FKENTREVISTA_COROTEIRO"
  on public."TB_ENTREVISTA" ("CO_ROTEIRO");
comment on index public."IN_FKENTREVISTA_COROTEIRO" is
  'Chave estrangeira para TB_ROTEIRO_ENTREVISTA (20261022163000).';

create index if not exists "IN_FKHISTCANDAPROV_LISTA"
  on public."TH_CANDIDATO_APROVADO" (lista_id);
comment on index public."IN_FKHISTCANDAPROV_LISTA" is
  'Chave estrangeira para TB_LISTA_APROVADO (20261022163000).';

commit;
