-- ENSAIO de supabase/migrations/20261024090000_contratado_por_vinculo.sql: roda o corpo e desfaz (rollback).
-- Esperado: conferencia_ler_aprovados traz 'vinculo' (hash de 64 hex) em todo Contratado com matrícula, nulo sem
-- matrícula; as outras chaves e as pendências iguais às de antes; nenhuma matrícula em claro na saída; a RPC
-- continua SECURITY DEFINER e só para service_role. O resultado (json) traz só verdadeiro/falso e números.
begin;

create temporary table t_antes on commit drop as select public.conferencia_ler_aprovados() as j;

-- ═══ CORPO DA MIGRATION (início) ═══


set local lock_timeout = '5s';

do $$
begin
  if to_regprocedure('public.conferencia_ler_aprovados()') is null
     or to_regprocedure('private."FC_EH_TREINAMENTO"(text)') is null then
    raise exception 'Aplique antes 20261007230000_edital_de_treinamento.sql.';
  end if;
end;
$$;

create or replace function public.conferencia_ler_aprovados()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
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
             'nome:' || lower(regexp_replace(btrim(c.nome), '\s+', ' ', 'g'))), 'UTF8')), 'hex') as pessoa,
           -- O vínculo é a matrícula (uma por contratação), em hash: a matrícula não sai do banco.
           encode(sha256(convert_to('vinculo:' || nullif(ltrim(upper(
             regexp_replace(coalesce(c.matricula, ''), '[^0-9A-Za-z]', '', 'g')), '0'), ''), 'UTF8')), 'hex') as vinculo
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
          'convocado_em', c."DT_CONVOCACAO", 'pessoa', c.pessoa, 'vinculo', c.vinculo)), '[]'::jsonb)
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

revoke all on function public.conferencia_ler_aprovados() from public, anon, authenticated;
grant execute on function public.conferencia_ler_aprovados() to service_role;

comment on function public.conferencia_ler_aprovados() is
  'Conferências (job Python): convocados e contratados das listas de aprovados vigentes (id, lista, edital, status, data da convocação, um hash da pessoa — código do candidato ou nome normalizado — e um hash do vínculo — a matrícula normalizada —, para achar a mesma pessoa com duas matrículas no mesmo edital e a mesma matrícula em duas linhas) e, das listas publicadas pela Classificação, as pendências da publicação ainda sem desfecho (ids). Sem nome, CPF nem matrícula. Só service_role.';

-- ═══ CORPO DA MIGRATION (fim) ═══

create temporary table t_depois on commit drop as select public.conferencia_ler_aprovados() as j;

with antes as (select x - 'vinculo' as c from t_antes, jsonb_array_elements(j -> 'candidatos') x),
     depois as (select x as c from t_depois, jsonb_array_elements(j -> 'candidatos') x),
     contratados as (
       select d.c, o.matricula
         from depois d join public."TB_CANDIDATO_APROVADO" o on o.id = (d.c ->> 'id')::uuid
        where d.c ->> 'status' = 'Contratado')
select json_build_object(
  'candidatos', (select count(*) from depois),
  'todos_tem_a_chave_vinculo', (select bool_and(c ? 'vinculo') from depois),
  'mesmas_linhas_e_chaves_de_antes', (select count(*) from antes) = (select count(*) from depois)
     and not exists (select c from antes except select c - 'vinculo' from depois),
  'pendencias_iguais', (select j -> 'pendencias' from t_antes) = (select j -> 'pendencias' from t_depois),
  'contratados', (select count(*) from contratados),
  'contratados_com_vinculo', (select count(*) from contratados where c ->> 'vinculo' ~ '^[0-9a-f]{64}$'),
  'contratados_sem_matricula_e_sem_vinculo', (select count(*) from contratados
     where nullif(btrim(coalesce(matricula, '')), '') is null and c -> 'vinculo' = 'null'::jsonb),
  'vinculos_distintos', (select count(distinct c ->> 'vinculo') from contratados),
  'matricula_em_claro_na_saida', exists (
     select 1 from contratados where nullif(btrim(coalesce(matricula, '')), '') is not null
        and position(btrim(matricula) in c::text) > 0 and length(btrim(matricula)) >= 4),
  'security_definer', (select prosecdef from pg_proc where oid = 'public.conferencia_ler_aprovados()'::regprocedure),
  'search_path_vazio', (select proconfig = array['search_path=""'] from pg_proc
     where oid = 'public.conferencia_ler_aprovados()'::regprocedure),
  'so_service_role', not has_function_privilege('authenticated', 'public.conferencia_ler_aprovados()', 'execute')
     and not has_function_privilege('anon', 'public.conferencia_ler_aprovados()', 'execute')
     and has_function_privilege('service_role', 'public.conferencia_ler_aprovados()', 'execute')
) as ensaio;

rollback;
