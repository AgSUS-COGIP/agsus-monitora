-- ATENCAO: desfazer esta politica reabre o bucket cronogramas-editais a quem
-- edita Nucleo ou Calendario, sem recorte por edital ou area (SEG-01).
-- Usar somente em recuperacao autorizada. Nao altera nem apaga arquivos.
begin;
set local lock_timeout = '3s';
do $guarda$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'PL_STORAGE_CRONOGRAMAS_SO_ADMIN'
  ) then
    raise exception 'Migration 20261110120000 nao aplicada: nada a desfazer';
  end if;
end $guarda$;
drop policy if exists "PL_STORAGE_CRONOGRAMAS_SO_ADMIN" on storage.objects;
commit;
