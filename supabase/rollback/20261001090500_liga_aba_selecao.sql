-- Desliga a aba Seleção no catálogo (a view some do menu; dados ficam).
begin;
update public."TB_ABA" set "ST_ATIVO" = 'N', "DT_ATUALIZACAO" = now() where "CO_ABA" = 'selecao';
commit;
