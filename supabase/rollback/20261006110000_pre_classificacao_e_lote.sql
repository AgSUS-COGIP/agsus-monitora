-- Desfaz 20261006110000_pre_classificacao_e_lote: tira as RPCs da pré-classificação,
-- o gatilho dos campos novos da regra, as tabelas TL_/TB_/TH_PRE_CLASSIFICACAO e
-- TB_PRE_CLASSIF_VAGA, devolve CK_LISTACLASSIF_TPLISTA sem PROVISORIA e LOTE e
-- get_saude_das_cargas à versão de 20261005210000.
-- ATENÇÃO: apaga a pré-classificação gravada (Provisória, lotes e o histórico). As
-- listas PROVISORIA e LOTE já registradas na Classificação impedem o rollback (a
-- mensagem diz quantas): marque-as e decida antes. As versões da regra com
-- provisoria.desempate ou lote.por_vaga ficam (o formulário da F1 ignora os campos).
begin;

do $$
declare
  v_listas integer;
begin
  select count(*) into v_listas from public."TB_LISTA_CLASSIFICACAO" where "TP_LISTA" in ('PROVISORIA', 'LOTE');
  if v_listas > 0 then
    raise exception 'Há % lista(s) PROVISORIA/LOTE registradas na Classificação: o rollback as tornaria inválidas.', v_listas;
  end if;
end;
$$;

drop function if exists public.pode_recalcular_pre_classificacao(uuid);
drop function if exists public.registrar_lista_pre_classificacao(uuid, text, integer);
drop function if exists public.obter_pre_classificacao(uuid);
drop function if exists public.finalizar_pre_classificacao(text, jsonb, text);
drop function if exists public.gravar_pre_classificacao_vaga(text, uuid, text, integer, jsonb, jsonb);
drop function if exists public.iniciar_pre_classificacao(text, text, uuid, text, boolean, jsonb);
drop function if exists public.pre_classificacao_ler_candidatos(uuid, text);
drop function if exists public.pre_classificacao_ler_editais(text[], boolean);
drop function if exists private."FC_LINHAS_PRE_CLASSIF"(jsonb);
drop function if exists private."FC_QUADRO_DA_VAGA_EMPREGARE"(uuid, text);
drop function if exists private."FC_ROTULO_DO_EDITAL"(text);
drop function if exists private."FC_EXIGIR_EXECUCAO_PRECLASSIF"(text);

drop trigger if exists "TG_THREGRAANALISE_CAMPOSF2" on public."TH_REGRA_ANALISE";
drop function if exists private."FC_TG_REGRA_ANALISE_F2"();

drop table if exists public."TH_PRE_CLASSIFICACAO";
drop table if exists public."TB_PRE_CLASSIF_VAGA";
drop table if exists public."TB_PRE_CLASSIFICACAO";
drop table if exists public."TL_PRE_CLASSIFICACAO";
drop function if exists private."FC_TG_PRE_CLASSIF_IMUTAVEL"();

alter table public."TB_LISTA_CLASSIFICACAO" drop constraint "CK_LISTACLASSIF_TPLISTA";
alter table public."TB_LISTA_CLASSIFICACAO"
  add constraint "CK_LISTACLASSIF_TPLISTA" check ("TP_LISTA" in ('PRELIMINAR', 'CONVOCACAO', 'ENTREVISTA', 'FINAL'));
comment on constraint "CK_LISTACLASSIF_TPLISTA" on public."TB_LISTA_CLASSIFICACAO" is
  'Tipos de lista válidos (PRELIMINAR, CONVOCACAO, ENTREVISTA e FINAL).';
comment on column public."TB_LISTA_CLASSIFICACAO"."TP_LISTA" is
  'PRELIMINAR (avaliação documental), CONVOCACAO (para entrevista), ENTREVISTA (resultado da entrevista) ou FINAL (resultado final).';

