/*
  Volta o catálogo antes da nova aba. Aplicar depois do rollback da ativação,
  se necessário. Não altera dados de candidatos e não redefine permissões.
*/
begin;
set local lock_timeout = '5s';

do $
begin
  -- A ativação tem rollback próprio. Recusar remoção de entrada ainda ativa.
  if not exists (
    select 1 from public."TB_ABA"
     where "CO_ABA" = 'pre-classificacao'
       and "CO_RECURSO" = 'avaliacao_documental'
       and "CO_VIEW" = 'pre-classificacao'
       and "ST_ATIVO" = 'N'
  ) then
    raise exception 'Desative a Pré-classificação e confira a entrada antes do rollback.';
  end if;
  -- Não desfazer ordenações personalizadas após a implantação.
  if exists (
    select 1 from (values
      ('recursos', 7),
      ('analisar-recursos', 8),
      ('entrevistas', 9),
      ('conduzir-entrevistas', 10),
      ('classificacao', 11),
      ('aprovados', 12),
      ('selecao', 13)
    ) as v(codigo, ordem_esperada)
    left join public."TB_ABA" a on a."CO_ABA" = v.codigo
    where a."CO_ABA" is null
       or a."NU_ORDEM" is distinct from v.ordem_esperada
  ) then
    raise exception 'Ordem alterada desde a migration: conferir rollback antes de continuar.';
  end if;
end;
$;

delete from public."RL_ABA_AREA" where "CO_ABA" = 'pre-classificacao';
delete from public."TB_ABA"
 where "CO_ABA" = 'pre-classificacao'
   and "CO_RECURSO" = 'avaliacao_documental';

update public."TB_ABA"
   set "NO_ABA" = 'Seleção', "DT_ATUALIZACAO" = now()
 where "CO_ABA" = 'selecao' and "NO_ABA" = 'Painel da Seleção';

update public."TB_ABA" a
   set "NU_ORDEM" = v.ordem_antiga, "DT_ATUALIZACAO" = now()
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
   and a."NU_ORDEM" = v.ordem_nova;

commit;
