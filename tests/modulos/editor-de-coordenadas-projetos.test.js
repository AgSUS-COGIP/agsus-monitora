import { StrictMode, act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RPC_DOS_MUNICIPIOS,
  criarCarregadorDeMunicipios,
} from "../../src/modulos/mapa-de-projetos/carregador.js";
import { MapaDeProjetos } from "../../src/modulos/mapa-de-projetos/mapa-de-projetos.jsx";
import { clicar, digitar, esperar } from "../componentes/interacoes.js";
import { criarLeafletFalso } from "./leaflet-falso.js";

/*
  O botão "Coordenadas" do mapa de Projetos e o editor comum com as regras e
  as RPCs deste mapa: só o administrador global vê; a fila traz os lugares
  pendentes com a gravidade (lugar sem coordenada também); as sugestões
  aparecem no painel e no mapa; "Salvar coordenada" e "Conferido" mandam a
  chave do lugar e a posição anterior; o mapa e o cache passam a ter a nova
  posição; o histórico tem o "Desfazer".
*/

const RPC_SALVAR = "salvar_coordenada_mapa_projetos";
const RPC_DESFAZER = "desfazer_coordenada_mapa_projetos";
const RPC_PENDENCIAS = "listar_pendencias_coordenada_mapa_projetos";
const RPC_HISTORICO = "listar_historico_coordenada_mapa_projetos";

const LUGARES = [
  {
    lugar: "seropedica/RJ",
    municipio_uf: "Seropédica/RJ",
    uf: "RJ",
    codigo_ibge: 3305554,
    latitude: -22.7526,
    longitude: -43.7155,
    coordenada_origem: "SEDE_IBGE",
    vagas_edital: 4,
    projetos: ["Projeto Agora Tem Especialistas Caminhoneiros"],
    editais: [
      {
        edital: "30/2026",
        projeto: "Projeto Agora Tem Especialistas Caminhoneiros",
        vagas: 4,
        lotacoes: ["UBS móvel Seropédica/RJ"],
      },
    ],
  },
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
  {
    lugar: "lugar novo/AM",
    municipio_uf: "Lugar Novo/AM",
    uf: "AM",
    latitude: null,
    longitude: null,
    vagas_edital: 2,
    projetos: ["MFC"],
    editais: [{ edital: "05/2026", projeto: "MFC", vagas: 2 }],
  },
];
const PENDENCIAS = () => [
  {
    lugar: "seropedica/RJ",
    nome: "Seropédica/RJ",
    uf: "RJ",
    motivo_tipo: "SEDE_MUNICIPAL",
    motivo: "O ponto é a sede do município (IBGE).",
    conferido: false,
    candidatos: [
      { f: "MUNICIPIO", n: "Seropédica/RJ", lat: -22.7526, lon: -43.7155 },
    ],
  },
  {
    lugar: "uf:PA",
    nome: "Pará",
    uf: "PA",
    motivo_tipo: "ESCRITORIO_SO_UF",
    motivo: "O edital só diz a UF.",
    conferido: false,
    candidatos: [
      { f: "UF", n: "Pará", lat: -2.9668, lon: -49.7614 },
      { f: "LUGAR", n: "Belém/PA", lat: -1.4554, lon: -48.4898 },
    ],
  },
];
const HISTORICO = () => [
  {
    id: 9,
    em: "2026-10-02T15:00:00Z",
    por: "Ana Admin",
    acao: "CORRECAO",
    latitude_anterior: -22.7,
    longitude_anterior: -43.7155,
    latitude: -22.7526,
    longitude: -43.7155,
    motivo: "Ajuste pela sede do IBGE",
    conferido: false,
    desfeito: false,
  },
];
const ADMIN = { ativo: true, perfil: "admin", admin_global: true };

let host, raiz, leaflet, supabase, carregador, respostas;

beforeEach(async () => {
  leaflet = criarLeafletFalso();
  globalThis.L = leaflet.L;
  const original = leaflet.L.marker;
  leaflet.L.marker = (...args) => {
    const pin = original(...args);
    pin.getLatLng = () => ({ lat: pin.latlng[0], lng: pin.latlng[1] });
    return pin;
  };
  respostas = {
    [RPC_DOS_MUNICIPIOS]: () => ({ data: LUGARES, error: null }),
    [RPC_PENDENCIAS]: () => ({ data: PENDENCIAS(), error: null }),
    [RPC_HISTORICO]: () => ({ data: HISTORICO(), error: null }),
    [RPC_SALVAR]: (args) => ({
      data: {
        lugar: args.p_lugar,
        latitude: args.p_latitude,
        longitude: args.p_longitude,
        conferido: args.p_conferido ? true : null,
        historico: 10,
      },
      error: null,
    }),
    [RPC_DESFAZER]: () => ({
      data: {
        lugar: "seropedica/RJ",
        latitude: -22.7,
        longitude: -43.7155,
        conferido: false,
      },
      error: null,
    }),
  };
  supabase = {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "teste" } },
        error: null,
      }),
    },
    rpc: vi.fn(async (nome, args) => respostas[nome](args)),
  };
  carregador = criarCarregadorDeMunicipios({ obterSupabase: () => supabase });
  await esperar(() => carregador.carregar("projetos"));
  host = document.createElement("div");
  document.body.append(host);
  raiz = createRoot(host);
});

