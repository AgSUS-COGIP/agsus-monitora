/*
  REMOVE A AGENDA DAS INSCRIÇÕES DO 114/2026

  Por quê: a tarefa agsus_robo_inscricoes_114_2026 (20261009140000) pedia o
  robô da Empregare do 114/2026 às 7h e 13h de Brasília até 15/10/2026. As
  inscrições acabaram, o edital está congelado (correcoes/20261020-congelar-
  inscricoes-114.sql) e a tarefa ficou no pg_cron INATIVA (active = false,
  jobid 21 em 22/10/2026): a própria FC_AGENDA_DAS_INSCRICOES só se desliga
  por cron.unschedule quando roda depois da data, e ela já não rodava. Aqui
  ela sai de vez, pelo nome.

  Fica: private."FC_AGENDA_DAS_INSCRICOES" (serve a outro edital: ver
  docs/agenda-dos-robos.md, "Outro edital").

  Idempotente: sem a tarefa, não faz nada.
  Dependentes: nenhum (o Status das atualizações lê cron.job na hora).
  Ensaio: supabase/ensaios/20261022150000_remove_agenda_das_inscricoes_do_114.sql
  Rollback: supabase/rollback/20261022150000_remove_agenda_das_inscricoes_do_114.sql
*/
begin;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'agsus_robo_inscricoes_114_2026') then
    perform cron.unschedule('agsus_robo_inscricoes_114_2026');
  end if;
end;
$$;

commit;
