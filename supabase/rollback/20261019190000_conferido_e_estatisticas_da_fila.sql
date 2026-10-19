/*
  Rollback de 20261019190000: "Conferido às" sem a rodada do job e sem o job de estatísticas da fila.
*/
CREATE OR REPLACE FUNCTION public.obter_ultima_conferencia(p_fonte text, p_area text DEFAULT NULL::text)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
        where v_area is null or c."CO_AREA" = v_area));
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
$function$
;
select cron.unschedule(jobid) from cron.job where jobname = 'agsus_fila_estatisticas';
drop function if exists private."FC_ESTATISTICAS_DA_FILA"();
