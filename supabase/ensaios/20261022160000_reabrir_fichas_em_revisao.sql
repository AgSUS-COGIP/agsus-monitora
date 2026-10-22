/* Ensaio sem alterar fichas reais: aplica definição e desfaz. */
begin;

CREATE OR REPLACE FUNCTION public.reabrir_ficha(p_ficha uuid, p_versao integer, p_motivo text, p_complemento text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_f public."TB_FICHA_ANALISE";
  v_uid uuid := (select auth.uid());
  v_codigo text := upper(btrim(coalesce(p_motivo, '')));
  v_rotulo text := private."FC_MOTIVO_REABERTURA"(upper(btrim(coalesce(p_motivo, ''))));
  v_complemento text := nullif(regexp_replace(btrim(coalesce(p_complemento, '')), '\s+', ' ', 'g'), '');
begin
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha for update;
  if v_f."CO_FICHA_ANALISE" is null then
    raise exception 'Ficha não encontrada' using errcode = '22023';
  end if;
  perform private."FC_EXIGIR_COORD_FICHAS"(v_f."CO_MONITORAMENTO");
  if v_f."TP_SITUACAO" not in ('CONCLUIDA', 'REVISAR') then
    raise exception 'Só fichas concluídas ou em revisão podem ser reabertas.' using errcode = '22023';
  end if;
  if p_versao is distinct from v_f."NU_VERSAO" then
    raise exception 'Esta ficha mudou desde que você abriu; recarregue.' using errcode = 'PT409';
  end if;
  -- Motivo da lista (20261021110000). Texto livre aqui é a tela antiga: recarregar mostra a lista.
  if v_rotulo is null then
    raise exception 'Escolha o motivo da reabertura na lista. Se a lista não aparece, recarregue a página.' using errcode = '22023';
  end if;
  if length(coalesce(v_complemento, '')) > 500 then
    raise exception 'Complemento com até 500 caracteres.' using errcode = '22023';
  end if;
  if v_codigo = 'OUTRO' then
    if length(coalesce(v_complemento, '')) < 15 or not private."FC_MOTIVO_PARECE_TEXTO"(v_complemento, 3) then
      raise exception 'Em "Outro", descreva o motivo com pelo menos 15 caracteres e 3 palavras.' using errcode = '22023';
    end if;
  elsif v_complemento is not null and not private."FC_MOTIVO_PARECE_TEXTO"(v_complemento, 1) then
    raise exception 'O complemento precisa ser escrito com palavras (ou fique em branco).' using errcode = '22023';
  end if;
  update public."TB_FICHA_ANALISE" set
    "TP_SITUACAO" = case
      when coalesce("CO_USUARIO_RESPONSAVEL", "CO_USUARIO_CONCLUSAO") is null then 'PENDENTE'
      else 'EM_ANALISE'
    end,
    "CO_USUARIO_RESPONSAVEL" = coalesce("CO_USUARIO_RESPONSAVEL", "CO_USUARIO_CONCLUSAO"),
    "DT_ATRIBUICAO" = coalesce("DT_ATRIBUICAO", now()),
    "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
   where "CO_FICHA_ANALISE" = p_ficha;
  perform private."FC_HISTORICO_CONTEUDO_FICHA"(p_ficha, 'REABRIR', v_f."TP_SITUACAO",
    v_rotulo || coalesce(' — ' || v_complemento, ''), v_uid,
    jsonb_build_array(jsonb_build_object('campo', 'motivo_reabertura', 'rotulo', 'Motivo da reabertura',
      'de', null, 'para', v_codigo, 'complemento', v_complemento)), null);
  return json_build_object('versao', v_f."NU_VERSAO" + 1);
end;
$function$;
comment on function public.reabrir_ficha(uuid, integer, text, text) is
  'A coordenação do edital reabre uma ficha concluída ou em revisão (volta a Em análise com responsável; sem responsável, volta a Pendente), com a versão que a tela abriu (PT409). p_motivo: código da lista (FC_MOTIVO_REABERTURA; texto livre da tela antiga é recusado com 22023 pedindo recarregar); p_complemento: opcional, até 500, obrigatório em OUTRO (15+ caracteres, 3 palavras). Histórico REABRIR com o rótulo no DS_MOTIVO e o código no DS_ALTERACAO (20261021110000).';
revoke all on function public.reabrir_ficha(uuid, integer, text, text) from public, anon;
grant execute on function public.reabrir_ficha(uuid, integer, text, text) to authenticated;

do $verificar$
declare v_def text := pg_get_functiondef('public.reabrir_ficha(uuid, integer, text, text)'::regprocedure);
begin
 if position('not in (''CONCLUIDA'', ''REVISAR'')' in v_def) = 0 then raise exception 'Sem revisão'; end if;
 if position('''REABRIR'', v_f."TP_SITUACAO"' in v_def) = 0 then raise exception 'Sem histórico da situação original'; end if;
end;
$verificar$;

rollback;
