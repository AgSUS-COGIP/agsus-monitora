/*
  INAPTO POR REQUISITO NA IMPORTAÇÃO DA PLANILHA (17/11/2026)

  POR QUE
  A importação da avaliação documental da planilha (20261116233000) traduziu o "Reprovado" da
  planilha como Inapto por requisito só com nota 0; com qualquer outra nota, Inapto por nota. A
  planilha guarda a nota de quem foi eliminado por requisito, então candidatos com nota acima da
  mínima (até 50 pontos, em 1º) ficaram "Inapto (nota mínima)" no 93/2026 — o que o sistema não
  deixa gravar (FC_VALIDAR_RESULTADO_FICHA: "Inapto por nota só abaixo da nota mínima").

  O QUE MUDA
    - private."FC_IMPORTAR_AVALIACAO_DA_PLANILHA": Reprovado com nota igual ou acima da nota mínima
      do edital (FC_DOCUMENTAL_DO_EDITAL) vira INAPTO_REQUISITO, com nota final 0 (como já era o
      Reprovado com nota 0).
    - 93/2026: as fichas importadas Inapto por nota com nota final igual ou acima da mínima (15)
      passam a Inapto por requisito, nota final 0 (a nota da planilha fica na marca da importação
      e em nota_apurada). Medidas: 14, todas com parecer de requisito. Histórico CORRIGIR, por
      quem pediu. A linha do Painel das análises não muda (ficha importada publica a linha da
      planilha), nem a Classificação. As 17 abaixo da mínima ficam como estão: a equipe confere
      uma a uma pelo parecer.

  GUARDA: o corpo de FC_IMPORTAR_AVALIACAO_DA_PLANILHA é o de 17/11/2026 (md5 do prosrc sem \r).
  Ensaio: supabase/ensaios/20261117170000_inapto_por_requisito_na_importacao_da_planilha.sql
  Rollback: supabase/rollback/20261117170000_inapto_por_requisito_na_importacao_da_planilha.sql
*/

begin;

set local lock_timeout = '5s';

do $guarda$
begin
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('private."FC_IMPORTAR_AVALIACAO_DA_PLANILHA"(uuid, text, uuid)')), chr(13), ''))
       is distinct from '810ea977d4bd4cf3d0b2ceba78515db5' then
    raise exception 'FC_IMPORTAR_AVALIACAO_DA_PLANILHA mudou desde 17/11/2026: refaça a migration a partir do banco' using errcode = '55000';
  end if;
end
$guarda$;

