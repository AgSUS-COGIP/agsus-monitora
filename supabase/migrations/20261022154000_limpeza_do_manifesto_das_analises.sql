/*
  LIMPEZA DO MANIFESTO DAS CARGAS DE ANÁLISES

  Por quê: public."TM_MANIFESTO_ANALISE" é a lista de chaves de cada sync
  incremental das planilhas de análises (comparar_analises_incremental_v2 grava;
  FC_DESATIVAR_AUSENTES_DA_PLANILHA lê para saber quem saiu). Só
  finalizar_sync_analises_incremental limpa (o do próprio sync e os de mais de
  2 dias), e só quando um sync termina bem. O sync que termina em erro deixa o
  manifesto para trás: em 22/10/2026 eram 10.357 linhas (14 MB com os índices)
  de um único sync com erro de 14/10, e as planilhas não terminam um sync
  desde 16/10 — nada as limparia.

  O que faz:
    private."FC_LIMPAR_MANIFESTO_ANALISE"(p_dias default 2)
      apaga o manifesto com mais de p_dias (1 a 30) de sync que NÃO está em
      andamento (TL_SYNC_ANALISE iniciado/carregado/processando sem
      finished_at): erro, processado ou sem log. O sync em andamento nunca é
      tocado, mesmo velho (quem o encerra é FC_ENCERRAR_SYNC_ANALISE_INATIVO,
      que lê o manifesto para medir o progresso). Devolve quantas linhas saíram.
    agsus_analises_limpar_manifesto (pg_cron) "40 6 * * *" = 3h40 de Brasília,
      fora dos minutos das outras tarefas; select com trava consultiva, como
      as tarefas dos caches.

  Idempotente. Ensaio: supabase/ensaios/20261022154000_limpeza_do_manifesto_das_analises.sql
  Rollback: supabase/rollback/20261022154000_limpeza_do_manifesto_das_analises.sql
*/
begin;

create or replace function private."FC_LIMPAR_MANIFESTO_ANALISE"(p_dias integer default 2)
returns integer
language plpgsql
set search_path = ''
as $function$
declare
  v_n integer;
begin
  if p_dias is null or p_dias not between 1 and 30 then
    raise exception 'p_dias deve estar entre 1 e 30' using errcode = '22023';
  end if;

  delete from public."TM_MANIFESTO_ANALISE" m
   where m."DT_CRIACAO" < now() - make_interval(days => p_dias)
     and not exists (
       select 1 from public."TL_SYNC_ANALISE" l
        where l.sync_id = m."CO_SYNC"
          and l.status in ('iniciado', 'carregado', 'processando')
          and l.finished_at is null);
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;

comment on function private."FC_LIMPAR_MANIFESTO_ANALISE"(integer) is
  'Apaga o manifesto (TM_MANIFESTO_ANALISE) com mais de p_dias (1 a 30; padrão 2) de sync de análises que não está em andamento (erro, processado ou sem log); o sync em andamento nunca é tocado. Devolve as linhas apagadas. Chamada pela tarefa agsus_analises_limpar_manifesto (20261022154000). Só o dono (pg_cron).';
revoke all on function private."FC_LIMPAR_MANIFESTO_ANALISE"(integer) from public, anon, authenticated, service_role;

do $$
declare
  v_comando constant text :=
    'select private."FC_LIMPAR_MANIFESTO_ANALISE"(2) where pg_try_advisory_xact_lock(hashtext(''agsus_analises_limpar_manifesto''));';
  v_id bigint;
begin
  select jobid into v_id from cron.job where jobname = 'agsus_analises_limpar_manifesto';
  if v_id is null then
    perform cron.schedule('agsus_analises_limpar_manifesto', '40 6 * * *', v_comando);
  else
    perform cron.alter_job(v_id, schedule => '40 6 * * *', command => v_comando, active => true);
  end if;
end;
$$;

commit;
