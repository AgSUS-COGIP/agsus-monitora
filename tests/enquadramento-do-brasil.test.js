import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BRASIL_BOUNDS } from "../src/lib/brasil-bounds.js";
import {
  FOLGA_ALEM_DO_RAIO,
  FOLGA_DO_BRASIL,
  RAIO_MAXIMO_NO_MAPA,
  ZOOM_MINIMO_PARA_CABER,
  ZOOM_NACIONAL,
  projetar,
  sobraNaMoldura,
  zoomQueCabe,
} from "../src/lib/enquadramento-do-brasil.js";
import { RAIO_MAXIMO as RAIO_DA_BOLHA } from "../src/lib/mapa-render.js";
import { RAIO_MAXIMO as RAIO_DO_PONTO_DE_PROJETO } from "../src/lib/visao-geral-da-area.js";

/*
  O enquadramento do Brasil nos mapas da Visão geral (Saúde Indígena e
  Projetos). O print do usuário: num mapa de 640 px de altura o norte
  (Roraima, Amapá) saía cortado, com as bolhas da borda pela metade — o zoom
  estava preso em 4.5 e a folga era de 10 px.
*/

const NORTE_DE_RORAIMA = BRASIL_BOUNDS[1][0];

describe("a folga cobre o maior ponto do mapa", () => {
  it("raio da bolha + traço + 12 px; o ponto de Projetos não é maior que a bolha", () => {
    expect(RAIO_MAXIMO_NO_MAPA).toBeGreaterThanOrEqual(RAIO_DA_BOLHA);
    expect(RAIO_DO_PONTO_DE_PROJETO).toBeLessThanOrEqual(RAIO_DA_BOLHA);
    expect(FOLGA_DO_BRASIL).toBe(RAIO_MAXIMO_NO_MAPA + FOLGA_ALEM_DO_RAIO);
    expect(FOLGA_ALEM_DO_RAIO).toBe(12);
  });

  it("o ponto mais ao norte é Roraima (lat. 5.27)", () => {
    expect(NORTE_DE_RORAIMA).toBeCloseTo(5.27, 2);
  });

  it("projeta em Web Mercator como o Leaflet (azulejo de 256 px)", () => {
    expect(projetar([0, 0])).toEqual({ x: 128, y: 128 });
    const norte = projetar([NORTE_DE_RORAIMA, -60]);
    const sul = projetar([-33.75, -60]);
    expect(norte.y).toBeLessThan(128);
    expect(sul.y - norte.y).toBeCloseTo(29.27, 1);
  });
});

describe("o Brasil inteiro cabe na moldura", () => {
  it("o bug: a 4.5, num mapa de 640 px de altura, o norte sai cortado", () => {
    const sobra = sobraNaMoldura({ largura: 1100, altura: 640, zoom: 4.5 });
    expect(sobra.cima).toBeLessThan(0);
  });

  it("numa moldura baixa o zoom desce em quartos e Roraima fica a mais de um raio da borda", () => {
    for (const altura of [460, 520, 640, 700]) {
      const zoom = zoomQueCabe({ largura: 1100, altura });
      expect(zoom, `altura ${altura}`).toBeLessThan(ZOOM_NACIONAL);
      expect((zoom * 4) % 1, `altura ${altura}`).toBe(0);
      const sobra = sobraNaMoldura({ largura: 1100, altura, zoom });
      // O ponto mais ao norte fica com folga do raio da maior bolha.
      expect(sobra.cima, `altura ${altura}`).toBeGreaterThanOrEqual(
        RAIO_MAXIMO_NO_MAPA,
      );
      expect(sobra.baixo).toBeGreaterThanOrEqual(RAIO_MAXIMO_NO_MAPA);
      expect(sobra.esquerda).toBeGreaterThanOrEqual(RAIO_MAXIMO_NO_MAPA);
    }
  });

  it("a 640 px o zoom é 4.25, com a folga inteira em cima e embaixo", () => {
    const zoom = zoomQueCabe({ largura: 1100, altura: 640 });
    expect(zoom).toBe(4.25);
    expect(
      sobraNaMoldura({ largura: 1100, altura: 640, zoom }).cima,
    ).toBeGreaterThanOrEqual(FOLGA_DO_BRASIL);
  });

  it("moldura grande fica na escala nacional (4.5), sem passar dela", () => {
    expect(zoomQueCabe({ largura: 1600, altura: 900 })).toBe(ZOOM_NACIONAL);
    expect(
      sobraNaMoldura({ largura: 1600, altura: 900, zoom: ZOOM_NACIONAL }).cima,
    ).toBeGreaterThan(FOLGA_DO_BRASIL);
  });

  it("celular estreito: quem manda é a largura", () => {
    const zoom = zoomQueCabe({ largura: 360, altura: 400 });
    expect(zoom).toBeLessThan(3.5);
    expect(
      sobraNaMoldura({ largura: 360, altura: 400, zoom }).esquerda,
    ).toBeGreaterThanOrEqual(RAIO_MAXIMO_NO_MAPA);
  });

  it("moldura escondida (sem medida) devolve a escala nacional; nunca abaixo do mínimo", () => {
    expect(zoomQueCabe({ largura: 0, altura: 0 })).toBe(ZOOM_NACIONAL);
    expect(zoomQueCabe({ largura: 80, altura: 80 })).toBe(
      ZOOM_MINIMO_PARA_CABER,
    );
  });
});

describe("o map-guard usa a regra", () => {
  const guarda = readFileSync("src/modules/map-guard.js", "utf8");

  it("folga do Brasil e zoom mínimo que cabe em todo enquadramento do país", () => {
    expect(guarda).toContain("zoomQueCabe(");
    expect(guarda).toContain("FOLGA_DO_BRASIL");
    expect(guarda).not.toContain("padding: [10, 10]");
    const fit = guarda.slice(
      guarda.indexOf("const fitBrazilOverview"),
      guarda.indexOf('map.on("resize"'),
    );
    expect(fit).toContain("liberarZoomParaCaber(viewBounds, folgaDoBrasil)");
  });
});
