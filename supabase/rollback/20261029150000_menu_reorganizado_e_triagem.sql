/*
  ROLLBACK — devolve rótulos, ícones e ordem do menu de antes de
  20261029150000_menu_reorganizado_e_triagem.sql. Recusa se alguém mudou o
  catálogo depois da migration (não desfaz ajuste alheio).
*/
begin;
set local lock_timeout = '5s';

do $$
begin
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
       or a."NO_ABA" is distinct from v.rotulo_novo
       or a."DS_ICONE" is distinct from v.icone_novo
       or a."NU_ORDEM" is distinct from v.ordem_nova
  ) then
    raise exception 'Catálogo alterado desde a migration: conferir rollback antes de continuar.';
  end if;
end;
$$;

update public."TB_ABA" a
   set "NO_ABA" = v.rotulo_antigo,
       "DS_ICONE" = v.icone_antigo,
       "NU_ORDEM" = v.ordem_antiga,
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
 where a."CO_ABA" = v.codigo;

commit;
