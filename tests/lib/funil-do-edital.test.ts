import { describe, expect, it } from "vitest";
import {
  numeroDoFunil,
  textoDaFonteDoFunil,
} from "../../src/lib/funil-do-edital.ts";
import {
  compararEntrevistas,
  entrevistaVigente,
} from "../../src/lib/entrevista-vigente.ts";

/*
  O funil do edital vem de uma fonte só (migration 20261022200000): a tela
  mostra de onde e de quando, e o campo que a fonte não tem como "—".
  E a regra única de qual entrevista vale (a mesma de FC_ENTREVISTAS_VIGENTES).
*/

describe("funil do edital na tela", () => {
  const agora = new Date("2026-10-22T18:00:00Z");

  it("diz a fonte e a data dos dados", () => {
    expect(
      textoDaFonteDoFunil(
        { TP_FONTE_FUNIL: "SELECAO", DT_FONTE_FUNIL: "2026-10-16T11:10:14Z" },
        agora,
      ),
    ).toBe("Fonte: Seleção, em 16/10, 08:10");
    expect(
      textoDaFonteDoFunil(
        {
          TP_FONTE_FUNIL: "AVALIACAO_DOCUMENTAL",
          DT_FONTE_FUNIL: "2026-10-22T13:00:00Z",
        },
        agora,
      ),
    ).toBe("Fonte: Avaliação documental, às 10:00");
    expect(textoDaFonteDoFunil({ TP_FONTE_FUNIL: "ANALISES" }, agora)).toBe(
      "Fonte: Análises curriculares",
    );
  });

  it("sem fonte gravada (carga original), nada", () => {
    expect(textoDaFonteDoFunil({ TP_FONTE_FUNIL: null })).toBeNull();
    expect(textoDaFonteDoFunil(null)).toBeNull();
    expect(textoDaFonteDoFunil({ TP_FONTE_FUNIL: "OUTRA" })).toBeNull();
  });

  it("nulo é —, zero é 0", () => {
    expect(numeroDoFunil(null)).toBe("—");
    expect(numeroDoFunil(undefined)).toBe("—");
    expect(numeroDoFunil(0)).toBe("0");
    expect(numeroDoFunil(7726)).toBe("7.726");
  });
});

describe("qual entrevista vale (regra única)", () => {
  const planilha = {
    id: "a",
    parecer: "APTO",
    nota: 14,
    origem: "planilha",
    atualizadoEm: "2026-10-01T10:00:00Z",
  };
  const sistemaSemParecer = {
    id: "b",
    parecer: "SEM_PARECER",
    nota: null,
    origem: "sistema",
    atualizadoEm: "2026-10-22T10:00:00Z",
  };

  it("a de parecer vence a convocação nova do sistema", () => {
    expect(entrevistaVigente([sistemaSemParecer, planilha])).toBe(planilha);
  });

  it("com parecer nas duas, a do sistema; depois a mais recente; depois o maior id", () => {
    const sistema = { ...sistemaSemParecer, parecer: "INAPTO", nota: 9 };
    expect(entrevistaVigente([planilha, sistema])).toBe(sistema);
    const nova = { ...planilha, id: "c", atualizadoEm: "2026-10-02T10:00:00Z" };
    expect(entrevistaVigente([planilha, nova])).toBe(nova);
    const mesmaHora = { ...planilha, id: "z" };
    expect(entrevistaVigente([planilha, mesmaHora])).toBe(mesmaHora);
  });

  it("sem parecer, a que tem nota", () => {
    const comNota = {
      ...sistemaSemParecer,
      id: "n",
      origem: "planilha",
      nota: 10,
    };
    expect(compararEntrevistas(comNota, sistemaSemParecer)).toBeLessThan(0);
    expect(entrevistaVigente([])).toBeNull();
  });
});
