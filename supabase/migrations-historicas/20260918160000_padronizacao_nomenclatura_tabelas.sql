-- Padronizacao de nomenclatura de tabelas - AgSUS
-- Referencia: padrao_nomenclatura_tabelas_agsus.pdf (PDTIC 2026-2027, Versao 1.0)
-- Escopo: item 6 (Tabelas) - prefixo por tipo, singular, MAIUSCULAS (item 3).
--
-- ATENCAO: nomes em MAIUSCULAS no PostgreSQL exigem aspas duplas em TODAS as
-- referencias, inclusive no PostgREST/supabase-js (.from('TB_...')).
-- Revise o impacto no frontend antes de aplicar.

begin;

-- ============================================================
-- 1. Renomeacao das tabelas
-- Policies, triggers, indices, FKs e views dependentes
-- acompanham o RENAME automaticamente.
-- ============================================================

alter table if exists public.analises_curriculares rename to "TB_ANALISE_CURRICULAR";
alter table if exists public.analises_curriculares_quarentena rename to "TA_ANALISE_QUARENTENA";
alter table if exists private.analises_dashboard_cache rename to "TA_DASHBOARD_ANALISE";
alter table if exists public.analises_editais rename to "TB_EDITAL_ANALISE";
alter table if exists public.analises_importacoes_bloqueadas rename to "TA_IMPORTACAO_BLOQUEADA";
alter table if exists public.analises_staging rename to "TM_ANALISE_CURRICULAR";
alter table if exists public.analises_sync_log rename to "TL_SYNC_ANALISE";
alter table if exists public.aya_bridge rename to "TB_BRIDGE_AYA";
alter table if exists public.configuracoes rename to "TB_CONFIGURACAO";
alter table if exists public.configuracoes_versoes rename to "TH_CONFIGURACAO";
alter table if exists public.dim_unidades rename to "TD_UNIDADE";
alter table if exists public.eventos_acesso rename to "TL_EVENTO_ACESSO";
alter table if exists public.historico_monitoramento rename to "TH_MONITORAMENTO";
alter table if exists public.lista_aprovados_candidatos rename to "TB_CANDIDATO_APROVADO";
alter table if exists public.lista_aprovados_historico rename to "TH_CANDIDATO_APROVADO";
alter table if exists public.listas_aprovados rename to "TB_LISTA_APROVADO";
alter table if exists public.log_notificacoes rename to "TL_NOTIFICACAO";
alter table if exists public.mapa_saude_indigena_config rename to "TB_CONFIG_MAPA_SAUDE_INDIG";
alter table if exists public.monitoramento_indigena rename to "TB_MONITORAMENTO_INDIGENA";
alter table if exists public.monitoramento_indigena_cronograma rename to "TB_CRONOGRAMA_MONIT_INDIG";
alter table if exists public.monitoramento_indigena_cronograma_versoes rename to "TH_CRONOGRAMA_MONIT_INDIG";
alter table if exists public.monitoramento_indigena_dashboard_staging rename to "TM_DASHBOARD_MONIT_INDIG";
alter table if exists public.monitoramento_indigena_sync_log rename to "TL_SYNC_MONIT_INDIGENA";
alter table if exists public.paineis_externos rename to "TB_PAINEL_EXTERNO";
alter table if exists public.perfis_paineis_externos rename to "RL_PERFIL_USUARIO_PAINEL_EXT";
alter table if exists public.perfis_usuarios rename to "TB_PERFIL_USUARIO";
alter table if exists public.presenca_online_monitora rename to "TB_PRESENCA_ONLINE_MONITORA";
alter table if exists public.solicitacoes_acesso rename to "TB_SOLICITACAO_ACESSO";
alter table if exists public.solicitacoes_acesso_paineis rename to "RL_SOLIC_ACESSO_PAINEL";

-- ============================================================
-- 2. Recriacao das views (o corpo SQL nao acompanha o RENAME)
-- ============================================================

create or replace view public.vw_analises_dashboard_base_todos as
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
        END AS edital_cadastro_status
   FROM "TB_ANALISE_CURRICULAR" a
     LEFT JOIN "TB_EDITAL_ANALISE" e ON e.grupo_norm = a.grupo_norm AND e.unidade_norm = a.unidade_norm AND e.edital_norm = a.edital_norm;

create or replace view public.vw_auditoria_acessos_diaria as
 SELECT (created_at AT TIME ZONE 'America/Sao_Paulo'::text)::date AS data_acesso,
    origem,
    tela,
    evento,
    count(*)::integer AS total_eventos,
    count(DISTINCT user_id)::integer AS usuarios_distintos,
    count(DISTINCT client_session_id)::integer AS sessoes_distintas,
    max(created_at) AS ultimo_evento
   FROM "TL_EVENTO_ACESSO"
  GROUP BY ((created_at AT TIME ZONE 'America/Sao_Paulo'::text)::date), origem, tela, evento;

create or replace view public.vw_monitoramento_indigena_kpis as
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
   FROM "TB_MONITORAMENTO_INDIGENA"
  WHERE ativo IS TRUE;

create or replace view public.vw_monitoramento_indigena_operacional as
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
    (estado.estado ->> 'dias_para_proxima'::text)::integer AS cronograma_dias_para_proxima
   FROM "TB_MONITORAMENTO_INDIGENA" m
     CROSS JOIN LATERAL get_monitoramento_cronograma_estado(m.id, CURRENT_DATE) estado(estado);

create or replace view public.vw_analises_dashboard_base as
 SELECT id,
    grupo,
    unidade,
    edital,
    codigo_vaga,
    nome_vaga,
    candidato,
    categoria,
    modalidade_concorrencia,
    status_consolidado,
    etapa,
    responsavel_analise,
    data_analise,
    nota_final_ajustada,
    pontuacao_escolaridade,
    pontuacao_cursos_aperfeicoamento,
    pontuacao_experiencia_profissional,
    pontuacao_criterio_etnico,
    experiencia_saude_indigena_total,
    experiencia_atencao_basica_total,
    analise,
    link_pdf,
    pdf_status,
    erro_pdf,
    origem_url,
    data_inicio_analise,
    data_fim_analise,
    data_validacao_status,
    updated_at,
    ultima_atualizacao,
    origem_arquivo_id,
    origem_planilha,
    pdf_gerado,
    data_geracao_pdf,
    pdf_file_id,
    pdf_ultima_tentativa,
    pdf_hash_origem,
    chave_natural,
    edital_ativo,
    edital_status,
    ativo,
    situacao_processo,
    edital_cadastro_ativo,
    edital_cadastro_status
   FROM vw_analises_dashboard_base_todos
  WHERE edital_ativo IS TRUE AND ativo IS TRUE;

create or replace view public.vw_monitoramento_indigena_por_edital as
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
   FROM vw_monitoramento_indigena_operacional
  WHERE ativo IS TRUE
  GROUP BY unidade, uf, edital, (COALESCE(ciclo, ''::text)), (COALESCE(etapa, ''::text)), (COALESCE(status, ''::text)), (COALESCE(risco, ''::text));

create or replace view public.vw_monitoramento_indigena_por_unidade as
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
   FROM vw_monitoramento_indigena_operacional
  WHERE ativo IS TRUE
  GROUP BY (COALESCE(id_unidade, ''::text)), (COALESCE(sigla_unidade, ''::text)), unidade, tipo_unidade, uf;

create or replace view public.vw_analises_dashboard_por_edital as
 SELECT grupo,
    unidade,
    edital,
    count(*)::integer AS total_candidatos,
    count(*) FILTER (WHERE status_consolidado = 'Pendente'::text)::integer AS pendentes,
    count(*) FILTER (WHERE status_consolidado = 'Revisar'::text)::integer AS revisar,
    count(*) FILTER (WHERE status_consolidado = 'Aprovado'::text)::integer AS aprovados,
    count(*) FILTER (WHERE status_consolidado = 'Reprovado'::text)::integer AS reprovados,
    count(*) FILTER (WHERE link_pdf IS NOT NULL AND btrim(link_pdf) <> ''::text)::integer AS com_pdf,
    count(*) FILTER (WHERE link_pdf IS NULL OR btrim(link_pdf) = ''::text)::integer AS sem_pdf,
    min(data_analise) AS primeira_analise,
    max(data_analise) AS ultima_analise,
    max(updated_at) AS updated_at
   FROM vw_analises_dashboard_base
  WHERE edital_ativo IS TRUE
  GROUP BY grupo, unidade, edital;

create or replace view public.vw_analises_kpis as
 SELECT count(*)::integer AS total_candidatos,
    count(*) FILTER (WHERE status_consolidado = 'Pendente'::text)::integer AS pendentes,
    count(*) FILTER (WHERE status_consolidado = 'Revisar'::text)::integer AS revisar,
    count(*) FILTER (WHERE status_consolidado = 'Aprovado'::text)::integer AS aprovados,
    count(*) FILTER (WHERE status_consolidado = 'Reprovado'::text)::integer AS reprovados,
    count(*) FILTER (WHERE status_consolidado = ANY (ARRAY['Revisar'::text, 'Aprovado'::text, 'Reprovado'::text]))::integer AS analisados,
    count(*) FILTER (WHERE link_pdf IS NOT NULL AND btrim(link_pdf) <> ''::text)::integer AS com_pdf,
    count(*) FILTER (WHERE link_pdf IS NULL OR btrim(link_pdf) = ''::text)::integer AS sem_pdf,
    count(*) FILTER (WHERE upper(COALESCE(pdf_status, ''::text)) = 'ERRO'::text)::integer AS pdf_com_erro,
    count(*) FILTER (WHERE data_validacao_status = 'FORA_PERIODO'::text)::integer AS fora_periodo,
    count(*) FILTER (WHERE data_validacao_status = 'SEM_JANELA'::text)::integer AS sem_janela,
    round(
        CASE
            WHEN count(*) > 0 THEN count(*) FILTER (WHERE status_consolidado = ANY (ARRAY['Aprovado'::text, 'Reprovado'::text]))::numeric / count(*)::numeric * 100::numeric
            ELSE 0::numeric
        END, 2) AS pct_decididos,
    max(ultima_atualizacao) AS ultima_atualizacao
   FROM vw_analises_dashboard_base
  WHERE edital_ativo IS TRUE;

create or replace view public.vw_analises_por_responsavel as
 SELECT COALESCE(NULLIF(btrim(responsavel_analise), ''::text), 'Sem responsavel'::text) AS responsavel_analise,
    count(*)::integer AS total,
    count(*) FILTER (WHERE status_consolidado = 'Pendente'::text)::integer AS pendentes,
    count(*) FILTER (WHERE status_consolidado = 'Revisar'::text)::integer AS revisar,
    count(*) FILTER (WHERE status_consolidado = 'Aprovado'::text)::integer AS aprovados,
    count(*) FILTER (WHERE status_consolidado = 'Reprovado'::text)::integer AS reprovados,
    count(*) FILTER (WHERE data_validacao_status = 'FORA_PERIODO'::text)::integer AS fora_periodo,
    count(*) FILTER (WHERE link_pdf IS NULL OR btrim(link_pdf) = ''::text)::integer AS sem_pdf,
    max(ultima_atualizacao) AS ultima_atualizacao
   FROM vw_analises_dashboard_base
  WHERE edital_ativo IS TRUE
  GROUP BY (COALESCE(NULLIF(btrim(responsavel_analise), ''::text), 'Sem responsavel'::text));

create or replace view public.vw_analises_tendencia_diaria as
 SELECT data_analise,
    count(*)::integer AS total_analises,
    count(*) FILTER (WHERE data_validacao_status = 'FORA_PERIODO'::text)::integer AS fora_periodo,
    count(*) FILTER (WHERE status_consolidado = 'Aprovado'::text)::integer AS aprovados,
    count(*) FILTER (WHERE status_consolidado = 'Reprovado'::text)::integer AS reprovados,
    count(*) FILTER (WHERE status_consolidado = 'Revisar'::text)::integer AS revisar
   FROM vw_analises_dashboard_base
  WHERE data_analise IS NOT NULL AND edital_ativo IS TRUE
  GROUP BY data_analise;

-- ============================================================
-- 3. Recriacao das funcoes (67 afetadas)
-- ============================================================

CREATE OR REPLACE FUNCTION private.bloquear_importacao_analises_configurada()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if exists (
    select 1
    from public."TA_IMPORTACAO_BLOQUEADA" b
    where b.grupo_norm = public.analises_norm_key(new.grupo)
      and b.unidade_norm = public.analises_norm_key(new.unidade)
      and b.edital_norm = public.analises_norm_key(new.edital)
  ) then
    return null;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.current_profile()
 RETURNS "TB_PERFIL_USUARIO"
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select p
  from public."TB_PERFIL_USUARIO" p
  where p.ativo = true
    and (
      p.user_id = auth.uid()
      or lower(p.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
    )
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION private.definir_fundo_acesso_monitora(p_url text DEFAULT NULL::text, p_caminho text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_url text := nullif(btrim(coalesce(p_url, '')), '');
  v_caminho text := nullif(btrim(coalesce(p_caminho, '')), '');
begin
  if not private.is_master() then
    raise exception 'Acesso restrito ao perfil Master.' using errcode = '42501';
  end if;
  if (v_url is null) <> (v_caminho is null) then
    raise exception 'Informe a URL e o caminho da arte em conjunto.' using errcode = '22023';
  end if;
  if v_url is not null and v_url not like 'https://%' then
    raise exception 'A imagem precisa ser servida por HTTPS.' using errcode = '22023';
  end if;
  if v_caminho is not null and v_caminho !~ '^branding/[A-Za-z0-9._-]+$' then
    raise exception 'Caminho de armazenamento invÃ¡lido.' using errcode = '22023';
  end if;

  insert into public."TB_CONFIGURACAO" (chave, valor, descricao)
  values
    ('auth_access_background_url', coalesce(v_url, ''), 'Arte institucional da tela de acesso'),
    ('auth_access_background_path', coalesce(v_caminho, ''), 'Caminho da arte de acesso no Supabase Storage')
  on conflict (chave) do update
  set valor = excluded.valor,
      descricao = excluded.descricao;

  return jsonb_build_object('url', v_url, 'caminho', v_caminho);
end;
$function$;

CREATE OR REPLACE FUNCTION private.diff_configuracoes_e_paineis(p_config_rows jsonb, p_paineis jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with config_input as (
    select
      r ->> 'chave' as chave,
      r ->> 'valor' as valor,
      r ->> 'descricao' as descricao
    from jsonb_array_elements(coalesce(p_config_rows, '[]'::jsonb)) r
    where nullif(r ->> 'chave', '') is not null
  ),
  config_changes as (
    select jsonb_build_object(
      'entidade', 'configuracao',
      'chave', i.chave,
      'rotulo', coalesce(nullif(i.descricao, ''), i.chave),
      'campo', 'valor',
      'antes', c.valor,
      'depois', i.valor
    ) as item
    from config_input i
    left join public."TB_CONFIGURACAO" c on c.chave = i.chave
    where c.valor is distinct from i.valor
  ),
  painel_input as (
    select
      nullif(r ->> 'id', '')::uuid as id,
      r ->> 'titulo' as titulo,
      r ->> 'url' as url,
      coalesce((r ->> 'ativo')::boolean, true) as ativo,
      coalesce((r ->> 'em_manutencao')::boolean, false) as em_manutencao
    from jsonb_array_elements(coalesce(p_paineis, '[]'::jsonb)) r
    where nullif(r ->> 'id', '') is not null
  ),
  painel_fields as (
    select p.id, p.codigo, p.titulo as painel_titulo, f.campo, f.antes, f.depois
    from painel_input i
    join public."TB_PAINEL_EXTERNO" p on p.id = i.id
    cross join lateral (
      values
        ('titulo'::text, to_jsonb(p.titulo), to_jsonb(i.titulo)),
        ('url'::text, to_jsonb(p.url), to_jsonb(i.url)),
        ('ativo'::text, to_jsonb(p.ativo), to_jsonb(i.ativo)),
        ('em_manutencao'::text, to_jsonb(p.em_manutencao), to_jsonb(i.em_manutencao))
    ) as f(campo, antes, depois)
    where f.antes is distinct from f.depois
  ),
  painel_changes as (
    select jsonb_build_object(
      'entidade', 'painel',
      'chave', id,
      'codigo', codigo,
      'rotulo', coalesce(nullif(painel_titulo, ''), codigo),
      'campo', campo,
      'antes', antes,
      'depois', depois
    ) as item
    from painel_fields
  ),
  all_changes as (
    select item from config_changes
    union all
    select item from painel_changes
  )
  select coalesce(jsonb_agg(item), '[]'::jsonb)
  from all_changes;
$function$;

CREATE OR REPLACE FUNCTION private.has_perm(p_perm text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public."TB_PERFIL_USUARIO" p
    where p.ativo is true
      and (
        p.user_id = auth.uid()
        or lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
      and (
        lower(coalesce(p.perfil, '')) = 'master'
        or case lower(coalesce(p_perm, ''))
          when 'ind' then coalesce(p.p_ind, false)
          when 'cores' then coalesce(p.p_cores, false)
          when 'paineis' then coalesce(p.p_paineis, false)
          when 'config' then coalesce(p.p_config, false)
          when 'admin' then coalesce(p.p_admin, false)
          else false
        end
      )
  );
$function$;

CREATE OR REPLACE FUNCTION private.is_master()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public."TB_PERFIL_USUARIO" p
    where p.ativo is true
      and lower(coalesce(p.perfil, '')) = 'admin'
      and (
        p.user_id = (select auth.uid())
        or lower(p.email) =
           lower(coalesce((select auth.jwt() ->> 'email'), ''))
      )
  );
$function$;

CREATE OR REPLACE FUNCTION private.monitora_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case lower(coalesce(p.perfil, ''))
    when 'master' then 'admin'
    when 'admin' then 'admin'
    when 'editor' then 'edital_gestor'
    when 'edital_gestor' then 'edital_gestor'
    when 'contratador' then 'contratador'
    when 'leitor' then 'usuario'
    when 'usuario' then 'usuario'
    else ''
  end
  from public."TB_PERFIL_USUARIO" p
  where p.ativo is true
    and (
      p.user_id = (select auth.uid())
      or lower(p.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
    )
  order by case when p.user_id = (select auth.uid()) then 0 else 1 end,
           p.updated_at desc nulls last
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION private.snapshot_configuracoes()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'chave', c.chave,
        'valor', c.valor,
        'descricao', c.descricao
      ) order by c.chave
    ),
    '[]'::jsonb
  )
  from public."TB_CONFIGURACAO" c;
$function$;

CREATE OR REPLACE FUNCTION private.snapshot_monitoramento_cronograma(p_monitoramento_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'ordem', c.ordem,
    'atividade', c.atividade,
    'tipo_atividade', c.tipo_atividade,
    'data_inicio', c.data_inicio,
    'data_fim', c.data_fim,
    'concluida', c.concluida,
    'observacao', c.observacao,
    'origem', c.origem
  ) order by c.ordem), '[]'::jsonb)
  from public."TB_CRONOGRAMA_MONIT_INDIG" c
  where c.monitoramento_id = p_monitoramento_id;
