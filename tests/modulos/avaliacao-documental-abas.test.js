import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  definirAreaAtual,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.ts";
import {
  coordenaOEdital,
  editalParaAbrir,
  lembrarEdital,
  lerEditalLembrado,
  visaoNaTela,
} from "../../src/modulos/avaliacao-documental/abas-e-entrada.ts";
import { montarAvaliacaoDocumental } from "../../src/modulos/avaliacao-documental/avaliacao-documental.tsx";
import { editalVigente } from "../../src/lib/avaliacao-documental/editais.ts";
import { clicar, esperar } from "../componentes/interacoes.js";

/*
  Abas por papel e entrada da Avaliação documental (abas-e-entrada.ts):
  Regra, Equipe e Pré-classificação só para quem coordena o edital; quem
  analisa vê só a Fila (sem seletor). Sem edital escolhido, cartões dos
  editais vigentes; com um só (ou o último aberto), abre direto nele.
  Fixtures sem dado pessoal.
*/

const EU = "u-ana";
const edital = (id, numero, papel, extra = {}) => ({
  id,
  edital: numero,
  unidade: "Boa Vista",
  ativo: true,
  status: "Em andamento",
  versao_regra: 2,
  nome_regra: null,
  situacao_regra: "CONFERIDA",
  papel,
  ...extra,
});

const FILA = (coordena) => ({
  schema_version: 1,
  edital: { id: "e93", rotulo: "93/2026" },
  papel: coordena ? "COORDENADOR" : "ANALISTA",
  pode_coordenar: coordena,
  pode_pegar: true,
  eu: EU,
  prazo_reserva_min: 15,
  distribuicao: { modo: "PEGAR_PROXIMO", criterio: "PARTES_IGUAIS" },
  sem_ficha: 0,
  vagas: [{ codigo: "179698", cargo: "Técnico" }],
  analistas: [],
  filtros: [],
  candidatos: [
    {
      id: "c-7001",
      vaga: "179698",
      codigo: "7001",
      nome: "Pessoa 7001",
      situacao_pre: "NO_LOTE",
      posicao: 1,
      lote: 1,
      art: 20,
      modalidade: "AC",
      ficha: { id: "f1", versao: 1, situacao: "PENDENTE", reserva: null },
    },
  ],
});

function supabaseFalso({ editais, coordena, regraAtrasada = null, concluida = null }) {
  const respostas = {
    listar_editais_avaliacao: () => ({ area: "projetos", editais }),
    obter_regra_analise: ({ p_edital }) => ({
      edital: { id: p_edital, edital: "93/2026", area: "projetos" },
      papel: coordena ? "COORDENADOR" : "ANALISTA",
      pode_coordenar: coordena,
      origem: "PLANILHA",
      regra: null,
      modelos: [],
      nota_minima: null,
      aldeias: { quantidade: 0 },
    }),
    obter_equipe_edital: () => ({
      pode_coordenar: coordena,
      gestores: [],
      equipe: [],
      pessoas: [],
      vagas: [],
    }),
    obter_fila_avaliacao: () => ({
      ...FILA(coordena),
      candidatos: [
        ...FILA(coordena).candidatos,
        ...(concluida ? [concluida] : []),
      ],
    }),
  };
  return {
    rpc: vi.fn(async (nome, args) => {
      if (nome === "obter_regra_analise" && regraAtrasada) await regraAtrasada;
      return { data: respostas[nome]?.(args) ?? null, error: null };
    }),
    auth: {
      getSession: async () => ({ data: { session: { user: { id: EU } } } }),
    },
  };
}

let secao;
let painel;

async function montar(supabase) {
  secao = document.createElement("section");
  secao.id = "page-avaliacao-documental";
  secao.className = "page active";
  document.body.append(secao);
  await act(async () => {
    painel = montarAvaliacaoDocumental({ supabase, toast: vi.fn() });
  });
  await act(async () => void painel.render());
  await esperar();
  await esperar();
}
const abas = () =>
  [...secao.querySelectorAll("[data-tour='avd-visoes'] [data-valor]")].map(
    (b) => b.getAttribute("data-valor"),
  );
const botoes = () =>
  [...secao.querySelectorAll("button")].map((b) => b.textContent.trim());
const chamou = (supabase, nome) =>
  supabase.rpc.mock.calls.some(([n]) => n === nome);

