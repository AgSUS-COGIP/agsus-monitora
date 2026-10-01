import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
/* O maior z-index entre os blocos do seletor (o mesmo seletor aparece em @media). */
const zDoBloco = (css, seletor) => {
  let maior = Number.NaN;
  let inicio = css.indexOf(`${seletor} {`);
  while (inicio !== -1) {
    const bloco = css.slice(inicio, css.indexOf("}", inicio));
    const z = Number(/z-index:\s*(\d+)/.exec(bloco)?.[1]);
    if (z && !(z <= maior)) maior = z;
    inicio = css.indexOf(`${seletor} {`, inicio + 1);
  }
  return maior;
};

describe("o aviso de parabéns fica visível", () => {
  // Em 01/10/2026 o aviso (z-index 10001) ficava atrás do cabeçalho (10030).
  const comemoracao = ler("src/styles/comemoracao.css");
  const zDoAviso = zDoBloco(comemoracao, ".comemoracao");

  it("acima do cabeçalho, da barra lateral e de Pessoas online", () => {
    const cabecalho = zDoBloco(
      ler("src/styles/system-ui-fixes.css"),
      ".app .top",
    );
    const pessoasOnline = zDoBloco(
      ler("src/styles/system-ui-fixes.css"),
      ".app .online-presence-popover",
    );
    expect(cabecalho).toBeGreaterThan(0);
    expect(zDoAviso).toBeGreaterThan(cabecalho);
    expect(zDoAviso).toBeGreaterThan(10036);
    expect(zDoAviso).toBeGreaterThan(pessoasOnline);
  });

  it("o confete fica logo abaixo do aviso", () => {
    const confete = Number(
      /position: fixed;\s*inset: 0;\s*z-index:\s*(\d+)/.exec(comemoracao)?.[1],
    );
    expect(confete).toBeLessThan(zDoAviso);
    expect(confete).toBeGreaterThan(10036);
  });
});