create or replace function private."FC_IMPORTAR_AVALIACAO_DA_PLANILHA"(p_edital uuid, p_motivo text, p_usuario uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  v_motivo text := btrim(coalesce(p_motivo, ''));
  -- A nota mínima do edital (a mesma de concluir_ficha; sem nível na planilha, a geral ou a menor
  -- por nível). Reprovado com nota igual ou acima dela não foi por nota: foi por requisito.
  v_minima numeric;
  v_p record;
  v_f public."TB_FICHA_ANALISE";
  v_l public."TB_ANALISE_CURRICULAR";
  v_problemas integer;
  v_concluidas integer := 0;
  v_saem integer := 0;
  v_resultado text;
  v_nota numeric;
  v_data timestamptz;
  v_usuario uuid;
  v_marca jsonb;
  v_retrato jsonb;
  v_motivo_saida text;
  v_troca json;
begin
  if p_usuario is null then
    raise exception 'Sessão necessária' using errcode = '42501';
  end if;
  if length(v_motivo) not between 10 and 2000 then
    raise exception 'Diga o motivo da importação (10 a 2.000 caracteres)' using errcode = '22023';
  end if;
  if not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital) then
    raise exception 'Edital não encontrado' using errcode = '22023';
  end if;
  -- A mesma trava da abertura do lote: job e tela não mexem nas fichas ao mesmo tempo.
  perform pg_advisory_xact_lock(hashtextextended('avaliacao-documental:fichas:' || p_edital::text, 0));
  if exists (select 1 from public."TB_ORIGEM_ANALISE_EDITAL" o
              where o."CO_MONITORAMENTO" = p_edital and o."TP_ORIGEM" = 'MONITORA') then
    raise exception 'A avaliação deste edital já está no Yeendé' using errcode = '22023';
  end if;
  select count(*) into v_problemas from private."FC_PLANO_IMPORTACAO_PLANILHA"(p_edital) x where x.problema is not null;
  if v_problemas > 0 then
    raise exception '% caso(s) impedem a importação: veja a prévia', v_problemas using errcode = '23514';
  end if;
  if not exists (select 1 from private."FC_PLANO_IMPORTACAO_PLANILHA"(p_edital) x where x.acao = 'CONCLUIR') then
    raise exception 'A planilha não tem resultado deste edital para importar' using errcode = '22023';
  end if;
  v_motivo_saida := 'Não avaliado na planilha (importação de '
                    || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY') || ')';

  for v_p in select * from private."FC_PLANO_IMPORTACAO_PLANILHA"(p_edital) x
              where x.acao in ('CONCLUIR', 'SAIR_LOTE') order by x.acao, x.ficha
  loop
    select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = v_p.ficha for update;

    if v_p.acao = 'SAIR_LOTE' then
      update public."TB_FICHA_ANALISE" set
        "TP_SITUACAO" = 'FORA_LOTE', "DS_MOTIVO_SAIDA" = v_motivo_saida,
        "CO_USUARIO_RESERVA" = null, "DT_RESERVA" = null, "DT_RESERVA_EXPIRA" = null,
        "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
       where "CO_FICHA_ANALISE" = v_f."CO_FICHA_ANALISE";
      perform private."FC_HISTORICO_CONTEUDO_FICHA"(v_f."CO_FICHA_ANALISE", 'SAIR_LOTE', v_f."TP_SITUACAO",
        v_motivo_saida, p_usuario, null, null);
      v_saem := v_saem + 1;
      continue;
    end if;

    select * into v_l from public."TB_ANALISE_CURRICULAR" where id = v_p.linha;
    if v_minima is null then
      select coalesce(
               case when jsonb_typeof(d -> 'nota_minima') = 'number' then (d ->> 'nota_minima')::numeric end,
               (select min(x.value::numeric) from jsonb_each_text(coalesce(d -> 'nota_minima_por_nivel', '{}'::jsonb)) x
                 where x.value ~ '^[0-9]+([.][0-9]+)?$'))
        into v_minima
        from (select private."FC_DOCUMENTAL_DO_EDITAL"(p_edital) d) dd;
    end if;
    v_resultado := case
      when v_l.status_consolidado = 'Aprovado' then 'APTO'
      when coalesce(v_l.nota_final_ajustada, 0) = 0 then 'INAPTO_REQUISITO'
      -- 17/11/2026: com a nota na mínima ou acima, a reprovação foi por requisito.
      when v_minima is not null and v_l.nota_final_ajustada >= v_minima then 'INAPTO_REQUISITO'
      else 'INAPTO_NOTA'
    end;
    v_nota := case when v_resultado = 'INAPTO_REQUISITO' then 0 else v_l.nota_final_ajustada end;
    -- A data da planilha (meio-dia em Brasília: o painel mostra o mesmo dia); sem data, a da linha.
    v_data := coalesce((v_l.data_analise + time '12:00') at time zone 'America/Sao_Paulo', v_l.ultima_atualizacao, now());
    v_usuario := coalesce(v_p.usuario, p_usuario);
    -- A marca guarda o que a planilha decidiu (a linha fica como está no painel).
    v_marca := jsonb_build_object(
      'linha', v_l.id, 'versao', v_f."NU_VERSAO" + 1, 'em', now(), 'por', p_usuario, 'motivo', v_motivo,
      'planilha', v_l."CO_PLANILHA", 'status', v_l.status_consolidado, 'etapa', v_l.etapa,
      'responsavel', v_l.responsavel_analise, 'responsavel_no_sistema', v_p.usuario is not null,
      'data', v_l.data_analise, 'nota_final', v_l.nota_final_ajustada, 'somatorio', v_l.somatorio,
      'parciais', jsonb_strip_nulls(jsonb_build_object(
        'FORMACAO', v_l.pontuacao_escolaridade, 'CURSOS', v_l.pontuacao_cursos_aperfeicoamento,
        'EXPERIENCIA', v_l.pontuacao_experiencia_profissional, 'ETNICO', v_l.pontuacao_criterio_etnico)),
      'experiencia_dias', v_l.experiencia_profissional_total,
      'modalidade', v_l.modalidade_concorrencia, 'pcd', v_l.pcd, 'link_pdf', v_l.link_pdf);
    -- O que a ficha tinha antes (a análise de teste no sistema, se houve) fica no histórico.
    v_retrato := case when v_f."DS_LANCAMENTO" is not null or v_f."DS_RESULTADO" is not null or v_f."DS_PARECER" is not null
                      then jsonb_build_object('lancamento', v_f."DS_LANCAMENTO", 'resultado', v_f."DS_RESULTADO",
                                              'parecer', v_f."DS_PARECER", 'situacao', v_f."TP_SITUACAO") end;

    update public."TB_FICHA_ANALISE" set
      "TP_SITUACAO" = 'CONCLUIDA',
      "TP_RESULTADO" = v_resultado,
      "VL_NOTA_FINAL" = v_nota,
      "VL_NOTA_APURADA" = least(greatest(coalesce(v_l.somatorio, v_nota), 0), 1000),
      "DS_PARECER" = v_l.analise,
      "DS_LANCAMENTO" = jsonb_build_object('importada_da_planilha', v_marca),
      "DS_RESULTADO" = jsonb_build_object(
        'resultado', v_resultado, 'nota_final', v_nota, 'nota_apurada', coalesce(v_l.somatorio, v_nota),
        'parciais', v_marca -> 'parciais',
        'experiencia', jsonb_strip_nulls(jsonb_build_object('dias_total', v_l.experiencia_profissional_total)),
        'importada_da_planilha', true),
      "DS_MOTIVO_SAIDA" = null,
      "CO_USUARIO_RESPONSAVEL" = v_usuario,
      "DT_ATRIBUICAO" = case when "CO_USUARIO_RESPONSAVEL" = v_usuario then coalesce("DT_ATRIBUICAO", v_data) else v_data end,
      "CO_USUARIO_RESERVA" = null, "DT_RESERVA" = null, "DT_RESERVA_EXPIRA" = null,
      "CO_USUARIO_RASCUNHO" = null, "DT_RASCUNHO" = null,
      "CO_USUARIO_CONCLUSAO" = v_usuario, "DT_CONCLUSAO" = v_data,
      "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
     where "CO_FICHA_ANALISE" = v_f."CO_FICHA_ANALISE";
    perform private."FC_HISTORICO_CONTEUDO_FICHA"(v_f."CO_FICHA_ANALISE", 'IMPORTAR', v_f."TP_SITUACAO",
      'Importada da planilha: ' || v_motivo, p_usuario,
      jsonb_build_array(jsonb_build_object('campo', 'origem', 'rotulo', 'Origem da análise',
        'de', null, 'para', 'PLANILHA', 'linha', v_l.id)),
      v_retrato);
    v_concluidas := v_concluidas + 1;
  end loop;

  -- O edital passa para o sistema: as fichas publicam (as importadas só adotam a linha).
  v_troca := private."FC_DEFINIR_ORIGEM_ANALISE"(p_edital, 'MONITORA', 'Importação da planilha: ' || v_motivo, p_usuario);
  return (v_troca::jsonb || jsonb_build_object('importadas', v_concluidas, 'fora_do_lote', v_saem))::json;
