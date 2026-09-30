-- Volta o painel externo Entrevistas.
begin;
update public."TB_PAINEL_EXTERNO" set ativo = true, updated_at = now() where id = '5c0bbc63-35b9-4a1a-b196-f2b3ecf65198';
commit;
