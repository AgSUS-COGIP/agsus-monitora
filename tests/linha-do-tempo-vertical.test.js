import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/modulos/cronograma/cronograma.css", "utf8").replace(
  /\r\n/g,
  "\n",
);
const bloco = (seletor) => {
  const inicio = css.indexOf(`${seletor} {`);
  return css.slice(inicio, css.indexOf("}", inicio));
};

describe("linha do tempo do edital (Cronograma)", () => {
  // Em 01/10/2026, na horizontal, a última etapa ficava cortada na borda do
  // cartão e os nomes longos quebravam em até 6 linhas.
  it("é vertical e rola dentro do cartão, sem faixa horizontal", () => {
    const lista = bloco(".cal-timeline");
    expect(lista).toContain("flex-direction: column");
    expect(lista).toContain("overflow-y: auto");
    expect(lista).not.toContain("overflow-x");
    expect(bloco(".cal-passo")).not.toMatch(/flex:\s*1 0/);
  });

  it("o ponto usa tokens (legível no tema escuro)", () => {
    expect(bloco(".cal-passo-marca")).not.toContain("#fff");
    expect(
      bloco('.cal-passo[data-situacao="futura"] .cal-passo-marca'),
    ).not.toContain("#cbd5e1");
  });
});
