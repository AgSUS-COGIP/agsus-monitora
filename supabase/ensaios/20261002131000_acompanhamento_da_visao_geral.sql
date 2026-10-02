/*
  ENSAIO — 20261002131000_acompanhamento_da_visao_geral.sql

  Numa transação desfeita no fim (rollback): cria a função, chama como um
  usuário real e confere. Troque o e-mail abaixo por alguém com a Visão geral
  e a área pedida (e, se quiser, por alguém sem a área: deve dar 42501).

  O que conferir:
  1. quantas etapas e listas por área e o tamanho do json (deve ser pequeno);
  2. Pós-resultado: concluídos sem lista vigente, listas sem nenhum status,
     desistentes — os números do bloco novo da tela;
  3. a mesma chamada como usuário comum.
*/
begin;

-- ===========================================================================
-- Migration (sem begin/commit)
-- ===========================================================================

create function public.listar_acompanhamento_da_visao_geral(p_area text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
set statement_timeout to '5s'
as $function$
declare
  v_area text := lower(btrim(coalesce(p_area, '')));
  v_editais uuid[];
begin
  if not private.pode_recurso('dashboard') then
    raise exception 'Sem permissão para este recurso' using errcode = '42501';
  end if;
  if not (v_area = any ((select private."FC_AREAS_USUARIO"())::text[])) then
    raise exception 'Sem permissão para esta área' using errcode = '42501';
  end if;

  select coalesce(array_agg(m.id), '{}') into v_editais
    from public."TB_MONITORAMENTO_INDIGENA" m
   where m.ativo
     and m."CO_AREA" = v_area
     and ((select private."FC_EDITAIS_VISIVEIS"()) is null
          or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]));

  return jsonb_build_object(
    'etapas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'monitoramento_id', c.monitoramento_id,
               'ordem', c.ordem,
               'atividade', c.atividade,
               'data_inicio', c.data_inicio,
               'data_fim', c.data_fim
             ) order by c.monitoramento_id, c.data_inicio, c.ordem)
        from public."TB_CRONOGRAMA_MONIT_INDIG" c
       where c.monitoramento_id = any (v_editais)
    ), '[]'::jsonb),
    'listas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'monitoramento_id', r.edital_id,
               'aprovados', r.aprovados,
               'com_status', r.com_status,
               'contratados', r.contratados,
               'desistentes', r.desistentes
             ) order by r.edital_id)
        from (
          select l.edital_id,
                 count(c.id)::integer as aprovados,
                 (count(c.id) filter (where nullif(btrim(c.status), '') is not null))::integer as com_status,
                 (count(c.id) filter (where c.status in ('Contratado', 'Migração')))::integer as contratados,
                 (count(c.id) filter (where c.status = 'Desistente'))::integer as desistentes
            from public."TB_LISTA_APROVADO" l
            left join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
           where l.vigente is true
             and l.edital_id = any (select unnest(v_editais)::text)
           group by l.edital_id
        ) r
    ), '[]'::jsonb)
  );
end;
$function$;
comment on function public.listar_acompanhamento_da_visao_geral(text) is
  'Visão geral de uma área (só leitura): as etapas do cronograma e, por edital com lista de aprovados vigente, as contagens de aprovados, com status, contratados (Contratado/Migração) e desistentes. Recurso dashboard, área do usuário e recorte da coordenação.';
revoke all on function public.listar_acompanhamento_da_visao_geral(text) from public, anon;
grant execute on function public.listar_acompanhamento_da_visao_geral(text) to authenticated, service_role;


-- ===========================================================================
-- Conferências (como service_role: todas as áreas)
-- ===========================================================================
-- auth.role() lê o papel do JWT: como service_role, todas as áreas.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- 1. Tamanho por área.
select a."CO_AREA" as area,
       jsonb_array_length(r -> 'etapas') as etapas,
       jsonb_array_length(r -> 'listas') as listas,
       pg_size_pretty(length(r::text)::bigint) as tamanho
  from public."TB_AREA" a
 cross join lateral public.listar_acompanhamento_da_visao_geral(a."CO_AREA") r
 order by a."NU_ORDEM";

-- 2. Pós-resultado por área.
with l as (
  select a."CO_AREA" as area, (x ->> 'monitoramento_id')::uuid as id,
         (x ->> 'aprovados')::int as aprovados, (x ->> 'com_status')::int as com_status,
         (x ->> 'desistentes')::int as desistentes
    from public."TB_AREA" a
   cross join lateral jsonb_array_elements(public.listar_acompanhamento_da_visao_geral(a."CO_AREA") -> 'listas') x
)
select v."CO_AREA" as area,
       count(*) filter (where lower(v.status) like 'conclu%' and l.id is null) as concluidos_sem_lista,
       count(*) filter (where l.aprovados > 0 and l.com_status = 0) as listas_sem_status,
       coalesce(sum(l.desistentes), 0) as desistentes,
       count(*) filter (where l.desistentes > 0) as editais_com_desistencia
  from public."VW_MONITORAMENTO_INDIGENA_OPERACIONAL" v
  left join l on l.id = v.id
 where v.ativo
 group by 1
 order by 1;

select set_config('request.jwt.claims', '', true);

-- 3. Como um usuário (troque o e-mail).
select set_config('request.jwt.claims',
  json_build_object('sub', u.id, 'role', 'authenticated')::text, true)
  from auth.users u where u.email = 'troque@agenciasus.org.br';
set local role authenticated;
select jsonb_array_length(public.listar_acompanhamento_da_visao_geral('saude-indigena') -> 'etapas') as etapas_si;
reset role;

rollback;
