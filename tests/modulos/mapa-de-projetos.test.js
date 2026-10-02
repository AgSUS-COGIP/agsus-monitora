import { readFileSync } from "node:fs";
import { StrictMode, act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EVENTO_TEMA_ALTERADO } from "../../src/lib/eventos-da-barra-lateral.js";
import {
  CACHE_TTL_MS,
  RPC_DOS_MUNICIPIOS,
  criarCarregadorDeMunicipios,
} from "../../src/modulos/mapa-de-projetos/carregador.js";
import { MapaDeProjetos } from "../../src/modulos/mapa-de-projetos/mapa-de-projetos.jsx";
import {
  clicar,
  escolher,
  esperar,
  teclar,
} from "../componentes/interacoes.js";
import { criarLeafletFalso } from "./leaflet-falso.js";

/*
  O mapa de Projetos em React (src/modulos/mapa-de-projetos/), irmão do da
  Saúde Indígena, com o Leaflet falso: a carga (um pedido por área, cache),
  um ponto por lugar na cor do projeto (UF no meio do estado), a lista
  "Municípios por vagas" com filtro e agrupamento por projeto, popup e dica
  em DOM, legenda, Brasil, tela cheia, tema, StrictMode limpo e nada de HTML
  em texto.
*/

const normalizar = (texto) => texto.replace(/\s+/g, " ").trim();

function supabaseFalso(resposta) {
  return {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "teste" } },
        error: null,
      }),
    },
    rpc: vi.fn(async () => resposta),
  };
}

const SIMPLES = {
  data: [
    {
      municipio_uf: "Irati/PR",
      vagas: 5,
      candidatos: 70,
      aprovados: 43,
      reprovados: 27,
    },
    {
      municipio_uf: "Seropédica/RJ",
      vagas: 12,
      candidatos: 647,
      aprovados: 0,
      reprovados: 0,
    },
    { municipio_uf: "Lugar Novo/AM", vagas: 1, candidatos: 3 },
  ],
  error: null,
};

const PROJETOS = {
  data: [
    {
      municipio_uf: "Boa Vista/RR",
      uf: "RR",
      codigo_ibge: 1400100,
      vagas_edital: 38,
      projetos: ["Saúde nas Fronteiras", "Escritório Distrital e Regional"],
      editais: [
        {
          edital: "23/2025",
          projeto: "Saúde nas Fronteiras",
          vagas: 22,
          lotacoes: ["Boa Vista/RR"],
        },
        {
          edital: "62/2025",
          projeto: "Escritório Distrital e Regional",
          vagas: 16,
        },
      ],
    },
    {
      municipio_uf: "Brasília/DF",
      uf: "DF",
      codigo_ibge: 5300108,
      vagas_edital: 5,
      cadastro_reserva: true,
      projetos: ["MFC", "Rio Doce"],
      editais: [
        { edital: "05/2026", projeto: "MFC", vagas: 5 },
        {
          edital: "04/2026",
          projeto: "Rio Doce",
          vagas: null,
          cadastro_reserva: true,
        },
      ],
    },
    {
      municipio_uf: null,
      uf: "PA",
      nivel: "uf",
      vagas_edital: 1,
      projetos: ["CCE"],
      editais: [{ edital: "97/2025", projeto: "CCE", vagas: 1 }],
    },
    {
      municipio_uf: "Irati/PR",
      uf: "PR",
      vagas: 5,
      candidatos: 70,
      aprovados: 43,
      reprovados: 27,
      projetos: ["Projeto Agora Tem Especialistas Caminhoneiros"],
      editais: [
        {
          edital: "30/2026",
          projeto: "Projeto Agora Tem Especialistas Caminhoneiros",
          cadastro_reserva: true,
        },
      ],
    },
  ],
  error: null,
};

// ── Carga ────────────────────────────────────────────────────────────────

