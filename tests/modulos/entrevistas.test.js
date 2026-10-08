import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  definirAreaAtual,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.ts";
import { EVENTO_TEMA_ALTERADO } from "../../src/lib/eventos-da-barra-lateral.js";
import {
  clicar,
  digitar,
  escolher,
  esperar,
  teclar,
} from "../componentes/interacoes.js";

/*
  O Painel de entrevistas como módulo do app (src/modulos/entrevistas/): monta
  na própria `#page-entrevistas`, carrega a área atual do app quando o legado
  abre a tela (`render()`), segue o tema do app, usa o aviso global e os
  componentes de src/ui/ (classes .ui-*). "Resultados": KPIs, filtro, gaveta
  com o caminho do candidato (sem HTML vindo dos dados), lista dos aprovados
  sem entrevista, estado vazio e sem acesso; a
  agenda dos próximos dias, os empates e as pendências de andamento.
  "Conduzir entrevistas" (o fazer) é outra tela: conduzir-entrevistas.test.js.
*/

// O Chart.js não desenha no jsdom (sem canvas): um falso guarda o que recebeu.
const graficos = vi.hoisted(() => []);
vi.mock("../../src/lib/chartjs-global.js", () => ({
  Chart: class {
    constructor(canvas, configuracao) {
      this.canvas = canvas;
      this.config = configuracao;
      this.data = configuracao.data;
      this.options = configuracao.options;
      this.atualizacoes = 0;
      graficos.push(this);
    }
    update() {
      this.atualizacoes += 1;
    }
    destroy() {
      graficos.splice(graficos.indexOf(this), 1);
    }
  },
}));

const { montarEntrevistas } =
  await import("../../src/modulos/entrevistas/entrevistas.jsx");

