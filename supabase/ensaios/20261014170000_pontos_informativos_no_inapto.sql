/*
  ENSAIO da migration 20261014170000_pontos_informativos_no_inapto.sql — begin … rollback.

  NÃO É MIGRATION. Rode depois da migration, na mesma transação (ensaio.sh:
  sem as linhas begin/commit), e desfaça. Usa a regra vigente do 114/2026 na
  vaga 182438 (CARGO 2, Análise da Água, nível superior) e o caso que motivou
  a opção: Escolaridade "Não confere" (curso diverso), mestrado (8) e um curso
  de 80 h (2) — nota apurada 10, nota final 0.

  Espera:
    1. regra vigente (sem a opção) → aceita;
    2. regra com a opção ligada e o modelo da linha → aceita;
    3. regra com a opção "sim" (texto) → recusa;
    4. regra com o modelo de 4.001 caracteres → recusa;
    5. resultado sem a opção e sem a pontuação informativa (como hoje) → aceito;
    6. resultado com a opção e a pontuação informativa 10 → aceito;
    7. resultado com a opção e SEM a pontuação informativa → recusa;
    8. resultado sem a opção e COM a pontuação informativa → recusa;
    9. resultado com a opção e a pontuação informativa 12 (≠ apurada) → recusa;
   10. Apto com a opção e a pontuação informativa → recusa.
  Antes da migration (e depois do rollback), todos são aceitos: as chaves novas
  eram ignoradas.
*/
create temporary table t_regra on commit drop as
select h."DS_CONFIGURACAO" as c
  from public."TB_REGRA_ANALISE" r
  join public."TH_REGRA_ANALISE" h on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
 where r."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
create temporary table t_saida (n int, caso text, saida text) on commit drop;
do $$
declare
  v_regra jsonb := (select c from t_regra);
  v_ligada jsonb := jsonb_set(v_regra, '{parecer}', (v_regra -> 'parecer') || jsonb_build_object(
    'mostrar_pontos_quando_inapto', true,
    'pontos_informativos', E'\n\nPontuação apurada dos títulos, para fins informativos (não entra na nota final, item 8.2.1): {nota_informativa} pontos ({distribuicao_informativa}).'));
  v_lanc jsonb := '{"nivel":"superior","modalidade":"AC","vaga":"182438","blocos":{
    "IDENTIDADE":{"situacao":"CONFORME"},"ESCOLARIDADE":{"situacao":"NAO_CONFORME","motivos":["CURSO_DIVERSO"]},
    "REQUISITO_DO_CARGO":{"situacao":"CONFORME"},"REGISTRO_CONSELHO":{"situacao":"CONFORME"},
    "FORMACAO":{"situacao":"CONFORME"},"CURSOS":{"situacao":"CONFORME"},"EXPERIENCIA":{"situacao":"CONFORME"}},
    "titulos":[{"titulo":"MESTRADO","aceito":true}],"cursos":[{"horas":80,"aceito":true}],
    "vinculos":[{"categoria":"AREA","inicio":"2024-01-01","fim":"2024-06-29","aceito":true}]}';
  v_inapto jsonb := '{"resultado":"INAPTO_REQUISITO","nota_apurada":10,"nota_final":0,
    "parciais":{"FORMACAO":8,"CURSOS":2,"EXPERIENCIA":0},"eliminatorios":["Item 8.2.1: Curso diverso do exigido para a vaga."]}';
  v_info jsonb := '{"pontos_informativos":{"nota":10,"parciais":{"FORMACAO":8,"CURSOS":2,"EXPERIENCIA":0}}}';
  v_apto jsonb := '{"resultado":"APTO","nota_apurada":10,"nota_final":10,
    "parciais":{"FORMACAO":8,"CURSOS":2,"EXPERIENCIA":0},"eliminatorios":[]}';
  v_casos jsonb := jsonb_build_array(
    jsonb_build_object('n', 1, 'caso', 'regra vigente', 'regra', v_regra),
    jsonb_build_object('n', 2, 'caso', 'regra com a opção', 'regra', v_ligada),
    jsonb_build_object('n', 3, 'caso', 'opção em texto', 'regra',
      jsonb_set(v_ligada, '{parecer,mostrar_pontos_quando_inapto}', '"sim"')),
    jsonb_build_object('n', 4, 'caso', 'modelo longo demais', 'regra',
      jsonb_set(v_ligada, '{parecer,pontos_informativos}', to_jsonb(repeat('x', 4001)))),
    jsonb_build_object('n', 5, 'caso', 'sem a opção, sem a informativa', 'regra', v_regra, 'res', v_inapto),
    jsonb_build_object('n', 6, 'caso', 'com a opção, informativa 10', 'regra', v_ligada, 'res', v_inapto || v_info),
    jsonb_build_object('n', 7, 'caso', 'com a opção, sem a informativa', 'regra', v_ligada, 'res', v_inapto),
    jsonb_build_object('n', 8, 'caso', 'sem a opção, com a informativa', 'regra', v_regra, 'res', v_inapto || v_info),
    jsonb_build_object('n', 9, 'caso', 'informativa 12', 'regra', v_ligada,
      'res', v_inapto || jsonb_set(v_info, '{pontos_informativos,nota}', '12')),
    jsonb_build_object('n', 10, 'caso', 'apto com a informativa', 'regra', v_ligada, 'res', v_apto || v_info,
      'resultado', 'APTO'));
  v jsonb;
begin
  for v in select * from jsonb_array_elements(v_casos) loop
    begin
      if v ? 'res' then
        perform private."FC_VALIDAR_RESULTADO_FICHA"(
          private."FC_REGRA_DA_VAGA"(v -> 'regra', '182438', null, 'superior'),
          case when v ->> 'resultado' = 'APTO'
               then jsonb_set(v_lanc, '{blocos,ESCOLARIDADE}', '{"situacao":"CONFORME"}') else v_lanc end,
          v -> 'res', '{}'::jsonb);
      else
        perform private."FC_VALIDAR_REGRA_ANALISE"(v -> 'regra');
      end if;
      insert into t_saida values ((v ->> 'n')::int, v ->> 'caso', 'aceito');
    exception when sqlstate '22023' then
      insert into t_saida values ((v ->> 'n')::int, v ->> 'caso', 'recusado: ' || sqlerrm);
    end;
  end loop;
end $$;
select n, caso, saida from t_saida order by n;
