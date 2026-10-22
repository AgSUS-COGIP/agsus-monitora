/*
  ENSAIO da migration 20261015120000_fechamento_das_entrevistas_com_folga.sql — begin … rollback.

  NÃO É MIGRATION. Rode depois da migration, na mesma transação, e desfaça.
  Leve: só lê o catálogo, não chama a função nem toca tabela.

  Espera: proconfig com statement_timeout=30s e search_path vazio; só
  service_role executa.
*/
select p.proconfig,
       has_function_privilege('service_role', p.oid, 'execute') as service_role,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
       has_function_privilege('anon', p.oid, 'execute') as anon
  from pg_proc p
 where p.oid = 'public.finalizar_sync_entrevistas(text, text, boolean)'::regprocedure;
