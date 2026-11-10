import { StrictMode, act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { esquecerContornosDosDseis } from "../../src/lib/mapa-saude-indigena/contornos-dos-dseis.ts";
import { ordenarTerritorios } from "../../src/lib/mapa-saude-indigena/ordem-dos-territorios.ts";
import { EVENTO_DO_FUNDO } from "../../src/modules/map-base-layer-switcher.ts";
import { MapaSaudeIndigena } from "../../src/modulos/mapa-saude-indigena/mapa-saude-indigena.tsx";
import { CHAVE_DA_ORDEM } from "../../src/modulos/mapa-saude-indigena/ordem-da-lista.tsx";
import { escolher, esperar } from "../componentes/interacoes.ts";
import { criarLeafletFalso } from "./leaflet-falso.js";

/*
  "Ordenar" da lista de territórios ao lado do mapa nacional da Saúde
  Indígena: cada ordem, o título que acompanha, o padrão por fundo (Vagas no
  Mapa, Nº do DSEI no Mapa DSEIs) e a escolha guardada no navegador, que
  passa a valer para os dois.
*/

const dsei = (k, n, lat, lon, pop) => ({
  k,
  n,
  lat,
  lon,
  pop,
  ufs: [],
  polos: [],
});

const LMAP = {
  dsei: [
    dsei("ALAGOAS E SERGIPE", "Alagoas e Sergipe", -9.6, -35.7, 12000),
    dsei("YANOMAMI", "Yanomami", 2.81, -60.67, 30000),
    dsei("LESTE DE RORAIMA", "Leste de Roraima", 2.82, -60.67, 50000),
  ],
};

/*
  Vagas: Yanomami 40 (30 ociosas, 25%), Alagoas e Sergipe 10 (1 ociosa, 90%),
  Leste de Roraima sem vaga. Números do mapa: 1, 16 e 34.
*/
const LINHAS = [
  {
    unidade: "DSEI Alagoas e Sergipe",
    vagas_total: 10,
    contratados: 9,
    status: "Concluído",
  },
  {
    unidade: "DSEI Yanomami",
    vagas_total: 40,
    contratados: 10,
    status: "Concluído",
  },
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
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [x, y],
          [x + 1, y],
          [x + 1, y + 1],
          [x, y + 1],
          [x, y],
        ],
      ],
    },
  })),
};

let raiz = null;
let host = null;
let leaflet = null;

function preparar({ simples = false } = {}) {
  leaflet = criarLeafletFalso(
    simples
      ? {
          aoCriarMapa: (m) => {
            m.__agsusDesiredBaseMapMode = "simple";
          },
        }
      : {},
  );
  globalThis.L = leaflet.L;
}

async function montar() {
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
          redeCnes: { rede: {}, nac: [] },
          linhas: LINHAS,
        }),
      ),
    ),
  );
  await esperar();
  return host;
}

const nomes = () =>
  [...host.querySelectorAll(".mapa-si-territorio strong")].map(
    (s) => s.textContent,
  );
const titulo = () => host.querySelector("#map-lista").textContent;
const seletor = () => host.querySelector(".mapa-si-lista__ordem select");
const mapaVivo = () => leaflet.vivos().find((m) => m.elemento.id === "map");

async function trocarFundo(mode) {
  await act(async () => {
    mapaVivo().elemento.dispatchEvent(
      new CustomEvent(EVENTO_DO_FUNDO, { bubbles: true, detail: { mode } }),
    );
  });
}

beforeEach(() => {
  localStorage.clear();
  esquecerContornosDosDseis();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => CONTORNOS })),
  );
});

