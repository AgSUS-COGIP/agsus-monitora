import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Clicar numa terra indígena mostrava um retângulo em volta dela: o anel de
  foco que o Chrome desenha num <path> SVG é a caixa da forma, não o limite.
  O destaque passa a ser o traço da própria terra, ao passar o mouse.
*/
const css = readFileSync("src/styles/indigenous-territories-layer.css", "utf8");
const js = readFileSync("src/modules/indigenous-territories-layer.js", "utf8");

describe("destaque da terra indígena no mapa", () => {
  it("as formas do Leaflet não ganham o anel de foco retangular", () => {
    expect(css).toMatch(
      /\.leaflet-container path\.leaflet-interactive:focus\s*\{\s*outline:\s*none;/,
    );
  });

  it("cada terra engrossa o próprio traço ao passar o mouse e volta ao sair", () => {
    const aoCriar = js.slice(js.indexOf("onEachFeature: (feature, layer) =>"));
    expect(aoCriar.slice(0, 200)).toContain("destacarAoPassar(feature, layer)");
    const funcao = js.slice(js.indexOf("function destacarAoPassar"));
    expect(funcao).toContain('layer.on("mouseover"');
    expect(funcao).toContain("weight: base.weight + 2");
    expect(funcao).toContain(
      'layer.on("mouseout", () => layer.setStyle(estiloComDestaque(feature)))',
    );
  });
});
