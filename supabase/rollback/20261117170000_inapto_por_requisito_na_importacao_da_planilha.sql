/*
  ROLLBACK de supabase/migrations/20261117170000_inapto_por_requisito_na_importacao_da_planilha.sql

  Devolve FC_IMPORTAR_AVALIACAO_DA_PLANILHA como estava em 17/11/2026 (o texto igual; o corpo volta
  com LF) e as 14 fichas do 93/2026 a Inapto por nota com a nota da planilha (a da marca da
  importação), com histórico CORRIGIR.
*/

begin;

set local lock_timeout = '5s';

create or replace function private."FC_IMPORTAR_AVALIACAO_DA_PLANILHA"(p_edital uuid, p_motivo text, p_usuario uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  v_motivo text := btrim(coalesce(p_motivo, ''));
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
    v_resultado := case
      when v_l.status_consolidado = 'Aprovado' then 'APTO'
      when coalesce(v_l.nota_final_ajustada, 0) = 0 then 'INAPTO_REQUISITO'
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

do $voltar$
declare
  v_usuario uuid;
  v_f public."TB_FICHA_ANALISE";
  v_nota numeric;
begin
  select u.id into v_usuario from auth.users u where lower(u.email) = 'dados.recursoshumanos@agenciasus.org.br';
  for v_f in
    select f.* from public."TB_FICHA_ANALISE" f
     where f."CO_MONITORAMENTO" = 'f57d77e1-7f6b-416c-9f9e-6e40c6d5bded'
       and f."TP_RESULTADO" = 'INAPTO_REQUISITO'
       and exists (select 1 from public."TH_FICHA_ANALISE" h
                    where h."CO_FICHA_ANALISE" = f."CO_FICHA_ANALISE" and h."TP_ACAO" = 'CORRIGIR'
                      and h."DS_MOTIVO" like 'Inapto por requisito: a planilha só dizia Reprovado%')
  loop
    v_nota := (v_f."DS_LANCAMENTO" -> 'importada_da_planilha' ->> 'nota_final')::numeric;
    update public."TB_FICHA_ANALISE" set
      "TP_RESULTADO" = 'INAPTO_NOTA', "VL_NOTA_FINAL" = v_nota,
      "DS_RESULTADO" = "DS_RESULTADO" || jsonb_build_object('resultado', 'INAPTO_NOTA', 'nota_final', v_nota),
      "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
     where "CO_FICHA_ANALISE" = v_f."CO_FICHA_ANALISE";
    perform private."FC_HISTORICO_CONTEUDO_FICHA"(v_f."CO_FICHA_ANALISE", 'CORRIGIR', 'CONCLUIDA',
      'Rollback de 20261117170000: volta a Inapto por nota.', v_usuario,
      jsonb_build_array(jsonb_build_object('campo', 'resultado', 'rotulo', 'Resultado', 'de', 'INAPTO_REQUISITO', 'para', 'INAPTO_NOTA')),
      null);
  end loop;
end
$voltar$;

commit;
