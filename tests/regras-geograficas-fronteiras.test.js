import { describe, expect, it } from "vitest";
import { registrosDoDsei } from "../src/lib/mapa-saude-indigena/mapa-do-dsei.ts";
import {
  bolhasDosDsei,
  territoriosPorVagas,
} from "../src/lib/mapa-saude-indigena/mapa-nacional.ts";

describe("fronteiras das regras geográficas", () => {
  it("absorve o CNES numérico sem duplicar o polo nem substituir sua posição", () => {
    const dsei = {
      k: "CEARA",
      n: "Ceará",
      sedeuf: "CE",
      polos: [{ n: "FORTALEZA", cnes: "123", lat: -3.7, lon: -38.5 }],
    };
    const rede = {
      rede: {
        CEARA: {
          u: [["POLO BASE FORTALEZA", 123, -3.71, -38.51, "Fortaleza", 23]],
          c: [],
        },
      },
      nac: [],
    };
    const registros = registrosDoDsei(dsei, rede);
    expect(registros).toHaveLength(1);
    expect(registros[0]).toMatchObject({
      cnes: 123,
      lat: -3.7,
      lon: -38.5,
      origens: ["lmap", "rede_cnes"],
    });
  });

  it("ordena territórios sem modificar a lista congelada de bolhas", () => {
    const dseis = Object.freeze([
      { k: "MAIOR", n: "Maior", lat: 1, lon: 2, pop: 1000 },
      { k: "MENOR", n: "Menor", lat: 3, lon: 4, pop: 100 },
    ]);
    const contagens = new Map([
      ["MAIOR", { editais: 1, vagas: 2, ociosas: 0 }],
      ["MENOR", { editais: 1, vagas: 10, ociosas: 10 }],
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
