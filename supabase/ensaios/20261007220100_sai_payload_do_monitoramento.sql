/*
  ENSAIO de 20261007220100_sai_payload_do_monitoramento.sql — begin … rollback.

  Cole no SQL Editor do Supabase (papel postgres). Confere que a função sai e
  que nenhuma outra função do banco a citava. Termina em ROLLBACK.
*/
begin;

drop function public.get_monitoramento_dashboard_payload();

select to_regprocedure('public.get_monitoramento_dashboard_payload()') is null as saiu,
       (select count(*) from pg_proc p
         where p.prosrc like '%get_monitoramento_dashboard_payload%') as citada_por;

rollback;
