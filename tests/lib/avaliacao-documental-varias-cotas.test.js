/*
  Várias cotas por candidato (114/2026, itens 5.8.1 e 5.8.5): o bloco de cota
  vale para cada cota optada (lançamento.modalidades) e a modalidade final é a
  confirmada de maior percentual; sem nenhuma confirmada, a ampla. O mesmo que
  tests/python/test_pontuacao.py (VariasCotas) e FC_COTAS_CONFIRMADAS no banco.
*/
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  blocoSeAplica,
  calcularFicha,
  lancamentoInicial,
  resumoParaGravar,
} from "../../src/lib/avaliacao-documental/ficha.ts";
import {
  cotasConfirmadas,
  modalidadesDoLancamento,
} from "../../src/lib/avaliacao-documental/pontuacao.ts";

const CASOS = JSON.parse(
  readFileSync(
    "tests/fixtures/avaliacao-documental/casos-de-pontuacao.json",
    "utf8",
  ),
);
const REGRA = CASOS.regras["E114-POR-CARGO"];
const DOCUMENTAL = {
  nota_minima: 0,
  cotas: {
    acumulo: "MAIOR_PERCENTUAL",
    percentuais: { PCD: 5, PP: 25, PI: 3, PQ: 2 },
  },
};
const bloco = (codigo) => REGRA.blocos.find((b) => b.codigo === codigo);

function lancamento(blocos, modalidades = ["PP", "PCD"]) {
  return {
    nivel: "medio",
    vaga: "182528",
    modalidade: modalidades[0] ?? "AC",
    modalidades,
    blocos,
    titulos: [],
    cursos: [],
    vinculos: [],
  };
}

describe("várias cotas", () => {
  it("as cotas do lançamento: a lista ou, na ficha antiga, a modalidade única", () => {
    expect(
      modalidadesDoLancamento({ modalidades: ["pp", "PCD", "AC", "PP"] }),
    ).toEqual(["PP", "PCD"]);
    expect(modalidadesDoLancamento({ modalidade: "PI" })).toEqual(["PI"]);
    expect(modalidadesDoLancamento({ modalidade: "AC" })).toEqual([]);
    expect(modalidadesDoLancamento({})).toEqual([]);
  });

  it("PP e PCD optados abrem os dois blocos de cota (e só eles)", () => {
    const lanc = lancamento({});
    expect(blocoSeAplica(bloco("COTA_PP"), lanc)).toBe(true);
    expect(blocoSeAplica(bloco("COTA_PCD"), lanc)).toBe(true);
    expect(blocoSeAplica(bloco("COTA_PI"), lanc)).toBe(false);
    expect(blocoSeAplica(bloco("COTA_PCD"), lancamento({}, ["PP"]))).toBe(
      false,
    );
    expect(blocoSeAplica(bloco("COTA_PP"), lancamento({}, []))).toBe(false);
  });

  it("os dois conformes: final PP (25%), PcD também confirmada", () => {
    const r = calcularFicha(
      REGRA,
      lancamento({
        COTA_PP: { situacao: "CONFORME" },
        COTA_PCD: { situacao: "CONFORME" },
      }),
      DOCUMENTAL,
    );
    expect(r.modalidade_final).toBe("PP");
    expect(r.modalidades_confirmadas).toEqual(["PP", "PCD"]);
    const situacoes = Object.fromEntries(
      r.blocos
        .filter((b) => b.codigo.startsWith("COTA_"))
        .map((b) => [b.codigo, b.situacao]),
    );
    expect(situacoes).toEqual({
      COTA_PP: "CONFORME",
      COTA_PI: "NAO_SE_APLICA",
      COTA_PQ: "NAO_SE_APLICA",
      COTA_PCD: "CONFORME",
    });
  });

  it("PP não conforme e PCD conforme: final PCD", () => {
    const r = calcularFicha(
      REGRA,
      lancamento({
        COTA_PP: { situacao: "NAO_CONFORME" },
        COTA_PCD: { situacao: "CONFORME" },
      }),
      DOCUMENTAL,
    );
    expect(r.modalidade_final).toBe("PCD");
    expect(r.modalidades_confirmadas).toEqual(["PCD"]);
    expect(resumoParaGravar(r, null).modalidade_final).toBe("PCD");
  });

  it("os dois não conformes: fica na ampla", () => {
    const r = calcularFicha(
      REGRA,
      lancamento({
        COTA_PP: { situacao: "NAO_CONFORME" },
        COTA_PCD: { situacao: "NAO_ENVIADO" },
      }),
      DOCUMENTAL,
    );
    expect(r.modalidade_final).toBe("AC");
    expect(r.modalidades_confirmadas).toEqual([]);
  });

  it("PCD_MAIS_UMA põe a PcD primeiro; sem percentual, a ordem optada", () => {
    const avaliados = [];
    expect(
      cotasConfirmadas(
        avaliados,
        { modalidades: ["PP", "PCD"] },
        { acumulo: "PCD_MAIS_UMA" },
      ),
    ).toEqual(["PCD", "PP"]);
    expect(
      cotasConfirmadas(avaliados, { modalidades: ["PI", "PQ"] }, null),
    ).toEqual(["PI", "PQ"]);
  });

  it("a ficha nova leva a lista da pré-classificação", () => {
    const lanc = lancamentoInicial({
      regra: REGRA,
      respostas: {},
      modalidade: "PP",
      modalidades: ["PP", "PCD"],
      cargo: "Técnico",
      vaga: "182528",
      documental: DOCUMENTAL,
      gravado: null,
    });
    expect(lanc.modalidades).toEqual(["PP", "PCD"]);
    // Sem a lista (cabeçalho antigo): a modalidade única.
    expect(
      lancamentoInicial({
        regra: REGRA,
        respostas: {},
        modalidade: "PI",
        documental: DOCUMENTAL,
      }).modalidades,
    ).toEqual(["PI"]);
  });
});
