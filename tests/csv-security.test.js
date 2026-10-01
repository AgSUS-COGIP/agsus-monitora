import { describe, expect, it } from "vitest";
import {
  sanitizeCsvCell,
  sanitizeCsvDocument,
} from "../src/lib/csv-security.js";

describe("csv-security", () => {
  it("neutraliza os prefixos interpretados como fórmula por planilhas", () => {
    expect(sanitizeCsvCell('=HYPERLINK("https://example.com")')).toBe(
      '\'=HYPERLINK("https://example.com")',
    );
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
    const csv =
      'nome;analise\nMaria;=HYPERLINK("https://example.com")\nJoão;Regular';
    expect(sanitizeCsvDocument(csv)).toBe(
      'nome;analise\nMaria;\'=HYPERLINK("https://example.com")\nJoão;Regular',
    );
  });

  it("não parte células entre aspas que têm ; ou quebra de linha", () => {
    const csv = 'nome;obs\r\nMaria;"faltou;\n- reagendar; -5"\r\n';
    expect(sanitizeCsvDocument(csv)).toBe(csv);
  });

  it("protege a célula entre aspas que começa com fórmula", () => {
    // Exportação que põe toda célula entre aspas (ex.: exportCSV do legado).
    const csv = '"Edital";"Obs"\n"01/2026";"=HYPERLINK(""https://x"")"';
    expect(sanitizeCsvDocument(csv)).toBe(
      '"Edital";"Obs"\n"01/2026";"\'=HYPERLINK(""https://x"")"',
    );
  });

  it("não protege de novo a célula já protegida", () => {
    const csv = "a;\"'=1+1\";'-2";
    expect(sanitizeCsvDocument(csv)).toBe(csv);
  });
});
