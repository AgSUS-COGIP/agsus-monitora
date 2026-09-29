-- Volta o painel externo Recursos para Painéis.
begin;
update public."TB_PAINEL_EXTERNO" set ativo = true where codigo = 'recursos';
commit;
