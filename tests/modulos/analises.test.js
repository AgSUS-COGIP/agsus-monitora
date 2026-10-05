import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  definirAreaAtual,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.js";
import { EVENTO_TEMA_ALTERADO } from "../../src/lib/eventos-da-barra-lateral.js";
import { urlDaPlanilhaGoogle } from "../../src/lib/planilhas.js";
import {
  clicar,
  digitar,
  escolher,
  esperar,
  teclar,
} from "../componentes/interacoes.js";

/*
  Análises curriculares como módulo do app (src/modulos/analises/): monta na
  própria `#page-analises`, carrega a área atual do app quando o legado abre a
  tela (`render()`), segue o tema do app e usa o aviso global e os
  componentes de src/ui/. Cada bloco cobre um item do levantamento do antigo
  painel (analises.html + src/analises/*.js e os sete remendos).
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

const { montarAnalises } =
  await import("../../src/modulos/analises/analises.jsx");
const { criarConsultasDasAnalises } =
  await import("../../src/modulos/analises/consultas.js");

const COLUNAS = [
  "id",
  "unidade",
  "edital",
  "codigo_vaga",
  "nome_vaga",
  "candidato",
  "categoria",
  "modalidade_concorrencia",
  "status_consolidado",
  "etapa",
  "responsavel_analise",
  "data_analise",
  "nota_final_ajustada",
  "pdf_status",
  "tem_pdf",
];

const lin = (o) => COLUNAS.map((c) => o[c] ?? null);

const LINHAS = [
  {
    id: "a1",
    unidade: "DSEI Yanomami",
    edital: "10/2026",
    codigo_vaga: "V-1",
    nome_vaga: "Enfermeiro 40h",
    candidato: "Ana Ribeiro",
    categoria: "Saúde",
    modalidade_concorrencia: "Ampla concorrência",
    status_consolidado: "Aprovado",
    etapa: "Análise",
    responsavel_analise: "Carla",
    data_analise: "15/09/2026",
  },
  {
    id: "a2",
    unidade: "DSEI Yanomami",
    edital: "10/2026",
    codigo_vaga: "V-1",
    nome_vaga: "Enfermeiro 40h",
    candidato: "<img src=x onerror=alert(1)>",
    categoria: "Saúde",
    status_consolidado: "Pendente",
    responsavel_analise: "",
  },
  {
    id: "a3",
    unidade: "DSEI Xingu",
    edital: "2/2026",
    codigo_vaga: "V-9",
    nome_vaga: "Médico 20h",
    candidato: "Bruno Lima",
    categoria: "Medicina",
    modalidade_concorrencia: "Pretos e pardos",
    status_consolidado: "Revisar",
    etapa: "Revisão",
    responsavel_analise: "Diego",
    data_analise: "01/09/2026",
  },
  {
    id: "a4",
    unidade: "DSEI Xingu",
    edital: "2/2026",
    codigo_vaga: "V-9",
    nome_vaga: "Médico 20h",
    candidato: "Clara Souza",
    categoria: "Medicina",
    status_consolidado: "Reprovado",
    responsavel_analise: "Diego",
    data_analise: "20/09/2026",
  },
];

const EDITAIS = [
  {
    grupo: "Saúde Indígena",
    unidade: "DSEI Yanomami",
    edital: "10/2026",
    ativo: true,
    data_inicio_analise: "2026-09-10",
    data_fim_analise: "2026-09-30",
  },
  {
    grupo: "Saúde Indígena",
    unidade: "DSEI Xingu",
    edital: "2/2026",
    ativo: true,
    data_inicio_analise: "2026-09-10",
    data_fim_analise: "2026-09-30",
  },
];

function payload(linhas = LINHAS, extra = {}) {
  return {
    schema_version: 4,
    scope: "ativo",
    area: "saude-indigena",
    grupo: "Saúde Indígena",
    edital_status: "Ativo",
    columns: COLUNAS,
    rows: linhas.map(lin),
    editais: EDITAIS,
    total: linhas.length,
    atualizado_em: "2026-09-30T13:45:00Z",
    generated_at: "2026-09-30T13:46:00Z",
    cache: { hit: true },
    ...extra,
  };
}

const DETALHE = {
  id: "a1",
  analise: "Parecer: <script>alert(1)</script> atende aos requisitos.",
  pontuacao_escolaridade: 3,
  pontuacao_cursos_aperfeicoamento: 2,
  pontuacao_experiencia_profissional: 4,
  pontuacao_criterio_etnico: 1,
  experiencia_saude_indigena_total: 5,
  experiencia_atencao_basica_total: "-",
  link_pdf: "javascript:alert(1)",
  origem_arquivo_id: "1AbcDefGhijKlmno",
};

const TEXTOS = {
  columns: ["id", "analise", "link_pdf"],
  rows: [
    ["a1", "Parecer de Ana", null],
    ["a3", "Experiência em aldeia remota", "https://drive.google.com/x.pdf"],
  ],
};

function supabaseFalso({ respostas = {}, sessao = true } = {}) {
  let aoMudarSessao = null;
  const rpc = vi.fn(async (nome, argumentos) => {
    if (respostas[nome]) return respostas[nome](argumentos);
    if (nome === "usuario_pode_ler_analises")
      return { data: true, error: null };
    if (nome === "get_analises_dashboard_payload_v2")
      return { data: payload(), error: null };
    if (nome === "get_analise_detalhe_do_painel")
      return { data: DETALHE, error: null };
    if (nome === "get_analises_texto_do_painel")
      return { data: TEXTOS, error: null };
    return { data: null, error: { message: `rpc inesperada: ${nome}` } };
  });
  return {
    rpc,
    auth: {
      getSession: async () => ({
        data: { session: sessao ? { user: { id: "u1" } } : null },
      }),
      onAuthStateChange: (ouvinte) => {
        aoMudarSessao = ouvinte;
      },
    },
    trocarUsuario: (id) => aoMudarSessao?.("SIGNED_IN", { user: { id } }),
  };
}

/* Cópias do navegador em memória (o lugar do IndexedDB). */
function armazenamentoEmMemoria() {
  const mapa = new Map();
  return {
    mapa,
    ler: async (chave) => mapa.get(chave) ?? null,
    guardar: async (chave, valor) => void mapa.set(chave, valor),
    apagarTudo: async () => mapa.clear(),
  };
}

