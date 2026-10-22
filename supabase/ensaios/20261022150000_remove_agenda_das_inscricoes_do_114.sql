/*
  ENSAIO de 20261022150000_remove_agenda_das_inscricoes_do_114.sql — begin … rollback.

  Cole no SQL Editor do Supabase (papel postgres). Confere:
    1. a migration tira a tarefa agsus_robo_inscricoes_114_2026 e não mexe
       nas outras tarefas;
    2. rodar de novo não falha (idempotente);
    3. o rollback a devolve igual (agenda, comando, inativa).
  Termina em rollback: nada fica gravado.
*/
begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create temporary table ensaio_antes on commit drop as
  select jobname, schedule, command, active from cron.job;

-- 1. A migration (corpo de supabase/migrations/20261022150000_…).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'agsus_robo_inscricoes_114_2026') then
    perform cron.unschedule('agsus_robo_inscricoes_114_2026');
  end if;
end;
$$;

do $ensaio$
begin
  assert not exists (select 1 from cron.job where jobname = 'agsus_robo_inscricoes_114_2026'),
         'a tarefa do 114/2026 continua no pg_cron';
  assert (select count(*) from ensaio_antes where jobname <> 'agsus_robo_inscricoes_114_2026')
         = (select count(*) from cron.job),
         'outra tarefa mudou';
end;
$ensaio$;

-- 2. De novo: nada a fazer, sem erro.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'agsus_robo_inscricoes_114_2026') then
    perform cron.unschedule('agsus_robo_inscricoes_114_2026');
  end if;
end;
$$;

-- 3. O rollback (corpo de supabase/rollback/20261022150000_…).
do $$
declare
  v_id bigint;
begin
  if not exists (select 1 from cron.job where jobname = 'agsus_robo_inscricoes_114_2026') then
    v_id := cron.schedule(
      'agsus_robo_inscricoes_114_2026',
      '0 10,16 * * *',
      $cmd$select private."FC_AGENDA_DAS_INSCRICOES"('agsus_robo_inscricoes_114_2026', '114/2026', date '2026-10-15');$cmd$
    );
    perform cron.alter_job(v_id, active => false);
  end if;
end;
$$;

do $ensaio$
begin
  assert exists (
    select 1
      from cron.job j
      join ensaio_antes a using (jobname)
     where j.jobname = 'agsus_robo_inscricoes_114_2026'
       and j.schedule = a.schedule and j.command = a.command and j.active = a.active),
    'o rollback não devolveu a tarefa igual';
end;
$ensaio$;

select 'ensaio ok' as resultado;

rollback;
