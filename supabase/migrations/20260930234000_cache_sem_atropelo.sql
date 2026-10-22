/*
  Caches do painel sem atropelo.

  Em 30/09/2026, por volta das 15h35, as rotinas de 2 em 2 minutos se
  empilharam (aprovados 64 s, entrevistas 90 s) e o sistema ficou lento para
  todos; duas cargas de entrevistas ficaram "EM_ANDAMENTO" para sempre.

  1. Sai o gatilho TG_SYNCENTREVISTA_REMONTA_PAINEL (20260930120000): ele
     remontava o painel de entrevistas DENTRO da finalização da carga,
     segurando a linha de TA_PAINEL_ENTREVISTA enquanto a rotina do cron
     tentava remontar a mesma linha. O cron já percebe a carga nova pela
     versão dos dados (FC_VERSAO_ENTREVISTAS) em até 2 minutos.
  2. Cada rotina de cache só começa se a anterior terminou
     (pg_try_advisory_xact_lock): rodada que encontra outra em andamento não
     faz nada e deixa para a próxima.

  Rollback: supabase/rollback/20260930234000_cache_sem_atropelo.sql
*/
begin;

drop trigger if exists "TG_SYNCENTREVISTA_REMONTA_PAINEL" on public."TL_SYNC_ENTREVISTA";
drop function if exists private."FC_REMONTAR_ENTREVISTAS_APOS_SYNC"();

do $$
declare
  v record;
begin
  for v in
    select * from (values
      ('agsus_aprovados_cache_por_area', '*/2 * * * *',
       'select public.atualizar_cache_aprovados_vencidos() where pg_try_advisory_xact_lock(hashtext(''agsus_aprovados_cache_por_area''));'),
      ('agsus_analises_cache_do_painel', '*/2 * * * *',
       'select public.atualizar_cache_painel_analises_vencidos() where pg_try_advisory_xact_lock(hashtext(''agsus_analises_cache_do_painel''));'),
      ('agsus_entrevistas_cache_do_painel', '1-59/2 * * * *',
       'select public.atualizar_cache_painel_entrevistas() where pg_try_advisory_xact_lock(hashtext(''agsus_entrevistas_cache_do_painel''));')
    ) j(nome, quando, comando)
  loop
    if exists (select 1 from cron.job where jobname = v.nome) then
      perform cron.alter_job((select jobid from cron.job where jobname = v.nome), schedule => v.quando, command => v.comando);
    else
      perform cron.schedule(v.nome, v.quando, v.comando);
    end if;
  end loop;
end;
$$;

commit;
