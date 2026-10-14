/*
  ENSAIO da migration 20261014130000_gravar_pre_classificacao_rapido.sql — begin … rollback.

  NÃO É MIGRATION. Rode depois da migration, na mesma transação (ensaio.sh:
  ensaio_arquivo <migration> "$(cat <este arquivo>)"), e desfaça.

  Confere, com o statement_timeout do service_role (8 s):
    1. FC_FICHAS_INICIADAS (conjunto) = a contagem por FC_FICHA_INICIADA, ficha
       a ficha, em todo edital com fichas;
    2. no 114/2026, gravar_pre_classificacao_vaga regrava o resultado atual das
       vagas 182493 (1.521 inscritos), 182514 e 182528 com o quadro que o job
       manda (p_resumo.quadro) em menos de 3 s cada, sem mudança no histórico, e
       a linha do quadro gravada é a de FC_QUADRO_DA_VAGA_EMPREGARE; sem a chave
       quadro, o banco acha a mesma linha; quadro de outro edital é recusado
       (22023);
    3. abrir_fichas_pre_classificacao em menos de 3 s, com as fichas coerentes
       com o lote (NO_LOTE = fichas em análise ou pendentes; ninguém fora do
       lote com ficha aberta);
    4. os tempos (a última consulta mostra cada chamada, em ms).
*/
create temporary table t_tempos (chamada text, ms numeric, r jsonb) on commit drop;

do $$
declare
  v_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  v_exec constant text := 'precl-ensaio-20261014130000';
  v_versao integer;
  v_t timestamptz;
  v_r jsonb;
  v_vaga text;
  v_linhas jsonb;
  v_quadro uuid;
  v_outro uuid;
  v_n integer;
  v_m integer;
