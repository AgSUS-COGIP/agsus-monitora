-- ROLLBACK de supabase/migrations/20261005140000_ultima_conferencia_das_cargas.sql
begin;
drop function if exists public.obter_ultima_conferencia(text, text);
commit;
