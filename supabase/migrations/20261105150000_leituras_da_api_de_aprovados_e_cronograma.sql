/*
  LEITURAS DA API DE APROVADOS E CRONOGRAMA (service_role)

  Pedido de 05/11/2026: além dos editais (GET /api/editais), o outro sistema
  lê a Lista de aprovados e o Cronograma, sem login, pela mesma chave fixa
  (EDITAIS_API_CHAVE). As funções da Vercel (api/aprovados.js e
  api/cronograma.js) chamam estas RPCs com a chave de servidor
  (SUPABASE_SERVICE_ROLE_KEY). As RPCs das telas não servem: exigem sessão e
  permissão da pessoa (pode_recurso, FC_AREAS_USUARIO).

  public.listar_aprovados_da_api() → jsonb { linhas: [...] }
    a lista VIGENTE de cada edital ativo, candidatos não removidos:
    edital_id, edital, unidade, cargo, classificacao, nota, nome, modalidade,
    status, matricula, processo_sei, codigo_vaga, sub_judice.
    Contém dados pessoais (nome, matrícula): só service_role executa.

  public.listar_cronograma_da_api() → jsonb { linhas: [...] }
    as etapas do cronograma de cada edital ativo:
    edital_id, edital, unidade, ordem, atividade, data_inicio, data_fim.

  Só leitura. edital_id é o mesmo "id" de /api/editais.

  Ensaio: supabase/ensaios/20261105150000_leituras_da_api_de_aprovados_e_cronograma.sql
  Rollback: supabase/rollback/20261105150000_leituras_da_api_de_aprovados_e_cronograma.sql
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

commit;
