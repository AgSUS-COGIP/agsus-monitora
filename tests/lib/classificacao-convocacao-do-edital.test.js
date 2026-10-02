import { describe, expect, it } from "vitest";
import {
  codigoDaCategoria,
  convocacaoDoEdital,
  divergenciasDasCotas,
  modeloDaRegra,
  vagasDaConvocacao,
  vagasPelaConta,
} from "../../src/lib/classificacao/convocacao-do-edital.js";
import { classificar } from "../../src/lib/classificacao/motor.js";
import { vagasPelosPercentuais } from "../../src/lib/classificacao/vagas.js";
import { derivarQuadro } from "../../src/lib/lista-convocacao-rules.js";
import { modeloDeReferencia } from "../../src/lib/modelo-de-convocacao.js";

/*
  Uma conta só para as vagas por modalidade: a Classificação usa a mesma
  `derivarQuadro` da Lista de aprovados › Convocação, e lê a configuração de
  convocação do edital quando existir.
*/

const REGRA = {
  modalidades: [
    { codigo: "AC" },
    { codigo: "PCD", nome: "PcD", percentual: 5, arredondamento: "PARA_CIMA" },
    { codigo: "PP", nome: "Pretos e Pardos", percentual: 25 },
    {
      codigo: "PI",
      nome: "Indígenas",
      percentual: 3,
      remanejar_para: ["PQ", "PP"],
    },
    {
      codigo: "PQ",
      nome: "Quilombolas",
      percentual: 2,
      remanejar_para: ["PI", "PP"],
    },
  ],
  cotas: { minimo_vagas_reserva: 2, acumulo: "MAIOR_PERCENTUAL" },
};

describe("modelo de convocação a partir da regra", () => {
  it("categorias, arredondamento, mínimo e cascata", () => {
    const modelo = modeloDaRegra(REGRA);
    const pcd = modelo.categorias.find((c) => c.sigla === "PCD");
    expect(pcd).toMatchObject({
      percentual: 5,
      arredondamento: "sempre_acima",
      minimo: 2,
    });
    expect(modelo.categorias.find((c) => c.sigla === "PI").cascata).toEqual([
      "pq",
      "pp",
    ]);
    expect(modelo.cotaMultipla).toBe("maior_percentual");
  });

  it("vagasPelosPercentuais = derivarQuadro (a mesma conta da convocação)", () => {
    for (const total of [0, 1, 2, 3, 4, 7, 10, 20, 40]) {
      const modelo = modeloDaRegra(REGRA);
      expect(vagasPelaConta(total, modelo)).toMatchObject(
        Object.fromEntries(
          Object.entries(derivarQuadro(total, modelo)).map(([id, n]) => [
            codigoDaCategoria(modelo.categorias.find((c) => c.id === id)),
            n,
          ]),
        ),
      );
    }
    // 1 vaga: abaixo do mínimo, tudo na ampla; 4 vagas: 1 PP e 1 PcD (sempre para cima).
    expect(vagasPelosPercentuais(1, REGRA)).toEqual({ AC: 1 });
    expect(vagasPelosPercentuais(4, REGRA)).toEqual({ AC: 2, PP: 1, PCD: 1 });
  });

  it("os códigos das categorias dos modelos de referência", () => {
    const modelo = modeloDeReferencia("saude-indigena-2026");
    expect(modelo.categorias.map(codigoDaCategoria)).toEqual([
      "AC",
      "PP",
      "PI",
      "PQ",
      "PCD",
    ]);
  });
});

const linhasDoBanco = (modelo, vagas, padrao = 0) => ({
  modelos: [
    {
      modelo_id: "m1",
      nome: modelo.nome,
      distribuicao: modelo.distribuicao,
      cota_multipla: modelo.cotaMultipla,
      categorias: modelo.categorias,
      editais: 1,
    },
  ],
  configuracoes: [
    {
      edital_id: "e1",
      proporcionalidade: true,
      modelo_id: "m1",
      padrao_imediata: padrao,
      vagas,
    },
  ],
});

