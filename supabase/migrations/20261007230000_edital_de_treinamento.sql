/*
  EDITAL DE TREINAMENTO (07/10/2026)

  Pedido: "um edital de treinamento para testar tudo sem tocar em dados reais,
  começando por Entrevistas da Saúde Indígena (e depois Avaliação documental)".

  O que muda
    1. TB_MONITORAMENTO_INDIGENA."ST_TREINAMENTO" (S/N, padrão N): marca o
       edital de treinamento. A tela não muda a marca; só
       private."FC_PREPARAR_EDITAL_TREINAMENTO" cria edital com 'S'.
    2. O predicado, num lugar só (use estes e nada de "ST_TREINAMENTO" = 'S'
       solto em função nova):
         private."FC_EH_TREINAMENTO"(marca)          a marca da linha do edital
         private."FC_EDITAL_EH_TREINAMENTO"(edital)  pelo id (lê a marca)
         private."FC_ANALISE_EH_TREINAMENTO"(origem) análise fictícia
                                                     (origem_planilha = 'treinamento')
       No front: src/lib/edital-de-treinamento.js.
    3. O edital de treinamento fica FORA de:
         - Visão geral / indicadores: VW_MONITORAMENTO_INDIGENA_KPIS,
           _POR_EDITAL, _POR_UNIDADE e listar_acompanhamento_da_visao_geral;
         - painéis e seus caches: VW_ANALISES_DASHBOARD_BASE_TODOS (painel das
           análises, TA_PAINEL_ANALISE, obter_marcos_da_area e
           get_analises_dashboard_payload_v2 leem dela),
           private."FC_MONTAR_ENTREVISTAS_AREA" (cache do painel de
           entrevistas e Aya), private."FC_MONTAR_APROVADOS_AREA" e o formato
           antigo de listar_candidatos_aprovados_compacto (aprovados);
         - conferências: conferencia_ler_analises/_entrevistas/
           _classificacao/_aprovados (conferencia_ler_contexto continua com
           todos: é só a tabela de consulta de número e área);
         - robôs no modo padrão: listar_vagas_empregare (PADRAO) e
           pre_classificacao_ler_editais (padrão e "após o robô"); pedido
           explícito pelo número ou id continua valendo (a pré-classificação
           do treinamento roda quando pedida para ele);
         - a sincronização das análises (finalizar_sync_analises_lotes) não
           desativa as análises fictícias, que não estão na planilha.
       E APARECE, com a marca 'treinamento' no JSON para o selo, em
       listar_editais_entrevista, obter_entrevistas_do_edital,
       listar_editais_avaliacao, listar_editais_classificacao,
       FC_DADOS_CLASSIFICACAO_EDITAL, obter_pre_classificacao,
       pre_classificacao_ler_editais e get_painel_dos_robos (o documento
       oficial gerado sai com "TREINAMENTO — SEM VALOR OFICIAL"); e VW_MONITORAMENTO_INDIGENA_OPERACIONAL passa a
       ter a coluna (Editais mostra o selo).
    4. private."FC_PREPARAR_EDITAL_TREINAMENTO"(p_area): idempotente; cria (ou
       completa) o edital "Treinamento – Saúde Indígena (991/2099)", unidade
       fictícia "DSEI Treinamento", com cronograma relativo a hoje (janela de
       entrevista aberta), quadro de vagas, 15 candidatos fictícios (análise
       aprovada, lista de convocação, inscrição e questionário no formato da
       Empregare), roteiro de entrevista de exemplo, regra da classificação e
       regra da avaliação documental copiada de um modelo SI.
    5. public.reiniciar_edital_treinamento(p_edital): só admin global; apaga
       FISICAMENTE os dados do edital de treinamento e chama o preparar.
       EXCEÇÃO DOCUMENTADA à regra de exclusão lógica (docs/banco-de-dados.md,
       seção 16): vale só para edital com "ST_TREINAMENTO" = 'S' —
       private."FC_APAGAR_DADOS_DO_TREINAMENTO" confere a marca com a linha
       travada antes de qualquer delete, e os gatilhos de imutabilidade só
       deixam apagar quando a transação marcou o reinício DESTE edital
       (private."FC_REINICIO_TREINAMENTO_PERMITE").

  Dependentes: src/app/carga.js (coluna), src/lib/edital-de-treinamento.js,
  telas de Editais, Entrevistas, Avaliação documental, Classificação, painel
  dos robôs; src/lib/rpc-contrato.js (reiniciar_edital_treinamento).
  Os caches (20261007220000) não mudam: o predicado está nas montagens e na
  view que eles leem.

  Rollback: supabase/rollback/20261007230000_edital_de_treinamento.sql
  (apaga o edital de treinamento e devolve views, funções e gatilhos como
  estavam). Ensaio: supabase/ensaios/20261007230000_edital_de_treinamento.sql.
*/
begin;

-- Falha rápido em vez de enfileirar o tráfego atrás da troca das views.
set local lock_timeout = '10s';

-- ── 1. A marca ─────────────────────────────────────────────────────────────
alter table public."TB_MONITORAMENTO_INDIGENA"
  add column if not exists "ST_TREINAMENTO" character varying(1) not null default 'N';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'CK_MONITINDIG_STTREINAMENTO') then
    alter table public."TB_MONITORAMENTO_INDIGENA"
      add constraint "CK_MONITINDIG_STTREINAMENTO" check ("ST_TREINAMENTO" in ('S', 'N'));
  end if;
end $$;

comment on column public."TB_MONITORAMENTO_INDIGENA"."ST_TREINAMENTO" is
  'S = edital de treinamento (dados fictícios, sem valor oficial): fora da Visão geral, indicadores, painéis, caches, conferências e robôs; aparece nas telas operacionais com o selo "Treinamento". Só private."FC_PREPARAR_EDITAL_TREINAMENTO" grava S. Padrão N.';
comment on constraint "CK_MONITINDIG_STTREINAMENTO" on public."TB_MONITORAMENTO_INDIGENA" is
  'Marca do edital de treinamento: S ou N.';

-- ── 2. O predicado ─────────────────────────────────────────────────────────
create or replace function private."FC_EH_TREINAMENTO"(p_marca text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(p_marca, 'N') = 'S';
$$;
comment on function private."FC_EH_TREINAMENTO"(text) is
  'Predicado único do edital de treinamento pela marca da linha ("ST_TREINAMENTO"). Use em toda leitura de indicador, painel, cache, conferência ou robô: where not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO").';

create or replace function private."FC_EDITAL_EH_TREINAMENTO"(p_edital uuid)
returns boolean
language sql
stable
parallel safe
set search_path = ''
as $$
  select coalesce((select private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
                     from public."TB_MONITORAMENTO_INDIGENA" m
                    where m.id = p_edital), false);
$$;
comment on function private."FC_EDITAL_EH_TREINAMENTO"(uuid) is
  'O edital (id) é de treinamento? Para quem só tem o id (entrevistas, listas, vagas). Edital nulo ou inexistente: false.';

create or replace function private."FC_ANALISE_EH_TREINAMENTO"(p_origem_planilha text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(p_origem_planilha, '') = 'treinamento';
$$;
comment on function private."FC_ANALISE_EH_TREINAMENTO"(text) is
  'A análise curricular é fictícia do edital de treinamento (TB_ANALISE_CURRICULAR.origem_planilha = ''treinamento'')? A análise não tem o id do edital (liga pelo número), por isso a marca fica na origem.';

revoke all on function private."FC_EH_TREINAMENTO"(text) from public, anon;
revoke all on function private."FC_EDITAL_EH_TREINAMENTO"(uuid) from public, anon;
revoke all on function private."FC_ANALISE_EH_TREINAMENTO"(text) from public, anon;
-- As views são security_invoker: quem lê a view executa o predicado.
grant execute on function private."FC_EH_TREINAMENTO"(text) to authenticated, service_role;
grant execute on function private."FC_EDITAL_EH_TREINAMENTO"(uuid) to authenticated, service_role;
grant execute on function private."FC_ANALISE_EH_TREINAMENTO"(text) to authenticated, service_role;

-- ── 3. A exceção à imutabilidade: só no reinício do treinamento ────────────
create or replace function private."FC_REINICIO_TREINAMENTO_PERMITE"(p_tabela text, p_linha jsonb)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_alvo text := nullif(current_setting('agsus.reinicio_treinamento', true), '');
  v_edital uuid;
begin
  if v_alvo is null or v_alvo !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  v_edital := v_alvo::uuid;
  if not private."FC_EDITAL_EH_TREINAMENTO"(v_edital) then
    return false;
  end if;
  if p_linha ? 'CO_MONITORAMENTO' then
    return p_linha ->> 'CO_MONITORAMENTO' = v_edital::text;
  end if;
  -- Linhas sem o edital: confere pelo pai (que ainda existe: filhos saem antes).
  return case p_tabela
    when 'TH_FICHA_ANALISE' then exists (select 1 from public."TB_FICHA_ANALISE" f
      where f."CO_FICHA_ANALISE"::text = p_linha ->> 'CO_FICHA_ANALISE' and f."CO_MONITORAMENTO" = v_edital)
    when 'TL_ACESSO_FICHA_ANALISE' then exists (select 1 from public."TB_FICHA_ANALISE" f
      where f."CO_FICHA_ANALISE"::text = p_linha ->> 'CO_FICHA_ANALISE' and f."CO_MONITORAMENTO" = v_edital)
    when 'TH_DECISAO_LOTE' then exists (select 1 from public."TB_DECISAO_LOTE" d
      where d."CO_DECISAO_LOTE"::text = p_linha ->> 'CO_DECISAO_LOTE' and d."CO_MONITORAMENTO" = v_edital)
    when 'TH_REGRA_ANALISE' then exists (select 1 from public."TB_REGRA_ANALISE" r
      where r."CO_REGRA_ANALISE"::text = p_linha ->> 'CO_REGRA_ANALISE' and r."CO_MONITORAMENTO" = v_edital)
    when 'TB_ITEM_AJUSTE_PONTUACAO' then exists (select 1 from public."TB_AJUSTE_PONTUACAO_RECURSO" j
      where j."CO_AJUSTE_PONTUACAO"::text = p_linha ->> 'CO_AJUSTE_PONTUACAO' and j."CO_MONITORAMENTO" = v_edital)
    else false
  end;
end;
$$;
comment on function private."FC_REINICIO_TREINAMENTO_PERMITE"(text, jsonb) is
  'Os gatilhos de imutabilidade deixam apagar a linha? Só quando a transação marcou agsus.reinicio_treinamento com o id de um edital de TREINAMENTO e a linha é desse edital (direto ou pelo pai). Quem marca é só private."FC_APAGAR_DADOS_DO_TREINAMENTO".';
revoke all on function private."FC_REINICIO_TREINAMENTO_PERMITE"(text, jsonb) from public, anon, authenticated;
grant execute on function private."FC_REINICIO_TREINAMENTO_PERMITE"(text, jsonb) to service_role;

CREATE OR REPLACE FUNCTION private."FC_TG_FICHA_IMUTAVEL"()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'DELETE' and private."FC_REINICIO_TREINAMENTO_PERMITE"(tg_table_name, to_jsonb(old)) then
    return old;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Registro da avaliação documental não se apaga (%)', tg_table_name using errcode = '42501';
  end if;
  raise exception 'Histórico não muda (%)', tg_table_name using errcode = '42501';
end;
$function$;

CREATE OR REPLACE FUNCTION private."FC_TG_PRE_CLASSIF_IMUTAVEL"()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'DELETE' and private."FC_REINICIO_TREINAMENTO_PERMITE"(tg_table_name, to_jsonb(old)) then
    return old;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'A pré-classificação não se apaga (%): rode o job de novo', tg_table_name using errcode = '42501';
  end if;
  raise exception 'Histórico não muda (%)', tg_table_name using errcode = '42501';
end;
$function$;

CREATE OR REPLACE FUNCTION private."FC_TG_REGRA_ANALISE_IMUTAVEL"()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'DELETE' and private."FC_REINICIO_TREINAMENTO_PERMITE"(tg_table_name, to_jsonb(old)) then
    return old;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Registro da avaliação documental não se apaga (%): desative ou crie outra versão', tg_table_name using errcode = '42501';
  end if;
  if tg_table_name in ('TH_REGRA_ANALISE', 'TH_ORIGEM_ANALISE_EDITAL') then
    raise exception 'Histórico não muda (%): crie outra versão', tg_table_name using errcode = '42501';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private."FC_TG_AJUSTE_PONTUACAO_IMUTAVEL"()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'DELETE' and private."FC_REINICIO_TREINAMENTO_PERMITE"(tg_table_name, to_jsonb(old)) then
    return old;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Ajuste da pontuação não se apaga: cancele' using errcode = '42501';
  end if;
  if tg_table_name = 'TB_ITEM_AJUSTE_PONTUACAO' then
    raise exception 'Os itens de uma versão do ajuste não mudam: proponha outra versão' using errcode = '42501';
  end if;
  if (new."CO_RECURSO_CANDIDATO", new."CO_MONITORAMENTO", new."CO_ANALISE_CURRICULAR", new."NU_VERSAO",
      new."TP_LISTA", new."DS_JUSTIFICATIVA", new."DS_PREVIA", new."DT_PROPOSTA", new."CO_USUARIO_PROPOSTA")
     is distinct from
     (old."CO_RECURSO_CANDIDATO", old."CO_MONITORAMENTO", old."CO_ANALISE_CURRICULAR", old."NU_VERSAO",
      old."TP_LISTA", old."DS_JUSTIFICATIVA", old."DS_PREVIA", old."DT_PROPOSTA", old."CO_USUARIO_PROPOSTA") then
    raise exception 'Os valores de uma versão do ajuste não mudam: proponha outra versão' using errcode = '42501';
  end if;
  if new."TP_SITUACAO" is distinct from old."TP_SITUACAO"
     and not ((old."TP_SITUACAO" = 'PROPOSTO' and new."TP_SITUACAO" in ('APROVADO', 'CANCELADO'))
              or (old."TP_SITUACAO" = 'APROVADO' and new."TP_SITUACAO" = 'CANCELADO')) then
    raise exception 'Passagem inválida do ajuste: % → %', old."TP_SITUACAO", new."TP_SITUACAO" using errcode = '22023';
  end if;
  if old."TP_SITUACAO" = 'CANCELADO' then
    raise exception 'Ajuste cancelado não muda' using errcode = '22023';
  end if;
  return new;
end;
$function$;

-- ── 4. Views: a coluna na operacional e o predicado nos indicadores ────────
create or replace view public."VW_MONITORAMENTO_INDIGENA_OPERACIONAL"
with (security_invoker = true) as
 SELECT m.id,
    m.processo,
    m.edital,
    m.id_unidade,
    m.sigla_unidade,
    m.tipo_unidade,
    m.unidade,
    m.uf,
    m.ciclo,
    m.cargos,
    m.vagas_total,
    m.inscritos,
    m.aptos_analise,
    m.cancelados,
    m.eliminados_nota,
    m.reprovados_analise,
    m.total_eliminados,
    m.aprovados_analise,
    m.aprovados_prova,
    m.entrevistados,
    m.contratados,
    m.vagas_ociosas,
    COALESCE((estado.estado ->> 'data_inicio'::text)::date, m.data_inicio) AS data_inicio,
    COALESCE((estado.estado ->> 'data_fim'::text)::date, m.data_fim) AS data_fim,
    COALESCE(estado.estado ->> 'status'::text, m.status, ''::text) AS status,
    COALESCE(estado.estado ->> 'etapa'::text, m.etapa, ''::text) AS etapa,
    m.risco,
    m.responsavel,
    m.link_edital,
    m.observacoes,
    m.observacoes_internas,
    m.ativo,
    m.created_by,
    m.updated_by,
    m.created_at,
    m.updated_at,
    m.quantidade_cadastro_reserva,
    m.dias_ate_encerramento,
    m.duracao_total_processo,
    m.origem_carga,
    m.raw_json,
    m.cronograma_automatico,
    m.cronograma_pdf_path,
    m.cronograma_pdf_nome,
    m.cronograma_origem,
    m.cronograma_revisado_at,
    m.cronograma_revisado_por,
    m.status_override,
    m.etapa_override,
    COALESCE((estado.estado ->> 'percentual'::text)::numeric, 0::numeric) AS cronograma_percentual,
    estado.estado ->> 'atividade_atual'::text AS cronograma_atividade_atual,
    estado.estado ->> 'proxima_atividade'::text AS cronograma_proxima_atividade,
    (estado.estado ->> 'proxima_data'::text)::date AS cronograma_proxima_data,
    (estado.estado ->> 'dias_para_proxima'::text)::integer AS cronograma_dias_para_proxima,
    m."CO_AREA",
    m."ST_TREINAMENTO"
   FROM public."TB_MONITORAMENTO_INDIGENA" m
     CROSS JOIN LATERAL public.get_monitoramento_cronograma_estado(m.id, CURRENT_DATE) estado(estado);

create or replace view public."VW_MONITORAMENTO_INDIGENA_KPIS"
with (security_invoker = true) as
 SELECT count(*)::integer AS processos_ativos,
    COALESCE(sum(vagas_total), 0::bigint)::integer AS vagas_total,
    COALESCE(sum(inscritos), 0::bigint)::integer AS inscritos,
    COALESCE(sum(aptos_analise), 0::bigint)::integer AS aptos_analise,
    COALESCE(sum(contratados), 0::bigint)::integer AS contratados,
    COALESCE(sum(vagas_ociosas), 0::bigint)::integer AS vagas_ociosas,
    COALESCE(sum(cancelados), 0::bigint)::integer AS cancelados,
    COALESCE(sum(total_eliminados), 0::bigint)::integer AS total_eliminados,
    round(
        CASE
            WHEN COALESCE(sum(vagas_total), 0::bigint) > 0 THEN COALESCE(sum(contratados), 0::bigint)::numeric / NULLIF(sum(vagas_total), 0)::numeric * 100::numeric
            ELSE 0::numeric
        END, 2) AS pct_ocupacao,
    round(
        CASE
            WHEN COALESCE(sum(vagas_total), 0::bigint) > 0 THEN COALESCE(sum(vagas_ociosas), 0::bigint)::numeric / NULLIF(sum(vagas_total), 0)::numeric * 100::numeric
            ELSE 0::numeric
        END, 2) AS pct_ociosidade,
    max(updated_at) AS ultima_atualizacao
   FROM public."TB_MONITORAMENTO_INDIGENA"
  WHERE ativo IS TRUE AND NOT private."FC_EH_TREINAMENTO"("ST_TREINAMENTO");

create or replace view public."VW_MONITORAMENTO_INDIGENA_POR_EDITAL"
with (security_invoker = true) as
 SELECT unidade,
    uf,
    edital,
    COALESCE(ciclo, ''::text) AS ciclo,
    COALESCE(etapa, ''::text) AS etapa,
    COALESCE(status, ''::text) AS status,
    COALESCE(risco, ''::text) AS risco,
    count(*)::integer AS processos,
    COALESCE(sum(vagas_total), 0::bigint)::integer AS vagas_total,
    COALESCE(sum(inscritos), 0::bigint)::integer AS inscritos,
    COALESCE(sum(contratados), 0::bigint)::integer AS contratados,
    COALESCE(sum(vagas_ociosas), 0::bigint)::integer AS vagas_ociosas,
    min(data_inicio) AS primeira_data_inicio,
    max(data_fim) AS ultima_data_fim,
    max(updated_at) AS ultima_atualizacao
   FROM public."VW_MONITORAMENTO_INDIGENA_OPERACIONAL"
  WHERE ativo IS TRUE AND NOT private."FC_EH_TREINAMENTO"("ST_TREINAMENTO")
  GROUP BY unidade, uf, edital, (COALESCE(ciclo, ''::text)), (COALESCE(etapa, ''::text)), (COALESCE(status, ''::text)), (COALESCE(risco, ''::text));

create or replace view public."VW_MONITORAMENTO_INDIGENA_POR_UNIDADE"
with (security_invoker = true) as
 SELECT COALESCE(id_unidade, ''::text) AS id_unidade,
    COALESCE(sigla_unidade, ''::text) AS sigla_unidade,
    unidade,
    tipo_unidade,
    uf,
    count(*)::integer AS processos,
    COALESCE(sum(vagas_total), 0::bigint)::integer AS vagas_total,
    COALESCE(sum(inscritos), 0::bigint)::integer AS inscritos,
    COALESCE(sum(aptos_analise), 0::bigint)::integer AS aptos_analise,
    COALESCE(sum(contratados), 0::bigint)::integer AS contratados,
    COALESCE(sum(vagas_ociosas), 0::bigint)::integer AS vagas_ociosas,
    count(*) FILTER (WHERE lower(COALESCE(risco, ''::text)) = ANY (ARRAY['alto'::text, 'alta'::text]))::integer AS processos_risco_alto,
    count(*) FILTER (WHERE lower(COALESCE(status, ''::text)) = ANY (ARRAY['concluido'::text, 'concluÃ­do'::text, 'encerrado'::text]))::integer AS processos_encerrados,
    max(updated_at) AS ultima_atualizacao
   FROM public."VW_MONITORAMENTO_INDIGENA_OPERACIONAL"
  WHERE ativo IS TRUE AND NOT private."FC_EH_TREINAMENTO"("ST_TREINAMENTO")
  GROUP BY (COALESCE(id_unidade, ''::text)), (COALESCE(sigla_unidade, ''::text)), unidade, tipo_unidade, uf;

create or replace view public."VW_ANALISES_DASHBOARD_BASE_TODOS"
with (security_invoker = true) as
 SELECT a.id,
    a.grupo,
    a.unidade,
    a.edital,
    a.codigo_vaga,
    a.nome_vaga,
    a.candidato,
    a.categoria,
    a.modalidade_concorrencia,
    a.status_consolidado,
    a.etapa,
    a.responsavel_analise,
    a.data_analise,
    a.nota_final_ajustada,
    a.pontuacao_escolaridade,
    a.pontuacao_cursos_aperfeicoamento,
    a.pontuacao_experiencia_profissional,
    a.pontuacao_criterio_etnico,
    a.experiencia_saude_indigena_total,
    a.experiencia_atencao_basica_total,
    a.analise,
    a.link_pdf,
    a.pdf_status,
    a.erro_pdf,
    a.origem_url,
    e.data_inicio_analise,
    e.data_fim_analise,
        CASE
            WHEN a.data_analise IS NULL THEN 'SEM_DATA'::text
            WHEN e.data_inicio_analise IS NULL AND e.data_fim_analise IS NULL THEN 'SEM_JANELA'::text
            WHEN e.data_inicio_analise IS NOT NULL AND a.data_analise < e.data_inicio_analise OR e.data_fim_analise IS NOT NULL AND a.data_analise > e.data_fim_analise THEN 'FORA_PERIODO'::text
            ELSE 'DENTRO_PERIODO'::text
        END AS data_validacao_status,
    a.updated_at,
    a.ultima_atualizacao,
    a.origem_arquivo_id,
    a.origem_planilha,
    a.pdf_gerado,
    a.data_geracao_pdf,
    a.pdf_file_id,
    a.pdf_ultima_tentativa,
    a.pdf_hash_origem,
    a.chave_natural,
    COALESCE(e.ativo, true) AS edital_ativo,
        CASE
            WHEN COALESCE(e.ativo, true) IS TRUE THEN 'Ativo'::text
            ELSE 'Inativo'::text
        END AS edital_status,
    COALESCE(a.ativo, false) AS ativo,
        CASE
            WHEN COALESCE(e.ativo, true) IS TRUE THEN 'Ativo'::text
            ELSE 'Inativo'::text
        END AS situacao_processo,
    COALESCE(e.ativo, true) AS edital_cadastro_ativo,
        CASE
            WHEN COALESCE(e.ativo, true) IS TRUE THEN 'Ativo'::text
            ELSE 'Inativo'::text
        END AS edital_cadastro_status,
    e.id IS NOT NULL AS edital_encontrado
   FROM public."TB_ANALISE_CURRICULAR" a
     LEFT JOIN LATERAL ( SELECT e1.id,
            e1.grupo,
            e1.unidade,
            e1.edital,
            e1.ativo,
            e1.data_inicio_analise,
            e1.data_fim_analise,
            e1.created_at,
            e1.updated_at,
            e1.grupo_norm,
            e1.unidade_norm,
            e1.edital_norm,
            e1."CO_PLANILHA"
           FROM public."TB_EDITAL_ANALISE" e1
          WHERE e1.grupo_norm = a.grupo_norm AND e1.edital_norm = a.edital_norm AND (e1.unidade_norm = a.unidade_norm OR (( SELECT count(*) AS count
                   FROM public."TB_EDITAL_ANALISE" e2
                  WHERE e2.grupo_norm = a.grupo_norm AND e2.edital_norm = a.edital_norm)) = 1)
          ORDER BY (e1.unidade_norm = a.unidade_norm) DESC
         LIMIT 1) e ON true
  WHERE NOT private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha);

-- ── 5. Funções que passam a usar o predicado (corpo = versão viva + o predicado) ──

-- listar_acompanhamento_da_visao_geral
CREATE OR REPLACE FUNCTION public.listar_acompanhamento_da_visao_geral(p_area text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
declare
  v_area text := lower(btrim(coalesce(p_area, '')));
  v_editais uuid[];
begin
  if not private.pode_recurso('dashboard') then
    raise exception 'Sem permissão para este recurso' using errcode = '42501';
  end if;
  if not (v_area = any ((select private."FC_AREAS_USUARIO"())::text[])) then
    raise exception 'Sem permissão para esta área' using errcode = '42501';
  end if;

  select coalesce(array_agg(m.id), '{}') into v_editais
    from public."TB_MONITORAMENTO_INDIGENA" m
   where m.ativo
     and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
     and m."CO_AREA" = v_area
     and ((select private."FC_EDITAIS_VISIVEIS"()) is null
          or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]));

  return jsonb_build_object(
    'etapas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'monitoramento_id', c.monitoramento_id,
               'ordem', c.ordem,
               'atividade', c.atividade,
               'data_inicio', c.data_inicio,
               'data_fim', c.data_fim
             ) order by c.monitoramento_id, c.data_inicio, c.ordem)
        from public."TB_CRONOGRAMA_MONIT_INDIG" c
       where c.monitoramento_id = any (v_editais)
    ), '[]'::jsonb),
    'listas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'monitoramento_id', r.edital_id,
               'aprovados', r.aprovados,
               'com_status', r.com_status,
               'contratados', r.contratados,
               'desistentes', r.desistentes
             ) order by r.edital_id)
        from (
          select l.edital_id,
                 count(c.id)::integer as aprovados,
                 (count(c.id) filter (where nullif(btrim(c.status), '') is not null))::integer as com_status,
                 (count(c.id) filter (where c.status in ('Contratado', 'Migração')))::integer as contratados,
                 (count(c.id) filter (where c.status = 'Desistente'))::integer as desistentes
            from public."TB_LISTA_APROVADO" l
            left join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
           where l.vigente is true
             and l.edital_id = any (select unnest(v_editais)::text)
           group by l.edital_id
        ) r
    ), '[]'::jsonb)
  );