describe("carga dos municípios", () => {
  it("um pedido por área, guardado pelo tempo do cache", async () => {
    let agora = 0;
    const supabase = supabaseFalso(SIMPLES);
    const carregador = criarCarregadorDeMunicipios({
      obterSupabase: () => supabase,
      relogio: () => agora,
    });
    const [a, b] = await Promise.all([
      carregador.carregar("projetos"),
      carregador.carregar("projetos"),
    ]);
    expect(a).toBe(b);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith(RPC_DOS_MUNICIPIOS, {
      p_area: "projetos",
    });
    expect(a.municipios).toHaveLength(3);
    expect(carregador.emCache("projetos")).toBe(a);
    await carregador.carregar("projetos");
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    agora = CACHE_TTL_MS + 1;
    expect(carregador.emCache("projetos")).toBeNull();
    await carregador.carregar("projetos");
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });

  it("banco sem a função não é erro; erro não fica guardado", async () => {
    const semFuncao = criarCarregadorDeMunicipios({
      obterSupabase: () =>
        supabaseFalso({ data: null, error: { code: "PGRST202" } }),
    });
    expect(await semFuncao.carregar("projetos")).toMatchObject({
      indisponivel: true,
      erro: "",
    });
    const comErro = criarCarregadorDeMunicipios({
      obterSupabase: () =>
        supabaseFalso({ data: null, error: { message: "falhou" } }),
    });
    expect((await comErro.carregar("projetos")).erro).toBe("falhou");
    expect(comErro.emCache("projetos")).toBeNull();
    const semCliente = criarCarregadorDeMunicipios();
    expect((await semCliente.carregar("projetos")).erro).toBe("Sem conexão.");
  });

  it("guarda a escolha da lista enquanto vive", () => {
    const carregador = criarCarregadorDeMunicipios();
    expect(carregador.obterEscolha()).toEqual({ projeto: "", agrupar: false });
    carregador.guardarEscolha({ agrupar: true });
    carregador.guardarEscolha({ projeto: "MFC" });
    expect(carregador.obterEscolha()).toEqual({
      projeto: "MFC",
      agrupar: true,
    });
  });
});

// ── Componente ───────────────────────────────────────────────────────────

let raiz = null;
let host = null;
let leaflet = null;

async function carregadorCom(resposta) {
  const supabase = supabaseFalso(resposta);
  const carregador = criarCarregadorDeMunicipios({
    obterSupabase: () => supabase,
  });
  // Já em cache: o componente desenha na primeira renderização.
  await esperar(() => carregador.carregar("projetos"));
  return { carregador, supabase };
}

function Pai(props) {
  return createElement(
    StrictMode,
    null,
    createElement(MapaDeProjetos, {
      area: "projetos",
      carregadoEm: 1,
      ...props,
    }),
  );
}

async function montar(props) {
  host = document.createElement("div");
  document.body.append(host);
  raiz = createRoot(host);
  await act(async () => raiz.render(createElement(Pai, props)));
  return host;
}

async function rerender(props) {
  await act(async () => raiz.render(createElement(Pai, props)));
}

async function desmontar() {
  if (raiz) await act(async () => raiz.unmount());
  raiz = null;
  host?.remove();
  host = null;
}

const mapaVivo = () =>
  leaflet.vivos().find((m) => m.elemento.id === "mapaDosProjetos") || null;
const pontos = () => leaflet.desenhadas(mapaVivo(), "circleMarker");
const linhas = () => [...host.querySelectorAll(".mapa-projetos-lugar")];
const nomes = () =>
  linhas().map((linha) => linha.querySelector("strong").textContent);
const botao = (texto) =>
  [...host.querySelectorAll("button")].find(
    (b) => normalizar(b.textContent) === texto,
  );

beforeEach(() => {
  leaflet = criarLeafletFalso();
  globalThis.L = leaflet.L;
});

afterEach(async () => {
  await desmontar();
  delete globalThis.L;
  delete window.matchMedia;
  document.documentElement.removeAttribute("data-theme");
  vi.restoreAllMocks();
});

