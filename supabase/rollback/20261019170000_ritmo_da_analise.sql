/*
  Rollback de 20261019170000_ritmo_da_analise: tira a RPC do card "Ritmo da
  análise" e o índice parcial das fichas concluídas. Antes, publique um front
  sem o card (a tela esconde o card se a RPC não existir, mas loga o aviso).
*/
drop function if exists public.obter_ritmo_da_analise(text);
drop index if exists public."IN_FICHAANALISE_CONCLUIDA";
