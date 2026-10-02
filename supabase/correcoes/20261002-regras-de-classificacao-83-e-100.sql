/*
  DADOS DE EXEMPLO: regras de classificação dos editais 83/2026 (DSEI Xingu) e
  100/2026 (CASAI Nacional Brasília), a partir do levantamento dos editais e
  das listas publicadas (regras-por-edital.md, regra-83-2026.json,
  regra-100-2026.json). Não é schema: roda uma vez, depois da migration
  20261002120000_classificacao.sql, no SQL Editor (papel postgres).

  IDEMPOTENTE: só cria a regra (versão 1) do edital que ainda NÃO tem regra.
  Edital com regra (de uma execução anterior ou já editada na tela) não muda.
  Procura o edital pelo número (FC_NUMERO_EDITAL) na área saude-indigena; sem
  edital cadastrado, avisa e segue.

  O que é do edital (item citado) e o que é ESCOLHA PROVISÓRIA (o gestor do
  edital confirma ou troca na aba Classificação › Regra):
    83/2026 (consolidado de 14/07/2026)
      - nota mínima documental 7/6/5 por nível (8.19); entrevista ≥ 10 e ≥ 2,5
        por competência (9.9); nota final = documental + entrevista (10.1);
        desempate a–f (10.4); PcD 5% (4.1), PP 25%, PI 3%, PQ 2% (5.2),
        reversões (5.2.1–5.2.3), reserva com ≥ 2 vagas (5.3), acúmulo: fica na
        de maior percentual (5.13); convocação 5× / até a 10ª, Enfermeiro e
        Técnico de Enfermagem 10× / até a 20ª (8.23).
      - PROVISÓRIO: nível por cargo (Técnico… = técnico; Agente…/Auxiliar… =
        fundamental; o resto = superior); 1 casa decimal (como as listas
        publicadas); empate na preliminar = mesma posição (o edital não define
        desempate nessa etapa); empate final = mesma posição (o edital não
        define); data de corte = a do cronograma (fim das inscrições).
    100/2026
      - sem nota mínima documental; entrevista ≥ 8, ≥ 2,0 por competência e
        0 ou 1 elimina (9.12, 9.12.1); nota final = soma (10.1); desempate a–f
        (10.4); PcD 5% com sobra para indígenas (4.1.1), PP 25% com sobra para
        a ampla (5.2.4), PI 3%, PQ 2%; acúmulo só PcD + uma (5.13);
        convocação 6× / até a 5ª, Enfermeiro e Técnico de Enfermagem 10× /
        até a 20ª (8.23, 8.23.1).
      - PROVISÓRIO: 2 casas decimais; empate na preliminar pelos critérios
        (prática observada na lista de aptos, não prevista no edital); empate
        final = mesma posição; data de corte = a do cronograma.
*/
begin;

do $$
declare
  r record;
  m record;
  v_regra uuid;
  v_achou boolean;
