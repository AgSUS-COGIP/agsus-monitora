import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clicar, digitar, esperar } from "./interacoes.js";
import {
  definirAreaAtual,
  definirAreasDoUsuario,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.js";
import { consumirPedidoDeFiltro } from "../../src/app/pedido-de-filtro.js";

/*
  Casos dos avisos de conferência na gaveta (src/modulos/conferencias/):
  todos os casos em páginas, com quem é, onde e o motivo (sem UUID); busca no
  aviso e em todos os avisos; "Mostrar mais"; CSV; o caso das análises leva o
  Painel das análises à análise (pedido de filtro).
*/

const { SeloDeAvisos } =
  await import("../../src/modulos/conferencias/avisos-de-conferencia.jsx");
const { criarEstadoDosAvisos } =
  await import("../../src/modulos/conferencias/estado.js");

const ANALISE = "00000000-0000-4000-a000-0000000000a1";
const aviso = {
  id: "a1",
  conferencia: "ANALISE_DATA_INVALIDA",
  escopo: "edital:e1",
  gravidade: "ATENCAO",
  modulo: "analises",
  area: "saude-indigena",
  edital_id: "e1",
  edital: "101/2026",
  quantidade: 60,
  exemplos: [ANALISE],
  resumo:
    "60 análises com data no futuro ou antes da inscrição no edital 101/2026.",
  situacao: "ABERTO",
  primeira_vez: "2026-10-05T09:00:00Z",
  pode_ignorar: false,
};

const caso = (i) => ({
  aviso_id: "a1",
  conferencia: "ANALISE_DATA_INVALIDA",
  ordem: i,
  analise_id:
    i === 1
      ? ANALISE
      : `00000000-0000-4000-a000-0000000001${String(i).padStart(2, "0")}`,
  codigo: String(4500 + i),
  nome: `Pessoa ${i}`,
  edital: "Edital 101/2026",
  codigo_vaga: "177979",
  nome_vaga: "Enfermeiro",
  responsavel: "Ana Analista",
  status: "Aprovado",
  data_analise: "2026-09-01",
  detalhe: {
    data_analise: "2026-09-01",
    inscricao: "2026-09-10",
    motivo: "antes_da_inscricao",
  },
});
const TODOS = Array.from({ length: 60 }, (_, i) => caso(i + 1));

function supabaseFalso() {
  return {
    rpc: vi.fn(async (nome, args) => {
      if (nome === "listar_avisos_conferencia")
        return { data: { avisos: [aviso] }, error: null };
      if (nome === "listar_casos_aviso_conferencia") {
        const termo = String(args.p_busca || "").toLowerCase();
        const achados = TODOS.filter(
          (c) =>
            !termo ||
            c.codigo.includes(termo) ||
            c.nome.toLowerCase().includes(termo),
        );
        return {
          data: {
            total: achados.length,
            casos: achados.slice(
              args.p_deslocamento,
              args.p_deslocamento + args.p_limite,
            ),
          },
          error: null,
        };
      }
      return { data: null, error: null };
    }),
  };
}

const respiro = () => esperar(() => new Promise((r) => setTimeout(r, 350)));

let raiz;
let montagem;

async function montar(elemento) {
  raiz = document.createElement("div");
  document.body.append(raiz);
  montagem = createRoot(raiz);
  await act(async () => montagem.render(elemento));
  await esperar();
}

async function abrirCasos(props = {}) {
  const supabase = supabaseFalso();
  const baixar = vi.fn();
  const estado = criarEstadoDosAvisos({ supabase, baixar });
  await montar(
    createElement(SeloDeAvisos, {
      modulo: "analises",
      supabase,
      estado,
      ...props,
    }),
  );
  await clicar(document.querySelector(".conf-selo-do-modulo"));
  const botao = [...document.querySelectorAll(".conf-aviso button")].find((b) =>
    b.textContent.includes("60 casos"),
  );
  await clicar(botao);
  await esperar();
  return { supabase, baixar };
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
  consumirPedidoDeFiltro("analises");
});

