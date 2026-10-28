/* Desfaz a ativação da entrada; não altera qualquer candidato. */
begin;
update public."TB_ABA"
   set "ST_ATIVO" = 'N', "DT_ATUALIZACAO" = now()
 where "CO_ABA" = 'pre-classificacao'
   and "CO_RECURSO" = 'avaliacao_documental';
commit;
