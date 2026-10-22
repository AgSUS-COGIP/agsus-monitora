/*
  KPIs do edital recalculados DEPOIS da carga da Seleção.

  20260930235900 pôs o recálculo às 7h de Brasília, mas a carga da planilha da
  Seleção (.github/workflows/sincronizar-selecao.yml) roda às 9h (12h UTC) —
  os KPIs da Visão geral ficavam sempre com os números do dia anterior.
  Agora às 10h de Brasília (13h UTC; o pg_cron usa UTC): a carga é agendada
  às 9h, e o GitHub Actions costuma atrasar de 10 a 30 minutos.

  Rollback: supabase/rollback/20261002090000_kpis_depois_da_carga_da_selecao.sql
*/
begin;

select cron.alter_job(
  (select jobid from cron.job where jobname = 'agsus_kpis_do_edital_pela_selecao'),
  schedule => '0 13 * * *'
);

commit;
