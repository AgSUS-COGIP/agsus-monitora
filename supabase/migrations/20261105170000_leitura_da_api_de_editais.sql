/*
  LEITURA DA API DE EDITAIS (service_role)

  GET /api/editais (api/editais.js) lia `listar_monitoramento_operacional`
  com a chave de servidor. Essa RPC é SECURITY INVOKER (lê a
  VW_MONITORAMENTO_INDIGENA_OPERACIONAL com a permissão de quem chama, para
  valer a RLS da tela), e o service_role não tem SELECT na view: em produção,
  42501 (05/11/2026).

  Em vez de dar ao service_role leitura nas tabelas, a API ganha uma leitura
  própria, como as de aprovados e cronograma (20261105150000):

  public.listar_editais_da_api() → jsonb { linhas: [...] }
    as linhas ATIVAS da VW_MONITORAMENTO_INDIGENA_OPERACIONAL (todas as
    áreas), só com os campos da API: id, unidade, edital, status, etapa,
    vagas_total, contratados, vagas_ociosas, risco e link_edital.
    SECURITY DEFINER; só service_role executa.

  Só leitura. A tela continua com listar_monitoramento_operacional.

  Ensaio: supabase/ensaios/20261105170000_leitura_da_api_de_editais.sql
  Rollback: supabase/rollback/20261105170000_leitura_da_api_de_editais.sql
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

commit;
