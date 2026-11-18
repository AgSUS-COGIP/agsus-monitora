import { describe, expect, it } from "vitest";
import {
  bolhasDosDsei,
  territoriosPorVagas,
} from "../src/lib/mapas/mapa-saude-indigena/mapa-nacional.ts";

describe("fronteiras das regras geográficas", () => {
  it("ordena territórios sem modificar a lista congelada de bolhas", () => {
    const dseis = Object.freeze([
      { k: "MAIOR", n: "Maior", lat: 1, lon: 2, pop: 1000 },
      { k: "MENOR", n: "Menor", lat: 3, lon: 4, pop: 100 },
    ]);
    const contagens = new Map([
      ["MAIOR", { editais: 1, vagas: 2, contratadas: 2, ociosas: 0 }],
      ["MENOR", { editais: 1, vagas: 10, contratadas: 0, ociosas: 10 }],
    ]);
    const bolhas = Object.freeze(bolhasDosDsei({ dseis, contagens }));
    expect(territoriosPorVagas(bolhas).map((b) => b.chave)).toEqual([
      "MENOR",
      "MAIOR",
    ]);
    expect(bolhas.map((b) => b.chave)).toEqual(["MAIOR", "MENOR"]);
    expect(bolhas.every((b) => !("posicao" in b))).toBe(true);
  });
});
