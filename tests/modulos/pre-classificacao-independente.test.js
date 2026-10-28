import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  definirAreaAtual,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.ts";
import { montarPreClassificacao } from "../../src/modulos/avaliacao-documental/entrada-da-pre-classificacao.tsx";
import { esperar } from "../componentes/interacoes.js";

/* A página não acessa a RPC de pré-classificação até o backend confirmar
   pode_coordenar para aquele edital; perfil que só lê Seleção não a libera. */
const ID = "00000000-0000-4000-8000-000000000114";
function supabaseFalso(coordena) {
  return {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: "usuario-de-teste" } } },
      }),
    },
    rpc: vi.fn(async (nome, args) => {
      switch (nome) {
        case "listar_editais_avaliacao":
          return {
            data: {
              area: "projetos",
              editais: [
                {
                  id: ID,
                  edital: "114/2026",
                  unidade: "Rio Doce",
                  ativo: true,
                  status: "Em andamento",
                  papel: coordena ? "COORDENADOR" : "ANALISTA",
                },
              ],
            },
            error: null,
          };
        case "obter_regra_analise":
          return {
            data: {
              edital: {
                id: args.p_edital,
                edital: "114/2026",
                area: "projetos",
              },
              papel: coordena ? "COORDENADOR" : "ANALISTA",
              pode_coordenar: coordena,
              origem: "PLANILHA",
              regra: null,
              modelos: [],
              nota_minima: null,
              aldeias: { quantidade: 0 },
            },
            error: null,
          };
        case "obter_equipe_edital":
          return {
            data: {
              pode_coordenar: coordena,
              gestores: [],
              equipe: [],
              pessoas: [],
              vagas: [],
            },
            error: null,
          };
        case "obter_pre_classificacao":
          // Um snapshot mínimo: a prova principal é que só a coordenação
          // chega a solicitar dados e as chamadas não alteram o edital.
          return { data: null, error: null };
        default:
          return { data: null, error: null };
      }
    }),
  };
}

let secao;
let controller;

async function montar(supabase) {
  secao = document.createElement("section");
  secao.id = "page-pre-classificacao";
  document.body.append(secao);
  await act(async () => {
    controller = montarPreClassificacao({
      secao,
      supabase,
      areaAtual: () => "projetos",
      toast: vi.fn(),
    });
  });
  await act(async () => controller.render());
  await esperar();
  await esperar();
}

beforeEach(() => {
  redefinirDadosDoMonitoramento();
  definirAreaAtual("projetos");
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(async () => {
  await act(async () => controller?.raiz?.unmount());
  secao?.remove();
  controller = null;
  secao = null;
});

describe("entrada independente de Pré-classificação", () => {
  it("analista vê o aviso e não consulta dados da pré-classificação", async () => {
    const supabase = supabaseFalso(false);
    await montar(supabase);
    expect(secao.textContent).toContain("restrita à coordenação");
    expect(
      supabase.rpc.mock.calls.some(
        ([nome]) => nome === "obter_pre_classificacao",
      ),
    ).toBe(false);
    expect(
      supabase.rpc.mock.calls.some(([nome]) => nome === "obter_regra_analise"),
    ).toBe(true);
  });

  it("coordenação autenticada chega à mesma RPC da Pré-classificação", async () => {
    const supabase = supabaseFalso(true);
    await montar(supabase);
    expect(
      supabase.rpc.mock.calls.some(
        ([nome]) => nome === "obter_pre_classificacao",
      ),
    ).toBe(true);
    expect(
      secao.querySelector("[data-tour='pre-seletor-edital']"),
    ).not.toBeNull();
  });

  it("a entrada não concede acesso ao recurso Seleção", async () => {
    const supabase = supabaseFalso(false);
    await montar(supabase);
    expect(
      supabase.rpc.mock.calls.some(
        ([nome]) => nome === "obter_pre_classificacao",
      ),
    ).toBe(false);
    expect(secao.textContent).toContain("Painel da Seleção");
  });
});
