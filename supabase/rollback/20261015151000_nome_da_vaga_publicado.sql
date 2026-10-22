/*
  Rollback de 20261015151000_nome_da_vaga_publicado.sql: FC_PUBLICAR_FICHA_ANALISE e
  FC_ABRIR_FICHAS como em 20261015150000; sai FC_NOME_VAGA_PUBLICADA.
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
    else 'Pendente'
  end;
  -- Etapa só com decisão, como na planilha (sem decisão, nem etapa nem data).
  v_etapa := case
    when v_status = 'Aprovado' then 'Triados'
    when v_status = 'Reprovado' then 'Reprovado'
    when v_status = 'Revisar' then 'Avaliação documental'
  end;
  select coalesce(nullif(btrim(u.nome), ''), u.email) into v_responsavel
    from public."TB_PERFIL_USUARIO" u
   where u.user_id = coalesce(case when v_com_nota then v_f."CO_USUARIO_CONCLUSAO" end, v_f."CO_USUARIO_RESPONSAVEL")
   order by u.ativo desc nulls last
   limit 1;
  v_data := case when v_com_nota
                 then (coalesce(v_f."DT_CONCLUSAO", v_f."DT_ATUALIZACAO") at time zone 'America/Sao_Paulo')::date end;

  v_nome_vaga := nullif(concat_ws(' - ', nullif(btrim(v_pv."NO_CARGO"), ''), nullif(btrim(v_pv."NO_LOTACAO"), '')), '');
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

CREATE OR REPLACE FUNCTION private."FC_ABRIR_FICHAS"(p_edital uuid, p_atribuicoes jsonb, p_usuario uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_regra public."TB_REGRA_ANALISE";
  v_atrib jsonb := coalesce(p_atribuicoes, '[]'::jsonb);
  v_item record;
  v_criados uuid[] := '{}';
  v_saem integer := 0;
  v_voltam integer := 0;
  v_atribuidas integer := 0;
  v_regra_nova integer := 0;
  v_modalidade integer := 0;
  v_republicadas integer := 0;
  v_publicar record;
  v_ficha public."TB_FICHA_ANALISE";
  v_origem constant text := case when p_usuario is null then 'JOB' else 'TELA' end;
begin
  -- Uma abertura por edital de cada vez (job e tela não se atropelam).
  perform pg_advisory_xact_lock(hashtextextended('avaliacao-documental:fichas:' || p_edital::text, 0));
  select * into v_regra from public."TB_REGRA_ANALISE" where "CO_MONITORAMENTO" = p_edital;
  if v_regra."CO_REGRA_ANALISE" is null then
    raise exception 'O edital ainda não tem regra da avaliação' using errcode = '22023';
  end if;
  if jsonb_typeof(v_atrib) <> 'array' or jsonb_array_length(v_atrib) > 20000 then
    raise exception 'Atribuições inválidas (lista de até 20.000)' using errcode = '22023';
  end if;

  -- Seguem o último recálculo: a ficha ainda não concluída fica com a versão da regra da
  -- pré-classificação atual; a concluída mantém a versão com que foi analisada.
  update public."TB_FICHA_ANALISE" f
     set "NU_VERSAO_REGRA" = p."NU_VERSAO_REGRA", "DT_ATUALIZACAO" = now()
    from public."TB_PRE_CLASSIFICACAO" p
   where p."CO_MONITORAMENTO" = f."CO_MONITORAMENTO" and p."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
     and f."CO_MONITORAMENTO" = p_edital
     and f."TP_SITUACAO" <> 'CONCLUIDA'
     and f."NU_VERSAO_REGRA" is distinct from p."NU_VERSAO_REGRA";
  get diagnostics v_regra_nova = row_count;

  -- Saem do lote: eliminados (ou fora do recorte) com ficha aberta. A ficha fica, com o motivo.
  -- Fora do lote refeito (a execução da linha refez o lote): "Lote refeito em dd/mm", ação REFAZER_LOTE.
  -- O histórico (o mesmo de FC_HISTORICO_FICHA) sai no mesmo comando, com a ficha já atualizada.
  with alvo as (
    select f."CO_FICHA_ANALISE" as ficha, f."TP_SITUACAO" as situacao, f."CO_USUARIO_RESPONSAVEL" as responsavel,
           left(case when p."TP_SITUACAO" = 'RANQUEADO' and t."CO_EXECUCAO" is not null
                     then 'Lote refeito em ' || to_char(t."DT_INICIO" at time zone 'America/Sao_Paulo', 'DD/MM')
                     else coalesce(p."DS_MOTIVO_ELIMINACAO", 'Saiu do lote de convocação') end, 300) as motivo,
           case when p."TP_SITUACAO" = 'RANQUEADO' and t."CO_EXECUCAO" is not null
                then 'REFAZER_LOTE' else 'SAIR_LOTE' end as acao
      from public."TB_FICHA_ANALISE" f
      join public."TB_PRE_CLASSIFICACAO" p
        on p."CO_MONITORAMENTO" = f."CO_MONITORAMENTO" and p."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
      left join public."TL_PRE_CLASSIFICACAO" t on t."CO_EXECUCAO" = p."CO_EXECUCAO" and t."ST_REFAZER_LOTE" = 'S'
     where f."CO_MONITORAMENTO" = p_edital
       and f."TP_SITUACAO" in ('PENDENTE', 'EM_ANALISE', 'REVISAR')
       and p."TP_SITUACAO" in ('ELIMINADO', 'RANQUEADO')
  ),
  saiu as (
    update public."TB_FICHA_ANALISE" f set
      "TP_SITUACAO" = 'FORA_LOTE', "DS_MOTIVO_SAIDA" = a.motivo,
      "CO_USUARIO_RESERVA" = null, "DT_RESERVA" = null, "DT_RESERVA_EXPIRA" = null,
      "NU_VERSAO" = f."NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
      from alvo a
     where f."CO_FICHA_ANALISE" = a.ficha
    returning f."CO_FICHA_ANALISE" as ficha, f."NU_VERSAO" as versao, f."TP_SITUACAO" as situacao,
              f."CO_USUARIO_RESPONSAVEL" as responsavel, a.acao, a.situacao as situacao_anterior,
              a.responsavel as responsavel_anterior, a.motivo
  )
  insert into public."TH_FICHA_ANALISE"
    ("CO_FICHA_ANALISE", "NU_VERSAO", "TP_ACAO", "TP_SITUACAO_ANTERIOR", "TP_SITUACAO", "CO_USUARIO_RESP_ANTERIOR",
     "CO_USUARIO_RESPONSAVEL", "DS_MOTIVO", "TP_ORIGEM", "CO_USUARIO")
  select s.ficha, s.versao, s.acao, s.situacao_anterior, s.situacao, s.responsavel_anterior, s.responsavel,
         nullif(left(btrim(coalesce(s.motivo, '')), 2000), ''), v_origem, p_usuario
    from saiu s;
  get diagnostics v_saem = row_count;

  -- Voltam ao lote: quem saiu e está no lote de novo recomeça livre na fila.
  with alvo as (
    select f."CO_FICHA_ANALISE" as ficha, f."CO_USUARIO_RESPONSAVEL" as responsavel,
           coalesce('Voltou ao lote refeito em ' || to_char(t."DT_INICIO" at time zone 'America/Sao_Paulo', 'DD/MM'),
                    p."DS_MOTIVO_ENTRADA", 'Voltou ao lote de convocação') as motivo
      from public."TB_FICHA_ANALISE" f
      join public."TB_PRE_CLASSIFICACAO" p
        on p."CO_MONITORAMENTO" = f."CO_MONITORAMENTO" and p."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
      left join public."TL_PRE_CLASSIFICACAO" t on t."CO_EXECUCAO" = p."CO_EXECUCAO" and t."ST_REFAZER_LOTE" = 'S'
     where f."CO_MONITORAMENTO" = p_edital and f."TP_SITUACAO" = 'FORA_LOTE'
       and p."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO')
  ),
  voltou as (
    update public."TB_FICHA_ANALISE" f set
      "TP_SITUACAO" = 'PENDENTE', "DS_MOTIVO_SAIDA" = null, "CO_USUARIO_RESPONSAVEL" = null, "DT_ATRIBUICAO" = null,
      "NU_VERSAO" = f."NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
      from alvo a
     where f."CO_FICHA_ANALISE" = a.ficha
    returning f."CO_FICHA_ANALISE" as ficha, f."NU_VERSAO" as versao, f."TP_SITUACAO" as situacao,
              f."CO_USUARIO_RESPONSAVEL" as responsavel, a.responsavel as responsavel_anterior, a.motivo
  )
  insert into public."TH_FICHA_ANALISE"
    ("CO_FICHA_ANALISE", "NU_VERSAO", "TP_ACAO", "TP_SITUACAO_ANTERIOR", "TP_SITUACAO", "CO_USUARIO_RESP_ANTERIOR",
     "CO_USUARIO_RESPONSAVEL", "DS_MOTIVO", "TP_ORIGEM", "CO_USUARIO")
  select v.ficha, v.versao, 'VOLTAR_LOTE', 'FORA_LOTE', v.situacao, v.responsavel_anterior, v.responsavel,
         nullif(left(btrim(coalesce(v.motivo, '')), 2000), ''), v_origem, p_usuario
    from voltou v;
  get diagnostics v_voltam = row_count;

  -- As cotas seguem a pré-classificação (20261015020000; a lista desde 20261015150000): a ficha
  -- não concluída com lançamento gravado passa às cotas optadas de agora (DS_LANCAMENTO.modalidades,
  -- a principal primeiro, e .modalidade = a principal): o bloco de cota passa a valer para quem optou
  -- e deixa de valer para quem não optou, com o histórico (MODALIDADE). Só muda o que difere (o
  -- lançamento antigo sem a lista vale pela modalidade única, FC_MODALIDADES_DO_LANCAMENTO). A
  -- concluída fica como foi analisada (reabra para conferir a cota).
  with alvo as (
    select f."CO_FICHA_ANALISE" as ficha, f."TP_SITUACAO" as situacao, f."CO_USUARIO_RESPONSAVEL" as responsavel,
           private."FC_MODALIDADES_DO_LANCAMENTO"(f."DS_LANCAMENTO") as de,
           private."FC_MODALIDADES_DO_LANCAMENTO"(jsonb_build_object('modalidades', p."DS_MODALIDADES")) as para,
           coalesce(nullif(btrim(p."NO_MODALIDADE"), ''), 'AC') as principal
      from public."TB_FICHA_ANALISE" f
      join public."TB_PRE_CLASSIFICACAO" p
        on p."CO_MONITORAMENTO" = f."CO_MONITORAMENTO" and p."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
     where f."CO_MONITORAMENTO" = p_edital
       and f."TP_SITUACAO" <> 'CONCLUIDA'
       and jsonb_typeof(f."DS_LANCAMENTO") = 'object'
       and (private."FC_MODALIDADES_DO_LANCAMENTO"(f."DS_LANCAMENTO")
              is distinct from private."FC_MODALIDADES_DO_LANCAMENTO"(jsonb_build_object('modalidades', p."DS_MODALIDADES"))
            or coalesce(nullif(btrim(f."DS_LANCAMENTO" ->> 'modalidade'), ''), 'AC')
              is distinct from coalesce(nullif(btrim(p."NO_MODALIDADE"), ''), 'AC'))
  ),
  mudou as (
    update public."TB_FICHA_ANALISE" f set
      "DS_LANCAMENTO" = f."DS_LANCAMENTO" || jsonb_build_object('modalidade', a.principal, 'modalidades', to_jsonb(a.para)),
      "NU_VERSAO" = f."NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
      from alvo a
     where f."CO_FICHA_ANALISE" = a.ficha
    returning f."CO_FICHA_ANALISE" as ficha, f."NU_VERSAO" as versao, a.situacao, a.responsavel, a.de, a.para
  )
  insert into public."TH_FICHA_ANALISE"
    ("CO_FICHA_ANALISE", "NU_VERSAO", "TP_ACAO", "TP_SITUACAO_ANTERIOR", "TP_SITUACAO", "CO_USUARIO_RESP_ANTERIOR",
     "CO_USUARIO_RESPONSAVEL", "DS_MOTIVO", "TP_ORIGEM", "CO_USUARIO")
  select m.ficha, m.versao, 'MODALIDADE', m.situacao, m.situacao, m.responsavel, m.responsavel,
         'Modalidade da pré-classificação: ' || coalesce(nullif(array_to_string(m.de, ' + '), ''), 'AC')
           || ' → ' || coalesce(nullif(array_to_string(m.para, ' + '), ''), 'AC'), v_origem, p_usuario
    from mudou m;
  get diagnostics v_modalidade = row_count;

  -- A linha publicada (TB_ANALISE_CURRICULAR) com as cotas de agora (FC_MODALIDADES_DA_FICHA:
  -- as optadas antes da análise, as confirmadas depois): a ficha (qualquer situação) cuja linha
  -- MONITORA difere é publicada de novo.
  for v_publicar in
    select s.ficha
      from (select f."CO_FICHA_ANALISE" as ficha, a.modalidade_concorrencia, a.pcd,
                   private."FC_MODALIDADES_DA_FICHA"(f."CO_FICHA_ANALISE") as cotas
              from public."TB_FICHA_ANALISE" f
              join public."TB_ANALISE_CURRICULAR" a
                on a.chave_natural = 'monitora|' || f."CO_MONITORAMENTO" || '|' || f."CO_EMPREGARE_CANDIDATO"
             where f."CO_MONITORAMENTO" = p_edital) s
     where s.modalidade_concorrencia is distinct from
             coalesce(private.normalizar_modalidade_concorrencia(private."FC_MODALIDADES_PUBLICADAS"(s.cotas)),
                      s.modalidade_concorrencia)
        or s.pcd is distinct from private."FC_PCD_DAS_MODALIDADES"(s.cotas)
  loop
    perform private."FC_PUBLICAR_FICHA_ANALISE"(v_publicar.ficha);
    v_republicadas := v_republicadas + 1;
  end loop;

  -- Entram: quem está no lote e ainda não tem ficha (uma por inscrito; "a linha anda" cria ficha nova).
  with entra as (
    select p."CO_EMPREGARE_CANDIDATO" as candidato, p."CO_VAGA" as vaga, p."NU_VERSAO_REGRA" as versao,
           p."NU_LOTE" as lote, p."NU_POSICAO" as posicao,
           coalesce('Entrou no lote refeito em ' || to_char(t."DT_INICIO" at time zone 'America/Sao_Paulo', 'DD/MM'),
                    p."DS_MOTIVO_ENTRADA", 'Entrou no lote ' || p."NU_LOTE") as motivo
      from public."TB_PRE_CLASSIFICACAO" p
      left join public."TL_PRE_CLASSIFICACAO" t on t."CO_EXECUCAO" = p."CO_EXECUCAO" and t."ST_REFAZER_LOTE" = 'S'
     where p."CO_MONITORAMENTO" = p_edital and p."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO')
       and not exists (select 1 from public."TB_FICHA_ANALISE" f
                        where f."CO_MONITORAMENTO" = p_edital and f."CO_EMPREGARE_CANDIDATO" = p."CO_EMPREGARE_CANDIDATO")
  ),
  nova as (
    insert into public."TB_FICHA_ANALISE"
      ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO", "CO_VAGA", "CO_REGRA_ANALISE", "NU_VERSAO_REGRA", "NU_LOTE")
    select p_edital, e.candidato, e.vaga, v_regra."CO_REGRA_ANALISE", e.versao, e.lote
      from entra e
     order by e.posicao, e.vaga, e.candidato
    returning *
  ),
  historico as (
    insert into public."TH_FICHA_ANALISE"
      ("CO_FICHA_ANALISE", "NU_VERSAO", "TP_ACAO", "TP_SITUACAO_ANTERIOR", "TP_SITUACAO", "CO_USUARIO_RESP_ANTERIOR",
       "CO_USUARIO_RESPONSAVEL", "DS_MOTIVO", "TP_ORIGEM", "CO_USUARIO")
    select n."CO_FICHA_ANALISE", n."NU_VERSAO", 'CRIAR', null, n."TP_SITUACAO", null, n."CO_USUARIO_RESPONSAVEL",
           nullif(left(btrim(coalesce(e.motivo, '')), 2000), ''), v_origem, p_usuario
      from nova n
      join entra e on e.candidato = n."CO_EMPREGARE_CANDIDATO"
    returning 1
  )
  select coalesce(array_agg(n."CO_EMPREGARE_CANDIDATO"), '{}') into v_criados from nova n;

  -- As fichas novas que já vão para alguém (quem entra depois, para quem tem menos pendentes).
  begin
    for v_item in
      select (a ->> 'candidato')::uuid as candidato, (a ->> 'usuario')::uuid as usuario
        from jsonb_array_elements(v_atrib) a
    loop
      select * into v_ficha from public."TB_FICHA_ANALISE"
       where "CO_MONITORAMENTO" = p_edital and "CO_EMPREGARE_CANDIDATO" = v_item.candidato
       for update;
      if v_item.candidato is null or not (v_item.candidato = any (v_criados)) or v_ficha."CO_USUARIO_RESPONSAVEL" is not null then
        raise exception 'Atribuição recusada: só a ficha aberta agora, uma vez' using errcode = '22023';
      end if;
      if v_item.usuario is null or not private."FC_PODE_ANALISAR_VAGA"(p_edital, v_item.usuario, v_ficha."CO_VAGA") then
        raise exception 'Atribuição recusada: a pessoa não analisa a vaga %', v_ficha."CO_VAGA" using errcode = '22023';
      end if;
      update public."TB_FICHA_ANALISE" set
        "CO_USUARIO_RESPONSAVEL" = v_item.usuario, "DT_ATRIBUICAO" = now(),
        "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
       where "CO_FICHA_ANALISE" = v_ficha."CO_FICHA_ANALISE";
      perform private."FC_HISTORICO_FICHA"(v_ficha."CO_FICHA_ANALISE", 'DISTRIBUIR', 'PENDENTE', null,
                                           'Entrou depois: para quem tem menos pendentes', p_usuario);
      v_atribuidas := v_atribuidas + 1;
    end loop;
  exception when invalid_text_representation then
    raise exception 'Atribuição com id inválido' using errcode = '22023';
  end;

  return jsonb_build_object('criadas', cardinality(v_criados), 'atribuidas', v_atribuidas,
                            'fora_do_lote', v_saem, 'voltaram', v_voltam, 'regra_atualizada', v_regra_nova,
                            'modalidade_atualizada', v_modalidade, 'republicadas', v_republicadas);
end;
$function$;

drop function if exists private."FC_NOME_VAGA_PUBLICADA"(uuid, text);

commit;
