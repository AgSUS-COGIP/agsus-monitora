import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  A legenda flutuante sobe do canto de baixo do mapa. A do Mapa DSEIs nasce
  aberta e é a mais alta ("Colorir por", seis faixas, "Sedes e CASAIs"): numa
  moldura baixa (celular, janela baixa) ela subia por cima do "+ −" e do
  seletor Mapa | Satélite | Mapa DSEIs. A altura passa a ter teto — a
  moldura menos os controles do canto de cima — e o corpo rola por dentro.
*/
const css = readFileSync(
  "src/modulos/mapa-saude-indigena/mapa-saude-indigena.css",
  "utf8",
);

const regra = (seletor) => {
  const inicio = css.indexOf(`${seletor} {`);
  expect(inicio, `regra ${seletor}`).toBeGreaterThan(-1);
  return css.slice(inicio, css.indexOf("}", inicio));
};

describe("a legenda flutuante não tapa os controles do mapa", () => {
  it("tem teto de altura abaixo dos controles do canto de cima", () => {
    const legenda = regra(".mapa-si-legenda--flutuante");
    expect(legenda).toContain("bottom: var(--space-3)");
    expect(legenda).toMatch(
      /max-height:\s*calc\(100% - var\(--mapa-si-cantos-de-cima\)\)/,
    );
    expect(legenda).toContain("grid-template-rows: auto minmax(0, 1fr)");
  });

  it("o corpo rola por dentro; o botão 'Legenda' fica à vista", () => {
    const corpo = regra(".mapa-si-legenda--flutuante .mapa-si-legenda__corpo");
    expect(corpo).toContain("overflow-y: auto");
    expect(corpo).toContain("min-height: 0");
  });
});
