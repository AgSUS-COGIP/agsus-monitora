import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
  O guarda agenda um "estabilizar" 40 ms depois de cada movimento. Se o mapa
  sai antes (StrictMode desmonta logo após montar; trocar de área também), o
  `remove()` do Leaflet já apagou os panes e o `panInsideBounds` lia
  `_leaflet_pos` de undefined — erro no console a cada abertura do mapa.
*/

function mapaFalso() {
  const ouvintes = {};
  const mapa = {
    options: {},
    on(eventos, fn) {
      for (const nome of eventos.split(" ")) (ouvintes[nome] ||= []).push(fn);
      return mapa;
    },
    disparar(nome) {
      for (const fn of ouvintes[nome] || []) fn();
    },
    whenReady: () => {},
    getContainer: () => null,
    setMaxBounds: vi.fn(),
    fitBounds: vi.fn(),
    setView: vi.fn(),
    invalidateSize: vi.fn(),
    panInsideBounds: vi.fn(),
    getZoom: () => 4,
  };
  return mapa;
}

describe("guarda do mapa depois do remove()", () => {
  let mapa;
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    mapa = mapaFalso();
    const tileLayer = vi.fn();
    globalThis.window = {
      L: {
        map: vi.fn(() => mapa),
        tileLayer,
        latLngBounds: vi.fn(() => ({})),
      },
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      requestAnimationFrame: (fn) => globalThis.setTimeout(fn, 0),
    };
  });
  afterEach(() => {
    vi.useRealTimers();
    delete globalThis.window;
  });

  it("não estabiliza um mapa que já foi removido", async () => {
    await import("../src/modules/map-guard.js");
    window.L.map("detailMap");

    mapa.disparar("move");
    mapa.disparar("unload");
    vi.advanceTimersByTime(100);
    expect(mapa.panInsideBounds).not.toHaveBeenCalled();

    mapa.disparar("resize");
    vi.advanceTimersByTime(100);
    expect(mapa.panInsideBounds).not.toHaveBeenCalled();
    expect(mapa.invalidateSize).not.toHaveBeenCalled();
  });

  it("continua a estabilizar enquanto o mapa existe", async () => {
    await import("../src/modules/map-guard.js");
    window.L.map("detailMap");

    mapa.disparar("move");
    vi.advanceTimersByTime(100);
    expect(mapa.panInsideBounds).toHaveBeenCalledTimes(1);
  });
});

/* Caixa mínima no formato do Leaflet: [[sul, oeste], [norte, leste]] ou outra caixa. */
function caixa(entrada, segundo) {
  if (entrada?.getSouth) return entrada;
  const [a, b] = segundo ? [entrada, segundo] : entrada;
  const s = Math.min(a[0], b[0]);
  const n = Math.max(a[0], b[0]);
  const w = Math.min(a[1], b[1]);
  const e = Math.max(a[1], b[1]);
  return {
    getSouth: () => s,
    getNorth: () => n,
    getWest: () => w,
    getEast: () => e,
  };
}

describe("guarda do mapa: enquadrar um ponto só e o nome do mapa", () => {
  let mapa;
  let flyToBoundsOriginal;
  let container;
  beforeEach(() => {
    vi.resetModules();
    flyToBoundsOriginal = vi.fn();
    container = document.createElement("div");
    mapa = {
      ...mapaFalso(),
      getContainer: () => container,
      flyToBounds: flyToBoundsOriginal,
    };
    globalThis.window = {
      L: {
        map: vi.fn(() => mapa),
        tileLayer: vi.fn(),
        latLngBounds: vi.fn(caixa),
      },
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      requestAnimationFrame: (fn) => globalThis.setTimeout(fn, 0),
    };
  });
  afterEach(() => {
    delete globalThis.window;
  });

  it("ir até um ponto não vira o continente com zoom 4,5", async () => {
    await import("../src/modules/map-guard.js");
    window.L.map(container);
    mapa.flyToBounds(caixa([-3.1, -60.0], [-3.1, -60.0]), { maxZoom: 11 });
    const [limites, opcoes] = flyToBoundsOriginal.mock.calls.at(-1);
    expect(limites.getSouth()).toBe(-3.1);
    expect(limites.getNorth()).toBe(-3.1);
    expect(opcoes.maxZoom).toBe(11);
  });

  it("não troca o nome que o mapa já tem", async () => {
    container.setAttribute("aria-label", "Mapa de Projetos");
    await import("../src/modules/map-guard.js");
    window.L.map(container);
    expect(container.getAttribute("aria-label")).toBe("Mapa de Projetos");
  });
});
