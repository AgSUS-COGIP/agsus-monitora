import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
  AS TERRAS INDÍGENAS NO "MAPA SIMPLES"

  O print da produção: no Mapa simples, as terras (manchas e pontinhos cor
  de terra) por cima dos DSEIs chapados; no Mapa, o botão "Terras Indígenas"
  com `aria-pressed="false"` e as terras desenhadas. Quem desligava as terras
  ao entrar no Mapa simples era um efeito do React, que só soube do modo
  depois de o mapa nascer e de cada troca avisada — duas fontes de verdade
  para o mesmo estado.

  A regra agora mora na camada (indigenous-territories-layer.ts): ela lê o
  modo pedido ao seletor quando o mapa nasce e segue o aviso de troca
  (`agsus:map-base-layer-changed`) no mesmo instante. No Mapa simples as
  terras começam desligadas e o botão liga e desliga só enquanto ele durar;
  ao sair, volta a preferência guardada do Mapa/Satélite.
*/

const CHAVE = "agsus_map_terras_indigenas_v1";

function camada() {
  const filhas = new Set();
  const c = {
    addTo(alvo) {
      alvo.addLayer(c);
      return c;
    },
    addLayer: (f) => filhas.add(f),
    removeLayer: (f) => filhas.delete(f),
    clearLayers: () => filhas.clear(),
    getLayers: () => [...filhas],
    eachLayer: (fn) => filhas.forEach(fn),
    addData: () => c,
    setStyle: () => c,
    on: () => c,
    bindTooltip: () => c,
  };
  return c;
}

function leafletFalso(modoPedido) {
  const tileLayer = () => camada();
  tileLayer.wms = () => camada();
  return {
    map(elemento) {
      const ouvintes = {};
      const camadas = new Set();
      const panes = new Map();
      const canto = document.createElement("div");
      elemento.append(canto);
      const mapa = {
        // O seletor do fundo (map-base-layer-switcher.ts) grava o modo pedido.
        __agsusDesiredBaseMapMode: modoPedido,
        getContainer: () => elemento,
        getPane: (nome) => panes.get(nome),
        createPane: (nome) => {
          const pane = document.createElement("div");
          panes.set(nome, pane);
          return pane;
        },
        on(eventos, fn) {
          for (const e of eventos.split(" ")) (ouvintes[e] ||= []).push(fn);
          return mapa;
        },
        fire(evento, dados) {
          for (const fn of ouvintes[evento] || []) fn(dados);
          return mapa;
        },
        whenReady: () => mapa,
        addLayer: (c) => camadas.add(c),
        removeLayer: (c) => camadas.delete(c),
        hasLayer: (c) => camadas.has(c),
        getZoom: () => 4.5,
        canto,
      };
      return mapa;
    },
    tileLayer,
    geoJSON: () => camada(),
    layerGroup: () => camada(),
    circleMarker: () => camada(),
    marker: () => camada(),
    divIcon: (o) => o,
    control: () => {
      const controle = {
        addTo(mapa) {
          mapa.canto.append(controle.onAdd());
          return controle;
        },
      };
      return controle;
    },
    DomUtil: {
      create(tag, classe, pai) {
        const el = document.createElement(tag);
        el.className = classe;
        pai?.append(el);
        return el;
      },
    },
    DomEvent: {
      disableClickPropagation: () => {},
      disableScrollPropagation: () => {},
    },
  };
}

let elemento;
let mapa;

async function montar(modoPedido = "map") {
  window.L = leafletFalso(modoPedido);
  const { installIndigenousTerritoriesLayer } =
    await import("../src/modules/indigenous-territories-layer.ts");
  installIndigenousTerritoriesLayer();
  elemento = document.createElement("div");
  elemento.id = "map";
  document.body.append(elemento);
  mapa = window.L.map(elemento);
}

const botao = () =>
  elemento.querySelector(".agsus-indigenous-territories-control__button");
const ligado = () => botao().getAttribute("aria-pressed");
const trocarFundo = (mode) =>
  elemento.dispatchEvent(
    new CustomEvent("agsus:map-base-layer-changed", {
      bubbles: true,
      detail: { mode },
    }),
  );

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: false, status: 502, json: async () => ({}) })),
  );
  localStorage.clear();
});

afterEach(() => {
  elemento?.remove();
  delete window.L;
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("Terras Indígenas no Mapa simples", () => {
  it("abrir a página já no Mapa simples: terras e botão desligados, preferência intacta", async () => {
    await montar("simple");
    expect(mapa.__agsusIndigenousTerritoriesVisible).toBe(false);
    expect(ligado()).toBe("false");
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });

  it("entrar no Mapa simples desliga; sair devolve o que estava guardado", async () => {
    await montar("map");
    expect(ligado()).toBe("true");

    trocarFundo("simple");
    expect(mapa.__agsusIndigenousTerritoriesVisible).toBe(false);
    expect(ligado()).toBe("false");

    trocarFundo("map");
    expect(mapa.__agsusIndigenousTerritoriesVisible).toBe(true);
    expect(ligado()).toBe("true");
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });

  it("o botão no Mapa simples vale só enquanto ele durar", async () => {
    await montar("map");
    botao().click(); // desliga no Mapa: isto se guarda
    expect(localStorage.getItem(CHAVE)).toBe("0");

    trocarFundo("simple");
    botao().click(); // liga no Mapa simples: não se guarda
    expect(ligado()).toBe("true");
    expect(localStorage.getItem(CHAVE)).toBe("0");

    trocarFundo("satellite");
    expect(mapa.__agsusIndigenousTerritoriesVisible).toBe(false);
    expect(ligado()).toBe("false");

    // Voltar ao Mapa simples recomeça sem terras.
    botao().click();
    trocarFundo("simple");
    expect(ligado()).toBe("false");
  });

  it("o mesmo aviso repetido não mexe no estado", async () => {
    await montar("simple");
    botao().click();
    trocarFundo("simple");
    expect(ligado()).toBe("true");
  });
});
