-- Desfaz 20260930234000: volta o gatilho de remontagem e os comandos do cron sem trava.
begin;

create function private."FC_REMONTAR_ENTREVISTAS_APOS_SYNC"()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new."TP_SITUACAO" = 'CONCLUIDA' and old."TP_SITUACAO" is distinct from 'CONCLUIDA' then
    perform public.atualizar_cache_painel_entrevistas(new."CO_AREA");
  end if;
  return new;
end;
$function$;
comment on function private."FC_REMONTAR_ENTREVISTAS_APOS_SYNC"() is 'Gatilho: carga de entrevistas concluída remonta o pacote pronto da área.';
revoke all on function private."FC_REMONTAR_ENTREVISTAS_APOS_SYNC"() from public, anon, authenticated;
create trigger "TG_SYNCENTREVISTA_REMONTA_PAINEL"
  after update of "TP_SITUACAO" on public."TL_SYNC_ENTREVISTA"
  for each row execute function private."FC_REMONTAR_ENTREVISTAS_APOS_SYNC"();

select cron.alter_job((select jobid from cron.job where jobname = 'agsus_aprovados_cache_por_area'),
  command => 'select public.atualizar_cache_aprovados_vencidos();');
select cron.alter_job((select jobid from cron.job where jobname = 'agsus_analises_cache_do_painel'),
  command => 'select public.atualizar_cache_painel_analises_vencidos();');
select cron.alter_job((select jobid from cron.job where jobname = 'agsus_entrevistas_cache_do_painel'),
  command => 'select public.atualizar_cache_painel_entrevistas();');

commit;
