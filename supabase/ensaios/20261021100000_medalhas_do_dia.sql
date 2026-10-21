begin;
/*
  Ensaio de 20261021100000 (begin/rollback): cria o índice e a RPC, chama como
  usuário autenticado (conta do setor, Projetos) e mede o tempo. Nada fica
  gravado.
*/
\ir ../migrations/20261021100000_medalhas_do_dia.sql
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated"}', true);
explain (analyze, buffers) select public.obter_ritmo_da_analise('projetos');
select e -> 'destaques' from jsonb_array_elements(public.obter_ritmo_da_analise('projetos') -> 'editais') e;
rollback;
