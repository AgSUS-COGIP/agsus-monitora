import { StrictMode, act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RPC_DOS_MUNICIPIOS,
  criarCarregadorDeMunicipios,
} from "../../src/modulos/mapa-de-projetos/carregador.js";
import { MapaDeProjetos } from "../../src/modulos/mapa-de-projetos/mapa-de-projetos.jsx";
import { MapaSaudeIndigena } from "../../src/modulos/mapa-saude-indigena/mapa-saude-indigena.jsx";
import { clicar, esperar, teclar } from "../componentes/interacoes.js";
import { criarLeafletFalso } from "./leaflet-falso.js";

/*
  O modo de edição de coordenadas (src/modulos/editor-de-coordenadas/
  modo-de-edicao.jsx) nos dois mapas: "Coordenadas" leva o painel para a tela
  inteira com o editor flutuando sobre o mapa; "Recolher editor" deixa a faixa
  sem desmontar o editor; o enquadramento desconta o painel (paddings do
  Leaflet); Esc e "Voltar à lista" restauram o layout de sempre.
*/
const RPC_PENDENCIAS = "listar_pendencias_coordenada_mapa_saude_indigena";
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
const pendencia = () => ({
  fonte: "lmap",
  tipo: "polo",
  dsei: "A",
  codigo: "7",
  nome: "Polo A",
  municipio: "Lugar/MT",
  motivo_tipo: "FONTES_DIVERGEM",
  motivo: "fontes admissíveis não concordam",
  conferido: false,
  candidatos: [{ f: "IBGE", n: "Aldeia A", lat: -12, lon: -51, ti: "TI A" }],
});
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
    rpc: vi.fn(async (nome) =>
      nome === RPC_PENDENCIAS
        ? { data: [pendencia()], error: null }
        : { data: [], error: null },
    ),
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

async function montarSaudeIndigena(extra = {}) {
  await act(async () =>
    raiz.render(
      createElement(
        StrictMode,
        null,
        createElement(MapaSaudeIndigena, {
          lmap,
          redeCnes: {},
          perfil: admin,
          supabase,
          ...extra,
        }),
      ),
    ),
  );
  await aguardar();
}

