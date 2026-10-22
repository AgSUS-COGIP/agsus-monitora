-- Volta o recálculo dos KPIs para a cada 10 minutos.
begin;
select cron.alter_job((select jobid from cron.job where jobname = 'agsus_kpis_do_edital_pela_selecao'), schedule => '3-59/10 * * * *');
commit;
