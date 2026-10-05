import { StrictMode, act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EVENTO_TEMA_ALTERADO } from "../../src/lib/eventos-da-barra-lateral.js";
import { CORES_DO_MAPA } from "../../src/lib/mapa-saude-indigena/formas.js";
import { EVENTO_DAS_TERRAS } from "../../src/modules/indigenous-territories-layer.js";
import { MapaSaudeIndigena } from "../../src/modulos/mapa-saude-indigena/mapa-saude-indigena.jsx";
import { clicar, teclar } from "../componentes/interacoes.js";
import { criarLeafletFalso } from "./leaflet-falso.js";

/*
  O mapa da Saúde Indígena em React (src/modulos/mapa-saude-indigena/), com o
  Leaflet falso: visão nacional (bolhas, CASAIs nacionais, Territórios por
  vagas, legenda, tela cheia), o mapa do DSEI (unidades, filtros por
  tipo, vínculos externos, Terras Indígenas), o contrato com o pai (eventos
  e DSEI controlado), StrictMode limpo, tema e conteúdo sem HTML.
*/

const LMAP = {
  dsei: [
    {
      k: "ALAGOAS E SERGIPE",
      n: "Alagoas e Sergipe",
      lat: -9.6,
      lon: -35.7,
      pop: 12000,
      sedeuf: "AL",
      ufs: ["AL", "SE"],
      polos: [
        { n: "XITEI", lat: -9.9, lon: -36.0, uf: "AL" },
        { n: "LONGE", lat: -8.0, lon: -35.0, uf: "PE" },
      ],
    },
    {
      k: "YANOMAMI",
      n: "Yanomami",
      lat: 2.81,
      lon: -60.67,
      pop: 30000,
      sedeuf: "RR",
      ufs: ["RR", "AM"],
      polos: [],
    },
    {
      k: "LESTE DE RORAIMA",
      n: "Leste de Roraima",
      lat: 2.82,
      lon: -60.67,
      pop: 50000,
      sedeuf: "RR",
      ufs: ["RR"],
      polos: [],
    },
  ],
};

const REDE = {
  rede: {
    "ALAGOAS E SERGIPE": {
      u: [
        ["POLO BASE XITEI", "111", -9.9, -36.0, "TRAIPU", 27],
        [
          "UBSI <img src=x onerror=alert(1)>",
          "222",
          -10.1,
          -36.4,
          "PORTO REAL",
          27,
        ],
      ],
      c: [["CASAI AL/SE", "333", -9.62, -35.73, "MACEIO", 27]],
    },
  },
  nac: [["CASAI DF", "", -15.8, -47.9, "BRASILIA", 53]],
};

const LINHAS = [
  { unidade: "DSEI Alagoas e Sergipe", vagas_total: 10, vagas_ociosas: 1 },
  { unidade: "DSEI Yanomami", vagas_total: 40, vagas_ociosas: 30 },
];

let raiz = null;
let host = null;
let leaflet = null;

function Pai(props) {
  return createElement(
    StrictMode,
    null,
    createElement(MapaSaudeIndigena, {
      lmap: LMAP,
      redeCnes: REDE,
      linhas: LINHAS,
      ...props,
    }),
  );
}

async function montar(props = {}) {
  host = document.createElement("div");
  document.body.append(host);
  raiz = createRoot(host);
  await act(async () => raiz.render(createElement(Pai, props)));
  return host;
}

async function rerender(props) {
  await act(async () => raiz.render(createElement(Pai, props)));
}

/* As bolhas dos DSEIs (sem os pontinhos do leque, que não recebem clique). */
const bolhas = (mapa) =>
  leaflet
    .desenhadas(mapa, "circleMarker")
    .filter((b) => b.opcoes.interactive !== false);

const mapaVivo = (id) =>
  leaflet.vivos().find((m) => m.elemento.id === id) || null;

beforeEach(() => {
  leaflet = criarLeafletFalso();
  globalThis.L = leaflet.L;
});

afterEach(async () => {
  if (raiz) await act(async () => raiz.unmount());
  raiz = null;
  host?.remove();
  host = null;
  delete globalThis.L;
  delete window.matchMedia;
  document.documentElement.removeAttribute("data-theme");
  vi.restoreAllMocks();
});

