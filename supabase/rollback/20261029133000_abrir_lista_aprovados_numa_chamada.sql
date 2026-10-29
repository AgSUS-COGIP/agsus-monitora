/*
  ROLLBACK de 20261029133000_abrir_lista_aprovados_numa_chamada.sql

  Tira a função. O front publicado volta sozinho às chamadas de antes (PGRST202): as RPCs da
  abertura continuam no banco. Nada de dado a desfazer.
*/
begin;

set local lock_timeout = '5s';

drop function if exists public.abrir_lista_aprovados(text, text, boolean);

commit;