let painel;
let secao;
const toast = vi.fn();
const baixar = vi.fn();

async function montar(
  supabase,
  { abrir = true, armazenamento, ...opcoes } = {},
) {
  secao = document.createElement("section");
  secao.id = "page-analises";
  secao.className = "page active";
  document.body.append(secao);
  await act(async () => {
    painel = montarAnalises({
      supabase,
      toast,
      baixar,
      consultas: criarConsultasDasAnalises({
        supabase,
        armazenamento: armazenamento || armazenamentoEmMemoria(),
        versao: "teste",
      }),
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

const naTela = (texto) => document.body.textContent.includes(texto);
const kpi = (chave) => secao.querySelector(`.ui-kpis [data-kpi="${chave}"]`);
const valorDoKpi = (chave) =>
  kpi(chave).querySelector(".ui-kpi-valor").textContent;
const linhasDaFila = () =>
  [...secao.querySelectorAll(".ui-tabela tbody tr")].filter((tr) =>
    tr.querySelector('[data-acao="detalhes"]'),
  );
const candidatos = () =>
  linhasDaFila().map(
    (tr) =>
      tr.querySelectorAll("td")[4].querySelector(".ui-texto-principal")
        .textContent,
  );
const status = () => secao.querySelector(".ui-topo .status-discreto");
const recorte = () => secao.querySelector("[data-recorte]").textContent;
const grafico = (id) =>
  graficos.find((g) => g.canvas.id === id && g.canvas.isConnected);
const chamadas = (supabase, nome) =>
  supabase.rpc.mock.calls.filter(([n]) => n === nome).map(([, a]) => a);
const botaoComTexto = (raiz, texto) =>
  [...raiz.querySelectorAll("button")].find((b) =>
    b.textContent.trim().startsWith(texto),
  );
const esperarBusca = () =>
  esperar(() => new Promise((ok) => setTimeout(ok, 250)));

async function marcarNoFiltro(campo, valor) {
  const gatilho = document.getElementById(`analises-filtro-${campo}`);
  await clicar(gatilho);
  const caixa = [
    ...gatilho.parentElement.querySelectorAll('input[type="checkbox"]'),
  ].find((c) => c.value === valor);
  await clicar(caixa);
}

beforeEach(() => {
  redefinirDadosDoMonitoramento();
  definirAreaAtual("saude-indigena");
});

afterEach(async () => {
  vi.useRealTimers();
  await act(async () => painel?.raiz?.unmount());
  secao?.remove();
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-theme");
  redefinirDadosDoMonitoramento();
  localStorage.clear();
  toast.mockClear();
  baixar.mockClear();
});

describe("a tela dentro do app", () => {
  it("monta na seção sem pedir nada; render() confere o acesso e carrega a área atual no escopo Ativo", async () => {
    const supabase = supabaseFalso();
    await montar(supabase, { abrir: false });
    expect(secao.querySelector(".ui-tela.analises-tela")).not.toBeNull();
    expect(supabase.rpc).not.toHaveBeenCalled();

    await abrirATela();
    expect(chamadas(supabase, "usuario_pode_ler_analises")).toHaveLength(1);
    expect(chamadas(supabase, "get_analises_dashboard_payload_v2")).toEqual([
      { p_scope: "ativo", p_area: "saude-indigena" },
    ]);
    expect(linhasDaFila()).toHaveLength(4);
  });

  it("topo sem repetir o cabeçalho do app, uma data discreta, sem textos genéricos nem o legado", async () => {
    await montar(supabaseFalso());
    const topo = secao.querySelector("header.ui-topo");
    expect(topo.querySelector("h1, h2")).toBeNull();
    expect(status().textContent).toMatch(/^Atualizado em 30\/09, \d{2}:\d{2}$/);
    expect(
      [...topo.querySelectorAll("button")].map((b) => b.textContent.trim()),
    ).toEqual(["Atualizar", "Exportar"]);
    expect(document.querySelectorAll(".status-discreto")).toHaveLength(1);
    for (const texto of [
      "Somente consulta",
      "Use os filtros",
      "Barras empilhadas",
      "Clique em um",
      "Abra um registro",
      "Acompanhamento das análises",
      "Supabase",
      "Painel de análises curriculares",
    ])
      expect(naTela(texto), texto).toBe(false);
    for (const id of [
      "topbar",
      "kpiGrid",
      "tableBody",
      "contextLine",
      "attentionList",
      "toastHost",
      "fSituacaoEdital",
    ])
      expect(document.getElementById(id), id).toBeNull();
    expect(
      secao.querySelector(
        ".topbar, .kpi, .panel, .filter-panel, .table-card, .attention-list, .badge",
      ),
    ).toBeNull();
    expect(document.querySelector("iframe")).toBeNull();
  });
});

describe("KPIs (7, os seis primeiros filtram)", () => {
  it("valores, taxa de conclusão e o filtro por status (clicar de novo tira; Total volta a todos)", async () => {
    await montar(supabaseFalso());
    expect(secao.querySelectorAll(".ui-kpis .ui-kpi")).toHaveLength(7);
    expect(valorDoKpi("total")).toBe("4");
    expect(valorDoKpi("analisado")).toBe("3");
    expect(valorDoKpi("pendente")).toBe("1");
    expect(valorDoKpi("taxa")).toBe("50%");

    await clicar(kpi("pendente").querySelector("button"));
    expect(
      kpi("pendente").querySelector("button").getAttribute("aria-pressed"),
    ).toBe("true");
    expect(linhasDaFila()).toHaveLength(1);
    expect(recorte()).toContain("KPI: Pendentes");
    expect(naTela("Tirar o filtro KPI")).toBe(false);
    expect(
      secao.querySelector('button[title="Tirar o filtro KPI"]'),
    ).not.toBeNull();

    await clicar(kpi("pendente").querySelector("button"));
    expect(linhasDaFila()).toHaveLength(4);

    await clicar(kpi("aprovado").querySelector("button"));
    expect(linhasDaFila()).toHaveLength(1);
    await clicar(kpi("total").querySelector("button"));
    expect(linhasDaFila()).toHaveLength(4);
    expect(kpi("taxa").querySelector("button")).toBeNull();
  });
});

describe("filtros", () => {
  it("seleção múltipla em cascata, chip que tira, resumo e Limpar tudo", async () => {
    await montar(supabaseFalso());
    const resumo = () => secao.querySelector(".ui-filtros-resumo").textContent;
    expect(resumo()).toContain("Ativo · nenhum filtro adicional");

    await marcarNoFiltro("unidade", "DSEI Xingu");
    expect(candidatos()).toEqual(["Bruno Lima", "Clara Souza"]);
    expect(resumo()).toContain("Ativo · 1 filtro adicional");
    // Cascata: o edital só oferece o da unidade escolhida.
    const opcoesDoEdital = [
      ...document
        .getElementById("analises-filtro-edital")
        .parentElement.querySelectorAll('input[type="checkbox"]'),
    ].map((c) => c.value);
    expect(opcoesDoEdital).toEqual(["2/2026"]);

    const chip = secao.querySelector('button[title="Tirar o filtro Unidade"]');
    expect(chip.textContent).toContain("DSEI Xingu");
    await clicar(chip);
    expect(linhasDaFila()).toHaveLength(4);

    await marcarNoFiltro("status", "Revisar");
    expect(linhasDaFila()).toHaveLength(1);
    await clicar(secao.querySelector('[data-acao="limpar-filtros"]'));
    expect(linhasDaFila()).toHaveLength(4);
    expect(secao.querySelector('[data-acao="limpar-filtros"]').disabled).toBe(
      true,
    );
  });

  it("Mais opções: categoria, modalidade, validação e a busca geral (que traz os pareceres)", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    const adicionais = document.getElementById("analisesFiltrosAdicionais");
    expect(adicionais.hidden).toBe(true);
    await clicar(secao.querySelector('[data-acao="mais-opcoes"]'));
    expect(adicionais.hidden).toBe(false);
    expect(
      [...adicionais.querySelectorAll(":scope > .ui-campo > label")].map(
        (l) => l.textContent,
      ),
    ).toEqual([
      "Categoria",
      "Modalidade de concorrência",
      "Validação da janela",
      "Data da análise: de",
      "Data da análise: até",
      "Buscar em toda a tela",
    ]);

    await marcarNoFiltro("validacao", "SEM_DATA");
    expect(candidatos()).toEqual(["<img src=x onerror=alert(1)>"]);
    await clicar(
      secao.querySelector('button[title="Tirar o filtro Validação da janela"]'),
    );

    // A busca procura também no parecer, que vem em lote quando se busca.
    await digitar(document.getElementById("analises-filtro-busca"), "aldeia");
    await esperarBusca();
    expect(chamadas(supabase, "get_analises_texto_do_painel")).toEqual([
      { p_scope: "ativo", p_area: "saude-indigena" },
    ]);
    expect(candidatos()).toEqual(["Bruno Lima"]);
    expect(
      secao.querySelector('[data-acao="mais-opcoes"] .ui-contagem').textContent,
    ).toBe("1");
    expect(recorte()).toContain("Busca: aldeia");
  });

  it("Município/UF só aparece fora da Saúde Indígena, quando as linhas têm município", async () => {
    await montar(supabaseFalso());
    expect(document.getElementById("analises-filtro-municipio")).toBeNull();
    await act(async () => painel?.raiz?.unmount());
    secao.remove();

    definirAreaAtual("projetos");
    const linhas = [
      { ...LINHAS[0], nome_vaga: "Médico UBS móvel Seropédica/RJ" },
    ];
    await montar(
      supabaseFalso({
        respostas: {
          get_analises_dashboard_payload_v2: () => ({
            data: payload(linhas),
            error: null,
          }),
        },
      }),
    );
    expect(document.getElementById("analises-filtro-municipio")).not.toBeNull();
  });
});

describe("situação do processo (escopo)", () => {
  it("Inativo pede o pacote dele; Todos junta os três; Limpar tudo volta ao Ativo", async () => {
    const supabase = supabaseFalso({
      respostas: {
        get_analises_dashboard_payload_v2: ({ p_scope }) => ({
          data: payload(
            p_scope === "ativo"
              ? LINHAS
              : [
                  {
                    ...LINHAS[0],
                    id: `x-${p_scope}`,
                    candidato: `De ${p_scope}`,
                  },
                ],
            { scope: p_scope },
          ),
          error: null,
        }),
      },
    });
    await montar(supabase);
    await escolher(
      document.getElementById("analises-filtro-escopo"),
      "inativo",
    );
    await esperar();
    expect(candidatos()).toEqual(["De inativo"]);
    expect(recorte()).toContain("Situação do processo: Inativo");
    expect(secao.querySelector(".ui-filtros-resumo").textContent).toContain(
      "Inativo ·",
    );

    await escolher(document.getElementById("analises-filtro-escopo"), "todos");
    await esperar();
    expect(
      chamadas(supabase, "get_analises_dashboard_payload_v2").map(
        (a) => a.p_scope,
      ),
    ).toEqual(["ativo", "inativo", "ativo", "inativo", "desativadas"]);
    expect(linhasDaFila()).toHaveLength(6);

    await clicar(secao.querySelector('[data-acao="limpar-filtros"]'));
    await esperar();
    expect(document.getElementById("analises-filtro-escopo").value).toBe(
      "ativo",
    );
    expect(linhasDaFila()).toHaveLength(4);
  });
});

describe("pendências prioritárias (atalhos)", () => {
  it("sem responsável, fora do período e pendentes filtram; clicar de novo tira", async () => {
    const linhas = [
      ...LINHAS,
      { ...LINHAS[3], id: "a5", candidato: "Davi", data_analise: "01/08/2026" },
    ];
    await montar(
      supabaseFalso({
        respostas: {
          get_analises_dashboard_payload_v2: () => ({
            data: payload(linhas),
            error: null,
          }),
        },
      }),
    );
    const item = (chave) => secao.querySelector(`[data-pendencia="${chave}"]`);
    expect(item("sem-responsavel").textContent).toContain(
      "1 registro(s) sem responsável",
    );

    await clicar(item("sem-responsavel"));
    expect(item("sem-responsavel").getAttribute("aria-pressed")).toBe("true");
    expect(candidatos()).toEqual(["<img src=x onerror=alert(1)>"]);
    expect(recorte()).toContain("Responsável: Sem responsável");
    await clicar(item("sem-responsavel"));
    expect(linhasDaFila()).toHaveLength(5);

    await clicar(item("fora-do-periodo"));
    expect(candidatos()).toEqual(["Bruno Lima", "Davi"]);
    expect(recorte()).toContain("Validação da janela: Fora do período");
    await clicar(item("fora-do-periodo"));

    await clicar(item("pendentes"));
    expect(
      kpi("pendente").querySelector("button").getAttribute("aria-pressed"),
    ).toBe("true");
  });
});

describe("gráficos", () => {
  it("carga por responsável empilhada por status; clicar numa barra recorta e clicar de novo tira", async () => {
    await montar(supabaseFalso());
    const resp = grafico("chartResponsavel");
    expect(resp.config.type).toBe("bar");
    expect(resp.data.datasets.map((d) => d.label)).toEqual([
      "Pendente",
      "Revisar",
      "Aprovado",
      "Reprovado",
    ]);
    expect(resp.options.scales.x.stacked).toBe(true);
    expect(resp.data.labels).toEqual(["Diego", "Carla", "Sem responsável"]);

    await act(async () => resp.options.onClick(null, [{ index: 0 }]));
    expect(candidatos()).toEqual(["Bruno Lima", "Clara Souza"]);
    expect(recorte()).toContain("Responsável no gráfico: Diego");
    await act(async () =>
      grafico("chartResponsavel").options.onClick(null, [{ index: 0 }]),
    );
    expect(linhasDaFila()).toHaveLength(4);
  });

  it("tendência diária com os pontos fora da janela em vermelho; o tema do app redesenha", async () => {
    await montar(supabaseFalso());
    const linha = grafico("chartTendencia");
    expect(linha.config.type).toBe("line");
    expect(linha.data.labels).toEqual([
      "01/09/2026",
      "15/09/2026",
      "20/09/2026",
    ]);
    const [fora, dentro] = linha.data.datasets[0].pointBackgroundColor;
    expect(fora).not.toBe(dentro);
    expect(linha.data.datasets[0].pointRadius).toEqual([5, 3, 3]);

    const antes = linha.atualizacoes;
    document.documentElement.setAttribute("data-theme", "dark");
    await act(async () =>
      document.dispatchEvent(new CustomEvent(EVENTO_TEMA_ALTERADO)),
    );
    expect(grafico("chartTendencia").atualizacoes).toBeGreaterThan(antes);
  });
});

/* Histórias em docs/historias-de-usuario/analises-curriculares.md. */
describe("AC-1/AC-2 — filtro por data no gráfico Análises por data", () => {
  // Os dias do gráfico: 0 = 01/09 (Bruno), 1 = 15/09 (Ana), 2 = 20/09 (Clara).
  const clicarNoDia = (indice, shiftKey = false) =>
    act(async () =>
      grafico("chartTendencia").options.onClick({ native: { shiftKey } }, [
        { index: indice },
      ]),
    );
  const chipDaData = () =>
    [...secao.querySelectorAll(".ui-recorte .ui-chip")].find((c) =>
      c.textContent.includes("Data"),
    );
  const pendencia = (chave) =>
    secao.querySelector(`[data-pendencia="${chave}"]`);

  it("AC-1.1 — o dia clicado recorta KPIs, responsável, pendências e fila", async () => {
    await montar(supabaseFalso());
    expect(grafico("chartTendencia").options.interaction).toMatchObject({
      mode: "index",
      intersect: false,
    });
    await clicarNoDia(0);
    expect(candidatos()).toEqual(["Bruno Lima"]);
    expect(valorDoKpi("total")).toBe("1");
    expect(valorDoKpi("revisar")).toBe("1");
    expect(grafico("chartResponsavel").data.labels).toEqual(["Diego"]);
    expect(pendencia("fora-do-periodo").textContent).toContain(
      "1 análise(s) fora",
    );
    expect(pendencia("sem-responsavel")).toBeNull();
  });

  it("AC-1.2/AC-1.3 — chip Data no recorte e nos filtros; o gráfico guarda todos os dias e destaca o escolhido", async () => {
    await montar(supabaseFalso());
    await clicarNoDia(1);
    expect(recorte()).toBe(
      "Recorte ativo: Situação do processo: Ativo · Data: 15/09/2026",
    );
    expect(chipDaData().textContent).toContain("15/09/2026");
    expect(
      secao.querySelector('button[title="Tirar o filtro Data"]'),
    ).not.toBeNull();
    expect(
      [...secao.querySelectorAll(".ui-filtros .ui-chip")].some((c) =>
        c.textContent.includes("15/09/2026"),
      ),
    ).toBe(true);
    const linha = grafico("chartTendencia");
    expect(linha.data.labels).toEqual([
      "01/09/2026",
      "15/09/2026",
      "20/09/2026",
    ]);
    expect(linha.data.datasets[0].pointRadius).toEqual([5, 8, 3]);
    expect(linha.data.datasets[0].pointBorderWidth).toEqual([1, 3, 1]);
  });

  it("AC-1.4/AC-1.5 — o mesmo dia de novo tira; outro dia troca; o x do chip tira", async () => {
    await montar(supabaseFalso());
    await clicarNoDia(1);
    expect(candidatos()).toEqual(["Ana Ribeiro"]);
    await clicarNoDia(1);
    expect(linhasDaFila()).toHaveLength(4);
    expect(chipDaData()).toBeUndefined();

    await clicarNoDia(1);
    await clicarNoDia(2);
    expect(candidatos()).toEqual(["Clara Souza"]);
    await clicar(chipDaData());
    expect(linhasDaFila()).toHaveLength(4);
    expect(recorte()).toBe("Recorte ativo: Situação do processo: Ativo");
  });

  it("AC-1.6 — vale junto com os outros filtros; Limpar tudo tira a data; o CSV leva a data", async () => {
    await montar(supabaseFalso());
    await marcarNoFiltro("responsavel", "Diego");
    expect(candidatos()).toEqual(["Bruno Lima", "Clara Souza"]);
    // Só os dias de Diego no gráfico: 0 = 01/09, 1 = 20/09.
    await clicarNoDia(1);
    expect(candidatos()).toEqual(["Clara Souza"]);

    await clicar(secao.querySelector('[data-acao="exportar"]'));
    await esperar();
    const [csv] = baixar.mock.calls.at(-1);
    expect(csv).toContain("Clara Souza");
    expect(csv).not.toContain("Bruno Lima");

    await clicar(secao.querySelector('[data-acao="limpar-filtros"]'));
    expect(linhasDaFila()).toHaveLength(4);
    expect(chipDaData()).toBeUndefined();
  });

  it("AC-1.7 — a análise sem data sai com o filtro de data", async () => {
    await montar(supabaseFalso());
    await clicarNoDia(0);
    await clicarNoDia(2, true);
    expect(candidatos()).not.toContain("<img src=x onerror=alert(1)>");
  });

  it("AC-2.1 — Shift + clique estende o dia para um intervalo", async () => {
    await montar(supabaseFalso());
    await clicarNoDia(1);
    await clicarNoDia(0, true);
    expect([...candidatos()].sort()).toEqual(["Ana Ribeiro", "Bruno Lima"]);
    expect(chipDaData().textContent).toContain("01/09/2026 a 15/09/2026");
    expect(grafico("chartTendencia").data.datasets[0].pointRadius).toEqual([
      8, 8, 3,
    ]);
  });

  it("AC-2.2 — os campos de data em Mais opções aplicam o mesmo filtro e mostram o dia clicado", async () => {
    await montar(supabaseFalso());
    const inicio = document.getElementById("analises-filtro-data-inicio");
    const fim = document.getElementById("analises-filtro-data-fim");
    expect(inicio.type).toBe("date");
    await clicarNoDia(1);
    expect(inicio.value).toBe("2026-09-15");
    expect(fim.value).toBe("2026-09-15");
    await clicar(chipDaData());

    await digitar(inicio, "2026-09-15");
    expect([...candidatos()].sort()).toEqual(["Ana Ribeiro", "Clara Souza"]);
    expect(chipDaData().textContent).toContain("a partir de 15/09/2026");
    await digitar(fim, "2026-09-15");
    expect(candidatos()).toEqual(["Ana Ribeiro"]);
    expect(
      secao.querySelector('[data-acao="mais-opcoes"] .ui-contagem').textContent,
    ).toBe("1");
  });

  it("AC-2.3 — o rótulo do gráfico diz como filtrar e qual data está escolhida", async () => {
    await montar(supabaseFalso());
    const canvas = () => document.getElementById("chartTendencia");
    expect(canvas().getAttribute("aria-label")).toContain(
      "Clique num dia para filtrar a tela",
    );
    expect(canvas().getAttribute("aria-label")).toContain("Mais opções");
    await clicarNoDia(1);
    expect(canvas().getAttribute("aria-label")).toContain(
      "Data escolhida: 15/09/2026",
    );
  });
});

describe("recorte ativo", () => {
  it("frase do recorte e as marcas da janela oficial", async () => {
    await montar(supabaseFalso());
    expect(recorte()).toBe("Recorte ativo: Situação do processo: Ativo");
    const marcas = [...secao.querySelectorAll(".ui-marca")].map((m) =>
      m.textContent.trim(),
    );
    expect(marcas).toEqual([
      "Janela oficial: 10/09/2026 a 30/09/2026",
      "1 análise(s) fora do período",
    ]);
  });
});

describe("fila", () => {
  const muitas = Array.from({ length: 120 }, (_, i) => ({
    ...LINHAS[0],
    id: `m${i}`,
    candidato: `Pessoa ${String(i).padStart(3, "0")}`,
  }));

  it("50 por vez, Carregar mais, contagem do recorte e a busca só da fila", async () => {
    const supabase = supabaseFalso({
      respostas: {
        get_analises_dashboard_payload_v2: () => ({
          data: payload(muitas),
          error: null,
        }),
      },
    });
    await montar(supabase);
    expect(linhasDaFila()).toHaveLength(50);
    expect(secao.querySelector("[data-tabela-mostrando]").textContent).toBe(
      "Mostrando 50 de 120 registros",
    );
    expect(secao.querySelector("[data-tabela-contagem]").textContent).toBe(
      "Recorte atual: 120 de 120",
    );
    await clicar(secao.querySelector('[data-acao="carregar-mais"]'));
    expect(linhasDaFila()).toHaveLength(100);
    await clicar(secao.querySelector('[data-acao="carregar-mais"]'));
    expect(linhasDaFila()).toHaveLength(120);
    expect(secao.querySelector('[data-acao="carregar-mais"]')).toBeNull();

    await digitar(secao.querySelector(".ui-tabela-busca"), "pessoa 007");
    expect(candidatos()).toEqual(["Pessoa 007"]);
    expect(chamadas(supabase, "get_analises_texto_do_painel")).toHaveLength(1);
    // Limpar tudo limpa também a busca da fila.
    await clicar(secao.querySelector('[data-acao="limpar-filtros"]'));
    expect(secao.querySelector(".ui-tabela-busca").value).toBe("");
  });

  it("área sem análise nenhuma: a mensagem da área", async () => {
    definirAreaAtual("sede");
    await montar(
      supabaseFalso({
        respostas: {
          get_analises_dashboard_payload_v2: () => ({
            data: payload([]),
            error: null,
          }),
        },
      }),
    );
    expect(naTela("Ainda não há análises da SEDE.")).toBe(true);
  });
});

describe("gaveta de detalhe", () => {
  it("abre pelo Detalhes, traz o detalhamento uma vez, mostra seções, links seguros e o parecer como texto", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    await clicar(linhasDaFila()[0].querySelector('[data-acao="detalhes"]'));
    await esperar();
    expect(chamadas(supabase, "get_analise_detalhe_do_painel")).toEqual([
      { p_id: "a1" },
    ]);
    const gaveta = document.getElementById("analisesGaveta");
    expect(gaveta.querySelector("#analisesGavetaTitulo").textContent).toBe(
      "Ana Ribeiro",
    );
    expect(gaveta.querySelector(".ui-gaveta-resumo").textContent).toContain(
      "Aprovado",
    );
    expect(
      [...gaveta.querySelectorAll(".ui-gaveta-contexto small")].map(
        (s) => s.textContent,
      ),
    ).toEqual(["Grupo", "Unidade", "Edital", "Código da vaga", "Vaga"]);
    expect(
      [...gaveta.querySelectorAll(".ui-secao-topo span")].map(
        (s) => s.textContent,
      ),
    ).toEqual([
      "Situação da análise",
      "Resultado",
      "Composição da pontuação",
      "Parecer da análise",
    ]);
    expect(gaveta.textContent).toContain(
      "Janela oficial10/09/2026 a 30/09/2026",
    );
    expect(gaveta.textContent).not.toContain("Exp. Atenção Básica");
    const links = [...gaveta.querySelectorAll("a")];
    expect(links.map((a) => a.textContent.trim())).toEqual(["Abrir origem"]);
    expect(links[0].href).toBe(urlDaPlanilhaGoogle(DETALHE.origem_arquivo_id));
    expect(links[0].rel).toBe("noopener noreferrer");
    // O parecer com <script> é texto, nunca HTML.
    expect(gaveta.querySelector("script")).toBeNull();
    expect(gaveta.querySelector(".analises-parecer").textContent).toBe(
      DETALHE.analise,
    );

    await teclar(document, "Escape");
    expect(document.getElementById("analisesGaveta")).toBeNull();
    await clicar(linhasDaFila()[0].querySelector('[data-acao="detalhes"]'));
    await esperar();
    expect(chamadas(supabase, "get_analise_detalhe_do_painel")).toHaveLength(1);
  });

  it("falha no detalhamento: aviso com Tentar novamente", async () => {
    let falhar = true;
    const supabase = supabaseFalso({
      respostas: {
        get_analise_detalhe_do_painel: () =>
          falhar
            ? { data: null, error: { message: "tempo" } }
            : { data: DETALHE, error: null },
      },
    });
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    await montar(supabase);
    await clicar(linhasDaFila()[0].querySelector('[data-acao="detalhes"]'));
    await esperar();
    const gaveta = document.getElementById("analisesGaveta");
    expect(gaveta.textContent).toContain(
      "Não foi possível carregar o detalhamento.",
    );
    falhar = false;
    await clicar(botaoComTexto(gaveta, "Tentar novamente"));
    await esperar();
    expect(document.getElementById("analisesGaveta").textContent).toContain(
      "Composição da pontuação",
    );
    aviso.mockRestore();
  });

  it("texto da planilha nunca vira HTML (XSS)", async () => {
    await montar(supabaseFalso());
    expect(secao.querySelector("img")).toBeNull();
    expect(candidatos()).toContain("<img src=x onerror=alert(1)>");
    await clicar(linhasDaFila()[1].querySelector('[data-acao="detalhes"]'));
    await esperar();
    const gaveta = document.getElementById("analisesGaveta");
    expect(gaveta.querySelector("img")).toBeNull();
    expect(gaveta.querySelector("#analisesGavetaTitulo").textContent).toBe(
      "<img src=x onerror=alert(1)>",
    );
  });
});

describe("exportar, atualizar e a cópia do navegador", () => {
  it("Exportar traz os pareceres antes e baixa o CSV do recorte", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    await clicar(kpi("analisado").querySelector("button"));
    await clicar(secao.querySelector('[data-acao="exportar"]'));
    await esperar();
    expect(chamadas(supabase, "get_analises_texto_do_painel")).toHaveLength(1);
    expect(baixar).toHaveBeenCalledTimes(1);
    const [conteudo, nome] = baixar.mock.calls[0];
    expect(nome).toBe("agsus_analises_curriculares_v3.csv");
    const linhas = conteudo.split("\n");
    expect(linhas).toHaveLength(4);
    expect(linhas[1]).toContain("Parecer de Ana");
    expect(toast).toHaveBeenCalledWith(
      "Exportados 3 registros do recorte atual.",
      "info",
    );
  });

  it("Atualizar pede ao servidor sem a cópia e avisa", async () => {
    const armazenamento = armazenamentoEmMemoria();
    const supabase = supabaseFalso();
    await montar(supabase, { armazenamento });
    await clicar(secao.querySelector('[data-acao="atualizar"]'));
    await esperar();
    expect(
      chamadas(supabase, "get_analises_dashboard_payload_v2"),
    ).toHaveLength(2);
    expect(toast).toHaveBeenCalledWith(
      "Análises atualizadas: 4 registros.",
      "info",
    );
  });

  it("com cópia guardada, a tela abre na hora e troca quando o servidor manda outra versão", async () => {
    const armazenamento = armazenamentoEmMemoria();
    await montar(supabaseFalso(), { armazenamento });
    expect(armazenamento.mapa.size).toBeGreaterThan(0);
    await act(async () => painel.raiz.unmount());
    secao.remove();

    let soltar;
    const supabase = supabaseFalso({
      respostas: {
        get_analises_dashboard_payload_v2: () =>
          new Promise((ok) => {
            soltar = () =>
              ok({
                data: payload(LINHAS.slice(0, 2), {
                  generated_at: "2026-10-01T09:00:00Z",
                }),
                error: null,
              });
          }),
      },
    });
    await montar(supabase, { armazenamento });
    expect(linhasDaFila()).toHaveLength(4);
    expect(status().textContent).toBe("Atualizando...");
    await act(async () => soltar());
    await esperar();
    expect(linhasDaFila()).toHaveLength(2);
    expect(status().textContent).toMatch(/^Atualizado em/);
  });
});

describe("sessão, permissão, erro e demora", () => {
  it("sem acesso (o porteiro diz não): aviso e nada da lista", async () => {
    const supabase = supabaseFalso({
      respostas: {
        usuario_pode_ler_analises: () => ({ data: false, error: null }),
      },
    });
    await montar(supabase);
    expect(secao.querySelector(".ui-aviso").textContent).toBe(
      "Sem acesso às Análises curriculares.",
    );
    expect(
      chamadas(supabase, "get_analises_dashboard_payload_v2"),
    ).toHaveLength(0);
    expect(status().textContent).toBe("Sem acesso");
  });

  it("a lista recusa (42501): o mesmo aviso", async () => {
    await montar(
      supabaseFalso({
        respostas: {
          get_analises_dashboard_payload_v2: () => ({
            data: null,
            error: { code: "42501", message: "x" },
          }),
        },
      }),
    );
    expect(secao.querySelector(".ui-aviso").textContent).toBe(
      "Sem acesso às Análises curriculares.",
    );
  });

  it("sem sessão: aviso curto, sem o jargão do banco", async () => {
    await montar(supabaseFalso({ sessao: false }));
    expect(secao.querySelector(".ui-aviso").textContent).toBe(
      "Sessão não localizada. Entre de novo no MONITORA.",
    );
  });

  it("falha na primeira carga: aviso com Tentar novamente", async () => {
    let falhar = true;
    const supabase = supabaseFalso({
      respostas: {
        get_analises_dashboard_payload_v2: () =>
          falhar
            ? { data: null, error: { message: "fora do ar" } }
            : { data: payload(), error: null },
      },
    });
    await montar(supabase);
    expect(secao.querySelector(".ui-aviso").textContent).toContain(
      "Não foi possível carregar as análises: fora do ar",
    );
    falhar = false;
    await clicar(botaoComTexto(secao, "Tentar novamente"));
    await esperar();
    expect(linhasDaFila()).toHaveLength(4);
  });

  it("demora: aviso discreto aos 12 s e Tentar novamente aos 25 s", async () => {
    vi.useFakeTimers();
    const supabase = supabaseFalso({
      respostas: {
        get_analises_dashboard_payload_v2: () => new Promise(() => {}),
      },
    });
    await montar(supabase, { abrir: false });
    await act(async () => void painel.render());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
    });
    expect(secao.querySelector(".ui-aviso").textContent).toContain(
      "levando um pouco mais de tempo",
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(13_000);
    });
    expect(botaoComTexto(secao, "Tentar novamente")).toBeTruthy();
  });
});

