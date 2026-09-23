import { describe, expect, it } from "vitest";
import { addResilientBaseLayer } from "../src/modules/map-base-layer-switcher.js";

function fixture() {
  const layers = new Set();
  const listeners = {};
  const element = document.createElement("div");
  const map = {
    on: (event, fn) => {
      listeners[event] = fn;
    },
    whenReady: () => {},
    hasLayer: (layer) => layers.has(layer),
    removeLayer: (layer) => layers.delete(layer),
    eachLayer: (fn) => layers.forEach(fn),
    getContainer: () => element,
  };
  const L = {
    control: () => ({
      addTo() {
        element.append(this.onAdd());
      },
    }),
    DomUtil: {
      create(tag, className) {
        const el = document.createElement(tag);
        el.className = className;
        return el;
      },
    },
    DomEvent: { disableClickPropagation() {}, disableScrollPropagation() {} },
    /*
      O satélite passou a ser `criarCamadaComRecuo`, que estende `L.TileLayer`.
      Aqui a extensão devolve a mesma camada de mentira de `tileLayer`: o que
      estes casos medem é a troca entre fundos, não o recuo de azulejo — esse
      tem teste próprio em `tests/recuo-de-azulejo.test.js`.
    */
    TileLayer: {
      extend: () =>
        function CamadaDeMentira(url, options) {
          return L.tileLayer(url, options);
        },
    },
    tileLayer(url, options) {
      const events = {};
      return {
        url,
        options,
        on(event, fn) {
          events[event] = fn;
        },
        fire(event) {
          events[event]?.();
        },
        addTo() {
          layers.add(this);
          listeners.layeradd?.({ layer: this });
          return this;
        },
      };
    },
  };
  const base = addResilientBaseLayer(L, map);
  return { map, base, layers, element };
}

describe("recuperação das camadas do mapa", () => {
  it("troca a camada e o estado do botão juntos, preservando os pontos", () => {
    const { map, base, layers, element } = fixture();
    const marker = { lat: 2.8563, lon: -60.6527 };
    layers.add(marker);
    for (let i = 0; i < 4; i++) base.fire("tileerror");
    expect(map.hasLayer(base)).toBe(false);
    expect(layers.size).toBe(2);
    expect(layers.has(marker)).toBe(true);
    expect(
      element
        .querySelector('[data-map-mode="satellite"]')
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });
  it("ignora erros atrasados e não alterna sem parar quando ambos falham", () => {
    const { map, base, layers } = fixture();
    for (let i = 0; i < 4; i++) base.fire("tileerror");
    const satellite = map.__agsusSatelliteLayer;
    for (let i = 0; i < 20; i++) {
      base.fire("tileerror");
      satellite.fire("tileerror");
    }
    expect([...layers]).toEqual([satellite]);
    expect(map.__agsusBaseMapMode).toBe("satellite");
  });
  it("permite tentar novamente pelo botão sem acumular fundos", () => {
    const { base, layers, element } = fixture();
    for (let i = 0; i < 4; i++) base.fire("tileerror");
    element.querySelector('[data-map-mode="map"]').click();
    expect([...layers]).toEqual([base]);
    base.fire("tileload");
    element.querySelector('[data-map-mode="satellite"]').click();
    expect(layers.size).toBe(1);
  });
});