begin
  for r in
    select * from (values
      ('83/2026', $regra83${
        "schema": 1,
        "data_corte": null,
        "etapas": { "documental": true, "entrevista": true },
        "documental": {
          "situacoes_aptas": ["Aprovado", "Triado"],
          "nota_minima": null,
          "nota_minima_por_nivel": { "superior": 7, "tecnico": 6, "fundamental": 5 },
          "niveis_por_cargo": [
            { "termo": "Técnico", "nivel": "tecnico" },
            { "termo": "Agente", "nivel": "fundamental" },
            { "termo": "Auxiliar", "nivel": "fundamental" }
          ],
          "nivel_padrao": "superior"
        },
        "entrevista": {
          "nota_minima": 10,
          "nota_minima_competencia": 2.5,
          "nota_eliminatoria_ate": null,
          "competencias": [
            { "ordem": 1, "nome": "Habilidade técnica", "minimo": null },
            { "ordem": 2, "nome": "Habilidade técnica intercultural", "minimo": null },
            { "ordem": 3, "nome": "Habilidade comportamental", "minimo": null },
            { "ordem": 4, "nome": "Habilidade situacional", "minimo": null }
          ],
          "exige_comparecimento": true,
          "inapto_elimina": true
        },
        "composicao": {
          "componentes": [ { "codigo": "DOCUMENTAL", "peso": 1 }, { "codigo": "ENTREVISTA", "peso": 1 } ],
          "casas": 1,
          "arredondamento": "MEIO_PARA_CIMA"
        },
        "desempate": [
          { "criterio": "IDOSO_60", "direcao": "SIM_PRIMEIRO" },
          { "criterio": "INDIGENA_COMPROVADO", "direcao": "SIM_PRIMEIRO" },
          { "criterio": "EXP_SAUDE_INDIGENA", "direcao": "MAIOR_PRIMEIRO" },
          { "criterio": "EXP_ATENCAO_BASICA", "direcao": "MAIOR_PRIMEIRO" },
          { "criterio": "NOTA_DOCUMENTAL", "direcao": "MAIOR_PRIMEIRO" },
          { "criterio": "NOTA_ENTREVISTA", "direcao": "MAIOR_PRIMEIRO" }
        ],
        "listas": { "PRELIMINAR": { "empate": "MESMA_POSICAO" }, "FINAL": { "empate": "CRITERIOS" } },
        "empate_final": { "metodo": "MESMA_POSICAO", "numeracao": "DENSA" },
        "modalidades": [
          { "codigo": "AC", "nome": "Ampla concorrência", "percentual": null, "arredondamento": "MEIO_PARA_CIMA", "lista_propria": false, "recomeca_posicao": true, "aparece_na_geral": true, "remanejar_para": [] },
          { "codigo": "PCD", "nome": "PcD", "percentual": 5, "arredondamento": "PARA_CIMA", "lista_propria": true, "recomeca_posicao": true, "aparece_na_geral": true, "remanejar_para": ["AC"] },
          { "codigo": "PP", "nome": "Pretos e Pardos", "percentual": 25, "arredondamento": "MEIO_PARA_CIMA", "lista_propria": true, "recomeca_posicao": true, "aparece_na_geral": true, "remanejar_para": ["AC"] },
          { "codigo": "PI", "nome": "Indígenas", "percentual": 3, "arredondamento": "MEIO_PARA_CIMA", "lista_propria": true, "recomeca_posicao": true, "aparece_na_geral": true, "remanejar_para": ["PQ", "PP"] },
          { "codigo": "PQ", "nome": "Quilombolas", "percentual": 2, "arredondamento": "MEIO_PARA_CIMA", "lista_propria": true, "recomeca_posicao": true, "aparece_na_geral": true, "remanejar_para": ["PI", "PP"] }
        ],
        "cotas": { "minimo_vagas_reserva": 2, "acumulo": "MAIOR_PERCENTUAL" },
        "convocacao": {
          "multiplo_vagas": 5,
          "posicao_max_cr": 10,
          "incluir_empatados": true,
          "excecoes": [ { "termos": ["Enfermeiro", "Técnico de Enfermagem"], "multiplo_vagas": 10, "posicao_max_cr": 20 } ]
        },
        "rodape": "Os critérios de desempate foram considerados conforme item 10.4 do edital.",
        "importacao": null
      }$regra83$::jsonb),
      ('100/2026', $regra100${
        "schema": 1,
        "data_corte": null,
        "etapas": { "documental": true, "entrevista": true },
        "documental": {
          "situacoes_aptas": ["Aprovado", "Triado"],
          "nota_minima": null,
          "nota_minima_por_nivel": {},
          "niveis_por_cargo": [],
          "nivel_padrao": null
        },
        "entrevista": {
          "nota_minima": 8,
          "nota_minima_competencia": 2,
          "nota_eliminatoria_ate": 1,
          "competencias": [
            { "ordem": 1, "nome": "Conhecimento de políticas públicas", "minimo": null },
            { "ordem": 2, "nome": "Habilidade intercultural", "minimo": null },
            { "ordem": 3, "nome": "Habilidade técnica específica da vaga", "minimo": null },
            { "ordem": 4, "nome": "Habilidade interpessoal", "minimo": null }
          ],
          "exige_comparecimento": true,
          "inapto_elimina": true
        },
        "composicao": {
          "componentes": [ { "codigo": "DOCUMENTAL", "peso": 1 }, { "codigo": "ENTREVISTA", "peso": 1 } ],
          "casas": 2,
          "arredondamento": "MEIO_PARA_CIMA"
        },
        "desempate": [
          { "criterio": "IDOSO_60", "direcao": "SIM_PRIMEIRO" },
          { "criterio": "INDIGENA_COMPROVADO", "direcao": "SIM_PRIMEIRO" },
          { "criterio": "EXP_SAUDE_INDIGENA", "direcao": "MAIOR_PRIMEIRO" },
          { "criterio": "EXP_ATENCAO_BASICA", "direcao": "MAIOR_PRIMEIRO" },
          { "criterio": "NOTA_DOCUMENTAL", "direcao": "MAIOR_PRIMEIRO" },
          { "criterio": "NOTA_ENTREVISTA", "direcao": "MAIOR_PRIMEIRO" }
        ],
        "listas": { "PRELIMINAR": { "empate": "CRITERIOS" }, "FINAL": { "empate": "CRITERIOS" } },
        "empate_final": { "metodo": "MESMA_POSICAO", "numeracao": "DENSA" },
        "modalidades": [
          { "codigo": "AC", "nome": "Ampla concorrência", "percentual": null, "arredondamento": "MEIO_PARA_CIMA", "lista_propria": false, "recomeca_posicao": true, "aparece_na_geral": true, "remanejar_para": [] },
          { "codigo": "PP", "nome": "Pretos e Pardos", "percentual": 25, "arredondamento": "MEIO_PARA_CIMA", "lista_propria": true, "recomeca_posicao": true, "aparece_na_geral": true, "remanejar_para": ["AC"] },
          { "codigo": "PI", "nome": "Indígenas", "percentual": 3, "arredondamento": "MEIO_PARA_CIMA", "lista_propria": true, "recomeca_posicao": true, "aparece_na_geral": true, "remanejar_para": ["PQ", "PP"] },
          { "codigo": "PQ", "nome": "Quilombolas", "percentual": 2, "arredondamento": "MEIO_PARA_CIMA", "lista_propria": true, "recomeca_posicao": true, "aparece_na_geral": true, "remanejar_para": ["PI", "PP"] },
          { "codigo": "PCD", "nome": "PcD", "percentual": 5, "arredondamento": "PARA_CIMA", "lista_propria": true, "recomeca_posicao": true, "aparece_na_geral": true, "remanejar_para": ["PI"] }
        ],
        "cotas": { "minimo_vagas_reserva": 2, "acumulo": "PCD_MAIS_UMA" },
        "convocacao": {
          "multiplo_vagas": 6,
          "posicao_max_cr": 5,
          "incluir_empatados": true,
          "excecoes": [ { "termos": ["Enfermeiro", "Técnico de Enfermagem"], "multiplo_vagas": 10, "posicao_max_cr": 20 } ]
        },
        "rodape": "Os critérios de desempate foram considerados conforme item 10.4 do edital.",
        "importacao": null
      }$regra100$::jsonb)
    ) v(numero, configuracao)
  loop
    perform private."FC_VALIDAR_REGRA_CLASSIFICACAO"(r.configuracao);
    v_achou := false;
    for m in
      select e.id, e.edital
        from public."TB_MONITORAMENTO_INDIGENA" e
       where e."CO_AREA" = 'saude-indigena' and private."FC_NUMERO_EDITAL"(e.edital) = r.numero
    loop
      v_achou := true;
      if exists (select 1 from public."TB_REGRA_CLASSIFICACAO" x where x."CO_MONITORAMENTO" = m.id) then
        raise notice 'Edital % (%): já tem regra de classificação; nada muda.', m.edital, m.id;
        continue;
      end if;
      insert into public."TB_REGRA_CLASSIFICACAO" ("CO_MONITORAMENTO", "NU_VERSAO_VIGENTE")
      values (m.id, 1)
      returning "CO_REGRA_CLASSIFICACAO" into v_regra;
      insert into public."TH_REGRA_CLASSIFICACAO"
        ("CO_REGRA_CLASSIFICACAO", "NU_VERSAO", "DS_CONFIGURACAO", "TP_EMPATE_FINAL", "DS_MOTIVO")
      values (v_regra, 1, r.configuracao, r.configuracao #>> '{empate_final,metodo}',
              'Regra inicial a partir do levantamento do edital (dados de exemplo; o gestor confirma).');
      insert into public."RL_REGRA_CRITERIO_DESEMPATE"
        ("CO_REGRA_CLASSIFICACAO", "NU_VERSAO", "NU_ORDEM", "CO_CRITERIO", "TP_DIRECAO")
      select v_regra, 1, d.ordem, upper(d.valor ->> 'criterio'), d.valor ->> 'direcao'
        from jsonb_array_elements(r.configuracao -> 'desempate') with ordinality d(valor, ordem);
      raise notice 'Edital % (%): regra de classificação criada (versão 1).', m.edital, m.id;
    end loop;
    if not v_achou then
      raise notice 'Edital % não está cadastrado na Saúde Indígena; regra não criada.', r.numero;
    end if;
  end loop;
end;
$$;

commit;