begin
  set local statement_timeout = '8s';

  -- 1. Fichas iniciadas: o conjunto conta o mesmo que a função por ficha.
  select count(*) into v_n
    from (select f."CO_MONITORAMENTO" as edital, count(*) filter (where private."FC_FICHA_INICIADA"(f)) as n
            from public."TB_FICHA_ANALISE" f group by 1) x
   where private."FC_FICHAS_INICIADAS"(x.edital) <> x.n;
  if v_n > 0 then
    raise exception 'ENSAIO 1: FC_FICHAS_INICIADAS difere da contagem por ficha em % edital(is)', v_n;
  end if;

  -- 2. Regrava o resultado atual (execução sem refazer: o lote fica como está).
  select r."NU_VERSAO_VIGENTE" into v_versao from public."TB_REGRA_ANALISE" r where r."CO_MONITORAMENTO" = v_edital;
  perform public.iniciar_pre_classificacao(v_exec, 'GITHUB', null, null, false, '["114/2026"]'::jsonb);
  foreach v_vaga in array array['182493', '182514', '182528'] loop
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', a."CO_EMPREGARE_CANDIDATO", 'situacao', a."TP_SITUACAO", 'motivo_codigo', a."CO_MOTIVO_ELIMINACAO",
             'motivo', a."DS_MOTIVO_ELIMINACAO", 'art', a."VL_ART", 'nota', a."VL_NOTA_ORDEM", 'origem_nota', a."TP_ORIGEM_NOTA",
             'declarada', a."VL_NOTA_DECLARADA", 'declarada_parciais', a."DS_NOTA_DECLARADA" -> 'parciais',
             'declarada_completa', (a."DS_NOTA_DECLARADA" ->> 'completa')::boolean,
             'sem_mapa', coalesce((a."DS_NOTA_DECLARADA" ->> 'sem_mapa')::integer, 0),
             'divergente', a."ST_DIVERGENTE" = 'S', 'modalidade', a."NO_MODALIDADE", 'posicao', a."NU_POSICAO",
             'posicao_modalidade', a."NU_POSICAO_MODALIDADE", 'lote', a."NU_LOTE", 'lista_lote', a."CO_LISTA_LOTE",
             'entrada', a."TP_ENTRADA_LOTE", 'motivo_entrada', a."DS_MOTIVO_ENTRADA")), '[]'::jsonb)
      into v_linhas
      from public."TB_PRE_CLASSIFICACAO" a
     where a."CO_MONITORAMENTO" = v_edital and a."CO_VAGA" = v_vaga;
    v_quadro := (private."FC_QUADRO_DA_VAGA_EMPREGARE"(v_edital, v_vaga))."CO_QUADRO_VAGA";

    v_t := clock_timestamp();
    v_r := public.gravar_pre_classificacao_vaga(v_exec, v_edital, v_vaga, v_versao,
             jsonb_build_object('tamanho', null, 'avisos', '[]'::jsonb, 'quadro', v_quadro), v_linhas);
    insert into t_tempos values ('gravar ' || v_vaga || ' (quadro do job)', extract(epoch from clock_timestamp() - v_t) * 1000, v_r);
    if extract(epoch from clock_timestamp() - v_t) > 3 then
      raise exception 'ENSAIO 2: gravar a vaga % levou mais de 3 s', v_vaga;
    end if;
    if (v_r ->> 'mudancas')::integer <> 0 then
      raise exception 'ENSAIO 2: regravar o mesmo resultado da vaga % mudou % linha(s)', v_vaga, v_r ->> 'mudancas';
    end if;
    if (select pv."CO_QUADRO_VAGA" from public."TB_PRE_CLASSIF_VAGA" pv
         where pv."CO_MONITORAMENTO" = v_edital and pv."CO_VAGA" = v_vaga) is distinct from v_quadro then
      raise exception 'ENSAIO 2: vaga % gravou outra linha do quadro', v_vaga;
    end if;
  end loop;

  -- Sem a chave quadro, o banco acha a mesma linha (o caminho de antes).
  v_t := clock_timestamp();
  v_r := public.gravar_pre_classificacao_vaga(v_exec, v_edital, v_vaga, v_versao,
           jsonb_build_object('tamanho', null, 'avisos', '[]'::jsonb), v_linhas);
  insert into t_tempos values ('gravar ' || v_vaga || ' (quadro lido no banco)', extract(epoch from clock_timestamp() - v_t) * 1000, v_r);
  if (select pv."CO_QUADRO_VAGA" from public."TB_PRE_CLASSIF_VAGA" pv
       where pv."CO_MONITORAMENTO" = v_edital and pv."CO_VAGA" = v_vaga) is distinct from v_quadro then
    raise exception 'ENSAIO 2: sem a chave quadro, a vaga % gravou outra linha', v_vaga;
  end if;

  -- Quadro de outro edital: recusado.
  select q."CO_QUADRO_VAGA" into v_outro from public."TB_QUADRO_VAGA_EDITAL" q
   where q."CO_MONITORAMENTO" <> v_edital and q."ST_REGISTRO_ATIVO" = 'S' limit 1;
  begin
    perform public.gravar_pre_classificacao_vaga(v_exec, v_edital, v_vaga, v_versao,
              jsonb_build_object('tamanho', null, 'avisos', '[]'::jsonb, 'quadro', v_outro), v_linhas);
    raise exception 'ENSAIO 2: quadro de outro edital foi aceito';
  exception when sqlstate '22023' then
    null;
  end;

  -- 3. Abrir as fichas no fim.
  v_t := clock_timestamp();
  v_r := public.abrir_fichas_pre_classificacao(v_exec, v_edital, '[]'::jsonb);
  insert into t_tempos values ('abrir_fichas', extract(epoch from clock_timestamp() - v_t) * 1000, v_r);
  if extract(epoch from clock_timestamp() - v_t) > 3 then
    raise exception 'ENSAIO 3: abrir as fichas levou mais de 3 s';
  end if;
  select count(*) into v_n from public."TB_PRE_CLASSIFICACAO" p
   where p."CO_MONITORAMENTO" = v_edital and p."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO');
  select count(*) into v_m from public."TB_FICHA_ANALISE" f
   where f."CO_MONITORAMENTO" = v_edital and f."TP_SITUACAO" <> 'FORA_LOTE';
  if v_n <> v_m then
    raise exception 'ENSAIO 3: % no lote e % fichas abertas', v_n, v_m;
  end if;
  if exists (select 1 from public."TB_FICHA_ANALISE" f
               join public."TB_PRE_CLASSIFICACAO" p
                 on p."CO_MONITORAMENTO" = f."CO_MONITORAMENTO" and p."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
              where f."CO_MONITORAMENTO" = v_edital
                and (f."TP_SITUACAO" = 'FORA_LOTE') = (p."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO'))) then
    raise exception 'ENSAIO 3: ficha fora do lote com o inscrito no lote (ou o contrário)';
  end if;
  perform public.finalizar_pre_classificacao(v_exec, '[]'::jsonb, null);
end $$;

select chamada, round(ms) as ms, r from t_tempos;
