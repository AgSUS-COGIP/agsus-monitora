/*
  ATIVAR PRÉ-CLASSIFICAÇÃO (#587).
  Executar somente depois do deploy da view 'pre-classificacao' e da revisão
  de permissões. A primeira migration inseriu esta aba desligada.
  Rollback: supabase/rollback/20261028100707_ativar_entrada_pre_classificacao.sql
*/
begin;
set local lock_timeout = '5s';

do $$
begin
  if not exists (
    select 1 from public."TB_ABA"
     where "CO_ABA" = 'pre-classificacao'
       and "CO_VIEW" = 'pre-classificacao'
       and "CO_RECURSO" = 'avaliacao_documental'
  ) then
    raise exception 'A aba pre-classificacao deve estar cadastrada no recurso avaliacao_documental.';
  end if;
end;
$$;

update public."TB_ABA"
   set "ST_ATIVO" = 'S', "DT_ATUALIZACAO" = now()
 where "CO_ABA" = 'pre-classificacao'
   and "CO_RECURSO" = 'avaliacao_documental';

commit;
