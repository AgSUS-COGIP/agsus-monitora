/*
  REINICIAR AS FICHAS VOLTA AO INÍCIO TODA FICHA INICIADA

  Por quê (auditoria da avaliação documental, 13/10/2026): o reinício
  (20261009160000) decidia "já está no início" só pelos campos da ficha e
  pulava toda ficha FORA_LOTE. O refazer do lote (20261013110000/170000) usa
  outra régua, FC_FICHA_INICIADA: campos OU histórico depois do último
  REINICIAR. Resultado, reproduzido em ensaio no 93/2026:
    - ficha distribuída e devolvida à fila (DEVOLVER_FILA): campos limpos,
      então o reinício a contava como "já no início" e não gravava REINICIAR;
      o histórico (DISTRIBUIR, DEVOLVER_FILA) seguia contando como iniciada;
    - ficha iniciada que saiu do lote (FC_ABRIR_FICHAS deixa FORA_LOTE com
      responsável e rascunho): o reinício pulava, e ela seguia iniciada.
  Depois do reinício, FC_FICHAS_INICIADAS continuava > 0 e o refazer do lote
  ficava recusado para sempre.

  Agora a régua é uma só: o reinício pula só a ficha que FC_FICHA_INICIADA diz
  que não foi iniciada. A ficha iniciada do lote volta a PENDENTE, como antes.
  A ficha iniciada FORA_LOTE continua FORA_LOTE (com o motivo da saída), mas
  perde o responsável, a reserva e o conteúdo da análise e ganha o REINICIAR.
  Nada se apaga; regra, decisões, pré-classificação, Classificação e análises
  não são tocadas.

  Ensaio: supabase/ensaios/20261013180000_reinicio_volta_toda_ficha_iniciada.sql
  Rollback: supabase/rollback/20261013180000_reinicio_volta_toda_ficha_iniciada.sql
*/
begin;

create or replace function private."FC_REINICIAR_FICHAS_DO_EDITAL"(p_edital uuid, p_motivo text, p_usuario uuid)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_f public."TB_FICHA_ANALISE";
  v_para text;
  v_antes jsonb := '{}'::jsonb;
  v_reiniciadas integer := 0;
  v_no_inicio integer := 0;
  v_fora integer := 0;
