/*
  ROLLBACK de 20261111180000_status_em_lote_dos_aprovados.sql
  Tira public.alterar_status_candidatos_aprovados. O que ela mudou fica (com o
  histórico em TH_CANDIDATO_APROVADO); a tela volta a mudar um candidato por vez.
*/
begin;

set local lock_timeout = '5s';

do $guarda$
begin
  if to_regprocedure('public.alterar_status_candidatos_aprovados(uuid[], text, date)') is null then
    raise exception 'A migration 20261111180000 não está aplicada: nada a desfazer.';
  end if;
end;
$guarda$;

drop function public.alterar_status_candidatos_aprovados(uuid[], text, date);

commit;
