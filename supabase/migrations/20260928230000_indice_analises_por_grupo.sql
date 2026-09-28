/*
  Índice para o painel de análises recortar a área sem ler a tabela toda.

  O painel filtra por "grupo_norm" (a área) e "ativo". Sem índice, cada abertura
  lia as ≈24 mil análises para achar as da área (Projetos: 1.285). Com o
  servidor do banco lento, essa leitura chegou a 3,5 s.
*/
begin;

create index if not exists "IN_ANALISECURRICULAR_GRUPONORM"
  on public."TB_ANALISE_CURRICULAR" (grupo_norm, ativo);

comment on index public."IN_ANALISECURRICULAR_GRUPONORM" is
  'Recorte por área (grupo normalizado) e situação no painel de análises.';

commit;
