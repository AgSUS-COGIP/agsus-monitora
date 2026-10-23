/*
  Rollback de 20261023091000_anos_meses_dias_no_painel.sql: FC_PUBLICAR_FICHA_ANALISE volta à conversão anterior (a de 20261022120000, viva em
  22/10/2026). As linhas acertadas voltam a ter a conversão antiga na próxima publicação de
  cada ficha; o total de dias nunca mudou.
*/
begin;

CREATE OR REPLACE FUNCTION private."FC_PUBLICAR_FICHA_ANALISE"(p_ficha uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_f public."TB_FICHA_ANALISE";
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_c public."TB_EMPREGARE_CANDIDATO";
  v_p public."TB_PRE_CLASSIFICACAO";
  v_pv public."TB_PRE_CLASSIF_VAGA";
  v_grupo text;
  v_planilha text;
  v_numero text;
  v_codigo text;
  v_chave text;
  v_id uuid;
  v_com_nota boolean;
  v_inapto_requisito boolean;
  v_status text;
  v_etapa text;
  v_responsavel text;
  v_data date;
  v_nome_vaga text;
  v_modalidade text;
  v_pcd text;
  v_cotas text[];
  v_parciais jsonb;
  v_exp jsonb;
  v_dias integer;
  v_exp_si numeric;
  v_exp_ab numeric;
  v_formacao numeric;
  v_cursos numeric;
  v_experiencia numeric;
  v_etnico numeric;
begin
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha;
  if not found then
    return null;
  end if;
  -- Só o edital com a avaliação no MONITORA publica (PLANILHA e COMPARACAO não).
  if not exists (select 1 from public."TB_ORIGEM_ANALISE_EDITAL" o
                  where o."CO_MONITORAMENTO" = v_f."CO_MONITORAMENTO" and o."TP_ORIGEM" = 'MONITORA') then
    return null;
  end if;

  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = v_f."CO_MONITORAMENTO";
  select a."NO_GRUPO_PLANILHA" into v_grupo from public."TB_AREA" a where a."CO_AREA" = v_m."CO_AREA";
  select p."CO_PLANILHA" into v_planilha
    from public."TB_PLANILHA_ANALISE" p
   where p."CO_AREA" = v_m."CO_AREA"
   order by p."CO_PLANILHA" = v_m."CO_AREA" desc, p."CO_PLANILHA"
   limit 1;
  if v_grupo is null or v_planilha is null then
    raise exception 'Área % sem grupo ou planilha de análises: a ficha não tem onde publicar', v_m."CO_AREA"
      using errcode = '23514';
  end if;

  select * into v_c from public."TB_EMPREGARE_CANDIDATO" where "CO_EMPREGARE_CANDIDATO" = v_f."CO_EMPREGARE_CANDIDATO";
  select * into v_p from public."TB_PRE_CLASSIFICACAO"
   where "CO_MONITORAMENTO" = v_f."CO_MONITORAMENTO" and "CO_EMPREGARE_CANDIDATO" = v_f."CO_EMPREGARE_CANDIDATO";
  select * into v_pv from public."TB_PRE_CLASSIF_VAGA"
   where "CO_MONITORAMENTO" = v_f."CO_MONITORAMENTO" and "CO_VAGA" = v_f."CO_VAGA";

  -- Situação e etapa no vocabulário da planilha (o que o painel e a Classificação leem).
  v_com_nota := v_f."TP_RESULTADO" is not null and v_f."TP_SITUACAO" in ('CONCLUIDA', 'REVISAR');
  v_inapto_requisito := v_f."TP_RESULTADO" = 'INAPTO_REQUISITO';
  v_status := case
    when v_f."TP_SITUACAO" = 'CONCLUIDA' and v_f."TP_RESULTADO" = 'APTO' then 'Aprovado'
    when v_f."TP_SITUACAO" = 'CONCLUIDA' then 'Reprovado'
    when v_f."TP_SITUACAO" = 'REVISAR' then 'Revisar'
    when v_f."TP_SITUACAO" = 'EM_ANALISE' then 'Em análise'
    -- Fora do lote não é análise pendente: situação própria, que o painel não lista (20261022120000).
    when v_f."TP_SITUACAO" = 'FORA_LOTE' then 'Fora do lote'
    else 'Pendente'
  end;
  -- Etapa só com decisão, como na planilha (sem decisão, nem etapa nem data).
  v_etapa := case
    when v_status = 'Aprovado' then 'Triados'
    when v_status = 'Reprovado' then 'Reprovado'
    when v_status = 'Revisar' then 'Avaliação documental'
  end;
  -- Nome e sobrenome do cadastro (FC_NOME_E_SOBRENOME, 20261016120000), como no Painel das análises.
  select coalesce(private."FC_NOME_E_SOBRENOME"(u.nome), u.email) into v_responsavel
    from public."TB_PERFIL_USUARIO" u
   where u.user_id = coalesce(case when v_com_nota then v_f."CO_USUARIO_CONCLUSAO" end, v_f."CO_USUARIO_RESPONSAVEL")
   order by u.ativo desc nulls last
   limit 1;
  v_data := case when v_com_nota
                 then (coalesce(v_f."DT_CONCLUSAO", v_f."DT_ATUALIZACAO") at time zone 'America/Sao_Paulo')::date end;

  -- O nome da vaga pelo cargo e lotação da pré-classificação (FC_NOME_VAGA_PUBLICADA, 20261015151000).
  v_nome_vaga := private."FC_NOME_VAGA_PUBLICADA"(v_f."CO_MONITORAMENTO", v_f."CO_VAGA");
  -- A modalidade e a PcD pelas cotas da ficha (20261015150000): antes da análise, as optadas;
  -- analisada, as confirmadas (sem as de bloco Não conforme/Não enviado). Todas vão para a
  -- linha ("Pretos e pardos | Pessoas com deficiência (PCD)"): a Classificação põe o candidato
  -- nas listas de todas na preliminar (5.8.7) e, na final, só na de maior percentual (5.8.5 e
  -- 5.8.6, cotas.acumulo da regra de classificação). Nenhuma: "Ampla concorrência".
  v_cotas := private."FC_MODALIDADES_DA_FICHA"(p_ficha);
  v_modalidade := private."FC_MODALIDADES_PUBLICADAS"(v_cotas);
  v_pcd := private."FC_PCD_DAS_MODALIDADES"(v_cotas);

  -- Parciais e experiência só da ficha concluída (ou em revisão); inapto por requisito vale 0.
  if v_com_nota then
    v_parciais := v_f."DS_RESULTADO" -> 'parciais';
    v_exp := v_f."DS_RESULTADO" -> 'experiencia';
    v_formacao := case when v_inapto_requisito then 0 else coalesce(public.jsonb_num_or_null(v_parciais, 'FORMACAO'), 0) end;
    v_cursos := case when v_inapto_requisito then 0 else coalesce(public.jsonb_num_or_null(v_parciais, 'CURSOS'), 0) end;
    v_experiencia := case when v_inapto_requisito then 0 else coalesce(public.jsonb_num_or_null(v_parciais, 'EXPERIENCIA'), 0) end;
    v_etnico := case when v_inapto_requisito then 0 else coalesce(public.jsonb_num_or_null(v_parciais, 'ETNICO'), 0) end;
    v_dias := public.jsonb_int_or_null(v_exp, 'dias_total');
    if jsonb_typeof(v_exp -> 'por_categoria') = 'object' then
      select sum(public.jsonb_num_or_null(c.value, 'dias_total')) filter (where c.key ilike '%indigen%'),
             sum(public.jsonb_num_or_null(c.value, 'dias_total')) filter (where c.key ilike '%atenc%basic%' or c.key ilike '%aps%')
        into v_exp_si, v_exp_ab
        from jsonb_each(v_exp -> 'por_categoria') c
       where jsonb_typeof(c.value) = 'object';
    end if;
  end if;

  -- A linha: a da ficha, ou a da planilha (mesmo edital, vaga e código), adotada; MONITORA primeiro.
  v_numero := private."FC_NUMERO_EDITAL"(v_m.edital);
  v_codigo := nullif(btrim(v_c."CO_CANDIDATO_EMPREGARE"), '');
  v_chave := 'monitora|' || v_f."CO_MONITORAMENTO" || '|' || v_f."CO_EMPREGARE_CANDIDATO";
  select a.id into v_id from public."TB_ANALISE_CURRICULAR" a where a.chave_natural = v_chave;
  if v_id is null and v_codigo is not null and v_numero is not null then
    select a.id into v_id
      from public."TB_ANALISE_CURRICULAR" a
     where btrim(a.id_origem) = v_codigo
       and a.codigo_vaga = v_f."CO_VAGA"
       and a."CO_AREA" = v_m."CO_AREA"
       and private."FC_NUMERO_EDITAL"(a.edital) = v_numero
     order by a."TP_ORIGEM_REGISTRO" = 'MONITORA' desc, a.ativo desc, a.updated_at desc, a.id
     limit 1;
  end if;

  if v_id is null then
    insert into public."TB_ANALISE_CURRICULAR" (
      chave_natural, grupo, unidade, edital, codigo_vaga, nome_vaga, candidato, id_origem, data_nascimento,
      modalidade_concorrencia, pcd, nota_empregare, status_consolidado, etapa, responsavel_analise, data_analise,
      nota_final_ajustada, somatorio, pontuacao_escolaridade, pontuacao_cursos_aperfeicoamento,
      pontuacao_experiencia_profissional, pontuacao_criterio_etnico, experiencia_saude_indigena_total,
      experiencia_atencao_basica_total, experiencia_profissional_anos, experiencia_profissional_meses,
      experiencia_profissional_dias, experiencia_profissional_total, analise, origem_planilha, ativo,
      ultima_atualizacao, "CO_PLANILHA", "TP_ORIGEM_REGISTRO")
    values (
      v_chave, v_grupo, coalesce(nullif(btrim(v_m.unidade), ''), 'Não informada'), coalesce(nullif(btrim(v_m.edital), ''), 'Sem edital'),
      v_f."CO_VAGA", v_nome_vaga, v_c."NO_CANDIDATO", v_codigo, v_c."DT_NASCIMENTO",
      v_modalidade, v_pcd, v_p."VL_ART", v_status, v_etapa, v_responsavel, v_data,
      case when v_com_nota then v_f."VL_NOTA_FINAL" end, case when v_com_nota then v_f."VL_NOTA_APURADA" end,
      v_formacao, v_cursos, v_experiencia, v_etnico, v_exp_si, v_exp_ab,
      v_dias / 365, (v_dias % 365) / 30, (v_dias % 365) % 30, v_dias,
      case when v_com_nota then v_f."DS_PARECER" end,
      case when private."FC_EH_TREINAMENTO"(v_m."ST_TREINAMENTO") then 'treinamento' end,
      v_f."TP_SITUACAO" <> 'FORA_LOTE', now(), v_planilha, 'MONITORA')
    returning id into v_id;
    return v_id;
  end if;

  -- Linha existente: edital, unidade e grupo ficam (a linha adotada mantém a identidade da planilha).
  update public."TB_ANALISE_CURRICULAR" a set
    codigo_vaga = v_f."CO_VAGA",
    nome_vaga = coalesce(v_nome_vaga, a.nome_vaga),
    candidato = coalesce(v_c."NO_CANDIDATO", a.candidato),
    id_origem = coalesce(v_codigo, a.id_origem),
    data_nascimento = coalesce(v_c."DT_NASCIMENTO", a.data_nascimento),
    modalidade_concorrencia = coalesce(v_modalidade, a.modalidade_concorrencia),
    pcd = v_pcd,
    nota_empregare = coalesce(v_p."VL_ART", a.nota_empregare),
    status_consolidado = v_status,
    etapa = v_etapa,
    responsavel_analise = v_responsavel,
    data_analise = v_data,
    nota_final_ajustada = case when v_com_nota then v_f."VL_NOTA_FINAL" end,
    somatorio = case when v_com_nota then v_f."VL_NOTA_APURADA" end,
    pontuacao_escolaridade = v_formacao,
    pontuacao_cursos_aperfeicoamento = v_cursos,
    pontuacao_experiencia_profissional = v_experiencia,
    pontuacao_criterio_etnico = v_etnico,
    experiencia_saude_indigena_total = v_exp_si,
    experiencia_atencao_basica_total = v_exp_ab,
    experiencia_profissional_anos = v_dias / 365,
    experiencia_profissional_meses = (v_dias % 365) / 30,
    experiencia_profissional_dias = (v_dias % 365) % 30,
    experiencia_profissional_total = v_dias,
    analise = case when v_com_nota then v_f."DS_PARECER" end,
    ativo = v_f."TP_SITUACAO" <> 'FORA_LOTE',
    "TP_ORIGEM_REGISTRO" = 'MONITORA',
    ultima_atualizacao = now()
   where a.id = v_id
     and (a.codigo_vaga, a.nome_vaga, a.candidato, a.id_origem, a.data_nascimento, a.modalidade_concorrencia, a.pcd,
          a.nota_empregare, a.status_consolidado, a.etapa, a.responsavel_analise, a.data_analise, a.nota_final_ajustada,
          a.somatorio, a.pontuacao_escolaridade, a.pontuacao_cursos_aperfeicoamento, a.pontuacao_experiencia_profissional,
          a.pontuacao_criterio_etnico, a.experiencia_saude_indigena_total, a.experiencia_atencao_basica_total,
          a.experiencia_profissional_total, a.analise, a.ativo, a."TP_ORIGEM_REGISTRO")
         is distinct from
         (v_f."CO_VAGA"::text, coalesce(v_nome_vaga, a.nome_vaga), coalesce(v_c."NO_CANDIDATO"::text, a.candidato),
          coalesce(v_codigo, a.id_origem), coalesce(v_c."DT_NASCIMENTO", a.data_nascimento),
          private.normalizar_modalidade_concorrencia(coalesce(v_modalidade, a.modalidade_concorrencia)), v_pcd,
          coalesce(v_p."VL_ART", a.nota_empregare), v_status, v_etapa, v_responsavel, v_data,
          case when v_com_nota then v_f."VL_NOTA_FINAL" end, case when v_com_nota then v_f."VL_NOTA_APURADA" end,
          v_formacao, v_cursos, v_experiencia, v_etnico, v_exp_si, v_exp_ab, v_dias::numeric,
          case when v_com_nota then v_f."DS_PARECER" end, v_f."TP_SITUACAO" <> 'FORA_LOTE', 'MONITORA'::varchar);
  return v_id;
end;
$function$;

commit;
