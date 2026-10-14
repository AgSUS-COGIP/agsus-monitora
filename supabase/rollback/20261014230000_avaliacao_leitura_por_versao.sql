-- Desfaz 20261014230000_avaliacao_leitura_por_versao.sql: apaga as funções novas. Nenhuma
-- função de antes mudou, então nada volta. O front novo cai sozinho nas RPCs de sempre
-- (obter_pre_classificacao, obter_classificacao_do_edital, obter_regra_analise) quando a
-- nova some (PGRST202); o acompanhamento do Recalcular volta a reler o pacote inteiro.
begin;

set local lock_timeout = '10s';

drop function if exists public.obter_pre_classificacao_se_mudou(uuid, text);
drop function if exists public.obter_classificacao_do_edital_se_mudou(uuid, text);
drop function if exists public.obter_regra_analise_se_mudou(uuid, text);
drop function if exists public.obter_situacao_pre_classificacao(uuid);
drop function if exists private."FC_SE_MUDOU_EM_COLUNAS"(jsonb, text, text, text[]);
drop function if exists private."FC_COLUNAS_JSON"(jsonb, text[]);

notify pgrst, 'reload schema';

commit;
