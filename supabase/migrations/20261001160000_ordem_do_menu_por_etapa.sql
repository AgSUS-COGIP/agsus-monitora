/*
  O menu de cada área segue as etapas do processo seletivo (pedido do usuário
  em 01/10/2026): Visão geral, Editais, Cronograma, Análises curriculares,
  Recursos, Entrevistas, Lista de aprovados e Seleção. Antes a Lista de
  aprovados vinha logo depois do Cronograma e Recursos depois de Entrevistas.

  Só muda TB_ABA."NU_ORDEM" (nenhuma área sobrescreve a ordem em RL_ABA_AREA).
  O catálogo do código (ABAS_DO_MENU, src/lib/menu-lateral.js) muda junto.

  Rollback: supabase/rollback/20261001160000_ordem_do_menu_por_etapa.sql
*/
begin;

update public."TB_ABA" set "NU_ORDEM" = 4, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'analises';
update public."TB_ABA" set "NU_ORDEM" = 5, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'recursos';
update public."TB_ABA" set "NU_ORDEM" = 6, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'entrevistas';
update public."TB_ABA" set "NU_ORDEM" = 7, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'aprovados';
update public."TB_ABA" set "NU_ORDEM" = 8, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'selecao';

commit;
