-- Desfaz 20261002131000: sai a leitura da Visão geral (a tela volta a calcular crítico, agenda e pós-resultado só com as linhas).
begin;
drop function if exists public.listar_acompanhamento_da_visao_geral(text);
commit;
