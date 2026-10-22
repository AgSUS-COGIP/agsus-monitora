-- Desfaz 20261009230000_analisar_recursos_no_menu: tira a aba
-- 'analisar-recursos' (e volta a ordem: Painel de entrevistas 7, Conduzir
-- entrevistas 8, Classificação 9, Aprovados 10, Seleção 11) e devolve o
-- rótulo "Recursos" com o selo BETA.
begin;

delete from public."RL_ABA_AREA" where "CO_ABA" = 'analisar-recursos';
delete from public."TB_ABA" where "CO_ABA" = 'analisar-recursos';
update public."TB_ABA" set "NU_ORDEM" = 7, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'entrevistas';
update public."TB_ABA" set "NU_ORDEM" = 8, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'conduzir-entrevistas';
update public."TB_ABA" set "NU_ORDEM" = 9, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'classificacao';
update public."TB_ABA" set "NU_ORDEM" = 10, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'aprovados';
update public."TB_ABA" set "NU_ORDEM" = 11, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'selecao';
update public."TB_ABA" set "NO_ABA" = 'Recursos', "ST_BETA" = 'S', "DT_ATUALIZACAO" = now() where "CO_ABA" = 'recursos';

commit;
