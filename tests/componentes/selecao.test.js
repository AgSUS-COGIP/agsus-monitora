import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clicar, digitar, esperar } from "./interacoes.js";

/*
  O painel de seleção (selecao.html) em React: a mesma tela do antigo painel
  externo "AgSUS Monitora Recrutamento e Seleção" — filtros de escolha
  múltipla, 7 KPIs, recorte, 5 gráficos, alertas da coluna Observação e a base
  operacional —, sem HTML vindo dos dados, com estado vazio e sem acesso.
*/

const graficos = [];
vi.mock("../../src/lib/chartjs-global.js", () => ({
  Chart: class {
    constructor(canvas, configuracao) {
      this.canvas = canvas;
      this.data = configuracao.data;
      this.options = configuracao.options;
      this.plugins = configuracao.plugins;
      graficos.push(this);
    }
    update() {}
    destroy() {}
  },
}));

const { montarPainelDeSelecao } =
  await import("../../src/componentes/selecao/selecao.jsx");

const PAYLOAD = {
  schema_version: 1,
  area: "saude-indigena",
  gerado_em: "2026-10-01T12:00:00Z",
  ultima_carga: { em: "2026-10-01T09:02:00", linhas: 2, sem_edital: 1 },
  vagas: [
    {
      id: "v1",
      edital_id: "m6",
      edital: "06/2026",
      unidade: "DSEI Xingu",
      vaga: "104123",
      cargo: "<img src=x onerror=alert(1)>",
      inscritos: 83,
      aptos: 72,
      cancelados: 2,
      reprovados_questionario: 9,
      eliminados_nota: 0,
      reprovados_analise: 3,
      triados: 69,
      total_eliminados: 11,
      observacao: "<b>1 Interessado</b>",
      convocados: 10,
      origem_convocados: "entrevistas",
      aprovados: 8,
      contratados: 2,
      nao_contratados: 6,
    },
    {
      id: "v3",
      edital_id: null,
      edital: "96/2025",
      unidade: "Projeto Agora Tem Especialistas Caminhoneiros",
      vaga: null,
      vaga_planilha: "CARGO 1: MÉDICO",
      cargo: "CARGO 1: MÉDICO",
      inscritos: 39,
      total_eliminados: 0,
      convocados: 4,
      origem_convocados: "planilha",
      aprovados: null,
    },
  ],
};

const supabaseFalso = (resposta) => ({
  rpc: vi.fn(async () => resposta),
  auth: {
    getSession: async () => ({ data: { session: { user: { id: "u" } } } }),
  },
});

let raiz;
let painel;

async function montar(supabase) {
  raiz = document.createElement("div");
  document.body.append(raiz);
  await act(async () => {
    painel = montarPainelDeSelecao({
      raiz,
      supabase,
      area: "saude-indigena",
      nomeDaArea: "Saúde Indígena",
      toast: vi.fn(),
      baixar: vi.fn(),
    });
  });
  await esperar();
  return painel;
}

const kpi = (chave) =>
  document.querySelector(`#kpiGrid [data-kpi="${chave}"] b`)?.textContent;
const naTela = (texto) => document.body.textContent.includes(texto);
const linhas = () => document.querySelectorAll("#tableBody tr.selecao-linha");
const opcaoDoFiltro = (id, rotulo) =>
  [
    ...document
      .getElementById(id)
      .closest(".multi-select")
      .querySelectorAll(".multi-select-option"),
  ]
    .find((opcao) => opcao.textContent === rotulo)
    ?.querySelector("input");

afterEach(async () => {
  await act(async () => painel?.raiz?.unmount());
  raiz?.remove();
  graficos.length = 0;
  document.body.innerHTML = "";
  document.body.className = "";
});