describe("área, usuário, reabertura e comemorações", () => {
  it("trocar de área com a tela aberta recarrega a área nova e recomeça os filtros", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    await clicar(kpi("pendente").querySelector("button"));
    await act(async () => definirAreaAtual("projetos"));
    await esperar();
    expect(
      chamadas(supabase, "get_analises_dashboard_payload_v2").at(-1),
    ).toEqual({
      p_scope: "ativo",
      p_area: "projetos",
    });
    expect(linhasDaFila()).toHaveLength(4);
  });

  it("reabrir na mesma área não recarrega; depois de 5 minutos, relê por trás", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    await abrirATela();
    expect(
      chamadas(supabase, "get_analises_dashboard_payload_v2"),
    ).toHaveLength(1);
    const agora = Date.now();
    const relogio = vi
      .spyOn(Date, "now")
      .mockReturnValue(agora + 6 * 60 * 1000);
    await abrirATela();
    expect(
      chamadas(supabase, "get_analises_dashboard_payload_v2"),
    ).toHaveLength(2);
    relogio.mockRestore();
  });

  it("abrir de novo no meio da primeira carga não pede outra vez", async () => {
    let soltar;
    const supabase = supabaseFalso({
      respostas: {
        get_analises_dashboard_payload_v2: () =>
          new Promise((ok) => {
            soltar = () => ok({ data: payload(), error: null });
          }),
      },
    });
    await montar(supabase, { abrir: false });
    await act(async () => void painel.render());
    await act(async () => void painel.render());
    expect(
      chamadas(supabase, "get_analises_dashboard_payload_v2"),
    ).toHaveLength(1);
    await act(async () => soltar());
    await esperar();
    expect(linhasDaFila()).toHaveLength(4);
  });

  it("outro usuário na mesma aba: tudo volta ao início", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    await act(async () => supabase.trocarUsuario("u1"));
    expect(linhasDaFila()).toHaveLength(4);
    await act(async () => supabase.trocarUsuario("u2"));
    expect(linhasDaFila()).toHaveLength(0);
    expect(status().textContent).toBe("Carregando dados...");
  });

  it("comemorações: o estado do Ativo é guardado a cada carga (marcos)", async () => {
    window.matchMedia = () => ({ matches: true });
    await montar(supabaseFalso(), { comemoracoesLigadas: () => true });
    expect(
      localStorage.getItem("agsus_monitora_marco:analises:u1:saude-indigena"),
    ).not.toBeNull();
    delete window.matchMedia;
  });
});
