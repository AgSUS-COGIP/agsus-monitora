-- ROLLBACK de supabase/migrations/20261007170000_sync_de_analises_nao_trava.sql
-- Tira a tarefa agsus_analises_encerrar_inativas, volta iniciar_sync_analises_incremental e
-- analises_sync_guard_before_insert ao corpo de 20260928140000_sync_de_analises_por_planilha.sql,
-- comparar_analises_incremental_v2 ao de 20261001140000_incremental_remove_ausentes.sql e
-- get_saude_das_cargas ao de 20261006110000_pre_classificacao_e_lote.sql; depois apaga
-- FC_ENCERRAR_SYNC_ANALISE_INATIVO. As execuções já encerradas por inatividade continuam como
-- erro (é o que elas eram: execuções mortas); nada é reaberto nem apagado.
begin;

set local lock_timeout = '5s';

do $$
declare
  v_id bigint;
begin
  if to_regclass('cron.job') is null then return; end if;
  select jobid into v_id from cron.job where jobname = 'agsus_analises_encerrar_inativas';
  if v_id is not null then perform cron.unschedule(v_id); end if;
end;
$$;

CREATE OR REPLACE FUNCTION public.iniciar_sync_analises_incremental(p_sync_id uuid, p_origem text DEFAULT 'apps_script_analises_incremental_v1'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
 SET statement_timeout TO '5s'
 SET lock_timeout TO '1s'
AS $function$
declare
  v_row public."TL_SYNC_ANALISE"%rowtype;
  v_planilha text;
begin
  if p_sync_id is null then raise exception 'p_sync_id obrigatorio'; end if;
  -- [por-planilha] origem cadastrada e de carga incremental; lock por planilha.
  v_planilha := public."FC_PLANILHA_DA_ORIGEM_ANALISE"(p_origem, 'INCREMENTAL');
  if not pg_try_advisory_xact_lock(hashtext('public.processar_sync_analises:'||v_planilha)::bigint) then
    raise exception 'Outro processamento de analises esta em andamento.';
  end if;

  select * into v_row from public."TL_SYNC_ANALISE" where sync_id=p_sync_id order by id desc limit 1;
  if found then
    if coalesce(v_row.modo,'') <> 'INCREMENTAL_ACTIVE' then
      raise exception 'sync_id ja existe com modo diferente: %',coalesce(v_row.modo,'<null>');
    end if;
    if v_row."CO_PLANILHA" is distinct from v_planilha then
      raise exception 'sync_id ja existe para outra planilha: %',coalesce(v_row."CO_PLANILHA",'<null>');
    end if;
    return jsonb_build_object('ok',true,'sync_id',p_sync_id,'status',v_row.status,'existing',true,'resultado',v_row.resultado);
  end if;

  -- [por-planilha] só um sync pendente por planilha.
  if exists(select 1 from public."TL_SYNC_ANALISE" where status in ('carregado','processando') and "CO_PLANILHA"=v_planilha) then
    raise exception 'Existe outro sync de Analises pendente para a planilha %.', v_planilha;
  end if;

  insert into public."TL_SYNC_ANALISE"(sync_id,origem,modo,status,linhas_staging,started_at,resultado)
  values(p_sync_id,p_origem,'INCREMENTAL_ACTIVE','carregado',0,now(),jsonb_build_object(
    'modo_processamento','incremental',
    'incremental_preparado',false,
    'incremental_cursor',0,
    'incremental_iniciado_em',now(),
    'planilha',v_planilha
  ));

  return jsonb_build_object('ok',true,'sync_id',p_sync_id,'status','carregado','existing',false);
end;
$function$;

CREATE OR REPLACE FUNCTION public.comparar_analises_incremental_v2(p_sync_id uuid, p_itens jsonb, p_reiniciar boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
 SET statement_timeout TO '10s'
 SET lock_timeout TO '1s'
AS $function$
begin
  if p_sync_id is null then raise exception 'p_sync_id obrigatorio'; end if;
  if not exists (select 1 from public."TL_SYNC_ANALISE"
                  where sync_id = p_sync_id and modo = 'INCREMENTAL_ACTIVE'
                    and status in ('iniciado', 'carregado', 'processando')) then
    raise exception 'Sync incremental % nao esta em andamento.', p_sync_id;
  end if;
  if p_reiniciar then
    delete from public."TM_MANIFESTO_ANALISE" where "CO_SYNC" = p_sync_id;
  end if;
  -- A v1 valida o lote (até 500 itens, linha e chave preenchidas) e compara.
  if p_itens is not null and jsonb_typeof(p_itens) = 'array' and jsonb_array_length(p_itens) between 1 and 500 then
    insert into public."TM_MANIFESTO_ANALISE" ("CO_SYNC", "NU_LINHA_ORIGEM", "DS_CHAVE_NATURAL")
    select p_sync_id, (j->>'linha_origem')::integer, j->>'chave_natural'
      from jsonb_array_elements(p_itens) j
     where coalesce(j->>'linha_origem', '') ~ '^[1-9][0-9]*$'
       and nullif(btrim(j->>'chave_natural'), '') is not null
    on conflict ("CO_SYNC", "NU_LINHA_ORIGEM") do update set "DS_CHAVE_NATURAL" = excluded."DS_CHAVE_NATURAL";
  end if;
  return public.comparar_analises_incremental(p_itens);
end;
$function$;

CREATE OR REPLACE FUNCTION public.analises_sync_guard_before_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_active record;
  v_planilha text;
begin
  -- [por-planilha] origem precisa estar cadastrada; o log recebe a planilha.
  select o."CO_PLANILHA" into v_planilha
    from public."TA_ORIGEM_ANALISE" o
   where o."CO_ORIGEM" = new.origem;
  if v_planilha is null then
    raise exception 'Origem de sincronizacao nao cadastrada em TA_ORIGEM_ANALISE: "%". Sync recusado.', coalesce(new.origem, '<nula>')
      using errcode = '22023';
  end if;
  new."CO_PLANILHA" := v_planilha;

  if coalesce(new.status, 'iniciado') in ('iniciado', 'carregado', 'processando') then

    update public."TL_SYNC_ANALISE" l
    set status = 'erro',
        finished_at = now(),
        updated_at = now(),
        erro = coalesce(l.erro, 'Carga de analises marcada como erro automaticamente por expirar sem finalizacao.'),
        mensagem = coalesce(l.mensagem, 'Carga anterior expirada; liberada para permitir nova sincronizacao.'),
        resultado = coalesce(l.resultado, '{}'::jsonb) || jsonb_build_object(
          'ok', false,
          'auto_expired', true,
          'expired_at', now(),
          'previous_status', l.status
        )
    where l."CO_PLANILHA" = v_planilha
      and l.finished_at is null
      and (
        (l.status in ('carregado', 'processando') and l.updated_at < now() - interval '15 minutes')
        or (l.status = 'iniciado' and l.created_at < now() - interval '45 minutes')
      );

    select l.sync_id, l.status, l.created_at
      into v_active
    from public."TL_SYNC_ANALISE" l
    where l."CO_PLANILHA" = v_planilha
      and l.status in ('iniciado', 'carregado', 'processando')
      and l.created_at >= now() - interval '45 minutes'
      and l.finished_at is null
    order by l.created_at desc
    limit 1;

    if found then
      raise exception 'Ja existe uma carga de analises em andamento para a planilha % (sync_id %, status %, criada em %). Aguarde finalizar antes de iniciar outra.',
        v_planilha, v_active.sync_id, v_active.status, v_active.created_at
        using errcode = '55P03';
    end if;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_saude_das_cargas()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    'pre_classificacao', (
      select coalesce(json_agg(json_build_object(
          'inicio', p."DT_INICIO",
          'fim', p."DT_FIM",
          'situacao', p."TP_SITUACAO",
          'linhas', p."QT_INSCRITO",
          'mensagem', p."DS_MENSAGEM",
          'disparo', p."TP_DISPARO",
          'editais', p."QT_EDITAL",
          'vagas', p."QT_VAGA",
          'lote', p."QT_LOTE",
          'refazer', p."ST_REFAZER_LOTE" = 'S',
          'execucao', p."DS_URL_EXECUCAO"
        ) order by p."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_PRE_CLASSIFICACAO" t order by t."DT_INICIO" desc limit 10) p
    ),
    'tarefas', v_tarefas
  );
end;
$function$;
comment on function public.get_saude_das_cargas() is
  'Saúde das cargas (Configurações, só administrador global): as últimas 10 execuções de cada carga das análises (por origem), das entrevistas, da seleção, do robô da Empregare (com vagas pedidas/baixadas/falhas/recusadas e quem disparou), das conferências de consistência (avisos novos, abertos e resolvidos), da pré-classificação da Avaliação documental (editais, vagas, inscritos e lote) e das tarefas agsus_* do pg_cron (nulas sem acesso ao pg_cron). Só leitura.';

drop function public."FC_ENCERRAR_SYNC_ANALISE_INATIVO"(text, integer);

notify pgrst, 'reload schema';

commit;
