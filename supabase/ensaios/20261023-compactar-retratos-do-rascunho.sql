/*
  Ensaio da correção 20261023-compactar-retratos-do-rascunho (begin … rollback;
  nada fica gravado). Curto, para rodar mesmo em horário de uso: aplica a
  migration 20261023090000 só nesta transação, monta a MESMA lista de retratos
  que ficam (o trecho entre os marcadores é copiado da correção; o teste
  confere), mede o que sai e exercita o desliga/religa do gatilho em UMA linha.
  O UPDATE completo (~9,6 mil linhas, segundos com a tabela travada) não roda
  aqui: na janela de aplicação, rode antes a própria correção trocando o
  commit final por rollback e confira os números.

  Reprova (raise exception) se:
    C1  a lista do que fica não tiver o último SALVAR com retrato de cada ficha
        ou o último antes de cada CONCLUIR;
    C2  com o gatilho ligado, o UPDATE no histórico passar;
    C3  depois de desligar e religar dentro da transação, o gatilho não estiver
        ligado ('O') ou o UPDATE voltar a passar.
*/
begin;

set local lock_timeout = '3s';

-- >>> migration


alter table public."TH_FICHA_ANALISE"
  drop constraint "CK_THFICHA_CONTEUDO",
  add constraint "CK_THFICHA_CONTEUDO" check (
    ("TP_RESULTADO" is null or "TP_RESULTADO" in ('APTO', 'INAPTO_REQUISITO', 'INAPTO_NOTA'))
    and coalesce("VL_NOTA_FINAL", 0) between 0 and 1000
    and ("DS_ALTERACAO" is null or jsonb_typeof("DS_ALTERACAO") = 'array')
    and ("DS_RETRATO" is null or jsonb_typeof("DS_RETRATO") = 'object')
    and ("TP_ACAO" <> 'CONCLUIR' or "DS_RETRATO" is not null)) not valid;

comment on constraint "CK_THFICHA_CONTEUDO" on public."TH_FICHA_ANALISE" is
  'Resultado válido, nota de 0 a 1.000, alterações em lista, retrato em objeto (obrigatório ao concluir; o SALVAR não leva retrato desde 20261023090000).';
comment on table public."TH_FICHA_ANALISE" is
  'Histórico imutável da ficha: criação, pegar, reservar e liberar, distribuição e redistribuição (com motivo), devolução à fila, envio à revisão, saída ou volta ao lote e, do conteúdo, cada rascunho com alteração (o que mudou), a conclusão (com o retrato do lançamento) e a reabertura (com motivo).';
comment on column public."TH_FICHA_ANALISE"."TP_ACAO" is
  'CRIAR, PEGAR (Pegar próximo), RESERVAR (abriu), LIBERAR (fechou), LIBERAR_RESERVA (a coordenação liberou a reserva de outra pessoa), DISTRIBUIR, REDISTRIBUIR, DEVOLVER_FILA, REVISAR, SAIR_LOTE, VOLTAR_LOTE, SALVAR (rascunho com alteração: só o que mudou, sem retrato, desde 20261023090000), CONCLUIR, REABRIR, REINICIAR (o administrador global voltou as fichas do edital ao início), REFAZER_LOTE (a ficha intocada ficou fora do lote refeito do zero) ou MODALIDADE (a pré-classificação mudou a modalidade da ficha não concluída).';
comment on column public."TH_FICHA_ANALISE"."DS_RETRATO" is
  'Retrato do conteúdo depois da ação ({lancamento, resultado, parecer, versao_regra}); obrigatório no CONCLUIR. No SALVAR, só até 20261023090000 (desde então o rascunho vigente fica em TB_FICHA_ANALISE e o histórico guarda o que mudou em DS_ALTERACAO).';

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
  -- inteiro, que fica na própria ficha (20261023090000).
  if jsonb_array_length(v_alt) > 0 then
    perform private."FC_HISTORICO_CONTEUDO_FICHA"(p_ficha, 'SALVAR', v_f."TP_SITUACAO", null, v_uid, v_alt, null);
  end if;
  return json_build_object('versao', v_f."NU_VERSAO" + 1, 'salvo_em', now(), 'alteracoes', jsonb_array_length(v_alt),
                           'versao_regra', v_regra.p_versao);
end;
$function$;
comment on function public.salvar_rascunho_ficha(uuid, integer, jsonb, jsonb, text) is
  'Salva o rascunho da ficha (o salvamento automático da tela): lançamento (com a vaga e o cargo da ficha, desde 20261013130000), resultado da conta e parecer gerado, conferidos contra a regra vigente da vaga (a diferença do cargo por cima do nível, FC_REGRA_DA_VAGA; estrutura, limites e coerência do resultado; nada é recalculado). Exige a reserva vigente de quem chama, em análise, e a versão que a tela abriu; renova a reserva; sobe a versão. Alteração de conteúdo vai ao histórico como SALVAR leve: o que mudou, de quanto para quanto, sem o retrato (que fica na ficha; 20261023090000). Devolve a versão nova e a hora.';

