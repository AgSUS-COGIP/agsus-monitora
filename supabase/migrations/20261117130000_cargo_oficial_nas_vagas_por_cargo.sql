/*
  CARGO OFICIAL NAS VAGAS POR CARGO (17/11/2026)

  POR QUE
  A Visão geral conta uma vez só a vaga reaberta (src/lib/vagas-reabertas.ts): a vaga sem
  contratação de um edital com resultado, reaberta num edital mais novo do mesmo DSEI e do mesmo
  cargo, conta só no novo. O "mesmo cargo" era comparado só pelo texto, e grafias diferentes do
  mesmo cargo ("AISAN" × "Agente Indígena de Saneamento", "ENFERMEIRA (A)" × "ENFERMEIRO")
  viravam cargos diferentes: a vaga reaberta voltava a contar duas vezes.

  O QUE MUDA
    - public.listar_vagas_por_cargo_da_visao_geral: cada vaga da Seleção e cada linha do quadro
      trazem `co_cargo`, o cargo oficial (TD_CARGO) pela grafia (private."FC_CARGO_DA_GRAFIA",
      nome oficial ou apelido confirmado da área). Nulo na SEDE e em Projetos (sem cargos
      cadastrados) e na grafia sem casamento único; aí a Visão geral compara pelo texto.
      Nada mais muda (mesmos campos, permissões e recorte). Medido em produção (só leitura,
      17/11/2026): ~1 s para as 2.836 vagas da Saúde indígena; o limite da função é 10 s.

  GUARDA:    o corpo de 20261116120000 (md5 do prosrc) e FC_CARGO_DA_GRAFIA presente.
  DESFAZER:  supabase/rollback/20261117130000_cargo_oficial_nas_vagas_por_cargo.sql.
  ENSAIO:    supabase/ensaios/20261117130000_cargo_oficial_nas_vagas_por_cargo.sql.
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

COMMENT ON FUNCTION public.listar_vagas_por_cargo_da_visao_geral(p_area text, p_editais uuid[]) IS 'Aba 2 do relatório da diretoria (montador da Visão geral, só leitura): dos editais pedidos que a pessoa vê, as vagas da Seleção com inscritos, o quadro de vagas do edital e as contagens da lista vigente por vaga. Sem dado pessoal. Desde 20261117130000, as vagas e o quadro trazem co_cargo (FC_CARGO_DA_GRAFIA, cadastro oficial da área), para a Visão geral contar uma vez a vaga reaberta. Recurso dashboard, área do usuário e recorte da coordenação (20261116120000).';

commit;
