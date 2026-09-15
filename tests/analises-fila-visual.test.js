import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/analises/analises-infinite-table.css", "utf8");
const app = readFileSync("src/analises/analises-app.js", "utf8");

describe("fila operacional de Analises", () => {
  it("oculta o subtitulo redundante da coluna Vaga", () => {
    expect(css).toContain(
      ".table-wrap tbody tr:not(.detail-row) > td:nth-child(5) .secondary-text",
    );
    expect(css).toContain("display: none !important");
  });

  it("preserva categoria para filtros e dados internos", () => {
    expect(app).toContain('{ id:"fCategoria"');
    expect(app).toContain("row.categoria");
  });
});
