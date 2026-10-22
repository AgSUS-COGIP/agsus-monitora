/*
  Liga a aba Avaliação documental no catálogo (TB_ABA), junto com o merge do
  front que traz a view 'avaliacao-documental'
  (src/modulos/avaliacao-documental/). A aba foi criada desligada em
  20261006090000_avaliacao_documental_permissao_e_menu.sql.

  Rollback: supabase/rollback/20261006090500_liga_aba_avaliacao_documental.sql
*/
begin;
update public."TB_ABA" set "ST_ATIVO" = 'S', "DT_ATUALIZACAO" = now() where "CO_ABA" = 'avaliacao-documental';
commit;