end;
$function$;

-- FC_MONTAR_ENTREVISTAS_AREA
CREATE OR REPLACE FUNCTION private."FC_MONTAR_ENTREVISTAS_AREA"(p_area text, p_editais uuid[])
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  return (
    with e as (
      select e.*
        from public."TB_ENTREVISTA" e
       where e."CO_AREA" = p_area and e."ST_ATIVO" = 'S'
         and not private."FC_EDITAL_EH_TREINAMENTO"(e."CO_MONITORAMENTO")
         and (p_editais is null or e."CO_MONITORAMENTO" = any (p_editais))
    ),
    criterios as (
      select n."DS_CRITERIO" as criterio, row_number() over (order by min(n."NU_ORDEM"), n."DS_CRITERIO") - 1 as i
        from public."TB_ENTREVISTA_NOTA" n
        join e on e."CO_ENTREVISTA" = n."CO_ENTREVISTA"
       where n."VL_NOTA" is not null
       group by n."DS_CRITERIO"
    ),
    vagas as (
      select distinct e."CO_VAGA" from e
    ),
    sem_entrevista as (
      select a.id, a.candidato, a.id_origem, a.codigo_vaga, a.nome_vaga, a.edital, a.unidade,
             a.nota_final_ajustada, a.modalidade_concorrencia
        from public."TB_ANALISE_CURRICULAR" a
        join vagas v on v."CO_VAGA" = a.codigo_vaga
       where a."CO_AREA" = p_area and a.ativo
         and not private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)
         and a.status_consolidado = 'Aprovado'
         and not exists (select 1 from public."TB_ENTREVISTA" x
                          where x."CO_ANALISE_CURRICULAR" = a.id and x."ST_ATIVO" = 'S')
         and (p_editais is null or exists (
               select 1 from public."TB_MONITORAMENTO_INDIGENA" m
                where m.id = any (p_editais) and m."CO_AREA" = a."CO_AREA"
                  and private."FC_NUMERO_EDITAL"(m.edital) = private."FC_NUMERO_EDITAL"(a.edital)))
       order by a.edital, a.codigo_vaga, a.candidato
       limit 3000
    )
    select json_build_object(
      'schema_version', 1,
      'area', p_area,
      'gerado_em', now(),
      'ultima_carga', (
        select json_build_object('em', s."DT_FIM", 'linhas', s."QT_LINHA",
                                 'ligadas_analise', s."QT_LIGADA_ANALISE",
                                 'sem_analise', s."QT_SEM_ANALISE", 'sem_edital', s."QT_SEM_EDITAL")
          from public."TL_SYNC_ENTREVISTA" s
         where s."CO_AREA" = p_area and s."TP_SITUACAO" = 'CONCLUIDA'
         order by s."DT_FIM" desc limit 1
      ),
      'criterios', (select coalesce(json_agg(c.criterio order by c.i), '[]'::json) from criterios c),
      'entrevistas', (
        select coalesce(json_agg(json_build_object(
            'id', e."CO_ENTREVISTA",
            'edital_id', e."CO_MONITORAMENTO",
            'edital', coalesce(m.edital, e."DS_EDITAL"),
            'edital_planilha', e."DS_EDITAL",
            'unidade', coalesce(m.unidade, e."NO_UNIDADE"),
            'vaga', e."CO_VAGA",
            'cargo', coalesce(a.nome_vaga, e."NO_CARGO"),
            'candidato', e."NO_CANDIDATO",
            'codigo', e."CO_CANDIDATO",
            'modalidade', coalesce(a.modalidade_concorrencia, e."DS_MODALIDADE"),
            'nota', e."VL_NOTA_TOTAL",
            'parecer', e."TP_PARECER",
            'compareceu', e."ST_COMPARECEU",
            'link', e."DS_LINK_PLANILHA",
            'notas', (
              select coalesce(json_agg(json_build_array(c.i, n."VL_NOTA") order by n."NU_ORDEM"), '[]'::json)
                from public."TB_ENTREVISTA_NOTA" n
                join criterios c on c.criterio = n."DS_CRITERIO"
               where n."CO_ENTREVISTA" = e."CO_ENTREVISTA" and n."VL_NOTA" is not null
            ),
            'analise', case when a.id is null then null else json_build_object(
              'id', a.id,
              'ligacao', e."TP_LIGACAO_ANALISE",
              'nota', a.nota_final_ajustada,
              'resultado', a.status_consolidado,
              'etapa', a.etapa,
              'responsavel', a.responsavel_analise,
              'ativo', a.ativo
            ) end
          ) order by coalesce(m.edital, e."DS_EDITAL"), e."CO_VAGA", e."VL_NOTA_TOTAL" desc nulls last, e."NO_CANDIDATO"), '[]'::json)
          from e
          left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = e."CO_MONITORAMENTO"
          left join public."TB_ANALISE_CURRICULAR" a on a.id = e."CO_ANALISE_CURRICULAR"
      ),
      'aprovados_sem_entrevista', (
        select coalesce(json_agg(json_build_object(
            'analise_id', s.id,
            'candidato', s.candidato,
            'codigo', s.id_origem,
            'vaga', s.codigo_vaga,
            'cargo', s.nome_vaga,
            'edital', s.edital,
            'unidade', s.unidade,
            'nota', s.nota_final_ajustada,
            'modalidade', s.modalidade_concorrencia
          )), '[]'::json)
          from sem_entrevista s
      )
    )
  );
end;
$function$;

-- FC_MONTAR_APROVADOS_AREA
CREATE OR REPLACE FUNCTION private."FC_MONTAR_APROVADOS_AREA"(p_area text, p_editais uuid[], OUT p_listas json, OUT p_dicionarios json, OUT p_linhas json, OUT p_total integer)
 RETURNS record
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
 SET work_mem TO '64MB'
 SET jit TO 'off'
AS $function$
begin
  with listas as (
    select l.id, l.edital_id, m.edital, m.unidade, l.ativo, l.arquivo_nome, l.importado_em,
           (row_number() over (order by m.edital, l.id) - 1)::integer as i
      from public."TB_LISTA_APROVADO" l
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
     where l.vigente is true
       and m."CO_AREA" = p_area
       and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
       and (p_editais is null or m.id = any (p_editais))
  ), cand as materialized (
    select c.id, li.i as lista, li.edital, c.cargo, c.classificacao, c.nota, c.nome,
           c.modalidade, c.status, c.processo_sei, c.matricula, c.sub_judice, c.codigo_vaga,
           c.alterado_judicialmente, c.nota_original, c.modalidade_original, c.classificacao_original
      from listas li
      join public."TB_CANDIDATO_APROVADO" c on c.lista_id = li.id
     where c.removido_em is null
  ), d_cargo as (
    select x.v, (row_number() over (order by x.v) - 1)::integer as i
      from (select distinct cargo as v from cand where cargo is not null) x
  ), d_modalidade as (
    select x.v, (row_number() over (order by x.v) - 1)::integer as i
      from (select distinct modalidade as v from cand where modalidade is not null) x
  ), d_status as (
    select x.v, (row_number() over (order by x.v) - 1)::integer as i
      from (select distinct status as v from cand where status is not null) x
  ), d_codigo as (
    select x.v, (row_number() over (order by x.v) - 1)::integer as i
      from (select distinct codigo_vaga as v from cand where codigo_vaga is not null) x
  )
  select
    (select coalesce(json_agg(json_build_array(
              li.id, li.edital_id, li.edital, li.unidade, li.ativo, li.arquivo_nome, li.importado_em
            ) order by li.i), '[]'::json)
       from listas li),
    json_build_object(
      'cargo', (select coalesce(json_agg(d.v order by d.i), '[]'::json) from d_cargo d),
      'modalidade', (select coalesce(json_agg(d.v order by d.i), '[]'::json) from d_modalidade d),
      'status', (select coalesce(json_agg(d.v order by d.i), '[]'::json) from d_status d),
      'codigo_vaga', (select coalesce(json_agg(d.v order by d.i), '[]'::json) from d_codigo d)
    ),
    -- A ordem da função antiga; o id só desempata (antes o empate saía em qualquer ordem).
    (select coalesce(json_agg(
              case when c.alterado_judicialmente then json_build_array(
                c.id, c.lista, dc.i, c.classificacao, c.nota, c.nome, dm.i,
                ds.i, c.processo_sei, c.matricula, c.sub_judice, dv.i,
                true, c.nota_original, c.modalidade_original, c.classificacao_original
              ) else json_build_array(
                c.id, c.lista, dc.i, c.classificacao, c.nota, c.nome, dm.i,
                ds.i, c.processo_sei, c.matricula, c.sub_judice, dv.i
              ) end
            order by c.edital, c.cargo, c.classificacao nulls last, c.nome, c.id), '[]'::json)
       from cand c
       left join d_cargo dc on dc.v = c.cargo
       left join d_modalidade dm on dm.v = c.modalidade
       left join d_status ds on ds.v = c.status
       left join d_codigo dv on dv.v = c.codigo_vaga)
  into p_listas, p_dicionarios, p_linhas;

  p_total := json_array_length(p_linhas);
