/*
  Rollback de 20261022130000_renovar_reserva_sem_subir_versao.sql.

  Volta public.renovar_reserva à definição de
  20261016160000_conflito_de_versao_sem_repeticao.sql: a re-reserva da
  reserva vencida passa de novo por private."FC_RESERVAR_FICHA" (a versão
  sobe) e o comentário volta ao de antes. Nada de dados a desfazer.
*/
begin;

set local lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.renovar_reserva(p_ficha uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    perform private."FC_RESERVAR_FICHA"(p_ficha, v_uid, 'RESERVAR');
  else
    raise exception 'A ficha não está mais com você (reserva liberada ou com outra pessoa); abra de novo.' using errcode = 'PT409';
  end if;
  return json_build_object('ficha', private."FC_FICHA_ANALISE_JSON"(p_ficha));
end;
$function$;

comment on function public.renovar_reserva(uuid) is
  'Renova por mais 15 minutos a reserva de quem está com a ficha aberta (sem mudar a versão). Reserva vencida e ninguém no lugar: o responsável reserva de novo. Com outra pessoa ou liberada pela coordenação: 40001. Exige Editor no edital da ficha.';

commit;
