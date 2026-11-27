/*
  ROLLBACK de 20261127160000_ordem_unificada_da_agsus_no_93_2026.sql

  O 93/2026 volta ao modelo de antes (o mesmo do 81/2026, SERIE_MGI, achado pelo nome e pela
  distribuição), o modelo próprio dele sai (as categorias saem em cascata) e a restrição volta a
  aceitar só PROPORCIONAL, POSICAO_FIXA e SERIE_MGI. Falha se houver outro modelo ORDEM_AGSUS:
  alguém o criou depois, e desfazer o apagaria.
*/

begin;

set local lock_timeout = '5s';

do $volta$
declare
  v_edital text;
  v_novo uuid;
  v_antigo uuid;
begin
  select ce."CO_EDITAL", ce."CO_MODELO" into v_edital, v_novo
    from public."TB_MONITORAMENTO_INDIGENA" m
    join public."TB_CONVOCACAO_EDITAL" ce on ce."CO_EDITAL" = m.id::text
   where m.edital = '93/2026';

  if exists (select 1 from public."TB_MODELO_CONVOCACAO"
              where "TP_DISTRIBUICAO" = 'ORDEM_AGSUS' and "CO_MODELO" is distinct from v_novo) then
    raise exception 'Há outro modelo ORDEM_AGSUS além do do 93/2026: desfaça à mão' using errcode = '55000';
  end if;

  select ce."CO_MODELO" into v_antigo
    from public."TB_MONITORAMENTO_INDIGENA" m
    join public."TB_CONVOCACAO_EDITAL" ce on ce."CO_EDITAL" = m.id::text
   where m.edital = '81/2026';
  if v_antigo is null then
    raise exception 'Sem o modelo do 81/2026 para o 93/2026 voltar' using errcode = '55000';
  end if;

  update public."TB_CONVOCACAO_EDITAL"
     set "CO_MODELO" = v_antigo, "DT_ATUALIZACAO" = now()
   where "CO_EDITAL" = v_edital;
  delete from public."TB_MODELO_CONVOCACAO" where "CO_MODELO" = v_novo;
end
$volta$;

alter table public."TB_MODELO_CONVOCACAO" drop constraint "CK_MODELO_CONVOC_DISTRIB";
alter table public."TB_MODELO_CONVOCACAO" add constraint "CK_MODELO_CONVOC_DISTRIB"
  check ((("TP_DISTRIBUICAO")::text = any (array[('PROPORCIONAL'::character varying)::text, ('POSICAO_FIXA'::character varying)::text, ('SERIE_MGI'::character varying)::text])));

comment on constraint "CK_MODELO_CONVOC_DISTRIB" on public."TB_MODELO_CONVOCACAO" is
  'Formas de distribuir as vagas de reserva: PROPORCIONAL, POSICAO_FIXA ou SERIE_MGI.';

commit;
