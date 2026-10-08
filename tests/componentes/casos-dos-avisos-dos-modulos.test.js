import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clicar, esperar } from "./interacoes.js";
import {
  definirAreaAtual,
  definirAreasDoUsuario,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.ts";
import { consumirPedidoDeFiltro } from "../../src/app/pedido-de-filtro.js";

/*
  Casos de um aviso da Lista de aprovados na gaveta (20261007240000): cada
  caso mostra a pessoa (nome, código, edital, vaga, situação) e as vagas dela;
  registro removido aparece como "Registro removido", nunca o UUID; clicar
  deixa o pedido para a Lista de aprovados nas vagas da pessoa.
*/

const { SeloDeAvisos } =
  await import("../../src/modulos/conferencias/avisos-de-conferencia.tsx");

const APROVADO = "b44c58f2-41de-448e-b6c6-88932524fa19";
const OUTRA_VAGA = "b44c58f2-41de-448e-b6c6-88932524fa20";

const aviso = {
  id: "av1",
  conferencia: "APROVADOS_CONTRATADO_DUPLICADO",
  escopo: "area:saude-indigena",
  gravidade: "CRITICA",
  modulo: "aprovados",
  area: "saude-indigena",
  quantidade: 2,
  exemplos: [APROVADO],
  resumo: "2 pessoas contratadas em mais de uma vaga.",
  situacao: "ABERTO",
  primeira_vez: "2026-10-05T09:00:00Z",
  pode_ignorar: false,
};

const casos = [
  {
    aviso_id: "av1",
    conferencia: "APROVADOS_CONTRATADO_DUPLICADO",
    ordem: 1,
    tipo: "candidato_aprovado",
    resolucao: "ok",
    aprovado_id: APROVADO,
    codigo: "4512",
    nome: "Maria Fictícia",
    edital: "Edital 12/2025",
    codigo_vaga: "1777",
    nome_vaga: "Enfermeiro",
    status: "Contratado",
    data_contratacao: "2026-02-03T13:00:00+00:00",
    referencia: null,
    detalhe: { vagas: 2 },
    vinculos: [
      {
        id: APROVADO,
        edital: "Edital 12/2025",
        codigo_vaga: "1777",
        nome_vaga: "Enfermeiro",
        status: "Contratado",
        data_contratacao: "2026-02-03T13:00:00+00:00",
      },
      {
        id: OUTRA_VAGA,
        edital: "Edital 40/2026",
        codigo_vaga: "1900",
        nome_vaga: "Técnico de enfermagem",
        status: "Contratado",
        data_contratacao: "2026-05-20T13:00:00+00:00",
      },
    ],
  },
  {
    aviso_id: "av1",
    conferencia: "APROVADOS_CONTRATADO_DUPLICADO",
    ordem: 2,
    tipo: "candidato_aprovado",
    resolucao: "removido",
    referencia: null,
    detalhe: {},
  },
];

function supabaseFalso() {
  return {
    rpc: vi.fn(async (nome) => {
      if (nome === "listar_avisos_conferencia")
        return { data: { avisos: [aviso] }, error: null };
      if (nome === "listar_casos_aviso_conferencia")
        return { data: { total: casos.length, casos }, error: null };
      return { data: null, error: null };
    }),
  };
}

let raiz;
let montagem;

async function abrirCasos(props = {}) {
  const supabase = supabaseFalso();
  raiz = document.createElement("div");
  document.body.append(raiz);
  montagem = createRoot(raiz);
  await act(async () =>
    montagem.render(
      createElement(SeloDeAvisos, { modulo: "aprovados", supabase, ...props }),
    ),
  );
  await esperar();
  await clicar(document.querySelector(".conf-selo-do-modulo"));
  const botao = [...document.querySelectorAll(".conf-aviso button")].find((b) =>
    b.textContent.includes("2 casos"),
  );
  await clicar(botao);
  await esperar();
}

beforeEach(() => {
  definirAreasDoUsuario(["saude-indigena"]);
  definirAreaAtual("saude-indigena");
});

afterEach(async () => {
  await act(async () => montagem?.unmount());
  raiz?.remove();
  document.body.innerHTML = "";
  redefinirDadosDoMonitoramento();
  consumirPedidoDeFiltro("approved");
});

describe("casos do aviso Contratado em duas vagas", () => {
  it("mostra a pessoa, a situação e as vagas — nunca o UUID", async () => {
    await abrirCasos();
    const itens = document.querySelectorAll(".conf-caso");
    expect(itens).toHaveLength(2);
    const primeiro = itens[0].textContent;
    expect(primeiro).toContain("4512 · Maria Fictícia");
    expect(primeiro).toContain("Contratado em 2 vagas");
    expect(primeiro).toContain(
      "Edital 40/2026 · 1900 · Técnico de enfermagem · Contratado em 20/05/2026",
    );
    expect(itens[1].textContent).toContain("Registro removido");
    expect(document.querySelector(".conf-casos").textContent).not.toMatch(
      /b44c58f2|Referência/,
    );
    // Só o caso resolvido abre a lista.
    expect(document.querySelectorAll(".conf-caso--clicavel")).toHaveLength(1);
  });

  it("clicar deixa o pedido para a Lista de aprovados nas vagas da pessoa (sem navegar)", async () => {
    const aoAbrirCaso = vi.fn();
    await abrirCasos({ aoAbrirCaso });
    await clicar(document.querySelector(".conf-caso--clicavel"));
    expect(aoAbrirCaso).toHaveBeenCalledWith(
      expect.objectContaining({ aprovadoId: APROVADO }),
      { navegar: false },
    );
  });

  it("sem aoAbrirCaso, o pedido de filtro fica para a Lista de aprovados", async () => {
    await abrirCasos();
    await clicar(document.querySelector(".conf-caso--clicavel"));
    expect(consumirPedidoDeFiltro("approved")).toEqual({
      candidatos: [APROVADO, OUTRA_VAGA],
      nome: "Maria Fictícia",
    });
  });
});
