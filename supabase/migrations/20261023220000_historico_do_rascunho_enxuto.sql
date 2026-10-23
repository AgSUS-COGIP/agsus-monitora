/*
  HISTÓRICO DO RASCUNHO ENXUTO: o SALVAR da ficha deixa de gravar o retrato inteiro

  APLICAR SÓ DEPOIS DE 22/10/2026 (fim da análise do 114/2026), com autorização.

  Por quê (medição de 21/10/2026, banco tabmkiokfuxyqjuvfiha, plano FREE):
  public."TH_FICHA_ANALISE" tem 27,8 MB (heap 22 MB, toast 4 MB); 19,7 MB são as
  10.866 linhas SALVAR, e 15 MB delas são DS_RETRATO. Cada salvamento automático
  da ficha (a tela salva 1–3 s depois de cada mudança) com alguma alteração
  gravava o lançamento e o resultado inteiros ({lancamento, resultado,
  versao_regra}, ~1,4 KB comprimido). Nos dias de análise (16, 19 e 20/10): 4,4,
  5,2 e 8,5 MB/dia de SALVAR, 76% disso retrato. Banco em 303 de 500 MB.

  Ninguém lê DS_RETRATO do SALVAR (conferido em 21/10/2026): nenhuma função,
  view ou RPC do banco o lê (só FC_HISTORICO_CONTEUDO_FICHA o grava);
  obter_ficha_analise devolve do histórico ação, situação, quem, quando, motivo,
  resultado, nota e DS_ALTERACAO, sem o retrato; o front (conclusao-da-ficha.tsx,
  ACOES_DO_HISTORICO/textoDaAlteracao em src/lib/avaliacao-documental/ficha.js),
  os scripts, o Python e o servidor não leem TH_FICHA_ANALISE. Outras leituras
  do histórico usam só TP_ACAO/datas: FC_FICHA_INICIADA (qualquer linha depois do
  último REINICIAR), obter_ritmo_da_analise (CONCLUIR/REABRIR).

  Opção escolhida — SALVAR leve com o "de quanto para quanto" (b + c):
    - o SALVAR continua a cada salvamento com alteração, com quem, quando, a
      versão, o resultado e a nota de depois e DS_ALTERACAO (o que mudou, de →
      para, até 60 itens, FC_ALTERACOES_FICHA) — é o que a tela mostra no
      histórico e o que responde "quem mudou a nota";
    - sem DS_RETRATO: o último rascunho já vive na própria ficha
      (TB_FICHA_ANALISE.DS_LANCAMENTO/DS_RESULTADO/DS_PARECER);
    - CONCLUIR continua com o retrato completo (obrigatório); REABRIR,
      REINICIAR (que guarda em DS_ALTERACAO o conteúdo que limpou), DISTRIBUIR,
      REVISAR e as demais ações não mudam.
    Por que não (a) "um retrato a cada N minutos": guardaria retratos que ninguém
    lê e perderia o registro de cada mudança entre eles; a seção não chega ao
    banco (só o lançamento).

  O que muda:
    1. CK_THFICHA_CONTEUDO: o retrato passa a ser obrigatório só no CONCLUIR
       (antes: SALVAR e CONCLUIR). Entra NOT VALID dentro da transação (trava
       curta) e é validada depois do commit (sem bloquear gravações); a regra
       nova é mais frouxa que a antiga, então todas as linhas passam.
    2. public.salvar_rascunho_ficha: a definição vigente (pg_get_functiondef em
       21/10/2026 e de novo em 23/10/2026, depois de 20261022180000 e
       20261023090000_calculo_conferido_no_banco, que não a mudaram; igual a
       20261013130000_regra_por_cargo.sql) com uma única troca: o SALVAR vai ao
       histórico com p_retrato = null. Assinatura, retorno, validações, grants e
       dono não mudam (CREATE OR REPLACE).
    3. Comentários da tabela, das colunas e da função (o de TP_ACAO passa a
       citar também o CORRIGIR, que 20261023090000_calculo_conferido_no_banco
       criou).

  Daqui para frente: ~440 bytes por SALVAR em vez de ~1,8 KB (o banco deixa de
  crescer ~3/4 do que o histórico cresce nos dias de análise). O passado é
  compactado à parte, só com autorização:
  supabase/correcoes/20261023-compactar-retratos-do-rascunho.sql.

  Ensaio:   supabase/ensaios/20261023220000_historico_do_rascunho_enxuto.sql
  Rollback: supabase/rollback/20261023220000_historico_do_rascunho_enxuto.sql
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
    and ("TP_ACAO" <> 'CONCLUIR' or "DS_RETRATO" is not null)) not valid;

comment on constraint "CK_THFICHA_CONTEUDO" on public."TH_FICHA_ANALISE" is
  'Resultado válido, nota de 0 a 1.000, alterações em lista, retrato em objeto (obrigatório ao concluir; o SALVAR não leva retrato desde 20261023220000).';
comment on table public."TH_FICHA_ANALISE" is
  'Histórico imutável da ficha: criação, pegar, reservar e liberar, distribuição e redistribuição (com motivo), devolução à fila, envio à revisão, saída ou volta ao lote e, do conteúdo, cada rascunho com alteração (o que mudou), a conclusão (com o retrato do lançamento) e a reabertura (com motivo).';
comment on column public."TH_FICHA_ANALISE"."TP_ACAO" is
  'CRIAR, PEGAR (Pegar próximo), RESERVAR (abriu), LIBERAR (fechou), LIBERAR_RESERVA (a coordenação liberou a reserva de outra pessoa), DISTRIBUIR, REDISTRIBUIR, DEVOLVER_FILA, REVISAR, SAIR_LOTE, VOLTAR_LOTE, SALVAR (rascunho com alteração: só o que mudou, sem retrato, desde 20261023220000), CONCLUIR, REABRIR, REINICIAR (o administrador global voltou as fichas do edital ao início), REFAZER_LOTE (a ficha intocada ficou fora do lote refeito do zero), MODALIDADE (a pré-classificação mudou a modalidade da ficha não concluída) ou CORRIGIR (correção de dados da ficha concluída, assinada pelo setor).';
comment on column public."TH_FICHA_ANALISE"."DS_RETRATO" is
  'Retrato do conteúdo depois da ação ({lancamento, resultado, parecer, versao_regra}); obrigatório no CONCLUIR. No SALVAR, só até 20261023220000 (desde então o rascunho vigente fica em TB_FICHA_ANALISE e o histórico guarda o que mudou em DS_ALTERACAO).';

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
  -- O histórico do rascunho é leve: o que mudou (de → para), sem o retrato
  -- inteiro, que fica na própria ficha (20261023220000).
  if jsonb_array_length(v_alt) > 0 then
    perform private."FC_HISTORICO_CONTEUDO_FICHA"(p_ficha, 'SALVAR', v_f."TP_SITUACAO", null, v_uid, v_alt, null);
  end if;
  return json_build_object('versao', v_f."NU_VERSAO" + 1, 'salvo_em', now(), 'alteracoes', jsonb_array_length(v_alt),
                           'versao_regra', v_regra.p_versao);
end;
$function$;
comment on function public.salvar_rascunho_ficha(uuid, integer, jsonb, jsonb, text) is
  'Salva o rascunho da ficha (o salvamento automático da tela): lançamento (com a vaga e o cargo da ficha, desde 20261013130000), resultado da conta e parecer gerado, conferidos contra a regra vigente da vaga (a diferença do cargo por cima do nível, FC_REGRA_DA_VAGA; estrutura, limites e coerência do resultado; nada é recalculado). Exige a reserva vigente de quem chama, em análise, e a versão que a tela abriu (40001); renova a reserva; sobe a versão. Alteração de conteúdo vai ao histórico como SALVAR leve: o que mudou, de quanto para quanto, sem o retrato (que fica na ficha; 20261023220000). Devolve a versão nova e a hora.';

commit;

-- Fora da transação: confere as linhas existentes sem bloquear as gravações
-- (SHARE UPDATE EXCLUSIVE). A regra nova é mais frouxa que a antiga.
alter table public."TH_FICHA_ANALISE" validate constraint "CK_THFICHA_CONTEUDO";