describe("o mapa", () => {
  it("um mapa só no #mapaDosProjetos, enquadrado no Brasil, mesmo com o StrictMode", async () => {
    const { carregador } = await carregadorCom(SIMPLES);
    await montar({ carregador });
    expect(leaflet.vivos()).toHaveLength(1);
    expect(leaflet.mapas.filter((m) => m.removido)).toHaveLength(
      leaflet.mapas.length - 1,
    );
    const mapa = mapaVivo();
    expect(host.querySelectorAll("#mapaDosProjetos")).toHaveLength(1);
    expect(host.querySelector("#map, #detailMap")).toBeNull();
    expect(mapa.chamadas[0][0]).toBe("fitBounds");
    // Fundo, contorno do Brasil e divisas das UFs.
    expect([...mapa.camadas].some((c) => c.tipo === "tileLayer")).toBe(true);
    expect(leaflet.desenhadas(mapa, "geoJSON")).toHaveLength(2);
    // Dicas e popups ficam dentro do mapa (src/lib/dica-dentro-do-mapa.js).
    expect(mapa.ouvintes("tooltipopen")).toBe(1);
    expect(mapa.ouvintes("popupopen")).toBe(1);
    // Desmontar remove o Leaflet.
    await desmontar();
    expect(leaflet.vivos()).toHaveLength(0);
  });

  it("antes da primeira carga da página não pede nada e mostra o esqueleto", async () => {
    const supabase = supabaseFalso(SIMPLES);
    const carregador = criarCarregadorDeMunicipios({
      obterSupabase: () => supabase,
    });
    await montar({ carregador, carregadoEm: 0 });
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(host.querySelector(".mapa-si-lista__esqueleto")).not.toBeNull();
    expect(host.querySelector(".mapa-si-painel__contagem").textContent).toBe(
      "…",
    );
    // A página carregou: pede uma vez e desenha.
    await rerender({ carregador, carregadoEm: 1 });
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(nomes()).toHaveLength(3);
    // Atualizar dados com o cache fresco não vai ao banco.
    await rerender({ carregador, carregadoEm: 2 });
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(nomes()).toHaveLength(3);
  });

  it("um ponto por município com coordenada e a lista por vagas", async () => {
    const { carregador } = await carregadorCom(SIMPLES);
    await montar({ carregador });
    expect(pontos()).toHaveLength(2);
    expect(host.querySelector(".mapa-si-painel__contagem").textContent).toBe(
      "3 municípios",
    );
    expect(host.querySelector(".mapa-si-lista__topo b").textContent).toBe("3");
    expect(nomes()).toEqual(["Seropédica/RJ", "Irati/PR", "Lugar Novo/AM"]);
    const [seropedica, irati, novo] = linhas();
    // Mesmo formato de "Territórios por vagas": posição, nome, vagas, barra.
    expect(irati.classList).toContain("mapa-si-territorio");
    expect(
      irati.querySelector(".mapa-si-territorio__posicao").textContent,
    ).toBe("2");
    expect(normalizar(irati.textContent)).toContain("5 vagas");
    expect(normalizar(irati.textContent)).toContain("70 candidatos");
    expect(
      irati.querySelector(".mapa-projetos-lugar__resultado i").style.width,
    ).toBe("61%");
    expect(normalizar(irati.textContent)).toContain("61% aprovados");
    expect(irati.getAttribute("aria-label")).toBe(
      "Irati/PR, 5 vagas, 70 candidatos, 61% aprovados",
    );
    // Sem nenhuma análise decidida, sem barra; sem coordenada, sem clique.
    expect(
      seropedica.querySelector(".mapa-projetos-lugar__resultado"),
    ).toBeNull();
    expect(novo.disabled).toBe(true);
    expect(normalizar(novo.textContent)).toContain("sem coordenada no mapa");
    // A lista leva ao ponto: aproxima e abre o popup.
    const mapa = mapaVivo();
    mapa.chamadas.length = 0;
    await clicar(irati);
    expect(mapa.chamadas).toContainEqual([
      "setView",
      [-25.4697, -50.6493],
      7,
      { animate: true },
    ]);
    const marcador = pontos().find((p) => p.latlng[0] === -25.4697);
    expect(marcador.popupAberto).toBe(true);
  });

  it("enquadra os pontos na primeira carga", async () => {
    const { carregador } = await carregadorCom(SIMPLES);
    await montar({ carregador });
    const enquadramentos = mapaVivo().chamadas.filter(
      ([nome, , opcoes]) => nome === "fitBounds" && opcoes?.maxZoom === 7,
    );
    expect(enquadramentos).toHaveLength(1);
    expect(enquadramentos[0][1].pontos).toHaveLength(2);
  });

  it("o botão Brasil volta ao país inteiro", async () => {
    const { carregador } = await carregadorCom(SIMPLES);
    await montar({ carregador });
    const mapa = mapaVivo();
    mapa.chamadas.length = 0;
    await clicar(botao("Brasil"));
    expect(mapa.chamadas.map(([nome]) => nome)).toEqual(["stop", "fitBounds"]);
  });

  it("escapa o nome do município (lista, dica e popup)", async () => {
    window.matchMedia = () => ({ matches: true });
    const { carregador } = await carregadorCom({
      data: [
        {
          municipio_uf: '<img src=x onerror="alert(1)">/XX',
          uf: "RR",
          codigo_ibge: 1400100,
          editais: [{ edital: "<b>1</b>", projeto: "<script>x</script>" }],
        },
      ],
      error: null,
    });
    await montar({ carregador });
    expect(host.querySelector("img, script")).toBeNull();
    expect(nomes()[0]).toContain("<img");
    for (const ponto of pontos()) {
      expect(ponto.popup.querySelector("img, script")).toBeNull();
      expect(ponto.dica.querySelector("img, script")).toBeNull();
    }
  });

  it("sem Leaflet (offline) a lista continua", async () => {
    delete globalThis.L;
    const { carregador } = await carregadorCom(SIMPLES);
    await montar({ carregador });
    expect(host.textContent).toContain("Mapa indisponível sem conexão");
    expect(nomes()).toHaveLength(3);
  });

  it("banco sem a função e erro: uma linha na lista, sem filtros", async () => {
    const { carregador } = await carregadorCom({
      data: null,
      error: { code: "PGRST202" },
    });
    await montar({ carregador });
    expect(host.textContent).toContain(
      "Municípios indisponíveis: falta uma atualização do banco.",
    );
    await desmontar();
    const comErro = await carregadorCom({
      data: null,
      error: { message: "falhou" },
    });
    await montar({ carregador: comErro.carregador });
    expect(host.textContent).toContain(
      "Não foi possível carregar os municípios.",
    );
    expect(host.querySelector(".mapa-projetos__filtros")).toBeNull();
  });
});

