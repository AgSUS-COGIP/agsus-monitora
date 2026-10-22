import { describe, expect, it } from "vitest";
import {
  desempateRegistrado,
  listaRegistrada,
} from "../../src/lib/classificacao/dados-do-estado.ts";

describe("Metadados das listas e desempates", () => {
  it("mantém o histórico, a versão e as pendências usados nos botões da lista", () => {
    expect(
      listaRegistrada({
        id: "l1",
        tipo: "FINAL",
        publicada: false,
        pendencias: 2,
        gerada_em: "2026-10-13T12:00:00Z",
        por: "Gestora",
        versao_regra: 3,
        hash: "abc",
        detalhe: "preservado",
      }),
    ).toMatchObject({
      id: "l1",
      publicada: false,
      pendencias: 2,
      versao_regra: 3,
      por: "Gestora",
      detalhe: "preservado",
    });
  });
  it.each(["2", -1, 1.5, NaN])(
    "uma contagem inválida não libera a publicação (%j)",
    (pendencias) => {
      expect(() => listaRegistrada({ id: "l1", pendencias })).toThrow(
        "pendências",
      );
    },
  );
  it("não trata a string false como o estado de publicação", () => {
    expect(() => listaRegistrada({ id: "l1", publicada: "false" })).toThrow(
      "Situação de publicação",
    );
  });
  it("preserva a ordem completa e os dados para conferência do sorteio", () => {
    expect(
      desempateRegistrado({
        chave: "FINAL|v1|a1,a2",
        metodo: "SORTEIO",
        ordem: ["a2", "a1"],
        semente: "abcd",
        origem_semente: "SERVIDOR",
      }),
    ).toMatchObject({
      ordem: ["a2", "a1"],
      semente: "abcd",
      origem_semente: "SERVIDOR",
    });
  });
  it.each([undefined, [], ["a1", null], ["a1", "a1"], ["a1", ""]])(
    "não retira entradas inválidas para aceitar uma ordem parcial (%j)",
    (ordem) => {
      expect(() =>
        desempateRegistrado({
          chave: "k1",
          metodo: "SORTEIO",
          semente: "abcd",
          ordem,
        }),
      ).toThrow();
    },
  );
  it("não confirma sorteio sem semente; decisão manual preserva a justificativa", () => {
    expect(() =>
      desempateRegistrado({
        chave: "k1",
        metodo: "SORTEIO",
        ordem: ["a1", "a2"],
      }),
    ).toThrow("incompleto");
    expect(
      desempateRegistrado({
        chave: "k1",
        metodo: "MANUAL",
        ordem: ["a2", "a1"],
        justificativa: "Decisão documentada",
      }),
    ).toMatchObject({
      metodo: "MANUAL",
      justificativa: "Decisão documentada",
      ordem: ["a2", "a1"],
    });
  });
});
