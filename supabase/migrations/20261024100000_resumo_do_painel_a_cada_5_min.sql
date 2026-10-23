/*
  RESUMO DO PAINEL DAS ANÁLISES A CADA 5 MINUTOS

  Desde 19/10 (20261019180000) o job agsus_analises_cache_do_painel roda nos
  minutos 20 e 50. Cada rodada só remonta a área marcada como desatualizada
  (private."FC_CACHE_DESATUALIZADO": a marca em private."TL_ALTERACAO_CACHE"
  vem do gatilho FC_TG_CACHE_ANALISE a cada insert/update/delete em
  TB_ANALISE_CURRICULAR, o que toda carga processada de TL_SYNC_ANALISE faz)
  ou com pacote de mais de 24 h; sem marca, a conferência custa milissegundos
  (ensaio em supabase/ensaios/). Passa a rodar a cada 5 min: a carga que chega
  aparece no Painel e no card "Ritmo da análise" em até 5 min, e não em até
  meia hora. A remontagem de verdade continua só quando há marca, uma rodada
  de cada vez (trava consultiva em PR_REMONTAR_CACHE_AGENDADO).
  Só muda a agenda: a chave "Pacotes dos painéis" (TB_CHAVE_AUTOMACAO) segue
  ligando e desligando o job (cron.alter_job não mexe em active).
  Rollback: supabase/rollback/20261024100000_resumo_do_painel_a_cada_5_min.sql
*/
begin;

set local lock_timeout = '5s';

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'agsus_analises_cache_do_painel') then
    raise exception 'Aplique antes 20261022185000_falha_do_cache_aparece_no_status.sql (o job agsus_analises_cache_do_painel não existe).';
  end if;
end;
$$;

select cron.alter_job(jobid, schedule := '*/5 * * * *')
  from cron.job where jobname = 'agsus_analises_cache_do_painel';

commit;
