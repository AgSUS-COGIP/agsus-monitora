/*
  ENSAIO — cadastro INATIVO da Pré-classificação (#596).
  Contém exatamente as instruções da migration, seguidas de conferências
  transacionais. Sempre termina em ROLLBACK; não implanta nem muda candidatos.
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
$$;

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


-- Conferências do resultado da migration, antes de descartar a transação.
do $$
begin
  if not exists (
    select 1 from public."TB_ABA"
    where "CO_ABA" = 'pre-classificacao'
      and "CO_VIEW" = 'pre-classificacao'
      and "CO_RECURSO" = 'avaliacao_documental'
      and "ST_ATIVO" = 'N'
      and "NU_ORDEM" = 6
  ) then
    raise exception 'FALHOU E1: nova entrada ausente, ativa ou com recurso/ordem incorretos.';
  end if;
  if (
    select count(*) from public."RL_ABA_AREA"
     where "CO_ABA" = 'pre-classificacao' and "ST_ATIVO" = 'S'
  ) <> (select count(*) from public."TB_AREA") then
    raise exception 'FALHOU E2: vínculos das áreas não conferem.';
  end if;
  if not exists (
    select 1 from public."TB_ABA"
     where "CO_ABA" = 'selecao'
       and "NO_ABA" = 'Painel da Seleção'
       and "CO_RECURSO" = 'selecao'
       and "NU_ORDEM" = 13
  ) then
    raise exception 'FALHOU E3: o Painel da Seleção foi alterado indevidamente.';
  end if;
  if exists (
    select 1 from (values
      ('recursos', 7), ('analisar-recursos', 8),
      ('entrevistas', 9), ('conduzir-entrevistas', 10),
      ('classificacao', 11), ('aprovados', 12)
    ) as v(codigo, ordem_esperada)
    left join public."TB_ABA" a on a."CO_ABA" = v.codigo
    where a."CO_ABA" is null
       or a."NU_ORDEM" is distinct from v.ordem_esperada
  ) then
    raise exception 'FALHOU E4: sequência do menu divergente.';
  end if;
end;
$$;

rollback;
