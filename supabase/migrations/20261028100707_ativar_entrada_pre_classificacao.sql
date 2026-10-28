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
       and "ST_ATIVO" = 'N'
  ) then
    raise exception 'A aba pre-classificacao deve estar cadastrada, inativa e no recurso avaliacao_documental.';
  end if;
  -- A entrada só fica visível depois de disponível nas áreas do sistema.
  -- A ausência ou desativação de uma ligação exige revisão e não é corrigida
  -- automaticamente pela ativação global da aba.
  if exists (
    select 1
      from public."TB_AREA" a
      left join public."RL_ABA_AREA" r
        on r."CO_ABA" = 'pre-classificacao'
       and r."CO_AREA" = a."CO_AREA"
     where r."CO_ABA" is null or r."ST_ATIVO" <> 'S'
  ) then
    raise exception 'Pré-classificação sem ligação ativa em todas as áreas.';
  end if;
end;
$$;

update public."TB_ABA"
   set "ST_ATIVO" = 'S', "DT_ATUALIZACAO" = now()
 where "CO_ABA" = 'pre-classificacao'
   and "CO_RECURSO" = 'avaliacao_documental';

commit;
