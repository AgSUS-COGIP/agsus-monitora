import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const tokens = ler("src/styles/tokens.css");

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

/*
  A paleta validada com a skill `dataviz` (luminosidade, croma, daltonismo e
  contraste ≥ 3:1 sobre #ffffff e #0e1e2e): azul, laranja, ciano, violeta,
  magenta e oliva, em ordem fixa. Trocar uma cor pede validar de novo.
*/
const VALIDADA = {
  claro: {
    1: "#0f5db7",
    2: "#eb6834",
    3: "#0090bc",
    4: "#6d5efc",
    5: "#d55181",
    6: "#8a6d00",
  },
  escuro: {
    1: "#4f8ff0",
    2: "#d95f2b",
    3: "#1a9fc8",
    4: "#8e6cf2",
    5: "#d55181",
    6: "#a8861a",
  },
};

describe("cores das séries (gráficos e mapas)", () => {
  // Em 01/10/2026 o tema claro tinha três azuis e um cinza: os projetos do
  // mapa de Projetos ficavam com cores quase iguais.
  const claro = seriesDoBloco(":root");
  const escuro = seriesDoBloco('html[data-theme="dark"]');

  it("tema claro = paleta validada", () => {
    expect(claro).toEqual(VALIDADA.claro);
  });

  it("tema escuro = paleta validada (inclusive a 5)", () => {
    expect(escuro).toEqual(VALIDADA.escuro);
  });

  it("seis cores diferentes em cada tema", () => {
    expect(new Set(Object.values(claro)).size).toBe(6);
    expect(new Set(Object.values(escuro)).size).toBe(6);
  });
});
