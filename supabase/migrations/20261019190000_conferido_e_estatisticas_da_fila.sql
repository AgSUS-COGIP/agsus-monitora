/*
  "CONFERIDO ÀS" PELA ÚLTIMA CONFERÊNCIA E ESTATÍSTICAS DA FILA EM DIA

  1) Em 19/10/2026 o Painel das análises mostrava "Conferido às 15:50" às
     16:4x: o job agsus_analises_cache_do_painel conferiu às 16:20, não achou
     mudança e não remontou o resumo, então DT_GERACAO não andou e parecia
     parado. A hora das análises passa a incluir a última rodada bem-sucedida
     desse job (a conferência), além da carga da planilha e da montagem.
  2) No mesmo dia a fila inteira da Avaliação documental subiu para 13,5 s
     (estourando os 8 s do authenticated): TB_PRE_CLASSIFICACAO tinha
     estatísticas de 15/10 (a tabela quase não muda, o autoanalyze não roda) e,
     com o índice IN_PRECLASSIF_FILA e a consulta replanejada a cada chamada
     (20261019150000), o planejador escolheu um caminho ruim. Um ANALYZE
     manual levou a 0,2–0,5 s. Passa a haver um job de hora em hora (minuto
     45) que analisa as tabelas da fila só quando mudaram desde o último
     ANALYZE (custo zero quando não mudaram).
  Rollback: supabase/rollback/20261019190000_conferido_e_estatisticas_da_fila.sql
*/
create or replace function public.obter_ultima_conferencia(p_fonte text, p_area text default null)
returns timestamp with time zone
language plpgsql
stable security definer
set search_path to ''
as $function$
declare
  v_fonte text := lower(btrim(coalesce(p_fonte, '')));
  v_area text := nullif(btrim(coalesce(p_area, '')), '');
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Sessão necessária.';
  end if;
  if v_fonte = 'analises' then
    if not private.pode_recurso('analises') then
      raise exception using errcode = '42501', message = 'Sem permissão para este recurso';
    end if;
    return greatest(
      (select max(s.finished_at)
         from public."TL_SYNC_ANALISE" s
        where s.status = 'processado'
          and (v_area is null or s."CO_PLANILHA" = v_area)),
      (select max(c."DT_GERACAO")
         from private."TA_PAINEL_ANALISE" c
        where v_area is null or c."CO_AREA" = v_area),
      -- A conferência do job do resumo (vale para todas as áreas), mesmo sem remontar.
      (select max(d.end_time)
         from cron.job_run_details d
         join cron.job j on j.jobid = d.jobid
        where j.jobname = 'agsus_analises_cache_do_painel'
          and d.status = 'succeeded'
          and d.start_time > now() - interval '1 day'));
  elsif v_fonte = 'selecao' then
    if not private.pode_recurso('selecao') then
      raise exception using errcode = '42501', message = 'Sem permissão para este recurso';
    end if;
    return (select max(s."DT_FIM")
              from public."TL_SYNC_SELECAO" s
             where s."TP_SITUACAO" = 'CONCLUIDA');
  elsif v_fonte = 'entrevistas' then
    if not private.pode_recurso('entrevistas') then
      raise exception using errcode = '42501', message = 'Sem permissão para este recurso';
    end if;
    return (select max(s."DT_FIM")
              from public."TL_SYNC_ENTREVISTA" s
             where s."TP_SITUACAO" = 'CONCLUIDA'
               and (v_area is null or s."CO_AREA" = v_area));
  end if;
  raise exception using errcode = '22023', message = 'Fonte inválida: use analises, selecao ou entrevistas.';
end;
$function$;

comment on function public.obter_ultima_conferencia(text, text) is
  'Hora da última conferência da fonte, mostrada como "Conferido às" nas telas: análises = a mais recente entre a última carga da planilha, a última montagem do resumo do Painel da área e a última rodada bem-sucedida do job do resumo (conferência sem mudança); seleção e entrevistas = última carga que terminou bem. p_area recorta análises e entrevistas. Só quem pode ler a tela do módulo.';

create or replace function private."FC_ESTATISTICAS_DA_FILA"()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_qt integer := 0;
begin
  if coalesce((select s.n_mod_since_analyze from pg_catalog.pg_stat_user_tables s
                where s.schemaname = 'public' and s.relname = 'TB_PRE_CLASSIFICACAO'), 0) > 0 then
    analyze public."TB_PRE_CLASSIFICACAO";
    v_qt := v_qt + 1;
  end if;
  if coalesce((select s.n_mod_since_analyze from pg_catalog.pg_stat_user_tables s
                where s.schemaname = 'public' and s.relname = 'TB_FICHA_ANALISE'), 0) > 0 then
    analyze public."TB_FICHA_ANALISE";
    v_qt := v_qt + 1;
  end if;
  return v_qt;
end;
$function$;

comment on function private."FC_ESTATISTICAS_DA_FILA"() is
  'ANALYZE de TB_PRE_CLASSIFICACAO e TB_FICHA_ANALISE só quando mudaram desde o último (pg_stat_user_tables.n_mod_since_analyze). Chamada pelo job agsus_fila_estatisticas (minuto 45). Devolve quantas tabelas analisou.';

revoke all on function private."FC_ESTATISTICAS_DA_FILA"() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'agsus_fila_estatisticas';
select cron.schedule('agsus_fila_estatisticas', '45 * * * *', $job$select private."FC_ESTATISTICAS_DA_FILA"();$job$);
