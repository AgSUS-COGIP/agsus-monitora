-- ROLLBACK de supabase/migrations/20261008220000_observacao_e_justificativa_da_entrevista.sql
-- As funções voltam como estavam no banco em 08/10/2026 (conferidas por
-- pg_get_functiondef antes da migration: iguais às de 20261008170000); a
-- tabela das observações e a coluna da justificativa saem (o texto escrito
-- nelas se perde; o histórico em TH_ENTREVISTA_AVALIACAO fica).
begin;

set local lock_timeout = '10s';

CREATE OR REPLACE FUNCTION public.lancar_notas_entrevista(p_entrevista uuid, p_dados jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_e public."TB_ENTREVISTA";
  v_cfg public."TB_ENTREVISTA_EDITAL";
  v_r public."TB_ROTEIRO_ENTREVISTA";
  v_eu uuid;
  v_admin boolean := private.is_master();
  x jsonb;
  y jsonb;
  v_comp public."TB_ROTEIRO_COMPETENCIA";
  v_av public."TB_ENTREVISTA_AVALIADOR";
  v_nota numeric;
  v_ant numeric;
  v_comp_novo text := nullif(p_dados ->> 'compareceu', '');
  v_qt_aspectos integer;
  v_aspectos jsonb;
  v_aspecto uuid;
  v_ant_txt text;
  v_novo_txt text;
begin
  select * into v_e from public."TB_ENTREVISTA" where "CO_ENTREVISTA" = p_entrevista and "TP_ORIGEM" = 'sistema' and "ST_ATIVO" = 'S';
  if v_e."CO_ENTREVISTA" is null then raise exception 'Convocado não encontrado' using errcode = '22023'; end if;
  perform private."FC_EXIGIR_ENTREVISTAS_EDITAL"(v_e."CO_MONITORAMENTO", 2);
  select * into v_cfg from public."TB_ENTREVISTA_EDITAL" where "CO_MONITORAMENTO" = v_e."CO_MONITORAMENTO";
  select * into v_r from public."TB_ROTEIRO_ENTREVISTA" where "CO_ROTEIRO" = v_e."CO_ROTEIRO";
  select p.id into v_eu from private.current_profile() p;
  select count(*) into v_qt_aspectos from public."TB_ROTEIRO_ASPECTO" s where s."CO_ROTEIRO" = v_e."CO_ROTEIRO";

  -- Banca da entrevista: grava mesmo sem mudar o comparecimento.
  if nullif(p_dados ->> 'banca', '') is not null
     and (p_dados ->> 'banca')::smallint is distinct from v_e."NU_BANCA" then
    update public."TB_ENTREVISTA" set "NU_BANCA" = (p_dados ->> 'banca')::smallint where "CO_ENTREVISTA" = p_entrevista;
  end if;

  if v_comp_novo is not null then
    if v_comp_novo not in ('S', 'N') then raise exception 'Comparecimento inválido' using errcode = '22023'; end if;
    if v_comp_novo is distinct from v_e."ST_COMPARECEU" then
      update public."TB_ENTREVISTA" set "ST_COMPARECEU" = v_comp_novo, "NU_BANCA" = coalesce(nullif(p_dados ->> 'banca', '')::smallint, "NU_BANCA")
       where "CO_ENTREVISTA" = p_entrevista;
      insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
      values (p_entrevista, 'compareceu', v_e."ST_COMPARECEU", v_comp_novo, (select auth.uid()));
    end if;
  end if;

  for x in select value from jsonb_array_elements(coalesce(p_dados -> 'notas', '[]')) loop
    select * into v_comp from public."TB_ROTEIRO_COMPETENCIA" where "CO_COMPETENCIA" = (x ->> 'competencia')::uuid and "CO_ROTEIRO" = v_e."CO_ROTEIRO";
    if v_comp."CO_COMPETENCIA" is null then raise exception 'Competência não é do roteiro deste edital' using errcode = '22023'; end if;
    select * into v_av from public."TB_ENTREVISTA_AVALIADOR" where "CO_AVALIADOR" = (x ->> 'avaliador')::uuid and "CO_MONITORAMENTO" = v_e."CO_MONITORAMENTO" and "ST_ATIVO" = 'S';
    if v_av."CO_AVALIADOR" is null then raise exception 'Avaliador não é da banca deste edital' using errcode = '22023'; end if;
    if v_cfg."TP_LANCAMENTO" = 'AVALIADOR' and not v_admin and v_av."CO_PERFIL_USUARIO" is distinct from v_eu then
      raise exception 'Neste edital cada avaliador lança a própria nota' using errcode = '42501';
    end if;

    if v_qt_aspectos > 0 then
      -- Roteiro com aspectos: {aspectos: [{aspecto, nota}]} com todos os aspectos, ou nulo para apagar.
      if nullif(x ->> 'nota', '') is not null and not (x ? 'aspectos') then
        raise exception 'Este roteiro avalia por aspectos: informe a nota de cada aspecto' using errcode = '22023';
      end if;
      if x ? 'aspectos' and jsonb_typeof(x -> 'aspectos') not in ('array', 'null') then
        raise exception 'Aspectos: informe uma lista' using errcode = '22023';
      end if;
      v_aspectos := case when jsonb_typeof(x -> 'aspectos') = 'array' then x -> 'aspectos' end;
      select string_agg(trim_scale(a."VL_NOTA")::text, '; ' order by s."NU_ORDEM") into v_ant_txt
        from public."TB_ENTREVISTA_AVALIACAO_ASPECTO" a
        join public."TB_ROTEIRO_ASPECTO" s on s."CO_ASPECTO" = a."CO_ASPECTO"
       where a."CO_ENTREVISTA" = p_entrevista and a."CO_COMPETENCIA" = v_comp."CO_COMPETENCIA" and a."CO_AVALIADOR" = v_av."CO_AVALIADOR";
      if v_aspectos is null or not exists (select 1 from jsonb_array_elements(v_aspectos) z where nullif(z ->> 'nota', '') is not null) then
        -- Apagar: a nota do avaliador sai e leva as dos aspectos (on delete cascade).
        delete from public."TB_ENTREVISTA_AVALIACAO"
         where "CO_ENTREVISTA" = p_entrevista and "CO_COMPETENCIA" = v_comp."CO_COMPETENCIA" and "CO_AVALIADOR" = v_av."CO_AVALIADOR";
        if found then
          insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
          values (p_entrevista, v_comp."CO_COMPETENCIA", v_av."CO_AVALIADOR", 'aspectos', v_ant_txt, null, (select auth.uid()));
        end if;
        continue;
      end if;
      if not private."FC_AVALIADOR_AVALIA"(v_av."CO_AVALIADOR", v_comp."CO_COMPETENCIA") then
        raise exception '% não avalia "%" neste edital (a configuração da banca define as competências de cada avaliador)',
          v_av."NO_AVALIADOR", v_comp."NO_COMPETENCIA" using errcode = '23514';
      end if;
      for y in select value from jsonb_array_elements(v_aspectos) loop
        v_aspecto := nullif(y ->> 'aspecto', '')::uuid;
        if v_aspecto is null or not exists (select 1 from public."TB_ROTEIRO_ASPECTO" s
                                             where s."CO_ASPECTO" = v_aspecto and s."CO_ROTEIRO" = v_e."CO_ROTEIRO") then
          raise exception 'Aspecto não é do roteiro deste edital' using errcode = '22023';
        end if;
        v_nota := nullif(y ->> 'nota', '')::numeric;
        if v_nota is null then
          raise exception 'Informe a nota de todos os aspectos de % (ou apague todas)', v_comp."NO_COMPETENCIA" using errcode = '22023';
        end if;
        perform private."FC_EXIGIR_NOTA_NA_ESCALA"(v_e."CO_ROTEIRO", v_comp."CO_COMPETENCIA", v_nota);
      end loop;
      if jsonb_array_length(v_aspectos) <> v_qt_aspectos
         or (select count(distinct z ->> 'aspecto') from jsonb_array_elements(v_aspectos) z) <> v_qt_aspectos then
        raise exception 'Informe a nota de cada um dos % aspectos de %', v_qt_aspectos, v_comp."NO_COMPETENCIA" using errcode = '22023';
      end if;
      select string_agg(trim_scale((z ->> 'nota')::numeric)::text, '; ' order by s."NU_ORDEM"), round(avg((z ->> 'nota')::numeric), 2)
        into v_novo_txt, v_nota
        from jsonb_array_elements(v_aspectos) z
        join public."TB_ROTEIRO_ASPECTO" s on s."CO_ASPECTO" = (z ->> 'aspecto')::uuid;
      if v_ant_txt is not distinct from v_novo_txt then continue; end if;
      insert into public."TB_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "VL_NOTA", "CO_USUARIO_ATUALIZACAO")
      values (p_entrevista, v_comp."CO_COMPETENCIA", v_av."CO_AVALIADOR", v_nota, (select auth.uid()))
      on conflict ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR") do update set
        "VL_NOTA" = excluded."VL_NOTA", "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = excluded."CO_USUARIO_ATUALIZACAO";
      insert into public."TB_ENTREVISTA_AVALIACAO_ASPECTO" ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "CO_ASPECTO", "VL_NOTA", "CO_USUARIO_ATUALIZACAO")
      select p_entrevista, v_comp."CO_COMPETENCIA", v_av."CO_AVALIADOR", (z ->> 'aspecto')::uuid, (z ->> 'nota')::numeric, (select auth.uid())
        from jsonb_array_elements(v_aspectos) z
      on conflict ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "CO_ASPECTO") do update set
        "VL_NOTA" = excluded."VL_NOTA", "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = excluded."CO_USUARIO_ATUALIZACAO";
      insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
      values (p_entrevista, v_comp."CO_COMPETENCIA", v_av."CO_AVALIADOR", 'aspectos', v_ant_txt, v_novo_txt, (select auth.uid()));
      continue;
    end if;

    -- Roteiro sem aspectos: uma nota por avaliador (como antes).
    if jsonb_typeof(x -> 'aspectos') = 'array' and jsonb_array_length(x -> 'aspectos') > 0 then
      raise exception 'Este roteiro não avalia por aspectos' using errcode = '22023';
    end if;
    v_nota := nullif(x ->> 'nota', '')::numeric;
    if v_nota is null then
      select "VL_NOTA" into v_ant from public."TB_ENTREVISTA_AVALIACAO"
       where "CO_ENTREVISTA" = p_entrevista and "CO_COMPETENCIA" = v_comp."CO_COMPETENCIA" and "CO_AVALIADOR" = v_av."CO_AVALIADOR";
      if found then
        delete from public."TB_ENTREVISTA_AVALIACAO"
         where "CO_ENTREVISTA" = p_entrevista and "CO_COMPETENCIA" = v_comp."CO_COMPETENCIA" and "CO_AVALIADOR" = v_av."CO_AVALIADOR";
        insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
        values (p_entrevista, v_comp."CO_COMPETENCIA", v_av."CO_AVALIADOR", 'nota', v_ant::text, null, (select auth.uid()));
      end if;
      continue;
    end if;
    if not private."FC_AVALIADOR_AVALIA"(v_av."CO_AVALIADOR", v_comp."CO_COMPETENCIA") then
      raise exception '% não avalia "%" neste edital (a configuração da banca define as competências de cada avaliador)',
        v_av."NO_AVALIADOR", v_comp."NO_COMPETENCIA" using errcode = '23514';
    end if;
    perform private."FC_EXIGIR_NOTA_NA_ESCALA"(v_e."CO_ROTEIRO", v_comp."CO_COMPETENCIA", v_nota);
    select "VL_NOTA" into v_ant from public."TB_ENTREVISTA_AVALIACAO"
     where "CO_ENTREVISTA" = p_entrevista and "CO_COMPETENCIA" = v_comp."CO_COMPETENCIA" and "CO_AVALIADOR" = v_av."CO_AVALIADOR";
    if v_ant is not distinct from v_nota then continue; end if;
    insert into public."TB_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "VL_NOTA", "CO_USUARIO_ATUALIZACAO")
    values (p_entrevista, v_comp."CO_COMPETENCIA", v_av."CO_AVALIADOR", v_nota, (select auth.uid()))
    on conflict ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR") do update set
      "VL_NOTA" = excluded."VL_NOTA", "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = excluded."CO_USUARIO_ATUALIZACAO";
    insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
    values (p_entrevista, v_comp."CO_COMPETENCIA", v_av."CO_AVALIADOR", 'nota', v_ant::text, v_nota::text, (select auth.uid()));
  end loop;

  perform private."FC_CALCULAR_ENTREVISTA"(p_entrevista);
  return public.obter_entrevistas_do_edital(v_e."CO_MONITORAMENTO");
