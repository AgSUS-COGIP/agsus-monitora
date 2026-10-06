import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clicar, digitar, esperar } from "./interacoes.js";
import {
  definirAreaAtual,
  definirAreasDoUsuario,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.js";

/*
  Avisos de conferência (React, src/modulos/conferencias/): o selo de cada
  tela pede só os avisos do módulo na área atual, some sem aviso e abre a
  gaveta; o cartão do Status das atualizações filtra por módulo; ignorar exige
  motivo e relê a lista.
*/

const { SeloDeAvisos, CartaoDeAvisos } =
  await import("../../src/modulos/conferencias/avisos-de-conferencia.jsx");

const aviso = (extra) => ({
  id: "a1",
  conferencia: "ANALISE_APROVADA_ABAIXO_DO_CORTE",
  escopo: "edital:e1",
  gravidade: "CRITICA",
  modulo: "analises",
  area: "saude-indigena",
  edital_id: "e1",
  edital: "101/2026",
  quantidade: 3,
  exemplos: ["00000000-0000-4000-a000-0000000000a1"],
  resumo: "3 análises aprovadas com nota abaixo de 60 no edital 101/2026.",
  situacao: "ABERTO",
  primeira_vez: "2026-10-05T09:00:00Z",
  pode_ignorar: true,
  ...extra,
});

function supabaseFalso(avisos) {
  return {
    rpc: vi.fn(async (nome) => {
      if (nome === "listar_avisos_conferencia")
        return { data: { avisos: avisos() }, error: null };
      return { data: { id: "a1", situacao: "IGNORADO" }, error: null };
    }),
  };
}

let raiz;
let montagem;

async function montar(elemento) {
  raiz = document.createElement("div");
  document.body.append(raiz);
  montagem = createRoot(raiz);
  await act(async () => montagem.render(elemento));
  await esperar();
}

beforeEach(() => {
  sessionStorage.clear();
  definirAreasDoUsuario(["saude-indigena"]);
  definirAreaAtual("saude-indigena");
});

afterEach(async () => {
  await act(async () => montagem?.unmount());
  raiz?.remove();
  document.body.innerHTML = "";
  redefinirDadosDoMonitoramento();
});

describe("selo de avisos no topo da tela", () => {
  it("pede os avisos do módulo na área atual e abre a gaveta", async () => {
    const supabase = supabaseFalso(() => [aviso()]);
    await montar(createElement(SeloDeAvisos, { modulo: "analises", supabase }));
    expect(supabase.rpc).toHaveBeenCalledWith("listar_avisos_conferencia", {
      p_area: "saude-indigena",
      p_modulo: "analises",
    });
    const selo = document.querySelector(".conf-selo-do-modulo");
    expect(selo.textContent).toContain("1 aviso");
    expect(selo.className).toContain("conf-selo-do-modulo--perigo");
    await clicar(selo);
    expect(document.body.textContent).toContain(
      "Aprovada com nota abaixo da mínima",
    );
    expect(document.body.textContent).toContain("Edital 101/2026");
  });

  it("sem aviso aberto, não aparece", async () => {
    const supabase = supabaseFalso(() => []);
    await montar(
      createElement(SeloDeAvisos, { modulo: "entrevistas", supabase }),
    );
    expect(document.querySelector(".conf-selo-do-modulo")).toBeNull();
  });
});

describe("cartão do Status das atualizações", () => {
  it("filtra por módulo e ignora com motivo", async () => {
    let ignorado = false;
    const supabase = supabaseFalso(() => [
      aviso(
        ignorado
          ? {
              situacao: "IGNORADO",
              motivo: "Conferido com a banca.",
              pode_ignorar: false,
            }
          : {},
      ),
      aviso({
        id: "a2",
        conferencia: "CARGA_VARIACAO_BRUSCA",
        escopo: "vaga:177979",
        gravidade: "ATENCAO",
        modulo: "cargas",
        area: null,
        edital_id: null,
        edital: null,
        pode_ignorar: false,
      }),
    ]);
    await montar(createElement(CartaoDeAvisos, { supabase }));
    expect(supabase.rpc).toHaveBeenCalledWith("listar_avisos_conferencia", {
      p_area: null,
      p_modulo: null,
    });
    expect(document.querySelectorAll(".conf-aviso")).toHaveLength(2);

    await clicar(document.querySelector('[data-valor="cargas"]'));
    expect(document.querySelectorAll(".conf-aviso")).toHaveLength(1);
    expect(document.body.textContent).toContain("Vaga 177979");
    await clicar(document.querySelector('[data-valor="todos"]'));

    const analise = document.querySelector(
      '[data-conferencia="ANALISE_APROVADA_ABAIXO_DO_CORTE"]',
    );
    const botaoIgnorar = [...analise.querySelectorAll("button")].find(
      (b) => b.textContent === "Ignorar",
    );
    await clicar(botaoIgnorar);
    await clicar(analise.querySelector('button[type="submit"]'));
    expect(analise.textContent).toContain("pelo menos 10");
    expect(supabase.rpc).not.toHaveBeenCalledWith(
      "ignorar_aviso_conferencia",
      expect.anything(),
    );

    await digitar(analise.querySelector("textarea"), "Conferido com a banca.");
    ignorado = true;
    await clicar(analise.querySelector('button[type="submit"]'));
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith("ignorar_aviso_conferencia", {
      p_id: "a1",
      p_motivo: "Conferido com a banca.",
    });
    expect(document.body.textContent).toContain("Ignorados (1)");
  });
});
