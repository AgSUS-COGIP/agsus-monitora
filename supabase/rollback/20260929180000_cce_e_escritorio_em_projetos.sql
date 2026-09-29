/*
  ROLLBACK de migrations/20260929180000_cce_e_escritorio_em_projetos.sql

  Devolve CCE e Escritório Distrital e Regional à SEDE e, com elas, os editais
  que a migration moveu (os de TH_MONITORAMENTO com
  snapshot_json->>'acao' = 'cce_e_escritorio_em_projetos') e que continuam em
  Projetos. Registra a volta em TH_MONITORAMENTO do mesmo jeito.
*/
begin;

update public."TA_UNIDADE_AREA"
   set "CO_AREA" = 'sede'
 where "NO_UNIDADE" in ('CCE', 'Escritório Distrital e Regional');

with devolvidos as (
  update public."TB_MONITORAMENTO_INDIGENA" m
     set "CO_AREA" = 'sede',
         updated_at = now()
   where m."CO_AREA" = 'projetos'
     and m.id in (
       select h.id_registro
         from public."TH_MONITORAMENTO" h
        where h.campo_alterado = 'CO_AREA'
          and h.snapshot_json ->> 'acao' = 'cce_e_escritorio_em_projetos'
     )
  returning m.id
)
insert into public."TH_MONITORAMENTO"(
  id_registro, usuario_id, usuario_email, evento,
  campo_alterado, valor_anterior, valor_novo, snapshot_json
)
select
  devolvidos.id,
  null,
  null,
  'atualizado',
  'CO_AREA',
  'projetos',
  'sede',
  jsonb_build_object(
    'acao', 'rollback_cce_e_escritorio_em_projetos',
    'de', 'projetos',
    'para', 'sede',
    'motivo', 'Rollback de 20260929180000_cce_e_escritorio_em_projetos.sql'
  )
from devolvidos;

commit;
