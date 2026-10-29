/*
  MENU REORGANIZADO E PRÉ-CLASSIFICAÇÃO VIRA TRIAGEM (decisão de 29/10/2026).

  Só metadados do menu (TB_ABA: "NO_ABA", "DS_ICONE", "NU_ORDEM"). Não liga
  nem desliga aba ou área ("ST_ATIVO" e RL_ABA_AREA ficam como estão), não
  mexe em recurso, permissão, rota, regra, nota, lote nem candidatura.

  - Acompanhar (1–6): Visão geral, Painel das análises, Painel de recursos,
    Painel de entrevistas, Painel da Seleção, Cronograma.
  - Processo seletivo, na ordem do fluxo (7–13): Editais, Triagem, Avaliação
    documental, Recursos, Entrevistas, Classificação, Lista de aprovados.
  - Rótulos curtos: "Pré-classificação" → "Triagem", "Analisar recursos" →
    "Recursos", "Conduzir entrevistas" → "Entrevistas".
  - Ícone próprio para a Triagem ('list-checks'): antes repetia o
    'list-ordered' da Classificação.

  O bloco de cada aba (Acompanhar ou Processo seletivo) é do front
  (src/lib/menu-lateral.ts, `blocoDaAba`); o código técnico continua
  'pre-classificacao' (view, rota, recurso e tabelas).
  Espelho no código: `ABAS_DO_MENU` (tests/catalogo-de-abas.test.js).
  Ensaio: supabase/ensaios/20261029150000_menu_reorganizado_e_triagem.sql
  Rollback: supabase/rollback/20261029150000_menu_reorganizado_e_triagem.sql
*/
begin;
set local lock_timeout = '5s';

do $$
begin
  -- Só metadados do menu. Recusar se o catálogo já não é o conferido em
  -- 29/10 (rótulo, ícone ou ordem personalizados, ou aba faltando): o
  -- rollback devolve exatamente esses valores.
  if exists (
    select 1 from (values
    ('visao-geral', 'Visão geral', 'map', 1, 'Visão geral', 'map', 1),
    ('editais', 'Editais', 'file-text', 2, 'Editais', 'file-text', 7),
    ('cronograma', 'Cronograma', 'calendar-days', 3, 'Cronograma', 'calendar-days', 6),
    ('analises', 'Painel das análises', 'file-search', 4, 'Painel das análises', 'file-search', 2),
    ('avaliacao-documental', 'Avaliação documental', 'graduation-cap', 5, 'Avaliação documental', 'graduation-cap', 9),
    ('pre-classificacao', 'Pré-classificação', 'list-ordered', 6, 'Triagem', 'list-checks', 8),
    ('recursos', 'Painel de recursos', 'scale', 7, 'Painel de recursos', 'scale', 3),
    ('analisar-recursos', 'Analisar recursos', 'gavel', 8, 'Recursos', 'gavel', 10),
    ('entrevistas', 'Painel de entrevistas', 'messages-square', 9, 'Painel de entrevistas', 'messages-square', 4),
    ('conduzir-entrevistas', 'Conduzir entrevistas', 'clipboard-pen-line', 10, 'Entrevistas', 'clipboard-pen-line', 11),
    ('classificacao', 'Classificação', 'list-ordered', 11, 'Classificação', 'list-ordered', 12),
    ('aprovados', 'Lista de aprovados', 'user-round-check', 12, 'Lista de aprovados', 'user-round-check', 13),
    ('selecao', 'Painel da Seleção', 'funnel', 13, 'Painel da Seleção', 'funnel', 5)
  ) as v(codigo, rotulo_antigo, icone_antigo, ordem_antiga, rotulo_novo, icone_novo, ordem_nova)
    left join public."TB_ABA" a on a."CO_ABA" = v.codigo
    where a."CO_ABA" is null
       or a."NO_ABA" is distinct from v.rotulo_antigo
       or a."DS_ICONE" is distinct from v.icone_antigo
       or a."NU_ORDEM" is distinct from v.ordem_antiga
  ) then
    raise exception 'Catálogo do menu diferente do conferido em 29/10: revisar antes de aplicar.';
  end if;
  -- Ícone ou ordem por área sobrepõem os da aba (poderiam repetir ícone).
  if exists (
    select 1 from public."RL_ABA_AREA"
     where "DS_ICONE" is not null or "NU_ORDEM" is not null
  ) then
    raise exception 'Há ícone ou ordem por área: revisar antes de aplicar.';
  end if;
end;
$$;

update public."TB_ABA" a
   set "NO_ABA" = v.rotulo_novo,
       "DS_ICONE" = v.icone_novo,
       "NU_ORDEM" = v.ordem_nova,
       "DT_ATUALIZACAO" = now()
  from (values
    ('visao-geral', 'Visão geral', 'map', 1, 'Visão geral', 'map', 1),
    ('editais', 'Editais', 'file-text', 2, 'Editais', 'file-text', 7),
    ('cronograma', 'Cronograma', 'calendar-days', 3, 'Cronograma', 'calendar-days', 6),
    ('analises', 'Painel das análises', 'file-search', 4, 'Painel das análises', 'file-search', 2),
    ('avaliacao-documental', 'Avaliação documental', 'graduation-cap', 5, 'Avaliação documental', 'graduation-cap', 9),
    ('pre-classificacao', 'Pré-classificação', 'list-ordered', 6, 'Triagem', 'list-checks', 8),
    ('recursos', 'Painel de recursos', 'scale', 7, 'Painel de recursos', 'scale', 3),
    ('analisar-recursos', 'Analisar recursos', 'gavel', 8, 'Recursos', 'gavel', 10),
    ('entrevistas', 'Painel de entrevistas', 'messages-square', 9, 'Painel de entrevistas', 'messages-square', 4),
    ('conduzir-entrevistas', 'Conduzir entrevistas', 'clipboard-pen-line', 10, 'Entrevistas', 'clipboard-pen-line', 11),
    ('classificacao', 'Classificação', 'list-ordered', 11, 'Classificação', 'list-ordered', 12),
    ('aprovados', 'Lista de aprovados', 'user-round-check', 12, 'Lista de aprovados', 'user-round-check', 13),
    ('selecao', 'Painel da Seleção', 'funnel', 13, 'Painel da Seleção', 'funnel', 5)
  ) as v(codigo, rotulo_antigo, icone_antigo, ordem_antiga, rotulo_novo, icone_novo, ordem_nova)
 where a."CO_ABA" = v.codigo
   and (a."NO_ABA", a."DS_ICONE", a."NU_ORDEM")
       is distinct from (v.rotulo_novo, v.icone_novo, v.ordem_nova);

commit;
