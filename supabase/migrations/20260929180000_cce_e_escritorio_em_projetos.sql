/*
  CCE E ESCRITÓRIO DISTRITAL E REGIONAL SÃO PROJETOS

  Em 20260925170000_areas_do_sistema.sql as duas unidades foram para a SEDE,
  provisoriamente. Decisão de 29/09/2026 (responsável pelo sistema): a SEDE só
  tem a unidade SEDE; CCE e Escritório Distrital e Regional são Projetos.

  O QUE MUDA
    1. TA_UNIDADE_AREA: CCE e Escritório Distrital e Regional -> projetos.
       O formulário da SEDE deixa de oferecê-las (listar_unidades_por_area) e o
       salvar recusa as duas num edital da SEDE (FC_ACERTAR_AREA_EDITAL).
    2. Os editais dessas unidades que estão na SEDE vão para Projetos, com a
       mesma auditoria do mover_edital_de_area: uma linha em TH_MONITORAMENTO
       por edital (campo_alterado = 'CO_AREA', snapshot_json com a ação e o
       motivo). O gatilho de histórico grava também a foto da linha. Edital
       dessas unidades que um administrador já pôs em outra área fica onde está.

  Lista de aprovados, convocação, vagas e cronograma não guardam área: herdam
  do edital. As análises curriculares tiram a área do `grupo` da planilha e não
  mudam aqui.

  ROLLBACK: supabase/rollback/20260929180000_cce_e_escritorio_em_projetos.sql
*/
begin;

-- 1. A área das unidades ----------------------------------------------------------
update public."TA_UNIDADE_AREA"
   set "CO_AREA" = 'projetos'
 where "NO_UNIDADE" in ('CCE', 'Escritório Distrital e Regional');

-- 2. Os editais dessas unidades, com auditoria --------------------------------------
with movidos as (
  update public."TB_MONITORAMENTO_INDIGENA" m
     set "CO_AREA" = 'projetos',
         updated_at = now()
   where m."CO_AREA" = 'sede'
     and public.analises_norm_key(m.unidade) in (
       public.analises_norm_key('CCE'),
       public.analises_norm_key('Escritório Distrital e Regional')
     )
  returning m.id
)
insert into public."TH_MONITORAMENTO"(
  id_registro, usuario_id, usuario_email, evento,
  campo_alterado, valor_anterior, valor_novo, snapshot_json
)
select
  movidos.id,
  null,
  null,
  'atualizado',
  'CO_AREA',
  'sede',
  'projetos',
  jsonb_build_object(
    'acao', 'cce_e_escritorio_em_projetos',
    'de', 'sede',
    'para', 'projetos',
    'motivo', 'CCE e Escritório Distrital e Regional são Projetos (decisão de 29/09/2026)'
  )
from movidos;

commit;