describe("painel de seleção", () => {
  it("abre com o título, os 7 KPIs, o recorte e a base do painel antigo", async () => {
    const supabase = supabaseFalso({ data: PAYLOAD, error: null });
    await montar(supabase);
    expect(supabase.rpc).toHaveBeenCalledWith("get_selecao_da_area", {
      p_area: "saude-indigena",
    });
    expect(document.querySelector("#topbar h1").textContent).toBe(
      "AgSUS Monitora Recrutamento e Seleção",
    );
    expect(
      [...document.querySelectorAll("#kpiGrid .kpi span")].map(
        (s) => s.textContent,
      ),
    ).toEqual([
      "Inscritos",
      "Aptos",
      "Triados",
      "Convocados entrevista",
      "Aprovados",
      "Contratados",
      "Taxa contratação",
    ]);
    expect(kpi("inscritos")).toBe("122");
    expect(kpi("convocados")).toBe("14");
    expect(kpi("taxa")).toBe("25%");
    expect(
      naTela("Sem filtros aplicados. Visualizando toda a base carregada."),
    ).toBe(true);
    expect(naTela("Atualizado: 01/10/2026 09:02")).toBe(true);
    expect(naTela("Base operacional consolidada")).toBe(true);
    expect(linhas()).toHaveLength(2);
    expect(document.querySelector("#tableBody img")).toBeNull();
    expect(linhas()[1].textContent).toContain("CARGO 1: MÉDICO");
  });

  it("desenha os 5 gráficos, com o medidor de contratação", async () => {
    await montar(supabaseFalso({ data: PAYLOAD, error: null }));
    // O StrictMode monta duas vezes em desenvolvimento: contam os distintos.
    expect([...new Set(graficos.map((g) => g.canvas.id))]).toEqual([
      "chartEliminados",
      "chartAptos",
      "chartContratados",
      "chartAnalise",
      "chartDsei",
    ]);
    const medidor = graficos.findLast(
      (g) => g.canvas.id === "chartContratados",
    );
    expect(medidor.options.circumference).toBe(180);
    expect(medidor.options.plugins.selecaoTextoNoCentro.principal).toBe("25%");
  });

  it("filtra por DSEI na escolha múltipla e o recorte descreve o filtro", async () => {
    await montar(supabaseFalso({ data: PAYLOAD, error: null }));
    await clicar(opcaoDoFiltro("filtro-unidades", "DSEI Xingu"));
    expect(linhas()).toHaveLength(1);
    expect(kpi("inscritos")).toBe("83");
    expect(naTela("Recorte ativo: Nome DSEI: DSEI Xingu")).toBe(true);
    // Escolhido o DSEI, o filtro de edital só oferece os editais dele.
    expect(opcaoDoFiltro("filtro-editais", "96/2025")).toBeUndefined();
    await clicar(document.querySelector("#filterChips .chip-filter"));
    expect(linhas()).toHaveLength(2);
  });

  it("mostra os alertas da coluna Observação como texto", async () => {
    await montar(supabaseFalso({ data: PAYLOAD, error: null }));
    const alertas = document.getElementById("observationsSection");
    expect(alertas.textContent).toContain("Alertas identificados no recorte");
    expect(alertas.textContent).toContain("<b>1 Interessado</b>");
    expect(alertas.querySelector("b")).toBeNull();
  });

  it("a busca da tabela olha DSEI, edital, cargo e observação", async () => {
    await montar(supabaseFalso({ data: PAYLOAD, error: null }));
    await digitar(document.getElementById("tableSearch"), "interessado");
    expect(linhas()).toHaveLength(1);
  });

  it("área sem vagas mostra o estado vazio", async () => {
    await montar(
      supabaseFalso({ data: { ...PAYLOAD, vagas: [] }, error: null }),
    );
    expect(naTela("Nenhuma vaga carregada para esta área ainda.")).toBe(true);
    expect(document.getElementById("observationsSection")).toBeNull();
  });

  it("sem permissão (42501) mostra 'Sem acesso à Seleção'", async () => {
    await montar(
      supabaseFalso({ data: null, error: { code: "42501", message: "x" } }),
    );
    expect(document.getElementById("authWarning").textContent).toContain(
      "Sem acesso à Seleção",
    );
    expect(document.getElementById("kpiGrid")).toBeNull();
  });
});