-- <<< migration

-- >>> lista do que fica
create temporary table compactar_manter on commit drop as
select x.id
  from (select h."CO_HISTORICO_FICHA" as id, h."TP_ACAO" as acao,
               lead(h."TP_ACAO") over (partition by h."CO_FICHA_ANALISE" order by h."CO_HISTORICO_FICHA") as proxima,
               row_number() over (partition by h."CO_FICHA_ANALISE", h."TP_ACAO" order by h."CO_HISTORICO_FICHA" desc) as ordem
          from public."TH_FICHA_ANALISE" h
         where (h."TP_ACAO" = 'SALVAR' and h."DS_RETRATO" is not null) or h."TP_ACAO" = 'CONCLUIR') x
 where x.acao = 'SALVAR' and (x.proxima = 'CONCLUIR' or x.ordem = 1);
create unique index on compactar_manter (id);
-- <<< lista do que fica

do $$
declare
  v_falta integer;
  v_id bigint;
begin
  -- C1
  select count(*) into v_falta
    from ((select distinct on (h."CO_FICHA_ANALISE") h."CO_HISTORICO_FICHA" as id
            from public."TH_FICHA_ANALISE" h
           where h."TP_ACAO" = 'SALVAR' and h."DS_RETRATO" is not null
           order by h."CO_FICHA_ANALISE", h."CO_HISTORICO_FICHA" desc)
          union
          select (select max(s."CO_HISTORICO_FICHA") from public."TH_FICHA_ANALISE" s
                   where s."CO_FICHA_ANALISE" = c."CO_FICHA_ANALISE" and s."TP_ACAO" = 'SALVAR'
                     and s."DS_RETRATO" is not null and s."CO_HISTORICO_FICHA" < c."CO_HISTORICO_FICHA")
            from public."TH_FICHA_ANALISE" c where c."TP_ACAO" = 'CONCLUIR') e
   where e.id is not null and not exists (select 1 from compactar_manter m where m.id = e.id);
  if v_falta > 0 then
    raise exception 'C1: % retratos que deviam ficar não estão na lista', v_falta;
  end if;

  select h."CO_HISTORICO_FICHA" into v_id from public."TH_FICHA_ANALISE" h
   where h."TP_ACAO" = 'SALVAR' and h."DS_RETRATO" is not null
     and not exists (select 1 from compactar_manter m where m.id = h."CO_HISTORICO_FICHA")
   order by h."CO_HISTORICO_FICHA" limit 1;

  -- C2
  begin
    update public."TH_FICHA_ANALISE" set "DS_RETRATO" = null where "CO_HISTORICO_FICHA" = v_id;
    raise exception 'C2: o histórico aceitou UPDATE com o gatilho ligado';
  exception when insufficient_privilege then
    null;
  end;

  -- C3
  alter table public."TH_FICHA_ANALISE" disable trigger "TG_THFICHA_IMUTAVEL";
  update public."TH_FICHA_ANALISE" set "DS_RETRATO" = null where "CO_HISTORICO_FICHA" = v_id;
  alter table public."TH_FICHA_ANALISE" enable trigger "TG_THFICHA_IMUTAVEL";
  if (select t.tgenabled from pg_trigger t
       where t.tgrelid = 'public."TH_FICHA_ANALISE"'::regclass and t.tgname = 'TG_THFICHA_IMUTAVEL') <> 'O' then
    raise exception 'C3: o gatilho não voltou a ficar ligado';
  end if;
  begin
    update public."TH_FICHA_ANALISE" set "DS_RETRATO" = '{}'::jsonb where "CO_HISTORICO_FICHA" = v_id;
    raise exception 'C3: o histórico aceitou UPDATE depois de religar o gatilho';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

-- O que a correção faria (medição; pg_column_size do jsonb guardado).
select count(*) filter (where m.id is null) as compactaria,
       pg_size_pretty(sum(pg_column_size(h."DS_RETRATO")) filter (where m.id is null)) as retrato_que_sai,
       count(*) filter (where m.id is not null) as mantem,
       pg_size_pretty(sum(pg_column_size(h."DS_RETRATO")) filter (where m.id is not null)) as retrato_que_fica,
       pg_size_pretty(pg_total_relation_size('public."TH_FICHA_ANALISE"')) as tabela_hoje
  from public."TH_FICHA_ANALISE" h
  left join compactar_manter m on m.id = h."CO_HISTORICO_FICHA"
 where h."TP_ACAO" = 'SALVAR' and h."DS_RETRATO" is not null;

rollback;
