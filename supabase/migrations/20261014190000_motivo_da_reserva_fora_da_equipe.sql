/*
  MOTIVO DA ABERTURA SÓ PARA LEITURA: QUEM NÃO ESTÁ NA EQUIPE DA VAGA

  Por quê (varredura de bugs, 14/10/2026): no 114/2026 a distribuição é
  "Pegar próximo". Quem abre uma ficha livre sem ser analista daquela vaga
  (coordenação, analista de outra vaga ou alguém tirado da equipe) via
  "Só leitura: Ficha livre: a coordenação distribui as fichas deste edital." —
  falso: neste edital ninguém distribui, a ficha é livre para a equipe da vaga.
  E o responsável tirado da equipe via "Ficha de outra pessoa.", sendo dele.

  O que muda: só o texto do motivo em reservar_ficha. Quem reserva, a reserva,
  o registro de acesso e o retorno continuam iguais.
    - ficha de outra pessoa → "Ficha de outra pessoa." (como antes);
    - fora da equipe da vaga (FC_PODE_ANALISAR_VAGA falso) →
      "Você não está na equipe de análise desta vaga.";
    - livre num edital em que a coordenação distribui → texto de antes.

  Ensaio: supabase/ensaios/20261014190000_motivo_da_reserva_fora_da_equipe.sql
  Rollback: supabase/rollback/20261014190000_motivo_da_reserva_fora_da_equipe.sql
*/
begin;

CREATE OR REPLACE FUNCTION public.reservar_ficha(p_ficha uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_f public."TB_FICHA_ANALISE";
  v_uid uuid := (select auth.uid());
  v_area text;
  v_dist jsonb;
  v_reservada boolean := false;
  v_motivo text;
begin
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha;
  if v_f."CO_FICHA_ANALISE" is null then
    raise exception 'Ficha não encontrada' using errcode = '22023';
  end if;
  v_area := private."FC_EXIGIR_AVALIACAO_EDITAL"(v_f."CO_MONITORAMENTO", 1);
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha for update;
  v_dist := private."FC_DISTRIBUICAO_DO_EDITAL"(v_f."CO_MONITORAMENTO");

  if v_f."TP_SITUACAO" in ('CONCLUIDA', 'FORA_LOTE', 'REVISAR') then
    v_motivo := case v_f."TP_SITUACAO" when 'CONCLUIDA' then 'Ficha concluída.' when 'FORA_LOTE' then 'Fora do lote.'
                                       else 'Ficha em revisão.' end;
  elsif v_f."DT_RESERVA_EXPIRA" > now() and v_f."CO_USUARIO_RESERVA" <> v_uid then
    v_motivo := 'Em uso por outra pessoa.';
  elsif v_f."CO_USUARIO_RESPONSAVEL" = v_uid
        and private."FC_PODE_ANALISAR_VAGA"(v_f."CO_MONITORAMENTO", v_uid, v_f."CO_VAGA") then
    perform private."FC_RESERVAR_FICHA"(p_ficha, v_uid, 'RESERVAR');
    v_reservada := true;
  elsif v_f."CO_USUARIO_RESPONSAVEL" is null
        and (v_dist ->> 'modo' = 'PEGAR_PROXIMO' or v_dist ->> 'novos' = 'PEGAR_PROXIMO')
        and private."FC_PODE_ANALISAR_VAGA"(v_f."CO_MONITORAMENTO", v_uid, v_f."CO_VAGA") then
    perform private."FC_RESERVAR_FICHA"(p_ficha, v_uid, 'PEGAR');
    v_reservada := true;
  else
    v_motivo := case
                  when v_f."CO_USUARIO_RESPONSAVEL" is not null and v_f."CO_USUARIO_RESPONSAVEL" <> v_uid
                    then 'Ficha de outra pessoa.'
                  when not private."FC_PODE_ANALISAR_VAGA"(v_f."CO_MONITORAMENTO", v_uid, v_f."CO_VAGA")
                    then 'Você não está na equipe de análise desta vaga.'
                  else 'Ficha livre: a coordenação distribui as fichas deste edital.'
                end;
  end if;

  insert into public."TL_ACESSO_FICHA_ANALISE" ("CO_FICHA_ANALISE", "TP_ACESSO", "CO_USUARIO") values (p_ficha, 'ABRIR_FICHA', v_uid);
  return json_build_object('ficha', private."FC_FICHA_ANALISE_JSON"(p_ficha), 'reservada', v_reservada,
                           'somente_leitura', not v_reservada, 'motivo', v_motivo);
end;
$function$;
comment on function public.reservar_ficha(uuid) is
  'Abre a ficha: o responsável (ou um analista da vaga que pega uma livre, quando a regra deixa) fica com a reserva por 15 minutos; quem abre uma ficha em uso, de outra pessoa, concluída, em revisão ou fora do lote vê só para leitura, com o motivo e o "Em uso por … desde …" (AM-12.2). Registra o acesso (TL_ACESSO_FICHA_ANALISE). Exige avaliacao_documental >= leitor no edital da ficha.';
revoke all on function public.reservar_ficha(uuid) from public, anon;
grant execute on function public.reservar_ficha(uuid) to authenticated;

commit;
