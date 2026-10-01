-- Desfaz 20261001160000 (volta a ordem de antes: aprovados 4, análises 5, entrevistas 6, recursos 7).
begin;
update public."TB_ABA" set "NU_ORDEM" = 4, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'aprovados';
update public."TB_ABA" set "NU_ORDEM" = 5, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'analises';
update public."TB_ABA" set "NU_ORDEM" = 6, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'entrevistas';
update public."TB_ABA" set "NU_ORDEM" = 7, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'recursos';
commit;
