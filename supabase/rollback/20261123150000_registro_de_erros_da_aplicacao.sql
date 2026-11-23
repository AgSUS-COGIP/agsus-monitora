/*
  ROLLBACK de 20261123150000_registro_de_erros_da_aplicacao.

  Remove o que a migration criou: as duas RPCs, a limpeza e a tabela
  public."TL_ERRO_APLICACAO". A migration só criou objetos novos (nada foi
  trocado), então não há corpo antigo a restaurar.

  O que se perde: os erros registrados na tabela (log técnico, sem dado pessoal,
  guardado no máximo 180 dias). Se quiser guardá-los, exporte antes:
    select * from public."TL_ERRO_APLICACAO" order by "DT_REGISTRO";

  Volte o front antes, ou junto: sem a RPC, o navegador recebe PGRST202, ignora
  em silêncio e para de tentar naquela página (não quebra nada).

  Depois, tire o registro:
    delete from public.migracoes_aplicadas
     where caminho = 'migrations/20261123150000_registro_de_erros_da_aplicacao.sql';
*/
begin;

set local lock_timeout = '5s';

do $$
begin
  if to_regclass('public."TL_ERRO_APLICACAO"') is null
     or to_regprocedure('public.registrar_erro_da_aplicacao(text, text, text, text, jsonb, text, text, integer)') is null
     or to_regprocedure('public.listar_erros_da_aplicacao(text, text, timestamp with time zone, integer)') is null
     or to_regprocedure('private."FC_LIMPAR_TEXTO_ERRO"(text, integer)') is null then
    raise exception 'A migration 20261123150000 não está aplicada por inteiro; confira o banco antes do rollback.';
  end if;
end;
$$;

drop function public.listar_erros_da_aplicacao(text, text, timestamp with time zone, integer);
drop function public.registrar_erro_da_aplicacao(text, text, text, text, jsonb, text, text, integer);
drop function private."FC_LIMPAR_TEXTO_ERRO"(text, integer);
drop table public."TL_ERRO_APLICACAO";

commit;
