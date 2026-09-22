import { describe, expect, it } from "vitest";
import { numerosSemLastro } from "../api/aya.js";

describe("números sem lastro na resposta", () => {
  /*
    O caso real: perguntado sobre o DSEI Alagoas, com os fatos corretos no
    prompt, o modelo acertou a sede e emendou uma área inventada.
  */
  it("pega o número inventado que motivou a checagem", () => {
    const material =
      "O DSEI Alagoas e Sergipe tem sede em Maceió e atende 30 aldeias, com 13.480 pessoas.";
    const resposta =
      "O DSEI Alagoas tem sede em Maceió e abrange área de aproximadamente 1.200 km².";
    expect(numerosSemLastro(resposta, material)).toEqual(["1.200"]);
  });

  it("aceita número que veio do material", () => {
    const material = "Atende 30 aldeias e registra 13.480 pessoas em 2023.";
    const resposta = "São 30 aldeias e 13.480 pessoas, com base de 2023.";
    expect(numerosSemLastro(resposta, material)).toEqual([]);
  });

  it("ignora pontuação ao comparar", () => {
    expect(
      numerosSemLastro("são 13480 pessoas", "registra 13.480 pessoas"),
    ).toEqual([]);
    expect(
      numerosSemLastro("são 13.480 pessoas", "registra 13480 pessoas"),
    ).toEqual([]);
  });

  it("deixa passar dígito solto, que costuma ser contagem do próprio texto", () => {
    expect(
      numerosSemLastro("são 3 conselhos", "CLSI, CONDISI e FPCONDISI"),
    ).toEqual([]);
  });

  it("aceita número contido em outro maior do material", () => {
    expect(numerosSemLastro("o plano de 2024", "PDSI 2024-2027")).toEqual([]);
  });

  it("aguenta resposta sem número e material vazio", () => {
    expect(numerosSemLastro("sem números aqui", "")).toEqual([]);
    expect(numerosSemLastro("", "qualquer coisa")).toEqual([]);
  });
});
