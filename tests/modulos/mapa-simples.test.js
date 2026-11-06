import { StrictMode, act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { esquecerContornosDosDseis } from "../../src/lib/mapa-saude-indigena/contornos-dos-dseis.ts";
import { EVENTO_DO_FUNDO } from "../../src/modules/map-base-layer-switcher.ts";
import { MapaSaudeIndigena } from "../../src/modulos/mapa-saude-indigena/mapa-saude-indigena.tsx";
import { ESPERA_DO_REALCE_NA_LISTA } from "../../src/modulos/mapa-saude-indigena/mapa-nacional.tsx";
import { clicar, esperar } from "../componentes/interacoes.ts";
import { criarLeafletFalso } from "./leaflet-falso.js";

/*
  O "Mapa DSEIs" no mapa nacional da Saúde Indígena (mapa-simples.tsx), com
  o Leaflet falso e contornos de mentira no lugar do arquivo local: os DSEIs
  chapados e numerados, a cor pelos números da lista, o realce lista ↔
  polígono, o clique, a dica e a volta ao Mapa.
*/

const LMAP = {
  dsei: [
    {
      k: "ALAGOAS E SERGIPE",
      n: "Alagoas e Sergipe",
      lat: -9.6,
      lon: -35.7,
      pop: 12000,
      ufs: ["AL", "SE"],
      polos: [],
    },
    {
      k: "YANOMAMI",
      n: "Yanomami",
      lat: 2.81,
      lon: -60.67,
      pop: 30000,
      ufs: ["RR", "AM"],
      polos: [],
    },
    {
      k: "LESTE DE RORAIMA",
      n: "Leste de Roraima",
      lat: 2.82,
      lon: -60.67,
      pop: 50000,
      ufs: ["RR"],
      polos: [],
    },
  ],
};

const LINHAS = [
  { unidade: "DSEI Alagoas e Sergipe", vagas_total: 10, vagas_ociosas: 1 },
  { unidade: "DSEI Yanomami", vagas_total: 40, vagas_ociosas: 30 },
];

const quadrado = (x, y) => [
  [
    [x, y],
    [x + 1, y],
    [x + 1, y + 1],
    [x, y + 1],
    [x, y],
  ],
];
const CONTORNOS = {
  type: "FeatureCollection",
  features: [
    [1, -36, -10],
    [16, -61, 2],
    [34, -63, 2],
  ].map(([numero, x, y]) => ({
    type: "Feature",
    properties: { numero, nome: "x", rotulo: [y + 0.5, x + 0.5] },
    geometry: { type: "Polygon", coordinates: quadrado(x, y) },
  })),
};

let raiz = null;
let host = null;
let leaflet = null;

async function montar(props = {}) {
  host = document.createElement("div");
  document.body.append(host);
  raiz = createRoot(host);
  await act(async () =>
    raiz.render(
      createElement(
        StrictMode,
        null,
        createElement(MapaSaudeIndigena, {
          lmap: LMAP,
          redeCnes: {
            rede: {},
            nac: [["CASAI DF", "", -15.8, -47.9, "BRASILIA", 53]],
          },
          linhas: LINHAS,
          ...props,
        }),
      ),
    ),
  );
  // Os contornos (fetch) e o contorno do Brasil (import) chegam depois.
  await vi.waitFor(() => expect(poligonos()).toHaveLength(3));
  await esperar();
  return host;
}

const mapaVivo = () => leaflet.vivos().find((m) => m.elemento.id === "map");
const poligonos = () =>
  leaflet
    .desenhadas(mapaVivo() || { camadas: new Set() }, "geoJSON")
    .filter((c) => c.opcoes?.className === "mapa-simples__dsei");
const poligono = (numero) =>
  poligonos().find((c) => c.latlng.properties.numero === numero);
const linha = (numero) =>
  host.querySelector(`.mapa-si-territorio[data-numero="${numero}"]`);
// O realce que vem do mapa chega à lista depois de uma pequena espera.
const esperarOrealceDaLista = () =>
  act(
    () =>
      new Promise((pronto) =>
        setTimeout(pronto, ESPERA_DO_REALCE_NA_LISTA + 30),
      ),
  );

beforeEach(() => {
  esquecerContornosDosDseis();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => CONTORNOS })),
  );
  window.matchMedia = (consulta) => ({
    matches: consulta.includes("hover"),
    addEventListener() {},
    removeEventListener() {},
  });
  leaflet = criarLeafletFalso({
    aoCriarMapa: (m) => {
      // O que o seletor do fundo faz ao nascer o mapa, com "Mapa DSEIs" guardado.
      m.__agsusDesiredBaseMapMode = "simple";
    },
  });
  globalThis.L = leaflet.L;
});

