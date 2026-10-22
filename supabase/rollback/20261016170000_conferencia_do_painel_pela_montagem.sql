/*
  Rollback de 20261016170000_conferencia_do_painel_pela_montagem: volta
  "Conferido às" das análises a olhar só a carga da planilha (TL_SYNC_ANALISE).
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
    return (select max(s.finished_at)
              from public."TL_SYNC_ANALISE" s
             where s.status = 'processado'
               and (v_area is null or s."CO_PLANILHA" = v_area));
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