describe("todos os projetos no mapa", () => {
  it("um ponto por lugar, na cor do projeto, e UF no meio do estado", async () => {
    const { carregador } = await carregadorCom(PROJETOS);
    await montar({ carregador });
    expect(pontos()).toHaveLength(4);
    // Irati e Brasília empatam em 5 vagas: os candidatos desempatam.
    expect(nomes()).toEqual([
      "Boa Vista/RR",
      "Irati/PR",
      "Brasília/DF",
      "Pará (estado)",
    ]);
    const classe = (indice) => pontos()[indice].opcoes.className;
    // Boa Vista: Fronteiras (série 2) e mais um projeto (contorno tracejado).
    expect(classe(0)).toBe(
      "marcador-de-projeto marcador-de-projeto--2 is-varios-projetos",
    );
    expect(classe(1)).toBe("marcador-de-projeto marcador-de-projeto--1");
    // Brasília: Rio Doce (série 4) vem antes de MFC (série 5).
    expect(classe(2)).toBe(
      "marcador-de-projeto marcador-de-projeto--4 is-varios-projetos",
    );
    expect(classe(3)).toBe("marcador-de-projeto marcador-de-projeto--6");
    // Popup montado no DOM: projeto, edital, vagas, lotação.
    const popup = pontos()[0].popup;
    expect(popup).toBeInstanceOf(HTMLElement);
    expect(normalizar(popup.textContent)).toContain(
      "Saúde nas Fronteiras · Edital 23/2025 · 22 vagas · Boa Vista/RR",
    );
    expect(popup.querySelector(".mapa-projeto__cor--3")).not.toBeNull();
    expect(pontos()[0].opcoesDoPopup.autoPan).toBe(true);
    // A linha da lista diz os projetos e as vagas publicadas.
    const primeira = linhas()[0];
    expect(normalizar(primeira.textContent)).toContain("38 vagas");
    expect(
      [...primeira.querySelectorAll(".mapa-projetos-lugar__projeto")].map(
        (projeto) => normalizar(projeto.textContent),
      ),
    ).toEqual(["Saúde nas Fronteiras", "Escritório Distrital e Regional"]);
  });

  it("dica só onde há ponteiro que flutua; ela fecha quando o popup abre", async () => {
    const { carregador } = await carregadorCom(PROJETOS);
    await montar({ carregador });
    expect(pontos()[0].dica).toBeUndefined();
    await desmontar();
    window.matchMedia = () => ({ matches: true });
    await montar({ carregador });
    const [ponto] = pontos();
    expect(ponto.dica).toBeInstanceOf(HTMLElement);
    expect(ponto.dica).not.toBe(ponto.popup);
    expect(ponto.ouvintes("popupopen")).toBe(1);
  });

  it("a legenda começa recolhida e mostra a cor e o nome de cada projeto", async () => {
    const { carregador } = await carregadorCom(PROJETOS);
    await montar({ carregador });
    const corpo = host.querySelector(".mapa-si-legenda__corpo");
    // Recolhida também no computador: aberta, tapava o Sul e o Sudeste.
    expect(corpo.hidden).toBe(true);
    await clicar(host.querySelector(".mapa-si-legenda__alternar"));
    expect(corpo.hidden).toBe(false);
    const itens = [...corpo.querySelectorAll(".mapa-si-legenda__item")];
    expect(itens.map((item) => normalizar(item.textContent))).toEqual([
      "Caminhoneiros",
      "Saúde nas Fronteiras",
      "Escritório Distrital e Regional",
      "Rio Doce",
      "MFC",
      "CCE",
      "tamanho = nº de vagas",
      "mais de um projeto",
    ]);
    expect(itens[0].querySelector(".mapa-projeto__cor--1")).not.toBeNull();
  });

  it("filtrar por projeto redesenha sem novo pedido, mantém a cor e reenquadra", async () => {
    const { carregador, supabase } = await carregadorCom(PROJETOS);
    await montar({ carregador });
    const seletor = host.querySelector(".mapa-projetos__seletor");
    expect([...seletor.options].map((opcao) => opcao.textContent)).toEqual([
      "Todos os projetos",
      "Caminhoneiros (1)",
      "Saúde nas Fronteiras (1)",
      "Escritório Distrital e Regional (1)",
      "Rio Doce (1)",
      "MFC (1)",
      "CCE (1)",
    ]);
    const mapa = mapaVivo();
    mapa.chamadas.length = 0;
    await escolher(seletor, "Escritório Distrital e Regional");
    expect(nomes()).toEqual(["Boa Vista/RR"]);
    expect(pontos()).toHaveLength(1);
    expect(pontos()[0].opcoes.className).toBe(
      "marcador-de-projeto marcador-de-projeto--3",
    );
    expect(host.querySelector(".mapa-si-painel__contagem").textContent).toBe(
      "1 município",
    );
    expect(mapa.chamadas.some(([nome]) => nome === "fitBounds")).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    // O campo é o mesmo: o foco não se perde.
    expect(host.querySelector(".mapa-projetos__seletor")).toBe(seletor);
    expect(carregador.obterEscolha().projeto).toBe(
      "Escritório Distrital e Regional",
    );
    await escolher(seletor, "");
    expect(nomes()).toHaveLength(4);
  });

  it("agrupar por projeto: um bloco por projeto, lugar de dois projetos nos dois", async () => {
    const { carregador } = await carregadorCom(PROJETOS);
    await montar({ carregador });
    const mapa = mapaVivo();
    mapa.chamadas.length = 0;
    await clicar(host.querySelector(".mapa-projetos__agrupar input"));
    const grupos = [
      ...host.querySelectorAll(".mapa-projetos__grupo-titulo strong"),
    ].map((grupo) => grupo.textContent);
    expect(grupos).toEqual([
      "Caminhoneiros",
      "Saúde nas Fronteiras",
      "Escritório Distrital e Regional",
      "Rio Doce",
      "MFC",
      "CCE",
    ]);
    expect(nomes().filter((nome) => nome === "Boa Vista/RR")).toHaveLength(2);
    // Agrupar não reenquadra o mapa.
    expect(mapa.chamadas.some(([nome]) => nome === "fitBounds")).toBe(false);
    // Clicar na linha do grupo abre o ponto certo.
    await clicar(
      linhas().find((linha) => linha.textContent.includes("Irati/PR")),
    );
    expect(mapa.chamadas).toContainEqual([
      "setView",
      [-25.4697, -50.6493],
      7,
      { animate: true },
    ]);
  });

  it("a escolha sobrevive a desmontar (troca de área) e projeto que sumiu volta a todos", async () => {
    const { carregador } = await carregadorCom(PROJETOS);
    carregador.guardarEscolha({ projeto: "MFC", agrupar: true });
    await montar({ carregador });
    expect(host.querySelector(".mapa-projetos__seletor").value).toBe("MFC");
    expect(host.querySelector(".mapa-projetos__agrupar input").checked).toBe(
      true,
    );
    // Agrupado, o lugar de dois projetos aparece nos dois grupos.
    expect([...new Set(nomes())]).toEqual(["Brasília/DF"]);
    await desmontar();
    carregador.guardarEscolha({ projeto: "Projeto que acabou" });
    await montar({ carregador });
    expect(host.querySelector(".mapa-projetos__seletor").value).toBe("");
    expect(nomes().length).toBeGreaterThan(4);
  });

  it("com um projeto só, sem filtros", async () => {
    const { carregador } = await carregadorCom({
      data: [PROJETOS.data[3]],
      error: null,
    });
    await montar({ carregador });
    expect(host.querySelector(".mapa-projetos__filtros")).toBeNull();
  });
});

