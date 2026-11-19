/*
  ROLLBACK de 20261119120000_concluir_editais_com_cronograma_encerrado.

  Remove as duas RPCs e a função da regra e devolve a CHECK da ação do histórico do cronograma ao
  que era (nome e definição de antes, copiados do retrato de 19/11/2026; ela não tinha COMMENT).

  O que fica: os status já marcados "Concluído" pela RPC (são o que o salvar do edital também
  gravaria). Se já houver registro com a ação 'status' no histórico, o rollback PARA: a CHECK antiga
  não o aceita, e o histórico (TH_) não se apaga. Nesse caso, desfaça só as funções (os três drop)
  e mantenha a CHECK nova.
*/

begin;

set local lock_timeout = '5s';

do $$
begin
  if to_regprocedure('public.concluir_editais_com_cronograma_encerrado(uuid[], text)') is null
     and not exists (select 1 from pg_constraint
                      where conrelid = 'public."TH_CRONOGRAMA_MONIT_INDIG"'::regclass
                        and conname = 'CK_HISTCRONOGRAMA_ACAO') then
    raise exception 'A migration 20261119120000 não está aplicada.';
  end if;
  if exists (select 1 from public."TH_CRONOGRAMA_MONIT_INDIG" where acao = 'status') then
    raise exception 'Há registro com a ação status no histórico do cronograma: a CHECK antiga não o aceita (desfaça só as funções).';
  end if;
end;
$$;

drop function if exists public.concluir_editais_com_cronograma_encerrado(uuid[], text);
drop function if exists public.listar_editais_com_cronograma_encerrado();
drop function if exists private."FC_RECUSA_CONCLUIR_EDITAL"(text, jsonb);

alter table public."TH_CRONOGRAMA_MONIT_INDIG" drop constraint if exists "CK_HISTCRONOGRAMA_ACAO";
alter table public."TH_CRONOGRAMA_MONIT_INDIG"
  add constraint monitoramento_indigena_cronograma_versoes_acao_check
  check ((acao = any (array['salvar'::text, 'errata'::text])));

commit;
