import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ZOOM_NACIONAL,
  zoomQueCabe,
} from "../src/lib/enquadramento-do-brasil.ts";

/*
  O ZOOM MÍNIMO ACOMPANHA A MOLDURA

  O bug (Visão geral da Saúde Indígena, depois do "Mapa simples"): o mínimo
  só era recalculado dentro de um enquadramento do Brasil. Os mapas da Visão
  geral enquadram sozinhos (`enquadramentoProprio`) e, depois de a pessoa
  mexer no mapa, não reenquadram ao mudar de tamanho. Com o card mais baixo,
  o mínimo continuava o da medida antiga: medido no navegador, 724×778 → 724×558
  ficava em 4.25 com o "−" desabilitado e o Brasil de borda a borda
  (lat. 5.27 a −33.8), sem folga e sem como afastar.

  Agora todo `resize` do Leaflet recalcula o mínimo: o zoom em que o país
  inteiro cabe com a folga, nunca acima da escala nacional (4.5).
*/

function caixa(entrada, segundo) {
  if (entrada?.getSouth) return entrada;
  const [a, b] = segundo ? [entrada, segundo] : entrada;
  return {
    getSouth: () => Math.min(a[0], b[0]),
    getNorth: () => Math.max(a[0], b[0]),
    getWest: () => Math.min(a[1], b[1]),
    getEast: () => Math.max(a[1], b[1]),
  };
}

function mapaFalso({ enquadramentoProprio }) {
  const ouvintes = {};
  const mapa = {
    options: { enquadramentoProprio },
    tamanho: { x: 724, y: 778 },
    on(eventos, fn) {
      for (const nome of eventos.split(" ")) (ouvintes[nome] ||= []).push(fn);
      return mapa;
    },
    disparar(nome) {
      for (const fn of ouvintes[nome] || []) fn();
    },
    whenReady: () => {},
    getContainer: () => null,
    getSize: () => mapa.tamanho,
    getZoom: () => 4.25,
    setMaxBounds: vi.fn(),
    setMinZoom: vi.fn(),
    fitBounds: vi.fn(),
    setView: vi.fn(),
    invalidateSize: vi.fn(),
    panInsideBounds: vi.fn(),
  };
  return mapa;
}

describe("o zoom mínimo acompanha a moldura", () => {
  let mapa;
  let minimoOriginal;

  const montar = async ({ enquadramentoProprio = true } = {}) => {
    mapa = mapaFalso({ enquadramentoProprio });
    minimoOriginal = mapa.setMinZoom;
    globalThis.window = {
      L: {
        map: vi.fn(() => mapa),
        tileLayer: vi.fn(),
        latLngBounds: vi.fn(caixa),
        latLng: vi.fn((lat, lng) => ({ lat, lng })),
      },
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      requestAnimationFrame: (fn) => globalThis.setTimeout(fn, 0),
    };
    await import("../src/modules/map-guard.ts");
    window.L.map("map");
    minimoOriginal.mockClear();
  };

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    delete globalThis.window;
  });

  it("o card que encolhe baixa o mínimo até o Brasil caber (mapa com enquadramento próprio)", async () => {
    await montar();
    mapa.tamanho = { x: 724, y: 558 };
    mapa.disparar("resize");

    const esperado = zoomQueCabe({ largura: 724, altura: 558 });
    expect(esperado).toBeLessThan(4.25);
    expect(minimoOriginal).toHaveBeenLastCalledWith(esperado);
  });

  it("o card que cresce volta à escala nacional, sem passar dela", async () => {
    await montar();
    mapa.tamanho = { x: 724, y: 400 };
    mapa.disparar("resize");
    mapa.tamanho = { x: 1400, y: 1000 };
    mapa.disparar("resize");
    expect(minimoOriginal).toHaveBeenLastCalledWith(ZOOM_NACIONAL);
  });

  it("vale também para o mapa que o guarda enquadra", async () => {
    await montar({ enquadramentoProprio: false });
    mapa.tamanho = { x: 600, y: 480 };
    mapa.disparar("resize");
    expect(minimoOriginal).toHaveBeenLastCalledWith(
      zoomQueCabe({ largura: 600, altura: 480 }),
    );
  });

  it("mapa removido não mexe no mínimo", async () => {
    await montar();
    mapa.disparar("unload");
    mapa.tamanho = { x: 724, y: 400 };
    mapa.disparar("resize");
    expect(minimoOriginal).not.toHaveBeenCalled();
  });
});
