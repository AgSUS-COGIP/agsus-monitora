/* Rollback de 20261024100000: o resumo do Painel das análises volta aos minutos 20 e 50 (a cada 30 min). */
begin;

select cron.alter_job(jobid, schedule := '20,50 * * * *')
  from cron.job where jobname = 'agsus_analises_cache_do_painel';

commit;
