/* Rollback de 20261015141500: tira a folga do service_role, os gatilhos e a situação FALHOU (as cargas FALHOU voltam a RECUSADA). */
alter role service_role reset statement_timeout;
drop trigger if exists "TG_SYNCENTREV_FECHAR_PRESAS" on public."TL_SYNC_ENTREVISTA";
drop trigger if exists "TG_SYNCSELECAO_FECHAR_PRESAS" on public."TL_SYNC_SELECAO";
drop function if exists private."FC_TG_FECHAR_CARGAS_PRESAS"();
update public."TL_SYNC_ENTREVISTA" set "TP_SITUACAO" = 'RECUSADA' where "TP_SITUACAO" = 'FALHOU';
update public."TL_SYNC_SELECAO" set "TP_SITUACAO" = 'RECUSADA' where "TP_SITUACAO" = 'FALHOU';
alter table public."TL_SYNC_ENTREVISTA" drop constraint "CK_SYNCENTREVISTA_TPSITUACAO";
alter table public."TL_SYNC_ENTREVISTA" add constraint "CK_SYNCENTREVISTA_TPSITUACAO"
  check ("TP_SITUACAO" = any (array['EM_ANDAMENTO', 'CONCLUIDA', 'RECUSADA']));
alter table public."TL_SYNC_SELECAO" drop constraint "CK_SYNCSELECAO_TPSITUACAO";
alter table public."TL_SYNC_SELECAO" add constraint "CK_SYNCSELECAO_TPSITUACAO"
  check ("TP_SITUACAO" = any (array['EM_ANDAMENTO', 'CONCLUIDA', 'RECUSADA']));
notify pgrst, 'reload config';
