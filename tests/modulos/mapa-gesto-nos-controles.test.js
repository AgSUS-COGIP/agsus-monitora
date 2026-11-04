import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  criarMapaDoBrasil,
  ehGestoNaVista,
} from "../../src/modulos/mapa-saude-indigena/leaflet.ts";
import { criarLeafletFalso } from "./leaflet-falso.js";

/*
  TROCAR O FUNDO NÃO É PEGAR O MAPA

  O mapa nacional reenquadra o Brasil quando o card muda de tamanho, até a
  pessoa mexer nele (arrastar, zoom, teclado). Todo `pointerdown` dentro do
  contêiner contava — inclusive o clique em "Mapa simples", "Satélite" ou
  "Terras Indígenas", que moram no canto do Leaflet e não mexem na vista. Daí
  em diante o mapa deixava de reenquadrar e o Brasil saía cortado no card
  mais baixo. O "+ −" continua contando: ele mexe na vista.
*/

function controle(elemento, classes) {
  const caixa = document.createElement("div");
  caixa.className = `leaflet-control ${classes}`;
  const botao = document.createElement("button");
  caixa.append(botao);
  elemento.append(caixa);
  return botao;
}

const gesto = (alvo, tipo = "pointerdown") =>
  alvo.dispatchEvent(new Event(tipo, { bubbles: true }));

describe("gestos nos controles do mapa", () => {
  let medida;
  let observado;
  let elemento;

  beforeEach(() => {
    medida = { largura: 724, altura: 778 };
    observado = null;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(fn) {
          observado = fn;
        }
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal("requestAnimationFrame", (fn) => {
      fn();
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    elemento = document.createElement("div");
    Object.defineProperty(elemento, "offsetWidth", {
      get: () => medida.largura,
    });
    Object.defineProperty(elemento, "offsetHeight", {
      get: () => medida.altura,
    });
    document.body.append(elemento);
  });

  afterEach(() => {
    elemento.remove();
    vi.unstubAllGlobals();
  });

  const encolher = () => {
    medida = { ...medida, altura: medida.altura - 100 };
    observado();
  };

  it("o seletor do fundo e o botão das terras não contam; o '+ −' e o mapa contam", () => {
    const fundo = controle(elemento, "agsus-basemap-switcher");
    const terras = controle(elemento, "agsus-indigenous-territories-control");
    const zoom = controle(elemento, "leaflet-control-zoom leaflet-bar");
    expect(ehGestoNaVista({ target: fundo })).toBe(false);
    expect(ehGestoNaVista({ target: terras })).toBe(false);
    expect(ehGestoNaVista({ target: zoom })).toBe(true);
    expect(ehGestoNaVista({ target: elemento })).toBe(true);
  });

  it("depois de trocar o fundo, o card que muda de tamanho ainda reenquadra o Brasil", () => {
    const { L } = criarLeafletFalso();
    const aoReenquadrar = vi.fn();
    criarMapaDoBrasil(L, elemento, { aoReenquadrar });
    const fundo = controle(elemento, "agsus-basemap-switcher");
    const terras = controle(elemento, "agsus-indigenous-territories-control");

    gesto(fundo);
    gesto(terras, "keydown");
    encolher();
    expect(aoReenquadrar).toHaveBeenCalledTimes(1);

    // Arrastar o mapa é pegar nele: a vista da pessoa fica.
    gesto(elemento);
    encolher();
    expect(aoReenquadrar).toHaveBeenCalledTimes(1);
  });

  it("o '+ −' conta como gesto", () => {
    const { L } = criarLeafletFalso();
    const aoReenquadrar = vi.fn();
    criarMapaDoBrasil(L, elemento, { aoReenquadrar });
    gesto(controle(elemento, "leaflet-control-zoom leaflet-bar"));
    encolher();
    expect(aoReenquadrar).not.toHaveBeenCalled();
  });
});
