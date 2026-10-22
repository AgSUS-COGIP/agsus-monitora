/*
  ENSAIO de 20261008130000_conduzir_entrevistas_no_menu.sql (e da
  20261008130500_liga_aba_conduzir_entrevistas.sql) — begin … rollback.

  Cole no SQL Editor do Supabase (papel postgres). Aplica as duas e confere
  (cada falha para com "FALHOU En"; o resultado é a última consulta):
    E1  menu: Painel de entrevistas (7), Conduzir entrevistas (8, recurso
        entrevistas, nas três áreas), Classificação 9, Aprovados 10, Seleção 11;
    E2  obter_entrevistas_do_edital, como admin sintético, num edital com
        regra de classificação com desempate: desempate e empate_final iguais
        aos da versão vigente; convocação e as outras chaves de sempre;
    E3  TB_ROTEIRO_ENTREVISTA.DS_DESEMPATE continua no banco.
  O resultado traz também listar_abas_do_menu(), para conferir com
  tests/fixtures/listar-abas-do-menu.json (a fixture é o seed; no banco real,
  uma aba desligada numa área em Configurações › Módulos e abas some dela).
  Termina em ROLLBACK.
*/
begin;

set local lock_timeout = '10s';

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from public."TB_ABA" where "CO_ABA" = 'entrevistas') then
    raise exception 'Catálogo de abas sem a aba entrevistas (20260929235000_entrevistas.sql).';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'obter_entrevistas_do_edital'
                    and pg_get_functiondef(p.oid) like '%TB_ENTREVISTA_AVALIACAO_ASPECTO%') then
    raise exception 'Aplique antes 20261008100000_aspectos_da_entrevista.sql.';
  end if;
end;
$$;

-- 1. Menu: o painel muda de rótulo; Conduzir entrevistas entra desligada -----------------
update public."TB_ABA" set "NO_ABA" = 'Painel de entrevistas', "DT_ATUALIZACAO" = now() where "CO_ABA" = 'entrevistas';

update public."TB_ABA" set "NU_ORDEM" = 9, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'classificacao';
update public."TB_ABA" set "NU_ORDEM" = 10, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'aprovados';
update public."TB_ABA" set "NU_ORDEM" = 11, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'selecao';

insert into public."TB_ABA" ("CO_ABA", "NO_ABA", "DS_ICONE", "NU_ORDEM", "CO_VIEW", "CO_RECURSO", "TP_ABA", "ST_ATIVO", "ST_BETA")
values ('conduzir-entrevistas', 'Conduzir entrevistas', 'clipboard-pen-line', 8, 'conduzir-entrevistas', 'entrevistas', 'nativa', 'N', 'S');
insert into public."RL_ABA_AREA" ("CO_ABA", "CO_AREA", "ST_ATIVO")
select 'conduzir-entrevistas', a."CO_AREA", 'S' from public."TB_AREA" a
on conflict do nothing;

-- 2. obter_entrevistas_do_edital: o desempate da regra de classificação -------------------
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
               'banca', b."NU_BANCA", 'perfil', b."CO_PERFIL_USUARIO", 'ativo', b."ST_ATIVO" = 'S') order by b."NU_BANCA", b."NO_ORIGEM", b."NO_AVALIADOR")
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
  'Condução da entrevista de um edital: configuração (roteiro, banca, lançamento), a lista de convocação vigente da Classificação com o retrato (lista_convocacao), a regra vigente da Classificação (convocação, desempate e empate final), banca e convocados com as notas; pode_editar, pode_gerar_lista, admin_global e meu_perfil.';


-- ── Ensaio: 20261008130500_liga_aba_conduzir_entrevistas.sql (junto) ─────
update public."TB_ABA" set "ST_ATIVO" = 'S', "DT_ATUALIZACAO" = now() where "CO_ABA" = 'conduzir-entrevistas';

create temp table ensaio_resultado (passo text, ok boolean, detalhe text) on commit drop;

