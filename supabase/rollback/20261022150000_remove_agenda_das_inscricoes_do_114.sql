/*
  Rollback de 20261022150000_remove_agenda_das_inscricoes_do_114.sql.

  Recria a tarefa como estava em cron.job em 22/10/2026: mesma agenda
  (0 10,16 * * * = 7h e 13h de Brasília), mesmo comando e INATIVA
  (active = false). Já existindo, não faz nada.
*/
begin;

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

commit;
