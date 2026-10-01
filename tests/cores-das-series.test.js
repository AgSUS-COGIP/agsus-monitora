import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const tokens = ler("src/styles/tokens.css");
const design = ler("DESIGN.md");

/* Os --series-N de um bloco do tokens.css (do seletor até a chave que fecha). */
function seriesDoBloco(seletor) {
  const inicio = tokens.indexOf(`${seletor} {`);
  const bloco = tokens.slice(inicio, tokens.indexOf("\n}", inicio));
  return Object.fromEntries(
    [...bloco.matchAll(/--series-(\d+):\s*(#[0-9a-f]{6})/gi)].map(
      ([, n, cor]) => [Number(n), cor.toLowerCase()],
    ),
  );
}

/* A tabela "Série | Claro | Escuro" da seção 6 do DESIGN.md. */
function seriesDoDesign() {
  const linhas = [
    ...design.matchAll(
      /^\| (\d) [^|]+\| `(#[0-9a-f]{6})` \| `(#[0-9a-f]{6})` \|$/gim,
    ),
  ];
  return {
    claro: Object.fromEntries(
      linhas.map(([, n, c]) => [Number(n), c.toLowerCase()]),
    ),
    escuro: Object.fromEntries(
      linhas.map(([, n, , e]) => [Number(n), e.toLowerCase()]),
    ),
  };
}

describe("cores das séries (gráficos e mapas)", () => {
  // Em 01/10/2026 o tema claro tinha três azuis e um cinza: os projetos do
  // mapa de Projetos ficavam com cores quase iguais.
  const { claro, escuro } = seriesDoDesign();

  it("o DESIGN.md define as seis", () => {
    expect(Object.keys(claro)).toHaveLength(6);
  });

  it("tema claro = DESIGN.md", () => {
    expect(seriesDoBloco(":root")).toEqual(claro);
  });

  it("tema escuro = DESIGN.md (inclusive a 5)", () => {
    expect(seriesDoBloco('html[data-theme="dark"]')).toEqual(escuro);
  });

  it("seis cores diferentes em cada tema", () => {
    expect(new Set(Object.values(claro)).size).toBe(6);
    expect(new Set(Object.values(escuro)).size).toBe(6);
  });
});
