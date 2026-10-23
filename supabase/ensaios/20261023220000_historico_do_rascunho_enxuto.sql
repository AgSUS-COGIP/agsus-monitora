/*
  Ensaio de 20261023220000_historico_do_rascunho_enxuto (begin … rollback; nada
  fica gravado). O trecho entre os marcadores é o corpo da migration (sem o
  begin/commit dela), mais a validação da restrição; o teste
  tests/historico-do-rascunho-enxuto-migration.test.js confere que é idêntico.

  Reprova (raise exception) se:
    E1  CK_THFICHA_CONTEUDO ainda exigir retrato no SALVAR ou deixar de exigir
        no CONCLUIR;
    E2  um SALVAR sem retrato (pelo mesmo caminho da RPC,
        FC_HISTORICO_CONTEUDO_FICHA) for recusado;
    E3  um CONCLUIR sem retrato for aceito;
    E4  salvar_rascunho_ficha ainda montar o retrato, ou mudar dono,
        SECURITY DEFINER, search_path ou grants.
*/
begin;

create temporary table ensaio_antes on commit drop as
select p.proowner, p.prosecdef, p.proconfig, p.proacl
  from pg_proc p where p.oid = 'public.salvar_rascunho_ficha(uuid,integer,jsonb,jsonb,text)'::regprocedure;

-- >>> migration

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

alter table public."TH_FICHA_ANALISE" validate constraint "CK_THFICHA_CONTEUDO";
-- <<< migration

do $$
declare
  v_def text := pg_get_constraintdef((select c.oid from pg_constraint c
                 where c.conrelid = 'public."TH_FICHA_ANALISE"'::regclass and c.conname = 'CK_THFICHA_CONTEUDO'));
  v_corpo text := pg_get_functiondef('public.salvar_rascunho_ficha(uuid,integer,jsonb,jsonb,text)'::regprocedure);
  v_ficha uuid;
  v_n integer;
begin
  -- E1
  if v_def like '%SALVAR%' or v_def not like '%CONCLUIR%' then
    raise exception 'E1: CK_THFICHA_CONTEUDO inesperada: %', v_def;
  end if;
  if not (select c.convalidated from pg_constraint c
           where c.conrelid = 'public."TH_FICHA_ANALISE"'::regclass and c.conname = 'CK_THFICHA_CONTEUDO') then
    raise exception 'E1: CK_THFICHA_CONTEUDO não validada';
  end if;

  -- E2: uma ficha qualquer já com histórico de conteúdo (nada fica gravado).
  select h."CO_FICHA_ANALISE" into v_ficha from public."TH_FICHA_ANALISE" h
   where h."TP_ACAO" = 'SALVAR' order by h."CO_HISTORICO_FICHA" desc limit 1;
  perform private."FC_HISTORICO_CONTEUDO_FICHA"(v_ficha, 'SALVAR', 'EM_ANALISE', null,
    'a01afddb-f64b-47d9-80e8-476a1ed14e43', '[{"campo":"ensaio","de":1,"para":2}]'::jsonb, null);
  select count(*) into v_n from public."TH_FICHA_ANALISE" h
   where h."CO_FICHA_ANALISE" = v_ficha and h."TP_ACAO" = 'SALVAR' and h."DS_RETRATO" is null
     and h."DS_ALTERACAO" = '[{"campo":"ensaio","de":1,"para":2}]'::jsonb;
  if v_n <> 1 then
    raise exception 'E2: SALVAR sem retrato não gravou (%)', v_n;
  end if;

  -- E3
  begin
    perform private."FC_HISTORICO_CONTEUDO_FICHA"(v_ficha, 'CONCLUIR', 'EM_ANALISE', null,
      'a01afddb-f64b-47d9-80e8-476a1ed14e43', '[]'::jsonb, null);
    raise exception 'E3: CONCLUIR sem retrato foi aceito';
  exception when check_violation then
    null;
  end;

  -- E4
  if v_corpo like '%jsonb_build_object(''lancamento''%' or v_corpo not like '%v_uid, v_alt, null);%' then
    raise exception 'E4: salvar_rascunho_ficha ainda monta o retrato';
  end if;
  if exists (select 1 from pg_proc p, ensaio_antes a
              where p.oid = 'public.salvar_rascunho_ficha(uuid,integer,jsonb,jsonb,text)'::regprocedure
                and (p.proowner, p.prosecdef, p.proconfig, p.proacl) is distinct from (a.proowner, a.prosecdef, a.proconfig, a.proacl)) then
    raise exception 'E4: dono, SECURITY DEFINER, search_path ou grants mudaram';
  end if;
  raise notice 'Ensaio 20261023220000 ok (ficha de teste %)', v_ficha;
end;
$$;

select 'ok' as ensaio_20261023220000;

rollback;
