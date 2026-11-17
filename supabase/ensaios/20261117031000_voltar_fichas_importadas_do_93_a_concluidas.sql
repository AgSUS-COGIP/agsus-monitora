/*
  ENSAIO de supabase/migrations/20261117031000_voltar_fichas_importadas_do_93_a_concluidas.sql:
  a 20261117030000 (de que esta depende) e esta, a conferência (94 fichas concluídas, cada linha
  igual à marca da planilha, republicar não muda a linha) e rollback. Sem dado pessoal.
*/

begin;

set local lock_timeout = '5s';

set local lock_timeout = '5s';

do $guarda$
begin
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.revisar_ficha_concluida_com_pendencia(uuid, integer)')), chr(13), ''))
       is distinct from '74f76bed07d51142bf13bebd5241ef6a' then
    raise exception 'revisar_ficha_concluida_com_pendencia mudou desde 16/11/2026: refaça a migration a partir do banco' using errcode = '55000';
  end if;
end
$guarda$;

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
  -- Importada da planilha (importar_avaliacao_da_planilha) e não reaberta depois: a análise foi
  -- feita lá, a ficha não tem os itens marcados e não tem pendência a conferir (16/11/2026).
  if jsonb_typeof(v_f."DS_LANCAMENTO" -> 'importada_da_planilha') = 'object'
     and not exists (select 1 from public."TH_FICHA_ANALISE" h
                      where h."CO_FICHA_ANALISE" = p_ficha and h."TP_ACAO" = 'REABRIR'
                        and h."NU_VERSAO" > coalesce(public.jsonb_int_or_null(v_f."DS_LANCAMENTO" -> 'importada_da_planilha', 'versao'), 0)) then
    return jsonb_build_object('alterada', false, 'motivo', 'ficha importada da planilha');
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


set local lock_timeout = '5s';

do $corrigir$
declare
  v_edital constant uuid := 'f57d77e1-7f6b-416c-9f9e-6e40c6d5bded';
  v_motivo constant text := 'Volta a concluída: a conferência automática mandou para revisão a ficha importada da planilha (sem itens marcados, a análise foi feita na planilha); o resultado é o da planilha.';
  v_usuario uuid;
  v_f record;
  v_m jsonb;
  v_qt integer;
  v_feitas integer := 0;
begin
  if position('ficha importada da planilha' in coalesce((select prosrc from pg_proc
       where oid = to_regprocedure('public.revisar_ficha_concluida_com_pendencia(uuid, integer)')), '')) = 0 then
    raise exception 'Aplique antes 20261117030000_conferencia_nao_revisa_ficha_importada.sql' using errcode = '55000';
  end if;
  select u.id into v_usuario from auth.users u where lower(u.email) = 'dados.recursoshumanos@agenciasus.org.br';
  if v_usuario is null then
    raise exception 'Usuário de quem pediu a correção não encontrado' using errcode = '55000';
  end if;

  create temp table tmp_a_corrigir on commit drop as
    select f."CO_FICHA_ANALISE" as ficha
      from public."TB_FICHA_ANALISE" f
     where f."CO_MONITORAMENTO" = v_edital
       and f."TP_SITUACAO" = 'REVISAR'
       and jsonb_typeof(f."DS_LANCAMENTO" -> 'importada_da_planilha') = 'object'
       and (select h."TP_ACAO" || '|' || h."TP_ORIGEM" from public."TH_FICHA_ANALISE" h
             where h."CO_FICHA_ANALISE" = f."CO_FICHA_ANALISE"
             order by h."DT_REGISTRO" desc, h."CO_HISTORICO_FICHA" desc limit 1) = 'REVISAR|JOB';
  select count(*) into v_qt from tmp_a_corrigir;
  if v_qt not between 90 and 94 then
    raise exception 'São % fichas a corrigir; a medição de 16/11/2026 deu 94. Confira antes.', v_qt using errcode = '55000';
  end if;

  for v_f in select f.* from public."TB_FICHA_ANALISE" f join tmp_a_corrigir t on t.ficha = f."CO_FICHA_ANALISE" loop
    update public."TB_FICHA_ANALISE" set
      "TP_SITUACAO" = 'CONCLUIDA',
      "CO_USUARIO_RESERVA" = null, "DT_RESERVA" = null, "DT_RESERVA_EXPIRA" = null,
      "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
     where "CO_FICHA_ANALISE" = v_f."CO_FICHA_ANALISE";
    perform private."FC_HISTORICO_CONTEUDO_FICHA"(v_f."CO_FICHA_ANALISE", 'CORRIGIR', 'REVISAR', v_motivo, v_usuario,
      jsonb_build_array(jsonb_build_object('campo', 'situacao', 'rotulo', 'Situação', 'de', 'REVISAR', 'para', 'CONCLUIDA')),
      null);

    v_m := v_f."DS_LANCAMENTO" -> 'importada_da_planilha';
    update public."TB_ANALISE_CURRICULAR" a set
      status_consolidado = v_m ->> 'status',
      etapa = v_m ->> 'etapa',
      modalidade_concorrencia = v_m ->> 'modalidade',
      pcd = v_m ->> 'pcd',
      pontuacao_escolaridade = (v_m -> 'parciais' ->> 'FORMACAO')::numeric,
      pontuacao_cursos_aperfeicoamento = (v_m -> 'parciais' ->> 'CURSOS')::numeric,
      pontuacao_experiencia_profissional = (v_m -> 'parciais' ->> 'EXPERIENCIA')::numeric,
      pontuacao_criterio_etnico = (v_m -> 'parciais' ->> 'ETNICO')::numeric,
      experiencia_saude_indigena_total = null,
      experiencia_atencao_basica_total = null,
      "TP_ORIGEM_REGISTRO" = 'MONITORA',
      updated_at = now(),
      ultima_atualizacao = now()
     where a.id = (v_m ->> 'linha')::uuid;
    v_feitas := v_feitas + 1;
  end loop;

  raise notice '% ficha(s) de volta a concluída, com a linha da planilha', v_feitas;
