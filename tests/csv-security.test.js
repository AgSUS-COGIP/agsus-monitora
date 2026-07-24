import { describe, expect, it } from "vitest";
import { sanitizeCsvCell, sanitizeCsvDocument } from "../src/lib/csv-security.js";

describe("csv-security", () => {
  it("neutraliza os prefixos interpretados como fórmula por planilhas", () => {
    expect(sanitizeCsvCell("=HYPERLINK(\"https://example.com\")")).toBe("'=HYPERLINK(\"https://example.com\")");
    expect(sanitizeCsvCell("+CMD")).toBe("'+CMD");
    expect(sanitizeCsvCell("-1+1")).toBe("'-1+1");
    expect(sanitizeCsvCell("@SUM(A1:A2)")).toBe("'@SUM(A1:A2)");
    expect(sanitizeCsvCell("  =1+1")).toBe("'  =1+1");
  });

  it("preserva textos e números comuns", () => {
    expect(sanitizeCsvCell("Candidato A")).toBe("Candidato A");
    expect(sanitizeCsvCell("12345")).toBe("12345");
    expect(sanitizeCsvCell(0)).toBe("0");
  });

  it("protege todas as células de um documento separado por ponto e vírgula", () => {
    const csv = "nome;analise\nMaria;=HYPERLINK(\"https://example.com\")\nJoão;Regular";
    expect(sanitizeCsvDocument(csv)).toBe(
      "nome;analise\nMaria;'=HYPERLINK(\"https://example.com\")\nJoão;Regular"
    );
  });
});
