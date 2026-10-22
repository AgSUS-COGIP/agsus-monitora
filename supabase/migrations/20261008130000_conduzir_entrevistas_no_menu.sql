/*
  ENTREVISTAS: PAINEL E CONDUZIR SEPARADOS NO MENU (08/10/2026)

  Pedido: "precisa ser mais vivo, intuitivo"; separar o painel (acompanhar)
  de conduzir (fazer), como o Painel das análises ao lado da Avaliação
  documental.

  O QUE MUDA
    1. Menu (TB_ABA × RL_ABA_AREA):
       - a aba 'entrevistas' (view 'entrevistas') passa a se chamar "Painel
         de entrevistas" (só o rótulo);
       - a aba nova 'conduzir-entrevistas' (view 'conduzir-entrevistas',
         src/modulos/entrevistas/conduzir.tsx) entra DESLIGADA (ST_ATIVO =
         'N', selo BETA), nas três áreas, na ordem 8; Classificação, Lista de
         aprovados e Seleção descem uma posição.
         20261008130500_liga_aba_conduzir_entrevistas.sql liga junto com o
         merge do front.
       Recurso de permissão: o mesmo 'entrevistas' (nenhum recurso novo):
       quem acessava a antiga tela acessa as duas entradas; escrever
       (convocar, configurar, lançar notas, roteiros) continua exigindo
       Editor, conferido pelas RPCs de sempre.
    2. obter_entrevistas_do_edital: `regra_classificacao` passa a trazer, da
       versão vigente da regra de classificação, `desempate` (critérios do
       catálogo, na ordem) e `empate_final`. O desempate da entrevista é o da
       Classificação (uma fonte só): Conduzir › Preparar e o editor do
       roteiro mostram esses critérios só para ler, com "Editar na
       Classificação". A coluna TB_ROTEIRO_ENTREVISTA."DS_DESEMPATE" (texto
       livre antigo do roteiro) FICA no banco, sem remover dado: a tela não a
       mostra nem a edita, e salvar_roteiro_entrevista continua gravando o
       que vier (o front repassa o valor da versão anterior).
       Corpo igual ao de 20261008100000_aspectos_da_entrevista.sql, mais
       essas duas chaves.

  Ensaio: supabase/ensaios/20261008130000_conduzir_entrevistas_no_menu.sql
  Rollback: supabase/rollback/20261008130000_conduzir_entrevistas_no_menu.sql
*/
begin;

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

commit;
