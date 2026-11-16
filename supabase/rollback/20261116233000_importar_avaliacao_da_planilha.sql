/*
  ROLLBACK de supabase/migrations/20261116233000_importar_avaliacao_da_planilha.sql

  Tira a prévia e a importação e devolve FC_PUBLICAR_FICHA_ANALISE e
  FC_DEFINIR_ORIGEM_ANALISE como estavam em 16/11/2026 (o texto igual; o corpo
  antigo de FC_DEFINIR_ORIGEM_ANALISE tinha quebras de linha CRLF, e volta com LF).

  As fichas importadas NÃO voltam (o resultado delas é o da planilha, e o
  histórico não se apaga). Por isso o rollback recusa se algum edital com
  ficha importada ainda está com a avaliação no sistema: com a função antiga,
  republicar essas fichas reescreveria a linha do painel. Antes, volte o
  edital para a planilha na tela (Avaliação documental › "Voltar para a
  planilha"). A ação IMPORTAR fica aceita no histórico se já houver registro dela.
*/

begin;

set local lock_timeout = '5s';

do $guarda$
declare
  v_editais integer;
begin
  select count(distinct f."CO_MONITORAMENTO") into v_editais
    from public."TB_FICHA_ANALISE" f
    join public."TB_ORIGEM_ANALISE_EDITAL" o on o."CO_MONITORAMENTO" = f."CO_MONITORAMENTO" and o."TP_ORIGEM" = 'MONITORA'
   where jsonb_typeof(f."DS_LANCAMENTO" -> 'importada_da_planilha') = 'object';
  if v_editais > 0 then
    raise exception '% edital(is) com ficha importada estão com a avaliação no sistema: volte-os para a planilha antes', v_editais
      using errcode = '55000';
  end if;
end
$guarda$;

drop function if exists public.importar_avaliacao_da_planilha(uuid, text);
drop function if exists public.previa_importacao_da_planilha(uuid);
drop function if exists private."FC_IMPORTAR_AVALIACAO_DA_PLANILHA"(uuid, text, uuid);
drop function if exists private."FC_PLANO_IMPORTACAO_PLANILHA"(uuid);

