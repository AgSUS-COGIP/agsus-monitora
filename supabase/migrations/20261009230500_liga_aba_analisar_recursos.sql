/*
  Liga a aba Analisar recursos no catálogo (TB_ABA), junto com o merge do
  front que traz a view 'analisar-recursos'
  (src/modulos/recursos/recursos.tsx, modo "analise"). A aba foi criada
  desligada em 20261009230000_analisar_recursos_no_menu.sql.

  Rollback: supabase/rollback/20261009230500_liga_aba_analisar_recursos.sql
*/
begin;
update public."TB_ABA" set "ST_ATIVO" = 'S', "DT_ATUALIZACAO" = now() where "CO_ABA" = 'analisar-recursos';
commit;