describe("visão nacional", () => {
  it("cria um mapa só no #map, mesmo com o StrictMode desfazendo e refazendo", async () => {
    await montar();
    expect(leaflet.vivos()).toHaveLength(1);
    expect(leaflet.mapas.length).toBeGreaterThanOrEqual(1);
    expect(leaflet.mapas.filter((m) => m.removido)).toHaveLength(
      leaflet.mapas.length - 1,
    );
    const mapa = mapaVivo("map");
    expect(mapa).not.toBeNull();
    expect(host.querySelectorAll("#map")).toHaveLength(1);
    expect(host.querySelector("#detailMap")).toBeNull();
  });

  it("desenha uma bolha por DSEI e o losango da CASAI nacional", async () => {
    await montar();
    const mapa = mapaVivo("map");
    expect(bolhas(mapa)).toHaveLength(3);
    const casais = leaflet.desenhadas(mapa, "marker");
    expect(casais).toHaveLength(1);
    expect(casais[0].opcoes.title).toBe("CASAI DF");
    expect(casais[0].popup.textContent).toContain(
      "Casa de Saúde Indígena (referência nacional)",
    );
  });

  it("Territórios por vagas: ordem por vagas, contagem e clique que escolhe o DSEI", async () => {
    const aoEscolherDsei = vi.fn();
    await montar({ aoEscolherDsei });
    const itens = [...host.querySelectorAll(".mapa-si-territorio")];
    expect(itens.map((b) => b.querySelector("strong").textContent)).toEqual([
      "Yanomami",
      "Alagoas e Sergipe",
      "Leste de Roraima",
    ]);
    expect(itens[0].getAttribute("aria-label")).toBe(
      "Abrir o DSEI Yanomami: 40 vagas, 25% preenchidas",
    );
    expect(host.textContent).toContain("3 territórios");
    await clicar(itens[1]);
    expect(aoEscolherDsei).toHaveBeenCalledWith(LMAP.dsei[0]);
  });

  it("clicar na bolha escolhe o DSEI; na CASAI nacional, filtra pela busca", async () => {
    const aoEscolherDsei = vi.fn();
    const aoFiltrarPorBusca = vi.fn();
    await montar({ aoEscolherDsei, aoFiltrarPorBusca });
    const mapa = mapaVivo("map");
    const bolha = bolhas(mapa).find((b) => b.latlng[0] === -9.6);
    await act(async () => bolha.fire("click"));
    expect(aoEscolherDsei).toHaveBeenCalledTimes(1);
    const [casai] = leaflet.desenhadas(mapa, "marker");
    await act(async () => casai.fire("click"));
    expect(aoFiltrarPorBusca).toHaveBeenCalledWith("CASAI BRASILIA");
  });

  it("sedes no mesmo pixel abrem em leque, com traço até o ponto real", async () => {
    await montar();
    const mapa = mapaVivo("map");
    const roraima = leaflet
      .desenhadas(mapa, "circleMarker")
      .filter((b) => b.opcoes.radius && Math.abs(b.latlng[1] + 60.67) < 2);
    expect(roraima.length).toBeGreaterThanOrEqual(2);
    expect(
      roraima.some((b) => b.latlng[0] !== 2.81 && b.latlng[0] !== 2.82),
    ).toBe(true);
    expect(leaflet.desenhadas(mapa, "polyline").length).toBeGreaterThanOrEqual(
      2,
    );
    expect(mapa.ouvintes("zoomend")).toBeGreaterThanOrEqual(1);
  });

  it("com filtro ativo, só os DSEIs do recorte e o mapa enquadra neles", async () => {
    await montar({
      filtroAtivo: true,
      linhas: [{ unidade: "DSEI Yanomami", vagas_total: 4, vagas_ociosas: 0 }],
    });
    const mapa = mapaVivo("map");
    expect(bolhas(mapa)).toHaveLength(1);
    expect(leaflet.desenhadas(mapa, "marker")).toHaveLength(0);
    expect(
      mapa.chamadas.some(([nome, , z]) => nome === "setView" && z === 7),
    ).toBe(true);
    expect(host.textContent).toContain("1 território");
  });

  it("sem modo Calor: a bolha é verde com processo e azul sem, e a legenda diz isso", async () => {
    await montar();
    const textos = [...host.querySelectorAll("button")].map(
      (b) => b.textContent,
    );
    expect(textos).not.toContain("Calor");
    const mapa = mapaVivo("map");
    const cores = new Set(bolhas(mapa).map((b) => b.opcoes.fillColor));
    expect([...cores].sort()).toEqual(
      [
        CORES_DO_MAPA.comEdital.preenchimento,
        CORES_DO_MAPA.semEdital.preenchimento,
      ].sort(),
    );
    await clicar(host.querySelector(".mapa-si-legenda__alternar"));
    const legenda = host.querySelector(".mapa-si-legenda").textContent;
    expect(legenda).toContain("DSEI com processo ativo");
    expect(legenda).not.toContain("ociosas");
  });

  it("Brasil volta à vista do país", async () => {
    await montar();
    const mapa = mapaVivo("map");
    const antes = mapa.chamadas.length;
    await clicar(
      [...host.querySelectorAll("button")].find(
        (b) => b.textContent === "Brasil",
      ),
    );
    // O remedir do requestAnimationFrame pode cair no meio (suíte carregada).
    expect(
      mapa.chamadas
        .slice(antes)
        .map(([n]) => n)
        .filter((n) => n !== "invalidateSize"),
    ).toEqual(["stop", "fitBounds"]);
  });

  it("a legenda começa recolhida, também no computador, e abre no botão", async () => {
    // Aberta, ela tapava parte do Sul e do Sudeste no enquadramento do Brasil.
    await montar();
    const alternar = host.querySelector(".mapa-si-legenda__alternar");
    expect(window.innerWidth).toBeGreaterThanOrEqual(1024);
    expect(alternar.getAttribute("aria-expanded")).toBe("false");
    expect(host.querySelector(".mapa-si-legenda__corpo").hidden).toBe(true);
    await clicar(alternar);
    expect(alternar.getAttribute("aria-expanded")).toBe("true");
  });

  it("dica da bolha só com ponteiro que flutua, e sem HTML", async () => {
    window.matchMedia = () => ({ matches: true });
    await montar();
    const mapa = mapaVivo("map");
    const bolha = leaflet
      .desenhadas(mapa, "circleMarker")
      .find((b) => b.dica?.textContent.includes("Alagoas"));
    expect(bolha.dica.textContent).toContain("Polos base: 2");
    expect(bolha.dica.textContent).toContain("No mapa:");
  });

  it("sem o Leaflet (offline), avisa e a lista continua", async () => {
    delete globalThis.L;
    await montar();
    expect(host.textContent).toContain("Mapa indisponível sem conexão");
    expect(host.querySelectorAll(".mapa-si-territorio")).toHaveLength(3);
  });

  it("tela cheia liga e o Esc desliga", async () => {
    await montar();
    const botao = [...host.querySelectorAll("button")].find(
      (b) => b.textContent === "Tela cheia",
    );
    await clicar(botao);
    expect(host.querySelector(".mapa-si--tela-cheia")).not.toBeNull();
    expect(botao.textContent).toBe("Sair da tela cheia");
    expect(document.body.style.overflow).toBe("hidden");
    await teclar(document, "Escape");
    expect(host.querySelector(".mapa-si--tela-cheia")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("abre coordenadas na lateral e volta à lista sem sair da tela cheia", async () => {
    await montar({ perfil: { admin_global: true } });
    const botao = (texto) =>
      [...host.querySelectorAll("button")].find((b) => b.textContent === texto);
    await clicar(botao("Tela cheia"));
    await clicar(botao("Coordenadas"));
    expect(botao("Coordenadas").getAttribute("aria-expanded")).toBe("true");
    expect(
      host.querySelector('[aria-label="Corrigir coordenadas"]'),
    ).not.toBeNull();
    await clicar(botao("Voltar à lista"));
    expect(
      host.querySelector('[aria-label="Corrigir coordenadas"]'),
    ).toBeNull();
    expect(host.querySelectorAll(".mapa-si-territorio")).toHaveLength(3);
    await clicar(botao("Sair da tela cheia"));
    expect(host.querySelector(".mapa-si--tela-cheia")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("restaura a rolagem anterior ao desmontar em tela cheia", async () => {
    document.body.style.overflow = "auto";
    await montar();
    await clicar(
      [...host.querySelectorAll("button")].find(
        (b) => b.textContent === "Tela cheia",
      ),
    );
    await act(async () => raiz.unmount());
    raiz = null;
    expect(document.body.style.overflow).toBe("auto");
    document.body.style.overflow = "";
  });
});

/*
  O enquadramento nacional acompanha o tamanho do contêiner (tela cheia,
  barra lateral, janela) até a pessoa mexer no mapa; "Brasil" volta a
  acompanhar. ResizeObserver e medidas falsos: o jsdom não tem layout.
*/
describe("enquadramento e tamanho do contêiner", () => {
  let observadores;
  let medida;
  const originais = {};

  beforeEach(() => {
    observadores = [];
    medida = { largura: 870, altura: 600 };
    originais.ResizeObserver = globalThis.ResizeObserver;
    originais.raf = globalThis.requestAnimationFrame;
    globalThis.ResizeObserver = class {
      constructor(aoMudar) {
        this.aoMudar = aoMudar;
        observadores.push(this);
      }
      observe() {}
      disconnect() {}
    };
    globalThis.requestAnimationFrame = (fn) => {
      fn();
      return 1;
    };
    for (const [prop, chave] of [
      ["offsetWidth", "largura"],
      ["offsetHeight", "altura"],
    ])
      Object.defineProperty(HTMLElement.prototype, prop, {
        configurable: true,
        get: () => medida[chave],
      });
  });

  afterEach(() => {
    globalThis.ResizeObserver = originais.ResizeObserver;
    globalThis.requestAnimationFrame = originais.raf;
    delete HTMLElement.prototype.offsetWidth;
    delete HTMLElement.prototype.offsetHeight;
  });

  const enquadramentos = (mapa) =>
    mapa.chamadas.filter(([nome]) => nome === "fitBounds");

  async function redimensionar(largura, altura) {
    medida = { largura, altura };
    await act(async () => observadores.forEach((o) => o.aoMudar([])));
  }

  it("o Brasil é enquadrado com folga para a maior bolha (padding >= raio + 12)", async () => {
    await montar();
    const [, , opcoes] = enquadramentos(mapaVivo("map"))[0];
    expect(opcoes.padding[0]).toBeGreaterThanOrEqual(15 + 12);
    expect(opcoes.padding[1]).toBeGreaterThanOrEqual(15 + 12);
  });

  it("reenquadra ao mudar de tamanho (e ao sair da tela cheia) até a pessoa mexer", async () => {
    await montar();
    const mapa = mapaVivo("map");
    mapa.chamadas.length = 0;
    await redimensionar(1170, 600);
    expect(enquadramentos(mapa)).toHaveLength(1);
    mapa.elemento.dispatchEvent(new Event("wheel"));
    mapa.chamadas.length = 0;
    await redimensionar(870, 600);
    expect(enquadramentos(mapa)).toHaveLength(0);
    await clicar(
      [...host.querySelectorAll("button")].find(
        (b) => b.textContent === "Brasil",
      ),
    );
    mapa.chamadas.length = 0;
    await redimensionar(1170, 600);
    expect(enquadramentos(mapa)).toHaveLength(1);
  });
});

describe("mapa do DSEI", () => {
  async function abrirAlse(props = {}) {
    await montar({ dseiSelecionado: "ALAGOAS E SERGIPE", ...props });
    return mapaVivo("detailMap");
  }

  it("com DSEI escolhido, o nacional some e o #detailMap mostra o território", async () => {
    const mapa = await abrirAlse();
    expect(mapa).not.toBeNull();
    expect(host.querySelector(".mapa-si-painel--nacional").hidden).toBe(true);
    expect(host.querySelector("h2#detailMap-titulo").textContent).toBe(
      "Mapa do DSEI Alagoas e Sergipe",
    );
    expect(leaflet.vivos()).toHaveLength(2);
  });

  it("unidades: sede em estrela, polo reconciliado uma vez, UBSI sem HTML", async () => {
    const mapa = await abrirAlse();
    const marcadores = leaflet.desenhadas(mapa, "marker");
    const titulos = marcadores.map((m) => m.opcoes.title);
    expect(titulos).toContain("Sede do DSEI Alagoas e Sergipe");
    expect(titulos.filter((t) => t.includes("XITEI"))).toHaveLength(1);
    const ubsi = marcadores.find((m) => m.opcoes.title.startsWith("UBSI"));
    expect(ubsi.popup.querySelector("img")).toBeNull();
    expect(ubsi.popup.textContent).toContain("<img src=x onerror=alert(1)>");
    expect(ubsi.opcoes.icon.html.querySelector("svg")).not.toBeNull();
    const sede = marcadores.find((m) => m.opcoes.title.startsWith("Sede"));
    expect(sede.opcoes.zIndexOffset).toBe(400);
  });

  it("vínculo fora da área: chip, linha pontilhada e enquadramento completo", async () => {
    const mapa = await abrirAlse();
    expect(host.querySelector(".mapa-si-chip-externo").textContent).toBe(
      "1 vínculo fora da área",
    );
    const linhas = leaflet
      .desenhadas(mapa, "polyline")
      .filter((l) => l.opcoes.dashArray);
    expect(linhas).toHaveLength(1);
    const alternar = [...host.querySelectorAll("button")].find((b) =>
      b.textContent.includes("vínculos externos"),
    );
    const antes = mapa.chamadas.length;
    await clicar(alternar);
    expect(alternar.textContent).toBe("Voltar ao território");
    const [, caixa] = mapa.chamadas
      .slice(antes)
      .find(([nome]) => nome === "fitBounds");
    expect(caixa.pontos).toContainEqual([-8, -35]);
  });

  it("filtros por tipo escondem da lista e do mapa; lista vazia diz por quê", async () => {
    const mapa = await abrirAlse();
    const chips = [...host.querySelectorAll(".mapa-si-filtros button")];
    expect(chips.map((c) => c.textContent)).toEqual([
      "Polo base 2",
      "CASAI 1",
      "UBSI 1",
    ]);
    for (const chip of chips) await clicar(chip);
    expect(chips.every((c) => c.getAttribute("aria-pressed") === "false")).toBe(
      true,
    );
    expect(host.textContent).toContain("Nada a mostrar com estes filtros.");
    const titulos = leaflet
      .desenhadas(mapa, "marker")
      .map((m) => m.opcoes.title);
    expect(titulos).toEqual(["Sede do DSEI Alagoas e Sergipe"]);
  });

  it("clicar na unidade leva o mapa até ela e avisa o pai", async () => {
    const aoEscolherUnidade = vi.fn();
    const mapa = await abrirAlse({ aoEscolherUnidade });
    const botao = [...host.querySelectorAll(".mapa-si-unidade")].find((b) =>
      b.textContent.includes("CASAI AL/SE"),
    );
    await clicar(botao);
    const voo = mapa.chamadas.find(([nome]) => nome === "flyTo");
    expect(voo[1]).toEqual([-9.62, -35.73]);
    expect(voo[2]).toBe(11);
    expect(aoEscolherUnidade).toHaveBeenCalledWith(
      expect.objectContaining({ name: "CASAI AL/SE" }),
    );
  });

  it("'Voltar ao Brasil' só aparece com um DSEI aberto, no topo do painel", async () => {
    await montar();
    expect(host.querySelector(".mapa-si-voltar")).toBeNull();
    await rerender({ dseiSelecionado: "ALAGOAS E SERGIPE" });
    const voltar = host.querySelector(".mapa-si-voltar");
    expect(voltar.textContent).toContain("Voltar ao Brasil");
    expect(voltar.closest(".mapa-si-painel__topo")).not.toBeNull();
  });

  it("'Voltar ao Brasil' pede a saída; o nacional voa do distrito ao Brasil e o foco volta à linha do DSEI", async () => {
    const aoSairDoDsei = vi.fn();
    await abrirAlse({ aoSairDoDsei });
    const nacional = mapaVivo("map");
    await clicar(host.querySelector(".mapa-si-voltar"));
    expect(aoSairDoDsei).toHaveBeenCalledTimes(1);
    nacional.chamadas.length = 0;
    await rerender({ dseiSelecionado: null, aoSairDoDsei });
    expect(mapaVivo("detailMap")).toBeNull();
    expect(host.querySelector(".mapa-si-painel--nacional").hidden).toBe(false);
    const nomes = nacional.chamadas.map(([nome]) => nome);
    // Parte do distrito, sem animar, e voa até o país.
    const partida = nacional.chamadas.find(([nome]) => nome === "setView");
    expect(partida[1]).toEqual([-9.6, -35.7]);
    expect(partida[3]).toEqual({ animate: false });
    expect(nomes.indexOf("setView")).toBeLessThan(nomes.indexOf("flyToBounds"));
    const [, , opcoes] = nacional.chamadas.find(
      ([nome]) => nome === "flyToBounds",
    );
    expect(opcoes.duration).toBe(0.8);
    expect(opcoes.maxZoom).toBe(4.5);
    expect(opcoes.padding[0]).toBeGreaterThanOrEqual(15 + 12);
    expect(nomes).not.toContain("fitBounds");
    expect(document.activeElement.dataset.dsei).toBe("ALAGOAS E SERGIPE");
  });

  it("Esc volta ao Brasil com o foco no mapa, mas não num campo de fora", async () => {
    const aoSairDoDsei = vi.fn();
    await abrirAlse({ aoSairDoDsei });
    const campo = document.createElement("input");
    document.body.append(campo);
    campo.focus();
    await teclar(campo, "Escape");
    expect(aoSairDoDsei).not.toHaveBeenCalled();
    campo.remove();
    host.querySelector(".mapa-si-voltar").focus();
    await teclar(document.activeElement, "Escape");
    expect(aoSairDoDsei).toHaveBeenCalledTimes(1);
    const nacional = mapaVivo("map");
    nacional.chamadas.length = 0;
    await rerender({ dseiSelecionado: null, aoSairDoDsei });
    expect(nacional.chamadas.some(([nome]) => nome === "flyToBounds")).toBe(
      true,
    );
    expect(document.activeElement.dataset.dsei).toBe("ALAGOAS E SERGIPE");
    // Sem DSEI, o Esc não pede nada.
    await teclar(document, "Escape");
    expect(aoSairDoDsei).toHaveBeenCalledTimes(1);
  });

  it("na tela cheia, o 1º Esc volta ao Brasil e o 2º sai da tela cheia", async () => {
    const aoSairDoDsei = vi.fn();
    await abrirAlse({ aoSairDoDsei });
    await clicar(
      [...host.querySelectorAll("button")].find(
        (b) => b.textContent === "Tela cheia",
      ),
    );
    // A tecla nasce no elemento com foco (aqui, nenhum: o body) e, como no
    // navegador, pode ser cancelada.
    const esc = () => teclar(document.body, "Escape", { cancelable: true });
    await esc();
    expect(aoSairDoDsei).toHaveBeenCalledTimes(1);
    expect(host.querySelector(".mapa-si--tela-cheia")).not.toBeNull();
    await rerender({ dseiSelecionado: null, aoSairDoDsei });
    expect(host.querySelector(".mapa-si--tela-cheia")).not.toBeNull();
    await esc();
    expect(host.querySelector(".mapa-si--tela-cheia")).toBeNull();
    expect(aoSairDoDsei).toHaveBeenCalledTimes(1);
  });

  it("com menos movimento (prefers-reduced-motion), volta ao Brasil sem animação", async () => {
    window.matchMedia = (consulta) => ({
      matches: consulta.includes("prefers-reduced-motion"),
    });
    await abrirAlse();
    const nacional = mapaVivo("map");
    nacional.chamadas.length = 0;
    await rerender({ dseiSelecionado: null });
    const nomes = nacional.chamadas.map(([nome]) => nome);
    expect(nomes).not.toContain("flyToBounds");
    expect(nomes).not.toContain("flyTo");
    const [, , opcoes] = nacional.chamadas.find(
      ([nome]) => nome === "fitBounds",
    );
    expect(opcoes.animate).toBe(false);
  });

  it("o pai tirando o DSEI (chip da página) também voa, sem levar o foco", async () => {
    await abrirAlse();
    const nacional = mapaVivo("map");
    nacional.chamadas.length = 0;
    document.body.focus();
    await rerender({ dseiSelecionado: null });
    expect(nacional.chamadas.some(([nome]) => nome === "flyToBounds")).toBe(
      true,
    );
    expect(document.activeElement).toBe(document.body);
  });

  it("Terras Indígenas: recorte pela camada, lista, enquadrar e legenda das fases", async () => {
    const ocultas = new Set();
    leaflet = criarLeafletFalso({
      aoCriarMapa: (m) => {
        m.__agsusSetDseiCoverage = vi.fn();
        m.__agsusEnquadrarTerra = vi.fn();
        m.__agsusFaseDaTerraVisivel = (fase) => !ocultas.has(fase);
        m.__agsusAlternarFaseDaTerra = (fase) => {
          if (ocultas.has(fase)) ocultas.delete(fase);
          else ocultas.add(fase);
          m.fire(EVENTO_DAS_TERRAS);
        };
      },
    });
    globalThis.L = leaflet.L;
    const mapa = await abrirAlse();
    const [nome, pontos, ufs] = mapa.__agsusSetDseiCoverage.mock.calls[0];
    expect(nome).toBe("Alagoas e Sergipe");
    expect(pontos[0]).toEqual({ lat: -9.6, lon: -35.7 });
    expect(ufs).toEqual(["AL", "SE"]);

    await act(async () =>
      mapa.__agsusAoMudarTerras([
        {
          nome: "Xucuru-Kariri",
          povos: [],
          ufs: ["AL"],
          fase: "Regularizada",
          caixa: { oeste: -37, sul: -10, leste: -36, norte: -9 },
        },
      ]),
    );
    const terra = host.querySelector(".mapa-si-terra");
    expect(terra.textContent).toContain("povo não declarado pela Funai");
    await clicar(terra);
    expect(mapa.__agsusEnquadrarTerra).toHaveBeenCalledWith("Xucuru-Kariri", {
      oeste: -37,
      sul: -10,
      leste: -36,
      norte: -9,
    });

    const fase = host.querySelector(
      ".mapa-si-legenda--rodape .mapa-si-terra-fase",
    );
    expect(fase.getAttribute("aria-pressed")).toBe("true");
    await clicar(fase);
    expect(fase.getAttribute("aria-pressed")).toBe("false");
  });

  it("o nacional não enquadra escondido; ao voltar, enquadra com a medida nova", async () => {
    await montar({
      dseiSelecionado: "ALAGOAS E SERGIPE",
      filtroAtivo: true,
      linhas: [LINHAS[0]],
    });
    const nacional = mapaVivo("map");
    const antes = nacional.chamadas.length;
    expect(nacional.chamadas.some(([n]) => n === "setView")).toBe(false);
    await rerender({ dseiSelecionado: null });
    const depois = nacional.chamadas.slice(antes).map(([n]) => n);
    // Remede antes de partir do distrito e voar até o Brasil.
    expect(depois.indexOf("invalidateSize")).toBeGreaterThanOrEqual(0);
    expect(depois.indexOf("invalidateSize")).toBeLessThan(
      depois.indexOf("setView"),
    );
    expect(depois).toContain("flyToBounds");
  });

  it("desmontar remove os dois mapas", async () => {
    await abrirAlse();
    expect(leaflet.vivos()).toHaveLength(2);
    await act(async () => raiz.unmount());
    raiz = null;
    expect(leaflet.vivos()).toHaveLength(0);
  });
});

describe("tema", () => {
  it("segue o tema do app e aceita o tema forçado pelo pai", async () => {
    await montar();
    expect(host.querySelector(".mapa-si--escuro")).toBeNull();
    await act(async () => {
      document.documentElement.setAttribute("data-theme", "dark");
      document.dispatchEvent(new Event(EVENTO_TEMA_ALTERADO));
    });
    expect(host.querySelector(".mapa-si--escuro")).not.toBeNull();
    await rerender({ tema: "claro" });
    expect(host.querySelector(".mapa-si--escuro")).toBeNull();
  });
});

/*
  "O mapa quebra o nome quando passo o mouse ou clico em algum extremo": a
  dica centrada acima de um ponto na borda saía do contêiner do mapa. Os dois
  mapas (nacional e do DSEI) ligam src/lib/dica-dentro-do-mapa.js.
*/
describe("dicas e popups dentro do mapa", () => {
  /* Mede como o navegador: contêiner 600 × 400, dica 268 × 58. */
  function comMedidas(mapa, caixaDaDica) {
    const moldura = mapa.elemento;
    Object.defineProperty(moldura, "clientWidth", { value: 600 });
    Object.defineProperty(moldura, "clientHeight", { value: 400 });
    moldura.getBoundingClientRect = () => ({ left: 0, top: 0 });
    const elemento = document.createElement("div");
    elemento.getBoundingClientRect = () => caixaDaDica;
    return {
      elemento,
      options: { direction: "top" },
      getElement: () => elemento,
      getLatLng: () => [-6.9, -35.1],
      setLatLng: vi.fn(),
    };
  }

  it("a dica de um DSEI na borda leste vai para o lado em vez de ser cortada", async () => {
    window.matchMedia = () => ({ matches: true });
    await montar();
    const mapa = mapaVivo("map");
    expect(mapa.ouvintes("tooltipopen")).toBe(1);
    // Centrada acima de um ponto a 10 px da borda direita (x = 590).
    const dica = comMedidas(mapa, {
      left: 590 - 134,
      top: 200 - 6 - 58,
      width: 268,
      height: 58,
    });
    await act(async () => mapa.fire("tooltipopen", { tooltip: dica }));
    expect(dica.options.direction).toBe("left");
    expect(dica.setLatLng).toHaveBeenCalled();
    expect(dica.elemento.classList.contains("dica-no-mapa")).toBe(true);
  });

  it("no meio do mapa a dica continua em cima", async () => {
    window.matchMedia = () => ({ matches: true });
    await montar();
    const mapa = mapaVivo("map");
    const dica = comMedidas(mapa, {
      left: 300 - 134,
      top: 200 - 6 - 58,
      width: 268,
      height: 58,
    });
    await act(async () => mapa.fire("tooltipopen", { tooltip: dica }));
    expect(dica.options.direction).toBe("top");
  });

  it("popups com autoPan e largura relativa ao mapa, também no mapa do DSEI", async () => {
    await montar({ dseiSelecionado: "ALAGOAS E SERGIPE" });
    const mapa = mapaVivo("detailMap");
    expect(mapa.ouvintes("popupopen")).toBe(1);
    const [unidade] = leaflet.desenhadas(mapa, "marker");
    expect(unidade.opcoesDoPopup).toMatchObject({
      autoPan: true,
      keepInView: false,
      className: "popup-no-mapa",
    });
    // Aberto num mapa estreito (celular), o popup encolhe e refaz o autoPan.
    Object.defineProperty(mapa.elemento, "clientWidth", { value: 343 });
    Object.defineProperty(mapa.elemento, "clientHeight", { value: 360 });
    const popup = { options: { maxWidth: 300 }, update: vi.fn() };
    await act(async () => mapa.fire("popupopen", { popup }));
    expect(popup.options.maxWidth).toBeLessThan(343);
    expect(popup.options.maxHeight).toBeLessThan(360);
    expect(popup.update).toHaveBeenCalledTimes(1);
  });

  it("a CASAI nacional também abre o popup com autoPan", async () => {
    await montar();
    const [casai] = leaflet.desenhadas(mapaVivo("map"), "marker");
    expect(casai.opcoesDoPopup).toMatchObject({ autoPan: true });
  });
});