/*
  Reenquadrar ao mudar de tamanho (tela cheia, barra lateral, janela) só
  enquanto a pessoa não mexeu no mapa; "Brasil" volta a acompanhar. ResizeObserver
  e medidas falsos: o jsdom não tem layout.
*/
describe("tamanho do contêiner", () => {
  let observadores;
  let medida;
  const originais = {};

  beforeEach(() => {
    observadores = [];
    medida = { largura: 800, altura: 500 };
    originais.ResizeObserver = globalThis.ResizeObserver;
    originais.raf = globalThis.requestAnimationFrame;
    originais.caf = globalThis.cancelAnimationFrame;
    globalThis.ResizeObserver = class {
      constructor(aoMudar) {
        this.aoMudar = aoMudar;
        observadores.push(this);
      }
      observe() {}
      disconnect() {
        observadores.splice(observadores.indexOf(this), 1);
      }
    };
    globalThis.requestAnimationFrame = (fn) => {
      fn();
      return 1;
    };
    globalThis.cancelAnimationFrame = () => {};
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
    globalThis.cancelAnimationFrame = originais.caf;
    delete HTMLElement.prototype.offsetWidth;
    delete HTMLElement.prototype.offsetHeight;
  });

  async function redimensionar(largura, altura) {
    medida = { largura, altura };
    await act(async () => observadores.forEach((o) => o.aoMudar([])));
  }

  const enquadramentos = (mapa) =>
    mapa.chamadas.filter(([nome]) => nome === "fitBounds").length;

  it("reenquadra ao mudar de tamanho até a pessoa mexer; Brasil volta a acompanhar", async () => {
    const { carregador } = await carregadorCom(SIMPLES);
    await montar({ carregador });
    const mapa = mapaVivo();
    const antes = enquadramentos(mapa);
    await redimensionar(1200, 700);
    expect(enquadramentos(mapa)).toBe(antes + 1);

    // A pessoa arrastou: a vista dela fica, o Leaflet só remede.
    mapa.elemento.dispatchEvent(new Event("pointerdown"));
    mapa.chamadas.length = 0;
    await redimensionar(800, 500);
    expect(enquadramentos(mapa)).toBe(0);
    expect(mapa.chamadas.some(([nome]) => nome === "invalidateSize")).toBe(
      true,
    );

    // "Brasil" é do app: volta a acompanhar o tamanho.
    await clicar(botao("Brasil"));
    mapa.chamadas.length = 0;
    await redimensionar(1000, 600);
    expect(enquadramentos(mapa)).toBe(1);
  });

  it("ir à lista de um ponto conta como mexer; sair da tela cheia sem mexer reenquadra", async () => {
    const { carregador } = await carregadorCom(SIMPLES);
    await montar({ carregador });
    const mapa = mapaVivo();
    await clicar(botao("Tela cheia"));
    mapa.chamadas.length = 0;
    await redimensionar(1400, 900);
    await clicar(botao("Sair da tela cheia"));
    await redimensionar(800, 500);
    expect(enquadramentos(mapa)).toBe(2);

    await clicar(linhas()[1]);
    mapa.chamadas.length = 0;
    await redimensionar(1100, 650);
    expect(enquadramentos(mapa)).toBe(0);
  });

  it("desmontar desliga o observador", async () => {
    const { carregador } = await carregadorCom(SIMPLES);
    await montar({ carregador });
    expect(observadores.length).toBeGreaterThan(0);
    await desmontar();
    expect(observadores).toHaveLength(0);
  });
});

