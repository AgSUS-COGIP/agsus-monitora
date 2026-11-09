-- ATENCAO: desfazer esta politica retira a restricao por edital do Storage.
-- Usar somente em recuperacao autorizada, com uma protecao substituta.
-- Nao altera ou apaga documentos; nao executar como limpeza de rotina.
begin;
set local lock_timeout = '3s';
drop policy if exists "PL_STORAGE_LISTAS_ESCOPO_EDITAL" on storage.objects;
commit;
