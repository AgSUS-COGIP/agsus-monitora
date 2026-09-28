/*
  ROLLBACK de migrations/20260928140000_anexos_do_candidato_aprovado.sql
  Remove as RPCs, a tabela e as políticas dos anexos. O bucket só sai vazio:
  apague os objetos pelo painel do Storage (ou pela API) antes de rodar.
*/
begin;

drop function if exists public.remover_anexo_candidato_aprovado(uuid);
drop function if exists public.registrar_anexo_candidato_aprovado(uuid, text, text);
drop function if exists public.listar_anexos_candidatos_aprovados();

drop policy if exists anexos_candidatos_storage_select on storage.objects;
drop policy if exists anexos_candidatos_storage_insert on storage.objects;
drop policy if exists anexos_candidatos_storage_delete on storage.objects;

drop function if exists private."FC_CANDIDATO_NA_AREA"(text);
drop table if exists public."TB_ANEXO_CANDIDATO_APROVADO";

delete from storage.buckets
 where id = 'anexos-candidatos-aprovados'
   and not exists (select 1 from storage.objects where bucket_id = 'anexos-candidatos-aprovados');

commit;
