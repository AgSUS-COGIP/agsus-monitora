/*
  Liga a aba Classificação no catálogo (TB_ABA), junto com o merge do front
  que traz a view 'classificacao' (src/modulos/classificacao/). A aba foi
  criada desligada em 20261002120000_classificacao.sql.

  Rollback: supabase/rollback/20261002120500_liga_aba_classificacao.sql
*/
begin;
update public."TB_ABA" set "ST_ATIVO" = 'S', "DT_ATUALIZACAO" = now() where "CO_ABA" = 'classificacao';
commit;
