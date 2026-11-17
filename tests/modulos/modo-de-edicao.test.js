// @vitest-environment jsdom
import { StrictMode, act, createElement } from "react";
import { createRoot } from "react-dom/client";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  beforeAll,
} from "vitest";
import {
  RPC_DOS_MUNICIPIOS,
  criarCarregadorDeMunicipios,
} from "../../src/modulos/mapa-de-projetos/carregador.ts";
import { MapaDeProjetos } from "../../src/modulos/mapa-de-projetos/mapa-de-projetos.tsx";
import { MapaSaudeIndigena } from "../../src/modulos/mapa-saude-indigena/mapa-saude-indigena.tsx";
import { clicar, esperar, teclar } from "../componentes/interacoes.ts";
import { criarLeafletFalso } from "./leaflet-falso.js";
import { carregarEditorDeCoordenadas } from "../../src/modulos/editor-de-coordenadas/editor-sob-demanda.ts";

// O editor chega sob demanda (fora do pacote principal): carregado antes, desenha na hora.
beforeAll(async () => {
  await carregarEditorDeCoordenadas();
});

/*
  O modo de edição de coordenadas (src/modulos/editor-de-coordenadas/
  modo-de-edicao.jsx) nos dois mapas: "Coordenadas" leva o painel para a tela
  inteira com o editor flutuando sobre o mapa; "Recolher editor" deixa a faixa
  sem desmontar o editor; o enquadramento desconta o painel (paddings do
  Leaflet); Esc e "Voltar à lista" restauram o layout de sempre.
*/
const lmap = {
  dsei: [
    {
      k: "A",
      n: "Distrito A",
      lat: -10,
      lon: -50,
      ufs: ["MT"],
      polos: [{ n: "Polo A", cod: 7, lat: -11, lon: -51 }],
    },
  ],
};
const admin = { ativo: true, perfil: "admin", admin_global: true };

let host, raiz, leaflet, supabase;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  raiz = createRoot(host);
  leaflet = criarLeafletFalso();
  globalThis.L = leaflet.L;
  const original = leaflet.L.marker;
  leaflet.L.marker = (...args) => {
    const pin = original(...args);
    pin.getLatLng = () => ({ lat: pin.latlng[0], lng: pin.latlng[1] });
    return pin;
  };
  supabase = {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "teste" } },
        error: null,
      }),
    },
    rpc: vi.fn(async () => ({ data: [], error: null })),
  };
});
afterEach(async () => {
  await act(async () => raiz.unmount());
  host.remove();
  delete globalThis.L;
  document.body.style.overflow = "";
});

const aguardar = () =>
  act(async () => {
    await new Promise((resolver) => setTimeout(resolver, 0));
  });
// Só os botões do painel à vista (o nacional fica escondido com o DSEI aberto).
const botao = (texto) =>
  [...host.querySelectorAll(".mapa-si-painel:not([hidden]) button")].find(
    (b) => b.textContent.replace(/\s+/g, " ").trim() === texto,
  );
const item = (nome) =>
  [...host.querySelectorAll(".mapa-si-coordenadas__item")].find(
    (b) => b.querySelector(".mapa-si-coordenadas__nome").textContent === nome,
  );
const painel = () => host.querySelector(".mapa-si-painel:not([hidden])");
const editor = () => host.querySelector(".mapa-si-editor");
const mapaVivo = (id) => leaflet.vivos().find((m) => m.elemento.id === id);
const chamadasDe = (m, nome) => m.chamadas.filter(([n]) => n === nome);
const retangulo = (left, top, right, bottom) => () => ({
  left,
  top,
  right,
  bottom,
  width: right - left,
  height: bottom - top,
});
const esc = () => teclar(document, "Escape", { cancelable: true });

