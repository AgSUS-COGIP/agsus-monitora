/*
  ENSAIO de 20261105170000_leitura_da_api_de_editais.sql — begin … rollback.

  Cole no SQL Editor do Supabase (papel postgres). Aplica a migration dentro
  da transação e confere:
    1. uma linha por linha ativa da VW_MONITORAMENTO_INDIGENA_OPERACIONAL;
    2. exatamente os dez campos combinados;
    3. só service_role executa (anon e authenticated, não).
*/
begin;


set local lock_timeout = '5s';

-- 0. Pré-requisito ----------------------------------------------------------------------
do $$
begin
  if to_regclass('public."VW_MONITORAMENTO_INDIGENA_OPERACIONAL"') is null then
    raise exception 'Falta a VW_MONITORAMENTO_INDIGENA_OPERACIONAL (20261022200000).';
  end if;
end;
$$;

-- 1. A leitura --------------------------------------------------------------------------
create function public.listar_editais_da_api()
returns jsonb
language sql
stable
security definer
set search_path to ''
set statement_timeout to '15s'
as $function$
  select jsonb_build_object('linhas', coalesce((
    select jsonb_agg(jsonb_build_object(
        'id', v.id,
        'unidade', v.unidade,
        'edital', v.edital,
        'status', v.status,
        'etapa', v.etapa,
        'vagas_total', v.vagas_total,
        'contratados', v.contratados,
        'vagas_ociosas', v.vagas_ociosas,
        'risco', v.risco,
        'link_edital', v.link_edital
      ) order by v.unidade, v.edital)
      from public."VW_MONITORAMENTO_INDIGENA_OPERACIONAL" v
     where v.ativo is true), '[]'::jsonb));
$function$;
comment on function public.listar_editais_da_api() is
  'API de editais para outro sistema (/api/editais, 20261105170000): { linhas } com id, unidade, edital, status, etapa, vagas_total, contratados, vagas_ociosas, risco e link_edital das linhas ativas da VW_MONITORAMENTO_INDIGENA_OPERACIONAL (todas as áreas). Só service_role.';
revoke all on function public.listar_editais_da_api() from public, anon, authenticated;
grant execute on function public.listar_editais_da_api() to service_role;


-- Conferências --------------------------------------------------------------------------
do $$
declare
  v_linhas jsonb := public.listar_editais_da_api() -> 'linhas';
  v_esperado integer;
begin
  select count(*) into v_esperado
    from public."VW_MONITORAMENTO_INDIGENA_OPERACIONAL" v where v.ativo is true;
  if jsonb_array_length(v_linhas) <> v_esperado then
    raise exception 'ENSAIO: % editais, esperado %', jsonb_array_length(v_linhas), v_esperado;
  end if;
  if v_esperado > 0 and (select array_agg(k order by k) from jsonb_object_keys(v_linhas -> 0) k)
       <> array['contratados', 'edital', 'etapa', 'id', 'link_edital', 'risco',
                'status', 'unidade', 'vagas_ociosas', 'vagas_total'] then
    raise exception 'ENSAIO: campos dos editais diferentes do combinado';
  end if;
  if has_function_privilege('anon', 'public.listar_editais_da_api()', 'execute')
     or has_function_privilege('authenticated', 'public.listar_editais_da_api()', 'execute')
     or not has_function_privilege('service_role', 'public.listar_editais_da_api()', 'execute') then
    raise exception 'ENSAIO: só service_role deveria executar listar_editais_da_api';
  end if;
end;
$$;

select 'ok' as ensaio_da_leitura_da_api_de_editais;

rollback;
