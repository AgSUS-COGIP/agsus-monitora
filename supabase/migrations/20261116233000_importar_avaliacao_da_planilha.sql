/*
  IMPORTAR A AVALIAÇÃO DOCUMENTAL DA PLANILHA (fase F8, pedido de 16/11/2026)

  POR QUE: em Projetos tudo passa a ser feito no sistema e as planilhas vão ser
  aposentadas. O 93/2026 (SESMT) é o único edital de Projetos com a avaliação
  ainda na planilha (60 aprovados e 34 reprovados), e a troca de dono
  (definir_origem_analise) recusa edital já decidido pela planilha.

  O QUE MUDA:
  - previa_importacao_da_planilha(p_edital): o que a importação faria e o que
    a impede (só lê).
  - importar_avaliacao_da_planilha(p_edital, p_motivo): cada linha Aprovado ou
    Reprovado da planilha vira a ficha CONCLUIDA do inscrito, com o resultado,
    a nota, o parecer e a data da planilha. O analista é o cadastro de mesmo
    nome (ou quem importa). A ficha leva a marca
    DS_LANCAMENTO.importada_da_planilha e o histórico IMPORTAR guarda o que ela
    tinha antes. A ficha em aberto sem linha na planilha sai do lote. No fim, o
    edital passa para o sistema.
  - FC_PUBLICAR_FICHA_ANALISE: a ficha importada não reescreve a linha da
    planilha (só a passa para o sistema), até ser reaberta; e a adoção não pega
    a linha que outra ficha importou.
  - FC_DEFINIR_ORIGEM_ANALISE: a linha importada não conta como "decidida pela
    planilha".
  - TH_FICHA_ANALISE.TP_ACAO aceita IMPORTAR.

  NÃO MUDA: a linha no Painel das análises, na Classificação e nas Entrevistas
  (é a mesma, com o mesmo id); nenhum dado é apagado.

  ANTES DE IMPORTAR: o edital inativo na DIM_EDITAIS da planilha de Projetos
  (senão a próxima carga de Projetos é recusada inteira).

  Ensaio: supabase/ensaios/20261116233000_importar_avaliacao_da_planilha.sql
  Rollback: supabase/rollback/20261116233000_importar_avaliacao_da_planilha.sql
*/

begin;

set local lock_timeout = '5s';

do $guarda$
begin
  if (select md5(replace(p.prosrc, chr(13), '')) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'private' and p.proname = 'FC_PUBLICAR_FICHA_ANALISE') is distinct from '6055c26fdaab06940f8182d6e7c35a30' then
    raise exception 'FC_PUBLICAR_FICHA_ANALISE mudou desde 16/11/2026: refaça a migration a partir do banco' using errcode = '55000';
  end if;
  if (select md5(replace(p.prosrc, chr(13), '')) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'private' and p.proname = 'FC_DEFINIR_ORIGEM_ANALISE') is distinct from '9ffbc16fb6e99a2b88ae822b8a793cb3' then
    raise exception 'FC_DEFINIR_ORIGEM_ANALISE mudou desde 16/11/2026: refaça a migration a partir do banco' using errcode = '55000';
  end if;
  if to_regprocedure('public.importar_avaliacao_da_planilha(uuid, text)') is not null then
    raise exception 'A importação já existe' using errcode = '55000';
  end if;
end
$guarda$;

alter table public."TH_FICHA_ANALISE" drop constraint "CK_THFICHA_TPACAO";
alter table public."TH_FICHA_ANALISE" add constraint "CK_THFICHA_TPACAO" check ((("TP_ACAO")::text = any (array['CRIAR'::text, 'PEGAR'::text, 'RESERVAR'::text, 'LIBERAR'::text, 'LIBERAR_RESERVA'::text, 'DISTRIBUIR'::text, 'REDISTRIBUIR'::text, 'DEVOLVER_FILA'::text, 'REVISAR'::text, 'SAIR_LOTE'::text, 'VOLTAR_LOTE'::text, 'SALVAR'::text, 'CONCLUIR'::text, 'REABRIR'::text, 'REINICIAR'::text, 'REFAZER_LOTE'::text, 'MODALIDADE'::text, 'CORRIGIR'::text, 'IMPORTAR'::text])));

