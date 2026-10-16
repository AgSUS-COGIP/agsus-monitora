/* Rollback de 20261016150000: o resumo do Painel das análises volta a cada 15 minutos. */
select cron.alter_job(jobid, schedule := '*/15 * * * *')
  from cron.job where jobname = 'agsus_analises_cache_do_painel';
