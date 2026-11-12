import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
  A PALETA DO RIO (a arte da tela de acesso), de apoio às cores do manual.

  Floresta, folha, rio, terracota e ocre pintam texto e ícone: nos selos, no
  tile dos indicadores e no título da área. Cada uma, sobre o próprio
  `-suave` e sobre o card, passa de 4,5:1 nos dois temas (regra de ouro 6,
  docs/biblioteca/design-e-tokens.md). O cálculo é sobre os valores de
  `tokens.css`, não sobre uma cópia: mudar um hex lá refaz a conta aqui.
*/

const RAIZ = path.resolve(import.meta.dirname, "..");
const tokens = fs.readFileSync(
  path.join(RAIZ, "src/styles/tokens.css"),
  "utf8",
);
const ui = fs.readFileSync(path.join(RAIZ, "src/ui/ui.css"), "utf8");
const app = fs.readFileSync(path.join(RAIZ, "src/styles/app.css"), "utf8");

/* As declarações `--nome: valor;` de um bloco (o primeiro que abre com `inicio`). */
function bloco(inicio: string): Map<string, string> {
  const comeco = tokens.indexOf(inicio);
  expect(comeco, inicio).toBeGreaterThan(-1);
  const corpo = tokens.slice(comeco, tokens.indexOf("\n}", comeco));
  const pares = new Map<string, string>();
  for (const [, nome = "", valor = ""] of corpo.matchAll(
    /(--[\w-]+):\s*([^;]+);/g,
  ))
    pares.set(nome, valor.trim());
  return pares;
}

const claro = bloco(":root {");
const escuro = bloco('html[data-theme="dark"] {');

/* O hex de um token no tema, seguindo `var(--outro)` (no escuro, cai no claro). */
function hex(nome: string, tema: Map<string, string>): string {
  const valor = tema.get(nome) ?? claro.get(nome) ?? "";
  expect(valor, nome).not.toBe("");
  const apelido = /^var\((--[\w-]+)\)$/.exec(valor)?.[1];
  if (apelido) return hex(apelido, tema);
  expect(valor, nome).toMatch(/^#[0-9a-f]{6}$/i);
  return valor;
}

function luminancia(cor: string): number {
  const canal = (i: number) => {
    const c = Number.parseInt(cor.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5);
}

function contraste(a: string, b: string): number {
  const [la, lb] = [luminancia(a), luminancia(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const CORES = ["floresta", "folha", "rio", "terracota", "ocre"];

describe("paleta do rio: contraste", () => {
  for (const [nomeDoTema, tema, card] of [
    ["claro", claro, "#ffffff"],
    ["escuro", escuro, hex("--color-bg-canvas", escuro)],
  ] as const) {
    for (const cor of CORES) {
      it(`${cor} no tema ${nomeDoTema}: texto sobre o suave e sobre o card`, () => {
        const texto = hex(`--paleta-${cor}`, tema);
        expect(
          contraste(texto, hex(`--paleta-${cor}-suave`, tema)),
        ).toBeGreaterThanOrEqual(4.5);
        expect(contraste(texto, card)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it("os tons claros servem à barra lateral escura (a padrão do manual)", () => {
    const barra = hex("--color-blue-950", claro);
    for (const cor of ["floresta", "ocre", "terracota"]) {
      expect(
        contraste(hex(`--paleta-${cor}-claro`, claro), barra),
      ).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("paleta do rio: onde entra", () => {
  it("cada área tem a sua cor", () => {
    expect(tokens).toMatch(
      /html\[data-area="saude-indigena"\] \{\s*--cor-da-area: var\(--paleta-floresta\)/,
    );
    expect(tokens).toMatch(
      /html\[data-area="sede"\] \{\s*--cor-da-area: var\(--paleta-ocre\)/,
    );
    expect(tokens).toMatch(
      /html\[data-area="projetos"\] \{\s*--cor-da-area: var\(--paleta-terracota\)/,
    );
  });

  it("a bolinha do seletor de área usa os tons vivos da paleta", () => {
    const barra = fs.readFileSync(
      path.join(RAIZ, "src/styles/barra-lateral.css"),
      "utf8",
    );
    for (const [area, cor] of [
      ["saude-indigena", "floresta-claro"],
      ["sede", "ocre-vivo"],
      ["projetos", "terracota-claro"],
    ]) {
      expect(barra).toContain(
        `[data-cor-da-area="${area}"] {
  --cor-da-area: var(--paleta-${cor});`,
      );
    }
  });

  it("o título da página segue a área, com o padrão de antes fora dela", () => {
    expect(app).toContain("color: var(--cor-da-area, var(--text-primary));");
    expect(app).toContain(
      "color: var(--cor-da-area, var(--color-text-brand)) !important;",
    );
  });

  it("selos e indicadores usam a paleta, não o estado genérico", () => {
    for (const [tom, cor] of [
      ["sucesso", "folha"],
      ["perigo", "terracota"],
      ["alerta", "ocre"],
      ["info", "rio"],
    ]) {
      expect(ui).toContain(
        `.ui-selo[data-tom="${tom}"] {\n  background: var(--paleta-${cor}-suave);\n  color: var(--paleta-${cor});`,
      );
    }
    expect(ui).toContain(
      '.ui-kpi[data-tom="destaque"] {\n  --kpi-cor: var(--paleta-floresta);',
    );
    expect(ui).toContain("box-shadow: inset 0 3px 0 var(--kpi-cor);");
  });

  it("o ocre vivo é só preenchimento: nunca vira texto", () => {
    const usos = [ui, app].flatMap((css) =>
      [...css.matchAll(/^\s*color:[^;]*--paleta-ocre-vivo/gm)].map((m) => m[0]),
    );
    expect(usos).toEqual([]);
  });
});
