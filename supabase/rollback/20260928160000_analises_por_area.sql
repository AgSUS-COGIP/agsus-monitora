/*
  ROLLBACK de migrations/20260928160000_analises_por_area.sql
  Remove as duas RPCs de leitura do painel novo de Análises. Nada mais dependia
  delas; o painel antigo (analises.html) continua com as suas.
*/
begin;

drop function if exists public.get_analise_detalhe_da_area(uuid);
drop function if exists public.get_analises_da_area(text, text);

commit;
