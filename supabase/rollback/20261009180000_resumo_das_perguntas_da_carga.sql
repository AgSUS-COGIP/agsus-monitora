-- ROLLBACK de supabase/migrations/20261009180000_resumo_das_perguntas_da_carga.sql
-- Devolve obter_regra_analise com o campo 'perguntas' calculado na hora (definição de
-- 20261006100000_regra_da_analise.sql); apaga a RPC da tela obter_perguntas_carga_analise, as RPCs
-- do robô (listar_resumos_pergunta_pendentes, ler_respostas_pergunta_vaga,
-- gravar_resumo_pergunta_edital), a assinatura e o resumo TB_RESUMO_PERGUNTA_EDITAL (dado derivado:
-- o robô refaz com o modo "resumir_todos" se a migration voltar).
-- Atenção: volta o custo de 11–13 s ao abrir editais grandes. A tela que já chama
-- obter_perguntas_carga_analise abre sem as perguntas (PGRST202 vira lista vazia em
-- src/modulos/avaliacao-documental/estado.js) e o robô avisa que falta a migration.
begin;

set local lock_timeout = '10s';

drop function if exists public.obter_perguntas_carga_analise(uuid);
drop function if exists public.gravar_resumo_pergunta_edital(uuid, text, jsonb, integer);
drop function if exists public.ler_respostas_pergunta_vaga(text);
drop function if exists public.listar_resumos_pergunta_pendentes(text[], boolean);
drop function if exists private."FC_HASH_VAGA_EDITAL"(uuid);
drop table if exists public."TB_RESUMO_PERGUNTA_EDITAL";

create or replace function public.obter_regra_analise(p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_papel text := private."FC_PAPEL_AVALIACAO"(p_edital);
  v_coordena boolean := private."FC_PAPEL_AVALIACAO"(p_edital) = 'COORDENADOR';
  v_vagas text[];
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  select coalesce(array_agg(v."CO_VAGA"), '{}') into v_vagas
    from public."TB_EMPREGARE_VAGA" v
   where v."CO_MONITORAMENTO" = p_edital and v."TP_SITUACAO" = 'GRAVADA';

  return json_build_object(
    'schema_version', 1,
    'edital', json_build_object('id', v_m.id, 'edital', v_m.edital, 'unidade', v_m.unidade, 'area', v_area,
                                'numero', private."FC_NUMERO_EDITAL"(v_m.edital), 'id_unidade', v_m.id_unidade),
    'papel', v_papel,
    'pode_coordenar', coalesce(v_coordena, false),
    'origem', coalesce((select o."TP_ORIGEM" from public."TB_ORIGEM_ANALISE_EDITAL" o where o."CO_MONITORAMENTO" = p_edital), 'PLANILHA'),
    'regra', private."FC_REGRA_ANALISE_JSON"(p_edital),
    'modelos', coalesce((
      select json_agg(json_build_object('codigo', d."CO_MODELO", 'nome', d."NO_MODELO", 'configuracao', d."DS_CONFIGURACAO")
             order by d."CO_MODELO")
        from public."TB_REGRA_ANALISE_MODELO" d where d."ST_ATIVO" = 'S'), '[]'::json),
    'nota_minima', (
      select json_build_object('nota_minima', h."DS_CONFIGURACAO" #> '{documental,nota_minima}',
                               'nota_minima_por_nivel', coalesce(h."DS_CONFIGURACAO" #> '{documental,nota_minima_por_nivel}', '{}'::jsonb),
                               'versao_regra_classificacao', r."NU_VERSAO_VIGENTE")
        from public."TB_REGRA_CLASSIFICACAO" r
        join public."TH_REGRA_CLASSIFICACAO" h
          on h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
       where r."CO_MONITORAMENTO" = p_edital),
    'aldeias', (
      select json_build_object('quantidade', count(*), 'atualizado_em', max(a."DT_ATUALIZACAO"),
                               'fonte', (array_agg(a."DS_FONTE" order by a."DT_ATUALIZACAO" desc))[1])
        from public."TD_ALDEIA_DSEI" a
       where v_m.id_unidade is not null and a."CO_UNIDADE" = v_m.id_unidade::text and a."ST_ATIVO" = 'S'),
    'pode_carregar_aldeias', private.is_master(),
    'vagas_empregare', cardinality(v_vagas),
    -- Perguntas e respostas da última carga: só para a coordenação, que liga os blocos.
    -- Resposta que aparece uma vez só não sai (pode ser texto livre com dado pessoal):
    -- vira a contagem "outras".
    'perguntas', case when coalesce(v_coordena, false) then coalesce((
      with colunas as (
        select distinct c.coluna
          from public."TB_EMPREGARE_VAGA" v,
               lateral jsonb_array_elements_text(v."DS_COLUNA") c(coluna)
         where v."CO_VAGA" = any (v_vagas) and c.coluna ilike 'Pergunta %'
      ),
      respostas as (
        select k.coluna, left(btrim(c."DS_COLUNA_ORIGINAL" ->> k.coluna), 200) as valor, count(*)::integer as qt
          from colunas k
          join public."TB_EMPREGARE_CANDIDATO" c
            on c."CO_VAGA" = any (v_vagas) and c."ST_REGISTRO_ATIVO" = 'S'
         where coalesce(btrim(c."DS_COLUNA_ORIGINAL" ->> k.coluna), '') <> ''
         group by 1, 2
      )
      select json_agg(json_build_object(
               'coluna', k.coluna,
               'respostas', coalesce((
                 select json_agg(json_build_object('valor', x.valor, 'quantidade', x.qt) order by x.qt desc, x.valor)
                   from (select r.valor, r.qt from respostas r where r.coluna = k.coluna and r.qt >= 2
                          order by r.qt desc, r.valor limit 30) x), '[]'::json),
               'outras', (select count(*) from respostas r where r.coluna = k.coluna and r.qt < 2),
               'distintas', (select count(*) from respostas r where r.coluna = k.coluna))
             order by nullif(substring(k.coluna from '^Pergunta\s+(\d+)'), '')::integer nulls last, k.coluna)
        from colunas k), '[]'::json) else '[]'::json end,
    'fichas_concluidas', 0
  );
end;
$function$;

comment on function public.obter_regra_analise(uuid) is
  'A regra da avaliação documental do edital (json): vigente e versões, modelos para copiar, nota mínima da regra de classificação, aldeias do DSEI do edital, dono da avaliação, papel de quem está logado e, só para a coordenação, as perguntas da última carga da Empregare com as respostas encontradas (só as que aparecem 2+ vezes, até 30 por pergunta). fichas_concluidas fica 0 até as fichas da fase F3. Exige avaliacao_documental >= leitor, a área e o recorte da coordenação.';

commit;
