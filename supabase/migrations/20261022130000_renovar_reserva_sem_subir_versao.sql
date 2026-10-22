/*
  Renovar a reserva vencida sem subir a versão da ficha.

  Por quê: a ficha aberta renova a reserva a cada 5 minutos (renovar_reserva).
  Se a reserva venceu (aba dormindo, rede caída), a renovação re-reserva para
  o mesmo responsável por private."FC_RESERVAR_FICHA", que soma 1 em
  NU_VERSAO. A tela aberta continua com a versão de antes e o próximo
  rascunho volta com "Esta ficha mudou…" (PT409), perdendo o que não foi
  salvo — sem ninguém ter mexido na ficha.

  O que muda: só o ramo de re-reserva de public.renovar_reserva(p_ficha).
  Quando a reserva venceu e quem pede é o responsável, a ficha é reservada de
  novo sem tocar em NU_VERSAO; a versão só sobe se a situação mudar
  (PENDENTE → EM_ANALISE). O histórico continua registrando RESERVAR.
  FC_RESERVAR_FICHA não muda (reservar_ficha e pegar_proxima seguem iguais).

  Conflito real continua: se outra pessoa salvou a ficha no intervalo, a
  versão já subiu com o salvamento dela, e o rascunho de quem renovou volta
  com PT409, como antes. A assinatura e a resposta da RPC são as mesmas, então
  o front de hoje funciona igual com ela.

  Ensaio: supabase/ensaios/20261022130000_renovar_reserva_sem_subir_versao.sql
  Rollback: supabase/rollback/20261022130000_renovar_reserva_sem_subir_versao.sql
*/
begin;

set local lock_timeout = '5s';

create or replace function public.renovar_reserva(p_ficha uuid)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_f public."TB_FICHA_ANALISE";
  v_uid uuid := (select auth.uid());
  v_area text;
begin
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha;
  if v_f."CO_FICHA_ANALISE" is null then
    raise exception 'Ficha não encontrada' using errcode = '22023';
  end if;
  v_area := private."FC_EXIGIR_AVALIACAO_EDITAL"(v_f."CO_MONITORAMENTO", 2);
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha for update;
  if v_f."CO_USUARIO_RESERVA" = v_uid and v_f."DT_RESERVA_EXPIRA" > now() then
    -- Renovar não muda a versão nem vai ao histórico.
    update public."TB_FICHA_ANALISE" set "DT_RESERVA_EXPIRA" = now() + private."FC_PRAZO_RESERVA_FICHA"()
     where "CO_FICHA_ANALISE" = p_ficha;
  elsif (v_f."DT_RESERVA_EXPIRA" is null or v_f."DT_RESERVA_EXPIRA" <= now())
        and v_f."CO_USUARIO_RESPONSAVEL" = v_uid and v_f."TP_SITUACAO" in ('PENDENTE', 'EM_ANALISE')
        and private."FC_PODE_ANALISAR_VAGA"(v_f."CO_MONITORAMENTO", v_uid, v_f."CO_VAGA") then
    -- Reserva vencida, mesmo responsável: reserva de novo sem subir a versão
    -- (a tela aberta segue salvando). Só PENDENTE → EM_ANALISE sobe.
    update public."TB_FICHA_ANALISE" set
      "DT_ATRIBUICAO" = coalesce("DT_ATRIBUICAO", now()),
      "TP_SITUACAO" = case when "TP_SITUACAO" = 'PENDENTE' then 'EM_ANALISE' else "TP_SITUACAO" end,
      "CO_USUARIO_RESERVA" = v_uid, "DT_RESERVA" = now(),
      "DT_RESERVA_EXPIRA" = now() + private."FC_PRAZO_RESERVA_FICHA"(),
      "NU_VERSAO" = "NU_VERSAO" + case when "TP_SITUACAO" = 'PENDENTE' then 1 else 0 end,
      "DT_ATUALIZACAO" = now()
     where "CO_FICHA_ANALISE" = p_ficha;
    perform private."FC_HISTORICO_FICHA"(p_ficha, 'RESERVAR', v_f."TP_SITUACAO", v_f."CO_USUARIO_RESPONSAVEL", null, v_uid);
  else
    raise exception 'A ficha não está mais com você (reserva liberada ou com outra pessoa); abra de novo.' using errcode = 'PT409';
  end if;
  return json_build_object('ficha', private."FC_FICHA_ANALISE_JSON"(p_ficha));
end;
$function$;

comment on function public.renovar_reserva(uuid) is
  'Renova por mais 15 minutos a reserva de quem está com a ficha aberta (sem mudar a versão). Reserva vencida e ninguém no lugar: o responsável reserva de novo, também sem mudar a versão (só PENDENTE → EM_ANALISE sobe). Com outra pessoa ou liberada pela coordenação: PT409. Exige Editor no edital da ficha.';

commit;