afterEach(async () => {
  await act(async () => raiz.unmount());
  host.remove();
  delete globalThis.L;
  vi.restoreAllMocks();
});

const aguardar = () =>
  act(async () => {
    await new Promise((resolver) => setTimeout(resolver, 0));
  });
async function montar(perfil = ADMIN) {
  await act(async () =>
    raiz.render(
      createElement(
        StrictMode,
        null,
        createElement(MapaDeProjetos, {
          area: "projetos",
          carregadoEm: 1,
          carregador,
          perfil,
          supabase,
        }),
      ),
    ),
  );
  await aguardar();
}
const botao = (texto) =>
  [...host.querySelectorAll("button")].find(
    (b) => b.textContent.replace(/\s+/g, " ").trim() === texto,
  );
const itens = () =>
  [...host.querySelectorAll(".mapa-si-coordenadas__nome")].map(
    (e) => e.textContent,
  );
const item = (nome) =>
  [...host.querySelectorAll(".mapa-si-coordenadas__item")].find(
    (b) => b.querySelector(".mapa-si-coordenadas__nome").textContent === nome,
  );
const chamadas = (nome) => supabase.rpc.mock.calls.filter(([n]) => n === nome);
const motivo = () =>
  [...host.querySelectorAll("textarea")].find(
    (t) =>
      t.closest(".ui-campo").querySelector("label").textContent ===
      "Motivo e fonte da correção *",
  );
const latitude = () => host.querySelectorAll("input[inputmode]")[0];
const longitude = () => host.querySelectorAll("input[inputmode]")[1];
const mapaVivo = () =>
  leaflet.vivos().find((m) => m.elemento.id === "mapaDosProjetos");
async function abrirEditor() {
  await clicar(botao("Coordenadas"));
  await aguardar();
}
async function escolher(nome) {
  await clicar(item(nome));
  await aguardar();
}

