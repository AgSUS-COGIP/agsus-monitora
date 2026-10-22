/*
  Rollback de 20261022154000_limpeza_do_manifesto_das_analises.sql.
  Tira a tarefa e a função. O manifesto apagado não volta (era de syncs já
  encerrados; o próximo sync grava o seu).
*/
begin;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'agsus_analises_limpar_manifesto') then
    perform cron.unschedule('agsus_analises_limpar_manifesto');
  end if;
end;
$$;

drop function if exists private."FC_LIMPAR_MANIFESTO_ANALISE"(integer);

commit;