end
$corrigir$;


do $confere$
declare v jsonb;
begin
  select jsonb_build_object(
    'fichas', (select jsonb_object_agg(s, n) from (select "TP_SITUACAO" s, count(*) n from public."TB_FICHA_ANALISE" where "CO_MONITORAMENTO"='f57d77e1-7f6b-416c-9f9e-6e40c6d5bded' group by 1) x),
    'linhas', (select jsonb_object_agg(s, n) from (select status_consolidado||'/'||ativo s, count(*) n from public."TB_ANALISE_CURRICULAR" where edital='93/2026' group by 1) y),
    'difere_da_marca', (select count(*) from public."TB_FICHA_ANALISE" f join public."TB_ANALISE_CURRICULAR" a on a.id=(f."DS_LANCAMENTO"->'importada_da_planilha'->>'linha')::uuid
        where f."CO_MONITORAMENTO"='f57d77e1-7f6b-416c-9f9e-6e40c6d5bded' and (a.status_consolidado is distinct from f."DS_LANCAMENTO"->'importada_da_planilha'->>'status'
          or a.modalidade_concorrencia is distinct from f."DS_LANCAMENTO"->'importada_da_planilha'->>'modalidade'
          or a.pcd is distinct from f."DS_LANCAMENTO"->'importada_da_planilha'->>'pcd'
          or a.etapa is distinct from f."DS_LANCAMENTO"->'importada_da_planilha'->>'etapa'
          or a.nota_final_ajustada is distinct from (f."DS_LANCAMENTO"->'importada_da_planilha'->>'nota_final')::numeric)),
    'republicar_mexe', 0) into v;
  -- Republicar não muda a linha.
  perform private."FC_PUBLICAR_FICHA_ANALISE"(f."CO_FICHA_ANALISE") from public."TB_FICHA_ANALISE" f where f."CO_MONITORAMENTO"='f57d77e1-7f6b-416c-9f9e-6e40c6d5bded' and f."TP_SITUACAO"='CONCLUIDA';
  if (select count(*) from public."TB_FICHA_ANALISE" f join public."TB_ANALISE_CURRICULAR" a on a.id=(f."DS_LANCAMENTO"->'importada_da_planilha'->>'linha')::uuid
        where f."CO_MONITORAMENTO"='f57d77e1-7f6b-416c-9f9e-6e40c6d5bded' and a.status_consolidado is distinct from f."DS_LANCAMENTO"->'importada_da_planilha'->>'status') > 0 then
    raise exception 'ENSAIO: republicar mudou a linha';
  end if;
  if (v->>'difere_da_marca')::int <> 0 or coalesce((v->'fichas'->>'CONCLUIDA')::int,0) <> 94 then
    raise exception 'ENSAIO: fora do esperado %', v;
  end if;
  raise notice 'ENSAIO OK: %', v;
end
$confere$;

rollback;
