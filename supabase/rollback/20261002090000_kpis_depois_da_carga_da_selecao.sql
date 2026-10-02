-- Desfaz 20261002090000 (volta o recálculo dos KPIs para as 7h de Brasília).
begin;
select cron.alter_job(
  (select jobid from cron.job where jobname = 'agsus_kpis_do_edital_pela_selecao'),
  schedule => '0 10 * * *'
);
commit;
