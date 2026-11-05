/*
  Rollback de 20261105190000_area_na_api.sql.

  Devolve as três leituras da API ao corpo de 20261105150000 e
  20261105170000 (sem "area"). As permissões não mudam.
*/
begin;

set local lock_timeout = '5s';

create or replace function public.listar_editais_da_api()
returns jsonb
language sql
stable
security definer
set search_path to ''
set statement_timeout to '15s'
as $function$
  select jsonb_build_object('linhas', coalesce((
    select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'unidade', m.unidade,
        'edital', m.edital,
        'status', coalesce(e.estado ->> 'status', m.status, ''),
        'etapa', coalesce(e.estado ->> 'etapa', m.etapa, ''),
        'vagas_total', m.vagas_total,
        'contratados', m.contratados,
        'vagas_ociosas', m.vagas_ociosas,
        'risco', m.risco,
        'link_edital', m.link_edital
      ) order by m.unidade, m.edital)
      from public."TB_MONITORAMENTO_INDIGENA" m
     cross join lateral private."FC_ESTADO_DO_CRONOGRAMA"(m.id, ((now() AT TIME ZONE 'America/Sao_Paulo'::text))::date) e(estado)
     where m.ativo is true), '[]'::jsonb));
$function$;

create or replace function public.listar_aprovados_da_api()
returns jsonb
language sql
stable
security definer
set search_path to ''
set statement_timeout to '15s'
as $function$
  select jsonb_build_object('linhas', coalesce((
    select jsonb_agg(jsonb_build_object(
        'edital_id', m.id,
        'edital', m.edital,
        'unidade', m.unidade,
        'cargo', c.cargo,
        'classificacao', c.classificacao,
        'nota', c.nota,
        'nome', c.nome,
        'modalidade', c.modalidade,
        'status', c.status,
        'matricula', c.matricula,
        'processo_sei', c.processo_sei,
        'codigo_vaga', c.codigo_vaga,
        'sub_judice', c.sub_judice
      ) order by m.unidade, m.edital, c.cargo, c.classificacao nulls last, c.nome)
      from public."TB_LISTA_APROVADO" l
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
      join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id
     where l.vigente is true
       and m.ativo is true
       and c.removido_em is null), '[]'::jsonb));
$function$;

create or replace function public.listar_cronograma_da_api()
returns jsonb
language sql
stable
security definer
set search_path to ''
set statement_timeout to '15s'
as $function$
  select jsonb_build_object('linhas', coalesce((
    select jsonb_agg(jsonb_build_object(
        'edital_id', m.id,
        'edital', m.edital,
        'unidade', m.unidade,
        'ordem', c.ordem,
        'atividade', c.atividade,
        'data_inicio', c.data_inicio,
        'data_fim', c.data_fim
      ) order by m.unidade, m.edital, c.ordem)
      from public."TB_CRONOGRAMA_MONIT_INDIG" c
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = c.monitoramento_id
     where m.ativo is true), '[]'::jsonb));
$function$;

commit;
