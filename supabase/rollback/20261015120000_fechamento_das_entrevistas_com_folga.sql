/*
  ROLLBACK da migration 20261015120000_fechamento_das_entrevistas_com_folga.sql:
  a função volta a obedecer o statement_timeout de quem chama (8 s pelo PostgREST).
*/
alter function public.finalizar_sync_entrevistas(text, text, boolean)
  reset statement_timeout;