end;
$function$;

-- listar_candidatos_aprovados_compacto
CREATE OR REPLACE FUNCTION public.listar_candidatos_aprovados_compacto(p_area text DEFAULT NULL::text, p_versao text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET work_mem TO '64MB'
 SET jit TO 'off'
AS $function$
declare
  v_listas json;
  v_linhas json;
  v_area text;
  v_visiveis uuid[];
  v_versao text;
  v_cache private."TA_CANDIDATO_APROVADO_AREA";
  v_tem_cache boolean := false;
  v_sujo boolean;
  v_dicionarios json;
  v_total integer;
  v_gerado_em timestamptz := now();
begin
  if not (private.pode_recurso('aprovados',1)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if private.papel_recurso('aprovados') = '' then
    raise exception 'Perfil sem acesso ao sistema';
  end if;

  -- Sem área: a resposta de antes (formato 1), para o front publicado até o deploy.
  if p_area is null then
    -- Dados da lista vão uma vez por lista (≈110), não repetidos em cada candidato.
    select coalesce(json_object_agg(l.id, json_build_array(
             l.edital_id, m.edital, m.unidade, l.ativo, l.arquivo_nome, l.importado_em
           )), '{}'::json)
      into v_listas
    from public."TB_LISTA_APROVADO" l
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
    where l.vigente is true
      and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
      and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
        and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]));

    select coalesce(json_agg(
             case when c.alterado_judicialmente then json_build_array(
               c.id, l.id, c.cargo, c.classificacao, c.nota, c.nome, c.modalidade,
               c.status, c.processo_sei, c.matricula, c.sub_judice, c.codigo_vaga,
               true, c.nota_original, c.modalidade_original, c.classificacao_original
             ) else json_build_array(
               c.id, l.id, c.cargo, c.classificacao, c.nota, c.nome, c.modalidade,
               c.status, c.processo_sei, c.matricula, c.sub_judice, c.codigo_vaga
             ) end
           order by m.edital, c.cargo, c.classificacao nulls last, c.nome), '[]'::json)
      into v_linhas
    from public."TB_LISTA_APROVADO" l
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
    join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id
    where l.vigente is true
      and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
      and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
        and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
      and c.removido_em is null;

    return json_build_object(
      'colunas_da_lista', json_build_array(
        'edital_id', 'edital', 'unidade', 'lista_ativa', 'arquivo_nome', 'importado_em'
      ),
      'listas', v_listas,
      'colunas', json_build_array(
        'candidato_id', 'lista_id', 'cargo', 'classificacao', 'nota', 'nome',
        'modalidade', 'status', 'processo_sei', 'matricula', 'sub_judice',
        'codigo_vaga', 'alterado_judicialmente', 'nota_original',
        'modalidade_original', 'classificacao_original'
      ),
      'linhas', v_linhas,
      'total', json_array_length(v_linhas)
    );
  end if;

  -- Área válida e do usuário: 22023/42501 antes de qualquer leitura.
  v_area := lower(btrim(p_area));
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
    raise exception 'Área inválida: %', p_area using errcode = '22023';
  end if;
  if not (v_area = any ((select private."FC_AREAS_USUARIO"())::text[])) then
    raise exception 'Sem permissão para a lista de aprovados desta área' using errcode = '42501';
  end if;

  v_visiveis := private."FC_EDITAIS_VISIVEIS"();
  select * into v_cache from private."TA_CANDIDATO_APROVADO_AREA" c where c."CO_AREA" = v_area;
  v_tem_cache := found;
  v_sujo := private."FC_CACHE_DESATUALIZADO"('APROVADOS', v_area);

  -- Quem vê a área inteira e encontrou o pacote vencido (ou sem pacote) remonta e
  -- grava. Falhou a gravação (transação só de leitura, trava), monta na hora abaixo.
  if v_visiveis is null and (v_sujo or not v_tem_cache)
     and pg_try_advisory_xact_lock(hashtext('aprovados_area:' || v_area)::bigint) then
    perform public.atualizar_cache_aprovados(v_area);
    select * into v_cache from private."TA_CANDIDATO_APROVADO_AREA" c where c."CO_AREA" = v_area;
    v_tem_cache := found;
    v_sujo := private."FC_CACHE_DESATUALIZADO"('APROVADOS', v_area);
  end if;

  -- Versão: a do pacote; com mudança pendente, mais a contagem e a última marca
  -- (a cópia do navegador não vale); com recorte por coordenação, mais o recorte.
  v_versao := coalesce(v_cache."DS_VERSAO_DADOS", '0')
    || case when v_sujo then
         '+' || (select count(*)::text || '.' || max(t."CO_ALTERACAO_CACHE")::text
                   from private."TL_ALTERACAO_CACHE" t
                  where t."TP_CACHE" = 'APROVADOS' and t."CO_AREA" = v_area)
       else '' end
    || case when v_visiveis is null then ''
            else ':' || md5(array(select x from unnest(v_visiveis) x order by x)::text) end;

  if p_versao is not null and p_versao = v_versao then
    return json_build_object('formato', 2, 'area', v_area, 'versao', v_versao, 'inalterado', true);
  end if;

  if v_visiveis is null and v_tem_cache and not v_sujo then
    v_listas := v_cache."DS_LISTAS";
    v_dicionarios := v_cache."DS_DICIONARIOS";
    v_linhas := v_cache."DS_LINHAS";
    v_total := v_cache."QT_CANDIDATOS";
    v_gerado_em := v_cache."DT_GERACAO";
  else
    -- Com recorte, ou pacote ainda sem a mudança de agora: montada na hora.
    v_tem_cache := false;
    select m.p_listas, m.p_dicionarios, m.p_linhas, m.p_total
      into v_listas, v_dicionarios, v_linhas, v_total
      from private."FC_MONTAR_APROVADOS_AREA"(v_area, v_visiveis) m;
  end if;

  return json_build_object(
    'formato', 2,
    'area', v_area,
    'versao', v_versao,
    'inalterado', false,
    'cache', json_build_object('hit', v_tem_cache, 'gerado_em', v_gerado_em),
    'colunas_da_lista', json_build_array(
      'lista_id', 'edital_id', 'edital', 'unidade', 'lista_ativa', 'arquivo_nome', 'importado_em'
    ),
    'listas', v_listas,
    'colunas', json_build_array(
      'candidato_id', 'lista_id', 'cargo', 'classificacao', 'nota', 'nome',
      'modalidade', 'status', 'processo_sei', 'matricula', 'sub_judice',
      'codigo_vaga', 'alterado_judicialmente', 'nota_original',
      'modalidade_original', 'classificacao_original'
    ),
    'dicionarios', v_dicionarios,
    'linhas', v_linhas,
    'total', v_total
  );
end;
$function$;

-- conferencia_ler_analises
CREATE OR REPLACE FUNCTION public.conferencia_ler_analises(p_apos uuid DEFAULT NULL::uuid, p_limite integer DEFAULT 5000)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_limite integer := least(greatest(coalesce(p_limite, 5000), 1), 10000);
  v_linhas jsonb;
  v_ultimo uuid;
  v_qt integer;
begin
  with pagina as (
    select a.id, a."CO_AREA" as area, private."FC_NUMERO_EDITAL"(a.edital) as numero, a.id_origem,
           a.status_consolidado, a.nota_final_ajustada, a.pontuacao_escolaridade,
           a.pontuacao_cursos_aperfeicoamento, a.pontuacao_experiencia_profissional,
           a.pontuacao_criterio_etnico, a.data_analise, a.updated_at
      from public."TB_ANALISE_CURRICULAR" a
     where a.ativo and not private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)
       and (p_apos is null or a.id > p_apos)
     order by a.id
     limit v_limite
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'area', p.area, 'edital', e.edital_id, 'numero', p.numero,
           'codigo', nullif(btrim(p.id_origem), ''), 'status', p.status_consolidado,
           'nota', p.nota_final_ajustada, 'formacao', p.pontuacao_escolaridade,
           'cursos', p.pontuacao_cursos_aperfeicoamento, 'experiencia', p.pontuacao_experiencia_profissional,
           'etnico', p.pontuacao_criterio_etnico, 'data_analise', p.data_analise,
           'inscricao', (select (min(c."DT_CANDIDATURA") at time zone 'America/Sao_Paulo')::date
                           from public."TB_EMPREGARE_CANDIDATO" c
                          where c."CO_CANDIDATO_EMPREGARE" = nullif(btrim(p.id_origem), '')),
           'atualizado', p.updated_at) order by p.id), '[]'::jsonb),
         max(p.id::text)::uuid, count(*)
    into v_linhas, v_ultimo, v_qt
    from pagina p
    left join private."FC_EDITAIS_POR_NUMERO"() e on e.area = p.area and e.numero = p.numero;

  return jsonb_build_object(
    'schema_version', 1,
    'linhas', v_linhas,
    'proximo', case when v_qt = v_limite then v_ultimo end);
end;
$function$;

-- conferencia_ler_entrevistas
CREATE OR REPLACE FUNCTION public.conferencia_ler_entrevistas()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with entrevistas as (
    select e."CO_ENTREVISTA", e."CO_MONITORAMENTO", e."CO_AREA", e."CO_ANALISE_CURRICULAR",
           e."TP_ORIGEM", e."VL_NOTA_TOTAL", e."ST_COMPARECEU", e."TP_PARECER", e."DT_ATUALIZACAO"
      from public."TB_ENTREVISTA" e
     where coalesce(e."ST_ATIVO", 'S') = 'S'
       and not private."FC_EDITAL_EH_TREINAMENTO"(e."CO_MONITORAMENTO")
  ),
  editais_do_sistema as (
    select distinct e."CO_MONITORAMENTO" as edital
      from entrevistas e
     where e."TP_ORIGEM" = 'sistema' and e."CO_MONITORAMENTO" is not null
  )
  select jsonb_build_object(
    'schema_version', 1,
    'entrevistas', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', e."CO_ENTREVISTA", 'edital', e."CO_MONITORAMENTO", 'area', e."CO_AREA",
          'analise', e."CO_ANALISE_CURRICULAR", 'origem', e."TP_ORIGEM", 'nota', e."VL_NOTA_TOTAL",
          'compareceu', e."ST_COMPARECEU", 'parecer', e."TP_PARECER")), '[]'::jsonb)
        from entrevistas e
    ),
    'agenda', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', g."CO_AGENDA_ENTREVISTA", 'edital', g."CO_MONITORAMENTO", 'area', m."CO_AREA",
          'analise', g."CO_ANALISE_CURRICULAR", 'codigo', nullif(btrim(a.id_origem), ''),
          'data', g."DT_ENTREVISTA", 'inicio', g."HR_INICIO", 'fim', g."HR_FIM")), '[]'::jsonb)
        from public."TB_AGENDA_ENTREVISTA" g
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = g."CO_MONITORAMENTO"
        left join public."TB_ANALISE_CURRICULAR" a on a.id = g."CO_ANALISE_CURRICULAR"
       where not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
    ),
    'avaliacoes', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'entrevista', v."CO_ENTREVISTA", 'competencia', v."CO_COMPETENCIA", 'nota', v."VL_NOTA")), '[]'::jsonb)
        from public."TB_ENTREVISTA_AVALIACAO" v
        join entrevistas e on e."CO_ENTREVISTA" = v."CO_ENTREVISTA"
    ),
    'competencias', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', c."CO_COMPETENCIA", 'roteiro', c."CO_ROTEIRO", 'maxima', c."VL_NOTA_MAXIMA")), '[]'::jsonb)
        from public."TB_ROTEIRO_COMPETENCIA" c
    ),
    'roteiros', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', r."CO_ROTEIRO", 'escala', r."TP_ESCALA", 'passo', r."VL_PASSO",
          'permitidas', r."DS_NOTAS_PERMITIDAS",
          'niveis', (select coalesce(jsonb_agg(n."VL_NOTA" order by n."VL_NOTA"), '[]'::jsonb)
                       from public."TB_ROTEIRO_NIVEL" n where n."CO_ROTEIRO" = r."CO_ROTEIRO"))), '[]'::jsonb)
        from public."TB_ROTEIRO_ENTREVISTA" r
    ),
    'convocacao', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'edital', x.edital, 'lista', x.lista,
          'analises', (select coalesce(jsonb_agg(c), '[]'::jsonb)
                         from private."FC_CONVOCADOS_DA_LISTA"(x.lista) c))), '[]'::jsonb)
        from (select s.edital, private."FC_LISTA_CONVOCACAO_VIGENTE"(s.edital) as lista
                from editais_do_sistema s) x
    )
  );
$function$;

-- conferencia_ler_classificacao
CREATE OR REPLACE FUNCTION public.conferencia_ler_classificacao()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with ultimas as (
    select distinct on (l."CO_MONITORAMENTO", l."TP_LISTA")
           l."CO_LISTA_CLASSIFICACAO", l."CO_MONITORAMENTO", l."TP_LISTA", l."DT_GERACAO",
           l."QT_PENDENCIA", l."ST_PUBLICADA", l."DS_RESULTADO"
      from public."TB_LISTA_CLASSIFICACAO" l
     where not private."FC_EDITAL_EH_TREINAMENTO"(l."CO_MONITORAMENTO")
     order by l."CO_MONITORAMENTO", l."TP_LISTA", l."DT_GERACAO" desc, l."CO_LISTA_CLASSIFICACAO" desc
  ),
  analises as (
    select e.edital_id, max(a.updated_at) as alterada_em
      from public."TB_ANALISE_CURRICULAR" a
      join private."FC_EDITAIS_POR_NUMERO"() e
        on e.area = a."CO_AREA" and e.numero = private."FC_NUMERO_EDITAL"(a.edital)
     where a.ativo and not private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)
     group by e.edital_id
  ),
  vagas as (
    select distinct e.edital_id, m."CO_AREA" as area, nullif(btrim(a.codigo_vaga), '') as codigo, a.nome_vaga
      from public."TB_ANALISE_CURRICULAR" a
      join private."FC_EDITAIS_POR_NUMERO"() e
        on e.area = a."CO_AREA" and e.numero = private."FC_NUMERO_EDITAL"(a.edital)
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = e.edital_id
     where a.ativo and not private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)
       and coalesce(m.ativo, false) and nullif(btrim(a.nome_vaga), '') is not null
  )
  select jsonb_build_object(
    'schema_version', 1,
    'listas', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', u."CO_LISTA_CLASSIFICACAO", 'edital', u."CO_MONITORAMENTO", 'area', m."CO_AREA",
          'tipo', u."TP_LISTA", 'gerada_em', u."DT_GERACAO", 'pendencias', u."QT_PENDENCIA",
          'publicada', u."ST_PUBLICADA" = 'S',
          'vagas_pendentes', (select coalesce(jsonb_agg(distinct p ->> 'vaga'), '[]'::jsonb)
                                from jsonb_array_elements(case when jsonb_typeof(u."DS_RESULTADO" -> 'pendencias') = 'array'
                                                               then u."DS_RESULTADO" -> 'pendencias' else '[]'::jsonb end) p
                               where p ->> 'vaga' is not null))), '[]'::jsonb)
        from ultimas u
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = u."CO_MONITORAMENTO"
    ),
    'analises_alteradas', (
      select coalesce(jsonb_agg(jsonb_build_object('edital', a.edital_id, 'alterada_em', a.alterada_em)), '[]'::jsonb)
        from analises a
    ),
    'vagas_sem_quadro', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'edital', v.edital_id, 'area', v.area, 'vaga', coalesce(v.codigo, 'sem-codigo'))), '[]'::jsonb)
        from vagas v
       where private."FC_QUADRO_DA_VAGA"(v.edital_id, v.nome_vaga) is null
    ),
    'ajustes', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', j."CO_AJUSTE_PONTUACAO", 'edital', j."CO_MONITORAMENTO", 'area', m."CO_AREA",
          'tipo', j."TP_LISTA", 'aprovado_em', j."DT_APROVACAO")), '[]'::jsonb)
        from public."TB_AJUSTE_PONTUACAO_RECURSO" j
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = j."CO_MONITORAMENTO"
       where j."TP_SITUACAO" = 'APROVADO'
         and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
    )
  );
$function$;

