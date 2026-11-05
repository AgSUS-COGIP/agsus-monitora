/*
  ENSAIO de 20261105150000_leituras_da_api_de_aprovados_e_cronograma.sql — begin … rollback.

  Cole no SQL Editor do Supabase (papel postgres). Aplica a migration dentro
  da transação e confere:
    1. as duas leituras devolvem { linhas } com exatamente os campos combinados;
    2. aprovados: uma linha por candidato não removido da lista vigente de
       edital ativo; cronograma: uma linha por etapa de edital ativo;
    3. só service_role executa (anon e authenticated, não).
*/
begin;


set local lock_timeout = '5s';

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public."TB_LISTA_APROVADO"') is null
     or to_regclass('public."TB_CANDIDATO_APROVADO"') is null
     or to_regclass('public."TB_CRONOGRAMA_MONIT_INDIG"') is null
     or to_regclass('public."TB_MONITORAMENTO_INDIGENA"') is null then
    raise exception 'Faltam TB_LISTA_APROVADO, TB_CANDIDATO_APROVADO, TB_CRONOGRAMA_MONIT_INDIG ou TB_MONITORAMENTO_INDIGENA.';
  end if;
end;
$$;

-- 1. Lista de aprovados ----------------------------------------------------------------
create function public.listar_aprovados_da_api()
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
comment on function public.listar_aprovados_da_api() is
  'API de aprovados para outro sistema (/api/aprovados, 20261105150000): { linhas } com edital_id, edital, unidade, cargo, classificacao, nota, nome, modalidade, status, matricula, processo_sei, codigo_vaga e sub_judice da lista vigente de cada edital ativo (candidatos não removidos). Dados pessoais: só service_role.';
revoke all on function public.listar_aprovados_da_api() from public, anon, authenticated;
grant execute on function public.listar_aprovados_da_api() to service_role;

-- 2. Cronograma ------------------------------------------------------------------------
create function public.listar_cronograma_da_api()
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
comment on function public.listar_cronograma_da_api() is
  'API de cronograma para outro sistema (/api/cronograma, 20261105150000): { linhas } com edital_id, edital, unidade, ordem, atividade, data_inicio e data_fim das etapas de cada edital ativo. Só service_role.';
revoke all on function public.listar_cronograma_da_api() from public, anon, authenticated;
grant execute on function public.listar_cronograma_da_api() to service_role;


-- Conferências --------------------------------------------------------------------------
do $$
declare
  v_aprovados jsonb := public.listar_aprovados_da_api() -> 'linhas';
  v_cronograma jsonb := public.listar_cronograma_da_api() -> 'linhas';
  v_esperado integer;
begin
  select count(*) into v_esperado
    from public."TB_LISTA_APROVADO" l
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
    join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id
   where l.vigente is true and m.ativo is true and c.removido_em is null;
  if jsonb_array_length(v_aprovados) <> v_esperado then
    raise exception 'ENSAIO: % aprovados, esperado %', jsonb_array_length(v_aprovados), v_esperado;
  end if;
  if v_esperado > 0 and (select array_agg(k order by k) from jsonb_object_keys(v_aprovados -> 0) k)
       <> array['cargo', 'classificacao', 'codigo_vaga', 'edital', 'edital_id', 'matricula',
                'modalidade', 'nome', 'nota', 'processo_sei', 'status', 'sub_judice', 'unidade'] then
    raise exception 'ENSAIO: campos dos aprovados diferentes do combinado';
  end if;

  select count(*) into v_esperado
    from public."TB_CRONOGRAMA_MONIT_INDIG" c
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id = c.monitoramento_id
   where m.ativo is true;
  if jsonb_array_length(v_cronograma) <> v_esperado then
    raise exception 'ENSAIO: % etapas, esperado %', jsonb_array_length(v_cronograma), v_esperado;
  end if;
  if v_esperado > 0 and (select array_agg(k order by k) from jsonb_object_keys(v_cronograma -> 0) k)
       <> array['atividade', 'data_fim', 'data_inicio', 'edital', 'edital_id', 'ordem', 'unidade'] then
    raise exception 'ENSAIO: campos do cronograma diferentes do combinado';
  end if;

  if has_function_privilege('anon', 'public.listar_aprovados_da_api()', 'execute')
     or has_function_privilege('authenticated', 'public.listar_aprovados_da_api()', 'execute')
     or has_function_privilege('anon', 'public.listar_cronograma_da_api()', 'execute')
     or has_function_privilege('authenticated', 'public.listar_cronograma_da_api()', 'execute') then
    raise exception 'ENSAIO: anon/authenticated não deveriam executar as leituras da API';
  end if;
  if not has_function_privilege('service_role', 'public.listar_aprovados_da_api()', 'execute')
     or not has_function_privilege('service_role', 'public.listar_cronograma_da_api()', 'execute') then
    raise exception 'ENSAIO: service_role deveria executar as leituras da API';
  end if;
end;
$$;

select 'ok' as ensaio_das_leituras_da_api;

rollback;