begin
  if length(v_motivo) not between 10 and 2000 then
    raise exception 'Informe o motivo para reiniciar as fichas (10 a 2.000 caracteres).' using errcode = '22023';
  end if;
  if p_usuario is null or not exists (
       select 1 from public."TB_PERFIL_USUARIO" p
         join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
        where p.user_id = p_usuario and p.ativo is true and a."ST_ADMIN_GLOBAL") then
    raise exception 'Só o administrador global reinicia as fichas do edital' using errcode = '42501';
  end if;
  -- Trava o edital: ninguém abre fichas novas dele enquanto o reinício corre.
  perform 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital for update;
  if not found then
    raise exception 'Edital não encontrado' using errcode = '22023';
  end if;

  for v_f in
    select * from public."TB_FICHA_ANALISE" f
     where f."CO_MONITORAMENTO" = p_edital
     order by f."CO_FICHA_ANALISE"
       for update
  loop
    -- A mesma régua do refazer do lote: campos ou histórico depois do último REINICIAR.
    if not private."FC_FICHA_INICIADA"(v_f) then
      if v_f."TP_SITUACAO" = 'FORA_LOTE' then
        v_fora := v_fora + 1;
      else
        v_no_inicio := v_no_inicio + 1;
      end if;
      continue;
    end if;
    -- Fora do lote continua fora (com o motivo da saída); o resto volta a PENDENTE.
    v_para := case when v_f."TP_SITUACAO" = 'FORA_LOTE' then 'FORA_LOTE' else 'PENDENTE' end;

    update public."TB_FICHA_ANALISE" set
      "TP_SITUACAO" = v_para,
      "CO_USUARIO_RESPONSAVEL" = null, "DT_ATRIBUICAO" = null,
      "CO_USUARIO_RESERVA" = null, "DT_RESERVA" = null, "DT_RESERVA_EXPIRA" = null,
      "DS_LANCAMENTO" = null, "DS_RESULTADO" = null, "DS_PARECER" = null, "TP_RESULTADO" = null,
      "VL_NOTA_APURADA" = null, "VL_NOTA_FINAL" = null,
      "CO_USUARIO_RASCUNHO" = null, "DT_RASCUNHO" = null,
      "CO_USUARIO_CONCLUSAO" = null, "DT_CONCLUSAO" = null,
      "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
     where "CO_FICHA_ANALISE" = v_f."CO_FICHA_ANALISE";

    insert into public."TH_FICHA_ANALISE"
      ("CO_FICHA_ANALISE", "NU_VERSAO", "TP_ACAO", "TP_SITUACAO_ANTERIOR", "TP_SITUACAO", "CO_USUARIO_RESP_ANTERIOR",
       "CO_USUARIO_RESPONSAVEL", "DS_MOTIVO", "TP_ORIGEM", "CO_USUARIO", "TP_RESULTADO", "VL_NOTA_FINAL", "DS_ALTERACAO")
    select v_f."CO_FICHA_ANALISE", v_f."NU_VERSAO" + 1, 'REINICIAR', v_f."TP_SITUACAO", v_para,
           v_f."CO_USUARIO_RESPONSAVEL", null, v_motivo, 'TELA', p_usuario, null, null,
           coalesce(jsonb_agg(jsonb_build_object('campo', a.campo, 'de', a.de, 'para', a.para) order by a.ordem), '[]'::jsonb)
      from (values
              (1, 'situacao', to_jsonb(v_f."TP_SITUACAO"), to_jsonb(v_para)),
              (2, 'responsavel', to_jsonb(v_f."CO_USUARIO_RESPONSAVEL"), null),
              (3, 'reserva', to_jsonb(v_f."CO_USUARIO_RESERVA"), null),
              (4, 'resultado', to_jsonb(v_f."TP_RESULTADO"), null),
              (5, 'nota_apurada', to_jsonb(v_f."VL_NOTA_APURADA"), null),
              (6, 'nota_final', to_jsonb(v_f."VL_NOTA_FINAL"), null),
              (7, 'lancamento', v_f."DS_LANCAMENTO", null),
              (8, 'resultado_da_conta', v_f."DS_RESULTADO", null),
              (9, 'parecer', to_jsonb(v_f."DS_PARECER"), null),
              (10, 'rascunho', to_jsonb(v_f."DT_RASCUNHO"), null),
              (11, 'conclusao', to_jsonb(v_f."DT_CONCLUSAO"), null)
           ) as a(ordem, campo, de, para)
     where a.de is distinct from a.para;

    v_reiniciadas := v_reiniciadas + 1;
    v_antes := jsonb_set(v_antes, array[v_f."TP_SITUACAO"]::text[],
                         to_jsonb(coalesce((v_antes ->> v_f."TP_SITUACAO")::integer, 0) + 1));
  end loop;

  return json_build_object('edital', p_edital, 'reiniciadas', v_reiniciadas, 'por_situacao_anterior', v_antes,
                           'ja_no_inicio', v_no_inicio, 'fora_do_lote', v_fora, 'reiniciado_em', now());
end;
$function$;
comment on function private."FC_REINICIAR_FICHAS_DO_EDITAL"(uuid, text, uuid) is
  'Volta ao início toda ficha iniciada do edital (FC_FICHA_INICIADA: campos ou histórico depois do último REINICIAR): a do lote volta a PENDENTE; a FORA_LOTE continua FORA_LOTE. Sem responsável, reserva, lançamento, resultado, parecer, notas, rascunho e conclusão; versão + 1; histórico REINICIAR com o motivo (10 a 2.000), o autor (admin global ativo, 42501) e o que foi limpo. A ficha não iniciada não muda. Não toca regra, decisões, pré-classificação, Classificação nem análises. Sem grant: public.reiniciar_fichas_do_edital e o SQL Editor.';
revoke all on function private."FC_REINICIAR_FICHAS_DO_EDITAL"(uuid, text, uuid) from public, anon, authenticated, service_role;

comment on function public.reiniciar_fichas_do_edital(uuid, text) is
  'Só admin global: volta ao início toda ficha iniciada do edital (a do lote volta a PENDENTE; a FORA_LOTE continua fora), com motivo de 10 a 2.000 e histórico REINICIAR por ficha. Depois dele, o refazer do lote é aceito (FC_FICHAS_INICIADAS = 0). Nada se apaga (FC_REINICIAR_FICHAS_DO_EDITAL).';

commit;
