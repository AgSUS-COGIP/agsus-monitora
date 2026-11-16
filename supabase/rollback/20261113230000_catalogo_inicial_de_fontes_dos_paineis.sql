/*
  DESFAZ 20261113230000_catalogo_inicial_de_fontes_dos_paineis.sql: apaga as escolhas que apontam
  para estas visões (o histórico das trocas fica) e as visões.
*/
begin;

delete from public."TB_FONTE_COLUNA_PAINEL"
 where "NO_VISAO" in ('VW_EDITAL_QUADRO_DE_VAGAS', 'VW_EDITAL_VAGAS_DA_CONVOCACAO', 'VW_EDITAL_CADASTRO',
                      'VW_VAGA_CONVOCACAO', 'VW_VAGA_TRIAGEM', 'VW_VAGA_INSCRICOES',
                      'VW_APROVADO_CONTRATACAO', 'VW_APROVADO_ANTES_DA_DECISAO');

drop view if exists painel."VW_EDITAL_QUADRO_DE_VAGAS";
drop view if exists painel."VW_EDITAL_VAGAS_DA_CONVOCACAO";
drop view if exists painel."VW_EDITAL_CADASTRO";
drop view if exists painel."VW_VAGA_CONVOCACAO";
drop view if exists painel."VW_VAGA_TRIAGEM";
drop view if exists painel."VW_VAGA_INSCRICOES";
drop view if exists painel."VW_APROVADO_CONTRATACAO";
drop view if exists painel."VW_APROVADO_ANTES_DA_DECISAO";

commit;
