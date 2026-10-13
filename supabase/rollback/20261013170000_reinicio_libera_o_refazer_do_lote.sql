-- Desfaz 20261013170000: volta FC_FICHA_INICIADA a olhar o histórico inteiro.
begin;
CREATE OR REPLACE FUNCTION private."FC_FICHA_INICIADA"(p_f "TB_FICHA_ANALISE")
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p_f."TP_SITUACAO" not in ('PENDENTE', 'FORA_LOTE')
      or p_f."CO_USUARIO_RESPONSAVEL" is not null or p_f."DT_ATRIBUICAO" is not null
      or p_f."CO_USUARIO_RESERVA" is not null
      or p_f."DS_LANCAMENTO" is not null or p_f."DS_RESULTADO" is not null or p_f."DS_PARECER" is not null
      or p_f."TP_RESULTADO" is not null or p_f."VL_NOTA_APURADA" is not null or p_f."VL_NOTA_FINAL" is not null
      or p_f."CO_USUARIO_RASCUNHO" is not null or p_f."CO_USUARIO_CONCLUSAO" is not null
      or exists (select 1 from public."TH_FICHA_ANALISE" h
                  where h."CO_FICHA_ANALISE" = p_f."CO_FICHA_ANALISE"
                    and h."TP_ACAO" not in ('CRIAR', 'SAIR_LOTE', 'VOLTAR_LOTE', 'REFAZER_LOTE'));
$function$;
commit;
