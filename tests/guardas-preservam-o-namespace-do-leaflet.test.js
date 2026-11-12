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
  módulos na ordem real da aplicação e verifica que a camada consegue instalar-se
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
      off: () => {},
      hasLayer: () => false,
      getZoom: () => 8,
      setMaxBounds: () => {},
      fitBounds: () => {},
      setView: () => {},
    })),
    tileLayer,
    latLngBounds: vi.fn(() => ({})),
    latLng: vi.fn((lat, lng) => ({ lat, lng })),
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

describe("a guarda do mapa não mexe no namespace do Leaflet", () => {
  beforeEach(() => {
    vi.resetModules();
    const L = leafletMinimo();
    // A guarda dá nome e teclado ao contêiner: aqui, um elemento de verdade.
    const mapaMinimo = L.map;
    const conteiner = document.createElement("div");
    L.map = vi.fn((...argumentos) => ({
      ...mapaMinimo(...argumentos),
      getContainer: () => conteiner,
    }));
    globalThis.window = {
      L,
      matchMedia: () => ({ matches: false }),
    };
    globalThis.localStorage = {
      getItem: () => null,
      setItem: () => {},
    };
  });

  it("criar um mapa não troca L.map, L.tileLayer nem L.tileLayer.wms", async () => {
    const { criarMapa } =
      await import("../src/modulos/mapa-saude-indigena/leaflet.ts");
    const { map, tileLayer } = window.L;
    const wms = tileLayer.wms;

    criarMapa(window.L, document.createElement("div"));

    expect(window.L.map).toBe(map);
    expect(window.L.tileLayer).toBe(tileLayer);
    expect(window.L.tileLayer.wms).toBe(wms);
  });

  it("o mapa nasce com os limites e a faixa do zoom da guarda", async () => {
    const { criarMapa } =
      await import("../src/modulos/mapa-saude-indigena/leaflet.ts");
    const { ZOOM_MINIMO, ZOOM_MAXIMO } =
      await import("../src/modulos/mapa-saude-indigena/guarda-do-mapa.ts");

    criarMapa(window.L, document.createElement("div"));

    const opcoes = window.L.map.mock.calls.at(-1)[1];
    expect(opcoes).toMatchObject({
      minZoom: ZOOM_MINIMO,
      maxZoom: ZOOM_MAXIMO,
      worldCopyJump: false,
      zoomSnap: 0.25,
      enquadramentoProprio: true,
    });
    expect(opcoes).toHaveProperty("maxBounds");
    expect([ZOOM_MINIMO, ZOOM_MAXIMO]).toEqual([4.5, 19]);
  });

  /*
    O recorte por `bounds` era a origem do card cinzento: o Leaflet deixava de
    pedir azulejos fora da caixa e dois terços do card ficavam por desenhar. É
    invisível — não dá erro nem aviso. Só um teste o impede de voltar.
  */
  it("o fundo de azulejos sai sem cópias do mundo e sem recorte por bounds", async () => {
    const { adicionarFundo } =
      await import("../src/modulos/mapa-saude-indigena/leaflet.ts");
    const camada = { on: vi.fn(), addTo: vi.fn(() => camada) };
    window.L.tileLayer.mockReturnValueOnce(camada);

    adicionarFundo(window.L, {}, document.createElement("div"));

    const opcoes = window.L.tileLayer.mock.calls.at(-1)[1];
    expect(opcoes).toMatchObject({
      noWrap: true,
      updateWhenIdle: true,
      keepBuffer: 2,
    });
    expect(Object.keys(opcoes)).not.toContain("bounds");
  });
});

describe("os módulos que ainda envolvem o Leaflet não o mutilam", () => {
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

  /*
    A SEQUÊNCIA REAL DO ARRANQUE, E POR QUE ELA É A ÚNICA QUE CONTA.

    A primeira versão deste teste instalava só o `map-guard` e dava verde — e a
    camada continuou a não existir em produção. Faltavam dois: o switcher de
    base e o zoom-range também envolvem `L.tileLayer`, e ambos correm DEPOIS do
    guarda no arranque dos mapas. O que o guarda restaurava, eles voltavam a apagar.

    Esta ordem é a de `carregarLeaflet`
    (src/modulos/mapa-saude-indigena/carregar-leaflet.ts, quando um mapa monta)
    e o teste chama a função de verdade: um teste que instale um instalador só
    volta a dar verde sobre uma aplicação partida.
  */
  const arrancarComoAAplicacao = async () => {
    const { carregarLeaflet } =
      await import("../src/modulos/mapa-saude-indigena/carregar-leaflet.ts");
    await carregarLeaflet({ janela: window });
    const L = window.L;
    return {
      switcher: L.__agsusBaseLayerSwitcherInstalled === true,
      terras: L.__agsusIndigenousTerritoriesInstalled === true,
    };
  };

  it("o .wms sobrevive aos invólucros, não só ao primeiro", async () => {
    const wmsOriginal = window.L.tileLayer.wms;
    await arrancarComoAAplicacao();

    expect(
      typeof window.L.tileLayer.wms,
      "algum dos invólucros apagou L.tileLayer.wms",
    ).toBe("function");
    expect(window.L.tileLayer.wms).toBe(wmsOriginal);
  });

  it("a camada de Terras Indígenas instala-se no fim da sequência", async () => {
    const resultado = await arrancarComoAAplicacao();

    expect(resultado.switcher).toBe(true);
    expect(
      resultado.terras,
      "a camada desistiu porque o namespace do Leaflet chegou mutilado",
    ).toBe(true);
    expect(window.L.__agsusIndigenousTerritoriesInstalled).toBe(true);
  });
});