CREATE OR REPLACE FUNCTION private."FC_PUBLICAR_FICHA_ANALISE"(p_ficha uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
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
  v_amd jsonb;
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
    -- Anos (365), meses (30, até 11) e dias: 364 dias = 0 anos, 11 meses e 34 dias, não
    -- "0 anos, 12 meses e 4 dias" (FC_ANOS_MESES_DIAS, 20261023090000; anosMesesDias na tela).
    v_amd := case when v_dias is not null then private."FC_ANOS_MESES_DIAS"(v_dias) end;
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
      (v_amd ->> 'anos')::integer, (v_amd ->> 'meses')::integer, (v_amd ->> 'dias')::integer, v_dias,
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
    experiencia_profissional_anos = (v_amd ->> 'anos')::integer,
    experiencia_profissional_meses = (v_amd ->> 'meses')::integer,
    experiencia_profissional_dias = (v_amd ->> 'dias')::integer,
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
$$;

CREATE OR REPLACE FUNCTION private."FC_DEFINIR_ORIGEM_ANALISE"(p_edital uuid, p_origem text, p_motivo text, p_usuario uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  v_origem text := upper(btrim(coalesce(p_origem, '')));
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_anterior text;
  v_ficha uuid;
  v_publicadas integer := 0;
  v_devolvidas integer := 0;
  v_decididas integer := 0;
  v_seq integer;
begin
  if v_origem not in ('PLANILHA', 'COMPARACAO', 'MONITORA') then
    raise exception 'Dono da avaliação: PLANILHA, COMPARACAO ou MONITORA' using errcode = '22023';
  end if;
  if length(v_motivo) not between 10 and 2000 then
    raise exception 'Diga o motivo da troca (10 a 2.000 caracteres)' using errcode = '22023';
  end if;
  if p_usuario is null then
    raise exception 'Sessão necessária' using errcode = '42501';
  end if;
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  if not found then
    raise exception 'Edital não encontrado' using errcode = '22023';
  end if;

  select o."TP_ORIGEM" into v_anterior
    from public."TB_ORIGEM_ANALISE_EDITAL" o where o."CO_MONITORAMENTO" = p_edital for update;
  if coalesce(v_anterior, 'PLANILHA') = v_origem then
    return json_build_object('edital', p_edital, 'origem', v_origem, 'anterior', coalesce(v_anterior, 'PLANILHA'),
                             'mudou', false, 'publicadas', 0, 'devolvidas', 0);
  end if;
  -- Edital já decidido pela planilha não vira MONITORA por aqui: as fichas (do início)
  -- adotariam as linhas e apagariam o resultado no painel. Essa virada é a da fase F8.
  if v_origem = 'MONITORA' then
    select count(*) into v_decididas
      from public."TB_ANALISE_CURRICULAR" a
     where a.ativo
       and a."TP_ORIGEM_REGISTRO" = 'PLANILHA'
       and a."CO_AREA" = v_m."CO_AREA"
       and private."FC_NUMERO_EDITAL"(a.edital) = private."FC_NUMERO_EDITAL"(v_m.edital)
       and a.status_consolidado in ('Aprovado', 'Reprovado', 'Revisar')
       and not private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha);
    if v_decididas > 0 then
      raise exception 'O edital já tem % análise(s) decidida(s) pela planilha: a avaliação não passa para o MONITORA por aqui', v_decididas
        using errcode = '23514';
    end if;
  end if;

  insert into public."TB_ORIGEM_ANALISE_EDITAL" ("CO_MONITORAMENTO", "TP_ORIGEM", "CO_USUARIO_ATUALIZACAO", "DT_ATUALIZACAO")
  values (p_edital, v_origem, p_usuario, now())
  on conflict ("CO_MONITORAMENTO") do update set
    "TP_ORIGEM" = excluded."TP_ORIGEM",
    "CO_USUARIO_ATUALIZACAO" = excluded."CO_USUARIO_ATUALIZACAO",
    "DT_ATUALIZACAO" = excluded."DT_ATUALIZACAO";

  if v_origem = 'MONITORA' then
    -- As fichas que já existem passam a alimentar o painel (as da planilha do mesmo candidato são adotadas).
    for v_ficha in
      select f."CO_FICHA_ANALISE" from public."TB_FICHA_ANALISE" f
       where f."CO_MONITORAMENTO" = p_edital
       order by f."DT_CRIACAO", f."CO_FICHA_ANALISE"
    loop
      if private."FC_PUBLICAR_FICHA_ANALISE"(v_ficha) is not null then
        v_publicadas := v_publicadas + 1;
      end if;
    end loop;
  elsif v_anterior = 'MONITORA' then
    -- De volta à planilha: as linhas publicadas pelas fichas voltam a ser dela (a próxima carga manda).
    update public."TB_ANALISE_CURRICULAR" a
       set "TP_ORIGEM_REGISTRO" = 'PLANILHA', updated_at = now()
     where a."TP_ORIGEM_REGISTRO" = 'MONITORA'
       and a."CO_AREA" = v_m."CO_AREA"
       and private."FC_NUMERO_EDITAL"(a.edital) = private."FC_NUMERO_EDITAL"(v_m.edital);
    get diagnostics v_devolvidas = row_count;
  end if;

  select coalesce(max(h."NU_SEQUENCIA"), 0) + 1 into v_seq
    from public."TH_ORIGEM_ANALISE_EDITAL" h where h."CO_MONITORAMENTO" = p_edital;
  insert into public."TH_ORIGEM_ANALISE_EDITAL" ("CO_MONITORAMENTO", "NU_SEQUENCIA", "TP_ORIGEM_ANTERIOR", "TP_ORIGEM",
    "DS_MOTIVO", "DS_RESULTADO", "CO_USUARIO")
  values (p_edital, v_seq, v_anterior, v_origem, v_motivo,
          jsonb_build_object('publicadas', v_publicadas, 'devolvidas', v_devolvidas), p_usuario);

  -- A lista de editais do painel muda (o edital MONITORA entra com a janela própria).
  perform private."FC_MARCAR_CACHE"(array['ANALISES'], array[v_m."CO_AREA"], 'TB_ORIGEM_ANALISE_EDITAL');

  return json_build_object('edital', p_edital, 'origem', v_origem, 'anterior', coalesce(v_anterior, 'PLANILHA'),
                           'mudou', true, 'publicadas', v_publicadas, 'devolvidas', v_devolvidas);
end;
$$;

comment on function private."FC_DEFINIR_ORIGEM_ANALISE"(uuid, text, text, uuid) is 'Troca o dono da avaliação documental do edital (PLANILHA, COMPARACAO ou MONITORA) com motivo de 10 a 2.000 e histórico em TH_ORIGEM_ANALISE_EDITAL (com o resumo). Para MONITORA, recusa (23514) o edital que já tem análise decidida pela planilha (Aprovado, Reprovado ou Revisar; a virada com adoção é da F8) e publica as fichas que já existem (FC_PUBLICAR_FICHA_ANALISE); saindo de MONITORA, as linhas MONITORA do edital voltam a ser da planilha. Mesmo dono: não muda nada. Quem chama informa o autor. Sem grant: public.definir_origem_analise e o SQL Editor.';

do $restricao$
begin
  if not exists (select 1 from public."TH_FICHA_ANALISE" where "TP_ACAO" = 'IMPORTAR') then
    alter table public."TH_FICHA_ANALISE" drop constraint "CK_THFICHA_TPACAO";
    alter table public."TH_FICHA_ANALISE" add constraint "CK_THFICHA_TPACAO" check ((("TP_ACAO")::text = any (array['CRIAR'::text, 'PEGAR'::text, 'RESERVAR'::text, 'LIBERAR'::text, 'LIBERAR_RESERVA'::text, 'DISTRIBUIR'::text, 'REDISTRIBUIR'::text, 'DEVOLVER_FILA'::text, 'REVISAR'::text, 'SAIR_LOTE'::text, 'VOLTAR_LOTE'::text, 'SALVAR'::text, 'CONCLUIR'::text, 'REABRIR'::text, 'REINICIAR'::text, 'REFAZER_LOTE'::text, 'MODALIDADE'::text, 'CORRIGIR'::text])));
    comment on column public."TH_FICHA_ANALISE"."TP_ACAO" is 'CRIAR, PEGAR (Pegar próximo), RESERVAR (abriu), LIBERAR (fechou), LIBERAR_RESERVA (a coordenação liberou a reserva de outra pessoa), DISTRIBUIR, REDISTRIBUIR, DEVOLVER_FILA, REVISAR, SAIR_LOTE, VOLTAR_LOTE, SALVAR (rascunho com alteração: só o que mudou, sem retrato, desde 20261023220000), CONCLUIR, REABRIR, REINICIAR (o administrador global voltou as fichas do edital ao início), REFAZER_LOTE (a ficha intocada ficou fora do lote refeito do zero), MODALIDADE (a pré-classificação mudou a modalidade da ficha não concluída) ou CORRIGIR (correção de dados da ficha concluída, assinada pelo setor).';
  else
    raise notice 'Há histórico IMPORTAR: a ação continua aceita em TH_FICHA_ANALISE.';
  end if;
end
$restricao$;

commit;
