-- Desfaz 20261008130500_liga_aba_conduzir_entrevistas: desliga a aba
-- (a view continua no front; o menu do banco deixa de mostrá-la).
begin;
update public."TB_ABA" set "ST_ATIVO" = 'N', "DT_ATUALIZACAO" = now() where "CO_ABA" = 'conduzir-entrevistas';
commit;
