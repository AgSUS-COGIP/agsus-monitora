/*
  RESUMO DO PAINEL DAS ANÁLISES A CADA 30 MINUTOS

  Em 16/10 o job agsus_analises_cache_do_painel passou de 15 min para uma vez
  por hora (20261016150000): com o banco sobrecarregado, cada remontagem levava
  ~80 s. Em 19/10, com o banco normal (Fila parcial, abas fora da análise
  desligadas), as remontagens de hora em hora levaram de 0 a 3 s. A pedido do
  usuário, passa a rodar a cada 30 min, nos minutos 20 e 50 (fora dos minutos
  dos outros caches), para os indicadores do Painel e o card "Ritmo da análise"
  ficarem no máximo meia hora atrás.
  Rollback: supabase/rollback/20261019180000_resumo_do_painel_a_cada_30_min.sql
*/
select cron.alter_job(jobid, schedule := '20,50 * * * *')
  from cron.job where jobname = 'agsus_analises_cache_do_painel';
