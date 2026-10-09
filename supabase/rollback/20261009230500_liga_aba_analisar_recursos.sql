-- Desfaz 20261009230500_liga_aba_analisar_recursos: desliga a aba
-- (a view continua no front; o menu do banco deixa de mostrá-la).
begin;
update public."TB_ABA" set "ST_ATIVO" = 'N', "DT_ATUALIZACAO" = now() where "CO_ABA" = 'analisar-recursos';
commit;
