/*
  Liga a aba Conduzir entrevistas no catálogo (TB_ABA), junto com o merge do
  front que traz a view 'conduzir-entrevistas'
  (src/modulos/entrevistas/conduzir.tsx). A aba foi criada desligada em
  20261008130000_conduzir_entrevistas_no_menu.sql.

  Rollback: supabase/rollback/20261008130500_liga_aba_conduzir_entrevistas.sql
*/
begin;
update public."TB_ABA" set "ST_ATIVO" = 'S', "DT_ATUALIZACAO" = now() where "CO_ABA" = 'conduzir-entrevistas';
commit;
