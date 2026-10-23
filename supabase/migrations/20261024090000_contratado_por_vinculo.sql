/*
  CONTRATADO EM MAIS DE UMA VAGA: CONTAR VÍNCULOS, NÃO LINHAS (24/10/2026)

  O QUE MUDA PARA QUEM USA
  O aviso crítico "Contratado em duas vagas" (APROVADOS_CONTRATADO_DUPLICADO)
  contava as LINHAS Contratado da mesma pessoa nas listas vigentes. Quem
  concorre à cota concorre também à ampla, e a planilha marcava Contratado
  nas duas linhas com a MESMA matrícula; e quem foi recontratado por outro
  edital, com outra matrícula, também caía no aviso. Em 23/10/2026 eram 78
  casos (SEDE 3, Projetos 60, Saúde Indígena 15), quase todos assim.

  Agora o job (scripts/conferencias/regras.py) conta VÍNCULOS — a matrícula:
    - crítico só quando a pessoa tem duas ou mais matrículas Contratado no
      MESMO edital;
    - a mesma matrícula em mais de uma linha vira o aviso de atenção
      APROVADOS_MESMA_MATRICULA_EM_DUAS_LINHAS ("deixar Contratado só na
      lista pela qual a pessoa foi contratada");
    - editais diferentes com matrículas diferentes (recontratação) não geram
      aviso: o MONITORA não tem a data de admissão nem a de desligamento.
  O aviso antigo que deixar de valer é resolvido pela própria rodada da
  conferência (finalizar_conferencia resolve o que a rodada não viu).

  O QUE ESTA MIGRATION FAZ
  conferencia_ler_aprovados() passa a devolver, em cada candidato, 'vinculo':
  o hash (sha256) da matrícula normalizada — só letras e dígitos, maiúsculas,
  sem zeros à esquerda —, nulo se não há matrícula. A matrícula não sai do
  banco. O resto da leitura, o SECURITY DEFINER, o search_path vazio e o
  acesso só de service_role ficam como estavam (20261007230000).

  Ensaio: supabase/ensaios/20261024090000_contratado_por_vinculo.sql.
  Rollback: supabase/rollback/20261024090000_contratado_por_vinculo.sql.
*/
begin;

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

commit;