afterEach(async () => {
  if (raiz) await act(async () => raiz.unmount());
  raiz = null;
  host?.remove();
  host = null;
  delete globalThis.L;
  delete window.matchMedia;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("Mapa DSEIs", () => {
  it("desenha os DSEIs com número, sem bolhas nem CASAIs", async () => {
    await montar();
    const mapa = mapaVivo();
    expect(fetch).toHaveBeenCalledWith(
      "/data/contornos-dos-dseis.json",
      expect.anything(),
    );
    const rotulos = leaflet
      .desenhadas(mapa, "marker")
      .map((m) => m.opcoes.icon?.html?.textContent)
      .filter(Boolean);
    expect(rotulos).toEqual(["1", "16", "34"]);
    expect(leaflet.desenhadas(mapa, "circleMarker")).toHaveLength(0);
  });

  it("colore pelos números da lista e marca o DSEI sem dado", async () => {
    await montar();
    expect(poligono(34).elemento.style.fill).toBe("var(--mapa-simples-seq-2)");
    expect(poligono(1).elemento.style.fill).toBe("var(--mapa-simples-seq-5)");
    expect(poligono(16).elemento.style.fill).toBe(
      "var(--mapa-simples-sem-dado)",
    );
    const legenda = host.querySelector(".mapa-simples__faixas");
    expect(legenda.getAttribute("aria-label")).toBe("Faixas de % preenchidas");
    expect(legenda.textContent).toContain("80–100%");
    expect(legenda.textContent).toContain("sem dado");

    await clicar(host.querySelector('input[value="dsei"]'));
    expect(poligono(16).elemento.style.fill).toBe(
      "var(--mapa-simples-dsei-16)",
    );
    expect(localStorage.getItem("agsus_mapa_simples_colorir_v1")).toBe("dsei");
  });

  it("a lista mostra o número do DSEI; focar a linha realça o polígono e vice-versa", async () => {
    await montar();
    expect(
      linha(34).querySelector(".mapa-si-territorio__numero").textContent,
    ).toBe("34");
    expect(linha(34).getAttribute("aria-label")).toBe(
      "Abrir o DSEI 34, Yanomami: 40 vagas, 25% preenchidas",
    );

    await act(async () => {
      linha(34).dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    });
    expect(poligono(34).elemento.classList.contains("is-realce")).toBe(true);
    expect(poligono(1).elemento.classList.contains("is-realce")).toBe(false);

    await act(async () => poligono(1).fire("mouseover"));
    // O polígono acende na hora; a linha, depois de o mouse parar no DSEI.
    expect(poligono(1).elemento.classList.contains("is-realce")).toBe(true);
    await esperarOrealceDaLista();
    expect(linha(1).classList.contains("is-realce")).toBe(true);
    expect(linha(34).classList.contains("is-realce")).toBe(false);

    await act(async () => poligono(1).fire("mouseout"));
    await esperarOrealceDaLista();
    expect(linha(1).classList.contains("is-realce")).toBe(false);
  });

  /*
    O bug: passar o cursor pelo mapa fazia a lista "piscar". Cada polígono
    atravessado trocava o realce, redesenhava as linhas e rolava a lista até
    a linha do DSEI (`scrollIntoView`). Agora o mouse no mapa não rola, não
    reordena nem remonta a lista; só acende a linha de quem parou nele.
  */
  it("passar o cursor pelo mapa não rola, não reordena nem remonta a lista", async () => {
    await montar();
    const rolar = vi.fn();
    HTMLElement.prototype.scrollIntoView = rolar;
    const lista = host.querySelector(".mapa-si-lista");
    const antes = [...host.querySelectorAll(".mapa-si-territorio")];
    const mudancas = [];
    const observador = new MutationObserver((m) => mudancas.push(...m));
    observador.observe(host.querySelector(".mapa-si-lista__itens"), {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    const resumo = () =>
      mudancas
        .map((m) => [m.type, m.attributeName, m.target.dataset?.numero])
        .sort();

    try {
      // Atravessar polígonos a caminho de outro lugar: a lista fica intacta.
      for (const numero of [34, 16, 1]) {
        await act(async () => poligono(numero).fire("mouseover"));
        await act(async () => poligono(numero).fire("mouseout"));
      }
      await esperarOrealceDaLista();
      expect(resumo()).toEqual([]);

      // Parar num DSEI: só a classe da linha dele muda.
      await act(async () => poligono(34).fire("mouseover"));
      await esperarOrealceDaLista();
      expect(linha(34).classList.contains("is-realce")).toBe(true);
      expect(resumo()).toEqual([["attributes", "class", "34"]]);

      // O inverso: o mouse na lista acende o polígono e só troca a classe das
      // duas linhas envolvidas.
      mudancas.length = 0;
      await act(async () => {
        linha(1).dispatchEvent(
          new MouseEvent("mouseover", { bubbles: true, relatedTarget: null }),
        );
      });
      await act(async () => {});
      expect(poligono(1).elemento.classList.contains("is-realce")).toBe(true);
      expect(resumo()).toEqual([
        ["attributes", "class", "1"],
        ["attributes", "class", "34"],
      ]);

      const depois = [...host.querySelectorAll(".mapa-si-territorio")];
      expect(depois).toHaveLength(antes.length);
      depois.forEach((botao, i) => expect(botao).toBe(antes[i]));
      expect(rolar).not.toHaveBeenCalled();
      expect(lista.scrollTop).toBe(0);
    } finally {
      observador.disconnect();
      delete HTMLElement.prototype.scrollIntoView;
    }
  });

  it("o clique no polígono abre o DSEI, como a linha da lista; a dica traz os números", async () => {
    const aoEscolherDsei = vi.fn();
    await montar({ aoEscolherDsei });
    await act(async () => poligono(34).fire("click"));
    expect(aoEscolherDsei).toHaveBeenCalledWith(LMAP.dsei[1]);
    await clicar(linha(1));
    expect(aoEscolherDsei).toHaveBeenLastCalledWith(LMAP.dsei[0]);
    expect(poligono(34).dica().textContent).toBe(
      "34 · Yanomami — 40 vagas, 30 ociosas, 25% preenchidas",
    );
    expect(poligono(16).dica().textContent).toBe(
      "16 · Leste de Roraima — sem dado",
    );
  });

  /*
    O bug: o interruptor era o chip das fases das terras
    (`.mapa-si-terra-fase`), que desligado (`aria-pressed="false"`) sai
    riscado e esmaecido — e os pontos começam desligados.
  */
  it("'Sedes e CASAIs' é um liga/desliga com aria-pressed, não o chip riscado das fases", async () => {
    await montar();
    const legenda = host.querySelector(".mapa-simples__legenda");
    const pontos = legenda.querySelector(".mapa-simples__pontos");
    expect(pontos.tagName).toBe("BUTTON");
    expect(pontos.textContent).toBe("Sedes e CASAIs");
    expect(pontos.getAttribute("aria-pressed")).toBe("false");
    expect(legenda.querySelector(".mapa-si-terra-fase")).toBeNull();
  });

  /*
    As dicas se acumulavam: o realce subia o próprio polígono
    (`bringToFront`, que reanexa o <path>) no meio do `mouseover`, o
    navegador perdia o `mouseout` e a dica "sticky" não fechava — passando
    o mouse pelo mapa, dez caixas abertas. Agora o polígono não sai do lugar,
    o traço do realce vai num pane próprio e só o DSEI realçado fica com dica.
  */
  it("só o DSEI realçado fica com a dica; o realce não reanexa o polígono", async () => {
    await montar();
    const mapa = mapaVivo();
    const subiu = vi.fn();
    for (const p of poligonos()) {
      p.bringToFront = subiu;
      p.closeTooltip = vi.fn();
    }
    const tracos = () =>
      [...mapa.camadas].filter(
        (c) => c.opcoes?.className === "mapa-simples__realce",
      );

    // Do 34 para o 1 sem `mouseout` no meio (o que o navegador perdia).
    await act(async () => poligono(34).fire("mouseover"));
    for (const p of poligonos()) p.closeTooltip.mockClear();
    await act(async () => poligono(1).fire("mouseover"));
    expect(poligono(34).closeTooltip).toHaveBeenCalled();
    expect(poligono(1).closeTooltip).not.toHaveBeenCalled();
    expect(subiu).not.toHaveBeenCalled();
    expect(tracos()).toHaveLength(1);
    expect(tracos()[0].latlng.properties.numero).toBe(1);
    expect(tracos()[0].opcoes).toMatchObject({
      pane: "agsus-mapa-simples-realce",
      interactive: false,
    });

    await act(async () => poligono(1).fire("mouseout"));
    expect(poligono(1).closeTooltip).toHaveBeenCalled();
    expect(tracos()).toHaveLength(0);
  });

  it("'Sedes e CASAIs' devolve os pontos; voltar ao Mapa tira os polígonos", async () => {
    await montar();
    const mapa = mapaVivo();
    const pontos = host.querySelector(".mapa-simples__pontos");
    expect(pontos.getAttribute("aria-pressed")).toBe("false");
    await clicar(pontos);
    expect(pontos.getAttribute("aria-pressed")).toBe("true");
    expect(leaflet.desenhadas(mapa, "circleMarker").length).toBeGreaterThan(0);

    await act(async () => {
      mapa.elemento.dispatchEvent(
        new CustomEvent(EVENTO_DO_FUNDO, {
          bubbles: true,
          detail: { mode: "map" },
        }),
      );
    });
    expect(poligonos()).toHaveLength(0);
    expect(host.querySelector(".mapa-simples__legenda")).toBeNull();
    expect(host.querySelector(".mapa-si-territorio__numero")).toBeNull();
  });
});
