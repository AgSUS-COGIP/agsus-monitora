-- Volta o painel externo Seleção.
begin;
update public."TB_PAINEL_EXTERNO" set ativo = true, updated_at = now() where id = 'f4508663-b3c6-4909-b01d-96026063f790';
commit;
