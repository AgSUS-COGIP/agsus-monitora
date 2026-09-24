import { describe, expect, it } from "vitest";
import {
  anoDaSelecao,
  anoDoEdital,
  anosDosEditais,
  editaisDoAno,
} from "../src/lib/atalhos-de-filtro.js";

const editais = ["11/2025", "81/2026", "105/2026", "FGV", "05/2026"];

describe("atalho de ano", () => {
  it("lê o ano do número do edital", () => {
    expect(anoDoEdital("81/2026")).toBe(2026);
    expect(anoDoEdital("Edital 3/2025 - DSEI X")).toBe(2025);
    expect(anoDoEdital("FGV")).toBeNull();
  });

  it("lista os anos dos próprios dados, do mais recente ao mais antigo", () => {
    expect(anosDosEditais(editais)).toEqual([2026, 2025]);
  });

  it("seleciona os editais do ano e reconhece a seleção", () => {
    const de2026 = editaisDoAno(editais, 2026);
    expect(de2026).toEqual(["81/2026", "105/2026", "05/2026"]);
    expect(anoDaSelecao(de2026, editais)).toBe("2026");
    expect(anoDaSelecao([], editais)).toBe("");
    expect(anoDaSelecao(["81/2026"], editais)).toBe("personalizado");
  });
});