comment on column public."TH_FICHA_ANALISE"."TP_ACAO" is 'CRIAR, PEGAR (Pegar próximo), RESERVAR (abriu), LIBERAR (fechou), LIBERAR_RESERVA (a coordenação liberou a reserva de outra pessoa), DISTRIBUIR, REDISTRIBUIR, DEVOLVER_FILA, REVISAR, SAIR_LOTE, VOLTAR_LOTE, SALVAR (rascunho com alteração: só o que mudou, sem retrato, desde 20261023220000), CONCLUIR, REABRIR, REINICIAR (o administrador global voltou as fichas do edital ao início), REFAZER_LOTE (a ficha intocada ficou fora do lote refeito do zero), MODALIDADE (a pré-classificação mudou a modalidade da ficha não concluída), CORRIGIR (correção de dados da ficha concluída, assinada pelo setor) ou IMPORTAR (o resultado veio da planilha: importar_avaliacao_da_planilha; o retrato guarda o que a ficha tinha).';

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

  -- Ficha importada da planilha (importar_avaliacao_da_planilha, 16/11/2026): a linha da
  -- planilha é o resultado e fica como está; só passa a ser do sistema. Vale enquanto a
  -- ficha está concluída e não foi reaberta depois da importação (reaberta, a análise é
  -- refeita no sistema e publica pelo caminho de sempre).
  if v_f."TP_SITUACAO" = 'CONCLUIDA'
     and jsonb_typeof(v_f."DS_LANCAMENTO" -> 'importada_da_planilha') = 'object'
     and not exists (select 1 from public."TH_FICHA_ANALISE" h
                      where h."CO_FICHA_ANALISE" = p_ficha
                        and h."TP_ACAO" = 'REABRIR'
                        and h."NU_VERSAO" > coalesce(public.jsonb_int_or_null(v_f."DS_LANCAMENTO" -> 'importada_da_planilha', 'versao'), 0)) then
    v_id := (v_f."DS_LANCAMENTO" -> 'importada_da_planilha' ->> 'linha')::uuid;
    update public."TB_ANALISE_CURRICULAR" a
       set "TP_ORIGEM_REGISTRO" = 'MONITORA', updated_at = now()
     where a.id = v_id and a."TP_ORIGEM_REGISTRO" is distinct from 'MONITORA';
    return v_id;
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
       -- A linha que outra ficha importou é dela (o mesmo código pode ter dois cadastros).
       and not exists (select 1 from public."TB_FICHA_ANALISE" f2
                        where f2."CO_MONITORAMENTO" = v_f."CO_MONITORAMENTO"
                          and f2."CO_FICHA_ANALISE" <> p_ficha
                          and f2."DS_LANCAMENTO" -> 'importada_da_planilha' ->> 'linha' = a.id::text)
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
       and not private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)
       -- A importada por uma ficha (importar_avaliacao_da_planilha) já é do sistema.
       and not exists (select 1 from public."TB_FICHA_ANALISE" f
                        where f."CO_MONITORAMENTO" = p_edital
                          and f."TP_SITUACAO" = 'CONCLUIDA'
                          and f."DS_LANCAMENTO" -> 'importada_da_planilha' ->> 'linha' = a.id::text);
    if v_decididas > 0 then
      raise exception 'O edital já tem % análise(s) decidida(s) pela planilha: importe os resultados da planilha para passar a avaliação para o Yeendé', v_decididas
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

comment on function private."FC_DEFINIR_ORIGEM_ANALISE"(uuid, text, text, uuid) is 'Troca o dono da avaliação documental do edital (PLANILHA, COMPARACAO ou MONITORA) com motivo de 10 a 2.000 e histórico em TH_ORIGEM_ANALISE_EDITAL (com o resumo). Para MONITORA, recusa (23514) o edital que já tem análise decidida pela planilha (Aprovado, Reprovado ou Revisar) que nenhuma ficha importou (importar_avaliacao_da_planilha, 16/11/2026) e publica as fichas que já existem (FC_PUBLICAR_FICHA_ANALISE); saindo de MONITORA, as linhas MONITORA do edital voltam a ser da planilha. Mesmo dono: não muda nada. Quem chama informa o autor. Sem grant: public.definir_origem_analise, a importação e o SQL Editor.';

