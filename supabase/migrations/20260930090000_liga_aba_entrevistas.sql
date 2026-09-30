/*
  Liga a aba Entrevistas no catálogo (TB_ABA), junto com o merge do front que
  traz a view 'entrevistas' (entrevistas.html). A aba foi criada desligada em
  20260929235000_entrevistas.sql.

  Rollback: supabase/rollback/20260930090000_liga_aba_entrevistas.sql
*/
begin;
update public."TB_ABA" set "ST_ATIVO" = 'S', "DT_ATUALIZACAO" = now() where "CO_ABA" = 'entrevistas';
commit;
