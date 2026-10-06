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
