/* Rollback de 20261019180000: o resumo do Painel das análises volta a uma vez por hora (minuto 20). */
select cron.alter_job(jobid, schedule := '20 * * * *')
  from cron.job where jobname = 'agsus_analises_cache_do_painel';
