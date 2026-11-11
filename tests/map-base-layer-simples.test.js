import { afterEach, describe, expect, it } from "vitest";
import {
  EVENTO_DO_FUNDO,
  addResilientBaseLayer,
  adicionarCamadaDeFundo,
} from "../src/modules/map-base-layer-switcher.ts";

/*
  O terceiro botão do seletor do fundo, "Mapa DSEIs": só no mapa nacional
  da Saúde Indígena (#map), sem azulejo nenhum, lembrado no navegador.
*/

function fixture(id = "map") {
  const layers = new Set();
  const listeners = {};
  const element = document.createElement("div");
  element.id = id;
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
  const tileLayer = (url, options) => {
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
    TileLayer: {
      extend: () =>
        function CamadaDeMentira(url, options) {
          return tileLayer(url, options);
        },
    },
    tileLayer,
  };
  const azulejos = () => [...layers].filter((l) => l.url);
  const botao = (modo) => element.querySelector(`[data-map-mode="${modo}"]`);
  return { L, map, element, layers, azulejos, botao, tileLayer };
}

afterEach(() => {
  localStorage.clear();
});

describe("Mapa DSEIs no seletor do fundo", () => {
  it("o mapa nacional da Saúde Indígena ganha o terceiro botão; os outros, não", () => {
    const nacional = fixture("map");
    addResilientBaseLayer(nacional.L, nacional.map);
    expect(
      [...nacional.element.querySelectorAll("[data-map-mode]")].map(
        (b) => b.textContent,
      ),
    ).toEqual(["Mapa", "Satélite", "Mapa DSEIs"]);

    const projetos = fixture("mapaDosProjetos");
    addResilientBaseLayer(projetos.L, projetos.map);
    expect(projetos.botao("simple")).toBeNull();
  });

  it("troca de modo sem azulejos: tira o fundo, marca o contêiner, avisa e lembra", () => {
    const { L, map, element, azulejos, botao } = fixture();
    const base = addResilientBaseLayer(L, map);
    const avisos = [];
    element.addEventListener(EVENTO_DO_FUNDO, (e) =>
      avisos.push(e.detail.mode),
    );

    botao("simple").click();
    expect(azulejos()).toEqual([]);
    expect(map.hasLayer(base)).toBe(false);
    expect(element.classList.contains("map-simple-mode")).toBe(true);
    expect(botao("simple").getAttribute("aria-pressed")).toBe("true");
    expect(botao("map").getAttribute("aria-pressed")).toBe("false");
    expect(avisos).toEqual(["simple"]);
    expect(localStorage.getItem("agsus_map_base_layer_v2")).toBe("simple");

    botao("map").click();
    expect(azulejos()).toEqual([base]);
    expect(element.classList.contains("map-simple-mode")).toBe(false);
    expect(avisos).toEqual(["simple", "map"]);

    botao("simple").click();
    botao("satellite").click();
    expect(azulejos()).toHaveLength(1);
    expect(azulejos()[0]).not.toBe(base);
    expect(element.classList.contains("map-simple-mode")).toBe(false);
  });

  it("falha de azulejo no Mapa DSEIs não troca o fundo", () => {
    const { L, map, element, azulejos, botao } = fixture();
    const base = addResilientBaseLayer(L, map);
    botao("simple").click();
    for (let i = 0; i < 4; i += 1) base.fire("tileerror");
    expect(azulejos()).toEqual([]);
    expect(element.classList.contains("map-simple-mode")).toBe(true);
  });

  it("com o Mapa DSEIs guardado, a camada do fundo nem entra (nenhum azulejo baixado)", () => {
    localStorage.setItem("agsus_map_base_layer_v2", "simple");
    const { L, map, azulejos, botao, tileLayer } = fixture();
    addResilientBaseLayer(L, map);
    const osm = tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
    osm.__agsusBaseMapKind = "map";
    // O primeiro fundo entra pelo addResilientBaseLayer; o seguinte, pelo app.
    map.removeLayer([...azulejos()][0]);
    expect(adicionarCamadaDeFundo(map, osm)).toBe(osm);
    expect(azulejos()).toEqual([]);
    expect(map.__agsusDesiredBaseMapMode).toBe("simple");
    botao("map").click();
    expect(azulejos()).toContain(osm);
  });

  it("noutro mapa, o Mapa DSEIs guardado vale como Mapa", () => {
    localStorage.setItem("agsus_map_base_layer_v2", "simple");
    const { L, map, azulejos, tileLayer } = fixture("detailMap");
    addResilientBaseLayer(L, map);
    expect(map.__agsusDesiredBaseMapMode).toBe("map");
    const osm = tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
    adicionarCamadaDeFundo(map, osm);
    expect(azulejos()).toContain(osm);
  });

  it("sem o seletor instalado, a camada entra como sempre", () => {
    const { map, azulejos, tileLayer } = fixture();
    const osm = tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
    adicionarCamadaDeFundo(map, osm);
    expect(azulejos()).toEqual([osm]);
  });
});

describe("Mapa DSEIs é o padrão do mapa nacional (11/11/2026)", () => {
  it("sem escolha guardada, o mapa nacional abre no Mapa DSEIs, sem azulejo", () => {
    const { L, map, azulejos, tileLayer } = fixture();
    addResilientBaseLayer(L, map);
    expect(map.__agsusDesiredBaseMapMode).toBe("simple");
    // Como no teste do Mapa DSEIs guardado: o fundo do app (leaflet.ts) nem entra.
    map.removeLayer([...azulejos()][0]);
    const osm = tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
    osm.__agsusBaseMapKind = "map";
    adicionarCamadaDeFundo(map, osm);
    expect(azulejos()).toEqual([]);
  });

  it("os outros mapas continuam abrindo no Mapa", () => {
    for (const id of ["detailMap", "mapaDosProjetos"]) {
      const { L, map } = fixture(id);
      addResilientBaseLayer(L, map);
      expect(map.__agsusDesiredBaseMapMode).toBe("map");
    }
  });

  it("quem escolhe Mapa ou Satélite tem a escolha respeitada", () => {
    for (const modo of ["map", "satellite"]) {
      localStorage.setItem("agsus_map_base_layer_v2", modo);
      const { L, map } = fixture();
      addResilientBaseLayer(L, map);
      expect(map.__agsusDesiredBaseMapMode).toBe(modo);
    }
  });

  it("a escolha da chave antiga (v1) não vale mais: todo mundo começa no Mapa DSEIs", () => {
    localStorage.setItem("agsus_map_base_layer_v1", "map");
    const { L, map } = fixture();
    addResilientBaseLayer(L, map);
    expect(map.__agsusDesiredBaseMapMode).toBe("simple");
  });
});
