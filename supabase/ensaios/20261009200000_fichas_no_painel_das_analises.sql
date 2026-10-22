/*
  ENSAIO de 20261009200000_fichas_no_painel_das_analises.sql — begin … rollback.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, aplica o corpo da migration (copiado sem
  mudança, sem o begin/commit dela) e confere:
    E1  permissões: publicação e troca privadas sem grant; a RPC só para
        authenticated; a auxiliar da sincronização só para service_role;
    E2  preenchimento: as fichas dos editais de treinamento (MONITORA)
        publicadas, linhas de treinamento adotadas, nenhum candidato duplicado;
    E3  a correção do 114/2026 (o mesmo bloco do arquivo de correções): dono
        MONITORA, histórico, rodar de novo não muda; o 114 entra na lista de
        editais do painel com a janela da etapa documental; a sincronização o
        ignora;
    E4  a guarda: o 93/2026, já decidido pela planilha, não vira MONITORA
        (23514); motivo curto recusa (22023);
    E5  a RPC pelo login de um administrador global;
    E6  o ciclo de uma ficha do 93/2026 (aqui o dono vira MONITORA direto na
        tabela, só para ver a adoção): a linha da planilha é adotada (mesmo
        id) e passa por Pendente → atribuída → Em análise → Aprovado/Triados,
        com notas, data e responsável; o painel (pacote "ativo" de Projetos) e
        a Classificação leem a linha;
    E7  a sincronização da planilha (lote e finalização) tenta reescrever a
        linha e mandar o 114/2026: pula as duas linhas, não cadastra o edital
        114 e não inativa nenhuma linha MONITORA;
    E8  reabrir (Em análise) e reiniciar (função real: Pendente, sem responsável).
  Termina em ROLLBACK: nada fica gravado.

  Precisa de: os editais 93/2026, 114/2026 e 992/2099 de Projetos, o 991/2099
  da Saúde Indígena e um administrador global ativo; nenhuma carga de análises
  de Projetos em andamento (E7 abre uma de mentira).
  Resultado esperado: um JSON com E1…E8 (ver o relatório do PR).
  Mantenha em sincronia: tests/fichas-no-painel-das-analises-migration.test.js
  confere que o corpo da migration aqui é idêntico ao do arquivo da migration.
*/
begin;

-- ===== corpo da migration (sem begin/commit) =====

set local lock_timeout = '10s';

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public."TB_ORIGEM_ANALISE_EDITAL"') is null
     or to_regclass('public."TB_FICHA_ANALISE"') is null
     or to_regclass('public."TB_PRE_CLASSIF_VAGA"') is null
     or to_regprocedure('private."FC_EXIGIR_COORD_AVALIACAO"(uuid)') is null
     or to_regprocedure('private."FC_MARCAR_CACHE"(text[], text[], text)') is null
     or to_regprocedure('public."FC_DESATIVAR_AUSENTES_DA_PLANILHA"(uuid, text, integer)') is null then
    raise exception 'Aplique antes 20261006100000_regra_da_analise.sql, 20261006120000_fichas_fila_e_reserva.sql e as migrations da sincronização por planilha.';
  end if;
end;
$$;

-- 1. A origem de cada linha de TB_ANALISE_CURRICULAR ---------------------------------------
alter table public."TB_ANALISE_CURRICULAR"
  add column "TP_ORIGEM_REGISTRO" varchar(10) not null default 'PLANILHA',
  add constraint "CK_ANALISECURRIC_TPORIGEMREG" check ("TP_ORIGEM_REGISTRO" in ('PLANILHA', 'MONITORA'));
comment on column public."TB_ANALISE_CURRICULAR"."TP_ORIGEM_REGISTRO" is
  'Quem escreve a linha: PLANILHA (sincronização do Apps Script) ou MONITORA (publicada pela ficha da Avaliação documental, edital com TB_ORIGEM_ANALISE_EDITAL = MONITORA). A sincronização da planilha nunca grava, muda nem inativa uma linha MONITORA.';
comment on constraint "CK_ANALISECURRIC_TPORIGEMREG" on public."TB_ANALISE_CURRICULAR" is 'Origens válidas da linha.';

