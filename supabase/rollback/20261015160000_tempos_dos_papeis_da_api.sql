/* Rollback de 20261015160000: o authenticator volta ao padrão da Supabase (lock 8 s, sem ociosidade em transação). Os statement_timeout ficam (já existiam antes). */
alter role authenticator set lock_timeout = '8s';
alter role authenticator reset idle_in_transaction_session_timeout;