describe("tela cheia e tema", () => {
  it("tela cheia liga e o Esc desliga", async () => {
    const { carregador } = await carregadorCom(SIMPLES);
    await montar({ carregador });
    await clicar(botao("Tela cheia"));
    expect(host.querySelector(".mapa-si--tela-cheia")).not.toBeNull();
    expect(botao("Sair da tela cheia").getAttribute("aria-pressed")).toBe(
      "true",
    );
    await teclar(document, "Escape");
    expect(host.querySelector(".mapa-si--tela-cheia")).toBeNull();
  });

  it("segue o tema do app e aceita o tema forçado pelo pai", async () => {
    const { carregador } = await carregadorCom(SIMPLES);
    await montar({ carregador });
    expect(host.querySelector(".mapa-si--escuro")).toBeNull();
    await act(async () => {
      document.documentElement.setAttribute("data-theme", "dark");
      document.dispatchEvent(new Event(EVENTO_TEMA_ALTERADO));
    });
    expect(host.querySelector(".mapa-si--escuro")).not.toBeNull();
    await rerender({ carregador, tema: "claro" });
    expect(host.querySelector(".mapa-si--escuro")).toBeNull();
  });
});

describe("fonte", () => {
  const pasta = "src/modulos/mapa-de-projetos/";
  const arquivos = [
    "mapa-de-projetos.jsx",
    "lista.jsx",
    "balao.js",
    "carregador.js",
  ].map((nome) => readFileSync(pasta + nome, "utf8"));

  it("sem HTML em string nem MutationObserver", () => {
    for (const fonte of arquivos) {
      expect(fonte).not.toMatch(/innerHTML|dangerouslySetInnerHTML/);
      expect(fonte).not.toContain("MutationObserver");
    }
  });

  it("as cores são as séries do design system", () => {
    const css = readFileSync(pasta + "mapa-de-projetos.css", "utf8").replace(
      /\r\n/g,
      "\n",
    );
    for (let serie = 1; serie <= 6; serie += 1) {
      expect(css).toContain(
        `.marcador-de-projeto--${serie} {\n  fill: var(--series-${serie});`,
      );
      expect(css).toContain(
        `.mapa-projeto__cor--${serie} {\n  background: var(--series-${serie});`,
      );
    }
  });
});