-- conferencia_ler_aprovados
CREATE OR REPLACE FUNCTION public.conferencia_ler_aprovados()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with vigentes as (
    select l.id, l.edital_id, l."TP_ORIGEM",
           case when l.edital_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then l.edital_id::uuid end as edital
      from public."TB_LISTA_APROVADO" l
     where l.vigente is true and coalesce(l.ativo, true)
       and not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" t
                        where t.id::text = l.edital_id and private."FC_EH_TREINAMENTO"(t."ST_TREINAMENTO"))
  ),
  candidatos as (
    select c.id, c.lista_id, v.edital, m."CO_AREA" as area, c.status, c."DT_CONVOCACAO",
           encode(sha256(convert_to('conferencia:' || coalesce(
             'cod:' || nullif(btrim(a.id_origem), ''),
             'nome:' || lower(regexp_replace(btrim(c.nome), '\s+', ' ', 'g'))), 'UTF8')), 'hex') as pessoa
      from public."TB_CANDIDATO_APROVADO" c
      join vigentes v on v.id = c.lista_id
      left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = v.edital
      left join public."TB_ANALISE_CURRICULAR" a on a.id = c."CO_ANALISE_CURRICULAR"
     where c.removido_em is null and c.status in ('Convocado', 'Contratado')
  ),
  publicacoes as (
    select distinct on (h."CO_LISTA_APROVADO") h."CO_LISTA_APROVADO", h."DS_PENDENCIA"
      from public."TH_PUBLICACAO_APROVADO" h
      join vigentes v on v.id = h."CO_LISTA_APROVADO"
     where v."TP_ORIGEM" = 'CLASSIFICACAO'
     order by h."CO_LISTA_APROVADO", h."DT_PUBLICACAO" desc
  )
  select jsonb_build_object(
    'schema_version', 1,
    'candidatos', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', c.id, 'lista', c.lista_id, 'edital', c.edital, 'area', c.area, 'status', c.status,
          'convocado_em', c."DT_CONVOCACAO", 'pessoa', c.pessoa)), '[]'::jsonb)
        from candidatos c
    ),
    'pendencias', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'lista', p."CO_LISTA_APROVADO", 'edital', v.edital, 'area', m."CO_AREA",
          'candidatos', (
            select coalesce(jsonb_agg(o.id order by o.id), '[]'::jsonb)
              from jsonb_array_elements(p."DS_PENDENCIA") x
              join public."TB_CANDIDATO_APROVADO" o
                on o.id::text = x ->> 'candidato_id'
             where o.removido_em is null
               and (o.status is not null or nullif(btrim(coalesce(o.matricula, '')), '') is not null
                    or nullif(btrim(coalesce(o.processo_sei, '')), '') is not null)
               and not exists (select 1 from public."TB_CANDIDATO_APROVADO" n
                                where n.lista_id = p."CO_LISTA_APROVADO" and n.removido_em is null
                                  and n."CO_CANDIDATO_ANTERIOR" = o.id)))), '[]'::jsonb)
        from publicacoes p
        join vigentes v on v.id = p."CO_LISTA_APROVADO"
        left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = v.edital
    )
  );
$function$;

-- listar_vagas_empregare
CREATE OR REPLACE FUNCTION public.listar_vagas_empregare(p_editais text[] DEFAULT NULL::text[], p_vagas text[] DEFAULT NULL::text[], p_limite integer DEFAULT 60)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_limite integer := least(greatest(coalesce(p_limite, 60), 1), 500);
  v_vagas text[] := coalesce(p_vagas, '{}');
  v_editais text[];
  v_modo text;
begin
  if exists (select 1 from unnest(v_vagas) v where v !~ '^[0-9]{1,20}$') then
    raise exception 'Código de vaga inválido: use só dígitos' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct private."FC_NUMERO_EDITAL"(e)), '{}') into v_editais
    from unnest(coalesce(p_editais, '{}')) e;
  if exists (select 1 from unnest(v_editais) e where e is null) then
    raise exception 'Edital inválido: use o número, como 80/2026' using errcode = '22023';
  end if;
  v_modo := case when cardinality(v_vagas) > 0 then 'VAGAS'
                 when cardinality(v_editais) > 0 then 'EDITAIS'
                 else 'PADRAO' end;

  return (
    with quadro as (
      select q.vaga, m.id as edital_id, m.edital, m.unidade, q.cargo, m."CO_AREA" as area,
             m.ativo as edital_ativo, 'quadro'::text as origem
        from private."FC_EMPREGARE_VAGAS_DO_QUADRO"() q
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = q.edital_id
    ),
    selecao as (
      select distinct on (s."CO_VAGA")
             s."CO_VAGA" as vaga, s."CO_MONITORAMENTO" as edital_id, s."DS_EDITAL" as edital,
             s."NO_UNIDADE" as unidade, s."NO_CARGO" as cargo, s."CO_AREA" as area,
             m.ativo as edital_ativo, 'selecao'::text as origem
        from public."TB_SELECAO_VAGA" s
        left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = s."CO_MONITORAMENTO"
       where s."ST_REGISTRO_ATIVO" = 'S' and s."CO_VAGA" is not null
       order by s."CO_VAGA", (s."CO_MONITORAMENTO" is null), s."DT_ATUALIZACAO" desc
    ),
    -- Mesmo código nas duas fontes: fica a linha do quadro.
    fontes as (
      select f.*,
             (select max(coalesce(c.data_fim, c.data_inicio)::date)
                from public."TB_CRONOGRAMA_MONIT_INDIG" c
               where c.monitoramento_id = f.edital_id) as fim_do_cronograma
        from (select * from quadro
              union all
              select s.* from selecao s where not exists (select 1 from quadro q where q.vaga = s.vaga)) f
    ),
    escolhidas as (
      select s.vaga, s.edital_id, s.edital, s.unidade, s.cargo, s.area, s.origem
        from fontes s
       where (v_modo = 'VAGAS' and s.vaga = any (v_vagas))
          or (v_modo = 'EDITAIS' and private."FC_NUMERO_EDITAL"(s.edital) = any (v_editais))
          or (v_modo = 'PADRAO' and s.edital_ativo is true
              and not private."FC_EDITAL_EH_TREINAMENTO"(s.edital_id)
              and (s.fim_do_cronograma is null or s.fim_do_cronograma >= current_date - 30))
      union all
      -- Código pedido que não está no quadro nem na Seleção: vai mesmo assim, sem edital.
      select v, null::uuid, null, null, null, null, 'pedida'
        from unnest(v_vagas) v
       where v_modo = 'VAGAS' and not exists (select 1 from fontes s where s.vaga = v)
    ),
    ordenadas as (
      select e.*, ev."DT_ULTIMA_CARGA" as ultima_carga
        from escolhidas e
        left join public."TB_EMPREGARE_VAGA" ev on ev."CO_VAGA" = e.vaga
       order by ev."DT_ULTIMA_CARGA" nulls first, e.edital nulls last, e.vaga
       limit v_limite
    )
    select jsonb_build_object(
      'modo', v_modo,
      'limite', v_limite,
      'vagas', coalesce(jsonb_agg(jsonb_build_object(
          'vaga', o.vaga, 'edital_id', o.edital_id, 'edital', o.edital, 'unidade', o.unidade,
          'cargo', o.cargo, 'area', o.area, 'ultima_carga', o.ultima_carga, 'origem', o.origem
        ) order by o.ultima_carga nulls first, o.edital nulls last, o.vaga), '[]'::jsonb)
    )
      from ordenadas o
  );
end;
$function$;

-- pre_classificacao_ler_editais
CREATE OR REPLACE FUNCTION public.pre_classificacao_ler_editais(p_editais text[] DEFAULT NULL::text[], p_apos_robo boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_pedidos text[] := array(select btrim(x) from unnest(coalesce(p_editais, '{}')) x where btrim(x) <> '');
  v_ids uuid[];
  v_sync text;
begin
  if cardinality(v_pedidos) > 100 then
    raise exception 'Até 100 editais por execução' using errcode = '22023';
  end if;
  if cardinality(v_pedidos) > 0 then
    -- Cada pedido é o id do edital, o número ("93/2026") ou, sem número, o nome ("FCC").
    select coalesce(array_agg(distinct m.id), '{}') into v_ids
      from public."TB_MONITORAMENTO_INDIGENA" m
      join unnest(v_pedidos) p(texto)
        on m.id::text = lower(p.texto)
        or private."FC_NUMERO_EDITAL"(m.edital) = p.texto
        or lower(btrim(m.edital)) = lower(p.texto);
  elsif p_apos_robo then
    -- Os editais das vagas gravadas na última execução fechada do robô.
    select s."CO_SYNC" into v_sync
      from public."TL_SYNC_EMPREGARE" s
     where s."TP_SITUACAO" in ('CONCLUIDA', 'PARCIAL')
     order by s."DT_INICIO" desc limit 1;
    select coalesce(array_agg(distinct v."CO_MONITORAMENTO"), '{}') into v_ids
      from public."TB_EMPREGARE_VAGA" v
     where v."CO_SYNC" = v_sync and v."CO_MONITORAMENTO" is not null
       and not private."FC_EDITAL_EH_TREINAMENTO"(v."CO_MONITORAMENTO");
  else
    select coalesce(array_agg(distinct v."CO_MONITORAMENTO"), '{}') into v_ids
      from public."TB_EMPREGARE_VAGA" v
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = v."CO_MONITORAMENTO"
     where coalesce(m.ativo, false) and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO");
  end if;

  return jsonb_build_object(
    'hoje', (now() at time zone 'America/Sao_Paulo')::date,
    'sync', v_sync,
    'nao_encontrados', coalesce((
      select jsonb_agg(p.texto order by p.texto)
        from unnest(v_pedidos) p(texto)
       where not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m
                          where m.id::text = lower(p.texto)
                             or private."FC_NUMERO_EDITAL"(m.edital) = p.texto
                             or lower(btrim(m.edital)) = lower(p.texto))), '[]'::jsonb),
    'editais', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id,
               'rotulo', private."FC_ROTULO_DO_EDITAL"(m.edital),
               'area', m."CO_AREA",
               'ativo', coalesce(m.ativo, false),
               'treinamento', private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO"),
               'regra', (select jsonb_build_object('versao', r."NU_VERSAO_VIGENTE", 'situacao', r."TP_SITUACAO",
                                                   'configuracao', h."DS_CONFIGURACAO")
                           from public."TB_REGRA_ANALISE" r
                           join public."TH_REGRA_ANALISE" h
                             on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
                          where r."CO_MONITORAMENTO" = m.id),
               'documental', private."FC_DOCUMENTAL_DO_EDITAL"(m.id),
               -- O cronograma: o job congela a declarada depois do fim das inscrições.
               'cronograma', coalesce((
                 select jsonb_agg(jsonb_build_object('atividade', c.atividade, 'inicio', c.data_inicio, 'fim', c.data_fim)
                        order by c.ordem)
                   from public."TB_CRONOGRAMA_MONIT_INDIG" c where c.monitoramento_id = m.id), '[]'::jsonb),
               'refazer_permitido', not exists (select 1 from public."TB_PRE_CLASSIFICACAO" a
                                                 where a."CO_MONITORAMENTO" = m.id and a."TP_SITUACAO" = 'ANALISADO'),
               'vagas', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'codigo', v."CO_VAGA",
                          'cargo', q."NO_CARGO",
                          'situacao_carga', v."TP_SITUACAO",
                          'candidatos_ativos', v."QT_CANDIDATO_ATIVO",
                          'ultima_carga', v."DT_ULTIMA_CARGA",
                          'ultimo_lote', coalesce(pv."NU_ULTIMO_LOTE", 0),
                          'quadro', case when q."CO_QUADRO_VAGA" is null then null else jsonb_build_object(
                            'id', q."CO_QUADRO_VAGA", 'vagas_imediatas', q."QT_VAGA_IMEDIATA",
                            'cadastro_reserva', q."ST_CADASTRO_RESERVA" = 'S', 'modalidades', q."DS_MODALIDADE_VAGA") end)
                        order by v."CO_VAGA")
                   from public."TB_EMPREGARE_VAGA" v
                   left join public."TB_PRE_CLASSIF_VAGA" pv on pv."CO_MONITORAMENTO" = m.id and pv."CO_VAGA" = v."CO_VAGA"
                   left join lateral (select * from private."FC_QUADRO_DA_VAGA_EMPREGARE"(m.id, v."CO_VAGA")) q on true
                  where v."CO_MONITORAMENTO" = m.id), '[]'::jsonb))
             order by private."FC_ROTULO_DO_EDITAL"(m.edital), m.id)
        from public."TB_MONITORAMENTO_INDIGENA" m
       where m.id = any (v_ids)), '[]'::jsonb)
  );
end;
$function$;