-- O plano da importação: cada linha ativa da planilha do edital com o inscrito e a ficha
-- dela, e cada ficha sem linha. Só lê; a prévia e a importação usam o mesmo plano.
create function private."FC_PLANO_IMPORTACAO_PLANILHA"(p_edital uuid)
returns table (linha uuid, ficha uuid, situacao_ficha text, acao text, status text, problema text, usuario uuid)
    language sql stable security definer
    set search_path to ''
    as $$
  with m as (
    select e.id, e."CO_AREA", private."FC_NUMERO_EDITAL"(e.edital) as numero
      from public."TB_MONITORAMENTO_INDIGENA" e where e.id = p_edital
  ),
  linhas as (
    select a.*
      from public."TB_ANALISE_CURRICULAR" a, m
     where a.ativo
       and a."TP_ORIGEM_REGISTRO" = 'PLANILHA'
       and a."CO_AREA" = m."CO_AREA"
       and private."FC_NUMERO_EDITAL"(a.edital) = m.numero
       and not private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)
  ),
  -- O inscrito da linha: o da pré-classificação do edital com o mesmo código da Empregare
  -- (o mesmo código pode ter dois cadastros; vale o da vaga da linha, se houver dois).
  inscritos as (
    select l.id as linha, p."CO_EMPREGARE_CANDIDATO" as candidato, p."CO_VAGA" = l.codigo_vaga as mesma_vaga
      from linhas l
      join public."TB_EMPREGARE_CANDIDATO" c on btrim(c."CO_CANDIDATO_EMPREGARE") = btrim(l.id_origem)
      join public."TB_PRE_CLASSIFICACAO" p
        on p."CO_MONITORAMENTO" = p_edital and p."CO_EMPREGARE_CANDIDATO" = c."CO_EMPREGARE_CANDIDATO"
  ),
  escolhido as (
    select i.linha,
           case when count(*) = 1 then min(i.candidato::text)::uuid
                when count(*) filter (where i.mesma_vaga) = 1 then (min(i.candidato::text) filter (where i.mesma_vaga))::uuid
           end as candidato,
           count(*) as quantos
      from inscritos i group by i.linha
  ),
  ligadas as (
    select l.id as linha, l.status_consolidado as status, l.codigo_vaga, l.nota_final_ajustada,
           l.analise, l.responsavel_analise, e.candidato, coalesce(e.quantos, 0) as quantos,
           f."CO_FICHA_ANALISE" as ficha, f."TP_SITUACAO" as situacao_ficha, f."CO_VAGA" as vaga_ficha
      from linhas l
      left join escolhido e on e.linha = l.id
      left join public."TB_FICHA_ANALISE" f
        on f."CO_MONITORAMENTO" = p_edital and f."CO_EMPREGARE_CANDIDATO" = e.candidato
  )
  select g.linha, g.ficha, g.situacao_ficha::text,
         case when g.status in ('Aprovado', 'Reprovado') then 'CONCLUIR' else 'MANTER' end,
         g.status,
         case
           when g.quantos = 0 then 'SEM_INSCRITO'
           when g.candidato is null then 'MAIS_DE_UM_INSCRITO'
           when g.ficha is null then 'SEM_FICHA'
           when g.vaga_ficha is distinct from g.codigo_vaga then 'VAGA_DIFERENTE'
           -- Em revisão na planilha: a equipe termina a revisão lá antes de importar.
           when g.status = 'Revisar' then 'EM_REVISAO'
           when g.status in ('Aprovado', 'Reprovado') and g.nota_final_ajustada is null then 'SEM_NOTA'
           when g.status = 'Aprovado' and g.nota_final_ajustada > 1000 then 'NOTA_INVALIDA'
           when g.status in ('Aprovado', 'Reprovado') and length(btrim(coalesce(g.analise, ''))) = 0 then 'SEM_PARECER'
           when g.status in ('Aprovado', 'Reprovado') and length(g.analise) > 8000 then 'PARECER_LONGO'
         end,
         -- Quem analisou: o cadastro de mesmo nome, se for um só (senão, quem importa).
         (select min(u.user_id::text)::uuid
            from public."TB_PERFIL_USUARIO" u
           where nullif(btrim(g.responsavel_analise), '') is not null
             and (lower(btrim(private."FC_NOME_E_SOBRENOME"(u.nome))) = lower(btrim(g.responsavel_analise))
                  or lower(btrim(u.nome)) = lower(btrim(g.responsavel_analise)))
          having count(*) = 1)
    from ligadas g
  union all
  -- Fichas sem linha ativa na planilha: em aberto, saem do lote; concluída é conflito.
  select null, f."CO_FICHA_ANALISE", f."TP_SITUACAO"::text,
         case when f."TP_SITUACAO" in ('PENDENTE', 'EM_ANALISE', 'REVISAR') then 'SAIR_LOTE' else 'MANTER' end,
         null,
         case when f."TP_SITUACAO" = 'CONCLUIDA' then 'CONCLUIDA_SEM_PLANILHA' end,
         null
    from public."TB_FICHA_ANALISE" f
   where f."CO_MONITORAMENTO" = p_edital
     and not exists (select 1 from ligadas g where g.ficha = f."CO_FICHA_ANALISE");
$$;

comment on function private."FC_PLANO_IMPORTACAO_PLANILHA"(uuid) is
  'Plano da importação da avaliação da planilha (importar_avaliacao_da_planilha): para cada linha ativa da planilha do edital (TB_ANALISE_CURRICULAR, origem PLANILHA), o inscrito (pré-classificação com o mesmo código da Empregare), a ficha, a ação (CONCLUIR para Aprovado e Reprovado; MANTER para Pendente e Em análise) e o problema que impede (SEM_INSCRITO, MAIS_DE_UM_INSCRITO, SEM_FICHA, VAGA_DIFERENTE, EM_REVISAO, SEM_NOTA, NOTA_INVALIDA, SEM_PARECER, PARECER_LONGO); para cada ficha sem linha, SAIR_LOTE (em aberto) ou o conflito CONCLUIDA_SEM_PLANILHA. usuario: o cadastro com o nome do analista da planilha, se for um só. Só lê.';

