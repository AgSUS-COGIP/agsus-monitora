/*
  LISTA DE CONVOCAÇÃO: ORDEM DO SIMULADOR DO MGI

  O modelo de convocação ganha uma terceira forma de pôr as vagas de cota na
  ordem de chamada, SERIE_MGI, a do simulador de reserva de vagas do MGI:
  categoria com posições informadas segue a série dela (PCD na 5ª, 21ª,
  41ª…); as outras entram a cada 100 ÷ percentual posições, começando no meio
  do primeiro intervalo; posição ocupada fica com a livre anterior. O cálculo é
  do front (src/lib/lista-convocacao-rules.js); o banco só guarda a escolha.

  Muda só a lista de valores aceitos e os comentários. Os modelos salvos não
  mudam.

  Rollback: supabase/rollback/20261002090000_convocacao_serie_mgi.sql
*/
begin;

alter table public."TB_MODELO_CONVOCACAO"
  drop constraint "CK_MODELO_CONVOC_DISTRIB",
  add constraint "CK_MODELO_CONVOC_DISTRIB"
    check ("TP_DISTRIBUICAO" in ('PROPORCIONAL', 'POSICAO_FIXA', 'SERIE_MGI'));

comment on constraint "CK_MODELO_CONVOC_DISTRIB" on public."TB_MODELO_CONVOCACAO" is
  'Formas de distribuir as vagas de reserva: PROPORCIONAL, POSICAO_FIXA ou SERIE_MGI.';
comment on column public."TB_MODELO_CONVOCACAO"."TP_DISTRIBUICAO" is
  'PROPORCIONAL espalha as vagas de reserva pela sequencia; POSICAO_FIXA usa as posicoes publicadas no edital; SERIE_MGI segue o simulador de reserva de vagas do MGI (posicoes informadas, senao a cada 100/percentual posicoes).';
comment on column public."TB_CATEGORIA_CONVOCACAO"."DS_POSICAO" is
  'Posicoes publicadas no edital, separadas por ponto e virgula (ex.: 3;8). Vale com TP_DISTRIBUICAO = POSICAO_FIXA ou SERIE_MGI (nesta, vazio = calculado pelo percentual).';

commit;
