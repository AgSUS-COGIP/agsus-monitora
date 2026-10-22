-- ROLLBACK de supabase/migrations/20261009160000_reiniciar_fichas_do_edital.sql
-- Apaga a RPC e a função do reinício e devolve as checagens do histórico das fichas à definição de
-- 20261007130000_conteudo_da_ficha.sql (sem a ação REINICIAR).
-- Só depois de nenhum reinício: o histórico não se apaga (FC_TG_FICHA_IMUTAVEL), então se já houver
-- linha REINICIAR o rollback recusa e nada muda — nesse caso, deixe a ação na checagem.
begin;

do $$
begin
  if exists (select 1 from public."TH_FICHA_ANALISE" where "TP_ACAO" = 'REINICIAR') then
    raise exception 'Já há reinício no histórico das fichas: o rollback não volta a checagem (nada mudou).';
  end if;
end;
$$;

drop function if exists public.reiniciar_fichas_do_edital(uuid, text);
drop function if exists private."FC_REINICIAR_FICHAS_DO_EDITAL"(uuid, text, uuid);

alter table public."TH_FICHA_ANALISE"
  drop constraint "CK_THFICHA_TPACAO",
  drop constraint "CK_THFICHA_MOTIVO",
  add constraint "CK_THFICHA_TPACAO" check ("TP_ACAO" in ('CRIAR', 'PEGAR', 'RESERVAR', 'LIBERAR', 'LIBERAR_RESERVA', 'DISTRIBUIR',
    'REDISTRIBUIR', 'DEVOLVER_FILA', 'REVISAR', 'SAIR_LOTE', 'VOLTAR_LOTE', 'SALVAR', 'CONCLUIR', 'REABRIR')),
  add constraint "CK_THFICHA_MOTIVO" check (
    "TP_ACAO" not in ('REDISTRIBUIR', 'DEVOLVER_FILA', 'LIBERAR_RESERVA', 'REVISAR', 'REABRIR')
    or length(btrim(coalesce("DS_MOTIVO", ''))) between 10 and 2000);
comment on column public."TH_FICHA_ANALISE"."TP_ACAO" is 'CRIAR, PEGAR (Pegar próximo), RESERVAR (abriu), LIBERAR (fechou), LIBERAR_RESERVA (a coordenação liberou a reserva de outra pessoa), DISTRIBUIR, REDISTRIBUIR, DEVOLVER_FILA, REVISAR, SAIR_LOTE, VOLTAR_LOTE, SALVAR (rascunho com alteração), CONCLUIR ou REABRIR.';
comment on column public."TH_FICHA_ANALISE"."DS_MOTIVO" is 'Motivo (obrigatório, 10 a 2.000, em redistribuir, devolver à fila, liberar a reserva de outra pessoa, mandar para revisão e reabrir; nas saídas e entradas do lote, o motivo da pré-classificação).';
comment on constraint "CK_THFICHA_TPACAO" on public."TH_FICHA_ANALISE" is 'Ações válidas.';
comment on constraint "CK_THFICHA_MOTIVO" on public."TH_FICHA_ANALISE" is 'Motivo de 10 a 2.000 caracteres nas ações que mexem no trabalho de outra pessoa e na reabertura.';

commit;
