/*
  RECURSOS: PAINEL E ANALISAR SEPARADOS NO MENU (09/10/2026)

  Pedido: "o de Recursos está com a funcionalidade de painel e de
  operacional". Como em Entrevistas (Painel de entrevistas × Conduzir
  entrevistas, 20261008130000_conduzir_entrevistas_no_menu.sql), o
  acompanhamento e a operação viram duas entradas do menu.

  O QUE MUDA (só o catálogo do menu: TB_ABA × RL_ABA_AREA; nenhuma tabela,
  coluna, função ou permissão nova)
    1. A aba 'recursos' (view 'recursos') passa a se chamar "Painel de
       recursos" e perde o selo BETA: é o acompanhamento, só leitura
       (números, gráficos, pendências, filtros, fila e exportação).
    2. A aba nova 'analisar-recursos' (view 'analisar-recursos',
       src/modulos/recursos/recursos.tsx no modo "analise") entra DESLIGADA
       (ST_ATIVO = 'N', selo BETA), na ordem 7, nas mesmas áreas em que o
       painel está (e ligada/desligada como ele em cada uma). Painel de
       entrevistas, Conduzir entrevistas, Classificação, Lista de aprovados e
       Seleção descem uma posição.
       20261009230500_liga_aba_analisar_recursos.sql liga junto com o merge
       do front.
    Recurso de permissão: o mesmo 'recursos' (TB_ABA.CO_RECURSO só informa).
    Quem vê a entrada é o front (canAnalisarRecursos, src/lib/access-roles.js):
    quem só lê Recursos fica com o painel; quem edita Recursos ou dá o parecer
    jurídico (recursos_parecer) vê as duas. Cada ação continua conferida pelo
    banco nas RPCs de sempre (pode_editar, pode_decidir).

  Ensaio: supabase/ensaios/20261009230000_analisar_recursos_no_menu.sql
  Rollback: supabase/rollback/20261009230000_analisar_recursos_no_menu.sql
  Teste: tests/analisar-recursos-no-menu-migration.test.js e
         tests/catalogo-de-abas.test.js
*/
begin;

set local lock_timeout = '10s';

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from public."TB_ABA" where "CO_ABA" = 'recursos') then
    raise exception 'Catálogo de abas sem a aba recursos (20260929120000_recursos.sql).';
  end if;
  if not exists (select 1 from public."TB_ABA" where "CO_ABA" = 'conduzir-entrevistas') then
    raise exception 'Aplique antes 20261008130000_conduzir_entrevistas_no_menu.sql.';
  end if;
  if exists (select 1 from public."TB_ABA" where "CO_ABA" = 'analisar-recursos') then
    raise exception 'A aba analisar-recursos já existe: esta migration já foi aplicada.';
  end if;
end;
$$;

-- 1. Menu: o painel muda de rótulo e sai do beta; Analisar recursos entra desligada ------
update public."TB_ABA" set "NO_ABA" = 'Painel de recursos', "ST_BETA" = 'N', "DT_ATUALIZACAO" = now() where "CO_ABA" = 'recursos';

update public."TB_ABA" set "NU_ORDEM" = 8, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'entrevistas';
update public."TB_ABA" set "NU_ORDEM" = 9, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'conduzir-entrevistas';
update public."TB_ABA" set "NU_ORDEM" = 10, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'classificacao';
update public."TB_ABA" set "NU_ORDEM" = 11, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'aprovados';
update public."TB_ABA" set "NU_ORDEM" = 12, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'selecao';

insert into public."TB_ABA" ("CO_ABA", "NO_ABA", "DS_ICONE", "NU_ORDEM", "CO_VIEW", "CO_RECURSO", "TP_ABA", "ST_ATIVO", "ST_BETA")
values ('analisar-recursos', 'Analisar recursos', 'gavel', 7, 'analisar-recursos', 'recursos', 'nativa', 'N', 'S');
insert into public."RL_ABA_AREA" ("CO_ABA", "CO_AREA", "ST_ATIVO")
select 'analisar-recursos', r."CO_AREA", r."ST_ATIVO" from public."RL_ABA_AREA" r where r."CO_ABA" = 'recursos'
on conflict do nothing;

commit;