/*
  A Saúde Indígena não tem mais editor (17/11/2026): os pontos vêm do SIGEPSI,
  e a correção é feita lá.
*/
describe("o mapa da Saúde Indígena não edita coordenadas", () => {
  it("nem o administrador vê Coordenadas, no mapa nacional ou no do DSEI", async () => {
    await act(async () =>
      raiz.render(
        createElement(
          StrictMode,
          null,
          createElement(MapaSaudeIndigena, {
            lmap,
            casaisNacionais: [],
            dseiSelecionado: "A",
          }),
        ),
      ),
    );
    await aguardar();
    expect(host.querySelector(".mapa-si")).not.toBeNull();
    expect(
      [...host.querySelectorAll("button")].some(
        (b) => b.textContent.trim() === "Coordenadas",
      ),
    ).toBe(false);
    expect(host.querySelector(".mapa-si-painel--editando")).toBeNull();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

describe("modo de edição no mapa de Projetos", () => {
  const LUGARES = [
    {
      lugar: "uf:PA",
      municipio_uf: null,
      uf: "PA",
      nivel: "uf",
      latitude: -2.9668,
      longitude: -49.7614,
      coordenada_origem: "CENTRO_UF",
      vagas_edital: 1,
      projetos: ["CCE"],
      editais: [{ edital: "97/2025", projeto: "CCE", vagas: 1 }],
    },
  ];
  const PENDENCIAS = [
    {
      lugar: "uf:PA",
      nome: "Pará",
      uf: "PA",
      motivo_tipo: "ESCRITORIO_SO_UF",
      motivo: "O edital só diz a UF.",
      conferido: false,
      candidatos: [{ f: "LUGAR", n: "Belém/PA", lat: -1.4554, lon: -48.4898 }],
    },
  ];

  async function montarProjetos(pendencias = PENDENCIAS) {
    supabase.rpc.mockImplementation(async (nome) => {
      if (nome === RPC_DOS_MUNICIPIOS) return { data: LUGARES, error: null };
      if (nome === "listar_pendencias_coordenada_mapa_projetos")
        return { data: pendencias, error: null };
      return { data: [], error: null };
    });
    const carregador = criarCarregadorDeMunicipios({
      obterSupabase: () => supabase,
    });
    await esperar(() => carregador.carregar("projetos"));
    await act(async () =>
      raiz.render(
        createElement(MapaDeProjetos, {
          area: "projetos",
          carregadoEm: 1,
          carregador,
          perfil: admin,
          supabase,
        }),
      ),
    );
    await aguardar();
  }

  it("entra no modo, recolhe, enquadra com o painel descontado e fecha restaurando", async () => {
    await montarProjetos();
    const mapa = mapaVivo("mapaDosProjetos");
    await clicar(botao("Coordenadas"));
    await aguardar();
    expect(painel().classList.contains("mapa-si-painel--editando")).toBe(true);
    expect(editor().id).toBe("mapaDosProjetos-painel-lateral");
    expect(host.querySelector(".mapa-projetos-lugar")).toBeNull();
    expect(botao("Tela cheia")).toBeUndefined();
    expect(document.body.style.overflow).toBe("hidden");
    mapa.elemento.getBoundingClientRect = retangulo(0, 60, 1240, 760);
    editor().getBoundingClientRect = retangulo(828, 72, 1228, 748);
    await clicar(item("Pará (estado)"));
    await aguardar();
    expect(chamadasDe(mapa, "flyToBounds").at(-1)[2]).toMatchObject({
      paddingTopLeft: [104, 104],
      paddingBottomRight: [484, 72],
    });
    await clicar(botao("Recolher editor"));
    expect(editor().classList.contains("mapa-si-editor--recolhido")).toBe(true);
    await clicar(botao("Abrir editor"));
    await esc();
    expect(editor()).toBeNull();
    expect(painel().classList.contains("mapa-si-painel--editando")).toBe(false);
    expect(host.querySelector(".mapa-projetos-lugar")).toBeTruthy();
    expect(document.body.style.overflow).toBe("");
    expect(botao("Tela cheia")).toBeTruthy();
  });

  it("no celular, desconta a folha de baixo; ponto sem sugestão centra na área livre", async () => {
    await montarProjetos([{ ...PENDENCIAS[0], candidatos: [] }]);
    await clicar(botao("Coordenadas"));
    await aguardar();
    const mapa = mapaVivo("mapaDosProjetos");
    mapa.elemento.getBoundingClientRect = retangulo(14, 100, 376, 831);
    editor().getBoundingClientRect = retangulo(14, 578, 376, 831);
    await clicar(item("Pará (estado)"));
    await aguardar();
    const voo = chamadasDe(mapa, "flyToBounds").at(-1);
    expect(voo[1].pontos).toEqual([
      [-2.9668, -49.7614],
      [-2.9668, -49.7614],
    ]);
    expect(voo[2]).toMatchObject({
      paddingTopLeft: [104, 104],
      paddingBottomRight: [72, 253 + 72],
    });
    expect(chamadasDe(mapa, "flyTo")).toHaveLength(0);
  });

  it("fechar restaura o layout de sempre: lista, rolagem, tela cheia e invalidateSize", async () => {
    document.body.style.overflow = "auto";
    await montarProjetos();
    const mapa = mapaVivo("mapaDosProjetos");
    await clicar(botao("Coordenadas"));
    await aguardar();
    const antes = chamadasDe(mapa, "invalidateSize").length;
    await clicar(botao("Voltar à lista"));
    expect(painel().classList.contains("mapa-si-painel--editando")).toBe(false);
    expect(editor()).toBeNull();
    expect(host.querySelector(".mapa-projetos-lugar")).toBeTruthy();
    expect(botao("Coordenadas").getAttribute("aria-pressed")).toBe("false");
    expect(botao("Tela cheia")).toBeTruthy();
    expect(document.body.style.overflow).toBe("auto");
    expect(chamadasDe(mapa, "invalidateSize").length).toBeGreaterThan(antes);
    // O botão do cabeçalho também abre e fecha.
    await clicar(botao("Coordenadas"));
    expect(editor()).not.toBeNull();
    await clicar(botao("Coordenadas"));
    expect(editor()).toBeNull();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("Esc num campo não fecha o editor; fora dele, fecha antes da tela cheia", async () => {
    await montarProjetos();
    await clicar(botao("Tela cheia"));
    await clicar(botao("Coordenadas"));
    await aguardar();
    await teclar(host.querySelector('input[type="search"]'), "Escape", {
      cancelable: true,
    });
    expect(editor()).not.toBeNull();
    await esc();
    expect(editor()).toBeNull();
    expect(host.querySelector(".mapa-si--tela-cheia")).not.toBeNull();
    expect(document.body.style.overflow).toBe("hidden");
  });
});
