-- Remove a leitura da lista de aprovados numa chamada só (a tela volta às páginas).
begin;
drop function if exists public.listar_candidatos_aprovados_compacto();
commit;
