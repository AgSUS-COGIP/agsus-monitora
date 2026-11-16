import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolver } from "./apoio/tokens-de-camada.ts";

const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
/* As camadas (`--z-*`) moram em app.css; `var(--z-…)` e `calc(var(--z-…) ± n)` viram número. */
const app = ler("src/styles/app.css");
const numero = (valor) => {
  if (!valor) return Number.NaN;
  try {
    return resolver(valor);
  } catch {
    return Number.NaN;
  }
};
/* O maior z-index entre os blocos do seletor (o mesmo seletor aparece em @media). */
const zDoBloco = (css, seletor) => {
  let maior = Number.NaN;
  let inicio = css.indexOf(`${seletor} {`);
  while (inicio !== -1) {
    const bloco = css.slice(inicio, css.indexOf("}", inicio));
    const z = numero(/z-index:\s*([^;]+);/.exec(bloco)?.[1]?.trim());
    if (z && !(z <= maior)) maior = z;
    inicio = css.indexOf(`${seletor} {`, inicio + 1);
  }
  return maior;
};

describe("o aviso de parabéns fica visível", () => {
  // Em 01/10/2026 o aviso (z-index 10001) ficava atrás do cabeçalho (10030).
  const comemoracao = ler("src/styles/comemoracao.css");
  const zDoAviso = zDoBloco(comemoracao, ".comemoracao");

  it("acima do cabeçalho, da barra lateral e do menu da conta (com Pessoas online)", () => {
    // O cabeçalho: --z-header em app.css; no celular, 10030 (mobile-app.css).
    const cabecalho = Math.max(
      zDoBloco(app, ".top"),
      zDoBloco(ler("src/styles/mobile-app.css"), "  .app .top"),
    );
    // Pessoas online fica dentro do menu da conta desde 13/11/2026.
    const pessoasOnline = zDoBloco(
      ler("src/styles/platform-shell.css"),
      ".top-user-popover",
    );
    expect(cabecalho).toBeGreaterThan(0);
    expect(pessoasOnline).toBeGreaterThan(0);
    expect(zDoAviso).toBeGreaterThan(cabecalho);
    expect(zDoAviso).toBeGreaterThan(10036);
    expect(zDoAviso).toBeGreaterThan(pessoasOnline);
  });

  it("os fogos ficam logo abaixo do aviso", () => {
    const fogos = numero(
      /position: fixed;\s*inset: 0;\s*z-index:\s*([^;]+);/
        .exec(comemoracao)?.[1]
        ?.trim(),
    );
    expect(fogos).toBeLessThan(zDoAviso);
    expect(fogos).toBeGreaterThan(10036);
  });
});
