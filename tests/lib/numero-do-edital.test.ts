import { describe, expect, it } from "vitest";
import { numeroDoEdital } from "../../src/lib/numero-do-edital.ts";

describe("número do edital", () => {
  it("o primeiro N/AAAA, sem zeros à esquerda (como FC_NUMERO_EDITAL)", () => {
    expect(numeroDoEdital("Edital 091/2026")).toBe("91/2026");
    expect(numeroDoEdital("Edital nº 091/2026 - Projetos")).toBe("91/2026");
    expect(numeroDoEdital("Edital 06/2026 (sanitarista)")).toBe("6/2026");
    expect(numeroDoEdital("114 / 2026")).toBe("114/2026");
  });

  it("sem número, vazio", () => {
    expect(numeroDoEdital("sem número")).toBe("");
    expect(numeroDoEdital(null)).toBe("");
    expect(numeroDoEdital(undefined)).toBe("");
    expect(numeroDoEdital({ edital: "93/2026" })).toBe("");
  });
});
