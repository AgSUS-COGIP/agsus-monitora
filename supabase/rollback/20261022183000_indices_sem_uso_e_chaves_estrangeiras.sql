/*
  Rollback de 20261022183000_indices_sem_uso_e_chaves_estrangeiras.sql: os seis
  índices voltam com a mesma definição (e comentário) e os dois das chaves
  estrangeiras saem.
*/
begin;

create index if not exists idx_analises_curriculares_origem
  on public."TB_ANALISE_CURRICULAR" using btree (origem_arquivo_id, id_origem);
create index if not exists idx_analises_curriculares_ativo_lookup
  on public."TB_ANALISE_CURRICULAR" using btree (ativo, unidade, edital, codigo_vaga);
create index if not exists "IN_ANALISECURRICULAR_VAGA"
  on public."TB_ANALISE_CURRICULAR" using btree (codigo_vaga, "CO_AREA");
comment on index public."IN_ANALISECURRICULAR_VAGA" is
  'Análises por vaga e área (ligação com as entrevistas e aprovados sem entrevista).';
create index if not exists idx_eventos_acesso_tela_evento_created_at
  on public."TL_EVENTO_ACESSO" using btree (tela, evento, created_at);
create index if not exists idx_historico_usuario
  on public."TH_MONITORAMENTO" using btree (usuario_id, created_at desc);
create index if not exists idx_historico_evento_created
  on public."TH_MONITORAMENTO" using btree (evento, created_at desc);

drop index if exists public."IN_FKENTREVISTA_COROTEIRO";
drop index if exists public."IN_FKHISTCANDAPROV_LISTA";

commit;