end;
$$;

-- 93/2026: Inapto por nota com nota na mínima ou acima vira Inapto por requisito.
do $corrigir$
declare
  v_edital constant uuid := 'f57d77e1-7f6b-416c-9f9e-6e40c6d5bded';
  v_motivo constant text := 'Inapto por requisito: a planilha só dizia Reprovado e a importação tomou a nota (igual ou acima da mínima de 15) como reprovação por nota; o parecer é de requisito.';
  v_minima numeric;
  v_usuario uuid;
  v_f public."TB_FICHA_ANALISE";
  v_qt integer;
  v_feitas integer := 0;
begin
  select (private."FC_DOCUMENTAL_DO_EDITAL"(v_edital) ->> 'nota_minima')::numeric into v_minima;
  if v_minima is distinct from 15 then
    raise exception 'A nota mínima do 93/2026 é %, não 15: confira antes.', v_minima using errcode = '55000';
  end if;
  select u.id into v_usuario from auth.users u where lower(u.email) = 'dados.recursoshumanos@agenciasus.org.br';
  if v_usuario is null then
    raise exception 'Usuário de quem pediu a correção não encontrado' using errcode = '55000';
  end if;

  create temp table tmp_inapto_requisito on commit drop as
    select f."CO_FICHA_ANALISE" as ficha
      from public."TB_FICHA_ANALISE" f
     where f."CO_MONITORAMENTO" = v_edital
       and f."TP_SITUACAO" = 'CONCLUIDA'
       and f."TP_RESULTADO" = 'INAPTO_NOTA'
       and jsonb_typeof(f."DS_LANCAMENTO" -> 'importada_da_planilha') = 'object'
       and f."VL_NOTA_FINAL" >= v_minima;
  select count(*) into v_qt from tmp_inapto_requisito;
  if v_qt <> 14 then
    raise exception 'São % fichas a corrigir; a medição de 17/11/2026 deu 14. Confira antes.', v_qt using errcode = '55000';
  end if;

  for v_f in select f.* from public."TB_FICHA_ANALISE" f join tmp_inapto_requisito t on t.ficha = f."CO_FICHA_ANALISE" loop
    update public."TB_FICHA_ANALISE" set
      "TP_RESULTADO" = 'INAPTO_REQUISITO',
      "VL_NOTA_FINAL" = 0,
      "DS_RESULTADO" = coalesce("DS_RESULTADO", '{}'::jsonb)
                       || jsonb_build_object('resultado', 'INAPTO_REQUISITO', 'nota_final', 0),
      "NU_VERSAO" = "NU_VERSAO" + 1,
      "DT_ATUALIZACAO" = now()
     where "CO_FICHA_ANALISE" = v_f."CO_FICHA_ANALISE";
    perform private."FC_HISTORICO_CONTEUDO_FICHA"(v_f."CO_FICHA_ANALISE", 'CORRIGIR', 'CONCLUIDA', v_motivo, v_usuario,
      jsonb_build_array(
        jsonb_build_object('campo', 'resultado', 'rotulo', 'Resultado', 'de', 'INAPTO_NOTA', 'para', 'INAPTO_REQUISITO'),
        jsonb_build_object('campo', 'nota_final', 'rotulo', 'Nota final', 'de', v_f."VL_NOTA_FINAL", 'para', 0)),
      null);
    v_feitas := v_feitas + 1;
  end loop;
  raise notice '93/2026: % ficha(s) passaram a Inapto por requisito', v_feitas;
end
$corrigir$;

commit;