-- E1. Menu: rótulo do painel, aba nova na 8 (recurso entrevistas, nas três áreas), ordem das seguintes.
do $$
begin
  if (select "NO_ABA" from public."TB_ABA" where "CO_ABA" = 'entrevistas') <> 'Painel de entrevistas' then
    raise exception 'FALHOU E1: rótulo do painel';
  end if;
  if not exists (select 1 from public."TB_ABA" where "CO_ABA" = 'conduzir-entrevistas' and "NU_ORDEM" = 8
                    and "CO_VIEW" = 'conduzir-entrevistas' and "CO_RECURSO" = 'entrevistas' and "ST_ATIVO" = 'S') then
    raise exception 'FALHOU E1: aba conduzir-entrevistas';
  end if;
  if (select count(*) from public."RL_ABA_AREA" where "CO_ABA" = 'conduzir-entrevistas')
     <> (select count(*) from public."TB_AREA") then
    raise exception 'FALHOU E1: conduzir-entrevistas fora de alguma área';
  end if;
  if (select string_agg("CO_ABA" || '=' || "NU_ORDEM", ',' order by "NU_ORDEM") from public."TB_ABA"
       where "CO_ABA" in ('entrevistas', 'conduzir-entrevistas', 'classificacao', 'aprovados', 'selecao'))
     <> 'entrevistas=7,conduzir-entrevistas=8,classificacao=9,aprovados=10,selecao=11' then
    raise exception 'FALHOU E1: ordem do menu';
  end if;
  insert into ensaio_resultado values ('E1', true, 'Painel de entrevistas (7), Conduzir entrevistas (8), Classificação 9, Aprovados 10, Seleção 11');
end;
$$;

-- E2. obter_entrevistas_do_edital (admin sintético): desempate e empate final da regra vigente; resto igual.
insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-4000-a000-0000000c0d01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.conduzir.admin@ensaio.invalid');
insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil, ativo)
select '00000000-0000-4000-a000-0000000c0d01', 'ensaio.conduzir.admin@ensaio.invalid', 'Ensaio Admin',
       (select g."CO_GRUPO_ACESSO" from public."TB_GRUPO_ACESSO" g where g."ST_ADMIN_GLOBAL" order by 1 limit 1), true;

do $$
declare
  v_edital uuid;
  v_cfg jsonb;
  v json;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-a000-0000000c0d01","role":"authenticated","email":"ensaio.conduzir.admin@ensaio.invalid"}', true);
  if not private.is_master() then raise exception 'ENSAIO: o admin sintético não é admin global'; end if;
  select r."CO_MONITORAMENTO", h."DS_CONFIGURACAO" into v_edital, v_cfg
    from public."TB_REGRA_CLASSIFICACAO" r
    join public."TH_REGRA_CLASSIFICACAO" h
      on h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id = r."CO_MONITORAMENTO"
   where jsonb_array_length(coalesce(h."DS_CONFIGURACAO" -> 'desempate', '[]')) > 0
   order by m."ST_TREINAMENTO" desc, r."CO_MONITORAMENTO" limit 1;
  if v_edital is null then raise exception 'ENSAIO: nenhum edital com regra de classificação com desempate'; end if;
  v := public.obter_entrevistas_do_edital(v_edital);
  if (v -> 'regra_classificacao' -> 'desempate')::jsonb is distinct from v_cfg -> 'desempate' then
    raise exception 'FALHOU E2: desempate diferente da regra vigente';
  end if;
  if (v -> 'regra_classificacao' -> 'empate_final')::jsonb is distinct from v_cfg -> 'empate_final' then
    raise exception 'FALHOU E2: empate_final diferente da regra vigente';
  end if;
  if (v -> 'regra_classificacao' -> 'convocacao')::jsonb is distinct from v_cfg -> 'convocacao' then
    raise exception 'FALHOU E2: convocação mudou';
  end if;
  if v -> 'convocados' is null or v -> 'avaliadores' is null or v -> 'edital' ->> 'id' <> v_edital::text then
    raise exception 'FALHOU E2: payload sem as chaves de sempre';
  end if;
  insert into ensaio_resultado values ('E2', true,
    format('edital %s: %s critérios de desempate, empate final %s', v_edital,
           jsonb_array_length(v_cfg -> 'desempate'), coalesce(v_cfg -> 'empate_final' ->> 'metodo', '—')));
end;
$$;

-- E3. DS_DESEMPATE continua no banco (sem remover dado).
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'TB_ROTEIRO_ENTREVISTA' and column_name = 'DS_DESEMPATE') then
    raise exception 'FALHOU E3: a coluna DS_DESEMPATE sumiu';
  end if;
  insert into ensaio_resultado values ('E3', true, 'TB_ROTEIRO_ENTREVISTA.DS_DESEMPATE mantida');
end;
$$;

select json_build_object(
  'ensaio', (select json_agg(json_build_object('passo', passo, 'ok', ok, 'detalhe', detalhe) order by passo) from ensaio_resultado),
  'abas', public.listar_abas_do_menu()
) as resultado;

rollback;
