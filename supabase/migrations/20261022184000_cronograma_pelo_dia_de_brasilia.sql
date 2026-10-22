/*
  O CRONOGRAMA DO EDITAL PELO DIA DE BRASÍLIA

  Por quê: o banco roda em UTC. A VW_MONITORAMENTO_INDIGENA_OPERACIONAL (a
  leitura do monitoramento, listar_monitoramento_operacional) e o padrão de
  public.get_monitoramento_cronograma_estado(p_monitoramento_id, p_data)
  usavam CURRENT_DATE: das 21:00 às 23:59 de Brasília já era "amanhã", e a
  atividade atual, a próxima e os dias que faltam mudavam três horas antes.
  get_monitoramento_cronograma e get_nucleo_cronograma_resumo já passavam
  (now() at time zone 'America/Sao_Paulo')::date; a tela via um dia na visão
  geral e outro no Núcleo.

  O QUE MUDA
    - o padrão de p_data passa a ser o dia de Brasília (mesmo corpo);
    - a view chama a função com o dia de Brasília (mesmas colunas, mesma ordem,
      security_invoker como antes).
  salvar_monitoramento_com_cronograma (a v1, sem chamador; o front usa a _v2)
  ainda passa current_date: a limpeza das RPCs sem uso a remove.

  Dependentes: listar_monitoramento_operacional (lê a view), o front da visão
  geral e do mapa.
  Ensaio: supabase/ensaios/20261022184000_cronograma_pelo_dia_de_brasilia.sql
  Rollback: supabase/rollback/20261022184000_cronograma_pelo_dia_de_brasilia.sql
*/
begin;

CREATE OR REPLACE FUNCTION public.get_monitoramento_cronograma_estado(p_monitoramento_id uuid, p_data date DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo'::text))::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'pg_temp'
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
  if not ((private.pode_recurso('dashboard') or private.pode_recurso('nucleo') or private.pode_recurso('calendario') or private.pode_recurso('aprovados') or private.pode_recurso('importacao'))) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
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
    v_status := 'Concluído';
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
    COALESCE(((estado.estado ->> 'data_inicio'::text))::date, m.data_inicio) AS data_inicio,
    COALESCE(((estado.estado ->> 'data_fim'::text))::date, m.data_fim) AS data_fim,
    COALESCE((estado.estado ->> 'status'::text), m.status, ''::text) AS status,
    COALESCE((estado.estado ->> 'etapa'::text), m.etapa, ''::text) AS etapa,
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
    COALESCE(((estado.estado ->> 'percentual'::text))::numeric, (0)::numeric) AS cronograma_percentual,
    (estado.estado ->> 'atividade_atual'::text) AS cronograma_atividade_atual,
    (estado.estado ->> 'proxima_atividade'::text) AS cronograma_proxima_atividade,
    ((estado.estado ->> 'proxima_data'::text))::date AS cronograma_proxima_data,
    ((estado.estado ->> 'dias_para_proxima'::text))::integer AS cronograma_dias_para_proxima,
    m."CO_AREA",
    m."ST_TREINAMENTO"
   FROM ("TB_MONITORAMENTO_INDIGENA" m
     CROSS JOIN LATERAL get_monitoramento_cronograma_estado(m.id, ((now() AT TIME ZONE 'America/Sao_Paulo'::text))::date) estado(estado));

commit;
