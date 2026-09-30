import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clicar, escolher, esperar } from "./interacoes.js";

/*
  O painel de seleção (selecao.html) em React, só leitura: carga ao montar,
  KPIs, filtro, gaveta com o funil da vaga (sem HTML vindo dos dados), estado
  vazio e sem acesso.
*/

vi.mock("../../src/lib/chartjs-global.js", () => ({
  Chart: class {
    constructor(canvas, configuracao) {
      this.data = configuracao.data;
      this.options = configuracao.options;
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
      total_eliminados: 14,
      observacao: "<b>1 Interessado</b>",
      convocados: 10,
      origem_convocados: "entrevistas",
      aprovados: 5,
      contratados: 2,
      nao_contratados: 3,
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

afterEach(async () => {
  await act(async () => painel?.raiz?.unmount());
  raiz?.remove();
  document.body.innerHTML = "";
  document.body.className = "";
});

describe("painel de seleção", () => {
  it("carrega a área, mostra KPIs, a última carga e a tabela", async () => {
    const supabase = supabaseFalso({ data: PAYLOAD, error: null });
    await montar(supabase);
    expect(supabase.rpc).toHaveBeenCalledWith("get_selecao_da_area", {
      p_area: "saude-indigena",
    });
    expect(document.querySelector("#topbar h1").textContent).toBe(
      "Painel de seleção",
    );
    expect(kpi("vagas")).toBe("2");
    expect(kpi("inscritos")).toBe("122");
    expect(kpi("convocados")).toBe("14");
    expect(kpi("aprovados")).toBe("5");
    expect(kpi("nao-contratados")).toBe("3");
    expect(
      naTela("Dados da planilha Auditoria · última carga 01/10/2026 09:02"),
    ).toBe(true);
    expect(linhas()).toHaveLength(2);
    expect(document.querySelector("#tableBody img")).toBeNull();
    // Convocados que vêm da planilha levam o selo; outra banca não tem código.
    expect(linhas()[1].textContent).toContain("Planilha");
    expect(linhas()[1].textContent).toContain("Outra banca");
  });

  it("filtra pela origem dos convocados e abre a gaveta com o funil", async () => {
    await montar(supabaseFalso({ data: PAYLOAD, error: null }));
    await escolher(document.getElementById("filtro-origem"), "entrevistas");
    expect(linhas()).toHaveLength(1);
    await clicar(linhas()[0]);
    const gaveta = document.getElementById("selecaoGaveta");
    expect(gaveta).not.toBeNull();
    expect(gaveta.querySelector("img, b")).toBeNull();
    expect(gaveta.textContent).toContain("Triados");
    expect(gaveta.textContent).toContain("Entrevistas do MONITORA");
    expect(gaveta.textContent).toContain("<b>1 Interessado</b>");
  });

  it("vaga sem lista de aprovados explica o vazio", async () => {
    await montar(supabaseFalso({ data: PAYLOAD, error: null }));
    await escolher(document.getElementById("filtro-origem"), "planilha");
    await clicar(linhas()[0]);
    expect(document.getElementById("selecaoGaveta").textContent).toContain(
      "O edital da planilha não foi encontrado no MONITORA.",
    );
  });

  it("área sem vagas mostra o estado vazio", async () => {
    await montar(
      supabaseFalso({ data: { ...PAYLOAD, vagas: [] }, error: null }),
    );
    expect(naTela("Nenhuma vaga carregada para esta área ainda.")).toBe(true);
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
