-- Remove as duas RPCs do painel React de análises (PR #134, fechado sem merge).
-- Nunca usadas pelo front: Projetos e SEDE usam o painel da Saúde Indígena (#136).
begin;

drop function if exists public.get_analises_da_area(text, text);
drop function if exists public.get_analise_detalhe_da_area(uuid);

commit;
