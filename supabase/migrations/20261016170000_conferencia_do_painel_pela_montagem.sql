/*
  "CONFERIDO ÀS" DO PAINEL DAS ANÁLISES PELA MONTAGEM DO RESUMO

  O "Conferido às" do Painel das análises vinha só da última carga da planilha
  (TL_SYNC_ANALISE). Em Projetos as fichas agora são analisadas no próprio
  sistema (114/2026) e a carga da planilha não roda mais: em 16/10/2026 o topo
  mostrava "Conferido às 11:08" enquanto os números subiam a cada montagem.
  Os números do Painel vêm do resumo montado em private."TA_PAINEL_ANALISE"
  (de hora em hora, ou quando uma ficha marca o cache); a hora passa a ser a
  mais recente entre a última carga da planilha e a última montagem do resumo
  da área. Seleção e entrevistas não mudam.
  Rollback: supabase/rollback/20261016170000_conferencia_do_painel_pela_montagem.sql
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
$function$;

comment on function public.obter_ultima_conferencia(text, text) is
  'Hora da última conferência da fonte, mostrada como "Conferido às" nas telas: análises = a mais recente entre a última carga da planilha e a última montagem do resumo do Painel da área; seleção e entrevistas = última carga que terminou bem. p_area recorta análises e entrevistas. Só quem pode ler a tela do módulo.';
