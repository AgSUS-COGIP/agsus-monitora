/*
  ÁREA NA VIEW OPERACIONAL DOS EDITAIS (etapa 5, parte 4)

  O front lê os editais por VW_MONITORAMENTO_INDIGENA_OPERACIONAL, que não tinha
  "CO_AREA". Com a coluna, o painel da Saúde Indígena passa a separar os editais
  pela área do banco em vez da regra ehEditalDaSaudeIndigena (responsável +
  lista de unidades do CORES no front).

  CREATE OR REPLACE VIEW só acrescenta a coluna no fim (as views que dependem
  desta continuam válidas). security_invoker é repetido porque o REPLACE
  redefine as opções da view.

  ROLLBACK: impossível remover coluna com CREATE OR REPLACE; recriar a view sem
  "CO_AREA" exige derrubar as dependentes. A coluna a mais é inofensiva.
*/
begin;

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
    m."CO_AREA"
   FROM public."TB_MONITORAMENTO_INDIGENA" m
     CROSS JOIN LATERAL public.get_monitoramento_cronograma_estado(m.id, CURRENT_DATE) estado(estado);

commit;
