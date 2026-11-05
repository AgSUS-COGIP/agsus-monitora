/*
  Fontes das leituras depois da 20261105170000_leitura_da_api_de_editais.sql (05/11/2026)

  A 20261105170000 trocou public.get_monitoramento_cronograma_estado, que faz parte do fecho
  das leituras em cache (fila_avaliacao e monitoramento_operacional, desde 20261103171500),
  mas não recalculou as fontes. Sem isso, a leitura em cache continua comparando com a
  assinatura antiga das funções. Esta migration só roda o recálculo — nenhuma função muda.

  recalcula fontes de 20261105170000_leitura_da_api_de_editais.sql
*/
begin;

select private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"();
notify pgrst, 'reload schema';

commit;
