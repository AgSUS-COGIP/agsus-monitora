/*
  TAREFAS AGENDADAS (pg_cron) COM OS NOMES NOVOS DAS TABELAS

  A padronização MAD (20260918160000) renomeou as tabelas, mas os dois jobs do
  pg_cron guardam o comando como texto e continuaram com os nomes antigos:

    - agsus_analises_analyze_diario falhava todo dia desde 20/09
      ("relation public.analises_staging does not exist");
    - agsus_eventos_acesso_limpeza_mensal falharia em 01/10
      ("truncate public.eventos_acesso"), e TL_EVENTO_ACESSO só cresceria.

  A limpeza mensal também muda de TRUNCATE para "apagar o que tem mais de 30
  dias": o truncate zerava o histórico de acessos de Configurações todo dia 1º.
  30 dias é o mesmo padrão de public.limpar_eventos_acesso_antigos.

  Os jobs não tinham sido criados por migration; aqui passam a ser. Se não
  existirem, são criados; se existirem, só o comando muda.

  ROLLBACK (volta aos comandos antigos, que falham):
    select cron.alter_job(jobid, command => 'truncate table public.eventos_acesso restart identity;')
      from cron.job where jobname = 'agsus_eventos_acesso_limpeza_mensal';
*/
begin;

do $$
declare
  v_limpeza constant text :=
    'delete from public."TL_EVENTO_ACESSO" where created_at < now() - interval ''30 days'';';
  v_analyze constant text :=
    'analyze public."TM_ANALISE_CURRICULAR"; analyze public."TL_SYNC_ANALISE"; '
    || 'analyze public."TB_ANALISE_CURRICULAR"; analyze public."TB_EDITAL_ANALISE";';
  v_id bigint;
begin
  select jobid into v_id from cron.job where jobname = 'agsus_eventos_acesso_limpeza_mensal';
  if v_id is null then
    perform cron.schedule('agsus_eventos_acesso_limpeza_mensal', '0 6 1 * *', v_limpeza);
  else
    perform cron.alter_job(v_id, command => v_limpeza);
  end if;

  select jobid into v_id from cron.job where jobname = 'agsus_analises_analyze_diario';
  if v_id is null then
    perform cron.schedule('agsus_analises_analyze_diario', '20 6 * * *', v_analyze);
  else
    perform cron.alter_job(v_id, command => v_analyze);
  end if;
end;
$$;

commit;