describe("modo de edição no mapa da Saúde Indígena", () => {
  it("abrir Coordenadas entra no modo de edição: painel na tela inteira, editor flutuante, sem rolagem", async () => {
    await montarSaudeIndigena();
    const mapa = mapaVivo("map");
    const antes = chamadasDe(mapa, "invalidateSize").length;
    expect(painel().classList.contains("mapa-si-painel--editando")).toBe(false);
    await clicar(botao("Coordenadas"));
    await aguardar();
    expect(painel().classList.contains("mapa-si-painel--editando")).toBe(true);
    expect(botao("Coordenadas").getAttribute("aria-pressed")).toBe("true");
    expect(editor().id).toBe("map-painel-lateral");
    expect(editor().getAttribute("aria-label")).toBe("Coordenadas do mapa");
    expect(
      editor().querySelector('[aria-label="Corrigir coordenadas"]'),
    ).not.toBeNull();
    // A lista "Territórios por vagas" sai; o mapa fica com o corpo inteiro.
    expect(host.querySelector(".mapa-si-lista")).toBeNull();
    expect(document.body.style.overflow).toBe("hidden");
    // O botão de tela cheia sai enquanto edita (a edição já cobre a tela).
    expect(botao("Tela cheia")).toBeUndefined();
    // O Leaflet remede ao entrar.
    expect(chamadasDe(mapa, "invalidateSize").length).toBeGreaterThan(antes);
  });

  it("recolhe e abre o painel sem perder o ponto escolhido; o pin volta à área livre", async () => {
    await montarSaudeIndigena();
    await clicar(botao("Coordenadas"));
    await aguardar();
    await clicar(item("Polo · Polo A"));
    await aguardar();
    const mapa = mapaVivo("map");
    const pins = () => [...mapa.camadas].filter((c) => c.opcoes?.draggable);
    expect(pins()).toHaveLength(1);
    await clicar(botao("Recolher editor"));
    expect(editor().classList.contains("mapa-si-editor--recolhido")).toBe(true);
    expect(host.querySelector(".mapa-si-editor__conteudo").hidden).toBe(true);
    expect(botao("Abrir editor").getAttribute("aria-expanded")).toBe("false");
    // O editor continua montado: o pin e o ponto escolhido ficam.
    expect(pins()).toHaveLength(1);
    expect(item("Polo · Polo A").getAttribute("aria-pressed")).toBe("true");
    const inseridos = chamadasDe(mapa, "panInside").length;
    await clicar(botao("Abrir editor"));
    expect(editor().classList.contains("mapa-si-editor--recolhido")).toBe(
      false,
    );
    expect(host.querySelector(".mapa-si-editor__conteudo").hidden).toBe(false);
    expect(botao("Recolher editor").getAttribute("aria-expanded")).toBe("true");
    const pan = chamadasDe(mapa, "panInside").at(-1);
    expect(chamadasDe(mapa, "panInside").length).toBe(inseridos + 1);
    expect(pan[1]).toEqual({ lat: -11, lng: -51 });
  });

  it("enquadra o ponto e a sugestão descontando o painel lateral (paddings do Leaflet)", async () => {
    await montarSaudeIndigena();
    await clicar(botao("Coordenadas"));
    await aguardar();
    const mapa = mapaVivo("map");
    mapa.elemento.getBoundingClientRect = retangulo(0, 60, 1240, 760);
    editor().getBoundingClientRect = retangulo(828, 72, 1228, 748);
    await clicar(item("Polo · Polo A"));
    await aguardar();
    const voo = chamadasDe(mapa, "flyToBounds").at(-1);
    expect(voo[1].pontos).toEqual([
      [-11, -51],
      [-12, -51],
    ]);
    expect(voo[2]).toMatchObject({
      paddingTopLeft: [104, 104],
      paddingBottomRight: [412 + 72, 72],
      maxZoom: 13,
    });
    expect(voo[2].padding).toBeUndefined();
  });

  it("no celular, desconta a folha de baixo; ponto sem sugestão centra na área livre", async () => {
    supabase.rpc.mockImplementation(async (nome) =>
      nome === RPC_PENDENCIAS
        ? { data: [{ ...pendencia(), candidatos: [] }], error: null }
        : { data: [], error: null },
    );
    await montarSaudeIndigena();
    await clicar(botao("Coordenadas"));
    await aguardar();
    const mapa = mapaVivo("map");
    mapa.elemento.getBoundingClientRect = retangulo(14, 100, 376, 831);
    editor().getBoundingClientRect = retangulo(14, 578, 376, 831);
    await clicar(item("Polo · Polo A"));
    await aguardar();
    const voo = chamadasDe(mapa, "flyToBounds").at(-1);
    expect(voo[1].pontos).toEqual([
      [-11, -51],
      [-11, -51],
    ]);
    expect(voo[2]).toMatchObject({
      paddingTopLeft: [104, 104],
      paddingBottomRight: [72, 253 + 72],
      maxZoom: 11,
    });
    expect(chamadasDe(mapa, "flyTo")).toHaveLength(0);
  });

  it("fechar restaura o layout de sempre: lista, rolagem, tela cheia e invalidateSize", async () => {
    document.body.style.overflow = "auto";
    await montarSaudeIndigena();
    const mapa = mapaVivo("map");
    await clicar(botao("Coordenadas"));
    await aguardar();
    const antes = chamadasDe(mapa, "invalidateSize").length;
    await clicar(botao("Voltar à lista"));
    expect(painel().classList.contains("mapa-si-painel--editando")).toBe(false);
    expect(editor()).toBeNull();
    expect(host.querySelectorAll(".mapa-si-territorio")).toHaveLength(1);
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

  it("Esc sai do modo de edição antes da tela cheia e da volta do DSEI ao Brasil", async () => {
    const aoSairDoDsei = vi.fn();
    await montarSaudeIndigena({ dseiSelecionado: "A", aoSairDoDsei });
    await clicar(botao("Tela cheia"));
    await clicar(botao("Coordenadas"));
    await aguardar();
    expect(painel().classList.contains("mapa-si-painel--editando")).toBe(true);
    expect(editor().getAttribute("aria-label")).toBe(
      "Coordenadas do DSEI Distrito A",
    );
    // Esc num campo não fecha (o motivo digitado fica).
    await teclar(host.querySelector('input[type="search"]'), "Escape", {
      cancelable: true,
    });
    expect(editor()).not.toBeNull();
    await esc();
    expect(editor()).toBeNull();
    expect(aoSairDoDsei).not.toHaveBeenCalled();
    expect(host.querySelector(".mapa-si--tela-cheia")).not.toBeNull();
    expect(document.body.style.overflow).toBe("hidden");
    await esc();
    expect(aoSairDoDsei).toHaveBeenCalledTimes(1);
  });

  it("quem não pode editar não vê Coordenadas nem entra no modo", async () => {
    await montarSaudeIndigena({ perfil: { ativo: true, perfil: "leitor" } });
    expect(botao("Coordenadas")).toBeUndefined();
    expect(host.querySelector(".mapa-si-painel--editando")).toBeNull();
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

  async function montarProjetos() {
    supabase.rpc.mockImplementation(async (nome) => {
      if (nome === RPC_DOS_MUNICIPIOS) return { data: LUGARES, error: null };
      if (nome === "listar_pendencias_coordenada_mapa_projetos")
        return { data: PENDENCIAS, error: null };
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
    expect(editor().id).toBe("mapaDosProjetos-coordenadas");
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
});
