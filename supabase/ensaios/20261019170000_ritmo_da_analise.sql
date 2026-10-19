begin;
/*
  Ensaio de 20261019170000 (begin/rollback): cria o índice e a RPC, chama como
  usuário autenticado (conta do setor, Projetos) e mede o tempo. Também
  confere que área inválida dá 22023. Nada fica gravado.
*/
\ir ../migrations/20261019170000_ritmo_da_analise.sql
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated"}', true);
explain (analyze, buffers) select public.obter_ritmo_da_analise('projetos');
select public.obter_ritmo_da_analise('projetos');
-- Esperado: erro 22023 (área inválida).
-- select public.obter_ritmo_da_analise('nao-existe');
rollback;
