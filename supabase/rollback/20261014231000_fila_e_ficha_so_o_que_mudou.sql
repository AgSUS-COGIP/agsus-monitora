-- Desfaz 20261014231000_fila_e_ficha_so_o_que_mudou.sql: apaga as duas funções novas. Nenhuma
-- função de antes mudou, então nada volta. O front novo cai sozinho em obter_fila_avaliacao e
-- obter_ficha_analise quando a nova some (PGRST202): a fila volta a vir inteira a cada releitura
-- e a ficha volta a trazer a configuração da regra.
begin;

set local lock_timeout = '10s';

drop function if exists public.obter_fila_avaliacao_desde(uuid, timestamptz, text);
drop function if exists public.obter_ficha_analise_leve(uuid, text);

notify pgrst, 'reload schema';

commit;
