-- Desfaz 20261013180200: tira a leitura das fichas do job das conferências.
begin;
drop function if exists public.conferencia_ler_fichas(uuid, integer);
commit;