const PAYLOAD = {
  schema_version: 1,
  area: "saude-indigena",
  gerado_em: "2026-09-29T12:00:00Z",
  ultima_carga: { em: "2026-09-29T10:30:00-03:00", linhas: 2 },
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

const supabaseFalso = (resposta, auth) => ({
  rpc: vi.fn(async () => resposta),
  auth: auth || {
    getSession: async () => ({ data: { session: { user: { id: "u" } } } }),
  },
});

/* Sem IndexedDB nos testes: a cópia guardada fica na memória de cada teste. */
function memoria() {
  const mapa = new Map();
  return {
    mapa,
    ler: async (chave) => mapa.get(chave) ?? null,
    guardar: async (chave, valor) => void mapa.set(chave, valor),
    apagarTudo: async () => mapa.clear(),
  };
}

let secao;
let painel;
const toast = vi.fn();
const baixar = vi.fn();

/*
  Como o app monta: o módulo nasce na `<section id="page-entrevistas">`
  (vazia, sem pedir nada ao banco) e o legado chama `render()` ao navegar
  para a tela. A área é a área atual do app (dados-do-monitoramento.ts).
*/
async function montar(supabase, { abrir = true, ...opcoes } = {}) {
  secao = document.createElement("section");
  secao.id = "page-entrevistas";
  secao.className = "page active";
  document.body.append(secao);
  await act(async () => {
    painel = montarEntrevistas({
      supabase,
      toast,
      baixar,
      armazenamento: memoria(),
      ...opcoes,
    });
  });
  if (abrir) await abrirATela();
  return painel;
}

async function abrirATela() {
  await act(async () => void painel.render());
  await esperar();
}

const kpi = (chave) =>
  document.querySelector(
    `.entrevistas-kpis [data-kpi="${chave}"] .ui-kpi-valor`,
  )?.textContent;
const linhasDaTabela = () =>
  document.querySelectorAll(".ui-tabela tbody tr.entrevistas-linha");
const status = () => document.querySelector(".ui-topo .status-discreto");
const naTela = (texto) => document.body.textContent.includes(texto);
const chamadas = (supabase, nome) =>
  supabase.rpc.mock.calls.filter(([n]) => n === nome);
const botao = (texto) =>
  [...document.querySelectorAll("button")].find((b) =>
    b.textContent.trim().startsWith(texto),
  );

beforeEach(() => {
  redefinirDadosDoMonitoramento();
  definirAreaAtual("saude-indigena");
});

afterEach(async () => {
  await act(async () => painel?.raiz?.unmount());
  secao?.remove();
  document.body.innerHTML = "";
  document.body.className = "";
  document.documentElement.removeAttribute("data-theme");
  redefinirDadosDoMonitoramento();
  localStorage.clear();
  toast.mockClear();
  baixar.mockClear();
});

describe("Resultados", () => {
  it("carrega a área, mostra KPIs, a última carga e a tabela", async () => {
    const supabase = supabaseFalso({ data: PAYLOAD, error: null });
    await montar(supabase);
    expect(supabase.rpc).toHaveBeenCalledWith("get_entrevistas_da_area", {
      p_area: "saude-indigena",
    });
    expect(kpi("vagas")).toBe("2");
    expect(kpi("aptos")).toBe("1");
    expect(kpi("inaptos")).toBe("1");
    expect(kpi("media")).toBe("6,00");
    expect(kpi("sem-entrevista")).toBe("1");
    // A última carga aparece uma vez só, discreta, no topo.
    expect(status().textContent).toBe("Conferido em 29/09, 10:30");
    expect(document.querySelectorAll(".status-discreto")).toHaveLength(1);
    expect(linhasDaTabela()).toHaveLength(2);
    expect(document.querySelector(".ui-tabela tbody img")).toBeNull();
    expect(document.querySelector(".entrevistas-contagem").textContent).toBe(
      "2 entrevistas",
    );
  });

  it("filtra por parecer e abre a gaveta com o caminho e os critérios", async () => {
    await montar(supabaseFalso({ data: PAYLOAD, error: null }));
    await escolher(document.getElementById("filtro-parecer"), "APTO");
    const linhas = linhasDaTabela();
    expect(linhas).toHaveLength(1);
    expect(document.querySelector("[data-recorte]").textContent).toBe(
      "Recorte ativo: Parecer: Apto",
    );
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
    await clicar(linhasDaTabela()[0]);
    const gaveta = document.getElementById("entrevistasGaveta");
    expect(gaveta.querySelector("a")).toBeNull();
    expect(gaveta.textContent).toContain("Nenhuma análise curricular ligada");
  });

  it("o KPI abre a lista dos aprovados sem entrevista", async () => {
    await montar(supabaseFalso({ data: PAYLOAD, error: null }));
    await clicar(
      document.querySelector(
        '.entrevistas-kpis [data-kpi="sem-entrevista"] button',
      ),
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
    expect(
      secao.querySelector(".entrevistas-sem-acesso[role=alert]").textContent,
    ).toContain("Sem acesso às Entrevistas");
    expect(secao.querySelector(".entrevistas-kpis")).toBeNull();
    // Sem acesso, sem as visões no topo.
    expect(secao.querySelector(".entrevistas-visoes")).toBeNull();
  });
});

/*
  O painel "vivo": a agenda dos próximos dias do edital do recorte, os empatados na nota da entrevista (o desempate é na
  Classificação) e as pendências de andamento.
*/
describe("agenda, empates e pendências", () => {
  const hoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const EDITAL_ID = "11111111-2222-4333-8444-555555555555";
  const doEdital = (id, extra) => ({
    ...PAYLOAD.entrevistas[0],
    edital_id: EDITAL_ID,
    id,
    candidato: `Candidato ${id}`,
    codigo: id,
    ...extra,
  });
  const PAYLOAD_DO_EDITAL = {
    ...PAYLOAD,
    entrevistas: [
      doEdital("x1", { nota: 12, parecer: "APTO", compareceu: "S" }),
      doEdital("x2", { nota: 12, parecer: "APTO", compareceu: "S" }),
      doEdital("x3", { nota: null, parecer: "SEM_PARECER", compareceu: "S" }),
      doEdital("x4", { nota: null, parecer: "SEM_PARECER", compareceu: null }),
      doEdital("x5", {
        vaga: "V2",
        nota: 3,
        parecer: "INAPTO",
        compareceu: "N",
      }),
    ],
  };
  const supabaseDoEdital = (agenda) => ({
    rpc: vi.fn(async (nome) =>
      nome === "obter_agenda_entrevista"
        ? { data: agenda, error: null }
        : { data: PAYLOAD_DO_EDITAL, error: null },
    ),
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "u" } } } }),
    },
  });

  it("um edital só: a agenda dos próximos dias dele, sem o andamento em cartões", async () => {
    const supabase = supabaseDoEdital({
      itens: [
        {
          analise_id: "a1",
          nome: "Candidato x4",
          vaga: "V1",
          data: hoje,
          inicio: "08:00",
        },
      ],
    });
    await montar(supabase);
    expect(secao.querySelector(".entrevistas-andamento")).toBeNull();
    expect(secao.querySelector("[data-cartao]")).toBeNull();
    // A agenda do edital do recorte (m1).
    expect(chamadas(supabase, "obter_agenda_entrevista")[0][1]).toEqual({
      p_edital: EDITAL_ID,
    });
    const agenda = secao.querySelector(".entrevistas-agenda-proxima");
    expect(agenda.querySelector('[data-hoje="sim"]').textContent).toContain(
      "Candidato x4",
    );
  });

  it("empatados na nota: selo na tabela e o aviso que leva à Classificação no edital", async () => {
    await montar(supabaseDoEdital(null));
    const empatadas = [...linhasDaTabela()].filter((tr) =>
      tr.querySelector(".entrevistas-selo-empate"),
    );
    expect(empatadas).toHaveLength(2);
    const aviso = secao.querySelector(".entrevistas-empates");
    expect(aviso.textContent).toContain(
      "2 candidatos empatados na nota da entrevista",
    );
    expect(aviso.textContent).toContain("o desempate é feito na Classificação");
    window.navigate = vi.fn();
    window.classificacaoController = {
      estado: { escolherEdital: vi.fn(async () => true) },
    };
    try {
      await clicar(aviso.querySelector('[data-ir-para="classificacao"]'));
      expect(window.navigate).toHaveBeenCalledWith("classificacao");
      expect(
        window.classificacaoController.estado.escolherEdital,
      ).toHaveBeenCalledWith(EDITAL_ID);
    } finally {
      delete window.navigate;
      delete window.classificacaoController;
    }
  });

  it("pendências de andamento filtram o painel", async () => {
    await montar(supabaseDoEdital(null));
    const pendencia = [
      ...secao.querySelectorAll(".entrevistas-bloco-de-pendencias button"),
    ].find((b) => b.textContent.includes("Compareceu, sem nota"));
    await clicar(pendencia);
    expect(linhasDaTabela()).toHaveLength(1);
    expect(linhasDaTabela()[0].textContent).toContain("Candidato x3");
  });

  it("vários editais: sem agenda até escolher um edital no filtro", async () => {
    await montar(supabaseFalso({ data: PAYLOAD, error: null }));
    expect(secao.querySelector(".entrevistas-andamento")).toBeNull();
    expect(secao.querySelector(".entrevistas-agenda-proxima")).toBeNull();
    await escolher(document.getElementById("filtro-edital"), "Edital 01/2026");
    expect(secao.querySelector(".entrevistas-agenda-proxima")).not.toBeNull();
  });
});

