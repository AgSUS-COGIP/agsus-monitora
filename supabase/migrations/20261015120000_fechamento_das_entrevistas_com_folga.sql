/*
  FECHAMENTO DAS ENTREVISTAS COM FOLGA DE TEMPO

  `finalizar_sync_entrevistas` roda de hora em hora pelo robô (só service_role
  executa) e leva em média 5,7 s (pg_stat_statements desde 02/10/2026: 188
  chamadas, máximo 7,76 s). O PostgREST corta em 8 s (statement_timeout do
  authenticator), e foi o que aconteceu em 13/10 18h05 e 14/10 12h05: o robô
  saiu com "57014: canceling statement due to statement timeout" e a carga
  ficou EM_ANDAMENTO para sempre em TL_SYNC_ENTREVISTA (a transação inteira
  desfaz; nada foi desativado nem religado).

  A função recalcula, em conjunto, a ligação de ~4 mil entrevistas com o edital
  e a análise curricular; o tempo depende da carga do banco no momento, e às
  vezes passa dos 8 s. Mesma solução de `finalizar_sync_analises_incremental`:
  limite próprio da função (30 s), que vale só para ela. A tela não chama esta
  função (sem grant para authenticated/anon), então nenhum usuário espera 30 s.

  Só muda a configuração da função: corpo, assinatura e grants ficam iguais.
*/
alter function public.finalizar_sync_entrevistas(text, text, boolean)
  set statement_timeout = '30s';
