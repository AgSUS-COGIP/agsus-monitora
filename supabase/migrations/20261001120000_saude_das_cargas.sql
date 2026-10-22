/*
  SAÚDE DAS CARGAS (ADMINISTRAÇÃO)

  Uma leitura só, para a seção "Saúde das cargas" das Configurações (só o
  administrador global): as últimas execuções de cada carga e tarefa
  automática, para ver de relance o que está em dia, atrasado ou falhou.
  Nenhuma carga muda; o front decide "em dia"/"atrasada" pelos prazos
  (src/lib/saude-das-cargas.js).

  DE ONDE VEM
    Análises curriculares   TL_SYNC_ANALISE (Apps Script das 3 planilhas), uma
                            linha por origem de TA_ORIGEM_ANALISE (completa e
                            incremental de cada planilha). A tabela é anterior
                            às migrations: as colunas são lidas pelo json da
                            linha, para não quebrar se alguma não existir.
    Entrevistas             TL_SYNC_ENTREVISTA (GitHub Actions, 9h)
    Seleção                 TL_SYNC_SELECAO (GitHub Actions, 9h)
    Tarefas do banco        cron.job e cron.job_run_details, só as 'agsus_*'
                            (pacotes prontos dos painéis, estatísticas, limpeza).
                            Sem acesso ao pg_cron, a parte vem nula.
    Últimas 10 execuções de cada uma.

  ACESSO
    public.get_saude_das_cargas()   json; só private.is_master() (42501 para os
                                    demais); authenticated executa.

  Rollback: supabase/rollback/20261001120000_saude_das_cargas.sql
*/
begin;

-- A leitura procura as últimas execuções de cada origem.
create index if not exists "IN_SYNCANALISE_ORIGEM" on public."TL_SYNC_ANALISE" (origem, started_at desc);
comment on index public."IN_SYNCANALISE_ORIGEM" is 'Últimas execuções por origem (Saúde das cargas).';

create function public.get_saude_das_cargas()
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
    'tarefas', v_tarefas
  );
end;
$function$;
comment on function public.get_saude_das_cargas() is
  'Saúde das cargas (Configurações, só administrador global): as últimas 10 execuções de cada carga das análises (por origem), das entrevistas, da seleção e das tarefas agsus_* do pg_cron (nulas sem acesso ao pg_cron). Só leitura.';
revoke all on function public.get_saude_das_cargas() from public, anon;
grant execute on function public.get_saude_das_cargas() to authenticated;

commit;