describe("cópia guardada (stale-while-revalidate)", async () => {
  const { criarEstadoDasEntrevistas } =
    await import("../../src/modulos/entrevistas/estado.js");

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
  it("avisa os marcos (vaga pronta) com o usuário, a área, os dados e o liga/desliga do app", async () => {
    const avaliarMarcos = vi.fn();
    const estado = criarEstadoDasEntrevistas({
      supabase: supabaseFalso({ data: PAYLOAD, error: null }),
      armazenamento: memoria(),
      avaliarMarcos,
    });
    await estado.carregar("saude-indigena");
    expect(avaliarMarcos).toHaveBeenLastCalledWith(
      expect.objectContaining({
        usuarioId: "u",
        area: "saude-indigena",
        dados: estado.obter().dados,
        ligadas: false,
      }),
    );
    estado.definirComemoracoes(true);
    await estado.carregar("saude-indigena");
    expect(avaliarMarcos).toHaveBeenLastCalledWith(
      expect.objectContaining({ ligadas: true }),
    );
  });
});

/*
  A tela dentro do app (Etapa 2): monta na seção sem pedir nada, abre pelo
  render() do legado, não repete o cabeçalho do app, usa só src/ui/ (.ui-*),
  segue o tema e a área do app e o aviso global.
*/

