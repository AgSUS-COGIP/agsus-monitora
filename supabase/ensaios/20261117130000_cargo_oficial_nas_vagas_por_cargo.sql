/*
  ENSAIO de 20261117130000_cargo_oficial_nas_vagas_por_cargo.sql

  Roda no banco ANTES de aplicar e termina em rollback: nada fica gravado. Troca a função e
  confere, sem sessão de usuário (a função pede auth.uid), a mesma consulta que ela faz: quantas
  vagas da Seleção e linhas do quadro da Saúde indígena ganham co_cargo, e que o corpo novo é o
  esperado (md5 0d36350d911b76999671df93fc2c3a4b).
  Ok = NOTICE "Ensaio 20261117130000 ok", e ROLLBACK.
*/
begin;

set local lock_timeout = '5s';

do $$
begin
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.listar_vagas_por_cargo_da_visao_geral(text,uuid[])')), chr(13), '')) is distinct from '33a1f1028fac2e59ec8b96fa74ebc94b' then
    raise exception 'listar_vagas_por_cargo_da_visao_geral: o corpo no banco não é o de 20261116120000 (md5).';
  end if;
  if to_regprocedure('private."FC_CARGO_DA_GRAFIA"(text,text)') is null then
    raise exception 'Falta private."FC_CARGO_DA_GRAFIA"(text, text) (20261104150000).';
  end if;
end;
$$;

CREATE OR REPLACE FUNCTION public.listar_vagas_por_cargo_da_visao_geral(p_area text, p_editais uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '10s'
AS $function$
declare
  v_area text := lower(btrim(coalesce(p_area, '')));
  v_visiveis uuid[];
  v_editais uuid[];
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

  return jsonb_build_object(
    'vagas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'monitoramento_id', s."CO_MONITORAMENTO",
               'codigo', s."CO_VAGA",
               'vaga', s."DS_VAGA_PLANILHA",
               'cargo', s."NO_CARGO",
               -- O cargo oficial (TD_CARGO) da grafia; nulo sem cadastro na área ou sem casamento único.
               'co_cargo', private."FC_CARGO_DA_GRAFIA"(s."NO_CARGO", v_area),
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
               'co_cargo', private."FC_CARGO_DA_GRAFIA"(q."NO_CARGO", v_area),
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
$function$;

do $$
declare
  v_vagas integer;
  v_vagas_com integer;
  v_quadro integer;
  v_quadro_com integer;
begin
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.listar_vagas_por_cargo_da_visao_geral(text,uuid[])')), chr(13), '')) is distinct from '0d36350d911b76999671df93fc2c3a4b' then
    raise exception 'Ensaio: o corpo novo não é o esperado.';
  end if;
  select count(*), count(private."FC_CARGO_DA_GRAFIA"(s."NO_CARGO", 'saude-indigena'))
    into v_vagas, v_vagas_com
    from public."TB_SELECAO_VAGA" s
   where s."ST_REGISTRO_ATIVO" = 'S' and s."CO_AREA" = 'saude-indigena';
  select count(*), count(private."FC_CARGO_DA_GRAFIA"(q."NO_CARGO", 'saude-indigena'))
    into v_quadro, v_quadro_com
    from public."TB_QUADRO_VAGA_EDITAL" q
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id = q."CO_MONITORAMENTO"
   where q."ST_REGISTRO_ATIVO" = 'S' and m."CO_AREA" = 'saude-indigena';
  if v_vagas > 0 and v_vagas_com = 0 then
    raise exception 'Ensaio: nenhuma vaga da Saúde indígena casou com o cadastro de cargos.';
  end if;
  raise notice 'Saúde indígena: % de % vagas da Seleção e % de % linhas do quadro com co_cargo.',
    v_vagas_com, v_vagas, v_quadro_com, v_quadro;
  raise notice 'Ensaio 20261117130000 ok';
end;
$$;

rollback;
