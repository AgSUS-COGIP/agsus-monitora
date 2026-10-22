/*
  ENSAIO da migration 20261014210000_bloco_que_nao_pontua_no_nivel.sql — begin … rollback.

  NÃO É MIGRATION. Rode depois da migration, na mesma transação (ensaio.sh:
  sem as linhas begin/commit), e desfaça. Usa a regra vigente do 114/2026 na
  vaga de cada caso (FC_REGRA_DA_VAGA) e chama as pendências e a validação do
  lançamento direto, com um lançamento só com a identidade conferida.

  Espera (pendências da titulação = "Titulação acadêmica (a maior): marque a situação"):
    1. Motorista D 182567, médio   → sem a pendência da titulação; NAO_SE_APLICA na titulação aceito;
    2. Auxiliar 182444, médio      → sem a pendência da titulação;
    3. Técnico 182445, técnico     → sem a pendência da titulação;
    4. Químico 182418, superior    → com a pendência da titulação; NAO_SE_APLICA na titulação recusado;
    5. Motorista D 182567, médio   → Cursos e Experiência continuam pedindo a situação;
    6. sem nível                   → a titulação continua pedindo a situação.
  Antes da migration, 1 a 3 pedem a situação da titulação e o NAO_SE_APLICA do caso 1 é recusado.
*/
create temporary table t_regra on commit drop as
select h."DS_CONFIGURACAO" as c
  from public."TB_REGRA_ANALISE" r
  join public."TH_REGRA_ANALISE" h on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
 where r."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
create temporary table t_caso (n int, caso text, vaga text, cargo text, nivel text) on commit drop;
insert into t_caso values
  (1, 'Motorista D', '182567', 'CARGO 15: MOTORISTA - Categoria D (Nível Médio)', 'medio'),
  (2, 'Auxiliar', '182444', 'CARGO 11: AUXILIAR ADMINISTRATIVO - Auxiliar de Logística (Nível Médio)', 'medio'),
  (3, 'Técnico', '182445', 'CARGO 9: TÉCNICO DE LABORATÓRIO (Nível Técnico)', 'tecnico'),
  (4, 'Químico', '182418', 'CARGO 1: QUÍMICO - Análise da Água (Nível Superior)', 'superior'),
  (6, 'sem nível', '182567', 'CARGO 15: MOTORISTA - Categoria D (Nível Médio)', null);
create temporary table t_saida (n int, caso text, saida text) on commit drop;
do $$
declare
  v record;
  v_regra jsonb;
  v_lanc jsonb;
  v_pend text[];
begin
  for v in select * from t_caso order by n loop
    v_regra := private."FC_REGRA_DA_VAGA"((select c from t_regra), v.vaga, v.cargo, v.nivel);
    v_lanc := jsonb_build_object('nivel', v.nivel, 'modalidade', 'AC',
                                 'blocos', jsonb_build_object('IDENTIDADE', jsonb_build_object('situacao', 'CONFORME')));
    v_pend := private."FC_PENDENCIAS_FICHA"(v_regra, v_lanc, '{}'::jsonb);
    insert into t_saida values (v.n, v.caso,
      'titulação: ' || case when exists (select 1 from unnest(v_pend) p where p like 'Titulação acadêmica%')
                            then 'pede a situação' else 'não pede' end
      || ' · pontua no nível: ' || not private."FC_BLOCO_NAO_PONTUA_NO_NIVEL"(
           (select b from jsonb_array_elements(v_regra -> 'blocos') b where b ->> 'codigo' = 'FORMACAO'), v.nivel));
    if v.n = 5 or v.n = 1 then
      insert into t_saida values (5, 'Motorista D (cursos e experiência)',
        array_to_string(array(select p from unnest(v_pend) p where p like 'Cursos%' or p like 'Experiência%'), ' | '));
    end if;
    if v.n in (1, 4) then
      begin
        perform private."FC_VALIDAR_LANCAMENTO_FICHA"(v_regra,
          v_lanc || jsonb_build_object('blocos', jsonb_build_object('FORMACAO', jsonb_build_object('situacao', 'NAO_SE_APLICA'))));
        insert into t_saida values (v.n, v.caso || ' (NAO_SE_APLICA na titulação)', 'aceito');
      exception when sqlstate '22023' then
        insert into t_saida values (v.n, v.caso || ' (NAO_SE_APLICA na titulação)', 'recusado: ' || sqlerrm);
      end;
    end if;
  end loop;
end $$;
select n, caso, saida from t_saida order by n, caso;