-- get_painel_dos_robos
CREATE OR REPLACE FUNCTION public.get_painel_dos_robos()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_master() then
    raise exception 'Somente o administrador global vê o painel dos robôs' using errcode = '42501';
  end if;

  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'areas', (
      select coalesce(json_agg(json_build_object('area', a."CO_AREA", 'nome', a."NO_AREA")
               order by a."NU_ORDEM"), '[]'::json)
        from public."TB_AREA" a
    ),
    'editais', (
      select coalesce(json_agg(json_build_object(
               'id', m.id, 'edital', m.edital, 'numero', private."FC_NUMERO_EDITAL"(m.edital),
               'area', m."CO_AREA", 'unidade', m.unidade, 'ativo', m.ativo, 'status', m.status,
               'treinamento', private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO"))
             order by m."CO_AREA", private."FC_NUMERO_EDITAL"(m.edital) desc nulls last), '[]'::json)
        from public."TB_MONITORAMENTO_INDIGENA" m
       where private."FC_NUMERO_EDITAL"(m.edital) is not null
    ),
    'empregare', (
      select coalesce(json_agg(json_build_object(
               'id', e."CO_SYNC",
               'inicio', e."DT_INICIO", 'fim', e."DT_FIM", 'situacao', e."TP_SITUACAO",
               'disparo', e."TP_DISPARO",
               'quem', case when e."CO_USUARIO_DISPARO" is null then null
                            else coalesce(nullif(btrim(p.nome), ''), 'Usuário do MONITORA') end,
               'filtro', e."DS_FILTRO", 'forcada', e."ST_FORCADA" = 'S',
               'vagas_pedidas', e."QT_VAGA_PEDIDA", 'vagas_baixadas', e."QT_VAGA_BAIXADA",
               'vagas_falha', e."QT_VAGA_FALHA", 'vagas_recusadas', e."QT_VAGA_RECUSADA",
               'linhas', e."QT_LINHA", 'desativadas', e."QT_DESATIVADA",
               'mensagem', e."DS_MENSAGEM", 'execucao', e."DS_URL_EXECUCAO",
               'por_vaga', (
                 select coalesce(json_agg(json_build_object(
                          'vaga', v."CO_VAGA", 'situacao', v."TP_SITUACAO",
                          'arquivo', v."QT_LINHA_ARQUIVO", 'ativos', v."QT_CANDIDATO_ATIVO",
                          'com_link', (select count(*) from public."TB_EMPREGARE_CANDIDATO" c
                                        where c."CO_VAGA" = v."CO_VAGA" and c."ST_REGISTRO_ATIVO" = 'S'
                                          and c."DS_LINK_DETALHE" is not null),
                          'mensagem', left(v."DS_MENSAGEM", 300))
                        order by v."CO_VAGA"), '[]'::json)
                   from public."TB_EMPREGARE_VAGA" v
                  where v."CO_SYNC" = e."CO_SYNC"
               )
             ) order by e."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_SYNC_EMPREGARE" t order by t."DT_INICIO" desc limit 8) e
        left join public."TB_PERFIL_USUARIO" p on p.user_id = e."CO_USUARIO_DISPARO"
    ),
    'pre_classificacao', (
      select coalesce(json_agg(json_build_object(
               'id', x."CO_EXECUCAO",
               'inicio', x."DT_INICIO", 'fim', x."DT_FIM", 'situacao', x."TP_SITUACAO",
               'disparo', x."TP_DISPARO",
               'quem', case when x."CO_USUARIO_DISPARO" is null then null
                            else coalesce(nullif(btrim(p.nome), ''), 'Usuário do MONITORA') end,
               'pedido', x."DS_PEDIDO", 'refazer', x."ST_REFAZER_LOTE" = 'S',
               'editais', x."QT_EDITAL", 'vagas', x."QT_VAGA", 'inscritos', x."QT_INSCRITO",
               'lote', x."QT_LOTE", 'mensagem', x."DS_MENSAGEM", 'execucao', x."DS_URL_EXECUCAO"
             ) order by x."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_PRE_CLASSIFICACAO" t order by t."DT_INICIO" desc limit 8) x
        left join public."TB_PERFIL_USUARIO" p on p.user_id = x."CO_USUARIO_DISPARO"
    )
  );
end;
$function$;

-- finalizar_sync_analises_lotes
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
  update public."TB_ANALISE_CURRICULAR" a
  set ativo=false,updated_at=now()
  where a.ativo is true
    and a."CO_PLANILHA"=v_planilha
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
    update public."TB_EDITAL_ANALISE" e
    set ativo=false,updated_at=now()
    where e.ativo is true
      and e."CO_PLANILHA"=v_planilha
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

-- listar_editais_entrevista
CREATE OR REPLACE FUNCTION public.listar_editais_entrevista(p_area text, p_todos boolean DEFAULT false)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_editais uuid[];
  v_admin boolean := private.is_master();
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if not private.pode_recurso('entrevistas', 1) then
    raise exception 'Sem permissão para Entrevistas' using errcode = '42501';
  end if;
  if not private."FC_PODE_AREA"(p_area) then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  v_editais := (select private."FC_EDITAIS_VISIVEIS"())::uuid[];
  return json_build_object(
    'admin_global', v_admin,
    'hoje', v_hoje,
    'editais', coalesce((
      select json_agg(json_build_object(
          'id', x.id, 'edital', x.edital, 'unidade', x.unidade, 'treinamento', x.treinamento,
          'configurado', x.configurado, 'convocados', x.convocados, 'pendentes', x.pendentes,
          'janela_inicio', x.inicio, 'janela_fim', x.fim, 'na_janela', x.na_janela,
          'liberado_ate', x.liberado_ate, 'motivo_liberacao', x.motivo,
          'visivel_por', case when x.na_janela then 'janela' when x.liberado_ate is not null then 'liberado'
                              when x.pendentes > 0 then 'convocados' else 'admin' end)
          order by x.edital)
        from (
          select m.id, m.edital, m.unidade, private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO") as treinamento, j.inicio, j.fim,
                 coalesce(v_hoje between j.inicio and j.fim, false) na_janela,
                 exists (select 1 from public."TB_ENTREVISTA_EDITAL" c where c."CO_MONITORAMENTO" = m.id) configurado,
                 (select count(*) from public."TB_ENTREVISTA" e
                   where e."CO_MONITORAMENTO" = m.id and e."TP_ORIGEM" = 'sistema' and e."ST_ATIVO" = 'S') convocados,
                 (select count(*) from public."TB_ENTREVISTA" e
                   where e."CO_MONITORAMENTO" = m.id and e."TP_ORIGEM" = 'sistema' and e."ST_ATIVO" = 'S'
                     and e."TP_PARECER" = 'SEM_PARECER') pendentes,
                 l."DT_LIBERADO_ATE" liberado_ate, l."DS_MOTIVO" motivo
            from public."TB_MONITORAMENTO_INDIGENA" m
            cross join lateral private."FC_JANELA_ENTREVISTA"(m.id) j
            left join public."TB_ENTREVISTA_LIBERACAO" l
              on l."CO_MONITORAMENTO" = m.id and l."ST_REGISTRO_ATIVO" = 'S' and l."DT_LIBERADO_ATE" >= v_hoje
           where m."CO_AREA" = p_area and m.ativo
             and (v_editais is null or m.id = any (v_editais))
        ) x
       where (p_todos and v_admin) or x.na_janela or x.liberado_ate is not null or x.pendentes > 0), '[]'::json)
  );
end;
$function$;

-- listar_editais_avaliacao
CREATE OR REPLACE FUNCTION public.listar_editais_avaliacao(p_area text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_editais uuid[];
begin
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if not private.pode_recurso('avaliacao_documental', 1) then
    raise exception 'Sem permissão para a Avaliação documental' using errcode = '42501';
  end if;
  if not private."FC_PODE_AREA"(p_area) then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  v_editais := (select private."FC_EDITAIS_VISIVEIS"())::uuid[];

  return json_build_object(
    'area', p_area,
    'nivel', private.nivel_recurso('avaliacao_documental'),
    'editais', coalesce((
      select json_agg(json_build_object(
               'id', m.id, 'edital', m.edital, 'unidade', m.unidade, 'ativo', m.ativo, 'status', m.status,
               'treinamento', private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO"),
               'numero', private."FC_NUMERO_EDITAL"(m.edital),
               'versao_regra', r."NU_VERSAO_VIGENTE", 'situacao_regra', r."TP_SITUACAO",
               'origem', coalesce(o."TP_ORIGEM", 'PLANILHA'),
               'papel', private."FC_PAPEL_AVALIACAO"(m.id))
             order by m.ativo desc, r."NU_VERSAO_VIGENTE" is null, m.edital)
        from public."TB_MONITORAMENTO_INDIGENA" m
        left join public."TB_REGRA_ANALISE" r on r."CO_MONITORAMENTO" = m.id
        left join public."TB_ORIGEM_ANALISE_EDITAL" o on o."CO_MONITORAMENTO" = m.id
       where m."CO_AREA" = p_area and (v_editais is null or m.id = any (v_editais))), '[]'::json)
  );
end;
$function$;

-- listar_editais_classificacao
CREATE OR REPLACE FUNCTION public.listar_editais_classificacao(p_area text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_editais uuid[];
begin
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if not private.pode_recurso('classificacao', 1) then
    raise exception 'Sem permissão para Classificação' using errcode = '42501';
  end if;
  if not private."FC_PODE_AREA"(p_area) then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  v_editais := (select private."FC_EDITAIS_VISIVEIS"())::uuid[];

  return json_build_object(
    'area', p_area,
    'pode_editar', private.pode_recurso('classificacao', 2),
    'editais', (
      with m as (
        select m.id, m.edital, m.unidade, m.ativo, private."FC_NUMERO_EDITAL"(m.edital) as numero,
               private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO") as treinamento
          from public."TB_MONITORAMENTO_INDIGENA" m
         where m."CO_AREA" = p_area and (v_editais is null or m.id = any (v_editais))
      ),
      an as (
        select private."FC_NUMERO_EDITAL"(a.edital) as numero, count(*)::integer as qt
          from public."TB_ANALISE_CURRICULAR" a
         where a."CO_AREA" = p_area and a.ativo
         group by 1
      )
      select coalesce(json_agg(json_build_object(
               'id', m.id, 'edital', m.edital, 'unidade', m.unidade, 'ativo', m.ativo,
               'treinamento', m.treinamento,
               'candidatos', coalesce(an.qt, 0),
               'versao_regra', r."NU_VERSAO_VIGENTE",
               'ultima_lista', (
                 select json_build_object('tipo', l."TP_LISTA", 'em', l."DT_GERACAO", 'publicada', l."ST_PUBLICADA" = 'S')
                   from public."TB_LISTA_CLASSIFICACAO" l
                  where l."CO_MONITORAMENTO" = m.id
                  order by l."DT_GERACAO" desc limit 1))
             order by m.ativo desc, coalesce(an.qt, 0) = 0, m.edital), '[]'::json)
        from m
        left join an on an.numero = m.numero
        left join public."TB_REGRA_CLASSIFICACAO" r on r."CO_MONITORAMENTO" = m.id
    )
  );
end;
$function$;

-- obter_entrevistas_do_edital
CREATE OR REPLACE FUNCTION public.obter_entrevistas_do_edital(p_edital uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text := private."FC_EXIGIR_ENTREVISTAS_EDITAL"(p_edital, 1);
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_cfg public."TB_ENTREVISTA_EDITAL";
  v_eu uuid;
  v_lista uuid := private."FC_LISTA_CONVOCACAO_VIGENTE"(p_edital);
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  select * into v_cfg from public."TB_ENTREVISTA_EDITAL" where "CO_MONITORAMENTO" = p_edital;
  select p.id into v_eu from private.current_profile() p;
  return json_build_object(
    'edital', json_build_object('id', v_m.id, 'edital', v_m.edital, 'unidade', v_m.unidade, 'area', v_area,
                               'treinamento', private."FC_EH_TREINAMENTO"(v_m."ST_TREINAMENTO")),
    'pode_editar', private.pode_recurso('entrevistas', 2),
    'pode_gerar_lista', private.pode_recurso('classificacao', 2),
    'admin_global', private.is_master(),
    'meu_perfil', v_eu,
    'configuracao', case when v_cfg."CO_MONITORAMENTO" is null then null else json_build_object(
        'roteiro', private."FC_ROTEIRO_JSON"(v_cfg."CO_ROTEIRO"), 'banca', v_cfg."DS_BANCA",
        'lancamento', v_cfg."TP_LANCAMENTO", 'atualizado_em', v_cfg."DT_ATUALIZACAO") end,
    'regra_classificacao', (
      select json_build_object('versao', r."NU_VERSAO_VIGENTE", 'convocacao', h."DS_CONFIGURACAO" -> 'convocacao')
        from public."TB_REGRA_CLASSIFICACAO" r
        join public."TH_REGRA_CLASSIFICACAO" h
          on h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
       where r."CO_MONITORAMENTO" = p_edital),
    'lista_convocacao', case when v_lista is null then null else json_build_object(
        'lista', private."FC_LISTA_CLASSIFICACAO_JSON"(v_lista),
        'retrato', (select l."DS_RESULTADO" from public."TB_LISTA_CLASSIFICACAO" l
                     where l."CO_LISTA_CLASSIFICACAO" = v_lista)) end,
    'avaliadores', coalesce((
      select json_agg(json_build_object('id', b."CO_AVALIADOR", 'nome', b."NO_AVALIADOR", 'origem', b."NO_ORIGEM",
               'banca', b."NU_BANCA", 'perfil', b."CO_PERFIL_USUARIO", 'ativo', b."ST_ATIVO" = 'S') order by b."NU_BANCA", b."NO_ORIGEM", b."NO_AVALIADOR")
        from public."TB_ENTREVISTA_AVALIADOR" b where b."CO_MONITORAMENTO" = p_edital), '[]'::json),
    'convocados', coalesce((
      select json_agg(json_build_object('id', e."CO_ENTREVISTA", 'analise_id', e."CO_ANALISE_CURRICULAR",
               'candidato', e."NO_CANDIDATO", 'codigo', e."CO_CANDIDATO", 'vaga', e."CO_VAGA", 'cargo', e."NO_CARGO",
               'modalidade', e."DS_MODALIDADE", 'banca', e."NU_BANCA", 'compareceu', e."ST_COMPARECEU",
               'nota', e."VL_NOTA_TOTAL", 'parecer', e."TP_PARECER", 'nota_analise', a.nota_final_ajustada,
               'avaliacoes', coalesce((select json_agg(json_build_object('competencia', x."CO_COMPETENCIA",
                      'avaliador', x."CO_AVALIADOR", 'nota', x."VL_NOTA"))
                   from public."TB_ENTREVISTA_AVALIACAO" x where x."CO_ENTREVISTA" = e."CO_ENTREVISTA"), '[]'::json),
               'notas', coalesce((select json_agg(json_build_array(n."NU_ORDEM", n."VL_NOTA") order by n."NU_ORDEM")
                   from public."TB_ENTREVISTA_NOTA" n where n."CO_ENTREVISTA" = e."CO_ENTREVISTA"), '[]'::json))
             order by e."CO_VAGA", e."NO_CANDIDATO")
        from public."TB_ENTREVISTA" e
        left join public."TB_ANALISE_CURRICULAR" a on a.id = e."CO_ANALISE_CURRICULAR"
       where e."CO_MONITORAMENTO" = p_edital and e."TP_ORIGEM" = 'sistema' and e."ST_ATIVO" = 'S'), '[]'::json)
  );
end;
$function$;

-- FC_DADOS_CLASSIFICACAO_EDITAL
CREATE OR REPLACE FUNCTION private."FC_DADOS_CLASSIFICACAO_EDITAL"(p_edital uuid, p_area text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text := p_area;
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_numero text;
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  v_numero := private."FC_NUMERO_EDITAL"(v_m.edital);
  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'edital', json_build_object('id', v_m.id, 'edital', v_m.edital, 'unidade', v_m.unidade, 'area', v_area, 'numero', v_numero,
                               'treinamento', private."FC_EH_TREINAMENTO"(v_m."ST_TREINAMENTO")),
    'pode_editar', private.pode_recurso('classificacao', 2),
    'regra', private."FC_REGRA_CLASSIFICACAO_JSON"(p_edital),
    'catalogo', (
      select json_agg(json_build_object('codigo', k."CO_CRITERIO", 'nome', k."NO_CRITERIO", 'tipo', k."TP_VALOR",
               'direcao', k."TP_DIRECAO_PADRAO", 'ativo', k."ST_ATIVO" = 'S') order by k."NU_ORDEM")
        from public."TB_CRITERIO_CLASSIFICACAO" k),
    'cronograma', coalesce((
      select json_agg(json_build_object('ordem', c.ordem, 'atividade', c.atividade, 'inicio', c.data_inicio, 'fim', c.data_fim)
             order by c.ordem)
        from public."TB_CRONOGRAMA_MONIT_INDIG" c where c.monitoramento_id = p_edital), '[]'::json),
    'quadro', coalesce((
      select json_agg(json_build_object('id', q."CO_QUADRO_VAGA", 'ordem', q."NU_ORDEM", 'cargo', q."NO_CARGO",
               'lotacao', q."NO_LOTACAO", 'modalidades', q."DS_MODALIDADE_VAGA", 'vagas_imediatas', q."QT_VAGA_IMEDIATA",
               'cadastro_reserva', q."ST_CADASTRO_RESERVA" = 'S') order by q."NU_ORDEM")
        from public."TB_QUADRO_VAGA_EDITAL" q
       where q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S'), '[]'::json),
    'candidatos', coalesce((
      with a as (
        select a.* from public."TB_ANALISE_CURRICULAR" a
         where a."CO_AREA" = v_area and a.ativo and private."FC_NUMERO_EDITAL"(a.edital) = v_numero
      ),
      vq as (
        select n.nome_vaga, private."FC_QUADRO_DA_VAGA"(p_edital, n.nome_vaga) as quadro
          from (select distinct a.nome_vaga from a) n
      )
      select json_agg(json_build_object(
               'analise_id', a.id, 'codigo', a.id_origem, 'nome', a.candidato, 'vaga', a.codigo_vaga,
               'cargo', a.nome_vaga, 'categoria', a.categoria, 'modalidade', a.modalidade_concorrencia, 'pcd', a.pcd,
               'data_nascimento', a.data_nascimento, 'nota_documental', a.nota_final_ajustada, 'nota_art', a.nota_empregare,
               'pontuacao_formacao', a.pontuacao_escolaridade, 'pontuacao_cursos', a.pontuacao_cursos_aperfeicoamento,
               'pontuacao_experiencia', a.pontuacao_experiencia_profissional, 'pontuacao_etnica', a.pontuacao_criterio_etnico,
               'exp_saude_indigena', a.experiencia_saude_indigena_total, 'exp_atencao_basica', a.experiencia_atencao_basica_total,
               'exp_profissional', a.experiencia_profissional_total, 'status', a.status_consolidado, 'etapa', a.etapa,
               'quadro', vq.quadro)
             order by a.codigo_vaga, a.candidato)
        from a left join vq on vq.nome_vaga is not distinct from a.nome_vaga), '[]'::json),
    'entrevistas', coalesce((
      select json_agg(json_build_object(
               'id', e."CO_ENTREVISTA", 'analise_id', e."CO_ANALISE_CURRICULAR", 'nome', e."NO_CANDIDATO",
               'vaga', e."CO_VAGA", 'nota', e."VL_NOTA_TOTAL", 'parecer', e."TP_PARECER", 'compareceu', e."ST_COMPARECEU",
               'ligacao', e."TP_LIGACAO_ANALISE", 'origem', e."TP_ORIGEM",
               'notas', coalesce((select json_agg(json_build_object('ordem', n."NU_ORDEM", 'criterio', n."DS_CRITERIO", 'nota', n."VL_NOTA")
                                         order by n."NU_ORDEM")
                                    from public."TB_ENTREVISTA_NOTA" n where n."CO_ENTREVISTA" = e."CO_ENTREVISTA"), '[]'::json))
             order by e."CO_VAGA", e."NO_CANDIDATO")
        from public."TB_ENTREVISTA" e
       where e."ST_ATIVO" = 'S'
         and (e."CO_MONITORAMENTO" = p_edital
              or (e."CO_MONITORAMENTO" is null and e."CO_AREA" = v_area
                  and private."FC_NUMERO_EDITAL"(e."DS_EDITAL") = v_numero))), '[]'::json),
    'listas', coalesce((
      select json_agg(private."FC_LISTA_CLASSIFICACAO_JSON"(l."CO_LISTA_CLASSIFICACAO") order by l."DT_GERACAO" desc)
        from (select l."CO_LISTA_CLASSIFICACAO", l."DT_GERACAO"
                from public."TB_LISTA_CLASSIFICACAO" l
               where l."CO_MONITORAMENTO" = p_edital
               order by l."DT_GERACAO" desc limit 60) l), '[]'::json),
    'desempates', coalesce((
      select json_agg(private."FC_DESEMPATE_CLASSIFICACAO_JSON"(d."CO_DESEMPATE_CLASSIFICACAO") order by d."DT_REGISTRO")
        from public."TB_DESEMPATE_CLASSIFICACAO" d
       where d."CO_MONITORAMENTO" = p_edital and d."ST_ATIVO" = 'S'), '[]'::json),
    'ajustes', coalesce((
      select json_agg(private."FC_AJUSTE_PONTUACAO_JSON"(j."CO_AJUSTE_PONTUACAO") order by j."DT_APROVACAO", j."CO_AJUSTE_PONTUACAO")
        from public."TB_AJUSTE_PONTUACAO_RECURSO" j
       where j."CO_MONITORAMENTO" = p_edital and j."TP_SITUACAO" = 'APROVADO'), '[]'::json),
    'ajustes_mudaram_em', (
      select greatest(max(j."DT_APROVACAO"), max(j."DT_CANCELAMENTO") filter (where j."DT_APROVACAO" is not null))
        from public."TB_AJUSTE_PONTUACAO_RECURSO" j
       where j."CO_MONITORAMENTO" = p_edital)
  );
end;
$function$;

-- obter_pre_classificacao
CREATE OR REPLACE FUNCTION public.obter_pre_classificacao(p_edital uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_papel text := private."FC_PAPEL_AVALIACAO"(p_edital);
  v_classif_editor boolean := private.pode_recurso('classificacao', 2);
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'edital', json_build_object('id', v_m.id, 'edital', v_m.edital, 'unidade', v_m.unidade, 'area', v_area,
                                'numero', private."FC_NUMERO_EDITAL"(v_m.edital), 'rotulo', private."FC_ROTULO_DO_EDITAL"(v_m.edital),
                                'treinamento', private."FC_EH_TREINAMENTO"(v_m."ST_TREINAMENTO")),
    'papel', v_papel,
    'pode_coordenar', coalesce(v_papel = 'COORDENADOR', false),
    'pode_registrar_lista', coalesce(v_papel = 'COORDENADOR', false) or coalesce(v_classif_editor, false),
    'pode_publicar_lista', coalesce(v_classif_editor, false),
    'regra', (select json_build_object('versao', r."NU_VERSAO_VIGENTE", 'situacao', r."TP_SITUACAO",
                                       'configuracao', h."DS_CONFIGURACAO")
                from public."TB_REGRA_ANALISE" r
                join public."TH_REGRA_ANALISE" h on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
               where r."CO_MONITORAMENTO" = p_edital),
    'regra_classificacao', (select json_build_object('versao', r."NU_VERSAO_VIGENTE", 'configuracao', h."DS_CONFIGURACAO")
                              from public."TB_REGRA_CLASSIFICACAO" r
                              join public."TH_REGRA_CLASSIFICACAO" h
                                on h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
                             where r."CO_MONITORAMENTO" = p_edital),
    'em_andamento', exists (select 1 from public."TL_PRE_CLASSIFICACAO" t
                             where t."TP_SITUACAO" = 'EM_ANDAMENTO' and t."DT_INICIO" > now() - interval '1 hour'),
    'ultima_execucao', (
      select json_build_object('id', t."CO_EXECUCAO", 'inicio', t."DT_INICIO", 'fim', t."DT_FIM", 'situacao', t."TP_SITUACAO",
                               'disparo', t."TP_DISPARO", 'refazer', t."ST_REFAZER_LOTE" = 'S', 'mensagem', t."DS_MENSAGEM",
                               'execucao', t."DS_URL_EXECUCAO",
                               'edital', (select e from jsonb_array_elements(t."DS_EDITAL") e where e ->> 'edital' = p_edital::text limit 1))
        from public."TL_PRE_CLASSIFICACAO" t
       where t."DS_EDITAL" @> jsonb_build_array(jsonb_build_object('edital', p_edital::text))
       order by t."DT_INICIO" desc limit 1),
    'vagas', coalesce((
      select json_agg(json_build_object(
               'codigo', v."CO_VAGA",
               'candidatos_empregare', v."QT_CANDIDATO_ATIVO",
               'ultima_carga', v."DT_ULTIMA_CARGA",
               'cargo', pv."NO_CARGO", 'lotacao', pv."NO_LOTACAO",
               'vagas_imediatas', pv."QT_VAGA_IMEDIATA", 'cadastro_reserva', pv."ST_CADASTRO_RESERVA" = 'S',
               'inscritos', pv."QT_INSCRITO", 'eliminados', pv."QT_ELIMINADO", 'ranqueados', pv."QT_RANQUEADO",
               'no_lote', pv."QT_LOTE", 'tamanho', pv."QT_TAMANHO_LOTE", 'descricao', pv."DS_TAMANHO_LOTE",
               'por_modalidade', pv."DS_TAMANHO_MODALIDADE", 'art_corte', pv."VL_ART_CORTE",
               'divergencias', pv."QT_DIVERGENCIA", 'sem_art', pv."QT_SEM_ART", 'acima_do_corte', pv."QT_ACIMA_CORTE",
               'ultimo_lote', pv."NU_ULTIMO_LOTE", 'avisos', coalesce(pv."DS_AVISO", '[]'::jsonb),
               -- O lote pela regra e por decisão da coordenação, contados agora.
               'no_lote_regra', (select count(*) from public."TB_PRE_CLASSIFICACAO" a
                                  where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = v."CO_VAGA"
                                    and a."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO') and a."TP_ENTRADA_LOTE" is distinct from 'DECISAO'),
               'no_lote_decisao', (select count(*) from public."TB_PRE_CLASSIFICACAO" a
                                    where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = v."CO_VAGA"
                                      and a."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO') and a."TP_ENTRADA_LOTE" = 'DECISAO'),
               'versao_regra', pv."NU_VERSAO_REGRA", 'atualizado_em', pv."DT_ATUALIZACAO")
             order by v."CO_VAGA")
        from public."TB_EMPREGARE_VAGA" v
        left join public."TB_PRE_CLASSIF_VAGA" pv on pv."CO_MONITORAMENTO" = p_edital and pv."CO_VAGA" = v."CO_VAGA"
       where v."CO_MONITORAMENTO" = p_edital), '[]'::json),
    'candidatos', coalesce((
      select json_agg(json_build_object(
               'id', a."CO_EMPREGARE_CANDIDATO", 'vaga', a."CO_VAGA",
               'codigo', c."CO_CANDIDATO_EMPREGARE", 'nome', c."NO_CANDIDATO",
               'situacao', a."TP_SITUACAO", 'motivo_codigo', a."CO_MOTIVO_ELIMINACAO", 'motivo', a."DS_MOTIVO_ELIMINACAO",
               'art', a."VL_ART", 'nota', a."VL_NOTA_ORDEM", 'origem_nota', a."TP_ORIGEM_NOTA",
               'declarada', a."VL_NOTA_DECLARADA", 'divergente', a."ST_DIVERGENTE" = 'S', 'modalidade', a."NO_MODALIDADE",
               'declarada_completa', (a."DS_NOTA_DECLARADA" ->> 'completa')::boolean,
               'declarada_congelada', a."VL_DECLARADA_CONGELADA", 'congelada_em', a."DT_CONGELAMENTO_DECLARADA",
               'posicao', a."NU_POSICAO", 'posicao_modalidade', a."NU_POSICAO_MODALIDADE",
               'lote', a."NU_LOTE", 'lista_lote', a."CO_LISTA_LOTE", 'entrada', a."TP_ENTRADA_LOTE",
               'motivo_entrada', a."DS_MOTIVO_ENTRADA", 'entrada_em', a."DT_ENTRADA_LOTE",
               'decisao', case when d."CO_DECISAO_LOTE" is not null then json_build_object(
                 'motivo', d."DS_MOTIVO", 'por', coalesce(ud.nome, ud.email), 'em', d."DT_DECISAO",
                 'situacao_regra', d."TP_SITUACAO_REGRA", 'motivo_regra', d."DS_MOTIVO_ELIMINACAO_REGRA") end)
             order by a."CO_VAGA", a."TP_SITUACAO" = 'ELIMINADO', a."NU_POSICAO", c."CO_CANDIDATO_EMPREGARE")
        from public."TB_PRE_CLASSIFICACAO" a
        join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
        left join public."TB_DECISAO_LOTE" d
          on d."CO_MONITORAMENTO" = a."CO_MONITORAMENTO" and d."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO" and d."ST_ATIVO" = 'S'
        left join public."TB_PERFIL_USUARIO" ud on ud.user_id = d."CO_USUARIO_DECISAO"
       where a."CO_MONITORAMENTO" = p_edital), '[]'::json),
    'listas', coalesce((
      select json_agg(json_build_object('meta', private."FC_LISTA_CLASSIFICACAO_JSON"(l."CO_LISTA_CLASSIFICACAO"),
                                        'lote', l."DS_RESULTADO" -> 'lote')
             order by l."DT_GERACAO" desc)
        from public."TB_LISTA_CLASSIFICACAO" l
       where l."CO_MONITORAMENTO" = p_edital and l."TP_LISTA" in ('PROVISORIA', 'LOTE')), '[]'::json)
  );
end;
$function$;

-- ── 6. Preparar o edital de treinamento (idempotente) ──────────────────────
create or replace function private."FC_PREPARAR_EDITAL_TREINAMENTO"(p_area text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_numero constant text := '991/2099';
  c_edital constant text := 'Treinamento – Saúde Indígena (991/2099)';
  c_unidade constant text := 'DSEI Treinamento';
  c_origem constant text := 'treinamento';
  v_area text := lower(btrim(coalesce(p_area, '')));
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_uid uuid := coalesce((select auth.uid()), '00000000-0000-0000-0000-000000000000'::uuid);
  v_id uuid;
  v_planilha text;
  v_grupo text;
  v_roteiro uuid;
  v_regra_classif uuid;
  v_config_classif jsonb;
  v_modelo public."TB_REGRA_ANALISE_MODELO";
  v_config_analise jsonb;
  v_regra_analise uuid;
  v_resultado jsonb;
begin
  if v_area <> 'saude-indigena' then
    raise exception 'Edital de treinamento disponível só para a Saúde Indígena (por enquanto)' using errcode = '22023';
  end if;
  select a."NO_GRUPO_PLANILHA" into v_grupo from public."TB_AREA" a where a."CO_AREA" = v_area;
  select p."CO_PLANILHA" into v_planilha from public."TB_PLANILHA_ANALISE" p where p."CO_AREA" = v_area;
  if v_grupo is null or v_planilha is null then
    raise exception 'Área sem planilha de análises cadastrada: %', v_area using errcode = '22023';
  end if;

  -- Um edital de treinamento por área; uma preparação por vez.
  perform pg_advisory_xact_lock(hashtextextended('edital_treinamento:' || v_area, 0));

  -- Vagas, candidatos e notas fictícios (nada de dado pessoal real).
  create temporary table if not exists tmp_treino_vaga (
    vaga text primary key, ordem smallint, cargo text, imediatas integer, cr boolean, nivel text
  ) on commit drop;
  truncate tmp_treino_vaga;
  insert into tmp_treino_vaga values
    ('9909910001', 1, 'Enfermeiro', 2, true, 'Superior'),
    ('9909910002', 2, 'Técnico de Enfermagem', 3, true, 'Técnico'),
    ('9909910003', 3, 'Agente Indígena de Saúde (AIS)', 2, false, 'Fundamental');

  create temporary table if not exists tmp_treino_candidato (
    n integer primary key, codigo text, nome text, email text, vaga text, nota numeric,
    modalidade text, indigena boolean, nascimento date
  ) on commit drop;
  truncate tmp_treino_candidato;
  insert into tmp_treino_candidato
  select n, 'TREINO-' || lpad(n::text, 2, '0'), 'Candidato Teste ' || lpad(n::text, 2, '0'),
         'candidato.teste' || lpad(n::text, 2, '0') || '@exemplo.invalid',
         case when n <= 5 then '9909910001' when n <= 11 then '9909910002' else '9909910003' end,
         (array[82.5, 77, 71.25, 64, 58.5, 88, 79.5, 73, 69.75, 61, 55.5, 74, 68.25, 62, 51.5])[n],
         case when n in (3, 8, 12, 14) then 'Indígenas' else 'Ampla Concorrência' end,
         n in (3, 8, 12, 13, 14),
         make_date(1970 + n * 2, 1 + (n % 12), 1 + n)
    from generate_series(1, 15) n;

  -- O edital.
  select m.id into v_id
    from public."TB_MONITORAMENTO_INDIGENA" m
   where m."CO_AREA" = v_area and m."ST_TREINAMENTO" = 'S'
   order by m.created_at, m.id
   limit 1;
  if v_id is null then
    insert into public."TB_MONITORAMENTO_INDIGENA" (
      processo, edital, sigla_unidade, tipo_unidade, unidade, uf, ciclo, cargos, vagas_total, inscritos,
      aptos_analise, data_inicio, data_fim, status, etapa, risco, responsavel, observacoes,
      observacoes_internas, ativo, origem_carga, cronograma_origem, "CO_AREA", "ST_TREINAMENTO")
    values (
      'TREINAMENTO', c_edital, 'TREINO', 'DSEI', c_unidade, 'DF', '2099',
      'Enfermeiro; Técnico de Enfermagem; Agente Indígena de Saúde (AIS)', 7, 15, 15,
      v_hoje - 45, v_hoje + 30, 'Em andamento', 'Entrevistas', 'Baixo', 'Treinamento',
      'Edital de treinamento: dados fictícios, sem valor oficial.',
      'Criado por private."FC_PREPARAR_EDITAL_TREINAMENTO". Reinicie em Editais (admin).',
      true, 'TREINAMENTO', 'MANUAL', v_area, 'S')
    returning id into v_id;
  end if;

  -- Cronograma relativo a hoje: inscrições já passaram, avaliação documental e
  -- entrevistas em andamento (FC_JANELA_ENTREVISTA fica aberta).
  if not exists (select 1 from public."TB_CRONOGRAMA_MONIT_INDIG" c where c.monitoramento_id = v_id) then
    insert into public."TB_CRONOGRAMA_MONIT_INDIG" (monitoramento_id, ordem, atividade, tipo_atividade, data_inicio, data_fim, origem, observacao)
    select v_id, x.ordem, x.atividade, x.tipo, v_hoje + x.ini, v_hoje + x.fim, 'MANUAL', 'Treinamento'
      from (values
        (1, 'Publicação do Edital', 'PUBLICACAO', -45, -45),
        (2, 'Período de inscrição e Envio dos Documentos Comprobatórios de Requisitos', 'INSCRICAO', -44, -30),
        (3, 'Avaliação Documental e de Títulos', 'ANALISE', -29, 10),
        (4, 'Resultado Preliminar da Avaliação Documental e de Títulos', 'RESULTADO', -12, -12),
        (5, 'Prazo de recurso referente ao resultado preliminar da Avaliação Documental e de Títulos', 'RECURSO', -11, -9),
        (6, 'Resultado Final da Avaliação Documental e de Títulos', 'RESULTADO', -7, -7),
        (7, 'Convocação para a Entrevista', 'CONVOCACAO', -5, -5),
        (8, 'Período de Entrevistas', 'ENTREVISTA', -2, 12),
        (9, 'Resultado Preliminar das Entrevistas', 'RESULTADO', 15, 15),
        (10, 'Prazo para recursos referentes ao resultado preliminar das entrevistas', 'RECURSO', 16, 18),
        (11, 'Resultado final da Entrevista', 'RESULTADO', 21, 21),
        (12, 'Resultado final do Processo Seletivo', 'RESULTADO', 25, 25)
      ) x(ordem, atividade, tipo, ini, fim);
  end if;

  -- Quadro de vagas.
  if not exists (select 1 from public."TB_QUADRO_VAGA_EDITAL" q where q."CO_MONITORAMENTO" = v_id and q."ST_REGISTRO_ATIVO" = 'S') then
    insert into public."TB_QUADRO_VAGA_EDITAL" ("CO_MONITORAMENTO", "NU_ORDEM", "NO_CARGO", "NO_LOTACAO",
      "DS_MODALIDADE_VAGA", "QT_VAGA_IMEDIATA", "ST_CADASTRO_RESERVA", "TP_ORIGEM", "DS_ARQUIVO_ORIGEM", "CO_USUARIO_ATUALIZACAO")
    select v_id, t.ordem, t.cargo, c_unidade,
           jsonb_build_object('Ampla Concorrência', t.imediatas, 'Indígenas', null),
           t.imediatas, case when t.cr then 'S' else 'N' end, 'MANUAL', 'treinamento', v_uid
      from tmp_treino_vaga t;
  end if;

  -- Análises curriculares fictícias (aprovadas): a fonte da Classificação e da convocação.
  insert into public."TB_ANALISE_CURRICULAR" (grupo, unidade, edital, codigo_vaga, nome_vaga, candidato, cpf_hash,
    categoria, modalidade_concorrencia, status_consolidado, etapa, responsavel_analise, data_analise,
    nota_final_ajustada, pontuacao_escolaridade, pontuacao_cursos_aperfeicoamento,
    pontuacao_experiencia_profissional, pontuacao_criterio_etnico, experiencia_saude_indigena_total,
    experiencia_atencao_basica_total, analise, ativo, id_origem, data_nascimento, nota_empregare,
    pcd, origem_planilha, chave_natural, "CO_AREA", "CO_PLANILHA")
  select v_grupo, c_unidade, c_edital, c.vaga, v.cargo, c.nome, null,
         v.nivel, c.modalidade, 'Aprovado', 'Análise concluída', 'Treinamento', v_hoje - 14,
         c.nota, round(c.nota * 0.3, 2), round(c.nota * 0.1, 2), round(c.nota * 0.4, 2),
         case when c.indigena then 14 else 0 end, (c.n % 5) * 6, (c.n % 4) * 9,
         'Análise fictícia do edital de treinamento.', true, c.codigo, c.nascimento, round(c.nota * 0.9, 2),
         'Não', c_origem, c_origem || '|' || v_area || '|' || c.codigo, v_area, v_planilha
    from tmp_treino_candidato c
    join tmp_treino_vaga v on v.vaga = c.vaga
  on conflict (chave_natural) do nothing;

  -- Roteiro de exemplo (id fixo por área: o reinício reaproveita).
  v_roteiro := md5('agsus-treinamento-roteiro-' || v_area)::uuid;
  if not exists (select 1 from public."TB_ROTEIRO_ENTREVISTA" r where r."CO_ROTEIRO" = v_roteiro) then
    insert into public."TB_ROTEIRO_ENTREVISTA" ("CO_ROTEIRO", "CO_ROTEIRO_ORIGEM", "NU_VERSAO", "CO_AREA", "NO_ROTEIRO",
      "DS_DESCRICAO", "NO_ETAPA", "TP_ESCALA", "VL_PASSO", "DS_NOTAS_PERMITIDAS", "VL_NOTA_MINIMA_TOTAL",
      "DS_NOTAS_ELIMINATORIAS", "ST_AUSENCIA_ELIMINA", "DS_DESEMPATE", "ST_SOMA_ANALISE",
      "DS_CONVOCACAO_PADRAO", "DS_BANCA_PADRAO", "ST_ATIVO")
    values (v_roteiro, v_roteiro, 1, v_area, 'Treinamento — Entrevista individual (exemplo)',
      'Roteiro de exemplo do edital de treinamento: 4 competências de 0 a 5, apto com 8 pontos e 2 em cada competência; nota 0 elimina.',
      'Entrevista Individual', 'NIVEIS', 1, '[]'::jsonb, 8, '[0]'::jsonb, 'S',
      '["Idade igual ou superior a 60 anos (Estatuto da Pessoa Idosa)", "Maior pontuação na Avaliação Documental e de Títulos", "Maior pontuação na Entrevista"]'::jsonb,
      'S', '{"multiplo_imediatas": 3, "posicao_cadastro_reserva": 5}'::jsonb,
      '[{"origem": "AgSUS", "quantidade": 1}, {"origem": "DSEI", "quantidade": 1}]'::jsonb, 'S');
    insert into public."TB_ROTEIRO_COMPETENCIA" ("CO_ROTEIRO", "NU_ORDEM", "NO_COMPETENCIA", "DS_DESCRICAO", "VL_NOTA_MAXIMA", "VL_PESO", "VL_MINIMO")
    values (v_roteiro, 1, 'Comunicação e escuta', 'Expressa-se com clareza e escuta o outro.', 5, 1, 2),
           (v_roteiro, 2, 'Trabalho em equipe', 'Colabora e compartilha responsabilidades.', 5, 1, 2),
           (v_roteiro, 3, 'Respeito à diversidade cultural', 'Reconhece e respeita os modos de vida dos povos indígenas.', 5, 1, 2),
           (v_roteiro, 4, 'Conhecimento da função', 'Conhece as atribuições do cargo no território.', 5, 1, 2);
    insert into public."TB_ROTEIRO_NIVEL" ("CO_ROTEIRO", "VL_NOTA", "NO_NIVEL", "DS_DESCRICAO")
    values (v_roteiro, 0, 'Não demonstrou', null), (v_roteiro, 1, 'Insuficiente', null),
           (v_roteiro, 2, 'Básico', null), (v_roteiro, 3, 'Adequado', null),
           (v_roteiro, 4, 'Bom', null), (v_roteiro, 5, 'Excelente', null);
  end if;

  -- Entrevista configurada (roteiro, banca, vagas imediatas e avaliadores fictícios).
  if not exists (select 1 from public."TB_ENTREVISTA_EDITAL" e where e."CO_MONITORAMENTO" = v_id) then
    insert into public."TB_ENTREVISTA_EDITAL" ("CO_MONITORAMENTO", "CO_ROTEIRO", "DS_CONVOCACAO", "DS_BANCA", "TP_LANCAMENTO", "CO_USUARIO_ATUALIZACAO")
    values (v_id, v_roteiro, '{}'::jsonb,
            '[{"origem": "AgSUS", "quantidade": 1}, {"origem": "DSEI", "quantidade": 1}]'::jsonb, 'SECRETARIA', v_uid);
  end if;
  insert into public."TB_ENTREVISTA_VAGA" ("CO_MONITORAMENTO", "CO_VAGA", "QT_VAGA_IMEDIATA")
  select v_id, t.vaga, t.imediatas from tmp_treino_vaga t
   where not exists (select 1 from public."TB_ENTREVISTA_VAGA" x where x."CO_MONITORAMENTO" = v_id and x."CO_VAGA" = t.vaga);
  if not exists (select 1 from public."TB_ENTREVISTA_AVALIADOR" b where b."CO_MONITORAMENTO" = v_id) then
    insert into public."TB_ENTREVISTA_AVALIADOR" ("CO_MONITORAMENTO", "NO_AVALIADOR", "NO_ORIGEM", "NU_BANCA")
    values (v_id, 'Avaliador Teste 1', 'AgSUS', 1), (v_id, 'Avaliador Teste 2', 'DSEI', 1);
  end if;

  -- Regra da classificação (formato de src/lib/classificacao/regra.js) e a lista de convocação.
  select r."CO_REGRA_CLASSIFICACAO" into v_regra_classif
    from public."TB_REGRA_CLASSIFICACAO" r where r."CO_MONITORAMENTO" = v_id;
  if v_regra_classif is null then
    v_config_classif := jsonb_build_object(
      'schema', 1,
      'data_corte', to_char(v_hoje - 30, 'YYYY-MM-DD'),
      'etapas', jsonb_build_object('documental', true, 'entrevista', true),
      'documental', jsonb_build_object('situacoes_aptas', jsonb_build_array('Aprovado'), 'nota_minima', null,
                                       'nota_minima_por_nivel', '{}'::jsonb, 'niveis_por_cargo', '[]'::jsonb,
                                       'nivel_padrao', null, 'parciais', '[]'::jsonb),
      'entrevista', jsonb_build_object('nota_minima', 8, 'nota_minima_competencia', 2, 'nota_eliminatoria_ate', 0,
                                       'competencias', '[]'::jsonb, 'exige_comparecimento', true,
                                       'inapto_elimina', true, 'so_parecer', false),
      'composicao', jsonb_build_object('componentes', jsonb_build_array(
                                         jsonb_build_object('codigo', 'DOCUMENTAL', 'peso', 1),
                                         jsonb_build_object('codigo', 'ENTREVISTA', 'peso', 1)),
                                       'casas', 2, 'arredondamento', 'MEIO_PARA_CIMA'),
      'desempate', '[]'::jsonb,
      'listas', jsonb_build_object('PRELIMINAR', jsonb_build_object('empate', 'MESMA_POSICAO'),
                                   'ENTREVISTA', jsonb_build_object('empate', 'MESMA_POSICAO'),
                                   'FINAL', jsonb_build_object('empate', 'CRITERIOS')),
      'empate_final', jsonb_build_object('metodo', 'MESMA_POSICAO', 'numeracao', 'DENSA'),
      'modalidades', jsonb_build_array(jsonb_build_object(
                       'codigo', 'AC', 'nome', 'Ampla concorrência', 'percentual', null,
                       'arredondamento', 'MEIO_PARA_CIMA', 'lista_propria', false, 'recomeca_posicao', true,
                       'aparece_na_geral', true, 'remanejar_para', '[]'::jsonb, 'agrupa', '[]'::jsonb)),
      'cotas', jsonb_build_object('minimo_vagas_reserva', 0, 'acumulo', 'TODAS'),
      'convocacao', jsonb_build_object('multiplo_vagas', 3, 'posicao_max_cr', 5, 'incluir_empatados', true,
                                       'excecoes', '[]'::jsonb),
      'rodape', 'TREINAMENTO — sem valor oficial.',
      'documento', jsonb_build_object('edital', 'TREINAMENTO ' || c_numero, 'unidade', c_unidade));
    perform private."FC_VALIDAR_REGRA_CLASSIFICACAO"(v_config_classif);
    insert into public."TB_REGRA_CLASSIFICACAO" ("CO_MONITORAMENTO", "NU_VERSAO_VIGENTE", "CO_USUARIO_ATUALIZACAO")
    values (v_id, 1, v_uid) returning "CO_REGRA_CLASSIFICACAO" into v_regra_classif;
    insert into public."TH_REGRA_CLASSIFICACAO" ("CO_REGRA_CLASSIFICACAO", "NU_VERSAO", "DS_CONFIGURACAO", "TP_EMPATE_FINAL", "DS_MOTIVO", "CO_USUARIO")
    values (v_regra_classif, 1, v_config_classif, 'MESMA_POSICAO', 'Edital de treinamento', v_uid);
  end if;

  if not exists (select 1 from public."TB_LISTA_CLASSIFICACAO" l where l."CO_MONITORAMENTO" = v_id and l."TP_LISTA" = 'CONVOCACAO') then
    with ordenados as (
      select a.id, a.candidato, a.nota_final_ajustada as nota, a.codigo_vaga,
             rank() over (partition by a.codigo_vaga order by a.nota_final_ajustada desc) as posicao
        from public."TB_ANALISE_CURRICULAR" a
       where a."CO_AREA" = v_area and a.ativo and private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)
         and private."FC_NUMERO_EDITAL"(a.edital) = c_numero
    ),
    vagas as (
      select t.ordem, jsonb_build_object(
               'codigo', t.vaga, 'chave', t.vaga, 'cargo', t.cargo, 'lotacao', c_unidade,
               'cabecalho', 'Vaga ' || t.vaga || ' — ' || t.cargo || ' — ' || c_unidade,
               'total', t.imediatas, 'cadastro_reserva', t.cr, 'origem_das_vagas', 'QUADRO',
               'limite_convocacao', null,
               'geral', coalesce((select jsonb_agg(jsonb_build_object(
                          'analise_id', o.id, 'nome', o.candidato, 'posicao', o.posicao, 'nota', o.nota,
                          'modalidades', '[]'::jsonb, 'situacao', 'Classificado') order by o.posicao, o.candidato)
                          from ordenados o where o.codigo_vaga = t.vaga), '[]'::jsonb),
               'listas', '{}'::jsonb, 'eliminados', '[]'::jsonb) as vaga
        from tmp_treino_vaga t
    )
    select jsonb_build_object(
             'schema', 1, 'tipo', 'CONVOCACAO', 'casas', 2, 'avisos', '[]'::jsonb, 'pendencias', '[]'::jsonb,
             'edital', jsonb_build_object('id', v_id, 'edital', c_edital, 'unidade', c_unidade, 'treinamento', true),
             'rodape', 'TREINAMENTO — sem valor oficial.', 'data_corte', to_char(v_hoje - 30, 'YYYY-MM-DD'),
             'modalidades', '[]'::jsonb, 'empate_final', 'MESMA_POSICAO', 'regra_versao', 1,
             'totais', jsonb_build_object('vagas', (select sum(t.imediatas) from tmp_treino_vaga t),
                                          'avisos', 0, 'elegiveis', (select count(*) from ordenados),
                                          'candidatos', (select count(*) from ordenados), 'eliminados', 0, 'pendencias', 0),
             'vagas', (select jsonb_agg(v.vaga order by v.ordem) from vagas v))
      into v_resultado;
    insert into public."TB_LISTA_CLASSIFICACAO" ("CO_MONITORAMENTO", "TP_LISTA", "CO_REGRA_CLASSIFICACAO", "NU_VERSAO_REGRA",
      "DS_RESULTADO", "DS_HASH", "QT_ELEGIVEL", "CO_USUARIO")
    values (v_id, 'CONVOCACAO', v_regra_classif, 1, v_resultado,
            encode(sha256(convert_to(v_resultado::text, 'UTF8')), 'hex'),
            (v_resultado #>> '{totais,elegiveis}')::integer, v_uid);
  end if;

  -- Avaliação documental: inscrições e questionários no formato da Empregare.
  insert into public."TB_EMPREGARE_VAGA" ("CO_VAGA", "CO_MONITORAMENTO", "TP_SITUACAO", "DS_COLUNA", "NO_ARQUIVO",
    "QT_CANDIDATO_ATIVO", "QT_LINHA_ARQUIVO", "QT_RECEBIDA", "DS_MENSAGEM", "DT_ULTIMA_CARGA")
  select t.vaga, v_id, 'GRAVADA',
         jsonb_build_array('CÓDIGO', 'NOME', 'E-MAIL', 'TELEFONE', 'CELULAR', 'GÊNERO', 'PAÍS', 'ESTADO', 'CIDADE', 'PCD',
           'DATA DE NASCIMENTO', 'ETAPA', 'SITUAÇÃO', 'DATA DE CANDIDATURA', 'NÍVEL ÚLTIMA FORMAÇÃO', 'CURSO ÚLTIMA FORMAÇÃO',
           'SITUAÇÃO - ' || upper(t.cargo) || ' - DSEI TREINAMENTO',
           'NOTA - ' || upper(t.cargo) || ' - DSEI TREINAMENTO',
           'DATA DE RESPOSTA - ' || upper(t.cargo) || ' - DSEI TREINAMENTO',
           'RESPOSTAS - ' || upper(t.cargo) || ' - DSEI TREINAMENTO - Pergunta 1 - Nome completo:',
           'Pergunta 2 - Número do CPF:',
           'Pergunta 3 - Indique em qual sistema de concorrência deseja se inscrever:',
           'Pergunta 4 - Você é indígena e mora em aldeia?',
           'Pergunta 5 - Você possui a escolaridade exigida para a vaga?',
           'Pergunta 6 - Selecione sua Experiência Profissional na área/vaga em que concorre:'),
         'treinamento-' || t.vaga || '.xlsx',
         (select count(*) from tmp_treino_candidato c where c.vaga = t.vaga),
         (select count(*) from tmp_treino_candidato c where c.vaga = t.vaga),
         (select count(*) from tmp_treino_candidato c where c.vaga = t.vaga),
         'Carga fictícia do edital de treinamento.', now()
    from tmp_treino_vaga t
  on conflict ("CO_VAGA") do nothing;

  insert into public."TB_EMPREGARE_CANDIDATO" ("CO_VAGA", "DS_CHAVE_CANDIDATO", "TP_CHAVE", "CO_CANDIDATO_EMPREGARE",
    "NO_CANDIDATO", "DS_EMAIL", "NU_CPF", "NU_TELEFONE", "DT_NASCIMENTO", "DS_SITUACAO_EMPREGARE", "DT_CANDIDATURA",
    "DS_COLUNA_ORIGINAL", "DS_HASH_LINHA")
  select x.vaga, 'cod:' || x.codigo, 'CODIGO', x.codigo, x.nome, x.email, null, '(00) 00000-0000', x.nascimento,
         'Inscrito', x.candidatura, x.original, encode(sha256(convert_to(x.original::text, 'UTF8')), 'hex')
    from (
      select c.*, (v_hoje - 40 + (c.n % 10))::timestamp at time zone 'America/Sao_Paulo' as candidatura,
             jsonb_build_object(
               'CÓDIGO', c.codigo, 'NOME', c.nome, 'E-MAIL', c.email, 'TELEFONE', '(00) 0000-0000',
               'CELULAR', '(00) 00000-0000', 'GÊNERO', 'Não informado', 'PAÍS', 'Brasil', 'ESTADO', 'DF',
               'CIDADE', 'Cidade Fictícia', 'PCD', 'Não', 'DATA DE NASCIMENTO', to_char(c.nascimento, 'DD/MM/YYYY'),
               'ETAPA', 'Inscritos', 'SITUAÇÃO', 'Ativo', 'DATA DE CANDIDATURA', to_char(v_hoje - 40 + (c.n % 10), 'DD/MM/YYYY'),
               'NÍVEL ÚLTIMA FORMAÇÃO', t.nivel, 'CURSO ÚLTIMA FORMAÇÃO', t.cargo,
               'SITUAÇÃO - ' || upper(t.cargo) || ' - DSEI TREINAMENTO', 'Respondido',
               'NOTA - ' || upper(t.cargo) || ' - DSEI TREINAMENTO', replace(to_char(round(c.nota * 0.9, 2), 'FM990.00'), '.', ','),
               'DATA DE RESPOSTA - ' || upper(t.cargo) || ' - DSEI TREINAMENTO', to_char(v_hoje - 40 + (c.n % 10), 'DD/MM/YYYY'),
               'RESPOSTAS - ' || upper(t.cargo) || ' - DSEI TREINAMENTO - Pergunta 1 - Nome completo:', c.nome,
               'Pergunta 2 - Número do CPF:', '000.000.000-00',
               'Pergunta 3 - Indique em qual sistema de concorrência deseja se inscrever:', c.modalidade,
               'Pergunta 4 - Você é indígena e mora em aldeia?', case when c.indigena then 'Sou indígena e moro em aldeia' else 'Não' end,
               'Pergunta 5 - Você possui a escolaridade exigida para a vaga?', 'Sim',
               'Pergunta 6 - Selecione sua Experiência Profissional na área/vaga em que concorre:', ((c.n % 5) * 6)::text || ' meses'
             ) as original
        from tmp_treino_candidato c
        join tmp_treino_vaga t on t.vaga = c.vaga
    ) x
  on conflict ("CO_VAGA", "DS_CHAVE_CANDIDATO") do nothing;

  -- A avaliação documental do edital é feita no MONITORA.
  insert into public."TB_ORIGEM_ANALISE_EDITAL" ("CO_MONITORAMENTO", "TP_ORIGEM")
  values (v_id, 'MONITORA')
  on conflict ("CO_MONITORAMENTO") do nothing;

  -- Regra da avaliação documental copiada de um modelo SI (situação CONFERIR: conferir faz parte do treino).
  if not exists (select 1 from public."TB_REGRA_ANALISE" r where r."CO_MONITORAMENTO" = v_id) then
    select * into v_modelo
      from public."TB_REGRA_ANALISE_MODELO" m
     where m."ST_ATIVO" = 'S' and m."CO_MODELO" like 'SI%'
     order by (m."CO_MODELO" = 'SI26-ALSE') desc, m."CO_MODELO"
     limit 1;
    if v_modelo."CO_MODELO" is not null then
      v_config_analise := v_modelo."DS_CONFIGURACAO"
        || jsonb_build_object('modelo', v_modelo."CO_MODELO", 'edital_rotulo', 'Edital ' || c_numero || ' (TREINAMENTO)');
      perform private."FC_VALIDAR_REGRA_ANALISE"(v_config_analise);
      insert into public."TB_REGRA_ANALISE" ("CO_MONITORAMENTO", "NU_VERSAO_VIGENTE", "CO_MODELO_ORIGEM", "CO_USUARIO_ATUALIZACAO")
      values (v_id, 1, v_modelo."CO_MODELO", v_uid)
      returning "CO_REGRA_ANALISE" into v_regra_analise;
      insert into public."TH_REGRA_ANALISE" ("CO_REGRA_ANALISE", "NU_VERSAO", "DS_CONFIGURACAO", "DS_HASH", "DS_MOTIVO", "CO_USUARIO")
      values (v_regra_analise, 1, v_config_analise, encode(sha256(convert_to(v_config_analise::text, 'UTF8')), 'hex'),
              'Edital de treinamento: copiada do modelo ' || v_modelo."CO_MODELO", v_uid);
    end if;
  end if;

  return v_id;
end;
$$;
comment on function private."FC_PREPARAR_EDITAL_TREINAMENTO"(text) is
  'Cria ou completa (idempotente) o edital de treinamento da área: edital com ST_TREINAMENTO = S, cronograma relativo a hoje, quadro de vagas, 15 candidatos fictícios (análise, lista de convocação, inscrição Empregare), roteiro de exemplo, regras da classificação e da avaliação documental. Só a Saúde Indígena por enquanto. Devolve o id do edital.';
revoke all on function private."FC_PREPARAR_EDITAL_TREINAMENTO"(text) from public, anon, authenticated;
grant execute on function private."FC_PREPARAR_EDITAL_TREINAMENTO"(text) to service_role;

-- ── 7. Apagar os dados do edital de treinamento (exceção à exclusão lógica) ─
create or replace function private."FC_APAGAR_DADOS_DO_TREINAMENTO"(p_edital uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_numero text;
  v_qt jsonb := '{}'::jsonb;
  v_n integer;
begin
  -- A trava: a linha travada TEM de ser de treinamento. Nada é apagado antes disto.
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital for update;
  if v_m.id is null then
    raise exception 'Edital não encontrado' using errcode = '22023';
  end if;
  if v_m."ST_TREINAMENTO" is distinct from 'S' then
    raise exception 'Só o edital de treinamento pode ser reiniciado: este edital é real e nada foi apagado'
      using errcode = '42501';
  end if;
  -- Vaga que veio do robô da Empregare (CO_SYNC) não é do treinamento: recusa.
  if exists (select 1 from public."TB_EMPREGARE_VAGA" v where v."CO_MONITORAMENTO" = p_edital and v."CO_SYNC" is not null) then
    raise exception 'O edital de treinamento tem vaga carregada pelo robô da Empregare; nada foi apagado' using errcode = '23514';
  end if;
  v_numero := private."FC_NUMERO_EDITAL"(v_m.edital);

  perform set_config('agsus.reinicio_treinamento', p_edital::text, true);

  -- Conversa do edital.
  delete from public."RL_MENSAGEM_REACAO" x using public."TB_CONVERSA" c
   where x."CO_CONVERSA" = c."CO_CONVERSA" and c."CO_MONITORAMENTO" = p_edital;
  delete from public."TB_ANEXO_MENSAGEM" x using public."TB_CONVERSA" c
   where x."CO_CONVERSA" = c."CO_CONVERSA" and c."CO_MONITORAMENTO" = p_edital;
  delete from public."TB_MENSAGEM" x using public."TB_CONVERSA" c
   where x."CO_CONVERSA" = c."CO_CONVERSA" and c."CO_MONITORAMENTO" = p_edital;
  delete from public."RL_CONVERSA_PARTICIPANTE" x using public."TB_CONVERSA" c
   where x."CO_CONVERSA" = c."CO_CONVERSA" and c."CO_MONITORAMENTO" = p_edital;
  delete from public."TB_CONVERSA" where "CO_MONITORAMENTO" = p_edital;

  -- Lista de aprovados, cartas e convocação.
  create temporary table if not exists tmp_treino_listas (id uuid primary key) on commit drop;
  truncate tmp_treino_listas;
  insert into tmp_treino_listas select l.id from public."TB_LISTA_APROVADO" l where l.edital_id = p_edital::text;
  delete from public."RL_CARTA_CANDIDATO" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TH_CANDIDATO_APROVADO" where lista_id in (select id from tmp_treino_listas);
  delete from public."TH_CANDIDATO_SUB_JUDICE" where "CO_LISTA" in (select id from tmp_treino_listas);
  delete from public."TH_CARTA_CONVOCACAO" h using public."TB_MODELO_CARTA_CONVOCACAO" m
   where h."CO_MODELO_CARTA" = m."CO_MODELO_CARTA" and m."CO_MONITORAMENTO" = p_edital;
  delete from public."TH_MODELO_CARTA_CONVOCACAO" h using public."TB_MODELO_CARTA_CONVOCACAO" m
   where h."CO_MODELO_CARTA" = m."CO_MODELO_CARTA" and m."CO_MONITORAMENTO" = p_edital;
  delete from public."TB_MODELO_CARTA_CONVOCACAO" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TH_PUBLICACAO_APROVADO"
   where "CO_MONITORAMENTO" = p_edital
      or "CO_LISTA_APROVADO" in (select id from tmp_treino_listas)
      or "CO_LISTA_APROVADO_ANTERIOR" in (select id from tmp_treino_listas);
  delete from public."TB_CANDIDATO_APROVADO" where lista_id in (select id from tmp_treino_listas);
  delete from public."TB_LISTA_APROVADO" where id in (select id from tmp_treino_listas);
  get diagnostics v_n = row_count; v_qt := v_qt || jsonb_build_object('listas_aprovados', v_n);
  delete from public."TB_CONVOCACAO_EDITAL" where "CO_EDITAL" = p_edital::text;

  -- Recursos.
  delete from public."TH_ANEXO_RECURSO" h using public."TB_ANEXO_RECURSO" a, public."TB_RECURSO_CANDIDATO" r
   where h."CO_ANEXO_RECURSO" = a."CO_ANEXO_RECURSO" and a."CO_RECURSO_CANDIDATO" = r."CO_RECURSO_CANDIDATO"
     and r."CO_MONITORAMENTO" = p_edital;
  delete from public."TB_ANEXO_RECURSO" a using public."TB_RECURSO_CANDIDATO" r
   where a."CO_RECURSO_CANDIDATO" = r."CO_RECURSO_CANDIDATO" and r."CO_MONITORAMENTO" = p_edital;
  delete from public."TH_RESPOSTA_RECURSO" h using public."TB_RESPOSTA_RECURSO" s, public."TB_RECURSO_CANDIDATO" r
   where h."CO_RESPOSTA_RECURSO" = s."CO_RESPOSTA_RECURSO" and s."CO_RECURSO_CANDIDATO" = r."CO_RECURSO_CANDIDATO"
     and r."CO_MONITORAMENTO" = p_edital;
  delete from public."TB_RESPOSTA_RECURSO" s using public."TB_RECURSO_CANDIDATO" r
   where s."CO_RECURSO_CANDIDATO" = r."CO_RECURSO_CANDIDATO" and r."CO_MONITORAMENTO" = p_edital;
  delete from public."TB_ITEM_AJUSTE_PONTUACAO" i using public."TB_AJUSTE_PONTUACAO_RECURSO" j
   where i."CO_AJUSTE_PONTUACAO" = j."CO_AJUSTE_PONTUACAO" and j."CO_MONITORAMENTO" = p_edital;
  delete from public."TB_AJUSTE_PONTUACAO_RECURSO" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TH_RECURSO_CANDIDATO" h using public."TB_RECURSO_CANDIDATO" r
   where h."CO_RECURSO_CANDIDATO" = r."CO_RECURSO_CANDIDATO" and r."CO_MONITORAMENTO" = p_edital;
  delete from public."TB_RECURSO_CANDIDATO" where "CO_MONITORAMENTO" = p_edital;
  get diagnostics v_n = row_count; v_qt := v_qt || jsonb_build_object('recursos', v_n);

  -- Entrevistas e agenda.
  delete from public."TB_AGENDA_ENTREVISTA" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TH_AGENDA_ENTREVISTA" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TH_REGRA_AGENDA_ENTREVISTA" h using public."TB_REGRA_AGENDA_ENTREVISTA" r
   where h."CO_REGRA_AGENDA" = r."CO_REGRA_AGENDA" and r."CO_MONITORAMENTO" = p_edital;
  delete from public."TB_REGRA_AGENDA_ENTREVISTA" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TB_ENTREVISTA_AVALIACAO" x using public."TB_ENTREVISTA" e
   where x."CO_ENTREVISTA" = e."CO_ENTREVISTA" and e."CO_MONITORAMENTO" = p_edital;
  delete from public."TB_ENTREVISTA_NOTA" x using public."TB_ENTREVISTA" e
   where x."CO_ENTREVISTA" = e."CO_ENTREVISTA" and e."CO_MONITORAMENTO" = p_edital;
  delete from public."TH_ENTREVISTA_AVALIACAO" x using public."TB_ENTREVISTA" e
   where x."CO_ENTREVISTA" = e."CO_ENTREVISTA" and e."CO_MONITORAMENTO" = p_edital;
  delete from public."TB_ENTREVISTA" where "CO_MONITORAMENTO" = p_edital;
  get diagnostics v_n = row_count; v_qt := v_qt || jsonb_build_object('entrevistas', v_n);
  delete from public."TB_ENTREVISTA_AVALIADOR" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TB_ENTREVISTA_EDITAL" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TB_ENTREVISTA_VAGA" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TB_ENTREVISTA_LIBERACAO" where "CO_MONITORAMENTO" = p_edital;

  -- Classificação.
  delete from public."TB_DESEMPATE_CLASSIFICACAO" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TB_LISTA_CLASSIFICACAO" where "CO_MONITORAMENTO" = p_edital;
  get diagnostics v_n = row_count; v_qt := v_qt || jsonb_build_object('listas_classificacao', v_n);
  delete from public."RL_REGRA_CRITERIO_DESEMPATE" x using public."TB_REGRA_CLASSIFICACAO" r
   where x."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and r."CO_MONITORAMENTO" = p_edital;
  delete from public."TH_REGRA_CLASSIFICACAO" h using public."TB_REGRA_CLASSIFICACAO" r
   where h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and r."CO_MONITORAMENTO" = p_edital;
  delete from public."TB_REGRA_CLASSIFICACAO" where "CO_MONITORAMENTO" = p_edital;

  -- Avaliação documental (gatilhos de imutabilidade: liberados só para este edital).
  delete from public."TL_ACESSO_FICHA_ANALISE" x using public."TB_FICHA_ANALISE" f
   where x."CO_FICHA_ANALISE" = f."CO_FICHA_ANALISE" and f."CO_MONITORAMENTO" = p_edital;
  delete from public."TH_FICHA_ANALISE" x using public."TB_FICHA_ANALISE" f
   where x."CO_FICHA_ANALISE" = f."CO_FICHA_ANALISE" and f."CO_MONITORAMENTO" = p_edital;
  delete from public."TB_FICHA_ANALISE" where "CO_MONITORAMENTO" = p_edital;
  get diagnostics v_n = row_count; v_qt := v_qt || jsonb_build_object('fichas', v_n);
  delete from public."TH_DECISAO_LOTE" x using public."TB_DECISAO_LOTE" d
   where x."CO_DECISAO_LOTE" = d."CO_DECISAO_LOTE" and d."CO_MONITORAMENTO" = p_edital;
  delete from public."TB_DECISAO_LOTE" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TH_PRE_CLASSIFICACAO" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TB_PRE_CLASSIFICACAO" where "CO_MONITORAMENTO" = p_edital;
  get diagnostics v_n = row_count; v_qt := v_qt || jsonb_build_object('pre_classificacao', v_n);
  delete from public."TB_PRE_CLASSIF_VAGA" where "CO_MONITORAMENTO" = p_edital;
  delete from public."RL_ANALISTA_EDITAL" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TH_REGRA_ANALISE" h using public."TB_REGRA_ANALISE" r
   where h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and r."CO_MONITORAMENTO" = p_edital;
  delete from public."TB_REGRA_ANALISE" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TH_ORIGEM_ANALISE_EDITAL" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TB_ORIGEM_ANALISE_EDITAL" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TB_EMPREGARE_CANDIDATO" c using public."TB_EMPREGARE_VAGA" v
   where c."CO_VAGA" = v."CO_VAGA" and v."CO_MONITORAMENTO" = p_edital and v."CO_SYNC" is null;
  get diagnostics v_n = row_count; v_qt := v_qt || jsonb_build_object('inscricoes', v_n);
  delete from public."TB_EMPREGARE_VAGA" where "CO_MONITORAMENTO" = p_edital and "CO_SYNC" is null;

  -- Avisos de conferência, quadro, cronograma (e o histórico dele).
  delete from public."TB_AVISO_CONFERENCIA" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TB_QUADRO_VAGA_EDITAL" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TB_LOCAL_VAGA_EDITAL" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TH_CRONOGRAMA_MONIT_INDIG" where monitoramento_id = p_edital;
  delete from public."TB_CRONOGRAMA_MONIT_INDIG" where monitoramento_id = p_edital;

  -- As análises fictícias: só as de origem 'treinamento', da área e do número deste edital.
  delete from public."TB_ANALISE_CURRICULAR" a
   where private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)
     and a."CO_AREA" = v_m."CO_AREA"
     and private."FC_NUMERO_EDITAL"(a.edital) = v_numero;
  get diagnostics v_n = row_count; v_qt := v_qt || jsonb_build_object('analises', v_n);

  perform set_config('agsus.reinicio_treinamento', '', true);
  return v_qt;
end;
$$;
comment on function private."FC_APAGAR_DADOS_DO_TREINAMENTO"(uuid) is
  'EXCEÇÃO à exclusão lógica (docs/banco-de-dados.md, seção 16): apaga fisicamente os dados do edital de TREINAMENTO (entrevistas, classificação, avaliação documental, inscrições fictícias, aprovados, recursos, conversa, cronograma, análises de origem treinamento). Trava a linha do edital e recusa (42501) se ST_TREINAMENTO não for S: nunca apaga dado de edital real. A linha do edital fica (mesmo id).';
revoke all on function private."FC_APAGAR_DADOS_DO_TREINAMENTO"(uuid) from public, anon, authenticated;
grant execute on function private."FC_APAGAR_DADOS_DO_TREINAMENTO"(uuid) to service_role;

-- ── 8. RPC: reiniciar o edital de treinamento (admin global) ───────────────
create or replace function public.reiniciar_edital_treinamento(p_edital uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_apagados jsonb;
  v_id uuid;
begin
  if not private.is_master() then
    raise exception 'Só o administrador global reinicia o edital de treinamento' using errcode = '42501';
  end if;
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital;
  if v_m.id is null then
    raise exception 'Edital não encontrado' using errcode = '22023';
  end if;
  if v_m."ST_TREINAMENTO" is distinct from 'S' then
    raise exception 'Só o edital de treinamento pode ser reiniciado' using errcode = '42501';
  end if;

  v_apagados := private."FC_APAGAR_DADOS_DO_TREINAMENTO"(p_edital);

  -- O edital volta ao cadastro inicial (o id fica: links e coordenações seguem valendo).
  update public."TB_MONITORAMENTO_INDIGENA"
     set processo = 'TREINAMENTO', edital = 'Treinamento – Saúde Indígena (991/2099)', unidade = 'DSEI Treinamento',
         sigla_unidade = 'TREINO', tipo_unidade = 'DSEI', id_unidade = null, uf = 'DF', ciclo = '2099',
         cargos = 'Enfermeiro; Técnico de Enfermagem; Agente Indígena de Saúde (AIS)', vagas_total = 7,
         inscritos = 15, aptos_analise = 15, cancelados = 0, eliminados_nota = 0, reprovados_analise = 0,
         total_eliminados = 0, aprovados_analise = 0, aprovados_prova = 0, entrevistados = 0, contratados = 0,
         data_inicio = v_hoje - 45, data_fim = v_hoje + 30, status = 'Em andamento', etapa = 'Entrevistas',
         risco = 'Baixo', responsavel = 'Treinamento', ativo = true,
         status_override = null, etapa_override = null, status_override_motivo = null,
         status_override_data = null, status_override_previsao_retomada = null,
         updated_by = (select auth.uid()), updated_at = now()
   where id = p_edital and "ST_TREINAMENTO" = 'S';

  v_id := private."FC_PREPARAR_EDITAL_TREINAMENTO"(v_m."CO_AREA");
  if v_id is distinct from p_edital then
    raise exception 'O reinício não reencontrou o edital de treinamento' using errcode = 'P0001';
  end if;
  return json_build_object('edital', p_edital, 'apagados', v_apagados, 'reiniciado_em', now());
end;
$$;
comment on function public.reiniciar_edital_treinamento(uuid) is
  'Só admin global: volta o edital de TREINAMENTO (ST_TREINAMENTO = S) ao estado inicial — apaga fisicamente os dados dele (exceção documentada à exclusão lógica) e recria os fictícios. Edital real: 42501 e nada muda.';
revoke all on function public.reiniciar_edital_treinamento(uuid) from public, anon;
grant execute on function public.reiniciar_edital_treinamento(uuid) to authenticated, service_role;

-- ── 9. Cria o edital de treinamento da Saúde Indígena ──────────────────────
select private."FC_PREPARAR_EDITAL_TREINAMENTO"('saude-indigena');

notify pgrst, 'reload schema';

commit;