describe("a tela dentro do app", () => {
  it("monta na seção sem pedir nada; a primeira abertura (render) carrega a área atual", async () => {
    const supabase = supabaseFalso({ data: PAYLOAD, error: null });
    await montar(supabase, { abrir: false });
    expect(secao.querySelector(".ui-tela.entrevistas-tela")).not.toBeNull();
    expect(supabase.rpc).not.toHaveBeenCalled();
    // Antes da área, sem visões (nada a conduzir ainda).
    expect(secao.querySelector(".entrevistas-visoes")).toBeNull();

    await abrirATela();
    expect(supabase.rpc).toHaveBeenCalledWith("get_entrevistas_da_area", {
      p_area: "saude-indigena",
    });
    expect(kpi("candidatos")).toBe("2");
  });

  it("não repete o cabeçalho do app: topo com o status e as ações, sem visões, tema nem tela cheia", async () => {
    await montar(supabaseFalso({ data: PAYLOAD, error: null }));
    const topo = secao.querySelector("header.ui-topo");
    expect(topo.querySelector("h1, h2")).toBeNull();
    // Conduzir entrevistas é outra entrada do menu: o painel não tem visões.
    expect(topo.querySelector(".entrevistas-visoes")).toBeNull();
    expect(
      [...topo.querySelectorAll(".ui-topo-acoes button")].map((b) =>
        b.textContent.trim(),
      ),
    ).toEqual(["Atualizar", "Exportar"]);
    expect(topo.querySelector('[aria-label*="tema"]')).toBeNull();
    expect(topo.querySelector('[aria-label*="tela cheia"]')).toBeNull();
    expect(document.querySelectorAll(".status-discreto")).toHaveLength(1);
    expect(naTela("Somente consulta")).toBe(false);
    expect(naTela("Painel de entrevistas")).toBe(false);
  });

  it("usa src/ui/ com as classes .ui-*, sem o CSS nem os ids do painel de análises", async () => {
    await montar(supabaseFalso({ data: PAYLOAD, error: null }));
    expect(
      secao.querySelector("section.ui-card.ui-filtros h2").textContent,
    ).toBe("Refinar resultados");
    expect(secao.querySelector(".entrevistas-kpis").children).toHaveLength(7);
    expect(
      secao.querySelector('.entrevistas-kpis [data-kpi="inaptos"]').dataset.tom,
    ).toBe("perigo");
    expect(
      [...secao.querySelectorAll(".ui-card .ui-titulo")].map((e) =>
        e.textContent.trim(),
      ),
    ).toEqual(
      expect.arrayContaining([
        "Aptos x Inaptos",
        "Comparecimento",
        "Pendências",
        "Top unidades por entrevistados",
        "Entrevistas",
      ]),
    );
    expect(secao.querySelectorAll(".ui-pendencia").length).toBeGreaterThan(0);
    for (const id of [
      "topbar",
      "themeBtn",
      "fullBtn",
      "refreshBtn",
      "exportBtn",
      "kpiGrid",
      "tableBody",
      "tableSearch",
      "contextLine",
      "attentionList",
      "authWarning",
      "toastHost",
      "entrevistasPainel",
      "analisesDrawerBody",
    ])
      expect(document.getElementById(id), id).toBeNull();
    expect(
      document.querySelector(
        ".topbar, .kpi, .panel, .filter-panel, .table-card, .chart-wrap, .attention-list, .badge, .field, .analises-drawer, .eyebrow",
      ),
    ).toBeNull();
    expect(document.body.classList.contains("analises-is-loading")).toBe(false);
  });

  it("as gavetas são as de src/ui/ (.ui-gaveta), com contexto e seções", async () => {
    await montar(supabaseFalso({ data: PAYLOAD, error: null }));
    await escolher(document.getElementById("filtro-parecer"), "APTO");
    await clicar(linhasDaTabela()[0]);
    const gaveta = document.getElementById("entrevistasGaveta");
    expect(gaveta.classList.contains("ui-gaveta-fundo")).toBe(true);
    expect(gaveta.querySelector(".ui-gaveta-contexto").textContent).toContain(
      "DSEI Xingu",
    );
    expect(gaveta.querySelectorAll(".ui-secao")).toHaveLength(2);
    await teclar(document, "Escape");
    expect(document.getElementById("entrevistasGaveta")).toBeNull();
  });

  it("Exportar baixa o CSV do recorte, com a área no nome", async () => {
    await montar(supabaseFalso({ data: PAYLOAD, error: null }));
    await escolher(document.getElementById("filtro-parecer"), "INAPTO");
    await clicar(secao.querySelector('[data-acao="exportar"]'));
    expect(baixar).toHaveBeenCalledTimes(1);
    const [conteudo, nome] = baixar.mock.calls[0];
    expect(nome).toMatch(/^entrevistas-saude-indigena-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(conteudo).toContain("Bruno");
    expect(conteudo).not.toContain("onerror");
  });

  it("os gráficos são Chart.js; clicar na fatia filtra a tela", async () => {
    await montar(supabaseFalso({ data: PAYLOAD, error: null }));
    expect(
      graficos
        .filter((g) => g.canvas.isConnected)
        .map((g) => g.canvas.id)
        .sort(),
    ).toEqual([
      "chartComparecimento",
      "chartCriterios",
      "chartFaixas",
      "chartParecer",
      "chartUnidades",
    ]);
    const parecer = graficos.find(
      (g) => g.canvas.id === "chartParecer" && g.canvas.isConnected,
    );
    expect(parecer.config.type).toBe("doughnut");
    const indice = parecer.data.labels.indexOf("Inapto");
    await act(async () => parecer.options.onClick(null, [{ index: indice }]));
    expect(linhasDaTabela()).toHaveLength(1);
    expect(
      secao
        .querySelector('.entrevistas-kpis [data-kpi="inaptos"]')
        .classList.contains("is-ativo"),
    ).toBe(true);
  });
});

describe("tema do app", () => {
  it("segue o tema do app: o escuro (data-theme + agsus:tema-alterado) redesenha os gráficos", async () => {
    await montar(supabaseFalso({ data: PAYLOAD, error: null }));
    const grafico = graficos.find(
      (g) => g.canvas.id === "chartFaixas" && g.canvas.isConnected,
    );
    const antes = grafico.atualizacoes;
    expect(grafico.options.scales.y.ticks.color).toBe("#526780");

    await act(async () => {
      document.documentElement.setAttribute("data-theme", "dark");
      document.dispatchEvent(new CustomEvent(EVENTO_TEMA_ALTERADO));
    });
    expect(grafico.atualizacoes).toBeGreaterThan(antes);
    expect(grafico.options.scales.y.ticks.color).toBe("#dbe8f5");
    // Não guarda tema próprio: quem guarda é o app.
    expect(localStorage.getItem("agsus_analises_theme_v3")).toBeNull();
  });

  it("as cores dos gráficos vêm dos tokens do app quando eles existem", async () => {
    document.documentElement.style.setProperty("--text-secondary", "#123456");
    try {
      await montar(supabaseFalso({ data: PAYLOAD, error: null }));
      const grafico = graficos.find(
        (g) => g.canvas.id === "chartUnidades" && g.canvas.isConnected,
      );
      expect(grafico.options.scales.x.ticks.color).toBe("#123456");
    } finally {
      document.documentElement.style.removeProperty("--text-secondary");
    }
  });
});

describe("área atual do app", () => {
  it("trocar a área com a tela aberta recarrega com a nova e zera os filtros", async () => {
    const supabase = supabaseFalso({ data: PAYLOAD, error: null });
    await montar(supabase);
    await clicar(
      secao.querySelector('.entrevistas-kpis [data-kpi="aptos"] button'),
    );
    expect(linhasDaTabela()).toHaveLength(1);

    await act(async () => definirAreaAtual("sede"));
    await esperar();
    expect(chamadas(supabase, "get_entrevistas_da_area").at(-1)[1]).toEqual({
      p_area: "sede",
    });
    expect(painel.estado.obter().area).toBe("sede");
    expect(linhasDaTabela()).toHaveLength(2);
    expect(
      secao
        .querySelector('.entrevistas-kpis [data-kpi="aptos"]')
        .classList.contains("is-ativo"),
    ).toBe(false);
  });

  it("cada abertura pega a área de agora; na mesma área, relê por trás", async () => {
    const supabase = supabaseFalso({ data: PAYLOAD, error: null });
    await montar(supabase);
    await abrirATela();
    expect(chamadas(supabase, "get_entrevistas_da_area")).toHaveLength(2);
    definirAreaAtual("projetos");
    await abrirATela();
    expect(supabase.rpc).toHaveBeenLastCalledWith("get_entrevistas_da_area", {
      p_area: "projetos",
    });
  });

  it("render relê as comemorações do app", async () => {
    let ligadas = false;
    await montar(supabaseFalso({ data: PAYLOAD, error: null }), {
      comemoracoesLigadas: () => ligadas,
    });
    expect(painel.estado.obter().comemoracoes).toBe(false);
    ligadas = true;
    await abrirATela();
    expect(painel.estado.obter().comemoracoes).toBe(true);
  });

  it("outro usuário na mesma aba: o que era do anterior sai da tela", async () => {
    const avisar = [];
    const supabase = supabaseFalso({ data: PAYLOAD, error: null });
    supabase.auth.onAuthStateChange = (ouvinte) => {
      avisar.push(ouvinte);
      return { data: { subscription: { unsubscribe() {} } } };
    };
    await montar(supabase);
    const todos = (usuario) =>
      act(async () => avisar.forEach((f) => f("SIGNED_IN", usuario)));
    await todos({ user: { id: "a" } });
    expect(linhasDaTabela()).toHaveLength(2);

    await todos({ user: { id: "b" } });
    expect(painel.estado.obter().carregado).toBe(false);
    expect(painel.estado.obter().area).toBe("");
    expect(naTela("Bruno")).toBe(false);
  });
});

describe("carga", () => {
  it("antes do dado, o skeleton dos KPIs, gráficos, pendências e tabela; depois, os números", async () => {
    let responder;
    const supabase = {
      ...supabaseFalso(),
      rpc: vi.fn(
        () =>
          new Promise((ok) => {
            responder = ok;
          }),
      ),
    };
    await montar(supabase);
    const total = secao.querySelector('.entrevistas-kpis [data-kpi="vagas"]');
    expect(total.getAttribute("aria-busy")).toBe("true");
    expect(total.querySelector(".ui-esqueleto")).not.toBeNull();
    expect(secao.querySelectorAll(".ui-grafico.is-carregando")).toHaveLength(5);
    expect(secao.querySelectorAll(".ui-pendencias .ui-esqueleto")).toHaveLength(
      4,
    );
    expect(
      secao.querySelectorAll('.ui-tabela tbody tr[aria-hidden="true"]'),
    ).toHaveLength(8);
    expect(status().textContent).toBe("Carregando dados...");

    await esperar(() => responder({ data: PAYLOAD, error: null }));
    expect(kpi("vagas")).toBe("2");
    expect(secao.querySelector(".ui-grafico.is-carregando")).toBeNull();
  });

  it("falha na primeira carga: aviso com Tentar novamente", async () => {
    let falhar = true;
    const supabase = {
      ...supabaseFalso(),
      rpc: vi.fn(async () =>
        falhar
          ? { data: null, error: { code: "PGRST202", message: "x" } }
          : { data: PAYLOAD, error: null },
      ),
    };
    await montar(supabase);
    const aviso = secao.querySelector(".ui-aviso[role=alert]");
    expect(aviso.textContent).toContain(
      "A aba Entrevistas ainda não foi publicada no banco.",
    );
    expect(status().textContent).toBe("Sem dados");
    falhar = false;
    await clicar(botao("Tentar novamente"));
    await esperar();
    expect(kpi("vagas")).toBe("2");
    expect(secao.querySelector(".ui-aviso[role=alert]")).toBeNull();
  });

  it("falha ao atualizar com a tela carregada: o aviso global do app (toast)", async () => {
    let falhar = false;
    const supabase = {
      ...supabaseFalso(),
      rpc: vi.fn(async () =>
        falhar
          ? { data: null, error: { message: "rede" } }
          : { data: PAYLOAD, error: null },
      ),
    };
    await montar(supabase);
    falhar = true;
    await clicar(secao.querySelector('[data-acao="atualizar"]'));
    await esperar();
    expect(toast).toHaveBeenCalledWith(
      expect.stringContaining("Não foi possível atualizar as entrevistas"),
      "error",
    );
    expect(kpi("vagas")).toBe("2");
  });

  it("sem sessão no cliente do app, avisa e não pede as entrevistas", async () => {
    const supabase = supabaseFalso(
      { data: PAYLOAD, error: null },
      { getSession: async () => ({ data: { session: null } }) },
    );
    await montar(supabase);
    expect(secao.querySelector(".ui-aviso[role=alert]").textContent).toBe(
      "Sessão não localizada. Entre de novo no MONITORA.",
    );
    expect(status().textContent).toBe("Sessão não localizada");
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(secao.querySelector(".entrevistas-visoes")).toBeNull();
  });
});
