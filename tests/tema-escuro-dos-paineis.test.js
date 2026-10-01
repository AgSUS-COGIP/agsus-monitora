import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/analises/analises-painel.css", "utf8").replace(
  /\r\n/g,
  "\n",
);

/** Os seletores do bloco que contém `seletor` (do início da lista até a chave). */
function listaDoBloco(seletor) {
  const i = css.indexOf(seletor);
  const inicio = css.lastIndexOf("}", i) + 1;
  const fim = css.indexOf("{", i);
  return css
    .slice(inicio, fim)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

describe("tema escuro dos painéis", () => {
  // Em 01/10/2026 uma regra nova entrou no meio da lista e .panel/.kpi
  // perderam o fundo escuro (o bloco virou o de .status-discreto).
  it("painéis e KPIs ficam no bloco do fundo escuro, não em outra regra", () => {
    const lista = listaDoBloco('html[data-theme="dark"] .panel');
    expect(lista).toContain('html[data-theme="dark"] .kpi');
    expect(lista).toContain('html[data-theme="dark"] .table-card');
    expect(lista).not.toContain(".status-discreto");
  });

  it("o status discreto é uma regra própria, no design system", () => {
    expect(css).not.toContain(".status-discreto");
    const ui = readFileSync("src/ui/ui.css", "utf8");
    expect(ui).toMatch(/(^|\}|\n)\s*\.status-discreto\s*\{/);
  });
});
