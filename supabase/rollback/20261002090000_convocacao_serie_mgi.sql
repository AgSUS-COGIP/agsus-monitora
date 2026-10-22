-- Desfaz 20261002090000_convocacao_serie_mgi. Recusa enquanto houver modelo
-- com SERIE_MGI: troque a distribuição dele antes (no front, ou para
-- PROPORCIONAL).
begin;

do $$
begin
  if exists (select 1 from public."TB_MODELO_CONVOCACAO" where "TP_DISTRIBUICAO" = 'SERIE_MGI') then
    raise exception 'Há modelos com a ordem do simulador do MGI: troque a distribuição deles antes de reverter';
  end if;
end;
$$;

alter table public."TB_MODELO_CONVOCACAO"
  drop constraint "CK_MODELO_CONVOC_DISTRIB",
  add constraint "CK_MODELO_CONVOC_DISTRIB"
    check ("TP_DISTRIBUICAO" in ('PROPORCIONAL', 'POSICAO_FIXA'));

comment on constraint "CK_MODELO_CONVOC_DISTRIB" on public."TB_MODELO_CONVOCACAO" is null;
comment on column public."TB_MODELO_CONVOCACAO"."TP_DISTRIBUICAO" is
  'PROPORCIONAL espalha as vagas de reserva pela sequencia; POSICAO_FIXA usa as posicoes publicadas no edital.';
comment on column public."TB_CATEGORIA_CONVOCACAO"."DS_POSICAO" is
  'Posicoes publicadas no edital, separadas por ponto e virgula (ex.: 3;8). So vale com TP_DISTRIBUICAO = POSICAO_FIXA.';

commit;