end;
$function$;

comment on function public.lancar_notas_entrevista(uuid, jsonb) is 'Lança/corrige notas ({notas:[{competencia, avaliador, nota|null}]}; roteiro com aspectos: {competencia, avaliador, aspectos:[{aspecto, nota}]|null}, todos os aspectos) e o comparecimento ({compareceu:S|N, banca}) de um convocado, valida a escala do roteiro, recusa (23514) a nota de avaliador em competência que não é dele, grava o histórico e recalcula o resultado. entrevistas >= editor; no modo AVALIADOR, só a própria nota.';

CREATE OR REPLACE FUNCTION public.obter_entrevistas_do_edital(p_edital uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text := private."FC_EXIGIR_ENTREVISTAS_EDITAL"(p_edital, 1);
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_cfg public."TB_ENTREVISTA_EDITAL";
  v_eu uuid;
  v_lista uuid := private."FC_LISTA_CONVOCACAO_VIGENTE"(p_edital);
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  select * into v_cfg from public."TB_ENTREVISTA_EDITAL" where "CO_MONITORAMENTO" = p_edital;
  select p.id into v_eu from private.current_profile() p;
  return json_build_object(
    'edital', json_build_object('id', v_m.id, 'edital', v_m.edital, 'unidade', v_m.unidade, 'area', v_area,
                               'treinamento', private."FC_EH_TREINAMENTO"(v_m."ST_TREINAMENTO")),
    'pode_editar', private.pode_recurso('entrevistas', 2),
    'pode_gerar_lista', private.pode_recurso('classificacao', 2),
    'admin_global', private.is_master(),
    'meu_perfil', v_eu,
    'configuracao', case when v_cfg."CO_MONITORAMENTO" is null then null else json_build_object(
        'roteiro', private."FC_ROTEIRO_JSON"(v_cfg."CO_ROTEIRO"), 'banca', v_cfg."DS_BANCA",
        'lancamento', v_cfg."TP_LANCAMENTO", 'atualizado_em', v_cfg."DT_ATUALIZACAO") end,
    'regra_classificacao', (
      select json_build_object('versao', r."NU_VERSAO_VIGENTE", 'convocacao', h."DS_CONFIGURACAO" -> 'convocacao',
                               'desempate', h."DS_CONFIGURACAO" -> 'desempate',
                               'empate_final', h."DS_CONFIGURACAO" -> 'empate_final')
        from public."TB_REGRA_CLASSIFICACAO" r
        join public."TH_REGRA_CLASSIFICACAO" h
          on h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
       where r."CO_MONITORAMENTO" = p_edital),
    'lista_convocacao', case when v_lista is null then null else json_build_object(
        'lista', private."FC_LISTA_CLASSIFICACAO_JSON"(v_lista),
        'retrato', (select l."DS_RESULTADO" from public."TB_LISTA_CLASSIFICACAO" l
                     where l."CO_LISTA_CLASSIFICACAO" = v_lista)) end,
    'avaliadores', coalesce((
      select json_agg(json_build_object('id', b."CO_AVALIADOR", 'nome', b."NO_AVALIADOR", 'origem', b."NO_ORIGEM",
               'banca', b."NU_BANCA", 'perfil', b."CO_PERFIL_USUARIO", 'ativo', b."ST_ATIVO" = 'S',
               -- As competências que o membro avalia (do roteiro do edital); nulo = todas.
               'competencias', (select json_agg(l."CO_COMPETENCIA" order by k."NU_ORDEM")
                   from public."TB_ENTREVISTA_AVALIADOR_COMPETENCIA" l
                   join public."TB_ROTEIRO_COMPETENCIA" k on k."CO_COMPETENCIA" = l."CO_COMPETENCIA"
                  where l."CO_AVALIADOR" = b."CO_AVALIADOR" and k."CO_ROTEIRO" = v_cfg."CO_ROTEIRO"))
             order by b."NU_BANCA", b."NO_ORIGEM", b."NO_AVALIADOR")
        from public."TB_ENTREVISTA_AVALIADOR" b where b."CO_MONITORAMENTO" = p_edital), '[]'::json),
    'convocados', coalesce((
      select json_agg(json_build_object('id', e."CO_ENTREVISTA", 'analise_id', e."CO_ANALISE_CURRICULAR",
               'candidato', e."NO_CANDIDATO", 'codigo', e."CO_CANDIDATO", 'vaga', e."CO_VAGA", 'cargo', e."NO_CARGO",
               'modalidade', e."DS_MODALIDADE", 'banca', e."NU_BANCA", 'compareceu', e."ST_COMPARECEU",
               'nota', e."VL_NOTA_TOTAL", 'parecer', e."TP_PARECER", 'nota_analise', a.nota_final_ajustada,
               'avaliacoes', coalesce((select json_agg(json_build_object('competencia', x."CO_COMPETENCIA",
                      'avaliador', x."CO_AVALIADOR", 'nota', x."VL_NOTA",
                      'aspectos', coalesce((select json_agg(json_build_object('aspecto', y."CO_ASPECTO", 'nota', y."VL_NOTA"))
                          from public."TB_ENTREVISTA_AVALIACAO_ASPECTO" y
                         where y."CO_ENTREVISTA" = x."CO_ENTREVISTA" and y."CO_COMPETENCIA" = x."CO_COMPETENCIA"
                           and y."CO_AVALIADOR" = x."CO_AVALIADOR"), '[]'::json)))
                   from public."TB_ENTREVISTA_AVALIACAO" x where x."CO_ENTREVISTA" = e."CO_ENTREVISTA"), '[]'::json),
               'notas', coalesce((select json_agg(json_build_array(n."NU_ORDEM", n."VL_NOTA") order by n."NU_ORDEM")
                   from public."TB_ENTREVISTA_NOTA" n where n."CO_ENTREVISTA" = e."CO_ENTREVISTA"), '[]'::json))
             order by e."CO_VAGA", e."NO_CANDIDATO")
        from public."TB_ENTREVISTA" e
        left join public."TB_ANALISE_CURRICULAR" a on a.id = e."CO_ANALISE_CURRICULAR"
       where e."CO_MONITORAMENTO" = p_edital and e."TP_ORIGEM" = 'sistema' and e."ST_ATIVO" = 'S'), '[]'::json)
  );
end;
$function$;

comment on function public.obter_entrevistas_do_edital(uuid) is
  'Condução da entrevista de um edital: configuração (roteiro, banca, lançamento), a lista de convocação vigente da Classificação com o retrato (lista_convocacao), a regra vigente da Classificação (convocação, desempate e empate final), banca (com as competências de cada membro; nulo = todas) e convocados com as notas; pode_editar, pode_gerar_lista, admin_global e meu_perfil.';

comment on column public."TH_ENTREVISTA_AVALIACAO"."DS_CAMPO" is 'nota, compareceu, convocacao ou desconvocacao.';

drop table public."TB_ENTREVISTA_OBSERVACAO_AVALIADOR";
alter table public."TB_ENTREVISTA" drop constraint "CK_ENTREVISTA_DSJUSTIFICATIVABANCA";
alter table public."TB_ENTREVISTA" drop column "DS_JUSTIFICATIVA_BANCA";

notify pgrst, 'reload schema';

commit;