revoke all on function private."FC_PLANO_IMPORTACAO_PLANILHA"(uuid) from public, anon, authenticated;

-- A importação: grava as fichas pelo plano e passa o edital para o sistema.
create function private."FC_IMPORTAR_AVALIACAO_DA_PLANILHA"(p_edital uuid, p_motivo text, p_usuario uuid)
returns json
    language plpgsql security definer
    set search_path to ''
    as $$
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

comment on function private."FC_IMPORTAR_AVALIACAO_DA_PLANILHA"(uuid, text, uuid) is
  'Importa a avaliação documental da planilha para o sistema (fase F8, 16/11/2026): pelo plano (FC_PLANO_IMPORTACAO_PLANILHA), sem nenhum problema, cada linha Aprovado ou Reprovado vira a ficha CONCLUIDA do inscrito com o resultado, a nota, o parecer e a data da planilha (o analista: o cadastro de mesmo nome, ou quem importa), a marca DS_LANCAMENTO.importada_da_planilha (com a linha e o que a planilha decidiu) e o histórico IMPORTAR com o retrato do que a ficha tinha; a ficha em aberto sem linha sai do lote ("Não avaliado na planilha"); por fim, FC_DEFINIR_ORIGEM_ANALISE para MONITORA (a linha importada só passa a ser do sistema, sem mudar). Recusa edital já MONITORA. Quem chama informa o autor.';

revoke all on function private."FC_IMPORTAR_AVALIACAO_DA_PLANILHA"(uuid, text, uuid) from public, anon, authenticated;

create function public.previa_importacao_da_planilha(p_edital uuid)
returns json
    language plpgsql stable security definer
    set search_path to ''
    as $$
begin
  perform private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);
  return (
    select json_build_object(
      'aprovados', count(*) filter (where x.acao = 'CONCLUIR' and x.status = 'Aprovado' and x.problema is null),
      'reprovados', count(*) filter (where x.acao = 'CONCLUIR' and x.status = 'Reprovado' and x.problema is null),
      'em_aberto', count(*) filter (where x.linha is not null and x.acao = 'MANTER' and x.problema is null),
      'saem_do_lote', count(*) filter (where x.acao = 'SAIR_LOTE'),
      'analista_sem_cadastro', count(*) filter (where x.acao = 'CONCLUIR' and x.usuario is null and x.problema is null),
      'problemas', coalesce((select json_object_agg(p.problema, p.n)
                               from (select y.problema, count(*) as n
                                       from private."FC_PLANO_IMPORTACAO_PLANILHA"(p_edital) y
                                      where y.problema is not null group by y.problema) p), '{}'::json),
      'origem', coalesce((select o."TP_ORIGEM" from public."TB_ORIGEM_ANALISE_EDITAL" o
                           where o."CO_MONITORAMENTO" = p_edital), 'PLANILHA'))
      from private."FC_PLANO_IMPORTACAO_PLANILHA"(p_edital) x
  );
end;
$$;

comment on function public.previa_importacao_da_planilha(uuid) is
  'A coordenação da avaliação do edital (42501) vê, antes de importar, o que a importação da planilha faria: aprovados e reprovados que viram fichas concluídas, linhas em aberto que ficam como estão, fichas que saem do lote, analistas sem cadastro de mesmo nome (a ficha fica com quem importa) e os problemas que impedem, por tipo (FC_PLANO_IMPORTACAO_PLANILHA). Só lê.';

revoke all on function public.previa_importacao_da_planilha(uuid) from public, anon;
grant execute on function public.previa_importacao_da_planilha(uuid) to authenticated;

create function public.importar_avaliacao_da_planilha(p_edital uuid, p_motivo text)
returns json
    language plpgsql security definer
    set search_path to ''
    as $$
begin
  perform private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);
  return private."FC_IMPORTAR_AVALIACAO_DA_PLANILHA"(p_edital, p_motivo, (select auth.uid()));
end;
$$;

comment on function public.importar_avaliacao_da_planilha(uuid, text) is
  'A coordenação da avaliação do edital (gestor, coordenador da equipe ou admin global; 42501) importa os resultados da planilha como fichas concluídas e passa a avaliação para o sistema, com motivo de 10 a 2.000 (FC_IMPORTAR_AVALIACAO_DA_PLANILHA). Recusa (23514) se a prévia aponta problema.';

revoke all on function public.importar_avaliacao_da_planilha(uuid, text) from public, anon;
grant execute on function public.importar_avaliacao_da_planilha(uuid, text) to authenticated;

commit;
