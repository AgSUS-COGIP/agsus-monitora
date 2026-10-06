import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  distribuirFichas,
  tetoDoAnalista,
} from "../../src/lib/avaliacao-documental/distribuicao.js";

/*
  Distribuição das fichas (fase F3). Os casos dourados rodam também no pytest
  (tests/python/test_distribuicao.py), contra
  python/monitora/avaliacao_documental/distribuicao.py.
*/
const CASOS = JSON.parse(
  readFileSync(
    "tests/fixtures/avaliacao-documental/casos-de-distribuicao.json",
    "utf8",
  ),
).casos;

describe("casos dourados da distribuição (mesmos do Python)", () => {
  it.each(CASOS.map((c) => [c.nome, c]))("%s", (_nome, caso) => {
    expect(distribuirFichas(caso.entrada)).toEqual(caso.esperado);
  });
});

describe("AM-6.2: distribuição inicial", () => {
  it("300 fichas para 3 analistas dá 100 para cada um", () => {
    const fichas = Array.from({ length: 300 }, (_, i) => ({
      id: `f${i}`,
      vaga: "10",
    }));
    const analistas = ["a", "b", "c"].map((usuario) => ({
      usuario,
      vagas: null,
      limite: null,
      pendentes: 0,
    }));
    const r = distribuirFichas({ fichas, analistas });
    expect(r.por_analista).toEqual({ a: 100, b: 100, c: 100 });
    expect(r.sobra).toEqual([]);
  });

  it("teto: o menor entre a equipe e a regra só no critério LIMITE", () => {
    expect(tetoDoAnalista({ limite: 5 }, "PARTES_IGUAIS", 2)).toBe(5);
    expect(tetoDoAnalista({ limite: 5 }, "LIMITE", 2)).toBe(2);
    expect(tetoDoAnalista({ limite: null }, "PARTES_IGUAIS", 2)).toBeNull();
    expect(tetoDoAnalista({}, "LIMITE", null)).toBeNull();
  });

  it("entrada vazia ou inválida não quebra", () => {
    expect(distribuirFichas()).toEqual({
      atribuicoes: [],
      sobra: [],
      por_analista: {},
    });
    expect(
      distribuirFichas({
        fichas: [{ id: "x", vaga: "1" }],
        analistas: [{ usuario: "a", pendentes: "muitas" }],
      }).atribuicoes,
    ).toEqual([{ ficha: "x", usuario: "a" }]);
  });
});