describe("Coordenadas no mapa de Projetos", () => {
  it("só o administrador global vê o botão; ninguém mais lê as pendências", async () => {
    await montar({ ativo: true, perfil: "usuario" });
    expect(botao("Coordenadas")).toBeUndefined();
    expect(chamadas(RPC_PENDENCIAS)).toHaveLength(0);
    await montar(ADMIN);
    expect(botao("Coordenadas")).toBeTruthy();
    expect(chamadas(RPC_PENDENCIAS)).toHaveLength(0);
  });

  it("abre a fila no lugar da lista, com gravidade e o lugar sem coordenada", async () => {
    await montar();
    await abrirEditor();
    expect(host.querySelector(".mapa-projetos-lugar")).toBeNull();
    expect(chamadas(RPC_PENDENCIAS).length).toBeGreaterThan(0);
    expect(
      host.querySelector(".mapa-si-coordenadas__contagem").textContent,
    ).toBe("3 pendentes");
    // Lugar sem coordenada e sem sugestão; escritório num edital só com UF;
    // a sede do município, só confirmar.
    expect(itens()).toEqual([
      "Pará (estado)",
      "Lugar Novo/AM",
      "Seropédica/RJ",
    ]);
    expect(item("Pará (estado)").textContent).toContain("Revisar");
    expect(item("Lugar Novo/AM").textContent).toContain("Sem sugestão");
    expect(item("Seropédica/RJ").textContent).toContain("Só confirmar");
    const niveis = [
      ...host.querySelectorAll(".mapa-si-coordenadas__nivel"),
    ].map((b) => b.textContent);
    expect(niveis).toEqual([
      "Provável erro 0",
      "Revisar 1",
      "Sem sugestão 1",
      "Só confirmar 1",
    ]);
    await clicar(botao("Voltar à lista"));
    expect(host.querySelector(".mapa-projetos-lugar")).toBeTruthy();
  });

  it("busca por edital e lotação", async () => {
    await montar();
    await abrirEditor();
    await digitar(host.querySelector('input[type="search"]'), "30/2026");
    expect(itens()).toEqual(["Seropédica/RJ"]);
    await digitar(host.querySelector('input[type="search"]'), "ubs movel");
    expect(itens()).toEqual(["Seropédica/RJ"]);
  });

  it("conferido sem mudar a posição manda a chave do lugar e a posição anterior", async () => {
    await montar();
    await abrirEditor();
    await escolher("Seropédica/RJ");
    expect(host.textContent).toContain("Sede do município (IBGE)");
    expect(chamadas(RPC_HISTORICO).at(-1)[1]).toEqual({
      p_lugar: "seropedica/RJ",
      p_limite: 5,
    });
    await digitar(motivo(), "Sede do município confere com o edital");
    await clicar(botao("Conferido"));
    await clicar(botao("Confirmar conferência"));
    expect(chamadas(RPC_SALVAR).at(-1)[1]).toEqual({
      p_lugar: "seropedica/RJ",
      p_latitude: -22.7526,
      p_longitude: -43.7155,
      p_latitude_anterior: -22.7526,
      p_longitude_anterior: -43.7155,
      p_motivo: "Sede do município confere com o edital",
      p_conferido: true,
    });
    expect(host.textContent).toContain("Ponto conferido.");
    expect(
      host.querySelector(".mapa-si-coordenadas__contagem").textContent,
    ).toBe("2 pendentes");
  });

  it("lugar sem coordenada: salvar cria a posição; o mapa e o cache passam a ter o ponto", async () => {
    await montar();
    const antes = leaflet
      .desenhadas(mapaVivo(), "circleMarker")
      .filter((c) =>
        String(c.opcoes.className).includes("marcador-de-projeto"),
      ).length;
    expect(antes).toBe(2);
    await abrirEditor();
    await escolher("Lugar Novo/AM");
    expect(botao("Conferido")).toBeUndefined();
    await digitar(latitude(), "-3,1");
    await digitar(longitude(), "-60");
    await digitar(motivo(), "Endereço do escritório no edital");
    await clicar(botao("Salvar coordenada"));
    await clicar(botao("Confirmar correção"));
    expect(chamadas(RPC_SALVAR).at(-1)[1]).toMatchObject({
      p_lugar: "lugar novo/AM",
      p_latitude: -3.1,
      p_longitude: -60,
      p_latitude_anterior: null,
      p_longitude_anterior: null,
      p_conferido: false,
    });
    expect(host.textContent).toContain("Coordenada salva.");
    const pontosDoMapa = leaflet
      .desenhadas(mapaVivo(), "circleMarker")
      .filter((c) =>
        String(c.opcoes.className).includes("marcador-de-projeto"),
      );
    expect(pontosDoMapa).toHaveLength(antes + 1);
    expect(pontosDoMapa.map((c) => c.latlng)).toContainEqual([-3.1, -60]);
    const noCache = carregador
      .emCache("projetos")
      .municipios.find((m) => m.lugar === "lugar novo/AM");
    expect(noCache.coordenada).toEqual({
      latitude: -3.1,
      longitude: -60,
      origem: "MANUAL",
    });
  });

  it("sugestões no painel e no mapa; Usar esta preenche a prévia", async () => {
    await montar();
    await abrirEditor();
    await escolher("Pará (estado)");
    const sugestoes = [
      ...host.querySelectorAll(".mapa-si-coordenadas__sugestoes li"),
    ].map((li) => li.textContent);
    expect(sugestoes[0]).toContain("Centro da UF");
    expect(sugestoes.some((s) => s.includes("Belém/PA"))).toBe(true);
    await clicar(
      host.querySelector(
        'button[aria-label="Usar esta: Outro lugar das vagas na UF Belém/PA"]',
      ),
    );
    expect(latitude().value).toBe("-1.455400");
    const pin = [...mapaVivo().camadas].find((c) => c.opcoes?.draggable);
    expect(pin.latlng).toEqual([-1.4554, -48.4898]);
  });

  it("histórico com Desfazer: pede motivo e chama a RPC com o id", async () => {
    await montar();
    await abrirEditor();
    await escolher("Seropédica/RJ");
    expect(host.textContent).toContain("Ajuste pela sede do IBGE");
    await clicar(botao("Desfazer última alteração"));
    await clicar(botao("Confirmar desfazer"));
    expect(chamadas(RPC_DESFAZER)).toHaveLength(0);
    const campo = [...host.querySelectorAll("textarea")].find(
      (t) =>
        t.closest(".ui-campo").querySelector("label").textContent ===
        "Motivo do desfazer *",
    );
    await digitar(campo, "A correção usou a fonte errada");
    await clicar(botao("Confirmar desfazer"));
    expect(chamadas(RPC_DESFAZER).at(-1)[1]).toEqual({
      p_historico: 9,
      p_motivo: "A correção usou a fonte errada",
    });
    expect(host.textContent).toContain("Alteração desfeita.");
  });
});