-- 2. O edital da linha da planilha está no MONITORA? (sincronização) ------------------------
create function public."FC_EDITAL_ANALISE_NO_MONITORA"(p_planilha text, p_edital text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select private."FC_NUMERO_EDITAL"(p_edital) is not null and exists (
    select 1
      from public."TB_ORIGEM_ANALISE_EDITAL" o
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = o."CO_MONITORAMENTO"
      join public."TB_PLANILHA_ANALISE" p on p."CO_AREA" = m."CO_AREA"
     where o."TP_ORIGEM" = 'MONITORA'
       and p."CO_PLANILHA" = p_planilha
       and private."FC_NUMERO_EDITAL"(m.edital) = private."FC_NUMERO_EDITAL"(p_edital));
$function$;
comment on function public."FC_EDITAL_ANALISE_NO_MONITORA"(text, text) is
  'Verdadeiro quando o edital (texto da planilha, comparado pelo número NN/AAAA) é da área da planilha e tem a avaliação documental no MONITORA (TB_ORIGEM_ANALISE_EDITAL). As funções da sincronização pulam essas linhas e editais. Só service_role (a sincronização roda com ela).';
revoke all on function public."FC_EDITAL_ANALISE_NO_MONITORA"(text, text) from public, anon, authenticated;
grant execute on function public."FC_EDITAL_ANALISE_NO_MONITORA"(text, text) to service_role;

-- 3. A janela do edital MONITORA no painel ---------------------------------------------------
create function private."FC_JANELA_AVALIACAO_DOCUMENTAL"(p_edital uuid, out inicio date, out fim date)
language sql
stable
security definer
set search_path to ''
as $function$
  with etapa as (
    select c.data_inicio::date as data_inicio, coalesce(c.data_fim, c.data_inicio)::date as data_fim,
           translate(lower(coalesce(c.atividade, '')), 'áàâãéêíóôõúç', 'aaaaeeiooouc') as nome
      from public."TB_CRONOGRAMA_MONIT_INDIG" c
     where c.monitoramento_id = p_edital
  ),
  documental as (
    select e.* from etapa e
     where e.nome ~ '(curricular|documental|documentac|titulos)'
       and e.nome !~ '(resultado|divulga|recurso|espelho|impugna|publicac|homologa|convoca)'
  )
  select least(min(d.data_inicio),
               (select min((f."DT_CRIACAO" at time zone 'America/Sao_Paulo')::date)
                  from public."TB_FICHA_ANALISE" f where f."CO_MONITORAMENTO" = p_edital)),
         max(d.data_fim)
    from documental d;
$function$;
comment on function private."FC_JANELA_AVALIACAO_DOCUMENTAL"(uuid) is
  'Janela da avaliação documental do edital com a análise no MONITORA, para o Painel das análises (a planilha não manda janela desse edital): do início da etapa documental do cronograma (curricular, documental, documentação, títulos; sem resultado, divulgação, recurso, espelho, impugnação, publicação, homologação e convocação) ou da abertura da primeira ficha, o que vier antes, até o fim dessa etapa. Sem etapa: só o início (a abertura das fichas).';
revoke all on function private."FC_JANELA_AVALIACAO_DOCUMENTAL"(uuid) from public, anon, authenticated, service_role;

-- 4. A publicação da ficha ---------------------------------------------------------------------
create function private."FC_PUBLICAR_FICHA_ANALISE"(p_ficha uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
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
  v_modalidade := case upper(btrim(coalesce(v_p."NO_MODALIDADE", '')))
    when 'AC' then 'Ampla concorrência'
    when 'PP' then 'Pretos e pardos'
    when 'PI' then 'Indígenas'
    when 'PQ' then 'Quilombolas'
    when 'PCD' then 'Pessoas com deficiência (PCD)'
    else nullif(btrim(v_p."NO_MODALIDADE"), '')
  end;
  v_pcd := case when upper(btrim(coalesce(v_p."NO_MODALIDADE", ''))) = 'PCD' then 'SIM' else 'NÃO' end;

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
comment on function private."FC_PUBLICAR_FICHA_ANALISE"(uuid) is
  'Publica a ficha da Avaliação documental em TB_ANALISE_CURRICULAR, só com o edital em MONITORA (senão devolve nulo): a linha da ficha (chave_natural monitora|edital|candidato), a da planilha do mesmo edital, vaga e código Empregare (adotada, mesmo id) ou uma nova, com TP_ORIGEM_REGISTRO = MONITORA. Situação: PENDENTE → Pendente, EM_ANALISE → Em análise (sem etapa), REVISAR → Revisar, CONCLUIDA apto → Aprovado/Triados, inapto → Reprovado/Reprovado, FORA_LOTE → inativa. Parciais, nota, data e parecer só da concluída/em revisão (inapto por requisito: parciais 0); experiência em dias. Só escreve o que mudou. Devolve o id da linha.';
revoke all on function private."FC_PUBLICAR_FICHA_ANALISE"(uuid) from public, anon, authenticated, service_role;

create function private."FC_TG_PUBLICAR_FICHA_ANALISE"()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  perform private."FC_PUBLICAR_FICHA_ANALISE"(new."CO_FICHA_ANALISE");
  return null;
end;
$function$;
comment on function private."FC_TG_PUBLICAR_FICHA_ANALISE"() is
  'Gatilho de TB_FICHA_ANALISE: publica a ficha em TB_ANALISE_CURRICULAR (FC_PUBLICAR_FICHA_ANALISE; só edital em MONITORA), na mesma transação da ação da ficha.';
revoke all on function private."FC_TG_PUBLICAR_FICHA_ANALISE"() from public, anon, authenticated, service_role;

create trigger "TG_FICHAANALISE_PUBLICA_INS" after insert on public."TB_FICHA_ANALISE"
  for each row execute function private."FC_TG_PUBLICAR_FICHA_ANALISE"();
comment on trigger "TG_FICHAANALISE_PUBLICA_INS" on public."TB_FICHA_ANALISE" is
  'Ficha criada (abertura do lote): publica a linha Pendente no Painel das análises, se o edital está em MONITORA.';
create trigger "TG_FICHAANALISE_PUBLICA_UPD" after update on public."TB_FICHA_ANALISE"
  for each row
  when ((old."TP_SITUACAO", old."CO_USUARIO_RESPONSAVEL", old."TP_RESULTADO", old."VL_NOTA_FINAL", old."VL_NOTA_APURADA",
         old."DS_PARECER", old."DS_RESULTADO", old."CO_USUARIO_CONCLUSAO", old."DT_CONCLUSAO", old."CO_VAGA")
        is distinct from
        (new."TP_SITUACAO", new."CO_USUARIO_RESPONSAVEL", new."TP_RESULTADO", new."VL_NOTA_FINAL", new."VL_NOTA_APURADA",
         new."DS_PARECER", new."DS_RESULTADO", new."CO_USUARIO_CONCLUSAO", new."DT_CONCLUSAO", new."CO_VAGA"))
  execute function private."FC_TG_PUBLICAR_FICHA_ANALISE"();
comment on trigger "TG_FICHAANALISE_PUBLICA_UPD" on public."TB_FICHA_ANALISE" is
  'Ficha atribuída, reservada, concluída, mandada para revisão, reaberta, reiniciada ou fora do lote: atualiza a linha no Painel das análises, se o edital está em MONITORA. Renovar a reserva não dispara.';

-- 5. A troca do dono da avaliação ---------------------------------------------------------------
create function private."FC_DEFINIR_ORIGEM_ANALISE"(p_edital uuid, p_origem text, p_motivo text, p_usuario uuid)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
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
$function$;
comment on function private."FC_DEFINIR_ORIGEM_ANALISE"(uuid, text, text, uuid) is
  'Troca o dono da avaliação documental do edital (PLANILHA, COMPARACAO ou MONITORA) com motivo de 10 a 2.000 e histórico em TH_ORIGEM_ANALISE_EDITAL (com o resumo). Para MONITORA, recusa (23514) o edital que já tem análise decidida pela planilha (Aprovado, Reprovado ou Revisar; a virada com adoção é da F8) e publica as fichas que já existem (FC_PUBLICAR_FICHA_ANALISE); saindo de MONITORA, as linhas MONITORA do edital voltam a ser da planilha. Mesmo dono: não muda nada. Quem chama informa o autor. Sem grant: public.definir_origem_analise e o SQL Editor.';
revoke all on function private."FC_DEFINIR_ORIGEM_ANALISE"(uuid, text, text, uuid) from public, anon, authenticated, service_role;

create function public.definir_origem_analise(p_edital uuid, p_origem text, p_motivo text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
begin
  perform private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);
  return private."FC_DEFINIR_ORIGEM_ANALISE"(p_edital, p_origem, p_motivo, (select auth.uid()));
end;
$function$;
comment on function public.definir_origem_analise(uuid, text, text) is
  'A coordenação da avaliação do edital (gestor, coordenador da equipe ou admin global; 42501) troca o dono da avaliação documental: MONITORA (as fichas alimentam o Painel das análises e a Classificação) ou PLANILHA, com motivo de 10 a 2.000 e histórico (FC_DEFINIR_ORIGEM_ANALISE).';
revoke all on function public.definir_origem_analise(uuid, text, text) from public, anon;
grant execute on function public.definir_origem_analise(uuid, text, text) to authenticated;

-- 6. A sincronização da planilha ignora o MONITORA -----------------------------------------
CREATE OR REPLACE FUNCTION public."FC_DESATIVAR_AUSENTES_DA_PLANILHA"(p_sync_id uuid, p_planilha text, p_total_local integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_manifesto integer;
  v_ativas integer;
  v_limite integer;
  v_ausentes integer;
  v_desativadas integer := 0;
begin
  select count(*)::integer into v_manifesto from public."TM_MANIFESTO_ANALISE" where "CO_SYNC" = p_sync_id;
  if v_manifesto = 0 then
    return jsonb_build_object('desativadas', 0, 'motivo', 'sem manifesto (script incremental antigo)');
  end if;
  if v_manifesto <> coalesce(p_total_local, -1) then
    return jsonb_build_object('desativadas', 0,
      'motivo', format('manifesto incompleto: %s de %s linhas', v_manifesto, p_total_local));
  end if;

  -- [monitora] linha publicada pela ficha (TP_ORIGEM_REGISTRO MONITORA) não é da planilha.
  select count(*)::integer into v_ativas
    from public."TB_ANALISE_CURRICULAR" a
   where a.ativo and a."CO_PLANILHA" = p_planilha and a."TP_ORIGEM_REGISTRO" = 'PLANILHA';
  v_limite := greatest(25, ceil(v_ativas * 0.02)::integer);

  select count(*)::integer into v_ausentes
    from public."TB_ANALISE_CURRICULAR" a
   where a.ativo
     and a."CO_PLANILHA" = p_planilha
     and a."TP_ORIGEM_REGISTRO" = 'PLANILHA'
     and exists (select 1 from public."TB_EDITAL_ANALISE" e
                  where e.ativo and e."CO_PLANILHA" = p_planilha
                    and e.grupo_norm = a.grupo_norm and e.unidade_norm = a.unidade_norm
                    and e.edital_norm = a.edital_norm)
     and not exists (select 1 from public."TM_MANIFESTO_ANALISE" m
                      where m."CO_SYNC" = p_sync_id and m."DS_CHAVE_NATURAL" = a.chave_natural);

  if v_ausentes > v_limite then
    return jsonb_build_object('desativadas', 0, 'ausentes', v_ausentes,
      'motivo', format('remoção bloqueada: %s ausentes passa do limite de %s', v_ausentes, v_limite));
  end if;

  update public."TB_ANALISE_CURRICULAR" a
     set ativo = false, updated_at = now()
   where a.ativo
     and a."CO_PLANILHA" = p_planilha
     and a."TP_ORIGEM_REGISTRO" = 'PLANILHA'
     and exists (select 1 from public."TB_EDITAL_ANALISE" e
                  where e.ativo and e."CO_PLANILHA" = p_planilha
                    and e.grupo_norm = a.grupo_norm and e.unidade_norm = a.unidade_norm
                    and e.edital_norm = a.edital_norm)
     and not exists (select 1 from public."TM_MANIFESTO_ANALISE" m
                      where m."CO_SYNC" = p_sync_id and m."DS_CHAVE_NATURAL" = a.chave_natural);
  get diagnostics v_desativadas = row_count;
  return jsonb_build_object('desativadas', v_desativadas, 'ausentes', v_ausentes, 'limite', v_limite);
end;
$function$;

CREATE OR REPLACE FUNCTION public.processar_sync_analises_lote(p_sync_id uuid, p_limite integer DEFAULT 250)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
 SET statement_timeout TO '20s'
 SET lock_timeout TO '2s'
 SET work_mem TO '8MB'
 SET jit TO 'off'
AS $function$
declare
  v_limite integer := greatest(1, least(coalesce(p_limite,250),500));
  v_cursor integer := 0;
  v_novo_cursor integer := 0;
  v_lidas integer := 0;
  v_alteradas integer := 0;
  v_lidas_total integer := 0;
  v_alteradas_total integer := 0;
  v_planilha text;
  v_grupo_norm text;
  v_validada boolean := false;
  v_fora integer := 0;
  v_conflitos integer := 0;
  v_monitora integer := 0;
  v_monitora_total integer := 0;
begin
  if p_sync_id is null then raise exception 'p_sync_id obrigatorio'; end if;
  -- [por-planilha] planilha pela origem do sync; lock e checagens por planilha.
  v_planilha := public."FC_PLANILHA_DO_SYNC_ANALISE"(p_sync_id);
  if v_planilha is null then raise exception 'Sync % indisponivel para processamento em lotes.', p_sync_id; end if;
  if not pg_try_advisory_xact_lock(hashtext('public.processar_sync_analises:'||v_planilha)::bigint) then
    raise exception 'Outro processamento de analises ja esta em andamento.';
  end if;

  select coalesce(nullif(resultado->>'lote_cursor','')::integer,0),
         coalesce((resultado->>'planilha_validada')::boolean,false)
    into v_cursor,v_validada
  from public."TL_SYNC_ANALISE"
  where sync_id=p_sync_id and status in ('carregado','processando')
  order by id desc limit 1;
  if not found then raise exception 'Sync % indisponivel para processamento em lotes.', p_sync_id; end if;

  -- [por-planilha] porteiro: o staging inteiro, uma vez por sync.
  if not v_validada then
    perform public."FC_VALIDAR_GRUPO_STAGING_ANALISE"(p_sync_id, v_planilha);
  end if;

  select public.analises_norm_key(a."NO_GRUPO_PLANILHA") into v_grupo_norm
  from public."TB_PLANILHA_ANALISE" p join public."TB_AREA" a on a."CO_AREA"=p."CO_AREA"
  where p."CO_PLANILHA"=v_planilha;

  create temporary table tmp_lote on commit drop as
  select s.*
  from public."TM_ANALISE_CURRICULAR" s
  where s.sync_id=p_sync_id
    and s.entidade='FATO_ANALISES'
    and coalesce(s.linha_origem,0)>v_cursor
  order by s.linha_origem,s.id
  limit v_limite;

  select count(*)::integer, coalesce(max(linha_origem),v_cursor)::integer
    into v_lidas,v_novo_cursor
  from tmp_lote;

  if v_lidas=0 then
    return jsonb_build_object('ok',true,'sync_id',p_sync_id,'lidas',0,'alteradas',0,'cursor',v_cursor,'concluido_fato',true);
  end if;

  -- [por-planilha] o que este lote grava é do grupo da planilha e não é de outra planilha.
  select count(*)::integer into v_fora
  from tmp_lote s
  where coalesce(public.analises_norm_key(public.jsonb_text_or_null(s.payload,'grupo')),'') <> v_grupo_norm;
  if v_fora > 0 then
    raise exception 'Sync % recusado pelo porteiro: % linha(s) do lote com grupo diferente do grupo da planilha %. Nada foi gravado.', p_sync_id, v_fora, v_planilha
      using errcode = '22023';
  end if;

  -- [monitora] edital com a avaliação no MONITORA e linha publicada pela ficha: a planilha
  -- não grava nem muda (20261009200000). O cursor anda mesmo assim.
  delete from tmp_lote s
   where public."FC_EDITAL_ANALISE_NO_MONITORA"(v_planilha, public.jsonb_text_or_null(s.payload,'edital'))
      or exists (select 1 from public."TB_ANALISE_CURRICULAR" a
                  where a."TP_ORIGEM_REGISTRO" = 'MONITORA'
                    and a.chave_natural=public.analises_make_chave_natural(
                      public.jsonb_text_or_null(s.payload,'grupo'),
                      coalesce(public.jsonb_text_or_null(s.payload,'unidade'),'Nao informada'),
                      coalesce(public.jsonb_text_or_null(s.payload,'edital'),'Sem edital'),
                      public.jsonb_text_or_null(s.payload,'codigo_vaga'),
                      public.jsonb_text_or_null(s.payload,'id'),
                      public.jsonb_text_or_null(s.payload,'candidato')));
  get diagnostics v_monitora=row_count;

  select count(*)::integer into v_conflitos
  from tmp_lote s
  join public."TB_ANALISE_CURRICULAR" a
    on a.chave_natural=public.analises_make_chave_natural(
        public.jsonb_text_or_null(s.payload,'grupo'),
        coalesce(public.jsonb_text_or_null(s.payload,'unidade'),'Nao informada'),
        coalesce(public.jsonb_text_or_null(s.payload,'edital'),'Sem edital'),
        public.jsonb_text_or_null(s.payload,'codigo_vaga'),
        public.jsonb_text_or_null(s.payload,'id'),
        public.jsonb_text_or_null(s.payload,'candidato'))
  where a."CO_PLANILHA" <> v_planilha;
  if v_conflitos > 0 then
    raise exception 'Sync % recusado: % analise(s) do lote ja pertencem a outra planilha (mesma chave_natural). Nada foi gravado.', p_sync_id, v_conflitos
      using errcode = '22023';
  end if;

  with dados as (
    select
      public.analises_make_chave_natural(
        public.jsonb_text_or_null(s.payload,'grupo'),
        coalesce(public.jsonb_text_or_null(s.payload,'unidade'),'Nao informada'),
        coalesce(public.jsonb_text_or_null(s.payload,'edital'),'Sem edital'),
        public.jsonb_text_or_null(s.payload,'codigo_vaga'),
        public.jsonb_text_or_null(s.payload,'id'),
        public.jsonb_text_or_null(s.payload,'candidato')) as chave_natural,
      public.jsonb_text_or_null(s.payload,'grupo') as grupo,
      coalesce(public.jsonb_text_or_null(s.payload,'unidade'),'Nao informada') as unidade,
      coalesce(public.jsonb_text_or_null(s.payload,'edital'),'Sem edital') as edital,
      public.jsonb_text_or_null(s.payload,'codigo_vaga') as codigo_vaga,
      public.jsonb_text_or_null(s.payload,'nome_vaga') as nome_vaga,
      public.jsonb_text_or_null(s.payload,'regime') as regime,
      public.jsonb_text_or_null(s.payload,'carga_horaria') as carga_horaria,
      public.jsonb_text_or_null(s.payload,'categoria') as categoria,
      public.jsonb_text_or_null(s.payload,'candidato') as candidato,
      public.jsonb_text_or_null(s.payload,'id') as id_origem,
      public.jsonb_date_or_null(s.payload,'data_nascimento') as data_nascimento,
      public.jsonb_int_or_null(s.payload,'idade') as idade,
      public.jsonb_num_or_null(s.payload,'nota_empregare') as nota_empregare,
      public.jsonb_text_or_null(s.payload,'modalidade_concorrencia') as modalidade_concorrencia,
      public.jsonb_num_or_null(s.payload,'nota_final_ajustada') as nota_final_ajustada,
      public.jsonb_num_or_null(s.payload,'somatorio') as somatorio,
      public.jsonb_num_or_null(s.payload,'pontuacao_escolaridade') as pontuacao_escolaridade,
      public.jsonb_num_or_null(s.payload,'pontuacao_cursos_aperfeicoamento') as pontuacao_cursos_aperfeicoamento,
      public.jsonb_num_or_null(s.payload,'pontuacao_experiencia_profissional') as pontuacao_experiencia_profissional,
      public.jsonb_num_or_null(s.payload,'pontuacao_criterio_etnico') as pontuacao_criterio_etnico,
      public.jsonb_num_or_null(s.payload,'experiencia_saude_indigena_total') as experiencia_saude_indigena_total,
      public.jsonb_num_or_null(s.payload,'experiencia_atencao_basica_total') as experiencia_atencao_basica_total,
      public.jsonb_int_or_null(s.payload,'experiencia_profissional_anos') as experiencia_profissional_anos,
      public.jsonb_int_or_null(s.payload,'experiencia_profissional_meses') as experiencia_profissional_meses,
      public.jsonb_int_or_null(s.payload,'experiencia_profissional_dias') as experiencia_profissional_dias,
      public.jsonb_num_or_null(s.payload,'experiencia_profissional_total') as experiencia_profissional_total,
      public.jsonb_text_or_null(s.payload,'etapa') as etapa,
      public.jsonb_date_or_null(s.payload,'data_analise') as data_analise,
      public.jsonb_text_or_null(s.payload,'analise') as analise,
      public.jsonb_text_or_null(s.payload,'pcd') as pcd,
      public.jsonb_text_or_null(s.payload,'responsavel_analise') as responsavel_analise,
      public.jsonb_text_or_null(s.payload,'coord_demandante') as coord_demandante,
      public.jsonb_text_or_null(s.payload,'email_demandante') as email_demandante,
      coalesce(public.jsonb_text_or_null(s.payload,'status_consolidado'),'Pendente') as status_consolidado,
      public.jsonb_text_or_null(s.payload,'origem_planilha') as origem_planilha,
      public.jsonb_text_or_null(s.payload,'origem_arquivo_id') as origem_arquivo_id,
      coalesce(public.jsonb_timestamptz_or_null(s.payload,'ultima_atualizacao'),now()) as ultima_atualizacao,
      public.jsonb_text_or_null(s.payload,'pdf_gerado') as pdf_gerado,
      public.jsonb_text_or_null(s.payload,'link_pdf') as link_pdf,
      public.jsonb_timestamptz_or_null(s.payload,'data_geracao_pdf') as data_geracao_pdf,
      public.jsonb_text_or_null(s.payload,'erro_pdf') as erro_pdf,
      public.jsonb_text_or_null(s.payload,'pdf_status') as pdf_status,
      public.jsonb_text_or_null(s.payload,'pdf_file_id') as pdf_file_id,
      public.jsonb_timestamptz_or_null(s.payload,'pdf_ultima_tentativa') as pdf_ultima_tentativa,
      public.jsonb_text_or_null(s.payload,'pdf_hash_origem') as pdf_hash_origem,
      s.linha_origem,
      s.hash_registro
    from tmp_lote s
  )
  insert into public."TB_ANALISE_CURRICULAR"(
    chave_natural,grupo,unidade,edital,codigo_vaga,nome_vaga,regime,carga_horaria,categoria,candidato,
    id_origem,data_nascimento,idade,nota_empregare,modalidade_concorrencia,nota_final_ajustada,somatorio,
    pontuacao_escolaridade,pontuacao_cursos_aperfeicoamento,pontuacao_experiencia_profissional,
    pontuacao_criterio_etnico,experiencia_saude_indigena_total,experiencia_atencao_basica_total,
    experiencia_profissional_anos,experiencia_profissional_meses,experiencia_profissional_dias,experiencia_profissional_total,
    etapa,data_analise,analise,pcd,responsavel_analise,coord_demandante,email_demandante,status_consolidado,
    origem_planilha,origem_arquivo_id,ultima_atualizacao,pdf_gerado,link_pdf,data_geracao_pdf,erro_pdf,pdf_status,
    pdf_file_id,pdf_ultima_tentativa,pdf_hash_origem,linha_origem,hash_registro,ativo,updated_at,"CO_PLANILHA")
  select
    d.chave_natural,d.grupo,d.unidade,d.edital,d.codigo_vaga,d.nome_vaga,d.regime,d.carga_horaria,d.categoria,d.candidato,
    d.id_origem,d.data_nascimento,d.idade,d.nota_empregare,d.modalidade_concorrencia,d.nota_final_ajustada,d.somatorio,
    d.pontuacao_escolaridade,d.pontuacao_cursos_aperfeicoamento,d.pontuacao_experiencia_profissional,
    d.pontuacao_criterio_etnico,d.experiencia_saude_indigena_total,d.experiencia_atencao_basica_total,
    d.experiencia_profissional_anos,d.experiencia_profissional_meses,d.experiencia_profissional_dias,d.experiencia_profissional_total,
    d.etapa,d.data_analise,d.analise,d.pcd,d.responsavel_analise,d.coord_demandante,d.email_demandante,d.status_consolidado,
    d.origem_planilha,d.origem_arquivo_id,d.ultima_atualizacao,
    coalesce(d.pdf_gerado,a.pdf_gerado),coalesce(d.link_pdf,a.link_pdf),coalesce(d.data_geracao_pdf,a.data_geracao_pdf),
    coalesce(d.erro_pdf,a.erro_pdf),coalesce(d.pdf_status,a.pdf_status),coalesce(d.pdf_file_id,a.pdf_file_id),
    coalesce(d.pdf_ultima_tentativa,a.pdf_ultima_tentativa),coalesce(d.pdf_hash_origem,a.pdf_hash_origem),
    d.linha_origem,d.hash_registro,true,now(),v_planilha
  from dados d
  left join public."TB_ANALISE_CURRICULAR" a on a.chave_natural=d.chave_natural
  on conflict (chave_natural) do update set
    grupo=excluded.grupo,unidade=excluded.unidade,edital=excluded.edital,codigo_vaga=excluded.codigo_vaga,
    nome_vaga=excluded.nome_vaga,regime=excluded.regime,carga_horaria=excluded.carga_horaria,categoria=excluded.categoria,
    candidato=excluded.candidato,id_origem=excluded.id_origem,data_nascimento=excluded.data_nascimento,idade=excluded.idade,
    nota_empregare=excluded.nota_empregare,modalidade_concorrencia=excluded.modalidade_concorrencia,
    nota_final_ajustada=excluded.nota_final_ajustada,somatorio=excluded.somatorio,pontuacao_escolaridade=excluded.pontuacao_escolaridade,
    pontuacao_cursos_aperfeicoamento=excluded.pontuacao_cursos_aperfeicoamento,
    pontuacao_experiencia_profissional=excluded.pontuacao_experiencia_profissional,
    pontuacao_criterio_etnico=excluded.pontuacao_criterio_etnico,experiencia_saude_indigena_total=excluded.experiencia_saude_indigena_total,
    experiencia_atencao_basica_total=excluded.experiencia_atencao_basica_total,
    experiencia_profissional_anos=excluded.experiencia_profissional_anos,experiencia_profissional_meses=excluded.experiencia_profissional_meses,
    experiencia_profissional_dias=excluded.experiencia_profissional_dias,experiencia_profissional_total=excluded.experiencia_profissional_total,
    etapa=excluded.etapa,data_analise=excluded.data_analise,
    analise=excluded.analise,pcd=excluded.pcd,responsavel_analise=excluded.responsavel_analise,
    coord_demandante=excluded.coord_demandante,email_demandante=excluded.email_demandante,status_consolidado=excluded.status_consolidado,
    origem_planilha=excluded.origem_planilha,origem_arquivo_id=excluded.origem_arquivo_id,ultima_atualizacao=excluded.ultima_atualizacao,
    pdf_gerado=excluded.pdf_gerado,link_pdf=excluded.link_pdf,data_geracao_pdf=excluded.data_geracao_pdf,erro_pdf=excluded.erro_pdf,
    pdf_status=excluded.pdf_status,pdf_file_id=excluded.pdf_file_id,pdf_ultima_tentativa=excluded.pdf_ultima_tentativa,
    pdf_hash_origem=excluded.pdf_hash_origem,linha_origem=excluded.linha_origem,hash_registro=excluded.hash_registro,ativo=true,updated_at=now()
  where "TB_ANALISE_CURRICULAR"."CO_PLANILHA"=excluded."CO_PLANILHA"
    -- [monitora] linha publicada pela ficha nunca é sobrescrita pela planilha.
    and "TB_ANALISE_CURRICULAR"."TP_ORIGEM_REGISTRO"='PLANILHA';

  get diagnostics v_alteradas=row_count;

  select coalesce(nullif(resultado->>'lote_lidas','')::integer,0)+v_lidas,
         coalesce(nullif(resultado->>'lote_alteradas','')::integer,0)+v_alteradas,
         coalesce(nullif(resultado->>'lote_ignoradas_monitora','')::integer,0)+v_monitora
    into v_lidas_total,v_alteradas_total,v_monitora_total
  from public."TL_SYNC_ANALISE"
  where sync_id=p_sync_id
  order by id desc limit 1;

  update public."TL_SYNC_ANALISE"
  set status='processando',
      resultado=coalesce(resultado,'{}'::jsonb)||jsonb_build_object(
        'modo_processamento','lotes','lote_cursor',v_novo_cursor,'lote_lidas',v_lidas_total,
        'lote_alteradas',v_alteradas_total,'ultimo_lote_lidas',v_lidas,'ultimo_lote_alteradas',v_alteradas,
        'lote_ignoradas_monitora',v_monitora_total,
        'ultimo_lote_em',now(),'planilha',v_planilha,'planilha_validada',true),
      updated_at=now()
  where sync_id=p_sync_id;

  return jsonb_build_object('ok',true,'sync_id',p_sync_id,'lidas',v_lidas,'alteradas',v_alteradas,
    'ignoradas_monitora',v_monitora,
    'lidas_total',v_lidas_total,'alteradas_total',v_alteradas_total,'cursor',v_novo_cursor,'concluido_fato',v_lidas<v_limite);
end;
$function$;

CREATE OR REPLACE FUNCTION public.finalizar_sync_analises_lotes(p_sync_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
 SET statement_timeout TO '30s'
 SET lock_timeout TO '2s'
 SET work_mem TO '8MB'
 SET jit TO 'off'
AS $function$
declare
  v_cursor integer:=0;
  v_max integer:=0;
  v_total_staging integer:=0;
  v_total_fato integer:=0;
  v_total_editais integer:=0;
  v_normalizados integer:=0;
  v_inativados integer:=0;
  v_editais integer:=0;
  v_editais_inativados integer:=0;
  v_editais_monitora integer:=0;
  v_removido integer:=0;
  v_alteradas integer:=0;
  v_result jsonb;
  v_planilha text;
  v_conflitos integer:=0;
begin
  if p_sync_id is null then raise exception 'p_sync_id obrigatorio'; end if;
  -- [por-planilha]
  v_planilha := public."FC_PLANILHA_DO_SYNC_ANALISE"(p_sync_id);
  if v_planilha is null then raise exception 'Sync % nao esta em processamento por lotes.',p_sync_id; end if;
  if not pg_try_advisory_xact_lock(hashtext('public.processar_sync_analises:'||v_planilha)::bigint) then
    raise exception 'Outro processamento de analises ja esta em andamento.';
  end if;

  select coalesce(nullif(resultado->>'lote_cursor','')::integer,0),
         coalesce(nullif(resultado->>'lote_alteradas','')::integer,0)
    into v_cursor,v_alteradas
  from public."TL_SYNC_ANALISE"
  where sync_id=p_sync_id and status='processando'
  order by id desc limit 1;
  if not found then raise exception 'Sync % nao esta em processamento por lotes.',p_sync_id; end if;

  select coalesce(max(linha_origem) filter(where entidade='FATO_ANALISES'),0),
         count(*)::integer,
         count(*) filter(where entidade='FATO_ANALISES')::integer,
         count(*) filter(where entidade='DIM_EDITAIS')::integer
    into v_max,v_total_staging,v_total_fato,v_total_editais
  from public."TM_ANALISE_CURRICULAR"
  where sync_id=p_sync_id;

  if v_cursor<v_max then
    raise exception 'Ainda existem linhas FATO pendentes: cursor %, max %.',v_cursor,v_max;
  end if;

  -- [por-planilha] porteiro antes de qualquer desativação.
  perform public."FC_VALIDAR_GRUPO_STAGING_ANALISE"(p_sync_id, v_planilha);

  create temporary table tmp_keys on commit drop as
  select distinct public.analises_make_chave_natural(
    public.jsonb_text_or_null(s.payload,'grupo'),
    coalesce(public.jsonb_text_or_null(s.payload,'unidade'),'Nao informada'),
    coalesce(public.jsonb_text_or_null(s.payload,'edital'),'Sem edital'),
    public.jsonb_text_or_null(s.payload,'codigo_vaga'),
    public.jsonb_text_or_null(s.payload,'id'),
    public.jsonb_text_or_null(s.payload,'candidato')) as chave_natural
  from public."TM_ANALISE_CURRICULAR" s
  where s.sync_id=p_sync_id and s.entidade='FATO_ANALISES';

  select count(*)::integer into v_normalizados from tmp_keys;
  create unique index tmp_keys_idx on tmp_keys(chave_natural);
  analyze tmp_keys;

  -- [por-planilha] só desativa análises desta planilha.
  -- [monitora] nunca a linha publicada pela ficha (TP_ORIGEM_REGISTRO MONITORA).
  update public."TB_ANALISE_CURRICULAR" a
  set ativo=false,updated_at=now()
  where a.ativo is true
    and a."CO_PLANILHA"=v_planilha
    and a."TP_ORIGEM_REGISTRO"='PLANILHA'
    and not private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)
    and not exists(select 1 from tmp_keys k where k.chave_natural=a.chave_natural);
  get diagnostics v_inativados=row_count;

  create temporary table tmp_editais on commit drop as
  with x as (
    select s.id,s.linha_origem,
      public.jsonb_text_or_null(s.payload,'grupo') as grupo,
      coalesce(public.jsonb_text_or_null(s.payload,'unidade'),'Nao informada') as unidade,
      coalesce(public.jsonb_text_or_null(s.payload,'edital'),'Sem edital') as edital,
      coalesce(public.jsonb_bool_or_null(s.payload,'ativo'),true) as ativo,
      public.jsonb_date_or_null(s.payload,'data_inicio_analise') as data_inicio_analise,
      public.jsonb_date_or_null(s.payload,'data_fim_analise') as data_fim_analise
    from public."TM_ANALISE_CURRICULAR" s
    where s.sync_id=p_sync_id and s.entidade='DIM_EDITAIS'
  ), ranked as (
    select *,row_number() over(partition by grupo,unidade,edital order by coalesce(linha_origem,2147483647),id) rn
    from x
  )
  select grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise
  from ranked where rn=1;

  -- [monitora] o edital com a avaliação no MONITORA não é cadastrado nem mudado pela planilha.
  delete from tmp_editais x where public."FC_EDITAL_ANALISE_NO_MONITORA"(v_planilha, x.edital);
  get diagnostics v_editais_monitora=row_count;

  if v_total_editais>0 then
    -- [por-planilha] edital já cadastrado por outra planilha: recusa.
    select count(*)::integer into v_conflitos
    from public."TB_EDITAL_ANALISE" e
    join tmp_editais x
      on e.grupo_norm=coalesce(public.analises_norm_key(x.grupo),'')
     and e.unidade_norm=coalesce(public.analises_norm_key(x.unidade),'')
     and e.edital_norm=coalesce(public.analises_norm_key(x.edital),'')
    where e."CO_PLANILHA"<>v_planilha;
    if v_conflitos>0 then
      raise exception 'Sync % recusado: % edital(is) do envio ja pertencem a outra planilha.',p_sync_id,v_conflitos
        using errcode = '22023';
    end if;

    insert into public."TB_EDITAL_ANALISE"(grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise,"CO_PLANILHA")
    select grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise,v_planilha
    from tmp_editais
    on conflict(grupo,unidade,edital) do update set
      ativo=excluded.ativo,
      data_inicio_analise=excluded.data_inicio_analise,
      data_fim_analise=excluded.data_fim_analise,
      updated_at=now()
    where "TB_EDITAL_ANALISE"."CO_PLANILHA"=excluded."CO_PLANILHA";
    get diagnostics v_editais=row_count;

    -- [por-planilha] só desativa editais desta planilha.
    -- [monitora] nem o edital com a avaliação no MONITORA.
    update public."TB_EDITAL_ANALISE" e
    set ativo=false,updated_at=now()
    where e.ativo is true
      and e."CO_PLANILHA"=v_planilha
      and not public."FC_EDITAL_ANALISE_NO_MONITORA"(v_planilha, e.edital)
      and not exists(select 1 from tmp_editais x
        where e.grupo is not distinct from x.grupo
          and e.unidade=x.unidade
          and e.edital=x.edital);
    get diagnostics v_editais_inativados=row_count;
  end if;

  delete from public."TM_ANALISE_CURRICULAR" where sync_id=p_sync_id;
  get diagnostics v_removido=row_count;

  v_result=jsonb_build_object(
    'ok',true,
    'sync_id',p_sync_id,
    'modo_processamento','lotes',
    'planilha',v_planilha,
    'staging',v_total_staging,
    'fato_analises_recebidas',v_total_fato,
    'fato_analises_normalizadas',v_normalizados,
    'fato_analises_upsert',v_alteradas,
    'fato_analises_inativadas',v_inativados,
    'analises_editais_recebidos',v_total_editais,
    'analises_editais_upsert',v_editais,
    'analises_editais_inativados',v_editais_inativados,
    'analises_editais_monitora_ignorados',v_editais_monitora,
    'staging_removido',v_removido);

  update public."TL_SYNC_ANALISE"
  set status='processado',
      resultado=v_result,
      erro=null,
      total_processados=v_normalizados,
      finished_at=now(),
      updated_at=now()
  where sync_id=p_sync_id;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.finalizar_sync_analises_incremental(p_sync_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
 SET statement_timeout TO '30s'
 SET lock_timeout TO '2s'
 SET work_mem TO '8MB'
 SET jit TO 'off'
AS $function$
declare
  v_cursor integer:=0;
  v_max integer:=0;
  v_total_staging integer:=0;
  v_esperado integer:=0;
  v_total_fato integer:=0;
  v_total_editais integer:=0;
  v_editais_upsert integer:=0;
  v_editais_inativados integer:=0;
  v_editais_monitora integer:=0;
  v_removido integer:=0;
  v_total_ativos_local integer:=0;
  v_result jsonb;
  v_planilha text;
  v_conflitos integer:=0;
  v_duplicadas integer:=0;
  v_ausentes jsonb;
begin
  if p_sync_id is null then raise exception 'p_sync_id obrigatorio'; end if;
  -- [por-planilha]
  v_planilha := public."FC_PLANILHA_DO_SYNC_ANALISE"(p_sync_id);
  if v_planilha is null then raise exception 'Sync incremental nao esta pronto para finalizacao.'; end if;
  if not pg_try_advisory_xact_lock(hashtext('public.processar_sync_analises:'||v_planilha)::bigint) then
    raise exception 'Outro processamento de analises esta em andamento.';
  end if;

  select coalesce(nullif(resultado->>'lote_cursor','')::integer,0),
         coalesce(linhas_staging,0),
         coalesce(nullif(resultado->>'incremental_total_ativos_local','')::integer,0)
    into v_cursor,v_esperado,v_total_ativos_local
  from public."TL_SYNC_ANALISE"
  where sync_id=p_sync_id and modo='INCREMENTAL_ACTIVE' and status in ('carregado','processando')
    and coalesce((resultado->>'incremental_preparado')::boolean,false)=true
  order by id desc limit 1;
  if not found then raise exception 'Sync incremental nao esta pronto para finalizacao.'; end if;

  select coalesce(max(linha_origem) filter(where entidade='FATO_ANALISES'),0),
         count(*)::integer,
         count(*) filter(where entidade='FATO_ANALISES')::integer,
         count(*) filter(where entidade='DIM_EDITAIS')::integer
    into v_max,v_total_staging,v_total_fato,v_total_editais
  from public."TM_ANALISE_CURRICULAR"
  where sync_id=p_sync_id;

  if v_total_staging <> v_esperado then raise exception 'Staging incremental divergente: esperado %, encontrado %.',v_esperado,v_total_staging; end if;
  if v_cursor < v_max then raise exception 'Ainda existem linhas FATO incrementais pendentes: cursor %, max %.',v_cursor,v_max; end if;
  if v_total_editais < 1 then raise exception 'DIM_EDITAIS ausente no incremental.'; end if;

  -- [por-planilha] porteiro antes de gravar editais.
  perform public."FC_VALIDAR_GRUPO_STAGING_ANALISE"(p_sync_id, v_planilha);

  create temporary table tmp_editais_incremental on commit drop as
  with x as (
    select s.id,s.linha_origem,
      public.jsonb_text_or_null(s.payload,'grupo') as grupo,
      coalesce(public.jsonb_text_or_null(s.payload,'unidade'),'Nao informada') as unidade,
      coalesce(public.jsonb_text_or_null(s.payload,'edital'),'Sem edital') as edital,
      coalesce(public.jsonb_bool_or_null(s.payload,'ativo'),true) as ativo,
      public.jsonb_date_or_null(s.payload,'data_inicio_analise') as data_inicio_analise,
      public.jsonb_date_or_null(s.payload,'data_fim_analise') as data_fim_analise
    from public."TM_ANALISE_CURRICULAR" s
    where s.sync_id=p_sync_id and s.entidade='DIM_EDITAIS'
  ), ranked as (
    select *,row_number() over(partition by coalesce(public.analises_norm_key(grupo),''),coalesce(public.analises_norm_key(unidade),''),coalesce(public.analises_norm_key(edital),'') order by coalesce(linha_origem,2147483647),id) rn
    from x
  )
  select grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise
  from ranked where rn=1;

  -- [monitora] o edital com a avaliação no MONITORA não é cadastrado nem mudado pela planilha.
  delete from tmp_editais_incremental x where public."FC_EDITAL_ANALISE_NO_MONITORA"(v_planilha, x.edital);
  get diagnostics v_editais_monitora=row_count;

  -- [por-planilha] edital já cadastrado por outra planilha: recusa.
  select count(*)::integer into v_conflitos
  from public."TB_EDITAL_ANALISE" e
  join tmp_editais_incremental x
    on e.grupo_norm=coalesce(public.analises_norm_key(x.grupo),'')
   and e.unidade_norm=coalesce(public.analises_norm_key(x.unidade),'')
   and e.edital_norm=coalesce(public.analises_norm_key(x.edital),'')
  where e."CO_PLANILHA"<>v_planilha;
  if v_conflitos>0 then
    raise exception 'Sync % recusado: % edital(is) do envio ja pertencem a outra planilha.',p_sync_id,v_conflitos
      using errcode = '22023';
  end if;

  insert into public."TB_EDITAL_ANALISE"(grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise,"CO_PLANILHA")
  select grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise,v_planilha
  from tmp_editais_incremental
  -- Pela chave normalizada (uq_analises_editais_norm): "DSEI  Parintins" e
  -- "DSEI Parintins" são o mesmo edital; o texto passa a ser o da planilha.
  on conflict(grupo_norm,unidade_norm,edital_norm) do update set
    grupo=excluded.grupo,
    unidade=excluded.unidade,
    edital=excluded.edital,
    ativo=excluded.ativo,
    data_inicio_analise=excluded.data_inicio_analise,
    data_fim_analise=excluded.data_fim_analise,
    updated_at=now()
  where "TB_EDITAL_ANALISE"."CO_PLANILHA"=excluded."CO_PLANILHA"
    -- Só o edital que mudou (20261007220000): regravar os iguais a cada sync
    -- gerava WAL e remontava o painel de análises à toa.
    and ("TB_EDITAL_ANALISE".grupo,"TB_EDITAL_ANALISE".unidade,"TB_EDITAL_ANALISE".edital,
         "TB_EDITAL_ANALISE".ativo,"TB_EDITAL_ANALISE".data_inicio_analise,"TB_EDITAL_ANALISE".data_fim_analise)
        is distinct from
        (excluded.grupo,excluded.unidade,excluded.edital,
         excluded.ativo,excluded.data_inicio_analise,excluded.data_fim_analise);
  get diagnostics v_editais_upsert=row_count;

  -- [por-planilha] só desativa editais desta planilha.
  -- [monitora] nem o edital com a avaliação no MONITORA.
  update public."TB_EDITAL_ANALISE" e
  set ativo=false,updated_at=now()
  where e.ativo is true
    and e."CO_PLANILHA"=v_planilha
    and not public."FC_EDITAL_ANALISE_NO_MONITORA"(v_planilha, e.edital)
    and not exists(select 1 from tmp_editais_incremental x
      where e.grupo_norm=coalesce(public.analises_norm_key(x.grupo),'')
        and e.unidade_norm=coalesce(public.analises_norm_key(x.unidade),'')
        and e.edital_norm=coalesce(public.analises_norm_key(x.edital),''));
  get diagnostics v_editais_inativados=row_count;

  -- [por-planilha] Mesmo candidato (id_origem) duas vezes na mesma vaga e edital:
  -- fica ativo só o registro mais recente. O incremental só envia o que mudou;
  -- quando o nome é corrigido na planilha, a chave natural muda, entra um
  -- registro novo e o antigo ficava ativo como "Pendente" (14 casos em 30/09).
  -- [monitora] a linha publicada pela ficha não entra nessa conta.
  with r as (
    select a.id,
           row_number() over (partition by a.edital_norm, a.codigo_vaga, a.id_origem
                              order by a.updated_at desc, a.id desc) as rn
      from public."TB_ANALISE_CURRICULAR" a
     where a.ativo
       and a."CO_PLANILHA" = v_planilha
       and a."TP_ORIGEM_REGISTRO" = 'PLANILHA'
       and nullif(btrim(a.id_origem), '') is not null
       and nullif(btrim(a.codigo_vaga), '') is not null
  )
  update public."TB_ANALISE_CURRICULAR" a
     set ativo = false, updated_at = now()
    from r
   where a.id = r.id and r.rn > 1;
  get diagnostics v_duplicadas=row_count;

  -- Quem saiu da planilha (manifesto da comparação): ver 20261001140000.
  v_ausentes := public."FC_DESATIVAR_AUSENTES_DA_PLANILHA"(p_sync_id, v_planilha, v_total_ativos_local);
  delete from public."TM_MANIFESTO_ANALISE" where "CO_SYNC" = p_sync_id or "DT_CRIACAO" < now() - interval '2 days';

  delete from public."TM_ANALISE_CURRICULAR" where sync_id=p_sync_id;
  get diagnostics v_removido=row_count;

  v_result=jsonb_build_object(
    'ok',true,
    'sync_id',p_sync_id,
    'modo_processamento','incremental',
    'planilha',v_planilha,
    'total_ativos_local',v_total_ativos_local,
    'fato_analises_enviadas',v_total_fato,
    'analises_editais_recebidos',v_total_editais,
    'analises_editais_upsert',v_editais_upsert,
    'analises_editais_inativados',v_editais_inativados,
    'analises_editais_monitora_ignorados',v_editais_monitora,
    'staging',v_total_staging,
    'staging_removido',v_removido,
    'historico_inativado',coalesce((v_ausentes->>'desativadas')::integer,0),
    'ausentes',v_ausentes,
    'analises_duplicadas_inativadas',v_duplicadas
  );

  update public."TL_SYNC_ANALISE"
  set status='processado',resultado=v_result,erro=null,total_processados=v_total_fato,
      finished_at=now(),updated_at=now()
  where sync_id=p_sync_id and modo='INCREMENTAL_ACTIVE';

  return v_result;
end;
$function$;

-- 7. O painel: o edital MONITORA entra na lista de editais, com a janela própria ------------
CREATE OR REPLACE FUNCTION private."FC_MONTAR_PAINEL_ANALISE"(p_area text, p_escopos text[], p_so_visiveis boolean DEFAULT false)
 RETURNS TABLE("TP_ESCOPO" text, "DS_LINHAS" json, "QT_LINHAS" integer, "DS_EDITAIS" json, "DT_ULTIMA_ATUALIZACAO" timestamp with time zone, "DS_CONCLUIDAS_POR_ANO" json)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'private', 'pg_temp'
 SET work_mem TO '64MB'
 SET jit TO 'off'
AS $function$
declare
  v_area text := lower(btrim(coalesce(p_area, 'saude-indigena')));
  v_grupo text;
  v_grupos_norm text[];
  v_editais json;
  v_restrito boolean;
  v_editais_norm text[];
  v_unidades_norm text[];
begin
  if p_escopos is null or cardinality(p_escopos) = 0
     or not (p_escopos <@ array['ativo', 'inativo', 'desativadas']) then
    raise exception 'Escopo invalido. Use ativo, inativo ou desativadas.';
  end if;

  select a."NO_GRUPO_PLANILHA" into v_grupo
    from public."TB_AREA" a
   where a."CO_AREA" = v_area;
  if not found then
    raise exception 'Área inválida: %', v_area using errcode = '22023';
  end if;

  -- O mesmo recorte de FC_GRUPOS_ANALISES_DA_AREA, sem a checagem de permissão.
  v_grupos_norm := array[public.analises_norm_key(v_grupo)];

  -- Recorte por coordenação só quando pedido (a RPC, para quem tem recorte);
  -- o pacote guardado é o da área inteira.
  v_restrito := coalesce(p_so_visiveis, false) and private."FC_EDITAIS_VISIVEIS"() is not null;
  if v_restrito then
    v_editais_norm := coalesce(private."FC_EDITAIS_NORM_VISIVEIS"(), '{}');
    v_unidades_norm := coalesce(private."FC_UNIDADES_NORM_VISIVEIS"(), '{}');
  end if;

  -- Os editais da planilha e (20261009200000) os editais com a avaliação no MONITORA
  -- que a planilha não tem: a janela deles é a da avaliação documental do edital.
  select coalesce(json_agg(x.edital_json order by x.unidade, x.edital), '[]'::json)
  into v_editais
  from (
    select json_build_object(
             'grupo', e.grupo,
             'unidade', e.unidade,
             'edital', e.edital,
             'ativo', e.ativo,
             'data_inicio_analise', e.data_inicio_analise,
             'data_fim_analise', e.data_fim_analise
           ) as edital_json, e.unidade, e.edital
      from public."TB_EDITAL_ANALISE" e
     where e.grupo_norm = any (v_grupos_norm)
       and (not v_restrito
         or e.edital_norm = any (v_editais_norm)
         or e.unidade_norm = any (v_unidades_norm))
    union all
    select json_build_object(
             'grupo', v_grupo,
             'unidade', m.unidade,
             'edital', m.edital,
             'ativo', true,
             'data_inicio_analise', j.inicio,
             'data_fim_analise', j.fim
           ), m.unidade, m.edital
      from public."TB_ORIGEM_ANALISE_EDITAL" o
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = o."CO_MONITORAMENTO"
      cross join lateral private."FC_JANELA_AVALIACAO_DOCUMENTAL"(m.id) j
     where o."TP_ORIGEM" = 'MONITORA'
       and m."CO_AREA" = v_area
       and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
       and not exists (select 1 from public."TB_EDITAL_ANALISE" e
                        where e.grupo_norm = any (v_grupos_norm)
                          and private."FC_NUMERO_EDITAL"(e.edital) = private."FC_NUMERO_EDITAL"(m.edital))
       and (not v_restrito
         or coalesce(public.analises_norm_key(m.edital), '') = any (v_editais_norm)
         or coalesce(public.analises_norm_key(m.unidade), '') = any (v_unidades_norm))
  ) x;

  -- Colunas na ordem de `columns` de get_analises_dashboard_payload_v2. A ordem
  -- das linhas é a de sempre, com o id no fim para desempatar (a mesma análise
  -- repetida para o candidato trocava de lugar entre uma montagem e outra).
  return query
  with linhas as materialized (
    select
      case
        when v.edital_ativo is false then 'inativo'
        when v.ativo is true then 'ativo'
        else 'desativadas'
      end as escopo,
      v.id, v.unidade, v.edital, v.codigo_vaga, v.candidato,
      v.status_consolidado, v.data_analise,
      coalesce(v.updated_at, v.ultima_atualizacao) as atualizado_em,
      json_build_array(
        v.id, v.unidade, v.edital, v.codigo_vaga, v.nome_vaga, v.candidato,
        v.categoria, v.modalidade_concorrencia, v.status_consolidado, v.etapa,
        v.responsavel_analise, v.data_analise, v.nota_final_ajustada,
        v.pdf_status, nullif(btrim(v.link_pdf), '') is not null
      ) as linha
    from public."VW_ANALISES_DASHBOARD_BASE_TODOS" v
    join public."TB_ANALISE_CURRICULAR" ac on ac.id = v.id
    where ac.grupo_norm = any (v_grupos_norm)
      and (not v_restrito
        or ac.edital_norm = any (v_editais_norm)
        or ac.unidade_norm = any (v_unidades_norm))
  ),
  agregado as (
    select l.escopo,
           json_agg(l.linha order by l.unidade, l.edital, l.codigo_vaga, l.candidato, l.id) as linhas,
           count(*)::integer as total,
           max(l.atualizado_em) as atualizado_em
      from linhas l
     where l.escopo = any (p_escopos)
     group by l.escopo
  ),
  concluidas as (
    select q.escopo, json_object_agg(q.ano, q.total order by q.ano) as por_ano
      from (
        select l.escopo,
               coalesce(extract(year from l.data_analise)::integer::text, 'sem_data') as ano,
               count(*)::integer as total
          from linhas l
         where l.escopo = any (p_escopos)
           and l.status_consolidado in ('Aprovado', 'Reprovado')
         group by 1, 2
      ) q
     group by q.escopo
  )
  select pedido.escopo, coalesce(a.linhas, '[]'::json), coalesce(a.total, 0), v_editais,
         a.atualizado_em, coalesce(c.por_ano, '{}'::json)
    from unnest(p_escopos) as pedido(escopo)
    left join agregado a on a.escopo = pedido.escopo
    left join concluidas c on c.escopo = pedido.escopo;
end;
$function$;

-- 8. Preenchimento: as fichas que já existem dos editais em MONITORA -------------------------
do $$
declare
  v_ficha uuid;
  v_publicadas integer := 0;
begin
  for v_ficha in
    select f."CO_FICHA_ANALISE"
      from public."TB_FICHA_ANALISE" f
      join public."TB_ORIGEM_ANALISE_EDITAL" o on o."CO_MONITORAMENTO" = f."CO_MONITORAMENTO" and o."TP_ORIGEM" = 'MONITORA'
     order by f."CO_MONITORAMENTO", f."DT_CRIACAO", f."CO_FICHA_ANALISE"
  loop
    if private."FC_PUBLICAR_FICHA_ANALISE"(v_ficha) is not null then
      v_publicadas := v_publicadas + 1;
    end if;
  end loop;
  raise notice 'Fichas de editais em MONITORA publicadas no Painel das análises: %', v_publicadas;
end;
$$;

-- ===== fim do corpo =====

-- ===== conferências =====
create temporary table ensaio_resultado (ordem serial, etapa text, dados jsonb) on commit drop;
create temporary table ensaio_ficha (ficha uuid, analise_planilha uuid, admin uuid) on commit drop;

-- E1 permissões.
insert into ensaio_resultado (etapa, dados) select 'E1_permissoes', jsonb_build_object(
  'publicar_sem_grant', not has_function_privilege('authenticated', 'private."FC_PUBLICAR_FICHA_ANALISE"(uuid)', 'EXECUTE')
                        and not has_function_privilege('service_role', 'private."FC_PUBLICAR_FICHA_ANALISE"(uuid)', 'EXECUTE'),
  'definir_privada_sem_grant', not has_function_privilege('authenticated', 'private."FC_DEFINIR_ORIGEM_ANALISE"(uuid,text,text,uuid)', 'EXECUTE'),
  'rpc_authenticated', has_function_privilege('authenticated', 'public.definir_origem_analise(uuid,text,text)', 'EXECUTE'),
  'rpc_anon', has_function_privilege('anon', 'public.definir_origem_analise(uuid,text,text)', 'EXECUTE'),
  'auxiliar_service_role', has_function_privilege('service_role', 'public."FC_EDITAL_ANALISE_NO_MONITORA"(text,text)', 'EXECUTE'),
  'auxiliar_authenticated', has_function_privilege('authenticated', 'public."FC_EDITAL_ANALISE_NO_MONITORA"(text,text)', 'EXECUTE'));

-- E2 preenchimento: as fichas dos editais de treinamento (MONITORA) publicadas, linhas adotadas sem duplicar.
insert into ensaio_resultado (etapa, dados) select 'E2_preenchimento', jsonb_build_object(
  'por_situacao', (select jsonb_object_agg(x.edital || ' · ' || x.status, x.n) from (
      select private."FC_NUMERO_EDITAL"(a.edital) edital, a.status_consolidado status, count(*) n
        from public."TB_ANALISE_CURRICULAR" a where a."TP_ORIGEM_REGISTRO" = 'MONITORA' group by 1, 2) x),
  'fichas_dos_editais_monitora', (select count(*) from public."TB_FICHA_ANALISE" f
      join public."TB_ORIGEM_ANALISE_EDITAL" o on o."CO_MONITORAMENTO" = f."CO_MONITORAMENTO" and o."TP_ORIGEM" = 'MONITORA'),
  'linhas_monitora', (select count(*) from public."TB_ANALISE_CURRICULAR" a where a."TP_ORIGEM_REGISTRO" = 'MONITORA'),
  'monitora_fora_do_treinamento', (select count(*) from public."TB_ANALISE_CURRICULAR" a
      where a."TP_ORIGEM_REGISTRO" = 'MONITORA' and not private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)),
  'candidato_em_duas_linhas', (select count(*) from (select a.id_origem, a.codigo_vaga from public."TB_ANALISE_CURRICULAR" a
      where a."TP_ORIGEM_REGISTRO" = 'MONITORA' group by 1, 2 having count(*) > 1) d));

-- E3 a correção do 114/2026 (o mesmo bloco de supabase/correcoes/20261009-edital-114-analise-no-monitora.sql).
do $$
declare
  c_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  c_motivo constant text := 'Edital 114/2026: a avaliação documental será feita no MONITORA, pelas fichas, e não pela planilha';
  v_autor uuid := (select p.user_id from public."TB_PERFIL_USUARIO" p
                     join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
                    where p.ativo is true and a."ST_ADMIN_GLOBAL" and p.user_id is not null
                    order by p.user_id limit 1);
  v_r json;
  v_r2 json;
begin
  v_r := private."FC_DEFINIR_ORIGEM_ANALISE"(c_edital, 'MONITORA', c_motivo, v_autor);
  v_r2 := private."FC_DEFINIR_ORIGEM_ANALISE"(c_edital, 'MONITORA', c_motivo, v_autor);
  insert into ensaio_resultado (etapa, dados) values ('E3_correcao_114', jsonb_build_object(
    'primeira', v_r, 'de_novo', v_r2,
    'dono', (select o."TP_ORIGEM" from public."TB_ORIGEM_ANALISE_EDITAL" o where o."CO_MONITORAMENTO" = c_edital),
    'historico', (select jsonb_agg(jsonb_build_object('seq', h."NU_SEQUENCIA", 'de', h."TP_ORIGEM_ANTERIOR", 'para', h."TP_ORIGEM"))
                    from public."TH_ORIGEM_ANALISE_EDITAL" h where h."CO_MONITORAMENTO" = c_edital),
    'edital_no_painel', (select e from private."FC_MONTAR_PAINEL_ANALISE"('projetos', array['ativo'], false) m,
                           json_array_elements(m."DS_EDITAIS") e
                          where e ->> 'edital' = '114/2026'),
    'sync_ignora_114', public."FC_EDITAL_ANALISE_NO_MONITORA"('projetos', 'Edital 114/2026'),
    'sync_nao_ignora_93', public."FC_EDITAL_ANALISE_NO_MONITORA"('projetos', '93/2026')));
end;
$$;

-- E4 guarda: o 93/2026 já decidido pela planilha não vira MONITORA pela RPC (23514); motivo curto (22023).
do $$
declare
  v_autor uuid := (select p.user_id from public."TB_PERFIL_USUARIO" p
                     join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
                    where p.ativo is true and a."ST_ADMIN_GLOBAL" and p.user_id is not null
                    order by p.user_id limit 1);
  v_guarda text := 'não recusou';
  v_motivo text := 'não recusou';
begin
  begin
    perform private."FC_DEFINIR_ORIGEM_ANALISE"('f57d77e1-7f6b-416c-9f9e-6e40c6d5bded', 'MONITORA', 'Ensaio: tentar virar o 93/2026', v_autor);
  exception when sqlstate '23514' then v_guarda := sqlerrm;
  end;
  begin
    perform private."FC_DEFINIR_ORIGEM_ANALISE"('f57d77e1-7f6b-416c-9f9e-6e40c6d5bded', 'COMPARACAO', 'curto', v_autor);
  exception when sqlstate '22023' then v_motivo := sqlerrm;
  end;
  insert into ensaio_resultado (etapa, dados) values ('E4_guarda', jsonb_build_object('decidido_pela_planilha', v_guarda, 'motivo_curto', v_motivo));
end;
$$;

-- E5 a RPC pelo login (admin global): sem mudança no 992/2099, que já é MONITORA.
grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated"}', true);
select set_config('ensaio.rpc', public.definir_origem_analise('efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80', 'MONITORA', 'Ensaio: conferir a RPC pelo login')::text, true);
reset role;
insert into ensaio_resultado (etapa, dados) select 'E5_rpc_pelo_login', current_setting('ensaio.rpc')::jsonb;

-- E6 ciclo de uma ficha, no 93/2026 (só neste ensaio: o dono vira MONITORA direto na tabela, sem a guarda,
--    para ver a linha da planilha adotada e o painel lendo-a).
insert into public."TB_ORIGEM_ANALISE_EDITAL" ("CO_MONITORAMENTO", "TP_ORIGEM")
values ('f57d77e1-7f6b-416c-9f9e-6e40c6d5bded', 'MONITORA')
on conflict ("CO_MONITORAMENTO") do update set "TP_ORIGEM" = 'MONITORA';
insert into ensaio_ficha (ficha, analise_planilha, admin)
select f."CO_FICHA_ANALISE", a.id, 'a01afddb-f64b-47d9-80e8-476a1ed14e43'::uuid
  from public."TB_FICHA_ANALISE" f
  join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
  join public."TB_ANALISE_CURRICULAR" a
    on btrim(a.id_origem) = btrim(c."CO_CANDIDATO_EMPREGARE") and a.codigo_vaga = f."CO_VAGA"
   and a."CO_AREA" = 'projetos' and private."FC_NUMERO_EDITAL"(a.edital) = '93/2026' and a.ativo
 where f."CO_MONITORAMENTO" = 'f57d77e1-7f6b-416c-9f9e-6e40c6d5bded' and f."TP_SITUACAO" = 'PENDENTE'
 order by f."CO_FICHA_ANALISE" limit 1;
insert into ensaio_resultado (etapa, dados)
select 'E6a_planilha_antes', to_jsonb(x) from (
  select a.id, a.status_consolidado, a.etapa, a.responsavel_analise, a.nota_final_ajustada, a."TP_ORIGEM_REGISTRO"
    from public."TB_ANALISE_CURRICULAR" a where a.id = (select analise_planilha from ensaio_ficha)) x;

-- publicação das fichas do 93/2026 (como a troca de dono faria)
select count(private."FC_PUBLICAR_FICHA_ANALISE"(f."CO_FICHA_ANALISE"))
  from public."TB_FICHA_ANALISE" f where f."CO_MONITORAMENTO" = 'f57d77e1-7f6b-416c-9f9e-6e40c6d5bded';
create temporary view ensaio_linha as
  select a.id, a.id = (select analise_planilha from ensaio_ficha) as mesmo_id, a.status_consolidado, a.etapa,
         a.responsavel_analise, a.data_analise, a.nota_final_ajustada, a.pontuacao_escolaridade,
         a.pontuacao_cursos_aperfeicoamento, a.pontuacao_experiencia_profissional, a.experiencia_profissional_total,
         a.experiencia_profissional_anos, a.modalidade_concorrencia, a.pcd, a."TP_ORIGEM_REGISTRO", a.ativo
    from public."TB_ANALISE_CURRICULAR" a
   where a.id = (select analise_planilha from ensaio_ficha)
      or a.chave_natural = 'monitora|f57d77e1-7f6b-416c-9f9e-6e40c6d5bded|'
                           || (select f."CO_EMPREGARE_CANDIDATO" from public."TB_FICHA_ANALISE" f where f."CO_FICHA_ANALISE" = (select ficha from ensaio_ficha));
insert into ensaio_resultado (etapa, dados) select 'E6b_publicada_pendente', jsonb_agg(to_jsonb(l)) from ensaio_linha l;

update public."TB_FICHA_ANALISE" f
   set "CO_USUARIO_RESPONSAVEL" = e.admin, "DT_ATRIBUICAO" = now()
  from ensaio_ficha e where f."CO_FICHA_ANALISE" = e.ficha;
insert into ensaio_resultado (etapa, dados) select 'E6c_atribuida', jsonb_agg(to_jsonb(l)) from ensaio_linha l;

update public."TB_FICHA_ANALISE" f
   set "TP_SITUACAO" = 'EM_ANALISE', "CO_USUARIO_RESERVA" = e.admin, "DT_RESERVA" = now(),
       "DT_RESERVA_EXPIRA" = now() + interval '15 minutes'
  from ensaio_ficha e where f."CO_FICHA_ANALISE" = e.ficha;
insert into ensaio_resultado (etapa, dados) select 'E6d_em_analise', jsonb_agg(to_jsonb(l)) from ensaio_linha l;

update public."TB_FICHA_ANALISE" f
   set "TP_SITUACAO" = 'CONCLUIDA', "CO_USUARIO_RESERVA" = null, "DT_RESERVA" = null, "DT_RESERVA_EXPIRA" = null,
       "TP_RESULTADO" = 'APTO', "VL_NOTA_APURADA" = 20, "VL_NOTA_FINAL" = 20,
       "DS_PARECER" = 'Edital 93/2026 (ENSAIO) Candidato(a) HABILITADO(A) com 20,0 pontos.',
       "DS_LANCAMENTO" = '{}'::jsonb,
       "DS_RESULTADO" = '{"resultado":"APTO","nota_final":20,"parciais":{"FORMACAO":5,"CURSOS":5,"EXPERIENCIA":10},"experiencia":{"dias_total":2943,"por_categoria":{"AREA_OU_SUS":{"dias_total":2943}}}}'::jsonb,
       "CO_USUARIO_CONCLUSAO" = e.admin, "DT_CONCLUSAO" = now()
  from ensaio_ficha e where f."CO_FICHA_ANALISE" = e.ficha;
insert into ensaio_resultado (etapa, dados) select 'E6e_concluida_apta', jsonb_agg(to_jsonb(l)) from ensaio_linha l;

-- o painel (montagem do pacote "ativo" de Projetos) e a Classificação leem a linha
insert into ensaio_resultado (etapa, dados)
select 'E6f_painel_e_classificacao', jsonb_build_object(
  'painel_linha', (select r from private."FC_MONTAR_PAINEL_ANALISE"('projetos', array['ativo'], false) m,
                     json_array_elements(m."DS_LINHAS") r
                    where (r ->> 0)::uuid = (select analise_planilha from ensaio_ficha)),
  'painel_93_por_status', (select jsonb_object_agg(s, n) from (
      select r ->> 8 s, count(*) n from private."FC_MONTAR_PAINEL_ANALISE"('projetos', array['ativo'], false) m,
             json_array_elements(m."DS_LINHAS") r
       where private."FC_NUMERO_EDITAL"(r ->> 2) = '93/2026' group by 1) q),
  'classificacao', (select c from json_array_elements(
      private."FC_DADOS_CLASSIFICACAO_EDITAL"('f57d77e1-7f6b-416c-9f9e-6e40c6d5bded', 'projetos') -> 'candidatos') c
     where (c ->> 'analise_id')::uuid = (select analise_planilha from ensaio_ficha)));

-- E7 a sincronização da planilha não toca a linha MONITORA nem o edital MONITORA
create temporary table ensaio_sync on commit drop as select gen_random_uuid() as sync_id;
insert into public."TL_SYNC_ANALISE" (sync_id, origem, status, modo, resultado, linhas_staging, "CO_PLANILHA")
select sync_id, 'apps_script_analises_projetos_full_v1', 'carregado', 'FULL', '{}'::jsonb, 3, 'projetos' from ensaio_sync;
insert into public."TM_ANALISE_CURRICULAR" (sync_id, entidade, linha_origem, payload, hash_registro, created_at)
select s.sync_id, 'FATO_ANALISES', 1,
       jsonb_build_object('grupo', a.grupo, 'unidade', a.unidade, 'edital', a.edital, 'codigo_vaga', a.codigo_vaga,
                          'id', a.id_origem, 'candidato', a.candidato, 'status_consolidado', 'Reprovado',
                          'origem_arquivo_id', 'ensaio', 'responsavel_analise', 'Planilha (ensaio)'),
       'ensaio-1', now()
  from ensaio_sync s, public."TB_ANALISE_CURRICULAR" a where a.id = (select analise_planilha from ensaio_ficha)
union all
select s.sync_id, 'FATO_ANALISES', 2,
       jsonb_build_object('grupo', 'Projetos', 'unidade', 'Rio Doce', 'edital', 'Edital 114/2026', 'codigo_vaga', '999999',
                          'id', 'ENSAIO-114', 'candidato', 'Candidato Ensaio', 'status_consolidado', 'Aprovado',
                          'origem_arquivo_id', 'ensaio'),
       'ensaio-2', now()
  from ensaio_sync s
union all
select s.sync_id, 'DIM_EDITAIS', 3,
       jsonb_build_object('grupo', 'Projetos', 'unidade', 'Rio Doce', 'edital', 'Edital 114/2026', 'ativo', true,
                          'data_inicio_analise', '2026-10-15', 'data_fim_analise', '2026-10-22'),
       'ensaio-3', now()
  from ensaio_sync s;
create temporary table ensaio_lote on commit drop as
  select public.processar_sync_analises_lote((select sync_id from ensaio_sync), 500) as r;
create temporary table ensaio_fim on commit drop as
  select public.finalizar_sync_analises_lotes((select sync_id from ensaio_sync)) as r;
insert into ensaio_resultado (etapa, dados) select 'E7_sincronizacao', jsonb_build_object(
  'lote', (select r from ensaio_lote),
  'fim', (select r - 'sync_id' from ensaio_fim),
  'linha_monitora_depois', (select jsonb_agg(to_jsonb(l)) from ensaio_linha l),
  'monitora_ativas', (select count(*) from public."TB_ANALISE_CURRICULAR" a where a."TP_ORIGEM_REGISTRO" = 'MONITORA' and a.ativo),
  'linha_114_da_planilha', (select count(*) from public."TB_ANALISE_CURRICULAR" a where a.id_origem = 'ENSAIO-114'),
  'edital_114_na_planilha', (select count(*) from public."TB_EDITAL_ANALISE" e where private."FC_NUMERO_EDITAL"(e.edital) = '114/2026'));

-- E8 reabrir e reiniciar (a função real do reinício) devolvem a linha a Em análise e a Pendente.
update public."TB_FICHA_ANALISE" f
   set "TP_SITUACAO" = 'EM_ANALISE', "NU_VERSAO" = f."NU_VERSAO" + 1
  from ensaio_ficha e where f."CO_FICHA_ANALISE" = e.ficha;
insert into ensaio_resultado (etapa, dados) select 'E8a_reaberta', jsonb_agg(to_jsonb(l)) from ensaio_linha l;
select private."FC_REINICIAR_FICHAS_DO_EDITAL"('f57d77e1-7f6b-416c-9f9e-6e40c6d5bded', 'Ensaio: reiniciar para ver a linha voltar a Pendente',
                                               (select admin from ensaio_ficha));
insert into ensaio_resultado (etapa, dados) select 'E8b_reiniciada', jsonb_agg(to_jsonb(l)) from ensaio_linha l;

select jsonb_object_agg(etapa, dados order by ordem) as ensaio from ensaio_resultado;

rollback;
