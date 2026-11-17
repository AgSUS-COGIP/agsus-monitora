/*
  ROLLBACK de supabase/migrations/20261117030000_conferencia_nao_revisa_ficha_importada.sql: a função como estava em 16/11/2026 (o texto
  igual; o corpo volta com LF).
*/

begin;

CREATE OR REPLACE FUNCTION public.revisar_ficha_concluida_com_pendencia(p_ficha uuid, p_versao integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  v_f public."TB_FICHA_ANALISE";
  v_cargo text;
  v_lanc jsonb;
  v_pend text[];
  v_motivo text;
begin
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha for update;
  if v_f."CO_FICHA_ANALISE" is null then
    return jsonb_build_object('alterada', false, 'motivo', 'ficha não encontrada');
  end if;
  if v_f."TP_SITUACAO" <> 'CONCLUIDA' or v_f."NU_VERSAO" is distinct from p_versao then
    return jsonb_build_object('alterada', false, 'motivo', 'a ficha mudou desde a leitura');
  end if;
  if jsonb_typeof(v_f."DS_LANCAMENTO") is distinct from 'object' or jsonb_typeof(v_f."DS_RESULTADO") is distinct from 'object' then
    return jsonb_build_object('alterada', false, 'motivo', 'ficha sem lançamento ou resultado');
  end if;
  v_cargo := (select pv."NO_CARGO" from public."TB_PRE_CLASSIF_VAGA" pv
               where pv."CO_MONITORAMENTO" = v_f."CO_MONITORAMENTO" and pv."CO_VAGA" = v_f."CO_VAGA");
  v_lanc := v_f."DS_LANCAMENTO" || jsonb_build_object('vaga', v_f."CO_VAGA", 'cargo', v_cargo);
  select private."FC_PENDENCIAS_FICHA"(
           private."FC_REGRA_DA_VAGA"(r.p_configuracao, v_f."CO_VAGA", v_cargo, v_lanc ->> 'nivel'), v_lanc, v_f."DS_RESULTADO")
    into v_pend
    from private."FC_REGRA_VIGENTE_FICHA"(p_ficha) r;
  if coalesce(cardinality(v_pend), 0) = 0 then
    return jsonb_build_object('alterada', false, 'motivo', 'sem pendência no banco');
  end if;
  v_motivo := left('Conferência automática: a ficha concluída tem pendência pela regra vigente — '
                   || array_to_string(v_pend[1:5], '; ')
                   || case when cardinality(v_pend) > 5 then format(' (e mais %s)', cardinality(v_pend) - 5) else '' end
                   || '.', 2000);
  update public."TB_FICHA_ANALISE" set
    "TP_SITUACAO" = 'REVISAR', "CO_USUARIO_RESERVA" = null, "DT_RESERVA" = null, "DT_RESERVA_EXPIRA" = null,
    "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
   where "CO_FICHA_ANALISE" = p_ficha;
  perform private."FC_HISTORICO_FICHA"(p_ficha, 'REVISAR', 'CONCLUIDA', v_f."CO_USUARIO_RESPONSAVEL", v_motivo, null);
  return jsonb_build_object('alterada', true, 'versao', v_f."NU_VERSAO" + 1, 'pendencias', to_jsonb(v_pend));
end;
$$;

commit;