afterEach(async () => {
  if (raiz) await act(async () => raiz.unmount());
  raiz = null;
  host?.remove();
  host = null;
  delete globalThis.L;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("Ordenar a lista de territórios", () => {
  it("o seletor é um select com rótulo acessível e as cinco ordens", async () => {
    preparar();
    await montar();
    const select = seletor();
    expect(select.getAttribute("aria-label")).toBe("Ordenar os territórios");
    expect([...select.options].map((o) => o.textContent)).toEqual([
      "Vagas",
      "A–Z",
      "Nº do DSEI",
      "% preenchidas",
      "Ociosas",
    ]);
  });

  it("no Mapa, o padrão é por vagas", async () => {
    preparar();
    await montar();
    expect(seletor().value).toBe("vagas");
    expect(titulo()).toBe("Territórios por vagas");
    expect(nomes()).toEqual([
      "Yanomami",
      "Alagoas e Sergipe",
      "Leste de Roraima",
    ]);
    expect(localStorage.getItem(CHAVE_DA_ORDEM)).toBeNull();
  });

  it.each([
    [
      "alfabetica",
      "Territórios — A–Z",
      ["Alagoas e Sergipe", "Leste de Roraima", "Yanomami"],
    ],
    [
      "numero",
      "Territórios por nº do DSEI",
      ["Alagoas e Sergipe", "Leste de Roraima", "Yanomami"],
    ],
    [
      "preenchidas",
      "Territórios por % preenchidas",
      ["Alagoas e Sergipe", "Yanomami", "Leste de Roraima"],
    ],
    [
      "ociosas",
      "Territórios por vagas ociosas",
      ["Yanomami", "Alagoas e Sergipe", "Leste de Roraima"],
    ],
    [
      "vagas",
      "Territórios por vagas",
      ["Yanomami", "Alagoas e Sergipe", "Leste de Roraima"],
    ],
  ])(
    "ordem %s: título e linhas acompanham",
    async (ordem, esperado, linhas) => {
      preparar();
      await montar();
      await escolher(seletor(), ordem);
      expect(titulo()).toBe(esperado);
      expect(nomes()).toEqual(linhas);
      // Fora do Mapa DSEIs, o número da linha é a posição na nova ordem.
      expect(
        [...host.querySelectorAll(".mapa-si-territorio__posicao")].map(
          (p) => p.textContent,
        ),
      ).toEqual(["1", "2", "3"]);
    },
  );

  it("no Mapa DSEIs, o padrão é pelo nº do DSEI; ao voltar ao Mapa, por vagas", async () => {
    preparar({ simples: true });
    await montar();
    await vi.waitFor(() =>
      expect(host.querySelector(".mapa-si-territorio__numero")).not.toBeNull(),
    );
    expect(seletor().value).toBe("numero");
    expect(titulo()).toBe("Territórios por nº do DSEI");
    expect(
      [...host.querySelectorAll(".mapa-si-territorio")].map(
        (b) => b.dataset.numero,
      ),
    ).toEqual(["1", "16", "34"]);

    await trocarFundo("map");
    expect(seletor().value).toBe("vagas");
    expect(nomes()).toEqual([
      "Yanomami",
      "Alagoas e Sergipe",
      "Leste de Roraima",
    ]);
  });

  it("guarda a escolha no navegador, e ela vale para os dois fundos", async () => {
    preparar();
    await montar();
    await escolher(seletor(), "alfabetica");
    expect(localStorage.getItem(CHAVE_DA_ORDEM)).toBe("alfabetica");

    await trocarFundo("simple");
    expect(seletor().value).toBe("alfabetica");
    expect(titulo()).toBe("Territórios — A–Z");

    // Montado de novo (outra visita), a escolha volta.
    await act(async () => raiz.unmount());
    raiz = null;
    host.remove();
    preparar({ simples: true });
    await montar();
    expect(seletor().value).toBe("alfabetica");
    expect(nomes()).toEqual([
      "Alagoas e Sergipe",
      "Leste de Roraima",
      "Yanomami",
    ]);
  });

  it("sem armazenamento, a escolha vale até recarregar", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    preparar();
    await montar();
    expect(seletor().value).toBe("vagas");
    await escolher(seletor(), "ociosas");
    expect(seletor().value).toBe("ociosas");
  });
});

describe("ordenarTerritorios", () => {
  const t = (n, vagas, ociosas) => ({
    dsei: { k: n.toUpperCase(), n },
    chave: n,
    vagas,
    ociosas,
    preenchidas: vagas ? Math.round(((vagas - ociosas) / vagas) * 100) : 0,
    posicao: 0,
  });

  it("A–Z respeita os acentos do português", () => {
    const lista = [
      t("Médio Rio Purus", 1, 0),
      t("Xavante", 1, 0),
      t("Maranhão", 1, 0),
      t("Manaus", 1, 0),
    ];
    expect(
      ordenarTerritorios(lista, "alfabetica").map((x) => x.dsei.n),
    ).toEqual(["Manaus", "Maranhão", "Médio Rio Purus", "Xavante"]);
  });

  it("empate: desempata pelo nome", () => {
    const lista = [t("Xingu", 10, 5), t("Bahia", 4, 2), t("Ceará", 10, 5)];
    expect(ordenarTerritorios(lista, "ociosas").map((x) => x.dsei.n)).toEqual([
      "Ceará",
      "Xingu",
      "Bahia",
    ]);
    expect(
      ordenarTerritorios(lista, "preenchidas").map((x) => x.dsei.n),
    ).toEqual(["Bahia", "Ceará", "Xingu"]);
  });

  it("'Vagas' mantém a ordem de chegada e não muda a lista original", () => {
    const lista = [t("Xingu", 10, 5), t("Bahia", 4, 2)];
    const copia = [...lista];
    expect(ordenarTerritorios(lista, "vagas")).toEqual(lista);
    ordenarTerritorios(lista, "alfabetica");
    expect(lista).toEqual(copia);
  });
});
