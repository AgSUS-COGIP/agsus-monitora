import { describe, expect, it } from "vitest";
import {
  SEM_ORDEM,
  ordenarAprovados,
  proximaOrdemDosAprovados,
} from "../src/lib/ordem-dos-aprovados.ts";

/* A ordem da tabela da aba Aprovados, pelo cabeçalho. */

const linhas = [
  {
    candidato_id: "1",
    nome: "Érica",
    classificacao: 10,
    nota: "7,5",
    status: "Convocado",
  },
  { candidato_id: "2", nome: "ana", classificacao: 2, nota: 9, status: "" },
  {
    candidato_id: "3",
    nome: "Bruno",
    classificacao: null,
    nota: null,
    status: "Contratado",
  },
  {
    candidato_id: "4",
    nome: "Carla",
    classificacao: 1,
    nota: 8,
    status: "Contratado",
    contratacao_situacao: "OUTRA_LISTA",
  },
];
const ids = (lista) => lista.map((l) => l.candidato_id);

describe("ordenarAprovados", () => {
  it("sem ordem devolve a própria lista", () => {
    expect(ordenarAprovados(linhas, SEM_ORDEM)).toBe(linhas);
  });

  it("texto em pt-BR, sem caixa nem acento", () => {
    expect(
      ids(ordenarAprovados(linhas, { chave: "nome", sentido: "asc" })),
    ).toEqual(["2", "3", "4", "1"]);
    expect(
      ids(ordenarAprovados(linhas, { chave: "nome", sentido: "desc" })),
    ).toEqual(["1", "4", "3", "2"]);
  });

  it("número como número (10 depois de 2) e nota com vírgula; vazio no fim nos dois sentidos", () => {
    expect(
      ids(ordenarAprovados(linhas, { chave: "classificacao", sentido: "asc" })),
    ).toEqual(["4", "2", "1", "3"]);
    expect(
      ids(
        ordenarAprovados(linhas, { chave: "classificacao", sentido: "desc" }),
      ),
    ).toEqual(["1", "2", "4", "3"]);
    expect(
      ids(ordenarAprovados(linhas, { chave: "nota", sentido: "asc" })),
    ).toEqual(["1", "4", "2", "3"]);
  });

  it("situação como o selo a mostra (espelho da outra lista tem rótulo próprio)", () => {
    expect(
      ids(ordenarAprovados(linhas, { chave: "situacao", sentido: "asc" })),
    ).toEqual(["3", "4", "1", "2"]);
  });

  it("não muda a lista recebida", () => {
    const copia = [...linhas];
    ordenarAprovados(linhas, { chave: "nome", sentido: "asc" });
    expect(linhas).toEqual(copia);
  });
});

describe("proximaOrdemDosAprovados", () => {
  it("asc → desc → sem ordem; outra coluna recomeça em asc", () => {
    const a = proximaOrdemDosAprovados(SEM_ORDEM, "nome");
    expect(a).toEqual({ chave: "nome", sentido: "asc" });
    const b = proximaOrdemDosAprovados(a, "nome");
    expect(b).toEqual({ chave: "nome", sentido: "desc" });
    expect(proximaOrdemDosAprovados(b, "nome")).toEqual(SEM_ORDEM);
    expect(proximaOrdemDosAprovados(b, "nota")).toEqual({
      chave: "nota",
      sentido: "asc",
    });
  });
});
