import { describe, expect, it } from "vitest";
import {
  lerDigitacao,
  movimentoDaTecla,
  moverNaGrade,
  textoDaEscala,
} from "../src/lib/digitacao-de-notas.ts";

/*
  O lançamento da ficha de notas como planilha (src/lib/digitacao-de-notas.ts):
  o que fazer com o que foi digitado numa célula e para onde o foco vai.
*/

const ZERO_A_CINCO = [0, 1, 2, 3, 4, 5];

describe("lerDigitacao", () => {
  it("num 0 a 5, um dígito da escala já é a nota completa (avança)", () => {
    expect(lerDigitacao("3", ZERO_A_CINCO)).toEqual({
      estado: "completa",
      texto: "3",
    });
    expect(lerDigitacao("0", ZERO_A_CINCO).estado).toBe("completa");
  });

  it("fora da escala é recusado", () => {
    expect(lerDigitacao("7", ZERO_A_CINCO).estado).toBe("recusada");
    expect(lerDigitacao("05", ZERO_A_CINCO).estado).toBe("recusada");
    expect(lerDigitacao("a", ZERO_A_CINCO).estado).toBe("recusada");
    expect(lerDigitacao("-1", ZERO_A_CINCO).estado).toBe("recusada");
  });

  it("vazio apaga", () => {
    expect(lerDigitacao("", ZERO_A_CINCO)).toEqual({
      estado: "vazia",
      texto: "",
    });
    expect(lerDigitacao("  ", ZERO_A_CINCO).estado).toBe("vazia");
  });

  it("o que ainda pode virar outra nota espera (0 a 10, meias notas)", () => {
    const zeroADez = Array.from({ length: 11 }, (_, i) => i);
    expect(lerDigitacao("1", zeroADez).estado).toBe("parcial");
    expect(lerDigitacao("10", zeroADez).estado).toBe("completa");
    expect(lerDigitacao("2", zeroADez).estado).toBe("completa");
    const meias = [0, 0.5, 1, 1.5, 2, 2.5, 3];
    expect(lerDigitacao("2", meias).estado).toBe("parcial");
    expect(lerDigitacao("2,", meias).estado).toBe("parcial");
    expect(lerDigitacao("2.5", meias)).toEqual({
      estado: "completa",
      texto: "2,5",
    });
    expect(lerDigitacao("3", meias).estado).toBe("completa");
    expect(lerDigitacao("2,7", meias).estado).toBe("recusada");
  });

  it("sem as notas da escala, aceita número e nunca avança sozinha", () => {
    expect(lerDigitacao("12", []).estado).toBe("parcial");
    expect(lerDigitacao("x", []).estado).toBe("recusada");
  });
});

describe("textoDaEscala", () => {
  it("inteiras seguidas viram faixa; poucas soltas, a lista", () => {
    expect(textoDaEscala(ZERO_A_CINCO)).toBe("0 a 5");
    expect(textoDaEscala([0, 2.5, 5])).toBe("0; 2,5; 5");
    expect(textoDaEscala([])).toBe("");
  });
});

describe("movimento na grade", () => {
  it("teclas → movimentos", () => {
    expect(movimentoDaTecla("ArrowRight")).toBe("direita");
    expect(movimentoDaTecla("ArrowUp")).toBe("cima");
    expect(movimentoDaTecla("Enter")).toBe("proxima");
    expect(movimentoDaTecla("Enter", true)).toBe("anterior");
    expect(movimentoDaTecla("a")).toBeNull();
  });

  it("próxima segue a leitura e passa à linha de baixo; fora da grade, null", () => {
    expect(moverNaGrade({ linha: 0, coluna: 2 }, "proxima", 4, 3)).toEqual({
      linha: 1,
      coluna: 0,
    });
    expect(moverNaGrade({ linha: 3, coluna: 2 }, "proxima", 4, 3)).toBeNull();
    expect(moverNaGrade({ linha: 1, coluna: 0 }, "anterior", 4, 3)).toEqual({
      linha: 0,
      coluna: 2,
    });
    expect(moverNaGrade({ linha: 0, coluna: 0 }, "anterior", 4, 3)).toBeNull();
  });

  it("as setas param na borda", () => {
    expect(moverNaGrade({ linha: 0, coluna: 2 }, "direita", 4, 3)).toBeNull();
    expect(moverNaGrade({ linha: 0, coluna: 1 }, "baixo", 4, 3)).toEqual({
      linha: 1,
      coluna: 1,
    });
    expect(moverNaGrade({ linha: 0, coluna: 1 }, "cima", 4, 3)).toBeNull();
    expect(moverNaGrade({ linha: 2, coluna: 1 }, "esquerda", 4, 3)).toEqual({
      linha: 2,
      coluna: 0,
    });
  });
});
