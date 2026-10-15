/*
  TEMPOS DOS PAPÉIS DA API NO PROJETO NOVO

  Em 15/10 o MONITORA passou para o projeto Supabase tabmkiokfuxyqjuvfiha por
  pg_dump/restore. As configurações de papel (ALTER ROLE ... SET) não vão no
  dump, e no projeto novo o authenticator voltou ao padrão da Supabase
  (lock_timeout 8 s, sem idle_in_transaction_session_timeout). No projeto
  antigo ele tinha lock 3 s e ociosidade em transação 15 s: uma requisição
  da tela presa esperando trava desiste em 3 s em vez de segurar a conexão do
  PostgREST por 8 s, e uma conexão esquecida aberta em transação cai em 15 s.

  Esta migração deixa no repositório os tempos de todos os papéis da API, para
  que uma nova cópia do banco não os perca de novo:
    authenticator  statement 8 s, lock 3 s, ociosidade em transação 15 s
    authenticated  statement 8 s (a tela)
    anon           statement 3 s
    service_role   statement 30 s (robôs; já em 20261015141500)

  Os tempos do authenticator valem para conexões novas do PostgREST; os do
  papel assumido (authenticated, anon, service_role) o PostgREST aplica a
  cada requisição.

  Ensaio: supabase/ensaios/20261015160000_tempos_dos_papeis_da_api.sql
  Rollback: supabase/rollback/20261015160000_tempos_dos_papeis_da_api.sql
*/

alter role authenticator set statement_timeout = '8s';
alter role authenticator set lock_timeout = '3s';
alter role authenticator set idle_in_transaction_session_timeout = '15s';
alter role authenticated set statement_timeout = '8s';
alter role anon set statement_timeout = '3s';
alter role service_role set statement_timeout = '30s';
