/*
  Ensaio de 20261015150000_varias_cotas.sql (sempre desfeito: begin … rollback).

  Uso (Git Bash):
    source ensaio.sh
    ensaio "$(sed -E '/^\s*(begin|commit|rollback)\s*;\s*$/Id' supabase/migrations/20261015150000_varias_cotas.sql)
    $(cat supabase/ensaios/20261015150000_varias_cotas.sql)"

  Espera-se uma linha com tudo true e as contagens do 114.
*/
with regra as (
  select '{"blocos":[{"codigo":"COTA_PP","condicao":"MODALIDADE=PP"},{"codigo":"COTA_PCD","condicao":"MODALIDADE=PCD"}]}'::jsonb as r
), cotas as (
  select '{"acumulo":"MAIOR_PERCENTUAL","percentuais":{"PCD":5,"PP":25,"PI":3,"PQ":2}}'::jsonb as c
)
select
  -- A lista do lançamento (e o lançamento antigo, pela modalidade única).
  private."FC_MODALIDADES_DO_LANCAMENTO"('{"modalidades":["PP","PCD","pp","AC"]}') = array['PP', 'PCD'] as lista,
  private."FC_MODALIDADES_DO_LANCAMENTO"('{"modalidade":"PI"}') = array['PI'] as antigo,
  private."FC_MODALIDADES_DO_LANCAMENTO"('{"modalidade":"AC"}') = '{}'::text[] as ampla,
  -- O bloco de cota vale para quem optou pela cota, entre as várias.
  private."FC_BLOCO_SE_APLICA"('{"condicao":"MODALIDADE=PCD"}', '{"nivel":"superior","modalidade":"PP","modalidades":["PP","PCD"]}') as bloco_pcd,
  not private."FC_BLOCO_SE_APLICA"('{"condicao":"MODALIDADE=PI"}', '{"nivel":"superior","modalidade":"PP","modalidades":["PP","PCD"]}') as bloco_pi,
  -- PP não conforme + PCD conforme → PCD; os dois não conformes → ampla; os dois conformes → PP, PCD.
  private."FC_COTAS_CONFIRMADAS"((select r from regra),
    '{"modalidades":["PP","PCD"],"blocos":{"COTA_PP":{"situacao":"NAO_CONFORME"},"COTA_PCD":{"situacao":"CONFORME"}}}', (select c from cotas)) = array['PCD'] as final_pcd,
  private."FC_COTAS_CONFIRMADAS"((select r from regra),
    '{"modalidades":["PP","PCD"],"blocos":{"COTA_PP":{"situacao":"NAO_CONFORME"},"COTA_PCD":{"situacao":"NAO_ENVIADO"}}}', (select c from cotas)) = '{}'::text[] as final_ac,
  private."FC_COTAS_CONFIRMADAS"((select r from regra),
    '{"modalidades":["PCD","PP"],"blocos":{"COTA_PP":{"situacao":"CONFORME"},"COTA_PCD":{"situacao":"CONFORME"}}}', (select c from cotas)) = array['PP', 'PCD'] as final_pp,
  private."FC_MODALIDADES_PUBLICADAS"(array['PP', 'PCD']) = 'Pretos e pardos | Pessoas com deficiência (PCD)' as publicada,
  private."FC_MODALIDADES_PUBLICADAS"('{}') = 'Ampla concorrência' as publicada_ac,
  private."FC_PCD_DAS_MODALIDADES"(array['PP', 'PCD']) = 'SIM' and private."FC_PCD_DAS_MODALIDADES"(array['PP']) = 'NÃO' as pcd,
  -- A lista preenchida para quem já tinha cota (e só para quem tinha).
  not exists (select 1 from public."TB_PRE_CLASSIFICACAO"
               where ("NO_MODALIDADE" = 'AC') <> ("DS_MODALIDADES" = '[]'::jsonb)
                  or ("NO_MODALIDADE" <> 'AC' and "DS_MODALIDADES" ->> 0 is distinct from "NO_MODALIDADE")) as preenchida,
  -- O job antigo (sem a chave) e o novo.
  (select modalidades from private."FC_LINHAS_PRE_CLASSIF"('[{"id":"00000000-0000-0000-0000-000000000001","modalidade":"PP"}]')) = '["PP"]'::jsonb as job_antigo,
  (select modalidades from private."FC_LINHAS_PRE_CLASSIF"('[{"id":"00000000-0000-0000-0000-000000000001","modalidade":"PP","modalidades":["PP","PCD"]}]')) = '["PP","PCD"]'::jsonb as job_novo,
  -- A ficha leva a lista; a abertura das fichas do 114 roda e a linha publicada não muda sem lista nova.
  (private."FC_FICHA_ANALISE_JSON"((select "CO_FICHA_ANALISE" from public."TB_FICHA_ANALISE"
     where "CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0' limit 1))::jsonb ? 'modalidades') as ficha_json,
  private."FC_ABRIR_FICHAS"('bcecfb08-88ef-4e06-8401-bcad6bf88fd0', '[]', null) as abrir_114,
  (select jsonb_object_agg(m, n) from (select coalesce(nullif(array_to_string(private."FC_MODALIDADES_DA_FICHA"(f."CO_FICHA_ANALISE"), '+'), ''), 'AC') m, count(*) n
     from public."TB_FICHA_ANALISE" f where f."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0' group by 1) x) as cotas_das_fichas_114;
