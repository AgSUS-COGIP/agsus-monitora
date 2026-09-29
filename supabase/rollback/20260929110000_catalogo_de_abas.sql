-- Desfaz 20260929110000_catalogo_de_abas.sql.
-- O front continua com o menu de sempre: sem a função, ele usa o catálogo do
-- próprio código (ABAS_DO_MENU em src/lib/menu-lateral.js).
begin;
drop function if exists public.listar_abas_do_menu();
drop table if exists public."RL_ABA_AREA";
drop table if exists public."TB_ABA";
commit;
