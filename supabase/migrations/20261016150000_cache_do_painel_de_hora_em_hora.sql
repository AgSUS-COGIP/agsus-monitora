/*
  RESUMO DO PAINEL DAS ANÁLISES DE HORA EM HORA

  O job agsus_analises_cache_do_painel remontava o resumo do Painel das
  análises a cada 15 min. Com as fichas do 114/2026 sendo concluídas (cada uma
  marca o cache), cada remontagem levou ~80 s no NANO e, enquanto rodava, telas
  da equipe (salvar rascunho da ficha, Visão geral, Monitoramento operacional,
  Entrevistas) chegaram perto do limite de 8 s (16/10/2026, 10h45).
  A pedido do usuário, passa a rodar uma vez por hora, no minuto 20 (fora dos
  minutos dos outros caches, 5/10 a cada 15). O Painel pode mostrar uma ficha
  concluída até ~1 h depois; a linha do candidato em TB_ANALISE_CURRICULAR
  continua atualizada na hora.
  Rollback: supabase/rollback/20261016150000_cache_do_painel_de_hora_em_hora.sql
*/
select cron.alter_job(jobid, schedule := '20 * * * *')
  from cron.job where jobname = 'agsus_analises_cache_do_painel';
