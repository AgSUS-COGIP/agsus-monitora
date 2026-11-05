/*
  ÁREA NAS LEITURAS DA API (service_role)

  Pedido de 05/11/2026: o outro sistema quer saber se cada edital (e cada
  aprovado e etapa) é da Saúde Indígena, da SEDE ou de Projetos. As três
  leituras da API ganham o campo "area" = TB_AREA.NO_AREA, pelo CO_AREA do
  edital (left join: edital sem área sai com area nula, não some).

  Mesmo corpo de antes (20261105150000 e 20261105170000), só com a linha
  'area' depois de 'unidade' e o left join em TB_AREA. CREATE OR REPLACE
  mantém as permissões (só service_role).

  Ensaio: supabase/ensaios/20261105190000_area_na_api.sql
  Rollback: supabase/rollback/20261105190000_area_na_api.sql
*/
begin;

set local lock_timeout = '5s';

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.listar_editais_da_api()') is null
     or to_regprocedure('public.listar_aprovados_da_api()') is null
     or to_regprocedure('public.listar_cronograma_da_api()') is null then
    raise exception 'Aplique antes 20261105150000 e 20261105170000.';
  end if;
end;
$$;

-- 1. listar_editais_da_api -------------------------------------------------------------
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
        'area', a."NO_AREA",
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
      left join public."TB_AREA" a on a."CO_AREA" = m."CO_AREA"
     cross join lateral private."FC_ESTADO_DO_CRONOGRAMA"(m.id, ((now() AT TIME ZONE 'America/Sao_Paulo'::text))::date) e(estado)
     where m.ativo is true), '[]'::jsonb));
$function$;
comment on function public.listar_editais_da_api() is
  'API de editais para outro sistema (/api/editais, 20261105170000; área em 20261105190000): { linhas } com id, unidade, area, edital, status, etapa, vagas_total, contratados, vagas_ociosas, risco e link_edital dos editais ativos (todas as áreas). status e etapa como na VW_MONITORAMENTO_INDIGENA_OPERACIONAL (estado do cronograma no dia de Brasília). area = TB_AREA.NO_AREA (Saúde Indígena, SEDE, Projetos). Só service_role.';

-- 2. listar_aprovados_da_api -------------------------------------------------------------
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
        'area', a."NO_AREA",
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
      left join public."TB_AREA" a on a."CO_AREA" = m."CO_AREA"
      join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id
     where l.vigente is true
       and m.ativo is true
       and c.removido_em is null), '[]'::jsonb));
$function$;
comment on function public.listar_aprovados_da_api() is
  'API de aprovados para outro sistema (/api/aprovados, 20261105150000; área em 20261105190000): { linhas } com edital_id, edital, unidade, area, cargo, classificacao, nota, nome, modalidade, status, matricula, processo_sei, codigo_vaga e sub_judice da lista vigente de cada edital ativo (candidatos não removidos). area = TB_AREA.NO_AREA. Dados pessoais: só service_role.';

-- 3. listar_cronograma_da_api -------------------------------------------------------------
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
        'area', a."NO_AREA",
        'ordem', c.ordem,
        'atividade', c.atividade,
        'data_inicio', c.data_inicio,
        'data_fim', c.data_fim
      ) order by m.unidade, m.edital, c.ordem)
      from public."TB_CRONOGRAMA_MONIT_INDIG" c
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = c.monitoramento_id
      left join public."TB_AREA" a on a."CO_AREA" = m."CO_AREA"
     where m.ativo is true), '[]'::jsonb));
$function$;
comment on function public.listar_cronograma_da_api() is
  'API de cronograma para outro sistema (/api/cronograma, 20261105150000; área em 20261105190000): { linhas } com edital_id, edital, unidade, area, ordem, atividade, data_inicio e data_fim das etapas de cada edital ativo. area = TB_AREA.NO_AREA. Só service_role.';

commit;
