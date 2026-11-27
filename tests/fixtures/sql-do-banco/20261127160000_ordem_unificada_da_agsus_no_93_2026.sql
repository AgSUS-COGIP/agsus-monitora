/*
  ORDEM UNIFICADA DA AGSUS (UJUR) NO EDITAL 93/2026 (27/11/2026)

  POR QUE
  O edital 93/2026 (SESMT do Escritório Distrital de Boa Vista) publica a tabela "Ordem Unificada
  de Convocação" (item 11.1.4): indígenas na 17ª, 51ª e 84ª. O modelo dele seguia o simulador do
  MGI (SERIE_MGI), que põe a 2ª indígena na 49ª: a 50ª é de pretos e pardos, e o MGI leva a vaga
  para a livre anterior; a tabela da AgSUS (UJUR) leva para a livre seguinte.
  Os outros editais com a série do MGI não publicam essa tabela e ficam como estão (decisão do
  usuário em 27/11/2026: só o 93/2026).

  O QUE MUDA
    - public."TB_MODELO_CONVOCACAO"."TP_DISTRIBUICAO" aceita ORDEM_AGSUS (CK_MODELO_CONVOC_DISTRIB).
    - O 93/2026 usava o mesmo modelo do 81/2026. Ganha um modelo próprio, cópia do atual (nome,
      cota múltipla e categorias iguais), com TP_DISTRIBUICAO = ORDEM_AGSUS, e passa a apontar para
      ele. O 81/2026 e o modelo dele não mudam.
    - Nenhuma RPC muda: listar_modelos_convocacao devolve lower(TP_DISTRIBUICAO) e
      salvar_modelo_convocacao grava upper(distribuicao); a tela traduz `ordem_agsus`.

  GUARDA: o 93/2026 existe, tem configuração de convocação e o modelo dele é SERIE_MGI.
  Ensaio: supabase/ensaios/20261127160000_ordem_unificada_da_agsus_no_93_2026.sql
  Rollback: supabase/rollback/20261127160000_ordem_unificada_da_agsus_no_93_2026.sql
*/

begin;

set local lock_timeout = '5s';

do $guarda$
declare
  v_distribuicao text;
begin
  select mc."TP_DISTRIBUICAO" into v_distribuicao
    from public."TB_MONITORAMENTO_INDIGENA" m
    join public."TB_CONVOCACAO_EDITAL" ce on ce."CO_EDITAL" = m.id::text
    join public."TB_MODELO_CONVOCACAO" mc on mc."CO_MODELO" = ce."CO_MODELO"
   where m.edital = '93/2026';
  if v_distribuicao is distinct from 'SERIE_MGI' then
    raise exception '93/2026 sem modelo SERIE_MGI (achado: %): refaça a migration a partir do banco', v_distribuicao
      using errcode = '55000';
  end if;
end
$guarda$;

alter table public."TB_MODELO_CONVOCACAO" drop constraint "CK_MODELO_CONVOC_DISTRIB";
alter table public."TB_MODELO_CONVOCACAO" add constraint "CK_MODELO_CONVOC_DISTRIB"
  check ((("TP_DISTRIBUICAO")::text = any (array[('PROPORCIONAL'::character varying)::text, ('POSICAO_FIXA'::character varying)::text, ('SERIE_MGI'::character varying)::text, ('ORDEM_AGSUS'::character varying)::text])));

comment on constraint "CK_MODELO_CONVOC_DISTRIB" on public."TB_MODELO_CONVOCACAO" is
  'Formas de distribuir as vagas de reserva: PROPORCIONAL, POSICAO_FIXA, SERIE_MGI ou ORDEM_AGSUS (a série do MGI com a posição ocupada indo para a livre seguinte, como a tabela da UJUR; 20261127160000).';

do $copia$
declare
  v_edital text;
  v_antigo uuid;
  v_novo uuid := gen_random_uuid();
begin
  select ce."CO_EDITAL", ce."CO_MODELO" into v_edital, v_antigo
    from public."TB_MONITORAMENTO_INDIGENA" m
    join public."TB_CONVOCACAO_EDITAL" ce on ce."CO_EDITAL" = m.id::text
   where m.edital = '93/2026';

  insert into public."TB_MODELO_CONVOCACAO"
    ("CO_MODELO", "NO_MODELO", "TP_DISTRIBUICAO", "TP_COTA_MULTIPLA", "CO_USUARIO_ATUALIZACAO")
  select v_novo, 'Ordem unificada da AgSUS (UJUR) — 25/3/2 e 5% PCD — 93/2026', 'ORDEM_AGSUS',
         mc."TP_COTA_MULTIPLA", mc."CO_USUARIO_ATUALIZACAO"
    from public."TB_MODELO_CONVOCACAO" mc
   where mc."CO_MODELO" = v_antigo;

  insert into public."TB_CATEGORIA_CONVOCACAO"
    ("CO_MODELO", "CO_CATEGORIA", "NO_CATEGORIA", "SG_CATEGORIA", "ST_AMPLA", "ST_ACUMULAVEL",
     "TX_RESERVA", "TP_ARREDONDAMENTO", "TX_TETO", "QT_MINIMA_RESERVA", "DS_TERMO", "DS_POSICAO",
     "QT_INTERVALO", "DS_CASCATA", "NU_ORDEM")
  select v_novo, c."CO_CATEGORIA", c."NO_CATEGORIA", c."SG_CATEGORIA", c."ST_AMPLA", c."ST_ACUMULAVEL",
         c."TX_RESERVA", c."TP_ARREDONDAMENTO", c."TX_TETO", c."QT_MINIMA_RESERVA", c."DS_TERMO",
         c."DS_POSICAO", c."QT_INTERVALO", c."DS_CASCATA", c."NU_ORDEM"
    from public."TB_CATEGORIA_CONVOCACAO" c
   where c."CO_MODELO" = v_antigo;

  update public."TB_CONVOCACAO_EDITAL"
     set "CO_MODELO" = v_novo, "DT_ATUALIZACAO" = now()
   where "CO_EDITAL" = v_edital;
end
$copia$;

commit;
