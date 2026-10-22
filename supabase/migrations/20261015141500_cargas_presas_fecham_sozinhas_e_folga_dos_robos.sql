/*
  CARGAS PRESAS FECHAM SOZINHAS E FOLGA DE TEMPO DOS ROBÔS

  1. Folga dos robôs. Os robôs (GitHub Actions) chamam o banco pelo PostgREST
     com a chave service_role. O papel service_role não tinha statement_timeout
     próprio, então valia o do authenticator (8 s, o mesmo da tela) e as
     gravações grandes dos robôs estouravam em dias de banco carregado
     (57014 em 13 e 14/10: gravar_lote_empregare, gravar_pre_classificacao_vaga,
     pre_classificacao_ler_editais, finalizar_sync_entrevistas).
     O `set statement_timeout` na própria função (20261015120000) NÃO resolve:
     o limite de quem chamou continua valendo (ensaiado em 15/10: função com
     `set statement_timeout = '5s'` chamada sob 1 s é cancelada). O PostgREST
     aplica, a cada requisição, as configurações do papel assumido; por isso a
     folga vai no papel service_role (30 s). A tela (authenticated, 8 s) e o
     anon não mudam.

  2. Situação FALHOU nas cargas de planilha (TL_SYNC_ENTREVISTA e
     TL_SYNC_SELECAO). Uma carga cujo robô caiu no meio ficava EM_ANDAMENTO
     para sempre. Agora, ao abrir uma carga nova, as anteriores do mesmo escopo
     (mesma área nas entrevistas; a seleção é uma só) EM_ANDAMENTO há mais de
     3 h viram FALHOU, com a mensagem "Substituída pela carga X". As leituras
     (get_selecao_da_area, obter_ultima_conferencia,
     FC_MONTAR_ENTREVISTAS_AREA) só olham CONCLUIDA; os gatilhos de cache só
     agem em CONCLUIDA.

  Ensaio: supabase/ensaios/20261015141500_cargas_presas_fecham_sozinhas_e_folga_dos_robos.sql
  Rollback: supabase/rollback/20261015141500_cargas_presas_fecham_sozinhas_e_folga_dos_robos.sql
*/

-- 1. Folga dos robôs (papel service_role).
alter role service_role set statement_timeout = '30s';

-- 2. FALHOU nas cargas de planilha.
alter table public."TL_SYNC_ENTREVISTA" drop constraint "CK_SYNCENTREVISTA_TPSITUACAO";
alter table public."TL_SYNC_ENTREVISTA" add constraint "CK_SYNCENTREVISTA_TPSITUACAO"
  check ("TP_SITUACAO" = any (array['EM_ANDAMENTO', 'CONCLUIDA', 'RECUSADA', 'FALHOU']));
alter table public."TL_SYNC_SELECAO" drop constraint "CK_SYNCSELECAO_TPSITUACAO";
alter table public."TL_SYNC_SELECAO" add constraint "CK_SYNCSELECAO_TPSITUACAO"
  check ("TP_SITUACAO" = any (array['EM_ANDAMENTO', 'CONCLUIDA', 'RECUSADA', 'FALHOU']));

create or replace function private."FC_TG_FECHAR_CARGAS_PRESAS"()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if TG_TABLE_NAME = 'TL_SYNC_ENTREVISTA' then
    update public."TL_SYNC_ENTREVISTA" s
       set "TP_SITUACAO" = 'FALHOU',
           "DT_FIM" = coalesce(s."DT_FIM", now()),
           "DS_MENSAGEM" = concat_ws(' | ', nullif(s."DS_MENSAGEM", ''),
                                     'Substituída pela carga ' || NEW."CO_SYNC" || ' (ficou em andamento: o robô parou no meio).')
     where s."TP_SITUACAO" = 'EM_ANDAMENTO'
       and s."CO_SYNC" <> NEW."CO_SYNC"
       and s."CO_AREA" is not distinct from NEW."CO_AREA"
       and s."DT_INICIO" < now() - interval '3 hours';
  else
    update public."TL_SYNC_SELECAO" s
       set "TP_SITUACAO" = 'FALHOU',
           "DT_FIM" = coalesce(s."DT_FIM", now()),
           "DS_MENSAGEM" = concat_ws(' | ', nullif(s."DS_MENSAGEM", ''),
                                     'Substituída pela carga ' || NEW."CO_SYNC" || ' (ficou em andamento: o robô parou no meio).')
     where s."TP_SITUACAO" = 'EM_ANDAMENTO'
       and s."CO_SYNC" <> NEW."CO_SYNC"
       and s."DT_INICIO" < now() - interval '3 hours';
  end if;
  return null;
end;
$$;
revoke all on function private."FC_TG_FECHAR_CARGAS_PRESAS"() from public, anon, authenticated;

comment on function private."FC_TG_FECHAR_CARGAS_PRESAS"() is
  'Gatilho (20261015141500): ao abrir uma carga de planilha, marca FALHOU as anteriores do mesmo escopo (área, nas entrevistas) ainda EM_ANDAMENTO há mais de 3 h.';

drop trigger if exists "TG_SYNCENTREV_FECHAR_PRESAS" on public."TL_SYNC_ENTREVISTA";
create trigger "TG_SYNCENTREV_FECHAR_PRESAS"
  after insert on public."TL_SYNC_ENTREVISTA"
  for each row execute function private."FC_TG_FECHAR_CARGAS_PRESAS"();

drop trigger if exists "TG_SYNCSELECAO_FECHAR_PRESAS" on public."TL_SYNC_SELECAO";
create trigger "TG_SYNCSELECAO_FECHAR_PRESAS"
  after insert on public."TL_SYNC_SELECAO"
  for each row execute function private."FC_TG_FECHAR_CARGAS_PRESAS"();

-- O PostgREST relê as configurações dos papéis.
notify pgrst, 'reload config';
