/*
  Liga a aba Seleção no catálogo (TB_ABA), junto com o merge do front que traz
  a view 'selecao' (selecao.html). A aba foi criada desligada em
  20261001090000_selecao.sql.

  Rollback: supabase/rollback/20261001090500_liga_aba_selecao.sql
*/
begin;
update public."TB_ABA" set "ST_ATIVO" = 'S', "DT_ATUALIZACAO" = now() where "CO_ABA" = 'selecao';
commit;
