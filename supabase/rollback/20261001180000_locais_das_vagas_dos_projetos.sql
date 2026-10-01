/*
  Desfaz 20261001180000_locais_das_vagas_dos_projetos.sql.

  Volta listar_municipios_das_vagas_da_area à versão de 20260929090000 (só o
  "UBS móvel" do nome da vaga, mesmo formato de antes) e apaga
  TB_LOCAL_VAGA_EDITAL — com os locais levantados dos PDFs. Para tê-los de
  novo, rode a migration e supabase/correcoes/20261001-locais-das-vagas-dos-projetos.sql.
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

drop table if exists public."TB_LOCAL_VAGA_EDITAL";

commit;
