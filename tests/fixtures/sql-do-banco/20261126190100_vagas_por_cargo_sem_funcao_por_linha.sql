/*
  VAGAS POR CARGO SEM FUNÇÃO POR LINHA (26/11/2026)

  POR QUE
  listar_vagas_por_cargo_da_visao_geral (a Visão geral, a tela inicial, e a página do edital)
  leva 2,8 s em média e 9,8 s no pior caso: é a RPC mais lenta do pg_stat_statements desde 16/11.
  Ela chamava private."FC_CARGO_DA_GRAFIA" (SECURITY DEFINER, com SET: nunca expandida) em cada
  linha de TB_SELECAO_VAGA e de TB_QUADRO_VAGA_EDITAL. Medido em 26/11/2026, Saúde Indígena:
  2.836 vagas e 2.610 nomes distintos; a função por linha leva 781 ms só nas vagas (~0,28 ms por
  chamada), e chamá-la uma vez por nome distinto (595 ms) quase não ganha. O plano dela usa o
  índice IN_TDCARGO_AREA_NOME: o custo é a chamada em si
  (docs/_arquivo/consultas-lentas-2026-11-26.md).

  O QUE MUDA
    - O cargo oficial de cada nome sai de uma consulta só, por junção: os nomes distintos das
      vagas e do quadro dos editais pedidos, normalizados uma vez (FC_NORMALIZAR_GRAFIA_CARGO),
      contra os cargos ativos da área (nome normalizado) e os apelidos confirmados e ativos da
      área (de cargo ativo). Vale o cargo quando casa com um só; senão, nulo. É a regra de
      FC_CARGO_DA_GRAFIA com p_area não nulo (aqui a área é sempre a pedida).
    - 'co_cargo' das vagas e do quadro lê esse mapa. A saída é a mesma; assinatura, permissões,
      ordem e comentário não mudam. FC_CARGO_DA_GRAFIA fica como está (outros a usam). Nenhum
      índice novo.
    - O piso desta forma é FC_NORMALIZAR_GRAFIA_CARGO uma vez por nome distinto: o ensaio traz o
      EXPLAIN do mapa novo para comparar com os 781 ms.

  GUARDA: o corpo de listar_vagas_por_cargo_da_visao_geral é o do retrato de 26/11/2026 (md5 do
  prosrc sem \r).
  Ensaio: supabase/ensaios/20261126190100_vagas_por_cargo_sem_funcao_por_linha.sql
  Rollback: supabase/rollback/20261126190100_vagas_por_cargo_sem_funcao_por_linha.sql
  Teste: tests/repositorio-e-banco.test.ts (bloco consultas-lentas-no-banco)
*/

begin;

set local lock_timeout = '5s';

do $guarda$
begin
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.listar_vagas_por_cargo_da_visao_geral(text, uuid[])')), E'\r', ''))
       is distinct from '0d36350d911b76999671df93fc2c3a4b' then
    raise exception 'listar_vagas_por_cargo_da_visao_geral mudou desde 26/11/2026: refaça a migration a partir do banco' using errcode = '55000';
  end if;
end
$guarda$;

create or replace function public.listar_vagas_por_cargo_da_visao_geral(p_area text, p_editais uuid[]) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    SET statement_timeout TO '10s'
    AS $$
