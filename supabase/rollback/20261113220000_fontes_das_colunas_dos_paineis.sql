/*
  DESFAZ 20261113220000_fontes_das_colunas_dos_paineis.sql: tira as RPCs e as funções das fontes,
  a configuração, o histórico e o schema painel.

  ANTES, desfaça 20261113240000 (as RPCs dos relatórios chamam FC_APLICAR_FONTES_DO_PAINEL) e
  20261113230000 (as visões do schema painel). O schema sai com "drop schema" sem cascade: se
  ainda houver visão nele, o rollback para aqui em vez de apagar o que não conhece.
*/
begin;

drop function if exists public.salvar_fonte_da_coluna(text, text, text, text, text, text);
drop function if exists public.listar_fontes_do_painel(text, text);
drop function if exists private."FC_FONTES_DO_PAINEL_JSON"(text, text);
drop function if exists private."FC_APLICAR_FONTES_DO_PAINEL"(text, text, jsonb);
drop function if exists private."FC_OPCOES_DE_FONTE_DO_PAINEL"(text, text);
drop function if exists private."FC_COLUNAS_EDITAVEIS_DO_PAINEL"();
drop table if exists public."TH_FONTE_COLUNA_PAINEL";
drop table if exists public."TB_FONTE_COLUNA_PAINEL";
drop schema if exists painel;

commit;