beforeEach(() => {
  redefinirDadosDoMonitoramento();
  definirAreaAtual("projetos");
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(async () => {
  await act(async () => painel?.raiz?.unmount());
  secao?.remove();
});

describe("abas por papel", () => {
  it("quem coordena vê as quatro áreas, a configuração e o atalho legado", async () => {
    const supabase = supabaseFalso({
      editais: [edital("e93", "93/2026", "COORDENADOR")],
      coordena: true,
    });
    await montar(supabase);
    expect(abas()).toEqual(["fila", "resultados", "espelhos", "configuracoes"]);
    expect(painel.estado.obter().visao).toBe("fila");
    expect(chamou(supabase, "obter_equipe_edital")).toBe(true);
    expect(botoes()).toContain("Abrir pré-classificação");
    act(() => painel.estado.mudarVisao("pre"));
    expect(botoes()).not.toContain("Abrir pré-classificação");
    act(() => painel.estado.mudarVisao("configuracoes"));
    expect(secao.querySelector("[aria-label='Configurações da avaliação documental']")).not.toBeNull();
    expect(botoes()).toContain("Abrir pré-classificação");
    act(() => painel.estado.mudarVisao("espelhos"));
    expect(secao.querySelector("[aria-label='Emissão dos espelhos de nota']")).not.toBeNull();
  });

  it("quem analisa vê Fila e Resultados sem operações da coordenação", async () => {
    const supabase = supabaseFalso({
      editais: [edital("e93", "93/2026", "ANALISTA")],
      coordena: false,
    });
    await montar(supabase);
    expect(abas()).toEqual(["fila", "resultados"]);
    expect(painel.estado.obter().visao).toBe("fila");
    expect(secao.querySelector("[data-candidato='7001']")).not.toBeNull();
    // Nenhum atalho para as abas da coordenação, e a equipe nem é lida.
    for (const rotulo of ["Regra", "Equipe", "Pré-classificação"])
      expect(botoes()).not.toContain(rotulo);
    expect(chamou(supabase, "obter_equipe_edital")).toBe(false);
    expect(chamou(supabase, "obter_pre_classificacao")).toBe(false);
    act(() => painel.estado.mudarVisao("resultados"));
    expect(secao.querySelector("[aria-label='Resultados da avaliação documental']")).not.toBeNull();
    act(() => painel.estado.mudarVisao("espelhos"));
    act(() => painel.estado.mudarVisao("configuracoes"));
    expect(painel.estado.obter().visao).toBe("resultados");
  });

  it("mostra somente resultados registrados, sem recalcular nota", async () => {
    const supabase = supabaseFalso({
      editais: [edital("e93", "93/2026", "ANALISTA")],
      coordena: false,
      concluida: {
        id: "c-7002",
        codigo: "7002",
        nome: "Pessoa 7002",
        vaga: "179698",
        modalidade: "AC",
        ficha: {
          id: "f2",
          situacao: "CONCLUIDA",
          resultado: "APTO",
          nota_final: 17,
          motivo_saida: "Avaliação concluída",
        },
      },
    });
    await montar(supabase);
    act(() => painel.estado.mudarVisao("resultados"));
    await esperar();
    const linha = secao.querySelector("[data-resultado-candidato='7002']");
    expect(linha).not.toBeNull();
    expect(linha.textContent).toContain("17");
    expect(linha.textContent).toContain("APTO");
    expect(secao.querySelector("[data-resultado-candidato='7001']")).toBeNull();
  });

  it("a visão 'regra' guardada vira Fila para quem analisa (e não volta)", async () => {
    const supabase = supabaseFalso({
      editais: [edital("e93", "93/2026", "ANALISTA")],
      coordena: false,
    });
    await montar(supabase);
    // O estado agora começa na Fila, sem expor configurações.
    expect(painel.estado.obter().visao).toBe("fila");
    act(() => painel.estado.mudarVisao("regra"));
    act(() => painel.estado.mudarVisao("pre"));
    expect(painel.estado.obter().visao).toBe("fila");
    expect(secao.querySelector(".avd-campos")).toBeNull();
  });

  it("enquanto o edital carrega, a aba proibida não pisca", async () => {
    let soltar;
    const regraAtrasada = new Promise((r) => (soltar = r));
    const supabase = supabaseFalso({
      editais: [edital("e93", "93/2026", "ANALISTA")],
      coordena: false,
      regraAtrasada,
    });
    await montar(supabase);
    expect(painel.estado.obter().dados).toBeNull();
    expect(abas()).toEqual([]);
    expect(botoes()).not.toContain("Regra");
    await act(async () => soltar());
    await esperar();
    expect(abas()).toEqual(["fila", "resultados"]);
  });
});

describe("entrada da tela", () => {
  const VARIOS = [
    edital("e93", "93/2026", "ANALISTA", {
      fichas: { concluidas: 4, pendentes: 10, minhas_em_analise: 2 },
    }),
    edital("e114", "114/2026", "REVISOR", { situacao_regra: "CONFERIR" }),
    edital("e23", "23/2025", null, { status: "Concluído" }),
  ];

  it("com vários editais: cartões dos vigentes, sem abas; clicar abre", async () => {
    const supabase = supabaseFalso({ editais: VARIOS, coordena: false });
    await montar(supabase);
    expect(painel.estado.obter().editalId).toBe("");
    expect(secao.querySelector(".ui-topo [data-tour='avd-visoes']")).toBeNull();
    expect(secao.querySelector("[data-aba-unica]")).toBeNull();
    const cartoes = [...secao.querySelectorAll(".avd-entrada-cartao")];
    expect(cartoes.map((c) => c.getAttribute("data-edital"))).toEqual([
      "e93",
      "e114",
    ]);
    expect(cartoes[0].textContent).toContain("Conferida");
    expect(cartoes[0].textContent).toContain("4 concluídas · 10 pendentes");
    expect(cartoes[0].textContent).toContain("Suas fichas: 2 em análise");
    expect(cartoes[1].textContent).toContain("A conferir");
    await clicar(cartoes[1]);
    await esperar();
    expect(painel.estado.obter().editalId).toBe("e114");
    expect(secao.querySelector(".avd-entrada")).toBeNull();
    expect(lerEditalLembrado(EU, "projetos")).toBe("e114");
  });

  it("com um edital vigente só, abre direto nele", async () => {
    const supabase = supabaseFalso({
      editais: [edital("e93", "93/2026", "COORDENADOR"), VARIOS[2]],
      coordena: true,
    });
    await montar(supabase);
    expect(painel.estado.obter().editalId).toBe("e93");
    expect(secao.querySelector(".avd-entrada")).toBeNull();
  });

  it("reabre no último edital aberto pela pessoa", async () => {
    lembrarEdital(EU, "projetos", "e114");
    const supabase = supabaseFalso({ editais: VARIOS, coordena: false });
    await montar(supabase);
    expect(painel.estado.obter().editalId).toBe("e114");
  });
});

describe("abas-e-entrada (regras puras)", () => {
  it("coordenaOEdital: o edital carregado decide; antes, o papel da lista", () => {
    const editais = [{ id: "a", papel: "COORDENADOR" }, { id: "b" }];
    expect(coordenaOEdital({ editais, editalId: "" })).toBeNull();
    expect(coordenaOEdital({ editais, editalId: "a" })).toBe(true);
    expect(coordenaOEdital({ editais, editalId: "b" })).toBeNull();
    expect(
      coordenaOEdital({ editais, editalId: "a", dados: { pode_coordenar: 0 } }),
    ).toBe(false);
    expect(visaoNaTela({ editais, editalId: "b", visao: "pre" })).toBe("fila");
    expect(visaoNaTela({ editais, editalId: "a", visao: "pre" })).toBe("pre");
  });

  it("editalParaAbrir: preferido, único vigente ou único na equipe", () => {
    const v = (id, papel = null, ativo = true) => ({ id, papel, ativo });
    expect(editalParaAbrir([v("a"), v("b")], editalVigente, ["b"])).toBe("b");
    expect(editalParaAbrir([v("a"), v("b")], editalVigente, ["x"])).toBe("");
    expect(editalParaAbrir([v("a"), v("b", null, false)], editalVigente)).toBe(
      "a",
    );
    expect(editalParaAbrir([v("a"), v("b", "ANALISTA")], editalVigente)).toBe(
      "b",
    );
  });

  it("lembrar o edital tolera navegador sem armazenamento", () => {
    const quebrado = {
      getItem() {
        throw new Error("bloqueado");
      },
      setItem() {
        throw new Error("bloqueado");
      },
      removeItem() {
        throw new Error("bloqueado");
      },
    };
    expect(() => lembrarEdital(EU, "projetos", "e1", quebrado)).not.toThrow();
    expect(lerEditalLembrado(EU, "projetos", quebrado)).toBe("");
    expect(lerEditalLembrado(null, "projetos")).toBe("");
  });
});
