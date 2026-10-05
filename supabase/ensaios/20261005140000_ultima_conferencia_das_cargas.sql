-- ENSAIO de supabase/migrations/20261005140000_ultima_conferencia_das_cargas.sql (begin…rollback). Esperado: horas das três fontes como admin; 42501 sem sessão; 22023 com fonte inválida; 'ENSAIO OK'.
begin;
/*
  Última conferência das cargas (05/10/2026).

  As telas de Análises, Seleção e Entrevistas mostravam "Atualizado em" com a
  hora do dado mais novo (ou a hora em que a tela carregou). Quando a planilha
  não muda — fim de semana, por exemplo —, a carga roda, lê tudo e não grava
  nada, e a tela parecia parada ("Atualizado em 04/10, 13:05" na segunda de
  manhã). Esta função devolve a hora em que a última carga daquela fonte
  terminou bem, mesmo sem mudanças, para a tela mostrar
  "Conferido às HH:MM · última mudança em DD/MM, HH:MM".

  public.obter_ultima_conferencia(p_fonte, p_area):
    p_fonte 'analises'    → TL_SYNC_ANALISE (status 'processado'; p_area = CO_PLANILHA)
    p_fonte 'selecao'     → TL_SYNC_SELECAO (TP_SITUACAO 'CONCLUIDA'; uma carga para todas as áreas)
    p_fonte 'entrevistas' → TL_SYNC_ENTREVISTA (TP_SITUACAO 'CONCLUIDA'; p_area = CO_AREA)
  Lê só quem pode ler a tela (private.pode_recurso do módulo); sem a carga, nulo.

  Ensaio: supabase/ensaios/20261005140000_ultima_conferencia_das_cargas.sql
  Rollback: supabase/rollback/20261005140000_ultima_conferencia_das_cargas.sql
*/

create function public.obter_ultima_conferencia(p_fonte text, p_area text default null)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
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
$$;

revoke all on function public.obter_ultima_conferencia(text, text) from public, anon;
grant execute on function public.obter_ultima_conferencia(text, text) to authenticated;
comment on function public.obter_ultima_conferencia(text, text) is 'Hora em que a última carga da fonte (analises, selecao, entrevistas) terminou bem, mesmo sem mudanças; p_area recorta análises e entrevistas. Só quem pode ler a tela do módulo. Mostrada como "Conferido às" nas telas.';

select set_config('request.jwt.claims', '{"sub":"df5b852c-f981-4486-94b9-67857fff8f93","role":"authenticated"}', true);
do $$
begin
  if public.obter_ultima_conferencia('analises', 'saude-indigena') is null then raise exception 'FALHOU: análises sem hora'; end if;
  begin
    perform public.obter_ultima_conferencia('planilha', null);
    raise exception 'FALHOU: aceitou fonte inválida';
  exception when sqlstate '22023' then null;
  end;
end $$;
select set_config('request.jwt.claims', '', true);
do $$
begin
  perform public.obter_ultima_conferencia('analises', null);
  raise exception 'FALHOU: sem sessão leu';
exception when sqlstate '42501' then null;
end $$;
select set_config('request.jwt.claims', '{"sub":"df5b852c-f981-4486-94b9-67857fff8f93","role":"authenticated"}', true);
select 'ENSAIO OK' resultado,
       to_char(public.obter_ultima_conferencia('analises','saude-indigena') at time zone 'America/Sao_Paulo','DD/MM HH24:MI') analises_si,
       to_char(public.obter_ultima_conferencia('analises','projetos') at time zone 'America/Sao_Paulo','DD/MM HH24:MI') analises_proj,
       to_char(public.obter_ultima_conferencia('selecao') at time zone 'America/Sao_Paulo','DD/MM HH24:MI') selecao,
       to_char(public.obter_ultima_conferencia('entrevistas','saude-indigena') at time zone 'America/Sao_Paulo','DD/MM HH24:MI') entrevistas;
rollback;
