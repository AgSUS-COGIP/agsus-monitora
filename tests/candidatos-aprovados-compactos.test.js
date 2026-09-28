import { describe, expect, it } from "vitest";
import { expandirCandidatosCompactos } from "../src/lib/candidatos-aprovados-compactos.js";

describe("lista de aprovados numa chamada só", () => {
  it("volta ao formato de sempre, com os dados da lista em cada candidato", () => {
    const pacote = {
      colunas_da_lista: ["edital_id", "edital", "unidade", "lista_ativa"],
      listas: { L1: ["7", "53/2025", "CASAI São Paulo", true] },
      colunas: ["candidato_id", "lista_id", "nome", "sub_judice"],
      linhas: [
        ["a", "L1", "Ana", false],
        ["b", "L1", "Bruno", true],
      ],
    };
    expect(expandirCandidatosCompactos(pacote)).toEqual([
      {
        candidato_id: "a",
        lista_id: "L1",
        nome: "Ana",
        sub_judice: false,
        edital_id: "7",
        edital: "53/2025",
        unidade: "CASAI São Paulo",
        lista_ativa: true,
      },
      {
        candidato_id: "b",
        lista_id: "L1",
        nome: "Bruno",
        sub_judice: true,
        edital_id: "7",
        edital: "53/2025",
        unidade: "CASAI São Paulo",
        lista_ativa: true,
      },
    ]);
  });

  it("pacote vazio ou quebrado vira lista vazia", () => {
    expect(expandirCandidatosCompactos(null)).toEqual([]);
    expect(expandirCandidatosCompactos({ linhas: "x" })).toEqual([]);
  });

  it("lista ausente deixa os campos da lista nulos", () => {
    const [c] = expandirCandidatosCompactos({
      colunas_da_lista: ["edital"],
      listas: {},
      colunas: ["candidato_id", "lista_id"],
      linhas: [["a", "L9"]],
    });
    expect(c.edital).toBeNull();
  });
});
