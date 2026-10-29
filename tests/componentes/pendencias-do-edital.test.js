import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { montarListaAprovados } from "../../src/modulos/aprovados/lista-aprovados.tsx";
import { pedirFiltro } from "../../src/app/pedido-de-filtro.js";
import { clicar, digitar, escolher, esperar } from "./interacoes.js";
import { compactarPorArea } from "./candidatos-compactos-falsos.js";
import {
  publicarLinhasDoMonitoramento,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.ts";
import { aberturaPelasChamadasDeAntes } from "./abertura-dos-aprovados.js";

/*
  A aba Pendências da Lista de aprovados (migration 20261026190000), com dados
  fictícios: o selo com as abertas, os indicadores por tipo, o filtro de
  edital, o botão Decidir só para quem o banco diz que pode, o modal que pede
  a escolha e o motivo e manda a RPC certa, e o caso do aviso de conferência
  que abre a aba no edital.
*/

beforeEach(() =>
  publicarLinhasDoMonitoramento(
    ["e1", "e2"].map((id) => ({ id, CO_AREA: "saude-indigena" })),
  ),
);
afterEach(() => redefinirDadosDoMonitoramento());

const linha = (id, extra = {}) => ({
  id,
  nome: `Pessoa Fictícia ${id}`,
  cargo: "Enfermeiro",
  vaga: "100",
  modalidade: "Ampla Concorrência",
  posicao: 1,
  nota: 80,
  status: "",
  matricula: "",
  convocado_em: null,
  lista_ativa: true,
  removida: false,
  ...extra,
});

const PENDENCIAS = (podeDecidir = true) => [
  {
    id: "p-listas",
    tipo: "CONTRATADO_EM_DUAS_LISTAS",
    situacao: "ABERTA",
    edital_id: "e1",
    edital: "01/2026",
    unidade: "DSEI Fictício",
    detalhe: { linhas: 2, motivo: "NENHUMA_ALCANCADA" },
    detectada_em: "2026-10-26T09:00:00Z",
    pode_decidir: podeDecidir,
    linhas: [
      linha("a1", { status: "Contratado", matricula: "M-1" }),
      linha("a2", {
        status: "Contratado",
        matricula: "M-1",
        modalidade: "PPIQ",
        vaga: "101",
      }),
    ],
    historico: [],
  },
  {
    id: "p-posicao",
    tipo: "POSICAO_REPETIDA",
    situacao: "ABERTA",
    edital_id: "e2",
    edital: "02/2026",
    unidade: "CASAI Fictícia",
    detalhe: { linhas: 2, posicao: 7 },
    detectada_em: "2026-10-26T09:00:00Z",
    pode_decidir: podeDecidir,
    linhas: [linha("b1", { posicao: 7 }), linha("b2", { posicao: 7 })],
    historico: [],
  },
  {
    id: "p-convocado",
    tipo: "CONVOCADO_SEM_DESFECHO",
    situacao: "ABERTA",
    edital_id: "e2",
    edital: "02/2026",
    unidade: "CASAI Fictícia",
    detalhe: { linhas: 1, convocado_em: "2026-09-01", dias: 55, prazo: 15 },
    detectada_em: "2026-10-26T09:00:00Z",
    pode_decidir: podeDecidir,
    linhas: [linha("c1", { status: "Convocado", convocado_em: "2026-09-01" })],
    historico: [],
  },
  {
    id: "p-resolvida",
    tipo: "PESSOA_REPETIDA",
    situacao: "RESOLVIDA",
    edital_id: "e1",
    edital: "01/2026",
    unidade: "DSEI Fictício",
    detalhe: { linhas: 2 },
    detectada_em: "2026-10-20T09:00:00Z",
    decisao: "LINHA_MANTIDA",
    motivo: "Duplicada na importação",
    decidida_em: "2026-10-21T12:00:00Z",
    decidida_por: "Gestora Fictícia",
    pode_decidir: podeDecidir,
    linhas: [linha("d1"), linha("d2", { removida: true })],
    historico: [
      {
        evento: "DECISAO",
        decisao: "LINHA_MANTIDA",
        motivo: "Duplicada na importação",
        por: "Gestora Fictícia",
        em: "2026-10-21T12:00:00Z",
        alteracoes: [
          { candidato: "d2", campo: "removido", antes: false, depois: true },
        ],
      },
    ],
  },
];

function supabaseFalso({ podeDecidir = true } = {}) {
  const banco = { pendencias: PENDENCIAS(podeDecidir) };
  const responderRpc = (nome, argumentos) => {
    if (nome === "listar_pendencias_do_edital")
      return Promise.resolve({
        data: {
          schema_version: 1,
          area: argumentos.p_area,
          pendencias: banco.pendencias,
        },
        error: null,
      });
    if (nome === "listar_candidatos_aprovados_compacto")
      return Promise.resolve({
        data: compactarPorArea([], { area: argumentos?.p_area, versao: "v1" }),
        error: null,
      });
    if (nome === "escolher_lista_da_contratacao") {
      banco.pendencias = banco.pendencias.map((p) =>
        p.id === argumentos.p_pendencia
          ? { ...p, situacao: "RESOLVIDA", decisao: "LISTA_ESCOLHIDA" }
          : p,
      );
      return Promise.resolve({ data: { ok: true }, error: null });
    }
    if (nome === "confirmar_empate_da_posicao")
      return Promise.resolve({
        data: null,
        error: {
          message: "Sem permissão para decidir as pendências deste edital",
        },
      });
    const resposta = Promise.resolve({ data: [], error: null });
    resposta.range = () => resposta;
    return resposta;
  };
  // A abertura da página numa chamada, montada com as respostas acima.
  const rpc = vi.fn((nome, argumentos) =>
    nome === "abrir_lista_aprovados"
      ? aberturaPelasChamadasDeAntes(responderRpc, argumentos)
      : responderRpc(nome, argumentos),
  );
  return { rpc, storage: { from: vi.fn() } };
}

let controlador = null;

async function montar(opcoes = {}) {
  document.body.innerHTML = `<section id="page-approved" class="page active"></section>`;
  const supabase = supabaseFalso(opcoes);
  const toast = vi.fn();
  await act(async () => {
    controlador = montarListaAprovados({
      secao: document.getElementById("page-approved"),
      supabase,
      toast,
      getProfile: () => ({ perfil: "edital_gestor" }),
      hoje: () => "2026-10-26",
    });
  });
  await esperar(() => controlador.render());
  await esperar(() => controlador.pendencias.carregar("saude-indigena"));
  return { supabase, toast };
}

afterEach(async () => {
  await act(async () => controlador?.raiz?.unmount());
  controlador = null;
  document.body.innerHTML = "";
});

const $ = (id) => document.getElementById(id);
const cartoes = () => [
  ...document.querySelectorAll("#approvedPanelPendencias .pendencia-cartao"),
];

describe("aba Pendências", () => {
  it("o selo vem com a abertura da página; abrir a aba não lê de novo", async () => {
    document.body.innerHTML = `<section id="page-approved" class="page active"></section>`;
    const supabase = supabaseFalso();
    await act(async () => {
      controlador = montarListaAprovados({
        secao: document.getElementById("page-approved"),
        supabase,
        toast: vi.fn(),
        getProfile: () => ({ perfil: "edital_gestor" }),
        hoje: () => "2026-10-26",
      });
    });
    await esperar(() => controlador.render());
    expect($("approvedPendenciasSelo").textContent).toBe("3");
    await clicar($("approvedTabPendencias"));
    expect(cartoes()).toHaveLength(3);
    expect(supabase.rpc.mock.calls.map(([nome]) => nome)).toEqual([
      "abrir_lista_aprovados",
    ]);
  });

  it("é a terceira aba, com o selo das abertas", async () => {
    await montar();
    const aba = $("approvedTabPendencias");
    expect(aba.getAttribute("role")).toBe("tab");
    expect($("approvedPendenciasSelo").textContent).toBe("3");
    await clicar(aba);
    expect($("approvedPanelPendencias").classList.contains("hidden")).toBe(
      false,
    );
    expect($("approvedPanelAprovados").classList.contains("hidden")).toBe(true);
  });

  it("mostra as abertas com o detalhe; indicadores por tipo filtram", async () => {
    await montar();
    await clicar($("approvedTabPendencias"));
    expect(cartoes().map((c) => c.dataset.tipo)).toEqual([
      "CONTRATADO_EM_DUAS_LISTAS",
      "POSICAO_REPETIDA",
      "CONVOCADO_SEM_DESFECHO",
    ]);
    expect(cartoes()[1].textContent).toContain(
      "Posição 7 em 2 linhas da mesma vaga e modalidade",
    );
    expect(cartoes()[2].textContent).toContain(
      "Convocado em 01/09/2026, há 55 dias",
    );
    await clicar(
      document.querySelector(
        '#approvedPanelPendencias [data-kpi="POSICAO_REPETIDA"] .ui-kpi-alvo',
      ),
    );
    expect(cartoes().map((c) => c.dataset.tipo)).toEqual(["POSICAO_REPETIDA"]);
  });

  it("filtra por edital e mostra as resolvidas com decisão, motivo e histórico", async () => {
    await montar();
    await clicar($("approvedTabPendencias"));
    const edital = document.querySelector(
      "#approvedPanelPendencias .pendencias-filtros select",
    );
    expect([...edital.options].map((o) => o.textContent)).toEqual([
      "Todos os editais",
      "01/2026 · DSEI Fictício (1)",
      "02/2026 · CASAI Fictícia (2)",
    ]);
    await escolher(edital, "e1");
    expect(cartoes()).toHaveLength(1);
    const resolvidas = [
      ...document.querySelectorAll(
        "#approvedPanelPendencias .ui-segmentado-opcao",
      ),
    ].find((b) => b.textContent.includes("Resolvidas"));
    await clicar(resolvidas);
    expect(cartoes()).toHaveLength(1);
    expect(cartoes()[0].textContent).toContain("Linha mantida, a outra saiu");
    expect(cartoes()[0].textContent).toContain(
      "Motivo: Duplicada na importação",
    );
    expect(cartoes()[0].textContent).toContain("saiu da lista");
    expect(cartoes()[0].querySelector("[data-acao='decidir']")).toBeNull();
  });

  it("decidir: escolhe a lista, motivo obrigatório, manda a RPC e recarrega", async () => {
    const { supabase, toast } = await montar();
    await clicar($("approvedTabPendencias"));
    await clicar(cartoes()[0].querySelector("[data-acao='decidir']"));
    const modal = $("pendenciaModal");
    expect(modal).not.toBeNull();
    // Sem escolha e sem motivo: a tela recusa antes do banco.
    await clicar(modal.querySelector("[data-acao='gravar-decisao']"));
    expect(modal.querySelector(".pendencia-erro").textContent).toMatch(
      /motivo/,
    );
    await digitar(modal.querySelector("textarea"), "Contratada pela ampla");
    await clicar(modal.querySelector("[data-acao='gravar-decisao']"));
    expect(modal.querySelector(".pendencia-erro").textContent).toMatch(/lista/);
    await clicar(modal.querySelector("input[type='radio'][value='a1']"));
    await clicar(modal.querySelector("[data-acao='gravar-decisao']"));
    await esperar(() => Promise.resolve());
    expect(supabase.rpc).toHaveBeenCalledWith("escolher_lista_da_contratacao", {
      p_pendencia: "p-listas",
      p_motivo: "Contratada pela ampla",
      p_candidato: "a1",
    });
    expect(toast).toHaveBeenCalledWith("Decisão registrada.", "success");
    expect($("pendenciaModal")).toBeNull();
    expect($("approvedPendenciasSelo").textContent).toBe("2");
    // A lista de aprovados recarrega (status mudou lá).
    expect(
      supabase.rpc.mock.calls.filter(([n]) => n === "abrir_lista_aprovados")
        .length,
    ).toBeGreaterThan(1);
  });

  it("o erro do banco fica no modal (permissão)", async () => {
    await montar();
    await clicar($("approvedTabPendencias"));
    await clicar(cartoes()[1].querySelector("[data-acao='decidir']"));
    const modal = $("pendenciaModal");
    await clicar(
      [...modal.querySelectorAll(".ui-segmentado-opcao")].find((b) =>
        b.textContent.includes("Empate previsto"),
      ),
    );
    await digitar(modal.querySelector("textarea"), "Empate do item 9.3");
    await clicar(modal.querySelector("[data-acao='gravar-decisao']"));
    await esperar(() => Promise.resolve());
    expect(
      $("pendenciaModal").querySelector(".pendencia-erro").textContent,
    ).toContain("Sem permissão");
  });

  it("Convocado: nova data ou desfecho com matrícula, validados", async () => {
    const { supabase } = await montar();
    await clicar($("approvedTabPendencias"));
    await clicar(cartoes()[2].querySelector("[data-acao='decidir']"));
    const modal = $("pendenciaModal");
    await escolher(modal.querySelector("select"), "Contratado");
    await digitar(modal.querySelector("textarea"), "Assinou o contrato");
    await clicar(modal.querySelector("[data-acao='gravar-decisao']"));
    expect(modal.querySelector(".pendencia-erro").textContent).toMatch(
      /matrícula/,
    );
    await escolher(modal.querySelector("select"), "Convocado");
    await digitar(modal.querySelector("input[type='date']"), "2026-10-30");
    await clicar(modal.querySelector("[data-acao='gravar-decisao']"));
    expect(modal.querySelector(".pendencia-erro").textContent).toMatch(
      /futura/,
    );
    await digitar(modal.querySelector("input[type='date']"), "2026-10-20");
    await clicar(modal.querySelector("[data-acao='gravar-decisao']"));
    await esperar(() => Promise.resolve());
    expect(supabase.rpc).toHaveBeenCalledWith(
      "registrar_desfecho_da_pendencia",
      {
        p_pendencia: "p-convocado",
        p_motivo: "Assinou o contrato",
        p_status: "Convocado",
        p_matricula: null,
        p_data_convocacao: "2026-10-20",
      },
    );
  });

  it("quem não pode decidir vê as pendências sem o botão Decidir", async () => {
    await montar({ podeDecidir: false });
    await clicar($("approvedTabPendencias"));
    expect(cartoes()).toHaveLength(3);
    expect(
      document.querySelector("#approvedPanelPendencias [data-acao='decidir']"),
    ).toBeNull();
  });

  it("o caso de um aviso de conferência abre a aba no edital", async () => {
    await montar();
    await act(async () =>
      pedirFiltro("approved", {
        pendencias: true,
        edital: "e2",
        candidatos: ["c1"],
      }),
    );
    expect($("approvedTabPendencias").getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(cartoes().map((c) => c.dataset.pendencia)).toEqual([
      "p-posicao",
      "p-convocado",
    ]);
  });
});
