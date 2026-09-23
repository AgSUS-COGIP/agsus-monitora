import { describe, expect, it } from "vitest";
import { modalidadesDaConcorrencia } from "../src/lib/modalidades-de-concorrencia.js";

describe("modalidadesDaConcorrencia", () => {
  it("mantém uma modalidade canônica", () => {
    expect(modalidadesDaConcorrencia("Ampla concorrência")).toEqual([
      "Ampla concorrência",
    ]);
  });

  it("separa combinações antigas com aspas", () => {
    expect(
      modalidadesDaConcorrencia('Ampla concorrência", "Indígenas'),
    ).toEqual(["Ampla concorrência", "Indígenas"]);
  });

  it("separa combinações canônicas do banco", () => {
    expect(
      modalidadesDaConcorrencia(
        "Pretos e pardos | Pessoas com deficiência (PCD)",
      ),
    ).toEqual(["Pretos e pardos", "Pessoas com deficiência (PCD)"]);
  });

  it("padroniza quilombola no singular", () => {
    expect(modalidadesDaConcorrencia("Quilombola")).toEqual(["Quilombolas"]);
  });

  it("preserva valor novo que ainda não possui regra", () => {
    expect(modalidadesDaConcorrencia('"Outra modalidade"')).toEqual([
      "Outra modalidade",
    ]);
  });

  it("retorna lista vazia para valor ausente", () => {
    expect(modalidadesDaConcorrencia(null)).toEqual([]);
  });
});
