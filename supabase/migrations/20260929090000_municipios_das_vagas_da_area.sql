/*
  Municípios das vagas de uma área, para o mapa da Visão geral de Projetos.

  Os editais de Projetos (TB_MONITORAMENTO_INDIGENA) não dizem onde ficam as
  vagas; quem diz é o nome da vaga nas análises curriculares ("… UBS móvel
  Seropédica/RJ …"). O painel de análises já lê o município com a mesma
  expressão (20260928200000), mas o payload dele traz uma linha por candidato —
  pesado demais para um mapa. Esta função devolve uma linha por município, só
  com as contagens que o mapa mostra.

  Só leitura. Permissão da Visão geral (`dashboard`) e a área tem de ser do
  usuário (ou o usuário ser admin): quem confere é FC_GRUPOS_ANALISES_DA_AREA,
  a mesma do painel de análises. Recorte igual ao do escopo "ativo" do painel:
  análise ativa e edital de análise ativo (ou sem cadastro). O índice
  IN_ANALISECURRICULAR_GRUPONORM (grupo_norm, ativo) cobre o recorte.

  Linha sem "UBS móvel <Município>/<UF>" no nome da vaga fica de fora: na SEDE
  e na Saúde Indígena a função devolve uma lista vazia.

  Rollback: supabase/rollback/20260929090000_municipios_das_vagas_da_area.sql
*/
begin;

create or replace function public.listar_municipios_das_vagas_da_area(p_area text)
returns json
language plpgsql
stable
security definer
set search_path to 'public', 'private', 'pg_temp'
set statement_timeout to '5s'
as $function$
declare
  v_grupos_norm text[];
begin
  if not private.pode_recurso('dashboard') then
    raise exception 'Sem permissão para este recurso' using errcode = '42501';
  end if;

  -- Valida a área e confere se ela é do usuário (ou se ele é admin).
  v_grupos_norm := private."FC_GRUPOS_ANALISES_DA_AREA"(p_area);

  return coalesce((
    select json_agg(json_build_object(
      'municipio_uf', m.municipio || '/' || m.uf,
      'municipio', m.municipio,
      'uf', m.uf,
      'vagas', m.vagas,
      'candidatos', m.candidatos,
      'aprovados', m.aprovados,
      'reprovados', m.reprovados
    ) order by m.uf, m.municipio)
    from (
      select
        btrim(mu.partes[1]) as municipio,
        mu.partes[2] as uf,
        count(distinct ac.codigo_vaga) as vagas,
        count(*) as candidatos,
        count(*) filter (where ac.status_consolidado ilike 'aprovad%') as aprovados,
        count(*) filter (where ac.status_consolidado ilike 'reprovad%') as reprovados
      from public."TB_ANALISE_CURRICULAR" ac
      left join public."TB_EDITAL_ANALISE" e
        on e.grupo_norm = ac.grupo_norm
       and e.unidade_norm = ac.unidade_norm
       and e.edital_norm = ac.edital_norm
      cross join lateral regexp_match(ac.nome_vaga, 'UBS m[óo]vel ([^/]+)/([A-Z]{2})') as mu(partes)
      where ac.grupo_norm = any (v_grupos_norm)
        and ac.ativo is true
        and coalesce(e.ativo, true) is true
        and btrim(mu.partes[1]) <> ''
      group by 1, 2
    ) m
  ), '[]'::json);
end;
$function$;

comment on function public.listar_municipios_das_vagas_da_area(text) is
  'Municípios das vagas da área (UBS móvel no nome da vaga), com vagas, candidatos, aprovados e reprovados. Mapa da Visão geral de Projetos.';

revoke all on function public.listar_municipios_das_vagas_da_area(text) from public, anon;
grant execute on function public.listar_municipios_das_vagas_da_area(text) to authenticated, service_role;

commit;
