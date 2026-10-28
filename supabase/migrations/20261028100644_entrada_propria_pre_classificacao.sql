/*
  PRÉ-CLASSIFICAÇÃO: ENTRADA INDEPENDENTE NO PROCESSO SELETIVO (#587).

  Somente metadados de navegação: cria a aba DESLIGADA, preservando o recurso
  existente 'avaliacao_documental'. A autorização por edital é feita
  no backend por private."FC_EXIGIR_COORD_AVALIACAO" (migration de 16/10).
  Não cria recurso para o painel 'selecao', não dá GRANT a ninguém,
  não altera classificação, regras, notas, lotes nem candidaturas.

  A migration separada 20261028100707 ativa a entrada somente após o
  frontend estar implantado e a matriz de acesso verificada.
  Rollback: supabase/rollback/20261028100644_entrada_propria_pre_classificacao.sql
*/
begin;
set local lock_timeout = '5s';

do $$
begin
  if not exists (
    select 1 from public."TB_ABA"
     where "CO_ABA" = 'avaliacao-documental'
       and "CO_RECURSO" = 'avaliacao_documental'
  ) then
    raise exception 'A aba Avaliação Documental e seu recurso devem existir.';
  end if;
  if not exists (select 1 from public."TB_ABA" where "CO_ABA" = 'selecao') then
    raise exception 'Catálogo sem aba selecao.';
  end if;
  if not ('avaliacao_documental' = any (private."FC_RECURSOS_MODULO"())) then
    raise exception 'Recurso avaliacao_documental indisponível.';
  end if;
  -- Reexecutar sobre uma entrada já existente pode ocultar conflito de
  -- recurso e ligar áreas a uma aba alheia. Falhar antes de qualquer UPDATE.
  if exists (
    select 1 from public."TB_ABA" where "CO_ABA" = 'pre-classificacao'
  ) then
    raise exception 'A aba pre-classificacao já existe: conferir antes de aplicar.';
  end if;
  -- O rollback não dispõe de histórico da ordenação personalizada.
  -- Exigir o baseline conhecido evita deslocar uma aba cujo gestor já
  -- personalizou a ordem e depois desfazer indevidamente essa escolha.
  if exists (
    select 1 from (values
      ('recursos', 6),
      ('analisar-recursos', 7),
      ('entrevistas', 8),
      ('conduzir-entrevistas', 9),
      ('classificacao', 10),
      ('aprovados', 11),
      ('selecao', 12)
    ) as v(codigo, ordem_esperada)
    left join public."TB_ABA" a on a."CO_ABA" = v.codigo
    where a."CO_ABA" is null
       or a."NU_ORDEM" is distinct from v.ordem_esperada
  ) then
    raise exception 'Ordem do catálogo personalizada ou incompleta: revisar migration sem sobrescrever ajustes.';
  end if;
end;
$;

-- Desloca somente o baseline conferido; a pré-verificação recusa ordens personalizadas.
update public."TB_ABA" a
   set "NU_ORDEM" = v.ordem_nova, "DT_ATUALIZACAO" = now()
  from (values
    ('recursos', 6, 7),
    ('analisar-recursos', 7, 8),
    ('entrevistas', 8, 9),
    ('conduzir-entrevistas', 9, 10),
    ('classificacao', 10, 11),
    ('aprovados', 11, 12),
    ('selecao', 12, 13)
  ) as v(codigo, ordem_antiga, ordem_nova)
 where a."CO_ABA" = v.codigo
   and a."NU_ORDEM" = v.ordem_antiga;

-- O painel continua exclusivamente de acompanhamento, com o recurso 'selecao'.
update public."TB_ABA"
   set "NO_ABA" = 'Painel da Seleção', "DT_ATUALIZACAO" = now()
 where "CO_ABA" = 'selecao' and "NO_ABA" = 'Seleção';

-- A tela nova usa o recurso existente, não 'selecao'.
insert into public."TB_ABA"
  ("CO_ABA", "NO_ABA", "DS_ICONE", "NU_ORDEM", "CO_VIEW",
   "CO_RECURSO", "TP_ABA", "ST_ATIVO", "ST_BETA")
values
  ('pre-classificacao', 'Pré-classificação', 'list-ordered', 6,
   'pre-classificacao', 'avaliacao_documental', 'nativa', 'N', 'S');

insert into public."RL_ABA_AREA" ("CO_ABA", "CO_AREA", "ST_ATIVO")
select 'pre-classificacao', a."CO_AREA", 'S'
  from public."TB_AREA" a
on conflict ("CO_ABA", "CO_AREA") do nothing;

commit;
