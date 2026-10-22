/*
  Rollback de 20261022190500_apagar_anexo_orfao_do_recurso.sql.

  Tira a política de delete e a função dela: o bucket recursos-anexos volta a
  não deixar apagar nada pela API (o front só deixa de limpar o arquivo
  órfão; o envio e o registro seguem iguais).
*/
begin;

drop policy if exists "PL_ANEXO_RECURSO_STORAGE_APAGAR_ORFAO" on storage.objects;
drop function if exists private."FC_ANEXO_RECURSO_ORFAO"(text);

commit;
