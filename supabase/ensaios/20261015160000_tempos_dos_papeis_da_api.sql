/*
  Ensaio de 20261015160000_tempos_dos_papeis_da_api.sql (sempre desfeito: begin … rollback).

  Uso (Git Bash):
    source ensaio.sh
    ensaio "$(cat supabase/migrations/20261015160000_tempos_dos_papeis_da_api.sql)
    $(cat supabase/ensaios/20261015160000_tempos_dos_papeis_da_api.sql)"

  Espera-se uma linha com tudo true.
*/
select
  (select rolconfig @> array['statement_timeout=8s', 'lock_timeout=3s', 'idle_in_transaction_session_timeout=15s']
     from pg_roles where rolname = 'authenticator') as authenticator_ok,
  (select rolconfig @> array['statement_timeout=8s'] from pg_roles where rolname = 'authenticated') as authenticated_ok,
  (select rolconfig @> array['statement_timeout=3s'] from pg_roles where rolname = 'anon') as anon_ok,
  (select rolconfig @> array['statement_timeout=30s'] from pg_roles where rolname = 'service_role') as service_role_ok;
