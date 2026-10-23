/*
  Rollback de 20261023220000_historico_do_rascunho_enxuto: o SALVAR volta a
  gravar o retrato inteiro ({lancamento, resultado, versao_regra}).

  - public.salvar_rascunho_ficha volta à definição de 20261013130000_regra_por_cargo.sql
    (igual à vigente no banco em 21/10/2026, conferida com pg_get_functiondef).
  - CK_THFICHA_CONTEUDO volta a exigir o retrato no SALVAR, mas NOT VALID: as
    linhas SALVAR gravadas sem retrato enquanto a migration valeu (e as
    compactadas pela correção 20261023-compactar-retratos-do-rascunho.sql, se
    rodou) ficam como estão — o histórico é imutável e nada é inventado; as
    gravações novas voltam a ser conferidas.
  - Comentários de volta aos de 20261007130000/20261015020000.
*/
begin;

set local lock_timeout = '3s';

alter table public."TH_FICHA_ANALISE"
  drop constraint "CK_THFICHA_CONTEUDO",
  add constraint "CK_THFICHA_CONTEUDO" check (
    ("TP_RESULTADO" is null or "TP_RESULTADO" in ('APTO', 'INAPTO_REQUISITO', 'INAPTO_NOTA'))
    and coalesce("VL_NOTA_FINAL", 0) between 0 and 1000
    and ("DS_ALTERACAO" is null or jsonb_typeof("DS_ALTERACAO") = 'array')
    and ("DS_RETRATO" is null or jsonb_typeof("DS_RETRATO") = 'object')
    and ("TP_ACAO" not in ('SALVAR', 'CONCLUIR') or "DS_RETRATO" is not null)) not valid;

comment on constraint "CK_THFICHA_CONTEUDO" on public."TH_FICHA_ANALISE" is 'Resultado válido, nota de 0 a 1.000, alterações em lista, retrato em objeto (obrigatório ao salvar e concluir).';
comment on table public."TH_FICHA_ANALISE" is
  'Histórico imutável da ficha: criação, pegar, reservar e liberar, distribuição e redistribuição (com motivo), devolução à fila, envio à revisão, saída ou volta ao lote e, do conteúdo, cada rascunho com alteração, a conclusão e a reabertura (com motivo), com o retrato do lançamento e o que mudou.';
comment on column public."TH_FICHA_ANALISE"."TP_ACAO" is 'CRIAR, PEGAR (Pegar próximo), RESERVAR (abriu), LIBERAR (fechou), LIBERAR_RESERVA (a coordenação liberou a reserva de outra pessoa), DISTRIBUIR, REDISTRIBUIR, DEVOLVER_FILA, REVISAR, SAIR_LOTE, VOLTAR_LOTE, SALVAR (rascunho com alteração), CONCLUIR, REABRIR, REINICIAR (o administrador global voltou as fichas do edital ao início), REFAZER_LOTE (a ficha intocada ficou fora do lote refeito do zero) ou MODALIDADE (a pré-classificação mudou a modalidade da ficha não concluída).';
comment on column public."TH_FICHA_ANALISE"."DS_RETRATO" is 'Retrato do conteúdo depois da ação ({lancamento, resultado, parecer, versao_regra}); obrigatório em SALVAR e CONCLUIR.';

CREATE OR REPLACE FUNCTION public.salvar_rascunho_ficha(p_ficha uuid, p_versao integer, p_lancamento jsonb, p_resultado jsonb, p_parecer text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_f public."TB_FICHA_ANALISE";
  v_uid uuid := (select auth.uid());
  v_regra record;
  v_alt jsonb;
  v_cargo text;
  v_conf jsonb;
begin
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha for update;
  perform private."FC_EXIGIR_GRAVAR_FICHA"(v_f, p_versao);
  select * into v_regra from private."FC_REGRA_VIGENTE_FICHA"(p_ficha);
  -- A vaga e o cargo são os da ficha (o lançamento grava os dois) e a regra é a
  -- da vaga: a diferença do cargo por cima do nível (20261013130000).
  v_cargo := (select pv."NO_CARGO" from public."TB_PRE_CLASSIF_VAGA" pv
               where pv."CO_MONITORAMENTO" = v_f."CO_MONITORAMENTO" and pv."CO_VAGA" = v_f."CO_VAGA");
  if jsonb_typeof(p_lancamento) = 'object' then
    p_lancamento := p_lancamento || jsonb_build_object('vaga', v_f."CO_VAGA", 'cargo', v_cargo);
  end if;
  v_conf := private."FC_REGRA_DA_VAGA"(v_regra.p_configuracao, v_f."CO_VAGA", v_cargo, p_lancamento ->> 'nivel');
  perform private."FC_VALIDAR_LANCAMENTO_FICHA"(v_conf, p_lancamento);
  perform private."FC_VALIDAR_RESULTADO_FICHA"(v_conf, p_lancamento, p_resultado,
                                                private."FC_DOCUMENTAL_DO_EDITAL"(v_f."CO_MONITORAMENTO"));
  if length(coalesce(p_parecer, '')) > 8000 then
    raise exception 'Parecer com até 8.000 caracteres.' using errcode = '22023';
  end if;
  v_alt := private."FC_ALTERACOES_FICHA"(v_conf, v_f."DS_LANCAMENTO", v_f."DS_RESULTADO", p_lancamento, p_resultado);
  update public."TB_FICHA_ANALISE" set
    "DS_LANCAMENTO" = p_lancamento, "DS_RESULTADO" = p_resultado, "DS_PARECER" = nullif(btrim(coalesce(p_parecer, '')), ''),
    "CO_USUARIO_RASCUNHO" = v_uid, "DT_RASCUNHO" = now(),
    "DT_RESERVA_EXPIRA" = now() + private."FC_PRAZO_RESERVA_FICHA"(),
    "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
   where "CO_FICHA_ANALISE" = p_ficha;
  if jsonb_array_length(v_alt) > 0 then
    perform private."FC_HISTORICO_CONTEUDO_FICHA"(p_ficha, 'SALVAR', v_f."TP_SITUACAO", null, v_uid, v_alt,
      jsonb_build_object('lancamento', p_lancamento, 'resultado', p_resultado, 'versao_regra', v_regra.p_versao));
  end if;
  return json_build_object('versao', v_f."NU_VERSAO" + 1, 'salvo_em', now(), 'alteracoes', jsonb_array_length(v_alt),
                           'versao_regra', v_regra.p_versao);
end;
$function$;
comment on function public.salvar_rascunho_ficha(uuid, integer, jsonb, jsonb, text) is
  'Salva o rascunho da ficha (o salvamento automático da tela): lançamento (com a vaga e o cargo da ficha, desde 20261013130000), resultado da conta e parecer gerado, conferidos contra a regra vigente da vaga (a diferença do cargo por cima do nível, FC_REGRA_DA_VAGA; estrutura, limites e coerência do resultado; nada é recalculado). Exige a reserva vigente de quem chama, em análise, e a versão que a tela abriu (40001); renova a reserva; sobe a versão. Alteração de conteúdo vai ao histórico (SALVAR, com o retrato e de quanto para quanto). Devolve a versão nova e a hora.';

commit;