declare
  v_area text := lower(btrim(coalesce(p_area, '')));
  v_visiveis uuid[];
  v_editais uuid[];
  -- Nome do cargo (como veio na vaga ou no quadro) -> o cargo oficial da área, ou nulo.
  v_cargos jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Sessão não localizada.' using errcode = '28000';
  end if;
  if not private.pode_recurso('dashboard') then
    raise exception 'Sem permissão para este recurso' using errcode = '42501';
  end if;
  if not (v_area = any ((select private."FC_AREAS_USUARIO"())::text[])) then
    raise exception 'Sem permissão para esta área' using errcode = '42501';
  end if;
  if cardinality(coalesce(p_editais, '{}'::uuid[])) > 1000 then
    raise exception 'Editais demais para um relatório.' using errcode = '22023';
  end if;

  -- Só os editais pedidos que a pessoa vê; os outros ficam de fora, sem erro.
  v_visiveis := private."FC_EDITAIS_VISIVEIS"();
  select coalesce(array_agg(m.id), '{}') into v_editais
    from public."TB_MONITORAMENTO_INDIGENA" m
   where m.id = any (coalesce(p_editais, '{}'::uuid[]))
     and m."CO_AREA" = v_area
     and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
     and (v_visiveis is null or m.id = any (v_visiveis));

  /*
    O cargo oficial de cada nome, de uma vez (26/11/2026): era private."FC_CARGO_DA_GRAFIA"
    por linha de vaga e de quadro, ~0,28 ms cada (2.836 vagas e 2.610 nomes distintos na Saúde
    Indígena: 0,8 s só nas vagas). A regra é a da função: a grafia normalizada do nome casa
    com o nome normalizado de um cargo ativo da área ou com um apelido confirmado e ativo da
    área (de cargo ativo); vale só se casar com um cargo só, senão nulo.
  */
  with nomes as (
    select s."NO_CARGO"::text as nome
      from public."TB_SELECAO_VAGA" s
     where s."ST_REGISTRO_ATIVO" = 'S'
       and s."CO_MONITORAMENTO" = any (v_editais)
       and s."NO_CARGO" is not null
    union
    select q."NO_CARGO"::text
      from public."TB_QUADRO_VAGA_EDITAL" q
     where q."ST_REGISTRO_ATIVO" = 'S'
       and q."CO_MONITORAMENTO" = any (v_editais)
       and q."NO_CARGO" is not null
  ),
  grafias as materialized (
    select n.nome, private."FC_NORMALIZAR_GRAFIA_CARGO"(n.nome) as grafia from nomes n
  ),
  oficiais as materialized (
    select c."CO_CARGO", private."FC_NORMALIZAR_GRAFIA_CARGO"(c."NO_CARGO") as grafia
      from public."TD_CARGO" c
     where c."ST_REGISTRO_ATIVO" = 'S'
       and c."CO_AREA" = v_area
    union
    select a."CO_CARGO", a."DS_GRAFIA_NORMALIZADA"::text
      from public."TD_CARGO_APELIDO" a
      join public."TD_CARGO" c on c."CO_CARGO" = a."CO_CARGO" and c."ST_REGISTRO_ATIVO" = 'S'
     where a."ST_REGISTRO_ATIVO" = 'S'
       and a."ST_CONFIRMADO" = 'S'
       and a."CO_AREA" = v_area
  )
  select coalesce(jsonb_object_agg(x.nome, x.co_cargo), '{}'::jsonb)
    into v_cargos
    from (select g.nome,
                 case when count(distinct o."CO_CARGO") = 1 then min(o."CO_CARGO") end as co_cargo
            from grafias g
            left join oficiais o on o.grafia = g.grafia
           group by g.nome) x;

  return jsonb_build_object(
    'vagas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'monitoramento_id', s."CO_MONITORAMENTO",
               'codigo', s."CO_VAGA",
               'vaga', s."DS_VAGA_PLANILHA",
               'cargo', s."NO_CARGO",
               -- O cargo oficial (TD_CARGO) da grafia; nulo sem cadastro na área ou sem casamento único.
               'co_cargo', (v_cargos ->> s."NO_CARGO"::text)::integer,
               'unidade', s."NO_UNIDADE",
               'inscritos', s."QT_INSCRITO"
             ) order by s."CO_MONITORAMENTO", s."DS_VAGA_PLANILHA")
        from public."TB_SELECAO_VAGA" s
       where s."ST_REGISTRO_ATIVO" = 'S'
         and s."CO_MONITORAMENTO" = any (v_editais)
    ), '[]'::jsonb),
    'quadro', coalesce((
      select jsonb_agg(jsonb_build_object(
               'monitoramento_id', q."CO_MONITORAMENTO",
               'cargo', q."NO_CARGO",
               'co_cargo', (v_cargos ->> q."NO_CARGO"::text)::integer,
               'lotacao', q."NO_LOTACAO",
               'vagas', q."QT_VAGA_IMEDIATA",
               'reserva', q."ST_CADASTRO_RESERVA" = 'S'
             ) order by q."CO_MONITORAMENTO", q."NU_ORDEM")
        from public."TB_QUADRO_VAGA_EDITAL" q
       where q."ST_REGISTRO_ATIVO" = 'S'
         and q."CO_MONITORAMENTO" = any (v_editais)
    ), '[]'::jsonb),
    'lista', coalesce((
      select jsonb_agg(jsonb_build_object(
               'monitoramento_id', r.edital_id,
               'codigo_vaga', r.codigo_vaga,
               'cargo', r.cargo,
               'aprovados', r.aprovados
             ) order by r.edital_id, r.codigo_vaga, r.cargo)
        from (
          select l.edital_id, c.codigo_vaga, c.cargo, count(*)::integer as aprovados
            from public."TB_LISTA_APROVADO" l
            join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
           where l.vigente is true
             and l.edital_id = any (array(select e::text from unnest(v_editais) e))
           group by l.edital_id, c.codigo_vaga, c.cargo
        ) r
    ), '[]'::jsonb)
  );
end;
$$;

commit;