-- get_saude_das_cargas volta à versão de 20261005210000 (sem a pré-classificação).
create or replace function public.get_saude_das_cargas()
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_tarefas json;
begin
  if not private.is_master() then
    raise exception 'Somente o administrador global vê a saúde das cargas' using errcode = '42501';
  end if;

  -- pg_cron pode não estar acessível: a seção mostra "indisponível" nessa parte.
  begin
    select coalesce(json_agg(json_build_object(
        'nome', j.jobname,
        'agenda', j.schedule,
        'ativa', j.active,
        'execucoes', (
          select coalesce(json_agg(json_build_object(
              'inicio', d.start_time,
              'fim', d.end_time,
              'situacao', d.status,
              'mensagem', left(d.return_message, 500)
            ) order by d.start_time desc), '[]'::json)
            from (select * from cron.job_run_details r
                   where r.jobid = j.jobid
                   order by r.start_time desc limit 10) d
        )
      ) order by j.jobname), '[]'::json)
      into v_tarefas
      from cron.job j
     where left(j.jobname, 6) = 'agsus_';
  exception when others then
    v_tarefas := null;
  end;

  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'analises', (
      select coalesce(json_agg(json_build_object(
          'origem', o."CO_ORIGEM",
          'area', p."CO_AREA",
          'planilha', p."NO_PLANILHA",
          'tipo', o."TP_CARGA",
          'execucoes', (
            select coalesce(json_agg(json_build_object(
                'inicio', x.j ->> 'started_at',
                'fim', x.j ->> 'finished_at',
                'situacao', x.j ->> 'status',
                'linhas', coalesce(x.j ->> 'total_processados', x.j ->> 'total_lidos', x.j ->> 'linhas_staging'),
                'mensagem', left(coalesce(x.j ->> 'erro', x.j ->> 'mensagem'), 500)
              ) order by x.inicio desc nulls last), '[]'::json)
              from (select to_jsonb(s) as j, s.started_at as inicio
                      from public."TL_SYNC_ANALISE" s
                     where s.origem = o."CO_ORIGEM"
                     order by s.started_at desc nulls last
                     limit 10) x
          )
        ) order by p."CO_AREA", o."TP_CARGA" desc), '[]'::json)
        from public."TA_ORIGEM_ANALISE" o
        join public."TB_PLANILHA_ANALISE" p on p."CO_PLANILHA" = o."CO_PLANILHA"
    ),
    'entrevistas', (
      select coalesce(json_agg(json_build_object(
          'inicio', e."DT_INICIO",
          'fim', e."DT_FIM",
          'situacao', e."TP_SITUACAO",
          'linhas', e."QT_LINHA",
          'mensagem', e."DS_MENSAGEM",
          'area', e."CO_AREA"
        ) order by e."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_SYNC_ENTREVISTA" t order by t."DT_INICIO" desc limit 10) e
    ),
    'selecao', (
      select coalesce(json_agg(json_build_object(
          'inicio', e."DT_INICIO",
          'fim', e."DT_FIM",
          'situacao', e."TP_SITUACAO",
          'linhas', e."QT_LINHA",
          'mensagem', e."DS_MENSAGEM"
        ) order by e."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_SYNC_SELECAO" t order by t."DT_INICIO" desc limit 10) e
    ),
    'empregare', (
      select coalesce(json_agg(json_build_object(
          'inicio', e."DT_INICIO",
          'fim', e."DT_FIM",
          'situacao', e."TP_SITUACAO",
          'linhas', e."QT_LINHA",
          'mensagem', e."DS_MENSAGEM",
          'disparo', e."TP_DISPARO",
          'vagas_pedidas', e."QT_VAGA_PEDIDA",
          'vagas_baixadas', e."QT_VAGA_BAIXADA",
          'vagas_falha', e."QT_VAGA_FALHA",
          'vagas_recusadas', e."QT_VAGA_RECUSADA",
          'desativadas', e."QT_DESATIVADA",
          'execucao', e."DS_URL_EXECUCAO"
        ) order by e."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_SYNC_EMPREGARE" t order by t."DT_INICIO" desc limit 10) e
    ),
    'conferencias', (
      select coalesce(json_agg(json_build_object(
          'inicio', c."DT_INICIO",
          'fim', c."DT_FIM",
          'situacao', c."TP_SITUACAO",
          'linhas', c."QT_AVISO_ABERTO",
          'mensagem', c."DS_MENSAGEM",
          'disparo', c."TP_DISPARO",
          'novos', c."QT_AVISO_NOVO",
          'abertos', c."QT_AVISO_ABERTO",
          'resolvidos', c."QT_AVISO_RESOLVIDO",
          'falhas', c."DS_FALHA",
          'execucao', c."DS_URL_EXECUCAO"
        ) order by c."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_CONFERENCIA" t order by t."DT_INICIO" desc limit 10) c
    ),
    'tarefas', v_tarefas
  );
end;
$function$;
comment on function public.get_saude_das_cargas() is
  'Saúde das cargas (Configurações, só administrador global): as últimas 10 execuções de cada carga das análises (por origem), das entrevistas, da seleção, do robô da Empregare (com vagas pedidas/baixadas/falhas/recusadas e quem disparou), das conferências de consistência (avisos novos, abertos e resolvidos) e das tarefas agsus_* do pg_cron (nulas sem acesso ao pg_cron). Só leitura.';

commit;