describe("casos de um aviso", () => {
  it("mostra código, nome, edital, vaga, responsável e o motivo — não o UUID", async () => {
    const { supabase } = await abrirCasos();
    expect(supabase.rpc).toHaveBeenCalledWith(
      "listar_casos_aviso_conferencia",
      expect.objectContaining({ p_aviso: "a1", p_deslocamento: 0 }),
    );
    const itens = document.querySelectorAll(".conf-caso");
    expect(itens).toHaveLength(50);
    const primeiro = itens[0].textContent;
    expect(primeiro).toContain("4501 · Pessoa 1");
    expect(primeiro).toContain("Edital 101/2026 · 177979 · Enfermeiro");
    expect(primeiro).toContain("Resp. Ana Analista");
    expect(primeiro).toContain(
      "Análise em 01/09/2026, antes da inscrição em 10/09/2026",
    );
    expect(document.querySelector(".conf-casos").textContent).not.toContain(
      ANALISE,
    );
    expect(document.querySelector(".conf-casos__total").textContent).toBe(
      "50 de 60",
    );
  });

  it("Mostrar mais traz a página seguinte", async () => {
    const { supabase } = await abrirCasos();
    const mais = [...document.querySelectorAll(".conf-casos button")].find(
      (b) => b.textContent.includes("Mostrar mais"),
    );
    expect(mais.textContent).toContain("(10)");
    await clicar(mais);
    await esperar();
    expect(supabase.rpc).toHaveBeenLastCalledWith(
      "listar_casos_aviso_conferencia",
      expect.objectContaining({ p_aviso: "a1", p_deslocamento: 50 }),
    );
    expect(document.querySelectorAll(".conf-caso")).toHaveLength(60);
    expect(document.body.textContent).not.toContain("Mostrar mais");
  });

  it("busca no aviso por código", async () => {
    const { supabase } = await abrirCasos();
    await digitar(document.querySelector(".conf-casos__busca"), "4512");
    await respiro();
    expect(supabase.rpc).toHaveBeenLastCalledWith(
      "listar_casos_aviso_conferencia",
      expect.objectContaining({ p_aviso: "a1", p_busca: "4512" }),
    );
    const itens = document.querySelectorAll(".conf-caso");
    expect(itens).toHaveLength(1);
    expect(itens[0].textContent).toContain("Pessoa 12");
  });

  it("exporta o CSV com todos os casos", async () => {
    const { baixar } = await abrirCasos();
    const csv = [
      ...document.querySelectorAll(".conf-aviso__casos button"),
    ].find((b) => b.textContent === "Exportar CSV");
    await clicar(csv);
    await esperar();
    expect(baixar).toHaveBeenCalledTimes(1);
    expect(baixar.mock.calls[0][0].split("\n")).toHaveLength(61);
  });

  it("clicar no caso fecha a gaveta e pede ao Painel das análises a busca e a análise", async () => {
    const aoAbrirCaso = vi.fn();
    await abrirCasos({ aoAbrirCaso });
    await clicar(document.querySelector(".conf-caso--clicavel"));
    expect(aoAbrirCaso).toHaveBeenCalledWith(
      expect.objectContaining({ analiseId: ANALISE, nome: "Pessoa 1" }),
      { navegar: false },
    );
    expect(document.querySelector(".conf-gaveta")).toBeNull();
  });

  it("sem aoAbrirCaso, o clique deixa o pedido de filtro para as análises", async () => {
    await abrirCasos();
    await clicar(document.querySelector(".conf-caso--clicavel"));
    expect(consumirPedidoDeFiltro("analises")).toEqual({
      busca: "Pessoa 1",
      analise: ANALISE,
    });
  });
});

describe("busca em todos os avisos", () => {
  it("procura por nome em todos os avisos do recorte e mostra de qual aviso é", async () => {
    const supabase = supabaseFalso();
    await montar(createElement(SeloDeAvisos, { modulo: "analises", supabase }));
    await clicar(document.querySelector(".conf-selo-do-modulo"));
    await digitar(document.querySelector(".conf-busca input"), "pessoa 3");
    await respiro();
    expect(supabase.rpc).toHaveBeenLastCalledWith(
      "listar_casos_aviso_conferencia",
      {
        p_aviso: null,
        p_busca: "pessoa 3",
        p_area: "saude-indigena",
        p_modulo: "analises",
        p_limite: 50,
        p_deslocamento: 0,
      },
    );
    expect(document.querySelector(".conf-aviso")).toBeNull();
    const itens = [...document.querySelectorAll(".conf-caso")];
    expect(itens.length).toBeGreaterThan(0);
    expect(itens[0].textContent).toContain(
      "Data da análise no futuro ou antes da inscrição",
    );
  });
});
