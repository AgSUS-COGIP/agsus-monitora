import { describe, expect, it, beforeEach, vi } from "vitest";

/*
  A CAMADA DE TERRAS INDÍGENAS NUNCA CORREU EM PRODUÇÃO.

  `installTileLayerGuard` trocava `L.tileLayer` por um invólucro e não copiava
  o que estava pendurado na função original. `L.tileLayer.wms` desaparecia do
  namespace. Nada no guarda usa `.wms`, por isso o apagão era silencioso — sem
  erro, sem aviso no console.

  Quem usava era `installIndigenousTerritoriesLayer`, que verifica
  `L.tileLayer?.wms` antes de se instalar e devolvia false. O efeito visível
  era nenhum: sem polígono, sem rótulo, sem botão de camada. Três correções de
  aparência foram publicadas sobre código que não era executado.

  O teste é de comportamento, não de texto: monta um Leaflet mínimo, instala os
  guardas na ordem real da aplicação e verifica que a camada consegue instalar-se
  no fim. Um teste sobre o texto do ficheiro teria deixado passar.
*/

function leafletMinimo() {
  const tileLayer = vi.fn(() => ({ tipo: "tiles" }));
  tileLayer.wms = vi.fn(() => ({ tipo: "wms" }));

  return {
    map: vi.fn(() => ({
      getContainer: () => ({ id: "detailMap" }),
      getPane: () => null,
      createPane: () => ({ style: {} }),
      whenReady: () => {},
      on: () => {},
      hasLayer: () => false,
      getZoom: () => 8,
    })),
    tileLayer,
    latLngBounds: vi.fn(() => ({})),
    control: vi.fn(() => ({ addTo: () => {}, onAdd: null })),
    geoJSON: vi.fn(() => ({ clearLayers: () => {}, eachLayer: () => {} })),
    layerGroup: vi.fn(() => ({ clearLayers: () => {}, getLayers: () => [] })),
    marker: vi.fn(),
    circleMarker: vi.fn(),
    divIcon: vi.fn(),
    DomUtil: { create: () => ({ style: {}, dataset: {} }) },
    DomEvent: {
      disableClickPropagation: () => {},
      disableScrollPropagation: () => {},
    },
  };
}

describe("os guardas não podem mutilar o namespace do Leaflet", () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.window = {
      L: leafletMinimo(),
      matchMedia: () => ({ matches: false }),
    };
    globalThis.localStorage = {
      getItem: () => null,
      setItem: () => {},
    };
  });

  it("L.tileLayer.wms sobrevive ao guarda", async () => {
    const { installLeafletMapGuard } =
      await import("../src/modules/map-guard.js");
    expect(typeof window.L.tileLayer.wms).toBe("function");

    expect(installLeafletMapGuard()).toBe(true);

    expect(
      typeof window.L.tileLayer.wms,
      "o guarda apagou L.tileLayer.wms do namespace",
    ).toBe("function");
  });

  it("o guarda continua a aplicar as suas opções aos azulejos comuns", async () => {
    const { installLeafletMapGuard } =
      await import("../src/modules/map-guard.js");
    const original = window.L.tileLayer;
    installLeafletMapGuard();

    window.L.tileLayer("https://exemplo/{z}/{x}/{y}.png", { opacity: 0.5 });

    expect(original).toHaveBeenCalledWith(
      "https://exemplo/{z}/{x}/{y}.png",
      expect.objectContaining({
        opacity: 0.5,
        noWrap: true,
        updateWhenIdle: true,
        keepBuffer: 2,
      }),
    );
  });

  /*
    A camada WMS da Funai declara `updateWhenIdle: false` e `keepBuffer: 3` de
    propósito, para o raster acompanhar o arrasto. Envolver o `.wms` no guarda
    sobreporia os dois sem ninguém dar por isso.
  */
  it("o .wms é copiado tal e qual, sem as opções do guarda", async () => {
    const { installLeafletMapGuard } =
      await import("../src/modules/map-guard.js");
    const wmsOriginal = window.L.tileLayer.wms;
    installLeafletMapGuard();

    expect(window.L.tileLayer.wms).toBe(wmsOriginal);
  });

  /*
    O teste que teria apanhado o defeito: a ordem real do arranque.
  */
  it("a camada de Terras Indígenas instala-se depois dos guardas", async () => {
    const { installLeafletMapGuard } =
      await import("../src/modules/map-guard.js");
    const { installIndigenousTerritoriesLayer } =
      await import("../src/modules/indigenous-territories-layer.js");

    expect(installLeafletMapGuard()).toBe(true);
    expect(
      installIndigenousTerritoriesLayer(),
      "a camada desistiu porque o namespace do Leaflet chegou mutilado",
    ).toBe(true);
  });
});
