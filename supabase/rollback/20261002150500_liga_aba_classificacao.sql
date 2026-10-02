-- Desliga a aba Classificação no catálogo (a view some do menu; regras e listas ficam).
begin;
update public."TB_ABA" set "ST_ATIVO" = 'N', "DT_ATUALIZACAO" = now() where "CO_ABA" = 'classificacao';
commit;
