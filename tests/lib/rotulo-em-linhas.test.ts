import { describe, expect, it } from "vitest";
import { rotuloEmLinhas } from "../../src/lib/selecao/rotulo-em-linhas.ts";

describe("rotuloEmLinhas", () => {
  it("quebra entre palavras até a largura", () => {
    expect(rotuloEmLinhas("Questionário não finalizado", 14)).toEqual([
      "Questionário",
      "não finalizado",
    ]);
  });

  it("rótulo curto fica numa linha", () => {
    expect(rotuloEmLinhas("Cancelados")).toEqual(["Cancelados"]);
  });

  it("corta com reticências além do número de linhas", () => {
    expect(
      rotuloEmLinhas("Saúde da Família e Comunidade (Mais Médicos)", 10, 2),
    ).toEqual(["Saúde da", "Família e…"]);
  });

  it("palavra maior que a largura fica inteira", () => {
    expect(rotuloEmLinhas("Interdisciplinaridade", 8)).toEqual([
      "Interdisciplinaridade",
    ]);
  });

  it("vazio ou nulo vira lista vazia", () => {
    expect(rotuloEmLinhas("")).toEqual([]);
    expect(rotuloEmLinhas(null)).toEqual([]);
  });
});
