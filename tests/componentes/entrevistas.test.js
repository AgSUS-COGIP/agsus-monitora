import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clicar, escolher, esperar } from "./interacoes.js";

/*
  O painel de entrevistas (entrevistas.html) em React, só leitura: carga ao
  montar, KPIs, filtro, gaveta com o caminho do candidato (sem HTML vindo dos
  dados), lista dos aprovados sem entrevista, estado vazio e sem acesso.
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

const { montarPainelDeEntrevistas } =
  await import("../../src/componentes/entrevistas/entrevistas.jsx");

const PAYLOAD = {
  schema_version: 1,
  area: "saude-indigena",
  gerado_em: "2026-09-29T12:00:00Z",
  ultima_carga: { em: "2026-09-29T10:30:00", linhas: 2 },
  criterios: ["HABILIDADE TÉCNICA (Conhecimentos gerais)", "POSTURA"],
  entrevistas: [
    {
      id: "e1",
      edital_id: "m1",
      edital: "Edital 01/2026",
      edital_planilha: "01/2026",
      unidade: "DSEI Xingu",
      vaga: "V1",
      cargo: "Enfermeiro",
      candidato: "<img src=x onerror=alert(1)>",
      codigo: "C1",
      modalidade: "Ampla",
      nota: 9,
      parecer: "APTO",
      compareceu: "S",
      link: "https://docs.google.com/spreadsheets/d/1",
      notas: [
        [0, 5],
        [1, 4],
      ],
      analise: {
        id: "a1",
        ligacao: "codigo",
        nota: 70,
        resultado: "Aprovado",
        etapa: "Final",
        responsavel: "Carla",
        ativo: true,
      },
    },
    {
      id: "e2",
      edital_id: null,
      edital: "Edital 02/2026",
      edital_planilha: "02/2026",
      unidade: "DSEI Xingu",
      vaga: "V2",
      cargo: "Médico",
      candidato: "Bruno",
      codigo: null,
      modalidade: null,
      nota: 3,
      parecer: "INAPTO",
      compareceu: "S",
      link: "javascript:alert(1)",
      notas: [],
      analise: null,
    },
  ],
  aprovados_sem_entrevista: [
    {
      analise_id: "a9",
      candidato: "Eva",
      codigo: "C9",
      vaga: "V1",
      cargo: "Enfermeiro",
      edital: "Edital 01/2026",
      unidade: "DSEI Xingu",
      nota: 80,
      modalidade: "Ampla",
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
    painel = montarPainelDeEntrevistas({
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

afterEach(async () => {
  await act(async () => painel?.raiz?.unmount());
  raiz?.remove();
  document.body.innerHTML = "";
  document.body.className = "";
});

describe("painel de entrevistas", () => {
  it("carrega a área, mostra KPIs, a última carga e a tabela", async () => {
    const supabase = supabaseFalso({ data: PAYLOAD, error: null });
    await montar(supabase);
    expect(supabase.rpc).toHaveBeenCalledWith("get_entrevistas_da_area", {
      p_area: "saude-indigena",
    });
    expect(document.querySelector("#topbar h1").textContent).toBe(
      "Painel de entrevistas",
    );
    expect(kpi("vagas")).toBe("2");
    expect(kpi("aptos")).toBe("1");
    expect(kpi("inaptos")).toBe("1");
    expect(kpi("media")).toBe("6,00");
    expect(kpi("sem-entrevista")).toBe("1");
    expect(
      naTela(
        "Dados da planilha de entrevistas · última carga 29/09/2026 10:30",
      ),
    ).toBe(true);
    expect(
      document.querySelectorAll("#tableBody tr.entrevistas-linha"),
    ).toHaveLength(2);
    expect(document.querySelector("#tableBody img")).toBeNull();
  });

  it("filtra por parecer e abre a gaveta com o caminho e os critérios", async () => {
    await montar(supabaseFalso({ data: PAYLOAD, error: null }));
    await escolher(document.getElementById("filtro-parecer"), "APTO");
    const linhas = document.querySelectorAll("#tableBody tr.entrevistas-linha");
    expect(linhas).toHaveLength(1);
    await clicar(linhas[0]);
    const gaveta = document.getElementById("entrevistasGaveta");
    expect(gaveta).not.toBeNull();
    expect(gaveta.querySelector("img")).toBeNull();
    expect(gaveta.textContent).toContain("Análise curricular");
    expect(gaveta.textContent).toContain("HABILIDADE TÉCNICA");
    const criterio = gaveta.querySelector(".entrevistas-criterios li");
    expect(criterio.title).toBe("HABILIDADE TÉCNICA (Conhecimentos gerais)");
    const link = [...gaveta.querySelectorAll("a")].find((a) =>
      a.textContent.includes("Abrir planilha da entrevista"),
    );
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener");
  });

  it("link que não é http(s) não vira âncora", async () => {
    await montar(supabaseFalso({ data: PAYLOAD, error: null }));
    await escolher(document.getElementById("filtro-parecer"), "INAPTO");
    await clicar(document.querySelector("#tableBody tr.entrevistas-linha"));
    const gaveta = document.getElementById("entrevistasGaveta");
    expect(gaveta.querySelector("a")).toBeNull();
    expect(gaveta.textContent).toContain("Nenhuma análise curricular ligada");
  });

  it("o KPI abre a lista dos aprovados sem entrevista", async () => {
    await montar(supabaseFalso({ data: PAYLOAD, error: null }));
    await clicar(
      document.querySelector('#kpiGrid [data-kpi="sem-entrevista"] button'),
    );
    const lista = document.getElementById("entrevistasSemEntrevista");
    expect(lista.textContent).toContain("Eva");
  });

  it("área sem entrevistas mostra o estado vazio", async () => {
    await montar(
      supabaseFalso({
        data: { ...PAYLOAD, entrevistas: [], aprovados_sem_entrevista: [] },
        error: null,
      }),
    );
    expect(naTela("Nenhuma entrevista carregada para esta área ainda.")).toBe(
      true,
    );
  });

  it("sem permissão (42501) mostra 'Sem acesso às Entrevistas'", async () => {
    await montar(
      supabaseFalso({ data: null, error: { code: "42501", message: "x" } }),
    );
    expect(document.getElementById("authWarning").textContent).toContain(
      "Sem acesso às Entrevistas",
    );
    expect(document.getElementById("kpiGrid")).toBeNull();
  });
});

describe("cópia guardada (stale-while-revalidate)", async () => {
  const { criarEstadoDasEntrevistas } =
    await import("../../src/componentes/entrevistas/estado.js");

  function memoria() {
    const mapa = new Map();
    return {
      mapa,
      ler: async (chave) => mapa.get(chave) ?? null,
      guardar: async (chave, valor) => void mapa.set(chave, valor),
      apagarTudo: async () => mapa.clear(),
    };
  }

  it("guarda na primeira carga e abre da cópia na seguinte, revalidando", async () => {
    const armazenamento = memoria();
    const primeiro = criarEstadoDasEntrevistas({
      supabase: supabaseFalso({ data: PAYLOAD, error: null }),
      armazenamento,
    });
    expect(await primeiro.carregar("saude-indigena")).toBe(true);
    await vi.waitFor(() =>
      expect(armazenamento.mapa.has("entrevistas:saude-indigena")).toBe(true),
    );

    let responder;
    const lento = {
      ...supabaseFalso(),
      rpc: vi.fn(
        () =>
          new Promise((ok) => {
            responder = ok;
          }),
      ),
    };
    const segundo = criarEstadoDasEntrevistas({
      supabase: lento,
      armazenamento,
    });
    const carga = segundo.carregar("saude-indigena");
    await vi.waitFor(() => expect(segundo.obter().daCopia).toBe(true));
    expect(segundo.obter().dados.entrevistas).toHaveLength(2);
    responder({ data: { ...PAYLOAD, entrevistas: [] }, error: null });
    expect(await carga).toBe(true);
    expect(segundo.obter().daCopia).toBe(false);
    expect(segundo.obter().dados.entrevistas).toHaveLength(0);
  });

  it("acesso revogado apaga a cópia e mostra sem acesso", async () => {
    const armazenamento = memoria();
    await criarEstadoDasEntrevistas({
      supabase: supabaseFalso({ data: PAYLOAD, error: null }),
      armazenamento,
    }).carregar("saude-indigena");
    await vi.waitFor(() => expect(armazenamento.mapa.size).toBe(2));
    const estado = criarEstadoDasEntrevistas({
      supabase: supabaseFalso({ data: null, error: { code: "42501" } }),
      armazenamento,
    });
    await estado.carregar("saude-indigena");
    expect(estado.obter().semAcesso).toBe(true);
    expect(estado.obter().carregado).toBe(false);
    expect(armazenamento.mapa.size).toBe(0);
  });
});
