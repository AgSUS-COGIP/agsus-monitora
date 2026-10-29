/*
  ROLLBACK de 20261029121700_navegacao_e_inicio_da_sessao_numa_chamada.sql

  Tira as duas funções. O front publicado volta sozinho às chamadas de antes (PGRST202:
  registrar_evento_acesso + registrar_presenca_monitora e as cinco consultas da entrada).
  Nada de dado a desfazer: as funções só chamam as que já existiam.
*/
begin;

set local lock_timeout = '5s';

drop function if exists public.obter_inicio_da_sessao();
drop function if exists public.registrar_navegacao_monitora(text, text, jsonb, text, text, text, text, boolean, text);

commit;
