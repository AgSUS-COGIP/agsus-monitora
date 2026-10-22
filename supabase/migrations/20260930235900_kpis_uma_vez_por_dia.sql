/*
  KPIs do edital: uma vez por dia, não a cada 10 minutos.

  Os dados da Seleção (planilha "Auditoria") são atualizados uma vez por dia
  (decisão do usuário em 30/09/2026). O recálculo de 20260930235800 passa a
  rodar às 7h de Brasília (10h UTC; o pg_cron usa UTC), depois da carga da
  manhã. O antigo script de indicadores rodava às 6h.

  Rollback: supabase/rollback/20260930235900_kpis_uma_vez_por_dia.sql
*/
begin;

select cron.alter_job(
  (select jobid from cron.job where jobname = 'agsus_kpis_do_edital_pela_selecao'),
  schedule => '0 10 * * *'
);

commit;