describe("configuração de convocação do edital", () => {
  const modelo = modeloDeReferencia("saude-indigena-2026");

  it("sem configuração para o edital → null", () => {
    expect(convocacaoDoEdital(linhasDoBanco(modelo, []), "outro")).toBeNull();
    expect(convocacaoDoEdital({}, "e1")).toBeNull();
  });

  it("quadro manual da vaga vale; total derivado pelo modelo", () => {
    const conv = convocacaoDoEdital(
      linhasDoBanco(modelo, [
        {
          codigo_vaga: "169681",
          cargo: "Cirurgião Dentista",
          imediatas: 3,
          manual: true,
          quadro: { ampla: 2, pretos_pardos: 1 },
        },
        { codigo_vaga: "169682", cargo: "Enfermeiro", imediatas: 4 },
      ]),
      "e1",
    );
    expect(vagasDaConvocacao(conv, "169681")).toEqual({
      total: 3,
      porModalidade: { AC: 2, PP: 1, PI: 0, PQ: 0, PCD: 0 },
    });
    expect(vagasDaConvocacao(conv, "169682").total).toBe(4);
    expect(vagasDaConvocacao(conv, "999999")).toBeNull();
  });

  it("o motor usa a configuração quando o quadro do edital só tem o total", () => {
    const conv = convocacaoDoEdital(
      linhasDoBanco(modelo, [
        {
          codigo_vaga: "169681",
          imediatas: 3,
          manual: true,
          quadro: { ampla: 2, indigena: 1 },
        },
      ]),
      "e1",
    );
    const r = classificar({
      tipo: "FINAL",
      regra: {
        ...REGRA,
        documental: { situacoes_aptas: [] },
        etapas: { entrevista: false },
        composicao: { componentes: [{ codigo: "DOCUMENTAL", peso: 1 }] },
      },
      candidatos: [
        {
          analise_id: "a1",
          nome: "Ana",
          vaga: "169681",
          quadro: "q1",
          nota_documental: 20,
          modalidade: "Ampla",
        },
        {
          analise_id: "a2",
          nome: "Iara",
          vaga: "169681",
          quadro: "q1",
          nota_documental: 10,
          modalidade: "Indígena",
          pontuacao_etnica: 7,
        },
      ],
      quadro: [
        {
          id: "q1",
          cargo: "Cirurgião Dentista",
          vagas_imediatas: 3,
          modalidades: {},
        },
      ],
      convocacao: conv,
    });
    const v = r.vagas[0];
    expect(v.origemDasVagas).toBe("CONVOCACAO");
    expect(v.vagasPorModalidade).toMatchObject({ AC: 2, PI: 1 });
    expect(v.porModalidade.PI[0]).toMatchObject({
      nome: "Iara",
      situacao: "VAGA",
    });
  });

  it("total diferente do quadro do edital: vale o quadro e avisa", () => {
    const conv = convocacaoDoEdital(
      linhasDoBanco(modelo, [{ codigo_vaga: "169681", imediatas: 5 }]),
      "e1",
    );
    const r = classificar({
      tipo: "PRELIMINAR",
      regra: { ...REGRA, documental: { situacoes_aptas: [] } },
      candidatos: [
        {
          analise_id: "a1",
          nome: "Ana",
          vaga: "169681",
          quadro: "q1",
          nota_documental: 20,
        },
      ],
      quadro: [
        {
          id: "q1",
          cargo: "Cirurgião Dentista",
          vagas_imediatas: 3,
          modalidades: {},
        },
      ],
      convocacao: conv,
    });
    expect(r.vagas[0].origemDasVagas).toBe("REGRA");
    expect(r.avisos.map((a) => a.codigo)).toContain(
      "VAGAS_DIFERENTES_DA_CONVOCACAO",
    );
  });

  it("percentuais da regra × modelo da convocação: divergência vira aviso", () => {
    const conv = convocacaoDoEdital(linhasDoBanco(modelo, []), "e1");
    expect(divergenciasDasCotas(REGRA, conv)).toEqual([]);
    const outra = {
      ...REGRA,
      modalidades: REGRA.modalidades.map((m) =>
        m.codigo === "PP" ? { ...m, percentual: 20 } : m,
      ),
    };
    expect(divergenciasDasCotas(outra, conv)).toEqual([
      expect.stringContaining("PP: 20% na regra × 25%"),
    ]);
  });
});