$function$;

CREATE OR REPLACE FUNCTION private.snapshot_paineis_externos()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'codigo', p.codigo,
        'titulo', p.titulo,
        'url', p.url,
        'ativo', p.ativo,
        'em_manutencao', p.em_manutencao,
        'icone', p.icone,
        'ordem', p.ordem,
        'tipo_abertura', p.tipo_abertura
      ) order by p.ordem, p.codigo
    ),
    '[]'::jsonb
  )
  from public."TB_PAINEL_EXTERNO" p;
$function$;

CREATE OR REPLACE FUNCTION public.alterar_status_candidato_aprovado(p_candidato_id uuid, p_status text, p_processo_sei text DEFAULT NULL::text, p_matricula text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text := private.monitora_role();
  v_candidato public."TB_CANDIDATO_APROVADO"%rowtype;
  v_lista public."TB_LISTA_APROVADO"%rowtype;
  v_status text := nullif(btrim(coalesce(p_status, '')), '');
  v_matricula text := nullif(btrim(coalesce(p_matricula, '')), '');
begin
  if v_role not in ('contratador', 'admin') then raise exception 'Perfil sem permissao para alterar status'; end if;
  if v_status is not null and v_status not in ('Contratado', 'Desistente', 'MigraÃ§Ã£o', 'DocumentaÃ§Ã£o Rejeitada') then
    raise exception 'Status invalido';
  end if;
  if v_status in ('Contratado', 'MigraÃ§Ã£o') and v_matricula is null then
    raise exception 'Matricula obrigatoria para Contratado ou Migracao';
  end if;

  select * into v_candidato
  from public."TB_CANDIDATO_APROVADO"
  where id = p_candidato_id and removido_em is null
  for update;
  if not found then raise exception 'Candidato nao encontrado'; end if;

  select * into v_lista
  from public."TB_LISTA_APROVADO"
  where id = v_candidato.lista_id and vigente is true
  for update;
  if not found then raise exception 'Lista vigente nao encontrada'; end if;
  if not v_lista.ativo then raise exception 'A lista esta inativa e nao permite alterar candidatos'; end if;

  insert into public."TH_CANDIDATO_APROVADO"(
    candidato_id, lista_id, status_anterior, status_novo, processo_sei, matricula, alterado_por
  ) values (
    v_candidato.id, v_candidato.lista_id, v_candidato.status, v_status,
    nullif(btrim(coalesce(p_processo_sei, '')), ''), v_matricula, (select auth.uid())
  );

  update public."TB_CANDIDATO_APROVADO"
  set status = v_status,
      processo_sei = nullif(btrim(coalesce(p_processo_sei, '')), ''),
      matricula = case when v_status in ('Contratado', 'MigraÃ§Ã£o') then v_matricula else null end,
      updated_by = (select auth.uid()), updated_at = now()
  where id = v_candidato.id;

  return jsonb_build_object('ok', true, 'candidato_id', v_candidato.id, 'status', v_status, 'matricula', v_matricula);
end;
$function$;

CREATE OR REPLACE FUNCTION public.analises_sync_guard_before_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_active record;
begin
  if coalesce(new.origem, '') ilike '%analises%'
     and coalesce(new.status, 'iniciado') in ('iniciado', 'carregado', 'processando') then

    update public."TL_SYNC_ANALISE" l
    set status = 'erro',
        finished_at = now(),
        updated_at = now(),
        erro = coalesce(l.erro, 'Carga de analises marcada como erro automaticamente por expirar sem finalizacao.'),
        mensagem = coalesce(l.mensagem, 'Carga anterior expirada; liberada para permitir nova sincronizacao.'),
        resultado = coalesce(l.resultado, '{}'::jsonb) || jsonb_build_object(
          'ok', false,
          'auto_expired', true,
          'expired_at', now(),
          'previous_status', l.status
        )
    where coalesce(l.origem, '') ilike '%analises%'
      and l.finished_at is null
      and (
        (l.status in ('carregado', 'processando') and l.updated_at < now() - interval '15 minutes')
        or (l.status = 'iniciado' and l.created_at < now() - interval '45 minutes')
      );

    select l.sync_id, l.status, l.created_at
      into v_active
    from public."TL_SYNC_ANALISE" l
    where coalesce(l.origem, '') ilike '%analises%'
      and l.status in ('iniciado', 'carregado', 'processando')
      and l.created_at >= now() - interval '45 minutes'
      and l.finished_at is null
    order by l.created_at desc
    limit 1;

    if found then
      raise exception 'Ja existe uma carga de analises em andamento (sync_id %, status %, criada em %). Aguarde finalizar antes de iniciar outra.',
        v_active.sync_id, v_active.status, v_active.created_at
        using errcode = '55P03';
    end if;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.aprovar_solicitacao_acesso(p_solicitacao_id uuid, p_perfil text DEFAULT 'usuario'::text, p_permissoes jsonb DEFAULT '{}'::jsonb, p_paineis uuid[] DEFAULT '{}'::uuid[], p_observacao_admin text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_req public."TB_SOLICITACAO_ACESSO"%rowtype;
  v_perfil_id uuid;
  v_perfil text := lower(nullif(btrim(coalesce(p_perfil, '')), ''));
  v_admin boolean;
begin
  if (select auth.uid()) is null then raise exception 'Usuario nao autenticado'; end if;
  if not private.is_master() then raise exception 'Somente perfil admin pode aprovar solicitacao de acesso'; end if;
  if v_perfil not in ('usuario', 'edital_gestor', 'contratador', 'admin') then
    raise exception 'Perfil invalido: %', v_perfil;
  end if;
  v_admin := v_perfil = 'admin';

  select * into v_req
  from public."TB_SOLICITACAO_ACESSO"
  where id = p_solicitacao_id
  for update;
  if not found then raise exception 'Solicitacao de acesso nao encontrada'; end if;

  select id into v_perfil_id
  from public."TB_PERFIL_USUARIO"
  where (v_req.user_id is not null and user_id = v_req.user_id)
     or lower(email) = lower(v_req.email)
  order by case when user_id = v_req.user_id then 0 else 1 end, updated_at desc
  limit 1
  for update;

  if v_perfil_id is null then
    insert into public."TB_PERFIL_USUARIO"(
      user_id,email,nome,perfil,ativo,p_ind,p_cores,p_paineis,p_config,p_admin
    ) values (
      v_req.user_id, v_req.email,
      coalesce(nullif(btrim(v_req.nome), ''), v_req.email),
      v_perfil, true, true, true, true, v_admin, v_admin
    ) returning id into v_perfil_id;
  else
    update public."TB_PERFIL_USUARIO"
    set user_id = coalesce(public."TB_PERFIL_USUARIO".user_id, v_req.user_id),
        email = v_req.email,
        nome = coalesce(nullif(btrim(v_req.nome), ''), public."TB_PERFIL_USUARIO".nome, v_req.email),
        perfil = v_perfil,
        ativo = true,
        p_ind = true,
        p_cores = true,
        p_paineis = true,
        p_config = v_admin,
        p_admin = v_admin,
        updated_at = now()
    where id = v_perfil_id;
  end if;

  delete from public."RL_PERFIL_USUARIO_PAINEL_EXT" where perfil_usuario_id = v_perfil_id;
  insert into public."RL_PERFIL_USUARIO_PAINEL_EXT"(perfil_usuario_id, painel_id, ativo)
  select v_perfil_id, pe.id, true
  from public."TB_PAINEL_EXTERNO" pe
  where pe.ativo is true
  on conflict (perfil_usuario_id, painel_id) do update
    set ativo = true, updated_at = now();

  update public."TB_SOLICITACAO_ACESSO"
  set status = 'aprovado', avaliado_por = (select auth.uid()), avaliado_em = now(),
      observacao_admin = nullif(btrim(p_observacao_admin), ''), updated_at = now()
  where id = v_req.id;

  return jsonb_build_object('ok', true, 'perfil_usuario_id', v_perfil_id, 'perfil', v_perfil);
end;
$function$;

CREATE OR REPLACE FUNCTION public.atualizar_acesso_usuario(p_perfil_usuario_id uuid, p_perfil text DEFAULT 'usuario'::text, p_permissoes jsonb DEFAULT '{}'::jsonb, p_paineis uuid[] DEFAULT '{}'::uuid[], p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_perfil text := lower(nullif(btrim(coalesce(p_perfil, '')), ''));
  v_admin boolean;
  v_email text;
begin
  if (select auth.uid()) is null then raise exception 'Usuario nao autenticado'; end if;
  if not private.is_master() then raise exception 'Somente perfil admin pode atualizar acesso de usuario'; end if;
  if v_perfil not in ('usuario', 'edital_gestor', 'contratador', 'admin') then
    raise exception 'Perfil invalido: %', v_perfil;
  end if;
  if p_perfil_usuario_id is null then raise exception 'Perfil de usuario nao informado'; end if;
  v_admin := v_perfil = 'admin';

  update public."TB_PERFIL_USUARIO"
  set perfil = v_perfil, ativo = true, p_ind = true, p_cores = true, p_paineis = true,
      p_config = v_admin, p_admin = v_admin, updated_at = now()
  where id = p_perfil_usuario_id
  returning email into v_email;
  if not found then raise exception 'Perfil de usuario nao encontrado'; end if;

  delete from public."RL_PERFIL_USUARIO_PAINEL_EXT" where perfil_usuario_id = p_perfil_usuario_id;
  insert into public."RL_PERFIL_USUARIO_PAINEL_EXT"(perfil_usuario_id, painel_id, ativo)
  select p_perfil_usuario_id, pe.id, true
  from public."TB_PAINEL_EXTERNO" pe
  where pe.ativo is true
  on conflict (perfil_usuario_id, painel_id) do update
    set ativo = true, updated_at = now();

  return jsonb_build_object(
    'ok', true, 'perfil_usuario_id', p_perfil_usuario_id, 'email', v_email,
    'perfil', v_perfil, 'motivo', nullif(btrim(p_motivo), '')
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.atualizar_indicadores_dashboard(p_sync_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_lidos integer := 0;
  v_atualizados integer := 0;
  v_sem_match integer := 0;
  v_result jsonb;
begin
  select count(*) into v_lidos
  from public."TM_DASHBOARD_MONIT_INDIG"
  where sync_id = p_sync_id;

  with numeric_agg as (
    select
      sync_id,
      edital,
      max(nullif(unidade_normalizada, '')) as unidade_normalizada,
      sum(inscritos)::integer as inscritos,
      sum(aptos_analise)::integer as aptos_analise,
      sum(cancelados)::integer as cancelados,
      sum(eliminados_nota)::integer as eliminados_nota,
      sum(reprovados_analise)::integer as reprovados_analise,
      sum(total_eliminados)::integer as total_eliminados,
      sum(aprovados_analise)::integer as aprovados_analise,
      sum(aprovados_prova)::integer as aprovados_prova,
      sum(entrevistados)::integer as entrevistados,
      sum(contratados)::integer as contratados,
      string_agg(distinct nullif(observacoes_origem, ''), ' | ') filter (where nullif(observacoes_origem, '') is not null) as observacoes
    from public."TM_DASHBOARD_MONIT_INDIG"
    where sync_id = p_sync_id
    group by sync_id, edital
  ), cargo_agg as (
    select
      s.sync_id,
      s.edital,
      string_agg(distinct c.cargo, ' | ' order by c.cargo) filter (where c.cargo is not null and c.cargo <> '') as cargos
    from public."TM_DASHBOARD_MONIT_INDIG" s
    left join lateral jsonb_array_elements_text(coalesce(s.cargos_json, '[]'::jsonb)) as c(cargo) on true
    where s.sync_id = p_sync_id
    group by s.sync_id, s.edital
  ), agg as (
    select n.*, c.cargos
    from numeric_agg n
    left join cargo_agg c
      on c.sync_id = n.sync_id
     and c.edital = n.edital
  ), updated as (
    update public."TB_MONITORAMENTO_INDIGENA" m
    set
      -- ATENCAO: vagas_total representa Vagas Imediatas Previstas e e campo manual/Equipe Nucleo.
      -- A carga automatica NAO altera vagas_total.
      inscritos = coalesce(a.inscritos, 0),
      aptos_analise = coalesce(a.aptos_analise, 0),
      cancelados = coalesce(a.cancelados, 0),
      eliminados_nota = coalesce(a.eliminados_nota, 0),
      reprovados_analise = coalesce(a.reprovados_analise, 0),
      total_eliminados = coalesce(a.total_eliminados, 0),
      aprovados_analise = coalesce(a.aprovados_analise, 0),
      aprovados_prova = coalesce(a.aprovados_prova, 0),
      entrevistados = coalesce(a.entrevistados, 0),
      contratados = coalesce(a.contratados, 0),
      cargos = coalesce(nullif(a.cargos, ''), m.cargos),
      observacoes = coalesce(nullif(a.observacoes, ''), m.observacoes),
      updated_at = now()
    from agg a
    where m.edital = a.edital
      and m.ativo = true
    returning m.edital
  )
  select count(*) into v_atualizados from updated;

  select greatest(count(*) - v_atualizados, 0) into v_sem_match
  from (
    select distinct edital
    from public."TM_DASHBOARD_MONIT_INDIG"
    where sync_id = p_sync_id
  ) e;

  v_result := jsonb_build_object(
    'ok', true,
    'sync_id', p_sync_id,
    'linhas_lidas', v_lidos,
    'editais_atualizados', v_atualizados,
    'editais_sem_match', v_sem_match,
    'preservou_vagas_total', true
  );

  update public."TL_SYNC_MONIT_INDIGENA"
  set status = 'processado',
      linhas_processadas = v_lidos,
      total_atualizados = v_atualizados,
      total_sem_match = v_sem_match,
      resultado = v_result,
      erro = null,
      finished_at = now(),
      updated_at = now()
  where sync_id = p_sync_id;

  delete from public."TM_DASHBOARD_MONIT_INDIG"
  where sync_id = p_sync_id;

  delete from public."TM_DASHBOARD_MONIT_INDIG"
  where created_at < now() - interval '7 days';

  return v_result;
exception when others then
  update public."TL_SYNC_MONIT_INDIGENA"
  set status = 'erro',
      erro = sqlerrm,
      finished_at = now(),
      updated_at = now()
  where sync_id = p_sync_id;
  raise;
end;
$function$;

CREATE OR REPLACE FUNCTION public.comparar_analises_incremental(p_itens jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
 SET statement_timeout TO '10s'
 SET lock_timeout TO '1s'
AS $function$
declare
  v_total integer;
  v_invalidos integer;
  v_alterados integer;
  v_linhas jsonb;
begin
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' then
    raise exception 'p_itens deve ser um array JSON.';
  end if;
  v_total := jsonb_array_length(p_itens);
  if v_total > 500 then raise exception 'Maximo de 500 itens por comparacao.'; end if;
  if v_total = 0 then return jsonb_build_object('ok',true,'total',0,'alterados',0,'linhas_alteradas','[]'::jsonb); end if;

  with itens as (
    select value as j
    from jsonb_array_elements(p_itens)
  )
  select count(*)::integer into v_invalidos
  from itens
  where coalesce(j->>'linha_origem','') !~ '^[1-9][0-9]*$'
     or nullif(btrim(j->>'chave_natural'),'') is null
     or nullif(btrim(j->>'hash_registro'),'') is null;
  if v_invalidos > 0 then raise exception 'Manifesto incremental contem % item(ns) invalido(s).',v_invalidos; end if;

  with itens as (
    select (j->>'linha_origem')::integer as linha_origem,
           j->>'chave_natural' as chave_natural,
           j->>'hash_registro' as hash_registro
    from jsonb_array_elements(p_itens) j
  ), diffs as (
    select i.linha_origem
    from itens i
    left join public."TB_ANALISE_CURRICULAR" a on a.chave_natural=i.chave_natural
    where a.id is null
       or a.hash_registro is distinct from i.hash_registro
       or a.ativo is not true
  )
  select count(*)::integer,
         coalesce(jsonb_agg(linha_origem order by linha_origem),'[]'::jsonb)
    into v_alterados,v_linhas
  from diffs;

  return jsonb_build_object('ok',true,'total',v_total,'alterados',v_alterados,'linhas_alteradas',v_linhas);
end;
$function$;

CREATE OR REPLACE FUNCTION public.definir_lista_aprovados_ativa(p_lista_id uuid, p_ativo boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text := private.monitora_role();
  v_edital_id text;
begin
  if v_role not in ('edital_gestor', 'contratador', 'admin') then
    raise exception 'Perfil sem permissao para alterar a lista';
  end if;
  update public."TB_LISTA_APROVADO"
  set ativo = coalesce(p_ativo, false), updated_at = now()
  where id = p_lista_id and vigente is true
  returning edital_id into v_edital_id;
  if not found then raise exception 'Lista vigente nao encontrada'; end if;
  return jsonb_build_object('ok', true, 'lista_id', p_lista_id, 'edital_id', v_edital_id, 'ativo', coalesce(p_ativo, false));
end;
$function$;

CREATE OR REPLACE FUNCTION public.definir_segredo_bridge_aya(p_chave text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '3s'
AS $function$
declare
  v_existente text;
begin
  if p_chave is null or length(btrim(p_chave)) < 24 then
    return 'recusado: a chave precisa de ao menos 24 caracteres';
  end if;

  select b.chave_sha256 into v_existente from public."TB_BRIDGE_AYA" as b where b.id;

  if v_existente is not null then
    return 'recusado: o segredo ja esta definido';
  end if;

  update public."TB_BRIDGE_AYA"
     set chave_sha256 = encode(sha256(convert_to(p_chave, 'UTF8')), 'hex')
   where id;

  return 'definido';
end;
$function$;

CREATE OR REPLACE FUNCTION public.desativar_acesso_usuario(p_perfil_usuario_id uuid, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private', 'auth'
AS $function$
declare
  v_email text;
  v_nome text;
  v_paineis integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if not private.is_master() then
    raise exception 'Somente perfil master pode desativar acesso';
  end if;

  if p_perfil_usuario_id is null then
    raise exception 'Perfil de usuario nao informado';
  end if;

  update public."TB_PERFIL_USUARIO"
  set ativo = false,
      p_ind = false,
      p_cores = false,
      p_paineis = false,
      p_config = false,
      p_admin = false,
      updated_at = now()
  where id = p_perfil_usuario_id
    and coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid) <> auth.uid()
  returning email, nome into v_email, v_nome;

  if not found then
    raise exception 'Perfil de usuario nao encontrado ou tentativa de auto-desativacao';
  end if;

  update public."RL_PERFIL_USUARIO_PAINEL_EXT"
  set ativo = false,
      updated_at = now()
  where perfil_usuario_id = p_perfil_usuario_id
    and ativo is true;
  get diagnostics v_paineis = row_count;

  return jsonb_build_object('ok', true, 'perfil_usuario_id', p_perfil_usuario_id, 'email', v_email, 'nome', v_nome, 'paineis_revogados', v_paineis, 'motivo', nullif(btrim(p_motivo), ''));
end;
$function$;

CREATE OR REPLACE FUNCTION public.diagnostico_agsus_monitora()
 RETURNS TABLE(objeto text, quantidade bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select '"TB_PERFIL_USUARIO"', count(*) from public."TB_PERFIL_USUARIO"
  union all select '"TB_CONFIGURACAO"', count(*) from public."TB_CONFIGURACAO"
  union all select '"TB_PAINEL_EXTERNO"', count(*) from public."TB_PAINEL_EXTERNO"
  union all select '"TD_UNIDADE"', count(*) from public."TD_UNIDADE"
  union all select '"TB_MONITORAMENTO_INDIGENA"', count(*) from public."TB_MONITORAMENTO_INDIGENA"
  union all select '"TB_EDITAL_ANALISE"', count(*) from public."TB_EDITAL_ANALISE"
  union all select '"TB_ANALISE_CURRICULAR"', count(*) from public."TB_ANALISE_CURRICULAR"
  union all select '"TL_EVENTO_ACESSO"', count(*) from public."TL_EVENTO_ACESSO"
  union all select '"TL_SYNC_ANALISE"', count(*) from public."TL_SYNC_ANALISE";
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
  v_removido integer:=0;
  v_total_ativos_local integer:=0;
  v_result jsonb;
begin
  if p_sync_id is null then raise exception 'p_sync_id obrigatorio'; end if;
  if not pg_try_advisory_xact_lock(hashtext('public.processar_sync_analises')::bigint) then
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
    select *,row_number() over(partition by grupo,unidade,edital order by coalesce(linha_origem,2147483647),id) rn
    from x
  )
  select grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise
  from ranked where rn=1;

  insert into public."TB_EDITAL_ANALISE"(grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise)
  select grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise
  from tmp_editais_incremental
  on conflict(grupo,unidade,edital) do update set
    ativo=excluded.ativo,
    data_inicio_analise=excluded.data_inicio_analise,
    data_fim_analise=excluded.data_fim_analise,
    updated_at=now();
  get diagnostics v_editais_upsert=row_count;

  update public."TB_EDITAL_ANALISE" e
  set ativo=false,updated_at=now()
  where e.ativo is true
    and not exists(select 1 from tmp_editais_incremental x
      where e.grupo is not distinct from x.grupo
        and e.unidade=x.unidade
        and e.edital=x.edital);
  get diagnostics v_editais_inativados=row_count;

  delete from public."TM_ANALISE_CURRICULAR" where sync_id=p_sync_id;
  get diagnostics v_removido=row_count;

  v_result=jsonb_build_object(
    'ok',true,
    'sync_id',p_sync_id,
    'modo_processamento','incremental',
    'total_ativos_local',v_total_ativos_local,
    'fato_analises_enviadas',v_total_fato,
    'analises_editais_recebidos',v_total_editais,
    'analises_editais_upsert',v_editais_upsert,
    'analises_editais_inativados',v_editais_inativados,
    'staging',v_total_staging,
    'staging_removido',v_removido,
    'historico_inativado',0
  );

  update public."TL_SYNC_ANALISE"
  set status='processado',resultado=v_result,erro=null,total_processados=v_total_fato,
      finished_at=now(),updated_at=now()
  where sync_id=p_sync_id and modo='INCREMENTAL_ACTIVE';

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.finalizar_sync_analises_lotes(p_sync_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
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
begin
  if p_sync_id is null then raise exception 'p_sync_id obrigatorio'; end if;
  if not pg_try_advisory_xact_lock(hashtext('public.processar_sync_analises')::bigint) then
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

  update public."TB_ANALISE_CURRICULAR" a
  set ativo=false,updated_at=now()
  where a.ativo is true
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
    insert into public."TB_EDITAL_ANALISE"(grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise)
    select grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise
    from tmp_editais
    on conflict(grupo,unidade,edital) do update set
      ativo=excluded.ativo,
      data_inicio_analise=excluded.data_inicio_analise,
      data_fim_analise=excluded.data_fim_analise,
      updated_at=now();
    get diagnostics v_editais=row_count;

    update public."TB_EDITAL_ANALISE" e
    set ativo=false,updated_at=now()
    where e.ativo is true
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

CREATE OR REPLACE FUNCTION public.fn_registrar_historico()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_usuario_id    uuid;
  v_usuario_email text;
  v_evento        text;
begin
  v_usuario_id := auth.uid();

  if v_usuario_id is not null then
    select u.email
      into v_usuario_email
    from auth.users u
    where u.id = v_usuario_id
    limit 1;
  end if;

  if TG_OP = 'INSERT' then
    v_evento := 'criado';

    insert into public."TH_MONITORAMENTO"
      (id_registro, usuario_id, usuario_email, evento, snapshot_json)
    values
      (NEW.id, v_usuario_id, v_usuario_email, v_evento, to_jsonb(NEW));

  elsif TG_OP = 'UPDATE' then
    if OLD is distinct from NEW then
      v_evento := case
        when NEW.ativo = false and OLD.ativo = true then 'desativado'
        else 'atualizado'
      end;

      insert into public."TH_MONITORAMENTO"
        (id_registro, usuario_id, usuario_email, evento, snapshot_json)
      values
        (NEW.id, v_usuario_id, v_usuario_email, v_evento, to_jsonb(NEW));
    end if;
  end if;

  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_acessos_config_master(p_online_minutes integer DEFAULT 15, p_recent_limit integer DEFAULT 20, p_days integer DEFAULT 14)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
 SET statement_timeout TO '5s'
 SET lock_timeout TO '2s'
AS $function$
declare
  v_online_minutes integer := least(greatest(coalesce(p_online_minutes, 15), 1), 120);
  v_recent_limit integer := least(greatest(coalesce(p_recent_limit, 20), 1), 100);
  v_days integer := least(greatest(coalesce(p_days, 14), 1), 90);
  v_is_master boolean;
  v_result jsonb;
begin
  select exists (
    select 1
    from public."TB_PERFIL_USUARIO" p
    where p.ativo is true
      and lower(coalesce(p.perfil, '')) = 'master'
      and (
        p.user_id = auth.uid()
        or lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  ) into v_is_master;

  if not coalesce(v_is_master, false) then
    raise exception 'Sem permissao para visualizar acessos do sistema';
  end if;

  with params as (
    select
      now() as agora_utc,
      now() at time zone 'America/Sao_Paulo' as agora_sp,
      make_interval(mins => v_online_minutes) as janela_online,
      make_interval(days => v_days) as janela_dias
  ),
  resumo_base as (
    select
      (select count(*) from auth.users where deleted_at is null) as usuarios_auth_total,
      (select count(*) from public."TB_PERFIL_USUARIO") as perfis_total,
      (select count(*) from public."TB_PERFIL_USUARIO" where ativo is true) as perfis_ativos,
      (select count(*) from public."TL_EVENTO_ACESSO") as eventos_total,
      (select count(distinct user_id) from public."TL_EVENTO_ACESSO" where user_id is not null) as usuarios_com_evento_total,
      (
        select count(distinct user_id)
        from public."TL_EVENTO_ACESSO"
        where user_id is not null
          and (created_at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date
      ) as usuarios_unicos_hoje,
      (
        select count(*)
        from public."TL_EVENTO_ACESSO"
        where (created_at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date
      ) as eventos_hoje,
      (
        select count(distinct user_id)
        from public."TL_EVENTO_ACESSO", params
        where user_id is not null
          and created_at >= params.agora_utc - params.janela_online
      ) as usuarios_online
  ),
  resumo as (
    select jsonb_build_object(
      'usuarios_auth_total', usuarios_auth_total,
      'perfis_total', perfis_total,
      'perfis_ativos', perfis_ativos,
      'eventos_total', eventos_total,
      'usuarios_com_evento_total', usuarios_com_evento_total,
      'usuarios_unicos_hoje', usuarios_unicos_hoje,
      'usuarios_hoje', usuarios_unicos_hoje,
      'eventos_hoje', eventos_hoje,
      'usuarios_online', usuarios_online,
      'online_agora', usuarios_online,
      'janela_online_minutos', v_online_minutes,
      'retencao_heartbeat_dias', 30,
      'retencao_eventos_dias', 365
    ) as dados
    from resumo_base
  ),
  online as (
    select coalesce(jsonb_agg(to_jsonb(t) order by t.ultima_atividade desc), '[]'::jsonb) as dados
    from (
      select
        e.user_id,
        coalesce(p.nome, u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', u.email) as nome,
        coalesce(p.email, u.email) as email,
        p.perfil,
        max(e.created_at) as ultima_atividade,
        max(e.created_at) as ultimo_acesso,
        max(e.created_at) at time zone 'America/Sao_Paulo' as ultima_atividade_sp,
        max(e.created_at) at time zone 'America/Sao_Paulo' as ultimo_acesso_sp,
        (array_agg(case
          when e.tela is null or btrim(e.tela) = '' then coalesce(e.evento, '-')
          when e.tela = 'dashboard' then 'Dashboard'
          when e.tela = 'config' then 'ConfiguraÃ§Ãµes'
          when e.tela = 'nucleo' then 'Equipe NÃºcleo'
          when e.tela = 'analises' then 'AnÃ¡lises'
          when e.tela = 'oauth' then 'Login Google'
          when e.tela = 'panel:analises' then 'Painel: AnÃ¡lises'
          when e.tela like 'panel:%' then 'Painel: ' || initcap(replace(substring(e.tela from 7), '_', ' '))
          else initcap(replace(e.tela, '_', ' '))
        end order by e.created_at desc))[1] as ultimo_evento,
        (array_agg(e.evento order by e.created_at desc))[1] as tipo_ultimo_evento,
        (array_agg(e.tela order by e.created_at desc))[1] as ultima_tela,
        (array_agg(case
          when e.tela is null or btrim(e.tela) = '' then coalesce(e.evento, '-')
          when e.tela = 'dashboard' then 'Dashboard'
          when e.tela = 'config' then 'ConfiguraÃ§Ãµes'
          when e.tela = 'nucleo' then 'Equipe NÃºcleo'
          when e.tela = 'analises' then 'AnÃ¡lises'
          when e.tela = 'oauth' then 'Login Google'
          when e.tela = 'panel:analises' then 'Painel: AnÃ¡lises'
          when e.tela like 'panel:%' then 'Painel: ' || initcap(replace(substring(e.tela from 7), '_', ' '))
          else initcap(replace(e.tela, '_', ' '))
        end order by e.created_at desc))[1] as tela_atual,
        count(*) as eventos_na_janela,
        count(*) as eventos_online
      from public."TL_EVENTO_ACESSO" e
      join params on true
      left join auth.users u on u.id = e.user_id
      left join public."TB_PERFIL_USUARIO" p on p.user_id = e.user_id
      where e.user_id is not null
        and e.created_at >= params.agora_utc - params.janela_online
      group by e.user_id, p.nome, p.email, p.perfil, u.email, u.raw_user_meta_data
      order by max(e.created_at) desc
      limit v_recent_limit
    ) t
  ),
  recentes as (
    select coalesce(jsonb_agg(to_jsonb(t) order by t.ultima_atividade desc), '[]'::jsonb) as dados
    from (
      select
        e.user_id,
        coalesce(p.nome, u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', u.email) as nome,
        coalesce(p.email, u.email) as email,
        p.perfil,
        p.ativo,
        max(e.created_at) as ultima_atividade,
        max(e.created_at) as ultimo_acesso,
        max(e.created_at) at time zone 'America/Sao_Paulo' as ultima_atividade_sp,
        max(e.created_at) at time zone 'America/Sao_Paulo' as ultimo_acesso_sp,
        (array_agg(case
          when e.tela is null or btrim(e.tela) = '' then coalesce(e.evento, '-')
          when e.tela = 'dashboard' then 'Dashboard'
          when e.tela = 'config' then 'ConfiguraÃ§Ãµes'
          when e.tela = 'nucleo' then 'Equipe NÃºcleo'
          when e.tela = 'analises' then 'AnÃ¡lises'
          when e.tela = 'oauth' then 'Login Google'
          when e.tela = 'panel:analises' then 'Painel: AnÃ¡lises'
          when e.tela like 'panel:%' then 'Painel: ' || initcap(replace(substring(e.tela from 7), '_', ' '))
          else initcap(replace(e.tela, '_', ' '))
        end order by e.created_at desc))[1] as ultimo_evento,
        (array_agg(e.evento order by e.created_at desc))[1] as tipo_ultimo_evento,
        (array_agg(e.tela order by e.created_at desc))[1] as ultima_tela,
        (array_agg(case
          when e.tela is null or btrim(e.tela) = '' then coalesce(e.evento, '-')
          when e.tela = 'dashboard' then 'Dashboard'
          when e.tela = 'config' then 'ConfiguraÃ§Ãµes'
          when e.tela = 'nucleo' then 'Equipe NÃºcleo'
          when e.tela = 'analises' then 'AnÃ¡lises'
          when e.tela = 'oauth' then 'Login Google'
          when e.tela = 'panel:analises' then 'Painel: AnÃ¡lises'
          when e.tela like 'panel:%' then 'Painel: ' || initcap(replace(substring(e.tela from 7), '_', ' '))
          else initcap(replace(e.tela, '_', ' '))
        end order by e.created_at desc))[1] as tela_atual,
        count(*) as total_eventos
      from public."TL_EVENTO_ACESSO" e
      left join auth.users u on u.id = e.user_id
      left join public."TB_PERFIL_USUARIO" p on p.user_id = e.user_id
      where e.user_id is not null
      group by e.user_id, p.nome, p.email, p.perfil, p.ativo, u.email, u.raw_user_meta_data
      order by max(e.created_at) desc
      limit v_recent_limit
    ) t
  ),
  por_dia as (
    select coalesce(jsonb_agg(to_jsonb(t) order by t.dia desc), '[]'::jsonb) as dados
    from (
      select
        (created_at at time zone 'America/Sao_Paulo')::date as dia,
        count(*) as eventos,
        count(distinct user_id) filter (where user_id is not null) as usuarios_unicos,
        count(distinct user_id) filter (where user_id is not null and created_at >= now() - make_interval(mins => v_online_minutes)) as online_maximo,
        count(distinct client_session_id) filter (where client_session_id is not null) as sessoes_cliente
      from public."TL_EVENTO_ACESSO", params
      where created_at >= params.agora_utc - params.janela_dias
      group by 1
      order by 1 desc
      limit v_days
    ) t
  ),
  por_evento as (
    select coalesce(jsonb_agg(to_jsonb(t) order by t.total desc), '[]'::jsonb) as dados
    from (
      select
        evento,
        count(*) as total,
        count(*) filter (where created_at >= now() - interval '7 days') as ultimos_7_dias,
        count(distinct user_id) filter (where user_id is not null) as usuarios_unicos
      from public."TL_EVENTO_ACESSO"
      group by evento
      order by total desc
      limit 20
    ) t
  ),
  armazenamento as (
    select jsonb_build_object(
      'tamanho_total', pg_size_pretty(pg_total_relation_size('public."TL_EVENTO_ACESSO"'::regclass)),
      'total_size', pg_size_pretty(pg_total_relation_size('public."TL_EVENTO_ACESSO"'::regclass)),
      'tamanho_tabela', pg_size_pretty(pg_relation_size('public."TL_EVENTO_ACESSO"'::regclass)),
      'table_size', pg_size_pretty(pg_relation_size('public."TL_EVENTO_ACESSO"'::regclass)),
      'tamanho_indices', pg_size_pretty(pg_indexes_size('public."TL_EVENTO_ACESSO"'::regclass)),
      'index_size', pg_size_pretty(pg_indexes_size('public."TL_EVENTO_ACESSO"'::regclass))
    ) as dados
  )
  select jsonb_build_object(
    'consultado_em_sp', (select agora_sp from params),
    'online_minutes', v_online_minutes,
    'resumo', (select dados from resumo),
    'online', (select dados from online),
    'usuarios_online', (select dados from online),
    'recentes', (select dados from recentes),
    'usuarios_recentes', (select dados from recentes),
    'por_dia', (select dados from por_dia),
    'estatisticas_diarias', (select dados from por_dia),
    'por_evento', (select dados from por_evento),
    'eventos_por_tipo', (select dados from por_evento),
    'armazenamento', (select dados from armazenamento)
  ) into v_result;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_analises_dashboard_payload()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
 SET statement_timeout TO '8s'
AS $function$
declare
  v_payload jsonb;
  v_ttl_minutes integer := 5;
  v_can_view boolean;
begin
  select (
    private.has_perm('paineis')
    or private.has_perm('ind')
    or private.has_perm('config')
    or private.has_perm('admin')
  ) into v_can_view;

  if not coalesce(v_can_view, false) then
    raise exception 'Sem permissao para visualizar painel de analises';
  end if;

  select least(greatest(coalesce(nullif(valor, '')::integer, 5), 1), 120)
  into v_ttl_minutes
  from public."TB_CONFIGURACAO"
  where chave = 'analises_cache_ttl_minutos'
  limit 1;

  v_ttl_minutes := coalesce(v_ttl_minutes, 5);

  select c.payload
  into v_payload
  from private."TA_DASHBOARD_ANALISE" c
  where c.cache_key = 'payload'
    and c.refreshed_at >= now() - make_interval(mins => v_ttl_minutes);

  if v_payload is not null then
    return v_payload || jsonb_build_object(
      'cache', jsonb_build_object(
        'hit', true,
        'refreshed_at', (
          select refreshed_at
          from private."TA_DASHBOARD_ANALISE"
          where cache_key = 'payload'
        )
      )
    );
  end if;

  select jsonb_build_object(
    'kpis', coalesce((select to_jsonb(k) from public.vw_analises_kpis k limit 1), '{}'::jsonb),
    'por_responsavel', coalesce((select jsonb_agg(to_jsonb(r) order by r.total desc, r.responsavel_analise) from public.vw_analises_por_responsavel r), '[]'::jsonb),
    'tendencia_diaria', coalesce((select jsonb_agg(to_jsonb(t) order by t.data_analise) from public.vw_analises_tendencia_diaria t), '[]'::jsonb),
    'por_edital', coalesce((select jsonb_agg(to_jsonb(e) order by e.unidade, e.edital) from public.vw_analises_dashboard_por_edital e), '[]'::jsonb),
    'config', coalesce((
      select jsonb_object_agg(chave, valor order by chave)
      from public."TB_CONFIGURACAO"
      where chave in (
        'app_version_current',
        'analises_cache_ttl_minutos',
        'access_heartbeat_minutos',
        'password_reset_flow'
      )
    ), '{}'::jsonb),
    'cache', jsonb_build_object(
      'hit', false,
      'refreshed_at', now()
    )
  ) into v_payload;

  insert into private."TA_DASHBOARD_ANALISE"(cache_key, payload, refreshed_at)
  values ('payload', v_payload, now())
  on conflict (cache_key) do update
    set payload = excluded.payload,
        refreshed_at = excluded.refreshed_at;

  return v_payload;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_analises_dashboard_payload_v2(p_scope text DEFAULT 'ativo'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
 SET statement_timeout TO '15s'
 SET lock_timeout TO '3s'
 SET work_mem TO '64MB'
 SET jit TO 'off'
AS $function$
declare
  v_scope text := lower(btrim(coalesce(p_scope, 'ativo')));
  v_can_view boolean;
  v_columns jsonb := jsonb_build_array(
    'id', 'chave_natural', 'grupo', 'unidade', 'edital', 'codigo_vaga',
    'nome_vaga', 'candidato', 'categoria', 'modalidade_concorrencia',
    'status_consolidado', 'etapa', 'responsavel_analise', 'data_analise',
    'nota_final_ajustada', 'pontuacao_escolaridade',
    'pontuacao_cursos_aperfeicoamento', 'pontuacao_experiencia_profissional',
    'pontuacao_criterio_etnico', 'experiencia_saude_indigena_total',
    'experiencia_atencao_basica_total', 'analise', 'link_pdf', 'pdf_status',
    'erro_pdf', 'origem_arquivo_id', 'data_inicio_analise', 'data_fim_analise',
    'data_validacao_status', 'updated_at', 'ultima_atualizacao', 'edital_status'
  );
  v_rows jsonb;
  v_editais jsonb;
begin
  select (
    private.has_perm('paineis')
    or private.has_perm('ind')
    or private.has_perm('config')
    or private.has_perm('admin')
  ) into v_can_view;

  if not coalesce(v_can_view, false) then
    raise exception 'Sem permissao para visualizar painel de analises';
  end if;

  if v_scope not in ('ativo', 'inativo', 'todos') then
    raise exception 'Escopo invalido. Use ativo, inativo ou todos.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_array(
    v.id, v.chave_natural, v.grupo, v.unidade, v.edital, v.codigo_vaga,
    v.nome_vaga, v.candidato, v.categoria, v.modalidade_concorrencia,
    v.status_consolidado, v.etapa, v.responsavel_analise, v.data_analise,
    v.nota_final_ajustada, v.pontuacao_escolaridade,
    v.pontuacao_cursos_aperfeicoamento, v.pontuacao_experiencia_profissional,
    v.pontuacao_criterio_etnico, v.experiencia_saude_indigena_total,
    v.experiencia_atencao_basica_total, v.analise, v.link_pdf, v.pdf_status,
    v.erro_pdf, v.origem_arquivo_id, v.data_inicio_analise, v.data_fim_analise,
    v.data_validacao_status, v.updated_at, v.ultima_atualizacao, v.edital_status
  ) order by v.unidade, v.edital, v.codigo_vaga, v.candidato), '[]'::jsonb)
  into v_rows
  from public.vw_analises_dashboard_base_todos v
  where case
    when v_scope = 'ativo' then v.ativo is true and v.edital_ativo is true
    when v_scope = 'inativo' then v.edital_ativo is false
    else true
  end;

  select coalesce(jsonb_agg(jsonb_build_object(
    'grupo', e.grupo,
    'unidade', e.unidade,
    'edital', e.edital,
    'ativo', e.ativo,
    'data_inicio_analise', e.data_inicio_analise,
    'data_fim_analise', e.data_fim_analise
  ) order by e.unidade, e.edital), '[]'::jsonb)
  into v_editais
  from public."TB_EDITAL_ANALISE" e;

  return jsonb_build_object(
    'schema_version', 2,
    'scope', v_scope,
    'columns', v_columns,
    'rows', v_rows,
    'editais', v_editais,
    'total', jsonb_array_length(v_rows),
    'generated_at', now(),
    'cache', jsonb_build_object('hit', false, 'refreshed_at', now())
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_configuracoes_historico(p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth'
AS $function$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
begin
  if not private.has_perm('config') then
    raise exception 'Sem permissao para consultar historico de "TB_CONFIGURACAO"';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', v.id,
      'acao', v.acao,
      'motivo', v.motivo,
      'created_by', v.created_by,
      'created_by_email', v.created_by_email,
      'restaurada_de', v.restaurada_de,
      'alteracoes', v.alteracoes,
      'total_alteracoes', v.total_alteracoes,
      'created_at', v.created_at
    ) order by v.created_at desc)
    from (
      select *
      from public."TH_CONFIGURACAO"
      order by created_at desc
      limit v_limit
    ) v
  ), '[]'::jsonb);
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_configuracoes_snapshot()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth'
AS $function$
begin
  if not private.has_perm('config') then
    raise exception 'Sem permissao para consultar "TB_CONFIGURACAO"';
  end if;

  return jsonb_build_object(
    '"TB_CONFIGURACAO"', private.snapshot_configuracoes(),
    'paineis', private.snapshot_paineis_externos(),
    'gerado_em', now()
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_monitoramento_cronograma(p_monitoramento_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth'
AS $function$
begin
  if not private.has_perm('cores') then
    raise exception 'Sem permissao para consultar cronograma';
  end if;

  return jsonb_build_object(
    'monitoramento', (
      select jsonb_build_object(
        'id', m.id,
        'edital', m.edital,
        'unidade', m.unidade,
        'cronograma_automatico', m.cronograma_automatico,
        'cronograma_origem', m.cronograma_origem,
        'cronograma_revisado_at', m.cronograma_revisado_at,
        'status_override', m.status_override,
        'etapa_override', m.etapa_override,
        'status_override_motivo', m.status_override_motivo,
        'status_override_data', m.status_override_data,
        'status_override_previsao_retomada', m.status_override_previsao_retomada,
        'cronograma_ultima_errata', m.cronograma_ultima_errata
      )
      from public."TB_MONITORAMENTO_INDIGENA" m
      where m.id = p_monitoramento_id
    ),
    'estado', public.get_monitoramento_cronograma_estado(p_monitoramento_id, current_date),
    'etapas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'ordem', c.ordem,
        'atividade', c.atividade,
        'tipo_atividade', c.tipo_atividade,
        'data_inicio', c.data_inicio,
        'data_fim', c.data_fim,
        'concluida', c.concluida,
        'observacao', c.observacao,
        'origem', c.origem,
        'confianca_extracao', c.confianca_extracao
      ) order by c.ordem)
      from public."TB_CRONOGRAMA_MONIT_INDIG" c
      where c.monitoramento_id = p_monitoramento_id
    ), '[]'::jsonb),
    'historico', public.get_monitoramento_cronograma_historico(p_monitoramento_id, 20)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_monitoramento_cronograma_estado(p_monitoramento_id uuid, p_data date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth'
AS $function$
declare
  v_monitor public."TB_MONITORAMENTO_INDIGENA"%rowtype;
  v_total integer := 0;
  v_concluidas integer := 0;
  v_primeira public."TB_CRONOGRAMA_MONIT_INDIG"%rowtype;
  v_ultima public."TB_CRONOGRAMA_MONIT_INDIG"%rowtype;
  v_atual public."TB_CRONOGRAMA_MONIT_INDIG"%rowtype;
  v_proxima public."TB_CRONOGRAMA_MONIT_INDIG"%rowtype;
  v_status text;
  v_etapa text;
  v_percentual numeric := 0;
  v_dias integer;
begin
  select * into v_monitor
  from public."TB_MONITORAMENTO_INDIGENA"
  where id = p_monitoramento_id;

  if not found then
    return jsonb_build_object('status', null, 'etapa', null, 'tem_cronograma', false);
  end if;

  select count(*)::integer,
         count(*) filter (where data_fim < p_data)::integer
  into v_total, v_concluidas
  from public."TB_CRONOGRAMA_MONIT_INDIG"
  where monitoramento_id = p_monitoramento_id;

  if not v_monitor.cronograma_automatico or v_total = 0 then
    return jsonb_build_object(
      'status', coalesce(nullif(v_monitor.status_override,''), nullif(v_monitor.status,''), 'Cronograma pendente'),
      'etapa', coalesce(nullif(v_monitor.etapa_override,''), nullif(v_monitor.etapa,''), 'Cronograma pendente'),
      'tem_cronograma', false,
      'percentual', 0,
      'proxima_atividade', null,
      'proxima_data', null,
      'dias_para_proxima', null
    );
  end if;

  select * into v_primeira
  from public."TB_CRONOGRAMA_MONIT_INDIG"
  where monitoramento_id = p_monitoramento_id
  order by data_inicio, ordem
  limit 1;

  select * into v_ultima
  from public."TB_CRONOGRAMA_MONIT_INDIG"
  where monitoramento_id = p_monitoramento_id
  order by data_fim desc, ordem desc
  limit 1;

  select * into v_atual
  from public."TB_CRONOGRAMA_MONIT_INDIG"
  where monitoramento_id = p_monitoramento_id
    and p_data between data_inicio and data_fim
  order by data_inicio desc, ordem desc
  limit 1;

  select * into v_proxima
  from public."TB_CRONOGRAMA_MONIT_INDIG"
  where monitoramento_id = p_monitoramento_id
    and data_inicio > p_data
  order by data_inicio, ordem
  limit 1;

  v_percentual := round(least(100, greatest(0, (v_concluidas::numeric / nullif(v_total,0)) * 100)), 1);

  if p_data < v_primeira.data_inicio then
    v_status := 'Planejado';
    v_etapa := 'Aguardando: ' || v_primeira.atividade;
  elsif p_data > v_ultima.data_fim then
    v_status := 'ConcluÃ­do';
    v_etapa := v_ultima.atividade;
    v_percentual := 100;
  elsif v_atual.id is not null then
    v_status := 'Em andamento';
    v_etapa := v_atual.atividade;
  elsif v_proxima.id is not null then
    v_status := 'Em andamento';
    v_etapa := 'Aguardando: ' || v_proxima.atividade;
  else
    v_status := 'Em andamento';
    v_etapa := coalesce(v_ultima.atividade, 'Cronograma em andamento');
  end if;

  if v_proxima.id is not null then
    v_dias := v_proxima.data_inicio - p_data;
  end if;

  v_status := coalesce(nullif(v_monitor.status_override,''), v_status);
  v_etapa := coalesce(nullif(v_monitor.etapa_override,''), v_etapa);

  return jsonb_build_object(
    'status', v_status,
    'etapa', v_etapa,
    'tem_cronograma', true,
    'percentual', v_percentual,
    'atividade_atual', case when v_atual.id is null then null else v_atual.atividade end,
    'proxima_atividade', case when v_proxima.id is null then null else v_proxima.atividade end,
    'proxima_data', case when v_proxima.id is null then null else v_proxima.data_inicio end,
    'dias_para_proxima', v_dias,
    'data_inicio', v_primeira.data_inicio,
    'data_fim', v_ultima.data_fim,
    'total_etapas', v_total,
    'etapas_concluidas', v_concluidas
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_monitoramento_cronograma_historico(p_monitoramento_id uuid, p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth'
AS $function$
begin
  if not private.has_perm('cores') then
    raise exception 'Sem permissao para consultar historico do cronograma';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', v.id,
      'acao', v.acao,
      'motivo', v.motivo,
      'numero_errata', v.numero_errata,
      'created_by_email', v.created_by_email,
      'alteracoes', v.alteracoes,
      'total_alteracoes', v.total_alteracoes,
      'created_at', v.created_at
    ) order by v.created_at desc)
    from (
      select *
      from public."TH_CRONOGRAMA_MONIT_INDIG"
      where monitoramento_id = p_monitoramento_id
      order by created_at desc
      limit least(greatest(coalesce(p_limit, 20), 1), 100)
    ) v
  ), '[]'::jsonb);
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_monitoramento_dashboard_payload()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_payload jsonb;
begin
  select jsonb_build_object(
    'kpis', coalesce((select to_jsonb(k) from public.vw_monitoramento_indigena_kpis k limit 1), '{}'::jsonb),
    'por_unidade', coalesce((select jsonb_agg(to_jsonb(u) order by u.unidade) from public.vw_monitoramento_indigena_por_unidade u), '[]'::jsonb),
    'por_edital', coalesce((select jsonb_agg(to_jsonb(e) order by e.unidade, e.edital, e.etapa, e.status) from public.vw_monitoramento_indigena_por_edital e), '[]'::jsonb),
    'config', coalesce((
      select jsonb_object_agg(chave, valor order by chave)
      from public."TB_CONFIGURACAO"
      where chave in (
        'app_version_current',
        'access_heartbeat_minutos',
        'feature_modo_executivo',
        'feature_realtime_monitoramento',
        'password_reset_flow'
      )
    ), '{}'::jsonb)
  ) into v_payload;

  return v_payload;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_nucleo_cronograma_resumo()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth'
AS $function$
begin
  if not private.has_perm('cores') then
    raise exception 'Sem permissao para consultar resumo da Equipe Nucleo';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', m.id,
      'edital', m.edital,
      'unidade', m.unidade,
      'status', e ->> 'status',
      'etapa', e ->> 'etapa',
      'cronograma_automatico', m.cronograma_automatico,
      'cronograma_total', coalesce(c.total, 0),
      'tem_resultado_final', coalesce(c.tem_resultado_final, false),
      'percentual', coalesce((e ->> 'percentual')::numeric, 0),
      'proxima_atividade', e ->> 'proxima_atividade',
      'proxima_data', e ->> 'proxima_data',
      'dias_para_proxima', (e ->> 'dias_para_proxima')::integer,
      'status_override', m.status_override,
      'alerta_tipo', case
        when nullif(m.status_override, '') is not null then 'excepcional'
        when not m.cronograma_automatico or coalesce(c.total, 0) = 0 then 'sem_cronograma'
        when coalesce(c.total, 0) < 2 or not coalesce(c.tem_resultado_final, false) then 'incompleto'
        when (e ->> 'dias_para_proxima')::integer between 0 and 3 then 'proxima_3d'
        when (e ->> 'dias_para_proxima')::integer between 4 and 7 then 'proxima_7d'
        else 'ok'
      end
    ) order by m.unidade, m.edital)
    from public."TB_MONITORAMENTO_INDIGENA" m
    cross join lateral public.get_monitoramento_cronograma_estado(m.id, current_date) e
    left join lateral (
      select
        count(*)::integer as total,
        bool_or(lower(atividade) like '%resultado final%') as tem_resultado_final
      from public."TB_CRONOGRAMA_MONIT_INDIG" c
      where c.monitoramento_id = m.id
    ) c on true
    where m.ativo is true
  ), '[]'::jsonb);
end;
$function$;

CREATE OR REPLACE FUNCTION public.historico_do_registro(p_id uuid)
 RETURNS TABLE(id uuid, usuario_email text, evento text, created_at timestamp with time zone, snapshot_json jsonb)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'auth', 'private'
AS $function$
  select
    h.id,
    h.usuario_email,
    h.evento,
    h.created_at,
    h.snapshot_json
  from public."TH_MONITORAMENTO" h
  where h.id_registro = p_id
    and (
      private.has_perm('ind')
      or private.has_perm('cores')
      or private.has_perm('config')
      or private.has_perm('admin')
    )
  order by h.created_at desc
  limit 50;
$function$;

CREATE OR REPLACE FUNCTION public.importar_lista_aprovados(p_edital_id text, p_ativo boolean, p_arquivo_nome text, p_arquivo_path text, p_candidatos jsonb, p_substituir boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text := private.monitora_role();
  v_lista_id uuid;
  v_lista_atual uuid;
  v_ja_teve_lista boolean;
  v_total integer;
  v_edital text;
begin
  if (select auth.uid()) is null then raise exception 'Usuario nao autenticado'; end if;
  if v_role not in ('edital_gestor', 'contratador', 'admin') then
    raise exception 'Perfil sem permissao para importar lista de aprovados';
  end if;
  if p_edital_id is null then raise exception 'Edital nao informado'; end if;
  if nullif(btrim(p_arquivo_nome), '') is null or nullif(btrim(p_arquivo_path), '') is null then
    raise exception 'Arquivo XLSX nao informado';
  end if;
  if jsonb_typeof(p_candidatos) <> 'array' or jsonb_array_length(p_candidatos) = 0 then
    raise exception 'A lista precisa conter pelo menos um candidato';
  end if;

  select m.edital into v_edital from public."TB_MONITORAMENTO_INDIGENA" m where m.id::text = p_edital_id;
  if not found then raise exception 'Edital nao encontrado na Equipe Nucleo'; end if;

  select exists(select 1 from public."TB_LISTA_APROVADO" where edital_id = p_edital_id)
    into v_ja_teve_lista;
  select id into v_lista_atual
  from public."TB_LISTA_APROVADO"
  where edital_id = p_edital_id and vigente is true
  for update;

  if v_ja_teve_lista and v_role <> 'admin' then
    raise exception 'Somente admin pode substituir ou importar novamente uma lista ja cadastrada';
  end if;
  if v_lista_atual is not null and not coalesce(p_substituir, false) then
    raise exception 'Este edital ja possui lista. Use a opcao de substituicao administrativa';
  end if;
  if coalesce(p_substituir, false) and v_role <> 'admin' then
    raise exception 'Somente admin pode substituir lista de aprovados';
  end if;

  if v_lista_atual is not null then
    update public."TB_LISTA_APROVADO"
    set vigente = false, ativo = false, substituido_por = (select auth.uid()),
        substituido_em = now(), updated_at = now()
    where id = v_lista_atual;
  end if;

  insert into public."TB_LISTA_APROVADO"(
    edital_id, ativo, vigente, arquivo_nome, arquivo_path, importado_por
  ) values (
    p_edital_id, coalesce(p_ativo, true), true, btrim(p_arquivo_nome),
    btrim(p_arquivo_path), (select auth.uid())
  ) returning id into v_lista_id;

  insert into public."TB_CANDIDATO_APROVADO"(
    lista_id, codigo_vaga, cargo, classificacao, nota, nome, modalidade,
    sub_judice, created_by, updated_by
  )
  select v_lista_id,
         nullif(btrim(x.codigo_vaga), ''),
         nullif(btrim(x.cargo), ''),
         x.classificacao,
         x.nota,
         nullif(btrim(x.nome), ''),
         nullif(btrim(x.modalidade), ''),
         false,
         (select auth.uid()),
         (select auth.uid())
  from jsonb_to_recordset(p_candidatos) as x(
    codigo_vaga text,
    cargo text,
    classificacao integer,
    nota numeric,
    nome text,
    modalidade text
  );

  get diagnostics v_total = row_count;
  if v_total <> jsonb_array_length(p_candidatos) then
    raise exception 'Nem todos os candidatos puderam ser importados';
  end if;

  return jsonb_build_object(
    'ok', true, 'lista_id', v_lista_id, 'edital_id', p_edital_id,
    'edital', v_edital, 'total', v_total, 'ativo', coalesce(p_ativo, true)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.incluir_sub_judice(p_edital_id text, p_cargo text, p_nome text, p_nota numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text := private.monitora_role();
  v_lista public."TB_LISTA_APROVADO"%rowtype;
  v_candidato_id uuid;
begin
  if v_role not in ('contratador', 'admin') then raise exception 'Perfil sem permissao para incluir sub judice'; end if;
  if nullif(btrim(coalesce(p_cargo, '')), '') is null then raise exception 'Cargo obrigatorio'; end if;
  if nullif(btrim(coalesce(p_nome, '')), '') is null then raise exception 'Nome obrigatorio'; end if;
  if p_nota is null or p_nota < 0 then raise exception 'Nota invalida'; end if;

  select * into v_lista
  from public."TB_LISTA_APROVADO"
  where edital_id = p_edital_id and vigente is true
  for update;
  if not found then raise exception 'O edital ainda nao possui lista vigente'; end if;
  if not v_lista.ativo then raise exception 'A lista esta inativa e nao permite incluir sub judice'; end if;

  if not exists (
    select 1 from public."TB_CANDIDATO_APROVADO"
    where lista_id = v_lista.id and removido_em is null and cargo = btrim(p_cargo)
  ) then
    raise exception 'Cargo nao pertence a lista vigente deste edital';
  end if;

  insert into public."TB_CANDIDATO_APROVADO"(
    lista_id, cargo, nota, nome, sub_judice, created_by, updated_by
  ) values (
    v_lista.id, btrim(p_cargo), p_nota, btrim(p_nome), true,
    (select auth.uid()), (select auth.uid())
  ) returning id into v_candidato_id;

  return jsonb_build_object('ok', true, 'candidato_id', v_candidato_id, 'lista_id', v_lista.id, 'sub_judice', true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.iniciar_sync_analises_incremental(p_sync_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
 SET statement_timeout TO '5s'
 SET lock_timeout TO '1s'
AS $function$
declare
  v_row public."TL_SYNC_ANALISE"%rowtype;
begin
  if p_sync_id is null then raise exception 'p_sync_id obrigatorio'; end if;
  if not pg_try_advisory_xact_lock(hashtext('public.processar_sync_analises')::bigint) then
    raise exception 'Outro processamento de analises esta em andamento.';
  end if;

  select * into v_row from public."TL_SYNC_ANALISE" where sync_id=p_sync_id order by id desc limit 1;
  if found then
    if coalesce(v_row.modo,'') <> 'INCREMENTAL_ACTIVE' then
      raise exception 'sync_id ja existe com modo diferente: %',coalesce(v_row.modo,'<null>');
    end if;
    return jsonb_build_object('ok',true,'sync_id',p_sync_id,'status',v_row.status,'existing',true,'resultado',v_row.resultado);
  end if;

  if exists(select 1 from public."TL_SYNC_ANALISE" where status in ('carregado','processando')) then
    raise exception 'Existe outro sync de Analises pendente.';
  end if;

  insert into public."TL_SYNC_ANALISE"(sync_id,origem,modo,status,linhas_staging,started_at,resultado)
  values(p_sync_id,'apps_script_analises_incremental_v1','INCREMENTAL_ACTIVE','carregado',0,now(),jsonb_build_object(
    'modo_processamento','incremental',
    'incremental_preparado',false,
    'incremental_cursor',0,
    'incremental_iniciado_em',now()
  ));

  return jsonb_build_object('ok',true,'sync_id',p_sync_id,'status','carregado','existing',false);
end;
$function$;

CREATE OR REPLACE FUNCTION public.limpar_eventos_acesso_antigos(p_dias integer DEFAULT 30)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth'
AS $function$
declare
  v_count integer;
begin
  if not (private.has_perm('config') or private.has_perm('admin')) then
    raise exception 'Sem permissao para limpar auditoria';
  end if;

  delete from public."TL_EVENTO_ACESSO"
  where created_at < now() - make_interval(days => greatest(coalesce(p_dias, 30), 1));

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

CREATE OR REPLACE FUNCTION public.limpar_eventos_acesso_retencao(p_heartbeat_dias integer DEFAULT 30, p_eventos_dias integer DEFAULT 365)
 RETURNS TABLE(objeto text, criterio text, removidos integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_heartbeat_dias integer := least(greatest(coalesce(p_heartbeat_dias, 30), 7), 365);
  v_eventos_dias integer := least(greatest(coalesce(p_eventos_dias, 365), 30), 1825);
  v_count integer;
begin
  delete from public."TL_EVENTO_ACESSO"
  where evento = 'heartbeat'
    and created_at < now() - make_interval(days => v_heartbeat_dias);
  get diagnostics v_count = row_count;
  objeto := '"TL_EVENTO_ACESSO"';
  criterio := 'heartbeat_' || v_heartbeat_dias || '_dias';
  removidos := v_count;
  return next;

  delete from public."TL_EVENTO_ACESSO"
  where evento <> 'heartbeat'
    and created_at < now() - make_interval(days => v_eventos_dias);
  get diagnostics v_count = row_count;
  objeto := '"TL_EVENTO_ACESSO"';
  criterio := 'eventos_' || v_eventos_dias || '_dias';
  removidos := v_count;
  return next;
end;
$function$;

CREATE OR REPLACE FUNCTION public.limpar_logs_operacionais(p_dias integer DEFAULT 30)
 RETURNS TABLE(objeto text, removidos integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth'
 SET statement_timeout TO '10s'
 SET lock_timeout TO '2s'
AS $function$
declare
  v_dias integer := greatest(coalesce(p_dias, 30), 1);
  v_count integer;
  r record;
begin
  if not (private.has_perm('config') or private.has_perm('admin')) then
    raise exception 'Sem permissao para limpar logs operacionais';
  end if;

  for r in select * from public.limpar_eventos_acesso_retencao(30, 365) loop
    objeto := r.objeto || ':' || r.criterio;
    removidos := r.removidos;
    return next;
  end loop;

  delete from public."TL_SYNC_ANALISE"
  where created_at < now() - make_interval(days => v_dias);
  get diagnostics v_count = row_count;
  objeto := '"TL_SYNC_ANALISE"';
  removidos := v_count;
  return next;
end;
$function$;

CREATE OR REPLACE FUNCTION public.limpar_staging_monitoramento_indigena(p_dias integer DEFAULT 7)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_count integer;
begin
  delete from public."TM_DASHBOARD_MONIT_INDIG"
  where created_at < now() - make_interval(days => greatest(p_dias, 1))
  returning 1 into v_count;
  get diagnostics v_count = row_count;
  return coalesce(v_count, 0);
end;
$function$;

CREATE OR REPLACE FUNCTION public.link_auth_user_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
begin
  update public."TB_PERFIL_USUARIO"
  set user_id = new.id,
      updated_at = now()
  where user_id is null
    and lower(email) = lower(new.email);

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.listar_candidatos_aprovados()
 RETURNS TABLE(candidato_id uuid, lista_id uuid, edital_id text, edital text, unidade text, cargo text, classificacao integer, nota numeric, nome text, modalidade text, status text, processo_sei text, matricula text, sub_judice boolean, lista_ativa boolean, arquivo_nome text, importado_em timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if private.monitora_role() = '' then raise exception 'Perfil sem acesso ao sistema'; end if;
  return query
  select c.id, l.id, l.edital_id, m.edital, m.unidade, c.cargo, c.classificacao,
         c.nota, c.nome, c.modalidade, c.status, c.processo_sei, c.matricula,
         c.sub_judice, l.ativo, l.arquivo_nome, l.importado_em
  from public."TB_LISTA_APROVADO" l
  join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
  join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id
  where l.vigente is true
    and c.removido_em is null
  order by m.edital, c.cargo, c.classificacao nulls last, c.nome;
end;
$function$;

CREATE OR REPLACE FUNCTION public.listar_listas_aprovados()
 RETURNS TABLE(lista_id uuid, edital_id text, edital text, unidade text, ativo boolean, arquivo_nome text, arquivo_path text, importado_em timestamp with time zone, total_candidatos bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if private.monitora_role() = '' then raise exception 'Perfil sem acesso ao sistema'; end if;
  return query
  select l.id, l.edital_id, m.edital, m.unidade, l.ativo, l.arquivo_nome,
         l.arquivo_path, l.importado_em,
         count(c.id) filter (where c.removido_em is null)
  from public."TB_LISTA_APROVADO" l
  join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
  left join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id
  where l.vigente is true
  group by l.id, m.edital, m.unidade
  order by m.edital, m.unidade;
end;
$function$;

CREATE OR REPLACE FUNCTION public.listar_presenca_online_monitora()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare
  v_result jsonb;
  v_user_id uuid := auth.uid();
  v_email text := coalesce(auth.jwt() ->> 'email', '');
begin
  if v_user_id is null then
    raise exception 'Sessao nao localizada.' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public."TB_PERFIL_USUARIO" p
    where p.ativo is true
      and (
        p.user_id = v_user_id
        or lower(p.email) = lower(v_email)
      )
      and (
        lower(coalesce(p.perfil, '')) = 'master'
        or p.p_config is true
        or p.p_admin is true
      )
  ) then
    raise exception 'Acesso restrito aos perfis autorizados para ver presenca.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(person) order by person."fullName", person."userId"), '[]'::jsonb)
  into v_result
  from (
    select
      po.user_id as "userId",
      coalesce(nullif(trim(p.nome), ''), split_part(coalesce(p.email, ''), '@', 1), 'Usuario AgSUS') as "fullName",
      coalesce(
        case when p.avatar_source in ('GOOGLE', 'UPLOADED') then p.avatar_url end,
        p.google_avatar_url
      ) as "avatarUrl",
      case when lower(coalesce(p.perfil, '')) = 'master' then 'Master'
           else initcap(coalesce(nullif(p.perfil, ''), 'Usuario')) end as "profileLabel",
      po.current_view as "currentView",
      po.seen_at as "onlineAt"
    from public."TB_PRESENCA_ONLINE_MONITORA" po
    join lateral (
      select profile.*
      from public."TB_PERFIL_USUARIO" profile
      where profile.ativo is true
        and (
          profile.user_id = po.user_id
          or lower(profile.email) = lower(coalesce(
            (select email from auth.users where id = po.user_id),
            ''
          ))
        )
      order by case when profile.user_id = po.user_id then 0 else 1 end,
               profile.updated_at desc nulls last
      limit 1
    ) p on true
    where po.seen_at > timezone('utc', now()) - interval '2 minutes'
    order by po.seen_at desc
    limit 200
  ) person;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.meu_usuario()
 RETURNS TABLE(id uuid, user_id uuid, email text, nome text, perfil text, ativo boolean, p_ind boolean, p_cores boolean, p_paineis boolean, p_config boolean, p_admin boolean, avatar_source text, avatar_url text, avatar_config jsonb, google_avatar_url text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'auth'
 SET statement_timeout TO '3s'
AS $function$
  select
    p.id,
    p.user_id,
    p.email,
    p.nome,
    p.perfil,
    p.ativo,
    p.p_ind,
    p.p_cores,
    p.p_paineis,
    p.p_config,
    p.p_admin,
    p.avatar_source,
    p.avatar_url,
    p.avatar_config,
    coalesce(
      p.google_avatar_url,
      auth.jwt() -> 'user_metadata' ->> 'avatar_url',
      auth.jwt() -> 'user_metadata' ->> 'picture'
    ) as google_avatar_url
  from public."TB_PERFIL_USUARIO" p
  where p.ativo = true
    and (
      p.user_id = auth.uid()
      or lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.obter_branding_acesso_publico()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '3s'
AS $function$
  select coalesce(
    jsonb_object_agg(c.chave, c.valor)
      filter (where c.valor is not null and btrim(c.valor) <> ''),
    '{}'::jsonb
  )
  from public."TB_CONFIGURACAO" as c
  where c.chave in (
    'auth_access_background_url',
    'auth_access_logo_url',
    'auth_access_panel_color',
    'auth_access_greeting',
    'auth_access_instruction',
    'auth_google_button_text',
    'auth_access_texto_modo'
  );
$function$;

CREATE OR REPLACE FUNCTION public.obter_bridge_aya()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '3s'
AS $function$
  select jsonb_build_object(
    'url', b.url,
    'atualizado_em', b.atualizado_em,
    'idade_segundos',
      case
        when b.atualizado_em is null then null
        else floor(extract(epoch from (now() - b.atualizado_em)))
      end
  )
  from public."TB_BRIDGE_AYA" as b
  where b.id;
$function$;

CREATE OR REPLACE FUNCTION public.obter_contexto_monitora()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
 SET statement_timeout TO '3s'
AS $function$
  with perfil_atual as (
    select p.*
    from public."TB_PERFIL_USUARIO" p
    where p.ativo is true
      and (
        p.user_id = (select auth.uid())
        or lower(p.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
      )
    order by case when p.user_id = (select auth.uid()) then 0 else 1 end,
             p.updated_at desc nulls last
    limit 1
  ),
  paineis_permitidos as (
    select pe.id::text as painel_id
    from public."TB_PAINEL_EXTERNO" pe
    where pe.ativo is true
  )
  select jsonb_build_object(
    'profile', to_jsonb(p),
    'panel_ids', coalesce(
      (select jsonb_agg(pp.painel_id order by pp.painel_id) from paineis_permitidos pp),
      '[]'::jsonb
    ),
    'modules', jsonb_build_object(
      'ind', true,
      'cores', true,
      'paineis', true,
      'config', lower(coalesce(p.perfil, '')) = 'admin',
      'admin', lower(coalesce(p.perfil, '')) = 'admin'
    )
  )
  from perfil_atual p;
$function$;

CREATE OR REPLACE FUNCTION public.preparar_sync_analises_incremental(p_sync_id uuid, p_total_ativos_local integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
 SET statement_timeout TO '10s'
 SET lock_timeout TO '1s'
AS $function$
declare
  v_fato integer;
  v_editais integer;
  v_total integer;
begin
  if p_sync_id is null then raise exception 'p_sync_id obrigatorio'; end if;
  if p_total_ativos_local is null or p_total_ativos_local < 0 then raise exception 'p_total_ativos_local invalido'; end if;
  if not exists(select 1 from public."TL_SYNC_ANALISE" where sync_id=p_sync_id and modo='INCREMENTAL_ACTIVE' and status in ('carregado','processando')) then
    raise exception 'Sync incremental indisponivel.';
  end if;

  select count(*) filter(where entidade='FATO_ANALISES')::integer,
         count(*) filter(where entidade='DIM_EDITAIS')::integer,
         count(*)::integer
    into v_fato,v_editais,v_total
  from public."TM_ANALISE_CURRICULAR"
  where sync_id=p_sync_id;

  if v_editais < 1 then raise exception 'DIM_EDITAIS nao foi enviada para o staging.'; end if;

  update public."TL_SYNC_ANALISE"
  set linhas_staging=v_total,
      total_lidos=p_total_ativos_local,
      resultado=coalesce(resultado,'{}'::jsonb)||jsonb_build_object(
        'modo_processamento','incremental',
        'incremental_preparado',true,
        'incremental_total_ativos_local',p_total_ativos_local,
        'incremental_fato_alterados',v_fato,
        'incremental_editais',v_editais,
        'incremental_staging',v_total,
        'incremental_preparado_em',now()
      ),
      updated_at=now()
  where sync_id=p_sync_id and modo='INCREMENTAL_ACTIVE';

  return jsonb_build_object('ok',true,'sync_id',p_sync_id,'total_ativos_local',p_total_ativos_local,'fato_alterados',v_fato,'editais',v_editais,'staging',v_total);
end;
$function$;

CREATE OR REPLACE FUNCTION public.processar_sync_analises_incremental_lote(p_sync_id uuid, p_limite integer DEFAULT 250)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
 SET statement_timeout TO '25s'
 SET lock_timeout TO '2s'
AS $function$
declare
  v_result jsonb;
  v_preparado boolean;
begin
  select coalesce((resultado->>'incremental_preparado')::boolean,false)
    into v_preparado
  from public."TL_SYNC_ANALISE"
  where sync_id=p_sync_id and modo='INCREMENTAL_ACTIVE' and status in ('carregado','processando')
  order by id desc limit 1;
  if not found then raise exception 'Sync incremental indisponivel.'; end if;
  if not v_preparado then raise exception 'Sync incremental ainda nao foi preparado.'; end if;

  v_result := public.processar_sync_analises_lote(p_sync_id,p_limite);

  update public."TL_SYNC_ANALISE"
  set status='processando',
      resultado=coalesce(resultado,'{}'::jsonb)||jsonb_build_object('modo_processamento','incremental'),
      updated_at=now()
  where sync_id=p_sync_id and modo='INCREMENTAL_ACTIVE';

  return coalesce(v_result,'{}'::jsonb)||jsonb_build_object('modo_processamento','incremental');
end;
$function$;

CREATE OR REPLACE FUNCTION public.processar_sync_analises_lote(p_sync_id uuid, p_limite integer DEFAULT 250)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
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
begin
  if p_sync_id is null then raise exception 'p_sync_id obrigatorio'; end if;
  if not pg_try_advisory_xact_lock(hashtext('public.processar_sync_analises')::bigint) then
    raise exception 'Outro processamento de analises ja esta em andamento.';
  end if;

  select coalesce(nullif(resultado->>'lote_cursor','')::integer,0)
    into v_cursor
  from public."TL_SYNC_ANALISE"
  where sync_id=p_sync_id and status in ('carregado','processando')
  order by id desc limit 1;
  if not found then raise exception 'Sync % indisponivel para processamento em lotes.', p_sync_id; end if;

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
    etapa,data_analise,analise,pcd,responsavel_analise,coord_demandante,email_demandante,status_consolidado,
    origem_planilha,origem_arquivo_id,ultima_atualizacao,pdf_gerado,link_pdf,data_geracao_pdf,erro_pdf,pdf_status,
    pdf_file_id,pdf_ultima_tentativa,pdf_hash_origem,linha_origem,hash_registro,ativo,updated_at)
  select
    d.chave_natural,d.grupo,d.unidade,d.edital,d.codigo_vaga,d.nome_vaga,d.regime,d.carga_horaria,d.categoria,d.candidato,
    d.id_origem,d.data_nascimento,d.idade,d.nota_empregare,d.modalidade_concorrencia,d.nota_final_ajustada,d.somatorio,
    d.pontuacao_escolaridade,d.pontuacao_cursos_aperfeicoamento,d.pontuacao_experiencia_profissional,
    d.pontuacao_criterio_etnico,d.experiencia_saude_indigena_total,d.experiencia_atencao_basica_total,
    d.etapa,d.data_analise,d.analise,d.pcd,d.responsavel_analise,d.coord_demandante,d.email_demandante,d.status_consolidado,
    d.origem_planilha,d.origem_arquivo_id,d.ultima_atualizacao,
    coalesce(d.pdf_gerado,a.pdf_gerado),coalesce(d.link_pdf,a.link_pdf),coalesce(d.data_geracao_pdf,a.data_geracao_pdf),
    coalesce(d.erro_pdf,a.erro_pdf),coalesce(d.pdf_status,a.pdf_status),coalesce(d.pdf_file_id,a.pdf_file_id),
    coalesce(d.pdf_ultima_tentativa,a.pdf_ultima_tentativa),coalesce(d.pdf_hash_origem,a.pdf_hash_origem),
    d.linha_origem,d.hash_registro,true,now()
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
    experiencia_atencao_basica_total=excluded.experiencia_atencao_basica_total,etapa=excluded.etapa,data_analise=excluded.data_analise,
    analise=excluded.analise,pcd=excluded.pcd,responsavel_analise=excluded.responsavel_analise,
    coord_demandante=excluded.coord_demandante,email_demandante=excluded.email_demandante,status_consolidado=excluded.status_consolidado,
    origem_planilha=excluded.origem_planilha,origem_arquivo_id=excluded.origem_arquivo_id,ultima_atualizacao=excluded.ultima_atualizacao,
    pdf_gerado=excluded.pdf_gerado,link_pdf=excluded.link_pdf,data_geracao_pdf=excluded.data_geracao_pdf,erro_pdf=excluded.erro_pdf,
    pdf_status=excluded.pdf_status,pdf_file_id=excluded.pdf_file_id,pdf_ultima_tentativa=excluded.pdf_ultima_tentativa,
    pdf_hash_origem=excluded.pdf_hash_origem,linha_origem=excluded.linha_origem,hash_registro=excluded.hash_registro,ativo=true,updated_at=now();

  get diagnostics v_alteradas=row_count;

  select coalesce(nullif(resultado->>'lote_lidas','')::integer,0)+v_lidas,
         coalesce(nullif(resultado->>'lote_alteradas','')::integer,0)+v_alteradas
    into v_lidas_total,v_alteradas_total
  from public."TL_SYNC_ANALISE"
  where sync_id=p_sync_id
  order by id desc limit 1;

  update public."TL_SYNC_ANALISE"
  set status='processando',
      resultado=coalesce(resultado,'{}'::jsonb)||jsonb_build_object(
        'modo_processamento','lotes','lote_cursor',v_novo_cursor,'lote_lidas',v_lidas_total,
        'lote_alteradas',v_alteradas_total,'ultimo_lote_lidas',v_lidas,'ultimo_lote_alteradas',v_alteradas,
        'ultimo_lote_em',now()),
      updated_at=now()
  where sync_id=p_sync_id;

  return jsonb_build_object('ok',true,'sync_id',p_sync_id,'lidas',v_lidas,'alteradas',v_alteradas,
    'lidas_total',v_lidas_total,'alteradas_total',v_alteradas_total,'cursor',v_novo_cursor,'concluido_fato',v_lidas<v_limite);
end;
$function$;

CREATE OR REPLACE FUNCTION public.recusar_solicitacao_acesso(p_solicitacao_id uuid, p_observacao_admin text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private', 'auth'
AS $function$
declare
  v_req public."TB_SOLICITACAO_ACESSO"%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if not private.is_master() then
    raise exception 'Somente perfil master pode recusar solicitacao de acesso';
  end if;

  select * into v_req
  from public."TB_SOLICITACAO_ACESSO"
  where id = p_solicitacao_id
  for update;

  if not found then
    raise exception 'Solicitacao de acesso nao encontrada';
  end if;

  if lower(coalesce(v_req.status, '')) <> 'pendente' then
    raise exception 'Solicitacao ja foi avaliada (status atual: %)', v_req.status;
  end if;

  update public."TB_SOLICITACAO_ACESSO"
  set status = 'recusado',
      avaliado_por = auth.uid(),
      avaliado_em = now(),
      observacao_admin = nullif(btrim(p_observacao_admin), '')
  where id = p_solicitacao_id;

  return jsonb_build_object(
    'ok', true,
    'solicitacao_id', v_req.id,
    'email', v_req.email,
    'status', 'recusado'
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.registrar_bridge_aya(p_chave text, p_url text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '3s'
AS $function$
declare
  v_hash text;
  v_url text := btrim(coalesce(p_url, ''));
begin
  select b.chave_sha256 into v_hash from public."TB_BRIDGE_AYA" as b where b.id;

  if v_hash is null then
    return 'segredo_nao_definido';
  end if;

  if p_chave is null
     or encode(sha256(convert_to(p_chave, 'UTF8')), 'hex') is distinct from v_hash then
    return 'chave_invalida';
  end if;

  -- Endereco de tunel Ã© sempre HTTPS. Recusar o resto evita que um registro
  -- errado faca `/api/aya` falar em texto claro com um destino qualquer.
  if v_url !~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?(/.*)?$' then
    return 'url_invalida';
  end if;

  update public."TB_BRIDGE_AYA"
     set url = rtrim(v_url, '/'),
         atualizado_em = now()
   where id;

  return 'ok';
end;
$function$;

CREATE OR REPLACE FUNCTION public.registrar_evento_acesso(p_evento text, p_tela text DEFAULT NULL::text, p_origem text DEFAULT NULL::text, p_detalhes jsonb DEFAULT '{}'::jsonb, p_client_session_id text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text, p_app_version text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth'
 SET statement_timeout TO '1500ms'
AS $function$
declare
  v_id bigint;
  v_evento text;
begin
  v_evento := nullif(btrim(p_evento), '');

  if v_evento is null then
    raise exception 'Evento de acesso nao informado';
  end if;

  v_id := nextval('public.eventos_acesso_id_seq'::regclass);

  insert into public."TL_EVENTO_ACESSO"(
    id,
    user_id,
    evento,
    tela,
    origem,
    detalhes,
    client_session_id,
    user_agent,
    app_version
  )
  values (
    v_id,
    auth.uid(),
    left(v_evento, 200),
    nullif(btrim(p_tela), ''),
    nullif(btrim(p_origem), ''),
    coalesce(p_detalhes, '{}'::jsonb),
    nullif(btrim(p_client_session_id), ''),
    nullif(btrim(p_user_agent), ''),
    nullif(btrim(p_app_version), '')
  );

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.registrar_presenca_monitora(p_current_view text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_email text := coalesce(auth.jwt() ->> 'email', '');
begin
  if v_user_id is null then
    raise exception 'Sessao nao localizada.' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public."TB_PERFIL_USUARIO" p
    where p.ativo is true
      and (
        p.user_id = v_user_id
        or lower(p.email) = lower(v_email)
      )
  ) then
    raise exception 'Perfil institucional nao localizado.' using errcode = 'P0002';
  end if;

  insert into public."TB_PRESENCA_ONLINE_MONITORA" (user_id, current_view, seen_at)
  values (v_user_id, left(nullif(trim(p_current_view), ''), 120), timezone('utc', now()))
  on conflict (user_id) do update
    set current_view = excluded.current_view,
        seen_at = excluded.seen_at;

  return jsonb_build_object('status', 'OK');
end;
$function$;

CREATE OR REPLACE FUNCTION public.remover_lista_aprovados(p_lista_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_edital_id text;
begin
  if private.monitora_role() <> 'admin' then raise exception 'Somente admin pode remover lista de aprovados'; end if;
  update public."TB_LISTA_APROVADO"
  set vigente = false, ativo = false, substituido_por = (select auth.uid()),
      substituido_em = now(), updated_at = now()
  where id = p_lista_id and vigente is true
  returning edital_id into v_edital_id;
  if not found then raise exception 'Lista vigente nao encontrada'; end if;
  return jsonb_build_object('ok', true, 'lista_id', p_lista_id, 'edital_id', v_edital_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.remover_sub_judice(p_candidato_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text := private.monitora_role();
  v_lista_id uuid;
  v_ativo boolean;
begin
  if v_role not in ('contratador', 'admin') then raise exception 'Perfil sem permissao para remover sub judice'; end if;

  select c.lista_id, l.ativo into v_lista_id, v_ativo
  from public."TB_CANDIDATO_APROVADO" c
  join public."TB_LISTA_APROVADO" l on l.id = c.lista_id and l.vigente is true
  where c.id = p_candidato_id and c.sub_judice is true and c.removido_em is null
  for update of c, l;
  if not found then raise exception 'Candidato sub judice vigente nao encontrado'; end if;
  if not v_ativo then raise exception 'A lista esta inativa e nao permite remover sub judice'; end if;

  update public."TB_CANDIDATO_APROVADO"
  set removido_em = now(), removido_por = (select auth.uid()),
      updated_by = (select auth.uid()), updated_at = now()
  where id = p_candidato_id;

  return jsonb_build_object('ok', true, 'candidato_id', p_candidato_id, 'lista_id', v_lista_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.restaurar_configuracoes_versao(p_versao_id uuid, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth'
 SET lock_timeout TO '5s'
AS $function$
declare
  r jsonb;
  v_target public."TH_CONFIGURACAO"%rowtype;
  v_id uuid;
  v_config_antes jsonb;
  v_config_depois jsonb;
  v_paineis_antes jsonb;
  v_paineis_depois jsonb;
  v_alteracoes jsonb;
  v_total integer;
begin
  if not private.has_perm('config') then
    raise exception 'Sem permissao para restaurar "TB_CONFIGURACAO"';
  end if;

  if p_versao_id is null then
    raise exception 'Versao obrigatoria';
  end if;

  if not pg_try_advisory_xact_lock(hashtext('public.salvar_configuracoes_e_paineis_v2')::bigint) then
    raise exception 'Outra publicacao de "TB_CONFIGURACAO" esta em andamento. Aguarde e tente novamente.';
  end if;

  select * into v_target
  from public."TH_CONFIGURACAO"
  where id = p_versao_id;

  if not found then
    raise exception 'Versao de "TB_CONFIGURACAO" nao encontrada';
  end if;

  v_config_antes := private.snapshot_configuracoes();
  v_paineis_antes := private.snapshot_paineis_externos();
  v_alteracoes := private.diff_configuracoes_e_paineis(v_target.config_depois, v_target.paineis_depois);
  v_total := jsonb_array_length(v_alteracoes);

  if v_total = 0 then
    return jsonb_build_object(
      'ok', true,
      'sem_alteracoes', true,
      'total_alteracoes', 0,
      'versao_id', null,
      'restaurada_de', p_versao_id
    );
  end if;

  for r in select * from jsonb_array_elements(v_target.config_depois) loop
    insert into public."TB_CONFIGURACAO"(chave, valor, descricao)
    values (r ->> 'chave', r ->> 'valor', r ->> 'descricao')
    on conflict (chave) do update
      set valor = excluded.valor,
          descricao = excluded.descricao,
          updated_at = now();
  end loop;

  for r in select * from jsonb_array_elements(v_target.paineis_depois) loop
    update public."TB_PAINEL_EXTERNO"
    set titulo = coalesce(nullif(r ->> 'titulo', ''), titulo),
        url = r ->> 'url',
        ativo = coalesce((r ->> 'ativo')::boolean, ativo),
        em_manutencao = coalesce((r ->> 'em_manutencao')::boolean, em_manutencao),
        updated_at = now()
    where id = nullif(r ->> 'id', '')::uuid;
  end loop;

  v_config_depois := private.snapshot_configuracoes();
  v_paineis_depois := private.snapshot_paineis_externos();

  insert into public."TH_CONFIGURACAO"(
    acao,
    motivo,
    created_by,
    created_by_email,
    restaurada_de,
    config_antes,
    config_depois,
    paineis_antes,
    paineis_depois,
    alteracoes,
    total_alteracoes
  ) values (
    'restaurar',
    coalesce(nullif(btrim(p_motivo), ''), 'RestauraÃ§Ã£o de versÃ£o anterior'),
    auth.uid(),
    nullif(auth.jwt() ->> 'email', ''),
    p_versao_id,
    v_config_antes,
    v_config_depois,
    v_paineis_antes,
    v_paineis_depois,
    v_alteracoes,
    v_total
  ) returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'sem_alteracoes', false,
    'total_alteracoes', v_total,
    'versao_id', v_id,
    'restaurada_de', p_versao_id,
    'alteracoes', v_alteracoes,
    'restaurado_em', now()
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.revogar_paineis_usuario(p_perfil_usuario_id uuid, p_paineis uuid[] DEFAULT NULL::uuid[], p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private', 'auth'
AS $function$
declare
  v_total integer := 0;
  v_restantes integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if not private.is_master() then
    raise exception 'Somente perfil master pode revogar paineis';
  end if;

  if p_perfil_usuario_id is null then
    raise exception 'Perfil de usuario nao informado';
  end if;

  if p_paineis is null or coalesce(array_length(p_paineis, 1), 0) = 0 then
    update public."RL_PERFIL_USUARIO_PAINEL_EXT"
    set ativo = false,
        updated_at = now()
    where perfil_usuario_id = p_perfil_usuario_id
      and ativo is true;
  else
    update public."RL_PERFIL_USUARIO_PAINEL_EXT"
    set ativo = false,
        updated_at = now()
    where perfil_usuario_id = p_perfil_usuario_id
      and painel_id = any(p_paineis)
      and ativo is true;
  end if;

  get diagnostics v_total = row_count;

  select count(*)::integer into v_restantes
  from public."RL_PERFIL_USUARIO_PAINEL_EXT"
  where perfil_usuario_id = p_perfil_usuario_id
    and ativo is true;

  if v_restantes = 0 then
    update public."TB_PERFIL_USUARIO"
    set p_paineis = false,
        updated_at = now()
    where id = p_perfil_usuario_id;
  end if;

  return jsonb_build_object('ok', true, 'perfil_usuario_id', p_perfil_usuario_id, 'paineis_revogados', v_total, 'paineis_ativos_restantes', v_restantes, 'motivo', nullif(btrim(p_motivo), ''));
end;
$function$;

CREATE OR REPLACE FUNCTION public.salvar_configuracoes_e_paineis(p_config_rows jsonb, p_paineis jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth'
AS $function$
declare
  r jsonb;
begin
  if not private.has_perm('config') then
    raise exception 'Sem permissao para salvar "TB_CONFIGURACAO"';
  end if;

  for r in select * from jsonb_array_elements(coalesce(p_config_rows, '[]'::jsonb)) loop
    insert into public."TB_CONFIGURACAO"(chave, valor, descricao)
    values (r ->> 'chave', r ->> 'valor', r ->> 'descricao')
    on conflict (chave) do update
      set valor = excluded.valor,
          descricao = excluded.descricao,
          updated_at = now();
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_paineis, '[]'::jsonb)) loop
    update public."TB_PAINEL_EXTERNO"
    set titulo = coalesce(nullif(r ->> 'titulo', ''), titulo),
        url = r ->> 'url',
        ativo = coalesce((r ->> 'ativo')::boolean, ativo),
        em_manutencao = coalesce((r ->> 'em_manutencao')::boolean, em_manutencao),
        updated_at = now()
    where id = nullif(r ->> 'id', '')::uuid;
  end loop;

  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.salvar_configuracoes_e_paineis_v2(p_config_rows jsonb, p_paineis jsonb, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth'
 SET lock_timeout TO '5s'
AS $function$
declare
  r jsonb;
  v_id uuid;
  v_config_antes jsonb;
  v_config_depois jsonb;
  v_paineis_antes jsonb;
  v_paineis_depois jsonb;
  v_alteracoes jsonb;
  v_total integer;
begin
  if not private.has_perm('config') then
    raise exception 'Sem permissao para salvar "TB_CONFIGURACAO"';
  end if;

  if not pg_try_advisory_xact_lock(hashtext('public.salvar_configuracoes_e_paineis_v2')::bigint) then
    raise exception 'Outra publicacao de "TB_CONFIGURACAO" esta em andamento. Aguarde e tente novamente.';
  end if;

  v_config_antes := private.snapshot_configuracoes();
  v_paineis_antes := private.snapshot_paineis_externos();
  v_alteracoes := private.diff_configuracoes_e_paineis(p_config_rows, p_paineis);
  v_total := jsonb_array_length(v_alteracoes);

  if v_total = 0 then
    return jsonb_build_object(
      'ok', true,
      'sem_alteracoes', true,
      'total_alteracoes', 0,
      'versao_id', null
    );
  end if;

  for r in select * from jsonb_array_elements(coalesce(p_config_rows, '[]'::jsonb)) loop
    if nullif(r ->> 'chave', '') is null then
      continue;
    end if;

    insert into public."TB_CONFIGURACAO"(chave, valor, descricao)
    values (r ->> 'chave', r ->> 'valor', r ->> 'descricao')
    on conflict (chave) do update
      set valor = excluded.valor,
          descricao = excluded.descricao,
          updated_at = now()
    where public."TB_CONFIGURACAO".valor is distinct from excluded.valor
       or public."TB_CONFIGURACAO".descricao is distinct from excluded.descricao;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_paineis, '[]'::jsonb)) loop
    update public."TB_PAINEL_EXTERNO"
    set titulo = coalesce(nullif(r ->> 'titulo', ''), titulo),
        url = r ->> 'url',
        ativo = coalesce((r ->> 'ativo')::boolean, ativo),
        em_manutencao = coalesce((r ->> 'em_manutencao')::boolean, em_manutencao),
        updated_at = now()
    where id = nullif(r ->> 'id', '')::uuid
      and (
        titulo is distinct from coalesce(nullif(r ->> 'titulo', ''), titulo)
        or url is distinct from (r ->> 'url')
        or ativo is distinct from coalesce((r ->> 'ativo')::boolean, ativo)
        or em_manutencao is distinct from coalesce((r ->> 'em_manutencao')::boolean, em_manutencao)
      );
  end loop;

  v_config_depois := private.snapshot_configuracoes();
  v_paineis_depois := private.snapshot_paineis_externos();

  insert into public."TH_CONFIGURACAO"(
    acao,
    motivo,
    created_by,
    created_by_email,
    config_antes,
    config_depois,
    paineis_antes,
    paineis_depois,
    alteracoes,
    total_alteracoes
  ) values (
    'salvar',
    nullif(btrim(p_motivo), ''),
    auth.uid(),
    nullif(auth.jwt() ->> 'email', ''),
    v_config_antes,
    v_config_depois,
    v_paineis_antes,
    v_paineis_depois,
    v_alteracoes,
    v_total
  ) returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'sem_alteracoes', false,
    'total_alteracoes', v_total,
    'versao_id', v_id,
    'alteracoes', v_alteracoes,
    'salvo_em', now()
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.salvar_monitoramento_com_cronograma(p_payload jsonb, p_cronograma jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth'
 SET lock_timeout TO '5s'
AS $function$
declare
  v_id uuid;
  v_row public."TB_MONITORAMENTO_INDIGENA"%rowtype;
  v_item jsonb;
  v_ordem integer := 0;
  v_auto boolean := coalesce((p_payload ->> 'cronograma_automatico')::boolean, false);
  v_total integer := jsonb_array_length(coalesce(p_cronograma,'[]'::jsonb));
  v_inicio date;
  v_fim date;
  v_estado jsonb;
begin
  if not private.has_perm('cores') then
    raise exception 'Sem permissao para salvar monitoramento indigena';
  end if;

  v_id := nullif(p_payload ->> 'id','')::uuid;

  if v_id is null then
    insert into public."TB_MONITORAMENTO_INDIGENA"(
      processo, edital, id_unidade, sigla_unidade, tipo_unidade, unidade, uf, ciclo,
      vagas_total, data_inicio, data_fim, status, etapa, risco, responsavel,
      link_edital, observacoes, observacoes_internas, ativo, created_by, updated_by,
      cronograma_automatico, cronograma_pdf_path, cronograma_pdf_nome, cronograma_origem,
      cronograma_revisado_at, cronograma_revisado_por, status_override, etapa_override
    ) values (
      nullif(p_payload ->> 'processo',''),
      nullif(p_payload ->> 'edital',''),
      nullif(p_payload ->> 'id_unidade',''),
      nullif(p_payload ->> 'sigla_unidade',''),
      nullif(p_payload ->> 'tipo_unidade',''),
      nullif(p_payload ->> 'unidade',''),
      nullif(upper(p_payload ->> 'uf'),''),
      nullif(p_payload ->> 'ciclo',''),
      coalesce(nullif(p_payload ->> 'vagas_total','')::integer,0),
      nullif(p_payload ->> 'data_inicio','')::date,
      nullif(p_payload ->> 'data_fim','')::date,
      nullif(p_payload ->> 'status',''),
      nullif(p_payload ->> 'etapa',''),
      coalesce(nullif(p_payload ->> 'risco',''),'Baixo'),
      nullif(p_payload ->> 'responsavel',''),
      nullif(p_payload ->> 'link_edital',''),
      nullif(p_payload ->> 'observacoes',''),
      nullif(p_payload ->> 'observacoes_internas',''),
      true,
      auth.uid(), auth.uid(),
      v_auto,
      nullif(p_payload ->> 'cronograma_pdf_path',''),
      nullif(p_payload ->> 'cronograma_pdf_nome',''),
      nullif(p_payload ->> 'cronograma_origem',''),
      case when v_total > 0 then now() else null end,
      case when v_total > 0 then auth.uid() else null end,
      nullif(p_payload ->> 'status_override',''),
      nullif(p_payload ->> 'etapa_override','')
    ) returning * into v_row;
    v_id := v_row.id;
  else
    update public."TB_MONITORAMENTO_INDIGENA"
    set processo = nullif(p_payload ->> 'processo',''),
        edital = nullif(p_payload ->> 'edital',''),
        id_unidade = nullif(p_payload ->> 'id_unidade',''),
        sigla_unidade = nullif(p_payload ->> 'sigla_unidade',''),
        tipo_unidade = nullif(p_payload ->> 'tipo_unidade',''),
        unidade = nullif(p_payload ->> 'unidade',''),
        uf = nullif(upper(p_payload ->> 'uf'),''),
        ciclo = nullif(p_payload ->> 'ciclo',''),
        vagas_total = coalesce(nullif(p_payload ->> 'vagas_total','')::integer,0),
        data_inicio = nullif(p_payload ->> 'data_inicio','')::date,
        data_fim = nullif(p_payload ->> 'data_fim','')::date,
        status = nullif(p_payload ->> 'status',''),
        etapa = nullif(p_payload ->> 'etapa',''),
        risco = coalesce(nullif(p_payload ->> 'risco',''),'Baixo'),
        responsavel = nullif(p_payload ->> 'responsavel',''),
        link_edital = nullif(p_payload ->> 'link_edital',''),
        observacoes = nullif(p_payload ->> 'observacoes',''),
        observacoes_internas = nullif(p_payload ->> 'observacoes_internas',''),
        updated_by = auth.uid(),
        updated_at = now(),
        cronograma_automatico = v_auto,
        cronograma_pdf_path = coalesce(nullif(p_payload ->> 'cronograma_pdf_path',''), cronograma_pdf_path),
        cronograma_pdf_nome = coalesce(nullif(p_payload ->> 'cronograma_pdf_nome',''), cronograma_pdf_nome),
        cronograma_origem = nullif(p_payload ->> 'cronograma_origem',''),
        cronograma_revisado_at = case when v_total > 0 then now() else cronograma_revisado_at end,
        cronograma_revisado_por = case when v_total > 0 then auth.uid() else cronograma_revisado_por end,
        status_override = nullif(p_payload ->> 'status_override',''),
        etapa_override = nullif(p_payload ->> 'etapa_override','')
    where id = v_id
    returning * into v_row;
  end if;

  if v_row.id is null then
    raise exception 'Registro nao encontrado ou nao salvo';
  end if;

  if p_cronograma is not null then
    delete from public."TB_CRONOGRAMA_MONIT_INDIG" where monitoramento_id = v_id;
    for v_item in select * from jsonb_array_elements(coalesce(p_cronograma,'[]'::jsonb)) loop
      v_ordem := v_ordem + 1;
      insert into public."TB_CRONOGRAMA_MONIT_INDIG"(
        monitoramento_id, ordem, atividade, tipo_atividade, data_inicio, data_fim,
        concluida, observacao, origem, confianca_extracao, created_by, updated_by
      ) values (
        v_id,
        coalesce(nullif(v_item ->> 'ordem','')::integer, v_ordem),
        nullif(v_item ->> 'atividade',''),
        nullif(v_item ->> 'tipo_atividade',''),
        (v_item ->> 'data_inicio')::date,
        (v_item ->> 'data_fim')::date,
        nullif(v_item ->> 'concluida','')::boolean,
        nullif(v_item ->> 'observacao',''),
        coalesce(nullif(upper(v_item ->> 'origem'),''),'MANUAL'),
        nullif(v_item ->> 'confianca_extracao','')::numeric,
        auth.uid(), auth.uid()
      );
    end loop;
  end if;

  if v_auto and v_total > 0 then
    select min(data_inicio), max(data_fim)
    into v_inicio, v_fim
    from public."TB_CRONOGRAMA_MONIT_INDIG"
    where monitoramento_id = v_id;

    update public."TB_MONITORAMENTO_INDIGENA"
    set data_inicio = v_inicio,
        data_fim = v_fim,
        updated_at = now()
    where id = v_id;
  end if;

  v_estado := public.get_monitoramento_cronograma_estado(v_id, current_date);

  update public."TB_MONITORAMENTO_INDIGENA"
  set status = coalesce(v_estado ->> 'status', status),
      etapa = coalesce(v_estado ->> 'etapa', etapa),
      updated_at = now()
  where id = v_id
  returning * into v_row;

  return jsonb_build_object(
    'ok', true,
    'registro', to_jsonb(v_row),
    'estado', v_estado,
    'cronograma_total', v_total
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.salvar_monitoramento_com_cronograma_v2(p_payload jsonb, p_cronograma jsonb DEFAULT '[]'::jsonb, p_motivo text DEFAULT NULL::text, p_numero_errata text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'pg_temp'
 SET lock_timeout TO '5s'
AS $function$
declare
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_result jsonb;
  v_antes jsonb := '[]'::jsonb;
  v_depois jsonb := '[]'::jsonb;
  v_alteracoes jsonb := '[]'::jsonb;
  v_total integer := 0;
  v_versao_id uuid;
  v_motivo text := nullif(btrim(p_motivo), '');
  v_errata text := nullif(btrim(p_numero_errata), '');
  v_override text := nullif(btrim(p_payload ->> 'status_override'), '');
  v_override_motivo text := nullif(btrim(p_payload ->> 'status_override_motivo'), '');
  v_override_data date := nullif(p_payload ->> 'status_override_data', '')::date;
begin
  if not private.has_perm('cores') then
    raise exception 'Sem permissao para salvar monitoramento indigena';
  end if;

  if v_motivo is null then
    raise exception 'Informe o motivo da alteraÃ§Ã£o do cronograma';
  end if;

  if jsonb_typeof(coalesce(p_cronograma, '[]'::jsonb)) <> 'array' then
    raise exception 'Cronograma invÃ¡lido';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_cronograma, '[]'::jsonb)) as x(
      ordem integer, atividade text, data_inicio date, data_fim date
    )
    where nullif(btrim(atividade), '') is null
       or data_inicio is null
       or data_fim is null
       or data_fim < data_inicio
  ) then
    raise exception 'Existem etapas incompletas ou com perÃ­odo invÃ¡lido';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_cronograma, '[]'::jsonb)) as x(atividade text)
    group by lower(btrim(atividade))
    having count(*) > 1
  ) then
    raise exception 'Existem atividades duplicadas no cronograma';
  end if;

  if v_override is not null and (v_override_motivo is null or v_override_data is null) then
    raise exception 'Status excepcional exige motivo e data da decisÃ£o';
  end if;

  if not pg_try_advisory_xact_lock(hashtext('cronograma:' || coalesce(v_id::text, auth.uid()::text, 'novo'))::bigint) then
    raise exception 'Outra alteraÃ§Ã£o deste cronograma estÃ¡ em andamento';
  end if;

  if v_id is not null then
    v_antes := private.snapshot_monitoramento_cronograma(v_id);
  end if;

  v_result := public.salvar_monitoramento_com_cronograma(p_payload, p_cronograma);
  v_id := nullif(v_result #>> '{registro,id}', '')::uuid;

  if v_id is null then
    raise exception 'O salvamento nÃ£o retornou o identificador do edital';
  end if;

  update public."TB_MONITORAMENTO_INDIGENA"
  set status_override_motivo = v_override_motivo,
      status_override_data = v_override_data,
      status_override_previsao_retomada = nullif(p_payload ->> 'status_override_previsao_retomada', '')::date,
      cronograma_ultima_errata = coalesce(v_errata, cronograma_ultima_errata),
      updated_by = auth.uid(),
      updated_at = now()
  where id = v_id;

  v_depois := private.snapshot_monitoramento_cronograma(v_id);
  v_alteracoes := private.diff_monitoramento_cronograma(v_antes, v_depois);
  v_total := jsonb_array_length(v_alteracoes);

  insert into public."TH_CRONOGRAMA_MONIT_INDIG"(
    monitoramento_id,
    acao,
    motivo,
    numero_errata,
    created_by,
    created_by_email,
    cronograma_antes,
    cronograma_depois,
    alteracoes,
    total_alteracoes
  ) values (
    v_id,
    case when v_errata is null then 'salvar' else 'errata' end,
    v_motivo,
    v_errata,
    auth.uid(),
    nullif(auth.jwt() ->> 'email', ''),
    v_antes,
    v_depois,
    v_alteracoes,
    v_total
  ) returning id into v_versao_id;

  return v_result || jsonb_build_object(
    'versao_id', v_versao_id,
    'total_alteracoes', v_total,
    'alteracoes', v_alteracoes,
    'motivo', v_motivo,
    'numero_errata', v_errata
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.salvar_monitoramento_indigena(p_payload jsonb)
 RETURNS "TB_MONITORAMENTO_INDIGENA"
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_id uuid;
  v_row public."TB_MONITORAMENTO_INDIGENA";
begin
  if not private.has_perm('cores') then
    raise exception 'Sem permissao para salvar monitoramento indigena';
  end if;

  v_id := nullif(p_payload ->> 'id', '')::uuid;

  if v_id is null then
    insert into public."TB_MONITORAMENTO_INDIGENA"(
      processo, edital, id_unidade, sigla_unidade, tipo_unidade, unidade, uf, ciclo,
      vagas_total, data_inicio, data_fim, status, etapa, risco, responsavel,
      link_edital, observacoes, observacoes_internas, ativo, created_by, updated_by
    ) values (
      nullif(p_payload ->> 'processo', ''),
      nullif(p_payload ->> 'edital', ''),
      nullif(p_payload ->> 'id_unidade', ''),
      nullif(p_payload ->> 'sigla_unidade', ''),
      nullif(p_payload ->> 'tipo_unidade', ''),
      nullif(p_payload ->> 'unidade', ''),
      nullif(upper(p_payload ->> 'uf'), ''),
      nullif(p_payload ->> 'ciclo', ''),
      coalesce(nullif(p_payload ->> 'vagas_total', '')::integer, 0),
      nullif(p_payload ->> 'data_inicio', '')::date,
      nullif(p_payload ->> 'data_fim', '')::date,
      nullif(p_payload ->> 'status', ''),
      nullif(p_payload ->> 'etapa', ''),
      coalesce(nullif(p_payload ->> 'risco', ''), 'Baixo'),
      nullif(p_payload ->> 'responsavel', ''),
      nullif(p_payload ->> 'link_edital', ''),
      nullif(p_payload ->> 'observacoes', ''),
      nullif(p_payload ->> 'observacoes_internas', ''),
      coalesce((p_payload ->> 'ativo')::boolean, true),
      auth.uid(),
      auth.uid()
    ) returning * into v_row;
  else
    update public."TB_MONITORAMENTO_INDIGENA"
    set
      processo = nullif(p_payload ->> 'processo', ''),
      edital = nullif(p_payload ->> 'edital', ''),
      id_unidade = nullif(p_payload ->> 'id_unidade', ''),
      sigla_unidade = nullif(p_payload ->> 'sigla_unidade', ''),
      tipo_unidade = nullif(p_payload ->> 'tipo_unidade', ''),
      unidade = nullif(p_payload ->> 'unidade', ''),
      uf = nullif(upper(p_payload ->> 'uf'), ''),
      ciclo = nullif(p_payload ->> 'ciclo', ''),
      vagas_total = coalesce(nullif(p_payload ->> 'vagas_total', '')::integer, 0),
      data_inicio = nullif(p_payload ->> 'data_inicio', '')::date,
      data_fim = nullif(p_payload ->> 'data_fim', '')::date,
      status = nullif(p_payload ->> 'status', ''),
      etapa = nullif(p_payload ->> 'etapa', ''),
      risco = coalesce(nullif(p_payload ->> 'risco', ''), 'Baixo'),
      responsavel = nullif(p_payload ->> 'responsavel', ''),
      link_edital = nullif(p_payload ->> 'link_edital', ''),
      observacoes = nullif(p_payload ->> 'observacoes', ''),
      observacoes_internas = nullif(p_payload ->> 'observacoes_internas', ''),
      ativo = coalesce((p_payload ->> 'ativo')::boolean, true),
      updated_by = auth.uid()
    where id = v_id
    returning * into v_row;
  end if;

  if v_row.id is null then
    raise exception 'Registro nao encontrado ou nao salvo';
  end if;

  return v_row;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_my_avatar_choice(p_source text, p_avatar_url text DEFAULT NULL::text, p_avatar_config jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(avatar_source text, avatar_url text, avatar_config jsonb, google_avatar_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
 SET statement_timeout TO '5s'
AS $function$
declare
  v_source text := upper(trim(coalesce(p_source, '')));
  v_url text := nullif(trim(coalesce(p_avatar_url, '')), '');
  v_config jsonb := coalesce(p_avatar_config, '{}'::jsonb);
begin
  if auth.uid() is null then
    raise exception 'SessÃ£o nÃ£o localizada.' using errcode = '28000';
  end if;

  if v_source not in ('GOOGLE', 'UPLOADED', 'GENERATED', 'INITIALS') then
    raise exception 'Origem de avatar invÃ¡lida.' using errcode = '22023';
  end if;

  if v_source in ('GOOGLE', 'UPLOADED')
    and (v_url is null or v_url !~* '^https://') then
    raise exception 'A imagem selecionada precisa usar HTTPS.' using errcode = '22023';
  end if;

  if v_url is not null and length(v_url) > 2048 then
    raise exception 'URL de avatar invÃ¡lida.' using errcode = '22023';
  end if;

  if jsonb_typeof(v_config) <> 'object' then
    raise exception 'ConfiguraÃ§Ã£o de avatar invÃ¡lida.' using errcode = '22023';
  end if;

  update public."TB_PERFIL_USUARIO" p
  set
    avatar_source = v_source,
    avatar_url = case
      when v_source in ('GOOGLE', 'UPLOADED') then v_url
      else null
    end,
    avatar_config = case
      when v_source = 'GENERATED' then v_config
      else p.avatar_config
    end,
    google_avatar_url = case
      when v_source = 'GOOGLE' then v_url
      else p.google_avatar_url
    end,
    updated_at = now()
  where p.ativo = true
    and (
      p.user_id = auth.uid()
      or lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );

  if not found then
    raise exception 'Perfil institucional nÃ£o localizado.' using errcode = 'P0002';
  end if;

  return query
  select
    p.avatar_source,
    p.avatar_url,
    p.avatar_config,
    coalesce(
      p.google_avatar_url,
      auth.jwt() -> 'user_metadata' ->> 'avatar_url',
      auth.jwt() -> 'user_metadata' ->> 'picture'
    )
  from public."TB_PERFIL_USUARIO" p
  where p.ativo = true
    and (
      p.user_id = auth.uid()
      or lower(p.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  limit 1;
end;
$function$;

CREATE OR REPLACE FUNCTION public.verificar_sync_analises_incremental(p_total_ativos_local integer)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO 'public', 'pg_temp'
 SET statement_timeout TO '10s'
AS $function$
  with remoto as (
    select count(*)::integer as qtd
    from public."TB_ANALISE_CURRICULAR" a
    join public."TB_EDITAL_ANALISE" e
      on a.grupo_norm=e.grupo_norm
     and a.unidade_norm=e.unidade_norm
     and a.edital_norm=e.edital_norm
    where a.ativo is true and e.ativo is true
  )
  select jsonb_build_object(
    'ok',true,
    'total_ativos_local',greatest(coalesce(p_total_ativos_local,0),0),
    'total_ativos_remoto',qtd,
    'reconciliacao_full_recomendada',qtd <> greatest(coalesce(p_total_ativos_local,0),0)
  )
  from remoto;
$function$;

commit;