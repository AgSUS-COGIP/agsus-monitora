// @vitest-environment jsdom
// Antes do react-dom: conta os desenhos de cada componente.
import { renders } from "./componentes/contar-renders.ts";
import { bloco } from "./apoio/bloco.ts";
import { act, createElement } from "react";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  definirAreaAtual,
  redefinirDadosDoMonitoramento,
  publicarLinhasDoMonitoramento,
  definirAreasDoUsuario,
} from "../src/componentes/dados-do-monitoramento.ts";
import { EVENTO_TEMA_ALTERADO } from "../src/lib/navegacao/eventos-da-barra-lateral.ts";
import { urlDaPlanilhaGoogle } from "../src/lib/base/planilhas.ts";
import { pedirFiltro } from "../src/app/pedido-de-filtro.ts";
import { agoraEmBrasilia } from "../src/lib/analises/ritmo-da-analise.ts";
import {
  clicar,
  digitar,
  escolher,
  esperar,
  teclar,
} from "./componentes/interacoes.ts";
import { montarTela, desenharNoTeste } from "./montar-tela.ts";
import { proximoEstado } from "../src/lib/recursos/resposta-do-recurso.ts";
import { readdirSync, readFileSync } from "node:fs";
import { fonteDoApp } from "./fonte-do-app.ts";
import { criarLeafletFalso } from "./modulos/leaflet-falso.js";
import { htmlDaPagina } from "./pagina-montada.ts";
import { registrarTelas } from "../src/app/registro-das-telas.ts";
import { comemoracoesNaPagina } from "./shows-de-comemoracao.js";
import { createRoot } from "react-dom/client";
import { criarEstadoDaFila } from "../src/modulos/avaliacao-documental/estado-da-fila.ts";
import { Fila } from "../src/modulos/avaliacao-documental/fila.tsx";
import * as telaDaPre from "../src/lib/avaliacao-documental/tela-da-pre-classificacao.ts";
import * as libDaFila from "../src/lib/avaliacao-documental/fila.ts";
import { CardDeGrafico, Grafico } from "../src/ui/index.ts";
import { proximoDestaque } from "../src/ui/grafico.tsx";
import {
  dadosDaTabelaDoGrafico,
  textoDoPonto,
} from "../src/ui/tabela-do-grafico.tsx";

/*
  Os módulos simulados valem para o arquivo inteiro (o Vitest sobe todo
  `vi.mock` para o topo), por isso as telas que precisam deles ficam juntas
  aqui. O Chart.js não desenha no jsdom (sem canvas): um falso guarda o que
  recebeu, e cada bloco lê `graficos`.
*/
const graficos = vi.hoisted(() => []);
vi.mock("../src/lib/base/chartjs-global.ts", () => {
  const Chart = class {
    constructor(canvas, configuracao) {
      this.canvas = canvas;
      this.config = configuracao;
      this.data = configuracao.data;
      this.options = configuracao.options;
      this.plugins = configuracao.plugins;
      this.atualizacoes = 0;
      // O destaque pedido pelo teclado (src/ui/grafico.tsx).
      this.ativos = [];
      this.tooltip = { setActiveElements: () => undefined };
      graficos.push(this);
    }
    setActiveElements(ativos) {
      this.ativos = ativos;
    }
    update() {
      this.atualizacoes += 1;
    }
    destroy() {
      graficos.splice(graficos.indexOf(this), 1);
    }
  };
  return {
    chartCarregado: () => Chart,
    carregarChart: async () => Chart,
  };
});
const sigepsi = vi.hoisted(() => ({
  atual: { estado: "carregando", dados: null },
  ouvintes: new Set(),
  tentativas: 0,
}));
vi.mock("../src/modulos/mapa-saude-indigena/localizacoes.ts", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    usarLocalizacoesDoSigepsi: () => ({
      ...useSyncExternalStore(
        (avisar) => {
          sigepsi.ouvintes.add(avisar);
          return () => sigepsi.ouvintes.delete(avisar);
        },
        () => sigepsi.atual,
      ),
      tentarDeNovo: () => {
        sigepsi.tentativas += 1;
      },
    }),
  };
});
vi.mock(
  "../src/lib/avaliacao-documental/tela-da-pre-classificacao.ts",
  async (original) => {
    const m = await original();
    return { ...m, podeIncluirPorDecisao: vi.fn(m.podeIncluirPorDecisao) };
  },
);
vi.mock("../src/lib/avaliacao-documental/fila.ts", async (original) => {
  const m = await original();
  return {
    ...m,
    loteDaFila: vi.fn(m.loteDaFila),
    acoesDaSelecao: vi.fn(m.acoesDaSelecao),
    resumoDaVagaNaFila: vi.fn(m.resumoDaVagaNaFila),
  };
});
const varrer = vi.hoisted(() => ({ vezes: 0 }));
vi.mock("../src/modulos/aya/contexto.ts", async (original) => {
  const real = await original();
  return {
    ...real,
    collectAyaPageContext: (...args) => {
      varrer.vezes += 1;
      return real.collectAyaPageContext(...args);
    },
  };
});
vi.mock("../src/modulos/comemoracao/desenho.ts", async (original) => ({
  ...(await original()),
  desenharPrevia: () => {},
  semMovimento: () => false,
}));
bloco("modulos/analises", async () => {
  /*
  Análises curriculares como módulo do app (src/modulos/analises/): monta na
  própria `#page-analises`, carrega a área atual do app quando o legado abre a
  tela (`render()`), segue o tema do app e usa o aviso global e os
  componentes de src/ui/. Cada bloco cobre um item do levantamento do antigo
  painel (analises.html + src/analises/*.js e os sete remendos).
*/

  // O Chart.js não desenha no jsdom (sem canvas): um falso guarda o que recebeu.

  const { criarAnalises } =
    await import("../src/modulos/analises/analises.tsx");
  const { criarConsultasDasAnalises } =
    await import("../src/modulos/analises/consultas.ts");

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
      if (nome === "get_analises_dashboard_payload_v2_se_mudou")
        return { data: payload(), error: null };
      if (nome === "get_analise_detalhe_do_painel")
        return { data: DETALHE, error: null };
      if (nome === "get_analises_texto_do_painel")
        return { data: TEXTOS, error: null };
      // Conferência e ritmo: sem dados (o card não aparece), sem erro no console.
      if (
        nome === "obter_ultima_conferencia" ||
        nome === "obter_ritmo_da_analise"
      )
        return { data: null, error: null };
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
      painel = montarTela(criarAnalises, "page-analises", {
        supabase,
        toast,
        baixar,
        consultas: criarConsultasDasAnalises({
          supabase,
          armazenamento: armazenamento || armazenamentoEmMemoria(),
          versao: "teste",
        }),
        // A página está à vista quando a seção está ativa (no app, a navegação diz).
        visivel: () => secao.classList.contains("active"),
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
      expect(
        chamadas(supabase, "get_analises_dashboard_payload_v2_se_mudou"),
      ).toEqual([
        { p_scope: "ativo", p_area: "saude-indigena", p_versao: null },
      ]);
      expect(linhasDaFila()).toHaveLength(4);
    });

    it("topo sem repetir o cabeçalho do app, uma data discreta, sem textos genéricos nem o legado", async () => {
      await montar(supabaseFalso());
      const topo = secao.querySelector("header.ui-topo");
      expect(topo.querySelector("h1, h2")).toBeNull();
      expect(status().textContent).toMatch(
        /^Atualizado em 30\/09, \d{2}:\d{2}$/,
      );
      expect(
        [...topo.querySelectorAll("button")].map((b) => b.textContent.trim()),
      ).toEqual(["Atualizar", "Exportar em Excel"]);
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

  describe("Abrir pela Aya", () => {
    it("o pedido de filtro da Aya recorta por edital e KPI, uma vez só", async () => {
      await montar(supabaseFalso());
      await act(async () =>
        pedirFiltro("analises", { edital: "10/2026", metrica: "pendente" }),
      );
      await esperar();
      expect(
        kpi("pendente").querySelector("button").getAttribute("aria-pressed"),
      ).toBe("true");
      expect(linhasDaFila()).toHaveLength(1);
      expect(recorte()).toContain("10/2026");
      // Pedido de outra tela não mexe aqui.
      await act(async () => pedirFiltro("recursos", { edital: "2/2026" }));
      await esperar();
      expect(linhasDaFila()).toHaveLength(1);
    });
  });

  describe("filtros", () => {
    it("seleção múltipla em cascata, chip que tira, resumo e Limpar tudo", async () => {
      await montar(supabaseFalso());
      const resumo = () =>
        secao.querySelector(".ui-filtros-resumo").textContent;
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

      const chip = secao.querySelector(
        'button[title="Tirar o filtro Unidade"]',
      );
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
        "Buscar em toda a página",
      ]);

      await marcarNoFiltro("validacao", "SEM_DATA");
      expect(candidatos()).toEqual(["<img src=x onerror=alert(1)>"]);
      await clicar(
        secao.querySelector(
          'button[title="Tirar o filtro Validação da janela"]',
        ),
      );

      // A busca procura também no parecer, que vem em lote quando se busca.
      await digitar(document.getElementById("analises-filtro-busca"), "aldeia");
      await esperarBusca();
      expect(chamadas(supabase, "get_analises_texto_do_painel")).toEqual([
        { p_scope: "ativo", p_area: "saude-indigena" },
      ]);
      expect(candidatos()).toEqual(["Bruno Lima"]);
      expect(
        secao.querySelector('[data-acao="mais-opcoes"] .ui-contagem')
          .textContent,
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
            get_analises_dashboard_payload_v2_se_mudou: () => ({
              data: payload(linhas),
              error: null,
            }),
          },
        }),
      );
      expect(
        document.getElementById("analises-filtro-municipio"),
      ).not.toBeNull();
    });
  });

  describe("situação do processo (escopo)", () => {
    it("Inativo pede o pacote dele; Todos junta ativo e inativo (sem as desativadas); Limpar tudo volta ao Ativo", async () => {
      const supabase = supabaseFalso({
        respostas: {
          get_analises_dashboard_payload_v2_se_mudou: ({ p_scope }) => ({
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

      await escolher(
        document.getElementById("analises-filtro-escopo"),
        "todos",
      );
      await esperar();
      expect(
        chamadas(supabase, "get_analises_dashboard_payload_v2_se_mudou").map(
          (a) => a.p_scope,
        ),
      ).toEqual(["ativo", "inativo", "ativo", "inativo"]);
      expect(linhasDaFila()).toHaveLength(5);

      await clicar(secao.querySelector('[data-acao="limpar-filtros"]'));
      await esperar();
      expect(document.getElementById("analises-filtro-escopo").value).toBe(
        "ativo",
      );
      expect(linhasDaFila()).toHaveLength(4);
    });
  });

  describe("ritmo da análise", () => {
    // O card nasce recolhido; estes testes olham o conteúdo, então partem dele aberto.
    beforeEach(() => {
      localStorage.setItem("monitora.analises.ritmo-recolhido:anonimo", "0");
    });

    it("nasce recolhido para quem nunca abriu", async () => {
      localStorage.removeItem("monitora.analises.ritmo-recolhido:anonimo");
      await montar(comRitmo());
      expect(card().hasAttribute("data-recolhido")).toBe(true);
      expect(card().querySelector(".ui-kpi")).toBeNull();
    });

    const RITMO = {
      editais: [
        {
          id: "bcecfb08",
          // O mesmo edital das linhas do resumo (10/2026: 1 Aprovado, 1 Pendente).
          edital: "10/2026",
          situacoes: {
            pendente: 1086,
            em_analise: 12,
            revisar: 0,
            concluida: 414,
            fora_lote: 448,
          },
          por_dia: [{ dia: "2026-10-16", qt: 266 }],
          qt_equipe: 9,
          qt_avaliadores_recentes: 7,
          cronograma: [
            {
              ordem: 4,
              atividade:
                "Validação das inscrições, por meio da verificação da documentação obrigatória",
              tipo: null,
              inicio: "2026-10-15",
              fim: "2026-10-22",
            },
          ],
        },
      ],
    };
    const comRitmo = () =>
      supabaseFalso({
        respostas: {
          obter_ritmo_da_analise: () => ({ data: RITMO, error: null }),
        },
      });
    const card = () => secao.querySelector("[data-ritmo]");

    it("vem junto com a carga, numa consulta só da área, e mostra o card do edital", async () => {
      const supabase = comRitmo();
      await montar(supabase);
      expect(chamadas(supabase, "obter_ritmo_da_analise")).toEqual([
        { p_area: "saude-indigena" },
      ]);
      expect(card().textContent).toContain("Ritmo da análise · 10/2026");
      expect(card().textContent).toContain(
        "Prazo: 22/10 · Validação da documentação",
      );
      expect(card().querySelector("[data-hoje]")).not.toBeNull();
      expect(card().querySelector("[data-referencia]")).not.toBeNull();
    });

    /*
    19/10/2026: o topo dizia 1.076 pendentes e o card "faltam 1.074" (ao
    vivo). Agora o card conta as linhas do edital no resumo que a tela já tem.
  */
    it("as contagens vêm do resumo do Painel (as linhas da tela), não das fichas ao vivo", async () => {
      const conferidoEm = new Date().toISOString();
      const supabase = supabaseFalso({
        respostas: {
          obter_ritmo_da_analise: () => ({ data: RITMO, error: null }),
          obter_ultima_conferencia: () => ({ data: conferidoEm, error: null }),
        },
      });
      await montar(supabase);
      await esperar();
      const kpis = [...card().querySelectorAll(".ui-kpi")].map((k) =>
        k.textContent.replace(/\s+/g, ""),
      );
      // 10/2026 no resumo: 1 Aprovado e 1 Pendente (as fichas diziam 414 e 1.098).
      expect(kpis).toContain("Concluído50%");
      expect(kpis).toContain("Faltam1");
      // O momento é o do "Conferido às" do topo, e o recorte é só do edital.
      expect(card().querySelector("[data-momento]").textContent).toMatch(
        /^Conferido às \d{2}:\d{2} · só o 10\/2026$/,
      );
    });

    it("edital sem linha no resumo carregado: sem card", async () => {
      const supabase = supabaseFalso({
        respostas: {
          obter_ritmo_da_analise: () => ({
            data: { editais: [{ ...RITMO.editais[0], edital: "114/2026" }] },
            error: null,
          }),
        },
      });
      await montar(supabase);
      expect(card()).toBeNull();
    });

    it("recolher deixa uma linha só e fica guardado para a pessoa", async () => {
      await montar(comRitmo());
      const botao = () => card().querySelector('[data-acao="recolher-ritmo"]');
      expect(botao().getAttribute("aria-expanded")).toBe("true");
      await clicar(botao());
      expect(card().hasAttribute("data-recolhido")).toBe(true);
      expect(card().querySelector(".ui-kpi")).toBeNull();
      expect(card().querySelector("[data-resumo]")).not.toBeNull();
      expect(
        Object.keys(localStorage).some((chave) =>
          chave.startsWith("monitora.analises.ritmo-recolhido:"),
        ),
      ).toBe(true);
      await act(async () => painel.raiz.unmount());
      document.body.innerHTML = "";
      await montar(comRitmo());
      expect(card().hasAttribute("data-recolhido")).toBe(true);
      await clicar(botao());
      expect(card().hasAttribute("data-recolhido")).toBe(false);
    });

    it("trocar só o escopo não pede de novo; Atualizar pede", async () => {
      const supabase = comRitmo();
      await montar(supabase);
      await escolher(
        document.getElementById("analises-filtro-escopo"),
        "inativo",
      );
      await esperar();
      expect(chamadas(supabase, "obter_ritmo_da_analise")).toHaveLength(1);
      expect(card()).not.toBeNull();
      await clicar(secao.querySelector('[data-acao="atualizar"]'));
      await esperar();
      expect(chamadas(supabase, "obter_ritmo_da_analise")).toHaveLength(2);
    });

    it("em Todos, conta só as linhas do Ativo (o Inativo fica fora; as desativadas nem entram no Todos)", async () => {
      const supabase = supabaseFalso({
        respostas: {
          obter_ritmo_da_analise: () => ({ data: RITMO, error: null }),
          get_analises_dashboard_payload_v2_se_mudou: ({ p_scope }) => ({
            data: payload(
              p_scope === "ativo"
                ? LINHAS
                : [
                    {
                      ...LINHAS[1],
                      id: `x-${p_scope}`,
                      status_consolidado: "Pendente",
                    },
                  ],
              { scope: p_scope },
            ),
            error: null,
          }),
        },
      });
      await montar(supabase);
      const faltam = () =>
        [...card().querySelectorAll(".ui-kpi")]
          .map((k) => k.textContent.replace(/\s+/g, ""))
          .find((t) => /^Faltam\d/.test(t));
      expect(faltam()).toBe("Faltam1");
      await escolher(
        document.getElementById("analises-filtro-escopo"),
        "todos",
      );
      await esperar();
      expect(linhasDaFila()).toHaveLength(5);
      expect(faltam()).toBe("Faltam1");
    });

    it("Destaques de hoje: só medalhistas (com a contagem) e selos, sem quem ficou fora", async () => {
      const hoje = agoraEmBrasilia().hoje;
      const supabase = supabaseFalso({
        respostas: {
          obter_ritmo_da_analise: () => ({
            data: {
              editais: [
                {
                  ...RITMO.editais[0],
                  destaques: {
                    dia: hoje,
                    avaliadores: [
                      { nome: "Ana Souza", qt: 30, reabertas: 1 },
                      { nome: "Bia Lima", qt: 30, reabertas: 0 },
                      { nome: "Caio Reis", qt: 25, reabertas: 0 },
                      { nome: "Davi Melo", qt: 20, reabertas: 2 },
                      { nome: "Eva Dias", qt: 12, reabertas: 0 },
                    ],
                  },
                },
              ],
            },
            error: null,
          }),
        },
      });
      await montar(supabase);
      const bloco = card().querySelector("[data-destaques]");
      expect(bloco.textContent).toContain("Destaques de hoje");
      const medalhas = [...bloco.querySelectorAll("[data-medalha]")].map((m) =>
        m.textContent.trim(),
      );
      expect(medalhas).toEqual([
        "🥇 Ana Souza · 30",
        "🥇 Bia Lima · 30",
        "🥈 Caio Reis · 25",
        "🥉 Davi Melo · 20",
      ]);
      const selos = [...bloco.querySelectorAll("[data-precisao]")].map((m) =>
        m.textContent.trim(),
      );
      expect(selos).toEqual(["🎯 Bia Lima", "🎯 Caio Reis", "🎯 Eva Dias"]);
      // Fora do pódio, nem a contagem aparece.
      expect(bloco.textContent).not.toContain("12");
    });

    it("sem destaques de hoje, o bloco não aparece", async () => {
      await montar(comRitmo());
      expect(card().querySelector("[data-destaques]")).toBeNull();
    });

    it("RPC ausente ou com falha: sem card e a tela segue", async () => {
      await montar(supabaseFalso());
      expect(card()).toBeNull();
      expect(linhasDaFila()).toHaveLength(4);
    });
  });

  describe("pendências prioritárias (atalhos)", () => {
    it("sem responsável, fora do período e pendentes filtram; clicar de novo tira", async () => {
      const linhas = [
        ...LINHAS,
        {
          ...LINHAS[3],
          id: "a5",
          candidato: "Davi",
          data_analise: "01/08/2026",
        },
      ];
      await montar(
        supabaseFalso({
          respostas: {
            get_analises_dashboard_payload_v2_se_mudou: () => ({
              data: payload(linhas),
              error: null,
            }),
          },
        }),
      );
      const item = (chave) =>
        secao.querySelector(`[data-pendencia="${chave}"]`);
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

    it("AC-1.6 — vale junto com os outros filtros; Limpar tudo tira a data; a planilha leva a data", async () => {
      await montar(supabaseFalso());
      await marcarNoFiltro("responsavel", "Diego");
      expect(candidatos()).toEqual(["Bruno Lima", "Clara Souza"]);
      // Só os dias de Diego no gráfico: 0 = 01/09, 1 = 20/09.
      await clicarNoDia(1);
      expect(candidatos()).toEqual(["Clara Souza"]);

      await clicar(secao.querySelector('[data-acao="exportar-excel"]'));
      await esperar();
      const csv = new TextDecoder().decode(baixar.mock.calls.at(-1)[0]);
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
        secao.querySelector('[data-acao="mais-opcoes"] .ui-contagem')
          .textContent,
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
          get_analises_dashboard_payload_v2_se_mudou: () => ({
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
      // O recorte conta o que a busca da fila deixou.
      expect(secao.querySelector("[data-tabela-contagem]").textContent).toBe(
        "Recorte atual: 1 de 120",
      );
      expect(chamadas(supabase, "get_analises_texto_do_painel")).toHaveLength(
        1,
      );
      // Limpar tudo limpa também a busca da fila.
      await clicar(secao.querySelector('[data-acao="limpar-filtros"]'));
      expect(secao.querySelector(".ui-tabela-busca").value).toBe("");
    });

    it("área sem análise nenhuma: a mensagem da área", async () => {
      definirAreaAtual("sede");
      await montar(
        supabaseFalso({
          respostas: {
            get_analises_dashboard_payload_v2_se_mudou: () => ({
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
      expect(links[0].href).toBe(
        urlDaPlanilhaGoogle(DETALHE.origem_arquivo_id),
      );
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
      expect(chamadas(supabase, "get_analise_detalhe_do_painel")).toHaveLength(
        1,
      );
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
    it("Exportar em Excel traz os pareceres antes e baixa o recorte", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      await clicar(kpi("analisado").querySelector("button"));
      await clicar(secao.querySelector('[data-acao="exportar-excel"]'));
      await esperar();
      expect(chamadas(supabase, "get_analises_texto_do_painel")).toHaveLength(
        1,
      );
      expect(baixar).toHaveBeenCalledTimes(1);
      const [bytes, nome] = baixar.mock.calls[0];
      const conteudo = new TextDecoder().decode(bytes);
      expect(nome).toBe("agsus_analises_curriculares_v3.xlsx");
      // A planilha: o cabeçalho e as 3 linhas do recorte, com o parecer.
      expect(conteudo.match(/<row /g)).toHaveLength(4);
      expect(conteudo).toContain("Parecer de Ana");
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
        chamadas(supabase, "get_analises_dashboard_payload_v2_se_mudou"),
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
          get_analises_dashboard_payload_v2_se_mudou: () =>
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
      expect(status().textContent).toBe("Atualizando…");
      await act(async () => soltar());
      await esperar();
      expect(linhasDaFila()).toHaveLength(2);
      expect(status().textContent).toMatch(/^Atualizado em/);
    });

    it("com cópia guardada, a revalidação manda a versão dela; inalterado, nada se baixa e a cópia fica", async () => {
      const armazenamento = armazenamentoEmMemoria();
      await montar(
        supabaseFalso({
          respostas: {
            get_analises_dashboard_payload_v2_se_mudou: () => ({
              data: payload(LINHAS, { versao: "v1" }),
              error: null,
            }),
          },
        }),
        { armazenamento },
      );
      await act(async () => painel.raiz.unmount());
      secao.remove();

      const supabase = supabaseFalso({
        respostas: {
          get_analises_dashboard_payload_v2_se_mudou: () => ({
            data: { inalterado: true, versao: "v1" },
            error: null,
          }),
        },
      });
      await montar(supabase, { armazenamento });
      await esperar();
      expect(
        chamadas(supabase, "get_analises_dashboard_payload_v2_se_mudou"),
      ).toEqual([
        { p_scope: "ativo", p_area: "saude-indigena", p_versao: "v1" },
      ]);
      expect(linhasDaFila()).toHaveLength(4);
      expect(status().textContent).toMatch(/^Atualizado em/);
    });
  });

  describe("o que já veio deixa de valer quando os dados mudam", () => {
    it("Atualizar com a gaveta aberta pede o detalhe de novo", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      await clicar(linhasDaFila()[0].querySelector('[data-acao="detalhes"]'));
      await esperar();
      expect(chamadas(supabase, "get_analise_detalhe_do_painel")).toHaveLength(
        1,
      );
      await clicar(secao.querySelector('[data-acao="atualizar"]'));
      await esperar();
      expect(chamadas(supabase, "get_analise_detalhe_do_painel")).toHaveLength(
        2,
      );
      expect(document.getElementById("analisesGaveta").textContent).toContain(
        "Composição da pontuação",
      );
    });

    it("a revalidação que traz outra versão esquece pareceres e detalhes já trazidos", async () => {
      const armazenamento = armazenamentoEmMemoria();
      await montar(supabaseFalso(), { armazenamento });
      await act(async () => painel.raiz.unmount());
      secao.remove();

      let soltar;
      const supabase = supabaseFalso({
        respostas: {
          get_analises_dashboard_payload_v2_se_mudou: () =>
            new Promise((ok) => {
              soltar = () =>
                ok({
                  data: payload(LINHAS, {
                    generated_at: "2026-10-01T09:00:00Z",
                  }),
                  error: null,
                });
            }),
        },
      });
      await montar(supabase, { armazenamento });
      // Da cópia: pareceres e detalhe pedidos antes da versão nova chegar.
      let ok;
      await act(async () => {
        ok = await painel.estado.garantirTextos();
      });
      expect(ok).toBe(true);
      await clicar(linhasDaFila()[0].querySelector('[data-acao="detalhes"]'));
      await esperar();
      expect(chamadas(supabase, "get_analises_texto_do_painel")).toHaveLength(
        1,
      );
      expect(chamadas(supabase, "get_analise_detalhe_do_painel")).toHaveLength(
        1,
      );
      await act(async () => soltar());
      await esperar();
      // A gaveta aberta pede o detalhe da versão nova; os pareceres são pedidos de novo.
      expect(chamadas(supabase, "get_analise_detalhe_do_painel")).toHaveLength(
        2,
      );
      expect(painel.estado.obter().textos).toBe("");
      await act(async () => {
        ok = await painel.estado.garantirTextos();
      });
      expect(ok).toBe(true);
      expect(chamadas(supabase, "get_analises_texto_do_painel")).toHaveLength(
        2,
      );
    });

    it("Planilha com os pareceres já a caminho (busca geral): espera a mesma leitura", async () => {
      let soltar;
      const supabase = supabaseFalso({
        respostas: {
          get_analises_texto_do_painel: () =>
            new Promise((ok) => {
              soltar = () => ok({ data: TEXTOS, error: null });
            }),
        },
      });
      await montar(supabase);
      let busca;
      let csv;
      await act(async () => {
        busca = painel.estado.garantirTextos();
        csv = painel.estado.exportarExcel((linhas) => linhas);
      });
      await act(async () => soltar());
      expect(await busca).toBe(true);
      expect(await csv).toBe(true);
      expect(chamadas(supabase, "get_analises_texto_do_painel")).toHaveLength(
        1,
      );
      expect(baixar).toHaveBeenCalledTimes(1);
      expect(toast).not.toHaveBeenCalledWith(
        "Não foi possível trazer os pareceres para a planilha. Tente novamente.",
        "error",
      );
    });

    it("Atualizar que falha não deixa os pareceres carregando", async () => {
      let falharLista = false;
      const supabase = supabaseFalso({
        respostas: {
          get_analises_texto_do_painel: () => new Promise(() => {}),
          get_analises_dashboard_payload_v2_se_mudou: () =>
            falharLista
              ? { data: null, error: { message: "fora do ar" } }
              : { data: payload(), error: null },
        },
      });
      await montar(supabase);
      await act(async () => void painel.estado.garantirTextos());
      expect(painel.estado.obter().textos).toBe("carregando");
      falharLista = true;
      await act(async () => void painel.estado.atualizar());
      await esperar();
      expect(painel.estado.obter().textos).toBe("");
      expect(painel.estado.obter().atualizando).toBe(false);
      expect(linhasDaFila()).toHaveLength(4);
    });
  });

  describe("sessão, permissão, erro e demora", () => {
    it("sem acesso (o porteiro diz não): aviso e nada da lista", async () => {
      const supabase = supabaseFalso({
        respostas: {
          usuario_pode_ler_analises: () => ({ data: false, error: null }),
        },
      });
      const armazenamento = armazenamentoEmMemoria();
      armazenamento.mapa.set("copia-antiga", payload());
      await montar(supabase, { armazenamento });
      expect(secao.querySelector(".ui-aviso").textContent).toBe(
        "Sem acesso ao Painel das análises.",
      );
      expect(
        chamadas(supabase, "get_analises_dashboard_payload_v2_se_mudou"),
      ).toHaveLength(0);
      expect(status().textContent).toBe("Sem acesso");
      // As cópias do navegador não ficam para quem perdeu o acesso.
      expect(armazenamento.mapa.size).toBe(0);
    });

    it("a lista recusa (42501): o mesmo aviso", async () => {
      await montar(
        supabaseFalso({
          respostas: {
            get_analises_dashboard_payload_v2_se_mudou: () => ({
              data: null,
              error: { code: "42501", message: "x" },
            }),
          },
        }),
      );
      expect(secao.querySelector(".ui-aviso").textContent).toBe(
        "Sem acesso ao Painel das análises.",
      );
    });

    it("sem sessão: aviso curto, sem o jargão do banco", async () => {
      await montar(supabaseFalso({ sessao: false }));
      expect(secao.querySelector(".ui-aviso").textContent).toBe(
        "Sessão não localizada. Entre de novo no Yeendé.",
      );
    });

    it("falha na primeira carga: aviso com Tentar novamente", async () => {
      let falhar = true;
      const supabase = supabaseFalso({
        respostas: {
          get_analises_dashboard_payload_v2_se_mudou: () =>
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
          get_analises_dashboard_payload_v2_se_mudou: () =>
            new Promise(() => {}),
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
        chamadas(supabase, "get_analises_dashboard_payload_v2_se_mudou").at(-1),
      ).toEqual({
        p_scope: "ativo",
        p_area: "projetos",
        p_versao: null,
      });
      expect(linhasDaFila()).toHaveLength(4);
    });

    it("trocar de área com a tela escondida não carrega; ao voltar, carrega a área nova", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      secao.classList.remove("active");
      await act(async () => definirAreaAtual("projetos"));
      await esperar();
      expect(
        chamadas(supabase, "get_analises_dashboard_payload_v2_se_mudou"),
      ).toHaveLength(1);
      secao.classList.add("active");
      await abrirATela();
      expect(
        chamadas(supabase, "get_analises_dashboard_payload_v2_se_mudou").at(-1),
      ).toEqual({ p_scope: "ativo", p_area: "projetos", p_versao: null });
    });

    it("reabrir na mesma área não recarrega; depois de 5 minutos, relê por trás", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      await abrirATela();
      expect(
        chamadas(supabase, "get_analises_dashboard_payload_v2_se_mudou"),
      ).toHaveLength(1);
      const agora = Date.now();
      const relogio = vi
        .spyOn(Date, "now")
        .mockReturnValue(agora + 6 * 60 * 1000);
      await abrirATela();
      expect(
        chamadas(supabase, "get_analises_dashboard_payload_v2_se_mudou"),
      ).toHaveLength(2);
      relogio.mockRestore();
    });

    it("abrir de novo no meio da primeira carga não pede outra vez", async () => {
      let soltar;
      const supabase = supabaseFalso({
        respostas: {
          get_analises_dashboard_payload_v2_se_mudou: () =>
            new Promise((ok) => {
              soltar = () => ok({ data: payload(), error: null });
            }),
        },
      });
      await montar(supabase, { abrir: false });
      await act(async () => void painel.render());
      await act(async () => void painel.render());
      expect(
        chamadas(supabase, "get_analises_dashboard_payload_v2_se_mudou"),
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
      expect(status().textContent).toBe("Carregando dados…");
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
});

bloco("modulos/entrevistas", async () => {
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

  const { criarEntrevistas } =
    await import("../src/modulos/entrevistas/entrevistas.tsx");

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
      painel = montarTela(criarEntrevistas, "page-entrevistas", {
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
      expect(supabase.rpc).toHaveBeenCalledWith(
        "get_entrevistas_da_area_se_mudou",
        {
          p_area: "saude-indigena",
          p_versao: null,
        },
      );
      expect(kpi("vagas")).toBe("2");
      expect(kpi("aptos")).toBe("1");
      expect(kpi("inaptos")).toBe("1");
      expect(kpi("faltaram")).toBe("0");
      expect(kpi("media")).toBe("6,00");
      expect(kpi("sem-entrevista")).toBe("1");
      // A última carga aparece uma vez só, discreta, no topo.
      expect(status().textContent).toBe("Planilha conferida em 29/09, 10:30");
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
        doEdital("x4", {
          nota: null,
          parecer: "SEM_PARECER",
          compareceu: null,
        }),
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

    it("agenda com erro: o erro e Tentar de novo, não 'nenhuma agendada'", async () => {
      let falhar = true;
      const supabase = {
        rpc: vi.fn(async (nome) =>
          nome === "obter_agenda_entrevista"
            ? falhar
              ? { data: null, error: { message: "tempo esgotado" } }
              : { data: { itens: [] }, error: null }
            : { data: PAYLOAD_DO_EDITAL, error: null },
        ),
        auth: supabaseDoEdital(null).auth,
      };
      await montar(supabase);
      const agenda = () => secao.querySelector(".entrevistas-agenda-proxima");
      expect(agenda().textContent).toContain(
        "Não foi possível carregar a agenda",
      );
      expect(agenda().textContent).not.toContain("Nenhuma entrevista agendada");
      falhar = false;
      await clicar(
        [...agenda().querySelectorAll("button")].find(
          (b) => b.textContent === "Tentar de novo",
        ),
      );
      await esperar();
      expect(chamadas(supabase, "obter_agenda_entrevista")).toHaveLength(2);
      expect(agenda().textContent).toContain("Nenhuma entrevista agendada");
    });

    it("recarregar o painel renova a agenda guardada", async () => {
      const supabase = supabaseDoEdital({ itens: [] });
      await montar(supabase);
      expect(chamadas(supabase, "obter_agenda_entrevista")).toHaveLength(1);
      await abrirATela();
      expect(chamadas(supabase, "obter_agenda_entrevista")).toHaveLength(2);
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
      expect(aviso.textContent).toContain(
        "o desempate é feito na Classificação",
      );
      window.navigate = vi.fn();
      try {
        await clicar(aviso.querySelector('[data-ir-para="classificacao"]'));
        // O edital vai junto no endereço; a rota abre a Classificação nele.
        expect(window.navigate).toHaveBeenCalledWith("classificacao", {
          edital: EDITAL_ID,
        });
      } finally {
        delete window.navigate;
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
      await escolher(
        document.getElementById("filtro-edital"),
        "Edital 01/2026",
      );
      expect(secao.querySelector(".entrevistas-agenda-proxima")).not.toBeNull();
    });
  });

  describe("cópia guardada (stale-while-revalidate)", async () => {
    const { criarEstadoDasEntrevistas } =
      await import("../src/modulos/entrevistas/estado.ts");

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

    it("sem rede, fica a cópia com a data dela, sem toast nem erro", async () => {
      const armazenamento = memoria();
      await criarEstadoDasEntrevistas({
        supabase: supabaseFalso({ data: PAYLOAD, error: null }),
        armazenamento,
      }).carregar("saude-indigena");
      await vi.waitFor(() => expect(armazenamento.mapa.size).toBe(2));
      const { guardadoEm } = armazenamento.mapa.get(
        "entrevistas:saude-indigena",
      );
      toast.mockClear();

      const semRede = criarEstadoDasEntrevistas({
        supabase: supabaseFalso({
          data: null,
          error: { message: "TypeError: Failed to fetch", code: "" },
        }),
        armazenamento,
        toast,
      });
      expect(await semRede.carregar("saude-indigena")).toBe(false);
      expect(semRede.obter()).toMatchObject({
        carregado: true,
        erroAoCarregar: "",
        atualizando: false,
        copiaDe: guardadoEm,
      });
      expect(semRede.obter().dados.entrevistas).toHaveLength(2);
      expect(toast).not.toHaveBeenCalled();
      expect(armazenamento.mapa.size).toBe(2);
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
      expect(supabase.rpc).toHaveBeenCalledWith(
        "get_entrevistas_da_area_se_mudou",
        {
          p_area: "saude-indigena",
          p_versao: null,
        },
      );
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
      ).toEqual(["Atualizar", "Exportar em Excel", "Salvar em PDF"]);
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
      expect(secao.querySelector(".entrevistas-kpis").children).toHaveLength(8);
      expect(
        secao.querySelector('.entrevistas-kpis [data-kpi="inaptos"]').dataset
          .tom,
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
      expect(document.body.classList.contains("analises-is-loading")).toBe(
        false,
      );
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
      await clicar(secao.querySelector('[data-acao="exportar-excel"]'));
      expect(baixar).toHaveBeenCalledTimes(1);
      const [bytes, nome] = baixar.mock.calls[0];
      const conteudo = new TextDecoder().decode(bytes);
      expect(nome).toMatch(
        /^entrevistas-saude-indigena-\d{4}-\d{2}-\d{2}\.xlsx$/,
      );
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
      await act(async () => parecer.options.onClick(null, []));
      expect(linhasDaTabela()).toHaveLength(2);
      const indice = parecer.data.labels.indexOf("Inapto");
      await act(async () => parecer.options.onClick(null, [{ index: indice }]));
      expect(linhasDaTabela()).toHaveLength(1);
      expect(
        secao
          .querySelector('.entrevistas-kpis [data-kpi="inaptos"]')
          .classList.contains("is-ativo"),
      ).toBe(true);
    });
    it("os tooltips dos critérios e das unidades aceitam a ausência de pontos", async () => {
      await montar(supabaseFalso({ data: PAYLOAD, error: null }));
      for (const id of ["chartCriterios", "chartUnidades"]) {
        const grafico = graficos.find(
          (g) => g.canvas.id === id && g.canvas.isConnected,
        );
        expect(grafico.options.plugins.tooltip.callbacks.title([])).toBe("");
      }
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
      expect(
        chamadas(supabase, "get_entrevistas_da_area_se_mudou").at(-1)[1],
      ).toEqual({
        p_area: "sede",
        p_versao: null,
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
      expect(
        chamadas(supabase, "get_entrevistas_da_area_se_mudou"),
      ).toHaveLength(2);
      definirAreaAtual("projetos");
      await abrirATela();
      expect(supabase.rpc).toHaveBeenLastCalledWith(
        "get_entrevistas_da_area_se_mudou",
        {
          p_area: "projetos",
          p_versao: null,
        },
      );
    });

    it("a volta à tela manda a versão que tem; inalterado, a tela fica como estava", async () => {
      const supabase = supabaseFalso({
        data: { ...PAYLOAD, versao: "v1" },
        error: null,
      });
      await montar(supabase);
      const antes = linhasDaTabela().length;
      supabase.rpc.mockResolvedValue({
        data: { inalterado: true, versao: "v1" },
        error: null,
      });
      await abrirATela();
      expect(supabase.rpc).toHaveBeenLastCalledWith(
        "get_entrevistas_da_area_se_mudou",
        {
          p_area: "saude-indigena",
          p_versao: "v1",
        },
      );
      expect(linhasDaTabela()).toHaveLength(antes);
      expect(antes).toBeGreaterThan(0);
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
      expect(secao.querySelectorAll(".ui-grafico.is-carregando")).toHaveLength(
        5,
      );
      expect(
        secao.querySelectorAll(".ui-pendencias .ui-esqueleto"),
      ).toHaveLength(4);
      expect(
        secao.querySelectorAll('.ui-tabela tbody tr[aria-hidden="true"]'),
      ).toHaveLength(8);
      expect(status().textContent).toBe("Carregando dados…");

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
        "Sessão não localizada. Entre de novo no Yeendé.",
      );
      expect(status().textContent).toBe("Sessão não localizada");
      expect(supabase.rpc).not.toHaveBeenCalled();
      expect(secao.querySelector(".entrevistas-visoes")).toBeNull();
    });
  });
});

bloco("modulos/recursos", async () => {
  /*
  A tela de Recursos como módulo do app (src/modulos/recursos/): monta na
  própria `#page-recursos`, carrega a área atual do app quando o legado abre a
  tela (`render()`), segue o tema do app, usa o aviso global e os componentes
  de src/ui/ (classes .ui-*). Consulta só de leitura para quem não edita,
  cadastro com o candidato das análises (autopreenchimento), aviso de
  duplicado, etapa marcada pela gaveta, KPI que filtra e os gráficos Chart.js.
*/

  // O Chart.js não desenha no jsdom (sem canvas): um falso guarda o que recebeu.

  const { criarRecursos } =
    await import("../src/modulos/recursos/recursos.tsx");

  const RECURSO_EXISTENTE = {
    id: "r1",
    nu: 7,
    edital_id: "e1",
    edital: "105/2026",
    unidade: "DSEI Litoral Sul",
    origem: "analise-curricular",
    analise_id: "a1",
    fora_analise: false,
    candidato: "Ana Ribeiro",
    codigo: "111",
    cargo: "Enfermeiro 40h",
    vaga: "V-10",
    nota_anterior: 50,
    nota_atual: 55,
    resultado_anterior: "Reprovado",
    resultado_atual: "Aprovado",
    analista: "Carla",
    situacao: "REGISTRADO",
    processo_sei: null,
    mudou_classificacao: false,
    download_empregare_em: null,
    processo_sei_em: null,
    upload_sei_em: null,
    resposta_candidato_em: null,
    decisao_em: null,
    criado_em: "2026-09-20T12:00:00Z",
    atualizado_em: "2026-09-20T12:00:00Z",
    revisao: 1,
  };

  const payload = (extra = {}) => ({
    schema_version: 1,
    area: "saude-indigena",
    pode_editar: true,
    origens: [
      { id: "analise-curricular", rotulo: "Análise curricular", ativo: true },
      { id: "entrevista", rotulo: "Entrevista", ativo: true },
      { id: "resultado-final", rotulo: "Resultado final", ativo: true },
    ],
    editais: [
      {
        id: "e1",
        edital: "105/2026",
        unidade: "DSEI Litoral Sul",
        tem_analises: true,
      },
      {
        id: "e2",
        edital: "30/2026",
        unidade: "DSEI Bahia",
        tem_analises: false,
      },
    ],
    recursos: [RECURSO_EXISTENTE],
    cronogramas: [
      {
        edital_id: "e1",
        ordem: 1,
        atividade: "Prazo de recurso do resultado preliminar documental",
        inicio: "2026-09-21",
        fim: "2026-09-22",
      },
    ],
    ...extra,
  });

  const CANDIDATOS = [
    {
      id: "a1",
      candidato: "Ana Ribeiro",
      codigo: "111",
      vaga: "V-10",
      cargo: "Enfermeiro 40h",
      nota: 55,
      resultado: "Aprovado",
      responsavel: "Carla",
      ativo: true,
    },
    {
      id: "a2",
      candidato: "Bruno Lima",
      codigo: "222",
      vaga: "V-11",
      cargo: "Médico 20h",
      nota: 72.5,
      resultado: "Aprovado",
      responsavel: "Diego",
      ativo: true,
    },
  ];

  function supabaseFalso({ dados = payload(), respostas = {}, auth } = {}) {
    const rpc = vi.fn(async (nome, argumentos) => {
      if (respostas[nome]) return respostas[nome](argumentos);
      if (nome === "get_recursos_da_area") return { data: dados, error: null };
      if (nome === "buscar_candidatos_recurso")
        return {
          data: CANDIDATOS.filter((c) =>
            c.candidato
              .toLowerCase()
              .includes(argumentos.p_busca.toLowerCase()),
          ),
          error: null,
        };
      if (nome === "get_recurso_candidato_detalhe")
        return {
          data: {
            id: argumentos.p_id,
            observacao: "",
            etapas: {},
            historico: [],
          },
          error: null,
        };
      if (nome === "salvar_recurso_candidato")
        return { data: { id: "novo", nu: 8, revisao: 1 }, error: null };
      if (nome === "marcar_etapa_recurso")
        return {
          data: { revisao: 2, alterou: true, em: "2026-09-29T10:00:00Z" },
          error: null,
        };
      return { data: null, error: null };
    });
    return auth ? { rpc, auth } : { rpc };
  }

  let secao;
  let painel;
  const toast = vi.fn();
  const baixar = vi.fn();

  /*
  Como o app monta: o módulo nasce na `<section id="page-recursos">` (vazia,
  sem pedir nada ao banco) e o legado chama `render()` ao navegar para a
  tela. A área é a área atual do app (dados-do-monitoramento.ts).
*/
  async function montar(supabase, { abrir = true, ...opcoes } = {}) {
    secao = document.createElement("section");
    secao.id = "page-recursos";
    secao.className = "page active";
    document.body.append(secao);
    await act(async () => {
      painel = montarTela(criarRecursos, "page-recursos", {
        secao,
        supabase,
        toast,
        baixar,
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
  const botao = (texto) =>
    [...document.querySelectorAll("button")].find((b) =>
      b.textContent.trim().startsWith(texto),
    );
  const kpi = (chave) =>
    document.querySelector(`.recursos-kpis [data-kpi="${chave}"]`);
  const contagem = () =>
    document.querySelector(".recursos-contagem").textContent;
  const status = () => document.querySelector(".ui-topo .status-discreto");
  const esperarBusca = () =>
    esperar(() => new Promise((ok) => setTimeout(ok, 350)));

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
    sessionStorage.clear();
    localStorage.clear();
    toast.mockClear();
    baixar.mockClear();
  });

  describe("a tela dentro do app", () => {
    it("monta na seção sem pedir nada; a primeira abertura (render) carrega a área atual", async () => {
      const supabase = supabaseFalso();
      await montar(supabase, { abrir: false });
      expect(secao.querySelector(".ui-tela.recursos-tela")).not.toBeNull();
      expect(supabase.rpc).not.toHaveBeenCalled();

      await abrirATela();
      expect(supabase.rpc).toHaveBeenCalledWith("get_recursos_da_area", {
        p_area: "saude-indigena",
      });
      expect(contagem()).toBe("1 recurso");
    });

    it("não repete o cabeçalho do app: topo só com status e ações, sem tema nem tela cheia", async () => {
      await montar(supabaseFalso());
      const topo = secao.querySelector("header.ui-topo");
      expect(topo.querySelector("h1, h2")).toBeNull();
      expect(status().textContent).toMatch(/^Atualizado em 20\/09\/2026/);
      expect(
        [...topo.querySelectorAll("button")].map((b) => b.textContent.trim()),
      ).toEqual([
        "Atualizar",
        "Exportar em Excel",
        "Salvar em PDF",
        "Analisar",
      ]);
      expect(topo.querySelector('[aria-label*="tema"]')).toBeNull();
      expect(topo.querySelector('[aria-label*="tela cheia"]')).toBeNull();
      // Uma data de carga só, e sem selo "Somente consulta".
      expect(document.querySelectorAll(".status-discreto")).toHaveLength(1);
      expect(naTela("Somente consulta")).toBe(false);
    });

    it("usa src/ui/ com as classes .ui-*, sem o CSS nem os ids do painel de análises", async () => {
      await montar(supabaseFalso());
      expect(
        secao.querySelector("section.ui-card.ui-filtros h2").textContent,
      ).toBe("Refinar resultados");
      expect(
        document.querySelectorAll(".recursos-kpis")[0].children,
      ).toHaveLength(4);
      expect(kpi("prazo-vencido").dataset.tom).toBe("perigo");
      expect(
        [...secao.querySelectorAll(".ui-card .ui-titulo")].map((e) =>
          e.textContent.trim(),
        ),
      ).toEqual(
        expect.arrayContaining([
          "Recursos por analista",
          "Pendências prioritárias",
          "Esteira do recurso",
          "Fila de recursos",
        ]),
      );
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
        "toastHost",
        "recursosPainel",
      ])
        expect(document.getElementById(id), id).toBeNull();
      expect(
        secao.querySelector(
          ".topbar, .kpi, .panel, .filter-panel, .table-card, .chart-wrap, .attention-list, .badge",
        ),
      ).toBeNull();
      expect(document.body.classList.contains("analises-is-loading")).toBe(
        false,
      );
    });

    it("recursos por analista é o Chart.js de barras empilhadas", async () => {
      await montar(supabaseFalso());
      const grafico = graficos.find(
        (g) => g.canvas.id === "chartAnalista" && g.canvas.isConnected,
      );
      expect(grafico.config.type).toBe("bar");
      expect(grafico.data.labels).toEqual(["Carla"]);
      expect(grafico.data.datasets.map((d) => d.label)).toEqual([
        "Sem decisão",
        "Decididos",
      ]);
      expect(grafico.options.scales.x.stacked).toBe(true);
      expect(
        graficos
          .filter((g) => g.canvas.isConnected)
          .map((g) => g.canvas.id)
          .sort(),
      ).toEqual([
        "chartAnalista",
        "chartEsteira",
        "chartImpacto",
        "chartSituacao",
      ]);
    });

    it("dicas e clique sem elemento no gráfico não alteram o recorte", async () => {
      await montar(supabaseFalso());
      const grafico = graficos.find(
        (g) => g.canvas.id === "chartAnalista" && g.canvas.isConnected,
      );
      const dicas = grafico.options.plugins.tooltip.callbacks;
      expect(dicas.title([])).toBe("");
      expect(dicas.afterBody([])).toEqual(["Total: 0"]);
      await act(async () => grafico.options.onClick({}, []));
      expect(document.getElementById("filtro-analista").value).toBe("");
      expect(dicas.title([{ dataIndex: 0 }])).toBe("Carla");
      expect(dicas.afterBody([{ dataIndex: 0 }])).toEqual(["Total: 1"]);
    });
  });

  describe("tema do app", () => {
    it("segue o tema do app: o escuro (data-theme + agsus:tema-alterado) redesenha os gráficos", async () => {
      await montar(supabaseFalso());
      const grafico = graficos.find(
        (g) => g.canvas.id === "chartAnalista" && g.canvas.isConnected,
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
        await montar(supabaseFalso());
        const grafico = graficos.find(
          (g) => g.canvas.id === "chartSituacao" && g.canvas.isConnected,
        );
        expect(grafico.options.scales.y.ticks.color).toBe("#123456");
      } finally {
        document.documentElement.style.removeProperty("--text-secondary");
      }
    });
  });

  describe("área atual do app", () => {
    it("trocar a área com a tela aberta recarrega com a nova e zera os filtros", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      await clicar(kpi("prazo-vencido").querySelector("button"));
      expect(kpi("prazo-vencido").classList.contains("is-ativo")).toBe(true);

      await act(async () => definirAreaAtual("sede"));
      await esperar();
      expect(supabase.rpc).toHaveBeenLastCalledWith("get_recursos_da_area", {
        p_area: "sede",
      });
      expect(painel.estado.obter().area).toBe("sede");
      expect(kpi("prazo-vencido").classList.contains("is-ativo")).toBe(false);
    });

    it("cada abertura pega a área de agora; na mesma área, relê por trás (permissões do banco)", async () => {
      let podeEditar = false;
      const supabase = supabaseFalso({
        respostas: {
          get_recursos_da_area: () => ({
            data: payload({ pode_editar: podeEditar }),
            error: null,
          }),
        },
      });
      await montar(supabase, { modo: "analise" });
      expect(botao("Novo recurso")).toBeUndefined();

      podeEditar = true;
      await abrirATela();
      expect(supabase.rpc).toHaveBeenCalledTimes(2);
      expect(botao("Novo recurso")).toBeTruthy();

      definirAreaAtual("projetos");
      await abrirATela();
      expect(supabase.rpc).toHaveBeenLastCalledWith("get_recursos_da_area", {
        p_area: "projetos",
      });
    });

    it("render relê as comemorações do app (selo do prazo cumprido)", async () => {
      let ligadas = false;
      await montar(supabaseFalso(), { comemoracoesLigadas: () => ligadas });
      expect(painel.estado.obter().comemoracoes).toBe(false);
      ligadas = true;
      await abrirATela();
      expect(painel.estado.obter().comemoracoes).toBe(true);
    });

    it("outro usuário na mesma aba: o que era do anterior sai da tela", async () => {
      let avisar;
      const supabase = supabaseFalso({
        auth: {
          getSession: async () => ({
            data: { session: { user: { id: "a" } } },
          }),
          onAuthStateChange: (ouvinte) => {
            avisar = ouvinte;
            return { data: { subscription: { unsubscribe() {} } } };
          },
        },
      });
      await montar(supabase);
      await act(async () => avisar("SIGNED_IN", { user: { id: "a" } }));
      expect(contagem()).toBe("1 recurso");

      await act(async () => avisar("SIGNED_IN", { user: { id: "b" } }));
      expect(painel.estado.obter().carregado).toBe(false);
      expect(painel.estado.obter().area).toBe("");
      expect(naTela("Ana Ribeiro")).toBe(false);
    });
  });

  describe("carga", () => {
    it("antes do dado, o skeleton dos KPIs, gráficos e fila; depois, os números", async () => {
      let responder;
      const supabase = supabaseFalso({
        respostas: {
          get_recursos_da_area: () =>
            new Promise((ok) => {
              responder = ok;
            }),
        },
      });
      await montar(supabase);
      expect(kpi("aguardando-parecer").getAttribute("aria-busy")).toBe("true");
      expect(
        kpi("aguardando-parecer").querySelector(".ui-esqueleto"),
      ).not.toBeNull();
      expect(secao.querySelectorAll(".ui-grafico.is-carregando")).toHaveLength(
        4,
      );
      expect(
        secao.querySelectorAll('.ui-tabela tbody tr[aria-hidden="true"]'),
      ).toHaveLength(8);
      expect(status().textContent).toBe("Carregando dados…");

      await esperar(() => responder({ data: payload(), error: null }));
      expect(contagem()).toBe("1 recurso");
      expect(
        kpi("prazo-vencido").querySelector(".ui-kpi-valor").textContent,
      ).toBe("1");
      expect(secao.querySelector(".ui-grafico.is-carregando")).toBeNull();
      // Prazo vencido (22/09) e nota que mudou (50 → 55) viram pendência.
      expect(naTela("Prazo de resposta vencido")).toBe(true);
      expect(naTela("Mudança de nota ou classificação")).toBe(true);
    });

    it("falha na primeira carga: aviso com “Tentar novamente”", async () => {
      let falhar = true;
      const supabase = supabaseFalso({
        respostas: {
          get_recursos_da_area: () =>
            falhar
              ? { data: null, error: { code: "42501", message: "x" } }
              : { data: payload(), error: null },
        },
      });
      await montar(supabase);
      const aviso = secao.querySelector(".ui-aviso[role=alert]");
      expect(aviso.textContent).toContain(
        "Seu acesso não inclui os recursos desta área.",
      );
      falhar = false;
      await clicar(botao("Tentar novamente"));
      await esperar();
      expect(contagem()).toBe("1 recurso");
      expect(secao.querySelector(".ui-aviso[role=alert]")).toBeNull();
    });

    /*
    Saúde Indígena sem recurso nenhum: os quatro gráficos e as pendências
    ocupavam a tela vazios (11/11/2026). Vazio, erro e com dados são três
    estados diferentes: só a base que chegou vazia ganha a linha compacta.
  */
    describe("sem recursos na área × erro × com dados", () => {
      const vazio = () => secao.querySelector(".recursos-sem-recursos");
      const cardsDeGrafico = () =>
        secao.querySelectorAll(".ui-card-de-grafico").length;

      it("base carregada sem recursos: estado vazio compacto no lugar dos gráficos", async () => {
        let responder;
        await montar(
          supabaseFalso({
            respostas: {
              get_recursos_da_area: () =>
                new Promise((ok) => {
                  responder = ok;
                }),
            },
          }),
        );
        // Carregando não é vazio: seguem os skeletons dos gráficos.
        expect(vazio()).toBeNull();
        expect(
          secao.querySelectorAll(".ui-grafico.is-carregando"),
        ).toHaveLength(4);

        await esperar(() =>
          responder({ data: payload({ recursos: [] }), error: null }),
        );
        expect(vazio().querySelector(".ui-vazio").textContent).toBe(
          "Nenhum recurso nesta área. Gráficos e pendências aparecem a partir do primeiro.",
        );
        expect(cardsDeGrafico()).toBe(0);
        expect(graficos).toHaveLength(0);
        expect(naTela("Pendências prioritárias")).toBe(false);
        expect(secao.querySelector(".ui-aviso[role=alert]")).toBeNull();
        // KPIs e fila continuam, com zero e com o vazio da tabela.
        expect(
          kpi("aguardando-parecer").querySelector(".ui-kpi-valor").textContent,
        ).toBe("0");
        expect(contagem()).toBe("0 recursos");
      });

      it("falha na carga não vira “nenhum recurso”: só o aviso de erro", async () => {
        await montar(
          supabaseFalso({
            respostas: {
              get_recursos_da_area: () => ({
                data: null,
                error: { message: "rede" },
              }),
            },
          }),
        );
        expect(
          secao.querySelector(".ui-aviso[role=alert]").textContent,
        ).toContain("Não foi possível carregar os recursos");
        expect(vazio()).toBeNull();
      });

      it("com recursos, os gráficos e as pendências, sem o estado vazio", async () => {
        await montar(supabaseFalso());
        expect(vazio()).toBeNull();
        expect(cardsDeGrafico()).toBe(4);
        expect(naTela("Pendências prioritárias")).toBe(true);
      });
    });

    it("falha ao atualizar com a tela carregada: o aviso global do app (toast)", async () => {
      let falhar = false;
      const supabase = supabaseFalso({
        respostas: {
          get_recursos_da_area: () =>
            falhar
              ? { data: null, error: { message: "rede" } }
              : { data: payload(), error: null },
        },
      });
      await montar(supabase);
      falhar = true;
      await clicar(document.querySelector('[data-acao="atualizar"]'));
      await esperar();
      expect(toast).toHaveBeenCalledWith(
        "Não foi possível atualizar os recursos: rede",
        "error",
      );
      expect(contagem()).toBe("1 recurso");
    });

    it("sem sessão no cliente do app, avisa e não pede os recursos", async () => {
      const supabase = supabaseFalso({
        auth: { getSession: async () => ({ data: { session: null } }) },
      });
      await montar(supabase);
      expect(secao.querySelector(".ui-aviso[role=alert]").textContent).toBe(
        "Sessão não localizada. Entre de novo no Yeendé.",
      );
      expect(supabase.rpc).not.toHaveBeenCalledWith(
        "get_recursos_da_area",
        expect.anything(),
      );
      // Só o aviso: sem KPIs a zero nem tabela vazia, que diziam "nenhum recurso".
      expect(secao.querySelector(".recursos-kpis")).toBeNull();
      expect(secao.querySelector("table")).toBeNull();
    });
  });

  describe("filtros", () => {
    it("o KPI filtra a tela e o recorte ativo diz o quê; clicar de novo tira", async () => {
      await montar(
        supabaseFalso({
          dados: payload({
            recursos: [
              RECURSO_EXISTENTE,
              {
                ...RECURSO_EXISTENTE,
                id: "r2",
                nu: 8,
                candidato: "Bruno Lima",
                analise_id: "a2",
                situacao: "DEFERIDO",
                decisao_em: "2026-09-23T12:00:00Z",
                resposta_candidato_em: "2026-09-23T12:00:00Z",
              },
            ],
          }),
        }),
      );
      const botaoDoKpi = kpi("prazo-vencido").querySelector("button");
      await clicar(botaoDoKpi);
      expect(botaoDoKpi.getAttribute("aria-pressed")).toBe("true");
      expect(kpi("prazo-vencido").classList.contains("is-ativo")).toBe(true);
      expect(document.querySelector("[data-recorte]").textContent).toBe(
        "Recorte ativo: Pendência: Prazo de resposta vencido",
      );
      expect(contagem()).toBe("1 de 2");
      expect(document.querySelector(".ui-filtros-resumo").textContent).toBe(
        "Todos · 1 filtro adicional",
      );
      expect(document.querySelector(".ui-chip").textContent).toContain(
        "Prazo de resposta vencido",
      );
      await clicar(botaoDoKpi);
      expect(contagem()).toBe("2 recursos");
    });

    it("“Mais opções” mostra a busca em toda a página, que vira filtro", async () => {
      await montar(supabaseFalso());
      const adicionais = document.getElementById("recursosFiltrosAdicionais");
      expect(adicionais.hidden).toBe(true);
      await clicar(document.querySelector('[data-acao="mais-opcoes"]'));
      expect(adicionais.hidden).toBe(false);
      await digitar(document.getElementById("filtro-busca"), "zzz");
      expect(contagem()).toBe("0 de 1");
      await clicar(document.querySelector('[data-acao="limpar-filtros"]'));
      expect(contagem()).toBe("1 recurso");
    });

    it("Exportar baixa o CSV do recorte, com a área no nome", async () => {
      await montar(supabaseFalso());
      await clicar(document.querySelector('[data-acao="exportar-excel"]'));
      expect(baixar).toHaveBeenCalledTimes(1);
      const [bytes, nome] = baixar.mock.calls[0];
      const conteudo = new TextDecoder().decode(bytes);
      expect(conteudo).toContain("Ana Ribeiro");
      expect(nome).toMatch(/^recursos-saude-indigena-\d{4}-\d{2}-\d{2}\.xlsx$/);
    });
  });

  describe("selo do prazo cumprido", () => {
    const decidido = (id, dia) => ({
      ...RECURSO_EXISTENTE,
      id,
      nu: id === "r2" ? 8 : 9,
      candidato: id === "r2" ? "Bruno Lima" : "Célia Souza",
      situacao: "DEFERIDO",
      decisao_em: `${dia}T12:00:00`,
      resposta_candidato_em: `${dia}T12:00:00`,
    });
    const dados = () =>
      payload({
        recursos: [
          RECURSO_EXISTENTE,
          decidido("r2", "2026-09-22"),
          decidido("r3", "2026-09-25"),
        ],
      });
    const selos = () =>
      [...document.querySelectorAll(".ui-tabela .recursos-no-prazo")].map(
        (s) => [s.textContent, s.dataset.tom === "sucesso"],
      );

    it("com as comemorações ligadas: No prazo (verde) e Fora do prazo (neutro), só nos decididos", async () => {
      const { estado } = await montar(supabaseFalso({ dados: dados() }));
      expect(selos()).toEqual([]);
      await act(async () => estado.definirComemoracoes(true));
      expect(selos().sort()).toEqual([
        ["Fora do prazo", false],
        ["No prazo", true],
      ]);
      await act(async () => estado.definirComemoracoes(false));
      expect(selos()).toEqual([]);
    });
  });

  describe("permissão", () => {
    it("quem só lê não vê “Novo recurso” e não marca etapa", async () => {
      await montar(
        supabaseFalso({ dados: payload({ pode_editar: false, editais: [] }) }),
      );
      expect(botao("Novo recurso")).toBeUndefined();
      expect(naTela("Somente consulta")).toBe(false);
      await clicar(document.querySelector(".recursos-linha"));
      await esperar();
      const gaveta = document.getElementById("recursosGaveta");
      expect(gaveta).not.toBeNull();
      expect(gaveta.querySelector(".ui-gaveta")).not.toBeNull();
      expect(
        [...gaveta.querySelectorAll("input[type=checkbox]")].every(
          (c) => c.disabled,
        ),
      ).toBe(true);
      expect(botao("Editar")).toBeUndefined();
    });
  });

  describe("cadastro", () => {
    async function abrirNovo(supabase) {
      await montar(supabase, { modo: "analise" });
      await clicar(botao("Novo recurso"));
      return document.querySelector(".recursos-formulario-cartao");
    }

    it("escolher o candidato preenche cargo, vaga, nota e analista; salvar manda o p_dados", async () => {
      const supabase = supabaseFalso();
      const form = await abrirNovo(supabase);
      expect(form.classList.contains("ui-gaveta")).toBe(true);
      await escolher(form.querySelector("select[name=edital_id]"), "e1");
      await escolher(form.querySelector("select[name=origem]"), "entrevista");
      await digitar(form.querySelector("input[name=busca_candidato]"), "bru");
      await esperarBusca();
      expect(supabase.rpc).toHaveBeenCalledWith("buscar_candidatos_recurso", {
        p_edital_id: "e1",
        p_busca: "bru",
      });
      await clicar(botao("Bruno Lima"));
      const resumo = form.querySelector(".recursos-resumo").textContent;
      expect(resumo).toContain("Médico 20h");
      expect(resumo).toContain("V-11");
      expect(resumo).toContain("72,5");
      expect(form.querySelector("input[name=analista]").value).toBe("Diego");
      await clicar(botao("Cadastrar recurso"));
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith("salvar_recurso_candidato", {
        p_dados: expect.objectContaining({
          edital_id: "e1",
          origem: "entrevista",
          analise_id: "a2",
          fora_analise: false,
          analista: "Diego",
          permitir_duplicado: false,
        }),
      });
      expect(document.querySelector(".recursos-formulario-cartao")).toBeNull();
      expect(toast).toHaveBeenCalledWith("Recurso nº 8 cadastrado.", "ok");
    });

    it("cada campo tem o rótulo ligado ao controle (.ui-campo)", async () => {
      const form = await abrirNovo(supabaseFalso());
      const edital = form.querySelector("select[name=edital_id]");
      expect(edital.closest(".ui-campo")).not.toBeNull();
      expect(form.querySelector(`label[for="${edital.id}"]`).textContent).toBe(
        "Edital *",
      );
    });

    it("Esc fecha o formulário e o foco volta para “Novo recurso”", async () => {
      await montar(supabaseFalso(), { modo: "analise" });
      botao("Novo recurso").focus();
      await clicar(botao("Novo recurso"));
      expect(document.activeElement.name).toBe("edital_id");
      await teclar(document, "Escape");
      expect(document.querySelector(".recursos-formulario-cartao")).toBeNull();
      expect(document.activeElement).toBe(botao("Novo recurso"));
    });

    it("outro recurso sem decisão do mesmo candidato, edital e origem: avisa e só grava confirmando", async () => {
      const supabase = supabaseFalso();
      const form = await abrirNovo(supabase);
      await escolher(form.querySelector("select[name=edital_id]"), "e1");
      await escolher(
        form.querySelector("select[name=origem]"),
        "analise-curricular",
      );
      await digitar(form.querySelector("input[name=busca_candidato]"), "ana");
      await esperarBusca();
      await clicar(botao("Ana Ribeiro"));
      expect(naTela("Já existe o recurso nº 7 sem decisão")).toBe(true);
      expect(botao("Cadastrar recurso").disabled).toBe(true);
      await clicar(form.querySelector("input[name=confirma_duplicado]"));
      await clicar(botao("Cadastrar recurso"));
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith("salvar_recurso_candidato", {
        p_dados: expect.objectContaining({
          analise_id: "a1",
          permitir_duplicado: true,
        }),
      });
    });

    it("o banco acusa duplicado (23505): o aviso aparece e nada fecha", async () => {
      const supabase = supabaseFalso({
        respostas: {
          salvar_recurso_candidato: () => ({
            data: null,
            error: { code: "23505", hint: "duplicado:9", message: "dup" },
          }),
        },
      });
      const form = await abrirNovo(supabase);
      await escolher(form.querySelector("select[name=edital_id]"), "e1");
      await escolher(
        form.querySelector("select[name=origem]"),
        "resultado-final",
      );
      await digitar(form.querySelector("input[name=busca_candidato]"), "bru");
      await esperarBusca();
      await clicar(botao("Bruno Lima"));
      await clicar(botao("Cadastrar recurso"));
      await esperar();
      expect(naTela("Já existe o recurso nº 9 sem decisão")).toBe(true);
      expect(
        document.querySelector(".recursos-formulario-cartao"),
      ).not.toBeNull();
    });

    it("“Não encontrei o candidato” é a exceção: nome digitado, fora das análises", async () => {
      const supabase = supabaseFalso();
      const form = await abrirNovo(supabase);
      await escolher(form.querySelector("select[name=edital_id]"), "e1");
      await escolher(form.querySelector("select[name=origem]"), "entrevista");
      await clicar(botao("Não encontrei o candidato"));
      expect(naTela("Fora das análises (dados digitados).")).toBe(true);
      await digitar(
        form.querySelector("input[name=nome_informado]"),
        "Maria Souza",
      );
      await clicar(botao("Cadastrar recurso"));
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith("salvar_recurso_candidato", {
        p_dados: expect.objectContaining({
          fora_analise: true,
          analise_id: null,
          nome_informado: "Maria Souza",
        }),
      });
    });

    it("sem candidato escolhido, não salva e diz o que falta", async () => {
      const supabase = supabaseFalso();
      const form = await abrirNovo(supabase);
      await escolher(form.querySelector("select[name=edital_id]"), "e1");
      await clicar(botao("Cadastrar recurso"));
      expect(naTela("Escolha a origem do recurso.")).toBe(true);
      expect(naTela("Escolha o candidato na lista das análises.")).toBe(true);
      expect(supabase.rpc).not.toHaveBeenCalledWith(
        "salvar_recurso_candidato",
        expect.anything(),
      );
    });
  });

  describe("gaveta", () => {
    it("abre pela linha (clique ou Enter); quem edita marca a etapa, que entra na hora", async () => {
      const supabase = supabaseFalso();
      await montar(supabase, { modo: "analise" });
      const linha = document.querySelector(".recursos-linha");
      linha.focus();
      await teclar(linha, "Enter");
      await esperar();
      const gaveta = document.getElementById("recursosGaveta");
      expect(gaveta.classList.contains("ui-gaveta-fundo")).toBe(true);
      expect(gaveta.querySelector(".ui-gaveta-topo h2").textContent).toBe(
        "Ana Ribeiro",
      );
      expect(
        [...gaveta.querySelectorAll(".ui-secao-topo")].map((h) =>
          h.textContent.trim(),
        ),
      ).toEqual(
        expect.arrayContaining(["Etapas", "Histórico", "Prazo de resposta"]),
      );
      const caixa = gaveta.querySelector("input[name=download_empregare]");
      expect(caixa.checked).toBe(false);
      await clicar(caixa);
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith("marcar_etapa_recurso", {
        p_id: "r1",
        p_etapa: "download_empregare",
        p_feita: true,
      });
      expect(
        document.querySelector("#recursosGaveta input[name=download_empregare]")
          .checked,
      ).toBe(true);
      await teclar(document, "Escape");
      expect(document.getElementById("recursosGaveta")).toBeNull();
    });

    it("editar sem o detalhe não salva (apagaria a observação); a edição relê o detalhe em erro e a releitura da aba não desfaz o digitado", async () => {
      let falhar = true;
      const supabase = supabaseFalso({
        respostas: {
          get_recurso_candidato_detalhe: ({ p_id }) =>
            falhar
              ? { data: null, error: { message: "tempo esgotado" } }
              : {
                  data: {
                    id: p_id,
                    observacao: "Gravada antes",
                    etapas: {},
                    historico: [],
                  },
                  error: null,
                },
        },
      });
      const leituras = () =>
        supabase.rpc.mock.calls.filter(
          ([nome]) => nome === "get_recurso_candidato_detalhe",
        ).length;
      await montar(supabase, { modo: "analise" });
      await clicar(document.querySelector(".recursos-linha"));
      await esperar();
      expect(leituras()).toBe(1);
      await clicar(botao("Editar"));
      await esperar();
      // O detalhe estava em erro: a edição pede de novo.
      expect(leituras()).toBe(2);
      const formulario = () => document.getElementById("recursosFormulario");
      const salvar = () => botao("Salvar alterações");
      expect(formulario().textContent).toContain("tempo esgotado");
      expect(salvar().disabled).toBe(true);
      await clicar(salvar());
      expect(
        supabase.rpc.mock.calls.some(([n]) => n === "salvar_recurso_candidato"),
      ).toBe(false);

      falhar = false;
      await clicar(botao("Tentar novamente"));
      await esperar();
      const observacao = () =>
        formulario().querySelector('textarea[name="observacao"]');
      expect(observacao().value).toBe("Gravada antes");
      expect(salvar().disabled).toBe(false);

      // A pessoa apaga a observação; a releitura da aba não a devolve.
      await digitar(observacao(), "");
      await abrirATela();
      await esperar();
      expect(observacao().value).toBe("");
      await clicar(salvar());
      await esperar();
      const [, salvo] = supabase.rpc.mock.calls.find(
        ([n]) => n === "salvar_recurso_candidato",
      );
      expect(salvo.p_dados).toMatchObject({ id: "r1", observacao: "" });
    });
  });

  describe("edição sem passar por cima de outra pessoa", () => {
    it("o formulário salva com a revisão de quando abriu, mesmo depois de uma releitura", async () => {
      let dados = payload();
      const supabase = supabaseFalso();
      supabase.rpc.mockImplementation(async (nome, argumentos) => {
        if (nome === "get_recursos_da_area")
          return { data: dados, error: null };
        if (nome === "get_recurso_candidato_detalhe")
          return {
            data: {
              id: argumentos.p_id,
              observacao: "",
              etapas: {},
              historico: [],
            },
            error: null,
          };
        return { data: { id: "r1", nu: 7, revisao: 3 }, error: null };
      });
      await montar(supabase, { modo: "analise" });
      await clicar(document.querySelector(".recursos-linha"));
      await esperar();
      await clicar(botao("Editar"));
      await esperar();
      // Outra pessoa salvou: a releitura traz a revisão 2.
      dados = payload({ recursos: [{ ...RECURSO_EXISTENTE, revisao: 2 }] });
      await abrirATela();
      await esperar();
      await clicar(botao("Salvar alterações"));
      await esperar();
      const [, salvo] = supabase.rpc.mock.calls.find(
        ([n]) => n === "salvar_recurso_candidato",
      );
      expect(salvo.p_dados).toMatchObject({ id: "r1", revisao: 1 });
    });
  });

  /*
  Painel de recursos (acompanhar) × Analisar recursos (fazer): o painel não tem
  nenhuma ação operacional; quem analisa tem os atalhos para a outra tela, que
  levam os filtros e o recurso aberto.
*/
  describe("painel e análise separados", () => {
    afterEach(() => {
      delete window.navigate;
    });

    it("o painel é só leitura: sem Novo recurso, sem Modelos e o detalhe sem ações", async () => {
      await montar(
        supabaseFalso({
          dados: payload({
            pode_decidir: true,
            pode_administrar_modelos: true,
          }),
        }),
      );
      expect(botao("Novo recurso")).toBeUndefined();
      expect(botao("Modelos de resposta")).toBeUndefined();
      await clicar(document.querySelector(".recursos-linha"));
      await esperar();
      const gaveta = document.getElementById("recursosGaveta");
      expect(gaveta).not.toBeNull();
      expect(botao("Editar")).toBeUndefined();
      expect(botao("Excluir")).toBeUndefined();
      expect(botao("Enviar para parecer jurídico")).toBeUndefined();
      expect(
        [...gaveta.querySelectorAll("input[type=checkbox]")].every(
          (c) => c.disabled,
        ),
      ).toBe(true);
      expect(
        gaveta.querySelector("[data-acao='analisar-este-recurso']"),
      ).not.toBeNull();
    });

    it("quem só lê não tem o atalho Analisar", async () => {
      await montar(supabaseFalso({ dados: payload({ pode_editar: false }) }));
      expect(botao("Analisar")).toBeUndefined();
      await clicar(document.querySelector(".recursos-linha"));
      await esperar();
      expect(
        document.querySelector("[data-acao='analisar-este-recurso']"),
      ).toBeNull();
    });

    it("a análise tem a fila e as ações, sem indicadores nem gráficos", async () => {
      await montar(supabaseFalso(), { modo: "analise" });
      const topo = secao.querySelector("header.ui-topo");
      expect(
        [...topo.querySelectorAll("button")].map((b) => b.textContent.trim()),
      ).toEqual(["Atualizar", "Ver no painel", "Novo recurso"]);
      expect(secao.querySelector(".recursos-kpis")).toBeNull();
      expect(secao.querySelector("canvas")).toBeNull();
      expect(secao.querySelector("#analiseRecursosFilaTitulo")).not.toBeNull();
      expect(secao.querySelector("#recursosFilaTitulo")).toBeNull();
      expect(secao.querySelector("#analise-filtro-edital")).not.toBeNull();
    });

    it("“Analisar este recurso” leva à análise com os filtros e o recurso", async () => {
      const navegar = vi.fn();
      window.navigate = navegar;
      const pedidos = await import("../src/app/pedido-de-filtro.ts");
      await montar(supabaseFalso());
      await escolher(
        secao.querySelector("#filtro-origem"),
        "analise-curricular",
      );
      await clicar(document.querySelector(".recursos-linha"));
      await esperar();
      await clicar(
        document.querySelector("[data-acao='analisar-este-recurso']"),
      );
      expect(navegar).toHaveBeenCalledWith("analisar-recursos");
      expect(document.getElementById("recursosGaveta")).toBeNull();
      const pedido = pedidos.consumirPedidoDeFiltro("analisar-recursos");
      expect(pedido.recurso).toBe("r1");
      expect(pedido.filtros.origem).toBe("analise-curricular");
    });

    it("a análise aplica o pedido: os filtros e a gaveta do recurso", async () => {
      const pedidos = await import("../src/app/pedido-de-filtro.ts");
      pedidos.pedirFiltro("analisar-recursos", {
        filtros: { edital: "e1", inventado: "x" },
        recurso: "r1",
      });
      await montar(supabaseFalso(), { modo: "analise" });
      await esperar();
      expect(document.getElementById("recursosGaveta")).not.toBeNull();
      expect(secao.querySelector("#analise-filtro-edital").value).toBe("e1");
      expect(botao("Editar")).toBeTruthy();
    });

    it("“Ver no painel” volta com os mesmos filtros", async () => {
      const navegar = vi.fn();
      window.navigate = navegar;
      const pedidos = await import("../src/app/pedido-de-filtro.ts");
      await montar(supabaseFalso(), { modo: "analise" });
      await escolher(
        secao.querySelector("#analise-filtro-origem"),
        "entrevista",
      );
      await clicar(botao("Ver no painel"));
      expect(navegar).toHaveBeenCalledWith("recursos");
      expect(pedidos.consumirPedidoDeFiltro("recursos").filtros.origem).toBe(
        "entrevista",
      );
    });
  });
});

bloco("modulos/recursos-ajuste", async () => {
  /*
  "Ajuste da pontuação" na gaveta do recurso (migration 20261005130000):
  quem decide propõe os novos valores dos componentes da regra do edital, vê
  a prévia (nova nota e nova posição, pelo motor da Classificação) e quem
  aprova a resposta aprova — recalculando a prévia. Quem não decide não vê a
  seção enquanto não houver ajuste.
*/

  const { criarRecursos } =
    await import("../src/modulos/recursos/recursos.tsx");

  const REGRA = {
    etapas: { documental: true, entrevista: false },
    documental: {
      situacoes_aptas: ["Aprovado"],
      parciais: ["FORMACAO", "EXPERIENCIA"],
    },
    composicao: { componentes: [{ codigo: "DOCUMENTAL", peso: 1 }], casas: 2 },
  };

  const analise = (id, nome, nota, formacao, experiencia) => ({
    analise_id: id,
    codigo: id,
    nome,
    vaga: "V1",
    cargo: "Enfermeiro",
    modalidade: "Ampla concorrência",
    status: "Aprovado",
    nota_documental: nota,
    pontuacao_formacao: formacao,
    pontuacao_experiencia: experiencia,
  });

  const DADOS_DA_PREVIA = {
    edital: { id: "e1", unidade: "DSEI" },
    regra: { versao: 1, configuracao: REGRA },
    candidatos: [
      analise("a0", "Bia Lima", 20, 8, 12),
      analise("a2", "Caio Melo", 18, 8, 10),
      analise("a1", "Ana Ribeiro", 15, 5, 10),
    ],
    entrevistas: [],
    quadro: [],
    cronograma: [],
    desempates: [],
    ajustes: [],
  };

  const recurso = (extra = {}) => ({
    id: "r1",
    nu: 7,
    edital_id: "e1",
    edital: "105/2026",
    unidade: "DSEI Litoral Sul",
    origem: "analise-curricular",
    analise_id: "a1",
    fora_analise: false,
    candidato: "Ana Ribeiro",
    codigo: "111",
    analista: "Carla",
    situacao: "DEFERIDO",
    decisao_em: "2026-10-04T12:00:00Z",
    criado_em: "2026-09-20T12:00:00Z",
    atualizado_em: "2026-10-04T12:00:00Z",
    revisao: 5,
    ...extra,
  });

  /* Um banco falso com estado: as versões do ajuste mudam a cada escrita. */
  function supabaseFalso({
    podeDecidir = true,
    situacao = "DEFERIDO",
    dadosDaPrevia = DADOS_DA_PREVIA,
  } = {}) {
    const banco = { versoes: [], mudou: false };
    const resposta = () => ({
      recurso_id: "r1",
      situacao,
      pode_propor: podeDecidir,
      pode_aprovar: podeDecidir && situacao === "DEFERIDO",
      pode_cancelar: podeDecidir,
      ajustes: [...banco.versoes].reverse(),
    });
    const rpc = vi.fn(async (nome, args) => {
      if (nome === "get_recursos_da_area")
        return {
          data: {
            schema_version: 1,
            area: "saude-indigena",
            pode_editar: true,
            pode_decidir: podeDecidir,
            origens: [],
            editais: [],
            modelos: [],
            recursos: [recurso({ situacao, mudou_classificacao: banco.mudou })],
            cronogramas: [],
          },
          error: null,
        };
      if (nome === "get_recurso_candidato_detalhe")
        return {
          data: { id: "r1", etapas: {}, historico: [], anexos: [] },
          error: null,
        };
      if (nome === "obter_ajustes_pontuacao_recurso")
        return { data: resposta(), error: null };
      if (nome === "obter_dados_previa_ajuste")
        return podeDecidir
          ? { data: dadosDaPrevia, error: null }
          : { data: null, error: { code: "42501", message: "Sem parecer" } };
      if (nome === "propor_ajuste_pontuacao") {
        for (const v of banco.versoes)
          if (v.situacao === "PROPOSTO") v.situacao = "CANCELADO";
        banco.versoes.push({
          id: `aj${banco.versoes.length + 1}`,
          recurso_id: "r1",
          numero: 7,
          analise_id: "a1",
          versao: banco.versoes.length + 1,
          situacao: "PROPOSTO",
          lista: args.p_dados.lista,
          justificativa: args.p_dados.justificativa,
          itens: args.p_dados.itens,
          previa: args.p_dados.previa,
          proposto_em: "2026-10-05T12:00:00Z",
          proposto_por: "Dra. Lia",
        });
        return { data: resposta(), error: null };
      }
      if (nome === "aprovar_ajuste_pontuacao") {
        const v = banco.versoes.find((x) => x.id === args.p_ajuste);
        Object.assign(v, {
          situacao: "APROVADO",
          aprovado_em: "2026-10-05T13:00:00Z",
          aprovado_por: "Dra. Lia",
          previa_aprovacao: args.p_previa,
          mudou_posicao: args.p_previa.mudou,
        });
        banco.mudou = args.p_previa.mudou;
        return { data: resposta(), error: null };
      }
      if (nome === "cancelar_ajuste_pontuacao") {
        const v = banco.versoes.find((x) => x.id === args.p_ajuste);
        Object.assign(v, {
          situacao: "CANCELADO",
          cancelado_em: "2026-10-05T14:00:00Z",
          motivo_cancelamento: args.p_motivo,
        });
        banco.mudou = false;
        return { data: resposta(), error: null };
      }
      return { data: null, error: null };
    });
    return { rpc, banco };
  }

  let secao;
  let painel;

  async function montar(supabase, modo = "analise") {
    secao = document.createElement("section");
    secao.id = "page-recursos";
    secao.className = "page active";
    document.body.append(secao);
    await act(async () => {
      painel = montarTela(criarRecursos, "page-recursos", {
        modo,
        secao,
        supabase,
        toast: vi.fn(),
      });
    });
    await act(async () => void painel.render());
    await esperar();
    await clicar(document.querySelector(".recursos-linha"));
    await esperar();
    await esperar();
  }

  const secaoDoAjuste = () =>
    document.querySelector('.ui-secao[data-section="ajuste"]');
  const botao = (acao) =>
    secaoDoAjuste()?.querySelector(`[data-acao-ajuste="${acao}"]`);
  const chamadas = (supabase, nome) =>
    supabase.rpc.mock.calls.filter(([n]) => n === nome);

  beforeEach(() => {
    redefinirDadosDoMonitoramento();
    definirAreaAtual("saude-indigena");
  });

  afterEach(async () => {
    await act(async () => painel?.raiz?.unmount());
    secao?.remove();
    document.body.innerHTML = "";
    redefinirDadosDoMonitoramento();
  });

  describe("seção de ajuste da pontuação", () => {
    it("recusa dados de prévia malformados antes de abrir o formulário ou propor", async () => {
      const supabase = supabaseFalso({
        dadosDaPrevia: { ...DADOS_DA_PREVIA, candidatos: {} },
      });
      await montar(supabase);
      await clicar(botao("propor"));
      await esperar();
      expect(secaoDoAjuste().textContent).toContain(
        "Os dados da classificação recebidos são inválidos",
      );
      expect(
        secaoDoAjuste().querySelector(".recursos-ajuste-formulario"),
      ).toBeNull();
      expect(chamadas(supabase, "propor_ajuste_pontuacao")).toHaveLength(0);
    });
    it("o painel mostra versões em somente leitura mesmo quando o banco permite decidir", async () => {
      const supabase = supabaseFalso();
      supabase.banco.versoes.push({
        id: "aj1",
        versao: 1,
        situacao: "APROVADO",
        lista: "PRELIMINAR",
        itens: [{ codigo: "FORMACAO", anterior: 5, novo: 7 }],
      });
      await montar(supabase, "painel");
      expect(secaoDoAjuste().textContent).toContain("Versão 1");
      expect(secaoDoAjuste().querySelector("[data-acao-ajuste]")).toBeNull();
      expect(chamadas(supabase, "obter_dados_previa_ajuste")).toHaveLength(0);
    });

    it("quem não decide não vê a seção sem ajuste", async () => {
      const supabase = supabaseFalso({ podeDecidir: false });
      await montar(supabase);
      expect(
        chamadas(supabase, "obter_ajustes_pontuacao_recurso"),
      ).toHaveLength(1);
      expect(secaoDoAjuste()).toBeNull();
    });

    it("o formulário mostra os componentes da regra, o atual, o total somado e a prévia da posição", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      await clicar(botao("propor"));
      await esperar();
      expect(chamadas(supabase, "obter_dados_previa_ajuste")).toHaveLength(1);
      const linhas = [
        ...secaoDoAjuste().querySelectorAll(
          ".recursos-ajuste-formulario [data-item]",
        ),
      ].map((l) => l.dataset.item);
      expect(linhas).toEqual(["FORMACAO", "EXPERIENCIA", "DOCUMENTAL"]);
      // Nada mudou: sem prévia e com o aviso.
      expect(botao("propor").disabled).toBe(true);
      expect(secaoDoAjuste().textContent).toContain(
        "Altere ao menos um valor.",
      );

      await digitar(
        secaoDoAjuste().querySelector('[name="novo-FORMACAO"]'),
        "11",
      );
      const total = secaoDoAjuste().querySelector(
        '[data-item="DOCUMENTAL"] [data-calculado]',
      );
      expect(total.textContent).toBe("21,00");
      const previa = secaoDoAjuste().querySelector("[data-previa]");
      expect(previa.dataset.previa).toBe("PRELIMINAR");
      expect(previa.textContent).toContain("posição 3º → 1º");
      expect(previa.textContent).toContain(
        "Mudam de posição: Bia Lima 1º → 2º; Caio Melo 2º → 3º",
      );
      // Falta a justificativa.
      expect(botao("propor").disabled).toBe(true);
      await digitar(
        secaoDoAjuste().querySelector('[name="justificativa"]'),
        "Diploma de especialização aceito no recurso.",
      );
      expect(botao("propor").disabled).toBe(false);
    });

    it("fluxo proposto → aprovado: a proposta leva itens e prévia; a aprovação recalcula a prévia e marca a classificação", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      await clicar(botao("propor"));
      await esperar();
      await digitar(
        secaoDoAjuste().querySelector('[name="novo-FORMACAO"]'),
        "11",
      );
      await digitar(
        secaoDoAjuste().querySelector('[name="justificativa"]'),
        "Diploma de especialização aceito no recurso.",
      );
      await clicar(botao("propor"));
      await esperar();

      const [[, propor]] = chamadas(supabase, "propor_ajuste_pontuacao");
      expect(propor.p_recurso).toBe("r1");
      expect(propor.p_dados).toMatchObject({
        lista: "PRELIMINAR",
        justificativa: "Diploma de especialização aceito no recurso.",
        itens: [
          { codigo: "FORMACAO", anterior: 5, novo: 11 },
          expect.objectContaining({
            codigo: "DOCUMENTAL",
            anterior: 15,
            novo: 21,
          }),
        ],
        previa: expect.objectContaining({
          mudou: true,
          antes: expect.objectContaining({ posicao: 3 }),
          depois: expect.objectContaining({ posicao: 1 }),
        }),
      });
      const cartao = secaoDoAjuste().querySelector('[data-ajuste="PROPOSTO"]');
      expect(cartao).not.toBeNull();
      expect(cartao.textContent).toContain("Versão 1");
      // Proposto não vale: a aprovação é explícita.
      expect(chamadas(supabase, "aprovar_ajuste_pontuacao")).toHaveLength(0);

      await clicar(botao("aprovar"));
      await esperar();
      // A prévia é recalculada com os dados de agora (releitura forçada).
      expect(chamadas(supabase, "obter_dados_previa_ajuste")).toHaveLength(2);
      expect(
        secaoDoAjuste().querySelector("[data-aprovar-ajuste] [data-previa]")
          .textContent,
      ).toContain("posição 3º → 1º");
      await clicar(botao("confirmar-aprovacao"));
      await esperar();
      await esperar();

      const [[, aprovar]] = chamadas(supabase, "aprovar_ajuste_pontuacao");
      expect(aprovar).toMatchObject({
        p_ajuste: "aj1",
        p_previa: expect.objectContaining({ mudou: true, tipo: "PRELIMINAR" }),
      });
      const aprovado = secaoDoAjuste().querySelector(
        '[data-ajuste="APROVADO"]',
      );
      expect(aprovado).not.toBeNull();
      expect(
        aprovado.querySelector("[data-mudou-posicao]").textContent,
      ).toContain("Mudou a classificação");
      // A marca automática chega à gaveta pela releitura da aba.
      expect(document.querySelector("#recursosGaveta").textContent).toContain(
        "Classificação mudou",
      );
    });

    it("a releitura da aba com o formulário aberto não o troca por “Carregando…” nem perde o digitado", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      await clicar(botao("propor"));
      await esperar();
      await digitar(
        secaoDoAjuste().querySelector('[name="novo-FORMACAO"]'),
        "11",
      );
      await act(async () => void painel.render());
      expect(secaoDoAjuste().textContent).not.toContain(
        "Carregando os dados da classificação",
      );
      await esperar();
      await esperar();
      // Os dados da prévia do recurso aberto são relidos por trás.
      expect(chamadas(supabase, "obter_dados_previa_ajuste")).toHaveLength(2);
      expect(
        secaoDoAjuste().querySelector('[name="novo-FORMACAO"]').value,
      ).toBe("11");
      expect(
        secaoDoAjuste().querySelector("[data-previa]").textContent,
      ).toContain("posição 3º → 1º");
    });

    it("cancelar o ajuste aprovado pede motivo e o tira", async () => {
      const supabase = supabaseFalso();
      supabase.banco.versoes.push({
        id: "aj1",
        recurso_id: "r1",
        numero: 7,
        analise_id: "a1",
        versao: 1,
        situacao: "APROVADO",
        lista: "PRELIMINAR",
        justificativa: "Diploma aceito.",
        itens: [{ codigo: "DOCUMENTAL", anterior: 15, novo: 21 }],
        proposto_em: "2026-10-05T12:00:00Z",
        aprovado_em: "2026-10-05T13:00:00Z",
        mudou_posicao: true,
      });
      supabase.banco.mudou = true;
      await montar(supabase);
      await clicar(botao("cancelar"));
      expect(botao("confirmar-cancelamento").disabled).toBe(true);
      await digitar(
        secaoDoAjuste().querySelector('[name="motivo"]'),
        "Erro material",
      );
      await clicar(botao("confirmar-cancelamento"));
      await esperar();
      await esperar();
      expect(chamadas(supabase, "cancelar_ajuste_pontuacao")[0][1]).toEqual({
        p_ajuste: "aj1",
        p_motivo: "Erro material",
      });
      expect(
        secaoDoAjuste().querySelector('[data-ajuste="APROVADO"]'),
      ).toBeNull();
      expect(secaoDoAjuste().textContent).toContain("Versões anteriores (1)");
    });

    it("em análise jurídica propõe, mas só aprova depois de deferir", async () => {
      const supabase = supabaseFalso({ situacao: "EM_ANALISE_JURIDICA" });
      supabase.banco.versoes.push({
        id: "aj1",
        versao: 1,
        situacao: "PROPOSTO",
        lista: "PRELIMINAR",
        itens: [{ codigo: "DOCUMENTAL", anterior: 15, novo: 21 }],
        proposto_em: "2026-10-05T12:00:00Z",
      });
      await montar(supabase);
      const aprovar = botao("aprovar");
      expect(aprovar.disabled).toBe(true);
      expect(aprovar.title).toBe(
        "Defira o recurso (total ou parcialmente) antes de aprovar o ajuste",
      );
      expect(botao("propor").textContent).toBe("Propor nova versão");
    });
  });
});

bloco("modulos/recursos-parecer", async () => {
  /*
  A tela de Recursos com o parecer jurídico: os 4 KPIs, quem vê os botões de
  decisão (só quem tem recursos_parecer, que o banco devolve em
  pode_decidir), o aviso "Aguardando parecer jurídico" para os demais e a
  chamada de transicionar_recurso_candidato com o parecer.
*/

  const { criarRecursos } =
    await import("../src/modulos/recursos/recursos.tsx");

  const recurso = (extra = {}) => ({
    id: "r1",
    nu: 7,
    edital_id: "e1",
    edital: "105/2026",
    unidade: "DSEI Litoral Sul",
    origem: "analise-curricular",
    analise_id: "a1",
    fora_analise: false,
    candidato: "Ana Ribeiro",
    codigo: "111",
    analista: "Carla",
    situacao: "EM_ANALISE_JURIDICA",
    parecer_enviado_em: "2026-09-21T12:00:00Z",
    criado_em: "2026-09-20T12:00:00Z",
    atualizado_em: "2026-09-21T12:00:00Z",
    revisao: 3,
    ...extra,
  });

  function supabaseFalso({
    podeDecidir,
    recursos = [recurso()],
    detalheExtra = {},
  }) {
    const rpc = vi.fn(async (nome) => {
      if (nome === "get_recursos_da_area")
        return {
          data: {
            schema_version: 1,
            area: "saude-indigena",
            pode_editar: true,
            pode_decidir: podeDecidir,
            origens: [],
            editais: [],
            modelos: [],
            recursos,
            cronogramas: [],
          },
          error: null,
        };
      if (nome === "get_recurso_candidato_detalhe")
        return {
          data: {
            id: "r1",
            observacao: "",
            etapas: {},
            historico: [],
            anexos: [],
            parecer_enviado_por: "Carla",
            parecer: recursos[0].situacao === "DEFERIDO" ? "Defiro." : null,
            decisao_por: "Dra. Lia",
            ...detalheExtra,
          },
          error: null,
        };
      if (nome === "transicionar_recurso_candidato")
        return { data: { situacao: "DEFERIDO", revisao: 4 }, error: null };
      return { data: null, error: null };
    });
    return { rpc };
  }

  let secao;
  let painel;

  /* `modo`: "analise" (Analisar recursos, a operação) ou "painel" (os KPIs). */
  async function montar(supabase, modo = "analise") {
    secao = document.createElement("section");
    secao.id = "page-recursos";
    secao.className = "page active";
    document.body.append(secao);
    await act(async () => {
      painel = montarTela(criarRecursos, "page-recursos", {
        modo,
        secao,
        supabase,
        toast: vi.fn(),
      });
    });
    await act(async () => void painel.render());
    await esperar();
  }

  async function abrirGaveta() {
    await clicar(document.querySelector(".recursos-linha"));
    await esperar();
    await esperar();
  }

  const parecer = () =>
    document.querySelector('.ui-secao[data-section="parecer"]');
  const botoesDeDecisao = () =>
    [...(parecer()?.querySelectorAll("[data-acao-parecer]") || [])].map(
      (b) => b.dataset.acaoParecer,
    );
  const kpis = () =>
    [...document.querySelectorAll(".recursos-kpis [data-kpi]")].map(
      (k) => k.dataset.kpi,
    );

  it("abre o detalhe mesmo com histórico e metadados de anexos malformados", async () => {
    await montar(
      supabaseFalso({
        podeDecidir: false,
        detalheExtra: {
          historico: [
            null,
            {
              acao: "edicao",
              campo: "analista",
              anterior: {},
              novo: "Carla",
              autor: {},
            },
          ],
          anexos: [
            null,
            {
              id: "a1",
              nome: "documento.pdf",
              mime: {},
              bytes: {},
              ativo: true,
            },
          ],
          etapas: { processo_sei: {} },
          modalidade: {},
        },
      }),
    );
    await abrirGaveta();
    expect(document.querySelector(".recursos-historico").textContent).toContain(
      "Analista: vazio → Carla",
    );
    expect(
      document.querySelector(".recursos-lista-de-anexos").textContent,
    ).toContain("documento.pdf");
    expect(parecer().textContent).toContain("Aguardando parecer jurídico");
  });

  beforeEach(() => {
    redefinirDadosDoMonitoramento();
    definirAreaAtual("saude-indigena");
  });

  afterEach(async () => {
    await act(async () => painel?.raiz?.unmount());
    secao?.remove();
    document.body.innerHTML = "";
    redefinirDadosDoMonitoramento();
  });

  describe("KPIs", () => {
    it("quatro, em card compacto: aguardando parecer, prazo vencido, deferidos e indeferidos", async () => {
      await montar(
        supabaseFalso({
          podeDecidir: false,
          recursos: [
            recurso(),
            recurso({
              id: "r2",
              nu: 8,
              situacao: "PARCIALMENTE_INDEFERIDO",
              decisao_em: "2026-09-25T12:00:00Z",
            }),
            recurso({
              id: "r3",
              nu: 9,
              situacao: "DEFERIDO",
              decisao_em: "2026-09-25T12:00:00Z",
            }),
          ],
        }),
        "painel",
      );
      expect(kpis()).toEqual([
        "aguardando-parecer",
        "prazo-vencido",
        "deferidos",
        "indeferidos",
      ]);
      const valor = (chave) =>
        document.querySelector(`[data-kpi="${chave}"] .ui-kpi-valor`)
          .textContent;
      expect(valor("aguardando-parecer")).toBe("1");
      expect(valor("deferidos")).toBe("2");
      expect(valor("indeferidos")).toBe("0");
      for (const card of document.querySelectorAll(".recursos-kpis .ui-kpi"))
        expect(card.querySelector("button.ui-kpi-alvo")).not.toBeNull();
      // Deferidos filtra os dois (com o parcialmente).
      await clicar(document.querySelector('[data-kpi="deferidos"] button'));
      expect(document.querySelector(".recursos-contagem").textContent).toBe(
        "2 de 3",
      );
    });
  });

  describe("quem vê os botões de decisão", () => {
    it("sem o parecer jurídico: nenhum botão de decisão, só 'Aguardando parecer jurídico'", async () => {
      await montar(supabaseFalso({ podeDecidir: false }));
      await abrirGaveta();
      expect(parecer()).not.toBeNull();
      expect(botoesDeDecisao()).toEqual([]);
      expect(parecer().textContent).toContain("Aguardando parecer jurídico");
    });

    it("quem edita envia o registrado para parecer", async () => {
      const supabase = supabaseFalso({
        podeDecidir: false,
        recursos: [
          recurso({ situacao: "REGISTRADO", parecer_enviado_em: null }),
        ],
      });
      await montar(supabase);
      await abrirGaveta();
      expect(botoesDeDecisao()).toEqual(["enviar_parecer"]);
    });

    it("com o parecer jurídico: decide com o texto do parecer", async () => {
      const supabase = supabaseFalso({ podeDecidir: true });
      await montar(supabase);
      await abrirGaveta();
      expect(botoesDeDecisao()).toEqual([
        "deferir",
        "deferir_parcialmente",
        "indeferir",
        "devolver",
      ]);
      expect(parecer().textContent).not.toContain(
        "Aguardando parecer jurídico",
      );

      await clicar(parecer().querySelector('[data-acao-parecer="deferir"]'));
      const form = parecer().querySelector('form[data-parecer="deferir"]');
      const confirmar = form.querySelector('button[type="submit"]');
      expect(confirmar.disabled).toBe(true);
      await digitar(
        form.querySelector("textarea"),
        "Defiro: a documentação comprova a experiência.",
      );
      expect(confirmar.disabled).toBe(false);
      await clicar(confirmar);
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith(
        "transicionar_recurso_candidato",
        {
          p_id: "r1",
          p_acao: "deferir",
          p_revisao: 3,
          p_texto: "Defiro: a documentação comprova a experiência.",
        },
      );
    });

    it("em análise jurídica: quem edita ainda não marca a resposta enviada", async () => {
      await montar(supabaseFalso({ podeDecidir: false }));
      await abrirGaveta();
      expect(
        document.querySelector('input[name="resposta_candidato"]').disabled,
      ).toBe(true);
    });

    it("decidido: o parecer aparece; quem não decide não reabre nem exclui, mas marca a resposta enviada", async () => {
      await montar(
        supabaseFalso({
          podeDecidir: false,
          recursos: [
            recurso({
              situacao: "DEFERIDO",
              decisao_em: "2026-09-25T12:00:00Z",
            }),
          ],
        }),
      );
      await abrirGaveta();
      expect(parecer().textContent).toContain("Defiro.");
      expect(botoesDeDecisao()).toEqual([]);
      const excluir = [...document.querySelectorAll("button")].find((b) =>
        b.textContent.trim().startsWith("Excluir"),
      );
      expect(excluir).toBeUndefined();
      const resposta = document.querySelector(
        'input[name="resposta_candidato"]',
      );
      expect(resposta.disabled).toBe(false);
    });
  });
});

bloco("modulos/recursos-resposta", async () => {
  /*
  A resposta ao candidato e os anexos, na gaveta do painel de recursos: modelo
  → prévia com os dados do recurso → rascunho → revisão (a autora não aprova;
  outra pessoa aprova) → documento (.docx, impressão, anexo) → enviada; os
  anexos (envio ao bucket + registro, download com URL assinada depois do
  registro); quem só lê não escreve; e os modelos de resposta da
  administração. O banco é um falso com estado, que segue as regras da
  migration no essencial.
*/

  const { criarRecursos } =
    await import("../src/modulos/recursos/recursos.tsx");
  const { criarEstadoDosRecursos } =
    await import("../src/modulos/recursos/estado.ts");

  const RECURSO_ID = "527c2b8c-7744-4a4b-bc06-108f6683297b";
  const AUTORA = "00000000-0000-4000-8000-0000000000a2";
  const REVISOR = "00000000-0000-4000-8000-0000000000a3";
  const MODELO = {
    id: "6f1d8a52-3b0e-4c11-9a51-000000000101",
    versao: 1,
    area: null,
    origem: "analise-curricular",
    situacao: "DEFERIDO",
    nome: "Deferido — Análise curricular",
    corpo:
      "RESPOSTA A RECURSO\n\nCandidato(a): {nome_candidato} ({codigo_candidato})\nEdital {edital}\n\nFundamentação:\n{fundamentacao}\n\nNota: {nota_anterior} → {nota_atual}.",
  };
  const OUTRO_MODELO = {
    ...MODELO,
    id: "6f1d8a52-3b0e-4c11-9a51-000000000201",
    origem: "entrevista",
    nome: "Deferido — Entrevista",
  };

  function criarServidor({
    podeEditar = true,
    podeDecidir = true,
    admin = false,
    resposta = null,
    anexos = [],
  } = {}) {
    const servidor = {
      eu: AUTORA,
      resposta,
      anexos,
      objetos: [],
      recurso: {
        id: RECURSO_ID,
        nu: 7,
        edital_id: "e1",
        edital: "105/2026",
        unidade: "DSEI Litoral Sul",
        origem: "analise-curricular",
        analise_id: "a1",
        fora_analise: false,
        candidato: "Ana Ribeiro",
        codigo: "111",
        cargo: "Enfermeiro 40h",
        vaga: "V-10",
        nota_anterior: 50,
        nota_atual: 55,
        resultado_anterior: "Reprovado",
        resultado_atual: "Aprovado",
        analista: "Carla",
        situacao: "DEFERIDO",
        processo_sei: null,
        mudou_classificacao: false,
        download_empregare_em: null,
        processo_sei_em: null,
        upload_sei_em: null,
        resposta_candidato_em: null,
        decisao_em: "2026-09-25T12:00:00Z",
        criado_em: "2026-09-20T12:00:00Z",
        atualizado_em: "2026-09-20T12:00:00Z",
        revisao: 1,
      },
    };
    const payload = () => ({
      schema_version: 1,
      area: "saude-indigena",
      pode_editar: podeEditar,
      pode_decidir: podeDecidir,
      pode_administrar_modelos: admin,
      origens: [
        { id: "analise-curricular", rotulo: "Análise curricular", ativo: true },
        { id: "entrevista", rotulo: "Entrevista", ativo: true },
      ],
      editais: [],
      modelos: podeEditar ? [MODELO, OUTRO_MODELO] : [],
      recursos: [
        {
          ...servidor.recurso,
          resposta_estado: servidor.resposta?.estado || null,
          qt_anexos: servidor.anexos.filter((a) => a.ativo).length,
        },
      ],
      cronogramas: [],
    });
    const rpc = vi.fn(async (nome, args = {}) => {
      const r = servidor.resposta;
      switch (nome) {
        case "get_recursos_da_area":
          return { data: payload(), error: null };
        case "get_recurso_candidato_detalhe":
          return {
            data: {
              id: RECURSO_ID,
              eu: servidor.eu,
              observacao: "",
              etapas: {},
              historico: [],
              anexos: servidor.anexos,
              resposta: r && { ...r, historico: [] },
            },
            error: null,
          };
        case "salvar_resposta_recurso": {
          const d = args.p_dados;
          if (r && d.revisao !== r.revisao)
            return { data: null, error: { code: "40001", message: "revisão" } };
          servidor.resposta = {
            ...(r || { id: "resp1", passou_revisao: false, revisao: 0 }),
            estado: "rascunho",
            modelo_id: d.modelo_id,
            modelo_versao: d.modelo_versao,
            modelo_nome: MODELO.nome,
            modelo_corpo: MODELO.corpo,
            modelo_situacao: MODELO.situacao,
            modelo_vigente: true,
            fundamentacao: d.fundamentacao,
            texto_final: d.texto_final,
            autor_id: servidor.eu,
            autor: servidor.eu === AUTORA ? "Autora" : "Revisor",
            revisao: (r?.revisao || 0) + 1,
          };
          return {
            data: {
              id: "resp1",
              revisao: servidor.resposta.revisao,
              estado: "rascunho",
            },
            error: null,
          };
        }
        case "transicionar_resposta_recurso": {
          const novo = proximoEstado(r.estado, args.p_acao);
          if (!novo || args.p_revisao !== r.revisao)
            return {
              data: null,
              error: { code: "22023", message: "não vale" },
            };
          if (
            args.p_acao === "aprovar" &&
            r.passou_revisao &&
            servidor.eu === r.autor_id
          )
            return { data: null, error: { code: "42501", message: "autora" } };
          servidor.resposta = {
            ...r,
            estado: novo,
            revisao: r.revisao + 1,
            passou_revisao:
              r.passou_revisao || args.p_acao === "enviar_revisao",
            envio_revisao_por_id:
              args.p_acao === "enviar_revisao"
                ? servidor.eu
                : r.envio_revisao_por_id,
            revisor_id: ["aprovar", "devolver"].includes(args.p_acao)
              ? servidor.eu
              : r.revisor_id,
            comentario_revisao: args.p_comentario ?? r.comentario_revisao,
          };
          if (args.p_acao === "marcar_enviada")
            servidor.recurso.resposta_candidato_em = "2026-09-29T15:00:00Z";
          return {
            data: {
              id: r.id,
              estado: novo,
              revisao: servidor.resposta.revisao,
            },
            error: null,
          };
        }
        case "registrar_anexo_recurso": {
          const objeto = servidor.objetos.find(
            (o) => o.caminho === args.p_caminho,
          );
          if (!objeto)
            return {
              data: null,
              error: { code: "P0002", message: "sem objeto" },
            };
          servidor.anexos = [
            {
              id: `anexo-${servidor.anexos.length + 1}`,
              tipo: args.p_tipo,
              nome: args.p_nome,
              bytes: objeto.arquivo.size,
              mime: objeto.contentType,
              ativo: true,
              resposta_id: args.p_resposta_id,
              incluido_em: "2026-09-29T15:00:00Z",
              incluido_por: "Autora",
            },
            ...servidor.anexos,
          ];
          return { data: { id: servidor.anexos[0].id }, error: null };
        }
        case "registrar_download_anexo_recurso": {
          const anexo = servidor.anexos.find((a) => a.id === args.p_anexo_id);
          servidor.downloads = (servidor.downloads || 0) + 1;
          return {
            data: {
              bucket: "recursos-anexos",
              caminho: anexo.caminho,
              nome: anexo.nome,
            },
            error: null,
          };
        }
        case "listar_modelos_resposta_recurso":
          return {
            data: {
              marcadores: [],
              areas: [{ id: "saude-indigena", rotulo: "Saúde Indígena" }],
              origens: [
                {
                  id: "analise-curricular",
                  rotulo: "Análise curricular",
                  ativo: true,
                },
              ],
              modelos: [{ ...MODELO, ativo: true, em_uso: 2, versoes: [] }],
            },
            error: null,
          };
        case "salvar_modelo_resposta_recurso":
          return {
            data: { id: "novo-modelo", versao: 1, criou_versao: true },
            error: null,
          };
        default:
          return { data: null, error: null };
      }
    });
    const upload = vi.fn(async (caminho, arquivo, opcoes) => {
      servidor.objetos.push({
        caminho,
        arquivo,
        contentType: opcoes.contentType,
      });
      return { data: { path: caminho }, error: null };
    });
    const createSignedUrl = vi.fn(async (caminho) => ({
      data: {
        signedUrl: `https://storage.exemplo/assinada/${caminho}?token=t`,
      },
      error: null,
    }));
    const from = vi.fn(() => ({ upload, createSignedUrl }));
    servidor.supabase = { rpc, storage: { from } };
    servidor.storage = { from, upload, createSignedUrl };
    return servidor;
  }

  let raiz;
  let painel;
  /* O Painel de recursos ao lado: as pendências das respostas ficam nele. */
  let raizDoPainel;
  let acompanhamento;
  const toast = vi.fn();
  const baixarArquivo = vi.fn();
  const abrirUrl = vi.fn();
  const imprimir = vi.fn();
  let ids = 0;
  const novoId = () =>
    `0b8f5e0e-1c1d-4f55-9a55-${String(++ids).padStart(12, "0")}`;

  async function montar(servidor) {
    raiz = document.createElement("div");
    document.body.append(raiz);
    await act(async () => {
      painel = montarTela(criarRecursos, "page-recursos", {
        modo: "analise",
        secao: raiz,
        supabase: servidor.supabase,
        areaAtual: () => "saude-indigena",
        toast,
        baixarArquivo,
        abrirUrl,
        imprimir,
        novoId,
      });
    });
    // O legado abre a tela (navigate → render()).
    await act(async () => void painel.render());
    await esperar();
    raizDoPainel = document.createElement("div");
    document.body.append(raizDoPainel);
    await act(async () => {
      acompanhamento = montarTela(criarRecursos, "page-recursos", {
        secao: raizDoPainel,
        supabase: servidor.supabase,
        areaAtual: () => "saude-indigena",
        toast,
      });
    });
  }

  async function abrirGaveta() {
    await clicar(document.querySelector(".recursos-linha"));
    await esperar();
    await esperar();
  }

  const secao = (nome) =>
    document.querySelector(`.ui-secao[data-section="${nome}"]`);
  const botaoEm = (onde, texto) =>
    [...(onde || document).querySelectorAll("button")].find((b) =>
      b.textContent.trim().startsWith(texto),
    );
  /* As respostas em revisão, aprovadas e devolvidas são pendências (os KPIs delas saíram). */
  /* Abre o Painel de recursos de novo (navigate → render()) e lê a pendência. */
  async function pendencia(chave) {
    await act(async () => void acompanhamento.render());
    await esperar();
    return Number.parseInt(
      raizDoPainel.querySelector(
        `.ui-pendencias [data-pendencia="${chave}"] small`,
      )?.textContent || "0",
      10,
    );
  }

  afterEach(async () => {
    await act(async () => painel?.raiz?.unmount());
    await act(async () => acompanhamento?.raiz?.unmount());
    raiz?.remove();
    document.body.innerHTML = "";
    document.body.className = "";
    for (const f of [toast, baixarArquivo, abrirUrl, imprimir]) f.mockClear();
  });

  describe("resposta ao candidato", () => {
    it("não oferece um novo rascunho quando a resposta existente tem revisão inválida", async () => {
      await montar(
        criarServidor({
          resposta: {
            id: "resp1",
            revisao: "3",
            estado: "rascunho",
            texto_final: "Resposta existente",
          },
        }),
      );
      await abrirGaveta();
      expect(secao("resposta")).toBeNull();
      expect(document.querySelector(".recursos-corpo").textContent).toContain(
        "A resposta recebida é inválida",
      );
      expect(document.querySelector(".recursos-resposta-editor")).toBeNull();
    });

    it("modelo → prévia → rascunho → revisão → aprovação por outra pessoa → documento → enviada", async () => {
      const servidor = criarServidor();
      await montar(servidor);
      expect(await pendencia("resposta_em_revisao")).toBe(0);
      await abrirGaveta();
      const resposta = secao("resposta");
      expect(resposta).not.toBeNull();

      // Recurso deferido: o modelo da origem já vem escolhido; o de entrevista não aparece.
      const modelo = resposta.querySelector('select[name="modelo"]');
      expect(modelo.value).toBe(`${MODELO.id}:1`);
      expect([...modelo.options].map((o) => o.textContent)).toEqual([
        "Escolha o modelo",
        "Deferido — Análise curricular",
      ]);
      const previa = () =>
        resposta.querySelector('[aria-label="Prévia da resposta"]').textContent;
      expect(previa()).toContain("Candidato(a): Ana Ribeiro (111)");
      expect(previa()).toContain("[não informado: Fundamentação]");
      expect(resposta.textContent).toContain(
        "Sem valor no recurso: Fundamentação",
      );

      await digitar(
        resposta.querySelector('textarea[name="fundamentacao"]'),
        "O diploma <b>foi</b> aceito.",
      );
      expect(previa()).toContain("O diploma <b>foi</b> aceito.");
      expect(previa()).toContain("Nota: 50 → 55.");
      expect(resposta.querySelector("b")).toBeNull();

      await clicar(botaoEm(resposta, "Salvar rascunho"));
      await esperar();
      const salvo = servidor.supabase.rpc.mock.calls.find(
        ([nome]) => nome === "salvar_resposta_recurso",
      )[1].p_dados;
      expect(salvo).toMatchObject({
        recurso_id: RECURSO_ID,
        modelo_id: MODELO.id,
        modelo_versao: 1,
        fundamentacao: "O diploma <b>foi</b> aceito.",
        revisao: null,
      });
      expect(salvo.texto_final).toContain(
        "Fundamentação:\nO diploma <b>foi</b> aceito.",
      );

      // Rascunho salvo: enviar para revisão (com confirmação).
      const secaoAtual = () => secao("resposta");
      expect(secaoAtual().textContent).toContain("Resposta: rascunho");
      await clicar(botaoEm(secaoAtual(), "Enviar para revisão"));
      await clicar(
        botaoEm(
          secaoAtual().querySelector(".recursos-confirmacao"),
          "Enviar para revisão",
        ),
      );
      await esperar();
      expect(servidor.supabase.rpc).toHaveBeenCalledWith(
        "transicionar_resposta_recurso",
        {
          p_resposta_id: "resp1",
          p_acao: "enviar_revisao",
          p_revisao: 1,
          p_comentario: null,
        },
      );
      expect(await pendencia("resposta_em_revisao")).toBe(1);

      // Em revisão: sem editor de texto; a autora não aprova.
      expect(
        secaoAtual().querySelector('textarea[name="fundamentacao"]'),
      ).toBeNull();
      const aprovar = secaoAtual().querySelector('button[data-acao="aprovar"]');
      expect(aprovar.disabled).toBe(true);
      expect(aprovar.title).toMatch(/não pode aprová-la/);

      // Outra pessoa (o revisor) aprova, com comentário opcional.
      servidor.eu = REVISOR;
      await esperar(() => painel.estado.carregarDetalhe(RECURSO_ID));
      expect(
        secaoAtual().querySelector('button[data-acao="aprovar"]').disabled,
      ).toBe(false);
      await clicar(secaoAtual().querySelector('button[data-acao="aprovar"]'));
      await digitar(
        secaoAtual().querySelector('textarea[name="comentario"]'),
        "Ok.",
      );
      await clicar(
        botaoEm(secaoAtual().querySelector(".recursos-confirmacao"), "Aprovar"),
      );
      await esperar();
      expect(servidor.resposta.estado).toBe("aprovada");
      expect(await pendencia("resposta_aprovada")).toBe(1);

      // Documento: .docx, impressão e anexo ao recurso.
      await clicar(botaoEm(secaoAtual(), "Baixar"));
      expect(baixarArquivo).toHaveBeenCalledTimes(1);
      const [blob, nome] = baixarArquivo.mock.calls[0];
      expect(nome).toBe("resposta-recurso-7-ana-ribeiro.docx");
      expect(blob.type).toBe(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      await clicar(botaoEm(secaoAtual(), "Imprimir / PDF"));
      expect(imprimir).toHaveBeenCalledWith(
        servidor.resposta.texto_final,
        "resposta-recurso-7-ana-ribeiro",
      );
      await clicar(botaoEm(secaoAtual(), "Anexar .docx ao recurso"));
      await esperar();
      expect(servidor.storage.from).toHaveBeenCalledWith("recursos-anexos");
      const [caminho, , opcoes] = servidor.storage.upload.mock.calls[0];
      expect(caminho).toMatch(
        new RegExp(
          `^saude-indigena/${RECURSO_ID}/0b8f5e0e-1c1d-4f55-9a55-\\d{12}-resposta-recurso-7-ana-ribeiro\\.docx$`,
        ),
      );
      expect(opcoes).toEqual({
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: false,
      });
      expect(servidor.anexos[0]).toMatchObject({
        tipo: "resposta",
        resposta_id: "resp1",
      });
      expect(secao("anexos").textContent).toContain(
        "resposta-recurso-7-ana-ribeiro.docx",
      );

      // Marcar enviada: confirma e relê a aba (a etapa do recurso foi marcada).
      const leituras = () =>
        servidor.supabase.rpc.mock.calls.filter(
          ([n]) => n === "get_recursos_da_area",
        ).length;
      const antes = leituras();
      await clicar(
        secaoAtual().querySelector('button[data-acao="marcar_enviada"]'),
      );
      expect(
        secaoAtual().querySelector(".recursos-confirmacao").textContent,
      ).toContain("Confirme que a resposta aprovada já foi enviada");
      await clicar(
        botaoEm(
          secaoAtual().querySelector(".recursos-confirmacao"),
          "Marcar resposta enviada",
        ),
      );
      await esperar();
      expect(servidor.resposta.estado).toBe("enviada");
      expect(leituras()).toBe(antes + 1);
      expect(
        document.querySelector(
          ".recursos-linha .recursos-etapa-marca:last-child",
        ).className,
      ).toContain("is-feita");
      expect(secaoAtual().querySelector("[data-acao]")).toBeNull();
      // O fluxo inteiro numa gaveta: com a suíte toda em paralelo, passa de 5 s.
    }, 30_000);

    it("devolvida: o comentário é obrigatório e o texto volta a ser editável", async () => {
      const servidor = criarServidor({
        resposta: {
          id: "resp1",
          estado: "em_revisao",
          revisao: 3,
          passou_revisao: true,
          autor_id: AUTORA,
          envio_revisao_por_id: AUTORA,
          modelo_id: MODELO.id,
          modelo_versao: 1,
          modelo_nome: MODELO.nome,
          modelo_corpo: MODELO.corpo,
          modelo_situacao: "DEFERIDO",
          modelo_vigente: true,
          fundamentacao: "x",
          texto_final: "Texto",
        },
      });
      servidor.eu = REVISOR;
      await montar(servidor);
      await abrirGaveta();
      await clicar(
        secao("resposta").querySelector('button[data-acao="devolver"]'),
      );
      const confirmar = botaoEm(
        secao("resposta").querySelector(".recursos-confirmacao"),
        "Devolver",
      );
      expect(confirmar.disabled).toBe(true);
      await digitar(
        secao("resposta").querySelector('textarea[name="comentario"]'),
        "Cite o item do edital.",
      );
      expect(confirmar.disabled).toBe(false);
      await clicar(confirmar);
      await esperar();
      expect(servidor.resposta.estado).toBe("devolvida");
      expect(await pendencia("resposta_devolvida")).toBe(1);
      expect(secao("resposta").textContent).toContain(
        "Ajuste pedido na revisão: Cite o item do edital.",
      );
      expect(
        secao("resposta").querySelector('textarea[name="fundamentacao"]'),
      ).not.toBeNull();
    });
    it("a releitura da aba não remonta a resposta nem perde o rascunho digitado", async () => {
      const servidor = criarServidor();
      await montar(servidor);
      await abrirGaveta();
      await digitar(
        secao("resposta").querySelector('textarea[name="fundamentacao"]'),
        "Ainda não salvo.",
      );
      await act(async () => void painel.render());
      await esperar();
      await esperar();
      expect(
        secao("resposta").querySelector('textarea[name="fundamentacao"]').value,
      ).toBe("Ainda não salvo.");
    });
  });

  describe("resposta não salva", () => {
    it("o texto digitado segura o F5, a versão nova e a página desligada até salvar ou sair", async () => {
      const { guardaDeAlteracoes } =
        await import("../src/app/guarda-de-alteracoes.ts");
      const servidor = criarServidor();
      await montar(servidor);
      await abrirGaveta();
      expect(guardaDeAlteracoes.comAlteracoes()).toBe(false);
      await digitar(
        secao("resposta").querySelector('textarea[name="fundamentacao"]'),
        "Ainda não salvo.",
      );
      expect(guardaDeAlteracoes.comAlteracoes()).toBe(true);
      expect(guardaDeAlteracoes.podeRecarregar()).toBe(false);
      const saida = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(saida);
      expect(saida.defaultPrevented).toBe(true);
      await act(async () => painel.raiz.unmount());
      painel = null;
      expect(guardaDeAlteracoes.comAlteracoes()).toBe(false);
    });
  });

  describe("anexos", () => {
    it("editor anexa: envia ao bucket no caminho da área e do recurso e registra", async () => {
      const servidor = criarServidor();
      await montar(servidor);
      await abrirGaveta();
      const anexos = secao("anexos");
      expect(anexos.textContent).toContain("Nenhum anexo.");
      const campo = anexos.querySelector('input[type="file"]');
      const grande = new File(["x"], "grande.pdf", { type: "application/pdf" });
      Object.defineProperty(grande, "size", { value: 21 * 1024 * 1024 });
      await act(async () => {
        Object.defineProperty(campo, "files", {
          value: [grande],
          configurable: true,
        });
        campo.dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(anexos.textContent).toContain("O arquivo passa de 20 MB.");
      expect(botaoEm(anexos, "Anexar").disabled).toBe(true);

      const pdf = new File(["%PDF-1.7"], "Recurso da Ana.pdf", {
        type: "application/pdf",
      });
      await act(async () => {
        Object.defineProperty(campo, "files", {
          value: [pdf],
          configurable: true,
        });
        campo.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await escolher(
        anexos.querySelector('select[name="tipo"]'),
        "recurso_candidato",
      );
      await clicar(botaoEm(anexos, "Anexar"));
      await esperar();
      const [caminho, arquivo, opcoes] = servidor.storage.upload.mock.calls[0];
      expect(caminho).toMatch(
        new RegExp(
          `^saude-indigena/${RECURSO_ID}/[0-9a-f-]{36}-Recurso-da-Ana\\.pdf$`,
        ),
      );
      expect(arquivo).toBe(pdf);
      expect(opcoes).toEqual({ contentType: "application/pdf", upsert: false });
      expect(servidor.supabase.rpc).toHaveBeenCalledWith(
        "registrar_anexo_recurso",
        {
          p_recurso_id: RECURSO_ID,
          p_tipo: "recurso_candidato",
          p_nome: "Recurso da Ana.pdf",
          p_caminho: caminho,
          p_resposta_id: null,
        },
      );
      expect(secao("anexos").textContent).toContain("Recurso da Ana.pdf");
    });

    it("quem só lê: consulta a resposta e baixa (registro antes da URL assinada), sem escrever", async () => {
      const servidor = criarServidor({
        podeEditar: false,
        resposta: {
          id: "resp1",
          estado: "aprovada",
          revisao: 4,
          autor_id: AUTORA,
          modelo_id: MODELO.id,
          modelo_versao: 1,
          modelo_nome: MODELO.nome,
          modelo_situacao: "DEFERIDO",
          modelo_vigente: false,
          fundamentacao: "x",
          texto_final: "RESPOSTA\nTexto aprovado.",
        },
        anexos: [
          {
            id: "an1",
            tipo: "recurso_candidato",
            nome: "recurso.pdf",
            bytes: 2048,
            mime: "application/pdf",
            ativo: true,
            caminho: `saude-indigena/${RECURSO_ID}/x-recurso.pdf`,
          },
          {
            id: "an2",
            tipo: "outro",
            nome: "velho.pdf",
            bytes: 10,
            mime: "application/pdf",
            ativo: false,
            motivo_arquivamento: "duplicado",
          },
        ],
      });
      await montar(servidor);
      await abrirGaveta();
      const resposta = secao("resposta");
      expect(resposta.querySelector("textarea, select")).toBeNull();
      expect(resposta.querySelector("[data-acao]")).toBeNull();
      expect(
        resposta.querySelector('[aria-label="Texto final da resposta"]')
          .textContent,
      ).toBe("RESPOSTA\nTexto aprovado.");
      expect(resposta.textContent).toContain("(há versão mais nova)");
      expect(botaoEm(resposta, "Anexar .docx")).toBeUndefined();
      expect(botaoEm(resposta, "Imprimir / PDF")).toBeTruthy();

      const anexos = secao("anexos");
      expect(anexos.querySelector('input[type="file"]')).toBeNull();
      expect(botaoEm(anexos, "Arquivar")).toBeUndefined();
      // O arquivado aparece recolhido, sem "Baixar" para quem só lê.
      expect(anexos.querySelector("details").textContent).toContain(
        "1 arquivado",
      );
      expect(
        anexos.querySelector('[aria-label="Baixar velho.pdf"]'),
      ).toBeNull();

      await clicar(anexos.querySelector('[aria-label="Baixar recurso.pdf"]'));
      await esperar();
      const ordem = servidor.supabase.rpc.mock.invocationCallOrder.at(-1);
      expect(servidor.supabase.rpc).toHaveBeenLastCalledWith(
        "registrar_download_anexo_recurso",
        { p_anexo_id: "an1" },
      );
      expect(servidor.storage.createSignedUrl).toHaveBeenCalledWith(
        `saude-indigena/${RECURSO_ID}/x-recurso.pdf`,
        60,
        { download: "recurso.pdf" },
      );
      expect(
        servidor.storage.createSignedUrl.mock.invocationCallOrder[0],
      ).toBeGreaterThan(ordem);
      expect(abrirUrl).toHaveBeenCalledWith(
        `https://storage.exemplo/assinada/saude-indigena/${RECURSO_ID}/x-recurso.pdf?token=t`,
      );
    });

    it("o download vem da URL assinada sem abrir aba nova (o bloqueador de pop-up barraria depois das esperas)", async () => {
      const servidor = criarServidor();
      const clicadas = [];
      const clique = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(function () {
          clicadas.push(this);
        });
      try {
        const estado = criarEstadoDosRecursos({
          supabase: servidor.supabase,
          toast,
        });
        servidor.supabase.rpc.mockImplementationOnce(async () => ({
          data: {
            caminho: "saude-indigena/r/x-recurso.pdf",
            nome: "recurso.pdf",
          },
          error: null,
        }));
        expect(await estado.baixarAnexo({ id: "an1" })).toBe(true);
        expect(clicadas).toHaveLength(1);
        expect(clicadas[0].href).toBe(
          "https://storage.exemplo/assinada/saude-indigena/r/x-recurso.pdf?token=t",
        );
        expect(clicadas[0].target).toBe("");
      } finally {
        clique.mockRestore();
      }
    });
  });

  describe("modelos de resposta (administração)", () => {
    it("só o admin vê o botão; o novo modelo confere marcadores antes de salvar", async () => {
      const semAdmin = criarServidor();
      await montar(semAdmin);
      expect(document.querySelector('[data-acao="modelos"]')).toBeNull();
      await act(async () => painel.raiz.unmount());
      raiz.remove();

      const servidor = criarServidor({ admin: true });
      await montar(servidor);
      await clicar(document.querySelector('[data-acao="modelos"]'));
      await esperar();
      const gaveta = document.getElementById("recursosModelos");
      expect(gaveta.textContent).toContain("Deferido — Análise curricular");
      expect(gaveta.textContent).toContain("2 resposta(s)");

      await clicar(botaoEm(gaveta, "Novo modelo"));
      await digitar(
        gaveta.querySelector('input[name="nome"]'),
        "Indeferido — geral",
      );
      await escolher(
        gaveta.querySelector('select[name="situacao"]'),
        "INDEFERIDO",
      );
      await digitar(
        gaveta.querySelector('textarea[name="corpo"]'),
        "Prezado(a) {nome_candidato}, {nota_final}.",
      );
      await clicar(botaoEm(gaveta, "Salvar modelo"));
      expect(gaveta.textContent).toContain(
        "Marcador desconhecido: {nota_final}.",
      );
      expect(servidor.supabase.rpc).not.toHaveBeenCalledWith(
        "salvar_modelo_resposta_recurso",
        expect.anything(),
      );

      await digitar(
        gaveta.querySelector('textarea[name="corpo"]'),
        "Prezado(a) ",
      );
      await clicar(
        botaoEm(
          gaveta.querySelector(".recursos-marcadores"),
          "{nome_candidato}",
        ),
      );
      await act(async () => new Promise((ok) => requestAnimationFrame(ok)));
      expect(gaveta.querySelector('textarea[name="corpo"]').value).toContain(
        "{nome_candidato}",
      );
      await digitar(
        gaveta.querySelector('textarea[name="corpo"]'),
        "Prezado(a) {nome_candidato}, o recurso foi indeferido. {fundamentacao}",
      );
      await clicar(botaoEm(gaveta, "Salvar modelo"));
      await esperar();
      expect(servidor.supabase.rpc).toHaveBeenCalledWith(
        "salvar_modelo_resposta_recurso",
        {
          p_dados: {
            nome: "Indeferido — geral",
            situacao: "INDEFERIDO",
            origem: null,
            area: null,
            corpo:
              "Prezado(a) {nome_candidato}, o recurso foi indeferido. {fundamentacao}",
          },
        },
      );
    });
  });
});

bloco("modulos/selecao", async () => {
  /*
  A tela de Seleção como módulo do app (src/modulos/selecao/): monta na
  própria `#page-selecao`, carrega a área atual do app quando o legado abre a
  tela (`render()`), segue o tema do app, usa o aviso global e os componentes
  de src/ui/ (classes .ui-*). A mesma tela do antigo painel externo
  "AgSUS Monitora Recrutamento e Seleção": filtros de escolha múltipla, 7
  KPIs, recorte, 5 gráficos, alertas da coluna Observação e a base
  operacional, sem HTML vindo dos dados, com estado vazio e sem acesso.
*/

  // O Chart.js não desenha no jsdom (sem canvas): um falso guarda o que recebeu.

  const { criarSelecao } = await import("../src/modulos/selecao/selecao.tsx");
  const { criarEstadoDaSelecao } =
    await import("../src/modulos/selecao/estado.ts");

  const PAYLOAD = {
    schema_version: 1,
    area: "saude-indigena",
    gerado_em: "2026-10-01T12:00:00Z",
    ultima_carga: { em: "2026-10-01T09:02:00-03:00", linhas: 2, sem_edital: 1 },
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
  Como o app monta: o módulo nasce na `<section id="page-selecao">` (vazia,
  sem pedir nada ao banco) e o legado chama `render()` ao navegar para a
  tela. A área é a área atual do app (dados-do-monitoramento.ts).
*/
  async function montar(supabase, { abrir = true, ...opcoes } = {}) {
    secao = document.createElement("section");
    secao.id = "page-selecao";
    secao.className = "page active";
    document.body.append(secao);
    await act(async () => {
      painel = montarTela(criarSelecao, "page-selecao", {
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
    secao.querySelector(`.selecao-kpis [data-kpi="${chave}"] .ui-kpi-valor`)
      ?.textContent;
  const linhas = () =>
    secao.querySelectorAll(".ui-tabela tbody tr.selecao-linha");
  const status = () => secao.querySelector(".ui-topo .status-discreto");
  /* Sem filtro a linha do recorte some (o "Sem filtros" repetia o painel de filtros). */
  const recorte = () =>
    secao.querySelector("[data-recorte]")?.textContent ?? "Sem filtros";
  const naTela = (texto) => document.body.textContent.includes(texto);
  const botao = (texto) =>
    [...document.querySelectorAll("button")].find((b) =>
      b.textContent.trim().startsWith(texto),
    );
  const opcaoDoFiltro = (id, rotulo) =>
    [
      ...document
        .getElementById(id)
        .closest(".multi-select")
        .querySelectorAll(".multi-select-option"),
    ]
      .find((opcao) => opcao.textContent === rotulo)
      ?.querySelector("input");
  const grafico = (id) =>
    graficos.find((g) => g.canvas.id === id && g.canvas.isConnected);

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

  describe("a tela dentro do app", () => {
    it("monta na seção sem pedir nada; a primeira abertura (render) carrega a área atual", async () => {
      const supabase = supabaseFalso({ data: PAYLOAD, error: null });
      await montar(supabase, { abrir: false });
      expect(secao.querySelector(".ui-tela.selecao-tela")).not.toBeNull();
      expect(supabase.rpc).not.toHaveBeenCalled();

      await abrirATela();
      expect(supabase.rpc).toHaveBeenCalledWith(
        "get_selecao_da_area_se_mudou",
        {
          p_area: "saude-indigena",
          p_versao: null,
        },
      );
      expect(kpi("inscritos")).toBe("122");
    });

    it("não repete o cabeçalho do app: topo só com o status (uma vez) e as ações", async () => {
      await montar(supabaseFalso({ data: PAYLOAD, error: null }));
      const topo = secao.querySelector("header.ui-topo");
      expect(topo.querySelector("h1, h2")).toBeNull();
      expect(
        [...topo.querySelectorAll(".ui-topo-acoes button")].map((b) =>
          b.textContent.trim(),
        ),
      ).toEqual(["Atualizar", "Exportar em Excel", "Salvar em PDF"]);
      expect(topo.querySelector('[aria-label*="tema"]')).toBeNull();
      expect(topo.querySelector('[aria-label*="tela cheia"]')).toBeNull();
      // "Conferido …": a última carga, discreta e uma vez só.
      expect(status().textContent).toBe("Conferido em 01/10, 09:02");
      expect(document.querySelectorAll(".status-discreto")).toHaveLength(1);
      expect(document.body.textContent.match(/Conferido em \d/g)).toHaveLength(
        1,
      );
      for (const texto of [
        "Yeendé Recrutamento e Seleção",
        "Painel de seleção",
        "Somente consulta",
        "Visualizando toda a base carregada",
      ])
        expect(naTela(texto), texto).toBe(false);
    });

    it("usa src/ui/ com as classes .ui-*, sem o CSS nem os ids do painel de análises", async () => {
      await montar(supabaseFalso({ data: PAYLOAD, error: null }));
      expect(
        secao.querySelector("section.ui-card.ui-filtros h2").textContent,
      ).toBe("Refinar resultados");
      expect(
        [...secao.querySelectorAll(".ui-card .ui-titulo")].map((e) =>
          e.textContent.trim(),
        ),
      ).toEqual([
        "Refinar resultados",
        "Eliminados antes da análise",
        "Aptos na análise e eliminados",
        "Contratados",
        "Triados e reprovados na análise",
        "Top DSEIs por inscritos",
        "Alertas identificados no recorte",
        "Base operacional consolidada",
      ]);
      for (const id of [
        "topbar",
        "themeBtn",
        "fullBtn",
        "refreshBtn",
        "exportBtn",
        "kpiGrid",
        "tableBody",
        "tableSearch",
        "filterChips",
        "activeContextSummary",
        "observationsSection",
        "authWarning",
        "toastHost",
        "selecaoPainel",
        "loading",
      ])
        expect(document.getElementById(id), id).toBeNull();
      expect(
        document.querySelector(
          ".topbar, .kpi, .kpis, .panel, .filter-panel, .table-card, .chart-wrap, .chip-filter, .badge, .field, .empty, .shell",
        ),
      ).toBeNull();
      expect(document.querySelector("iframe")).toBeNull();
      expect(document.body.classList.contains("analises-is-loading")).toBe(
        false,
      );
    });
  });

  describe("KPIs, recorte, observações e tabela", () => {
    it("os 7 KPIs em card compacto, na ordem do painel antigo", async () => {
      await montar(supabaseFalso({ data: PAYLOAD, error: null }));
      const cards = [...secao.querySelectorAll(".selecao-kpis .ui-kpi")];
      expect(
        cards.map((c) => c.querySelector(".ui-kpi-rotulo").textContent),
      ).toEqual([
        "Inscritos",
        "Aptos",
        "Triados",
        "Convocados entrevista",
        "Aprovados",
        "Contratados",
        "Taxa contratação",
      ]);
      expect(cards.every((c) => c.querySelector(".ui-kpi-icone i"))).toBe(true);
      expect(kpi("inscritos")).toBe("122");
      expect(kpi("aptos")).toBe("72");
      expect(kpi("triados")).toBe("69");
      expect(kpi("convocados")).toBe("14");
      expect(kpi("aprovados")).toBe("8");
      expect(kpi("contratados")).toBe("2");
      expect(kpi("taxa")).toBe("25%");
      expect(
        secao.querySelector('.selecao-kpis [data-kpi="aptos"]').dataset.tom,
      ).toBe("sucesso");
      // As regras dos números ficaram com a Aya (docs/aya/regras-da-selecao.md):
      // o único title é o do próprio rótulo (que para em duas linhas).
      for (const comTitulo of secao.querySelectorAll(".selecao-kpis [title]")) {
        expect(comTitulo.className).toBe("ui-kpi-texto");
        expect(comTitulo.title).toBe(comTitulo.textContent);
      }
    });

    it("sem filtros, a linha do recorte não aparece", async () => {
      await montar(supabaseFalso({ data: PAYLOAD, error: null }));
      expect(secao.querySelector("[data-recorte]")).toBeNull();
    });

    it("mostra os alertas da coluna Observação como texto", async () => {
      await montar(supabaseFalso({ data: PAYLOAD, error: null }));
      const alertas = secao.querySelector(".selecao-observacoes");
      expect(alertas.textContent).toContain("Alertas identificados no recorte");
      const item = alertas.querySelector("[data-observacao]");
      expect(item.querySelector("b").textContent).toBe("<b>1 Interessado</b>");
      expect(item.textContent).toContain(
        "1 vaga · DSEI Xingu · Edital 06/2026",
      );
      expect(item.querySelector("b b")).toBeNull();
    });

    it("a base operacional: linhas como texto, números à direita e a contagem", async () => {
      await montar(supabaseFalso({ data: PAYLOAD, error: null }));
      expect(linhas()).toHaveLength(2);
      expect(secao.querySelector(".ui-tabela tbody img")).toBeNull();
      expect(linhas()[0].textContent).toContain("<img src=x onerror=alert(1)>");
      expect(linhas()[1].textContent).toContain("CARGO 1: MÉDICO");
      expect(
        [...secao.querySelectorAll(".selecao-tabela thead th")].map(
          (th) => th.textContent,
        ),
      ).toEqual([
        "DSEI",
        "Edital",
        "Cargo",
        "Vaga",
        "Inscritos",
        "Aptos",
        "Triados",
        "Aprovados",
        "Contratados",
        "Observação",
      ]);
      expect(secao.querySelectorAll(".selecao-tabela td.num").length).toBe(10);
      expect(secao.querySelector("[data-tabela-contagem]").textContent).toBe(
        "2 vagas",
      );
    });

    it("a busca da tabela olha DSEI, edital, cargo e observação", async () => {
      await montar(supabaseFalso({ data: PAYLOAD, error: null }));
      await digitar(secao.querySelector(".ui-tabela-busca"), "interessado");
      expect(linhas()).toHaveLength(1);
      expect(secao.querySelector("[data-tabela-contagem]").textContent).toBe(
        "1 de 2",
      );
      // A busca é só da tabela: os KPIs continuam com o recorte inteiro.
      expect(kpi("inscritos")).toBe("122");
    });
  });

  describe("filtros", () => {
    it("filtra por DSEI na escolha múltipla; KPIs, recorte e opções acompanham; o chip tira", async () => {
      await montar(supabaseFalso({ data: PAYLOAD, error: null }));
      await clicar(opcaoDoFiltro("filtro-unidades", "DSEI Xingu"));
      expect(linhas()).toHaveLength(1);
      expect(kpi("inscritos")).toBe("83");
      expect(recorte()).toBe("Recorte ativo: Nome DSEI: DSEI Xingu");
      expect(secao.querySelector(".ui-filtros-resumo").textContent).toContain(
        "1 filtro adicional",
      );
      // Escolhido o DSEI, o filtro de edital só oferece os editais dele.
      expect(opcaoDoFiltro("filtro-editais", "96/2025")).toBeUndefined();
      await clicar(secao.querySelector(".ui-chips .ui-chip"));
      expect(linhas()).toHaveLength(2);
      expect(recorte()).toBe("Sem filtros");
    });

    it("Limpar tudo zera os quatro filtros", async () => {
      await montar(supabaseFalso({ data: PAYLOAD, error: null }));
      await clicar(opcaoDoFiltro("filtro-unidades", "DSEI Xingu"));
      await clicar(opcaoDoFiltro("filtro-editais", "06/2026"));
      expect(recorte()).toBe(
        "Recorte ativo: Nome DSEI: DSEI Xingu · Edital: 06/2026",
      );
      await clicar(secao.querySelector('[data-acao="limpar-filtros"]'));
      expect(recorte()).toBe("Sem filtros");
      expect(linhas()).toHaveLength(2);
    });

    it("os rótulos dos filtros apontam para o controle; fora da SI a unidade não é DSEI", async () => {
      definirAreaAtual("sede");
      await montar(
        supabaseFalso({ data: { ...PAYLOAD, area: "sede" }, error: null }),
      );
      const rotulos = [
        ...secao.querySelectorAll(".ui-filtros .ui-campo > label"),
      ];
      expect(rotulos.map((r) => r.textContent)).toEqual([
        "Unidade",
        "Edital",
        "Nome do cargo",
        "Número da vaga",
      ]);
      for (const rotulo of rotulos)
        expect(document.getElementById(rotulo.htmlFor)).not.toBeNull();
      expect(
        secao.querySelector("#filtro-unidades .multi-select-label").textContent,
      ).toBe("Todas as unidades");
      expect(secao.querySelector(".selecao-tabela th").textContent).toBe(
        "Unidade",
      );
    });

    it("pelo teclado: seta para baixo abre o filtro na primeira opção; Esc fecha e volta ao botão", async () => {
      await montar(supabaseFalso({ data: PAYLOAD, error: null }));
      const gatilho = document.getElementById("filtro-unidades");
      gatilho.focus();
      await teclar(gatilho, "ArrowDown");
      expect(gatilho.getAttribute("aria-expanded")).toBe("true");
      const primeira = opcaoDoFiltro("filtro-unidades", "DSEI Xingu");
      expect(document.activeElement).toBe(primeira);
      await clicar(primeira);
      expect(linhas()).toHaveLength(1);
      await teclar(document, "Escape");
      expect(gatilho.getAttribute("aria-expanded")).toBe("false");
      expect(document.activeElement).toBe(gatilho);
    });
  });

  describe("gráficos", () => {
    it("clique sem barra ou fora do ranking preserva o recorte; tooltip vazio não falha", async () => {
      await montar(supabaseFalso({ data: PAYLOAD, error: null }));
      const ranking = grafico("chartDsei");
      await act(async () => {
        ranking.options.onClick(null, []);
        ranking.options.onClick(null, [{ index: 99 }]);
      });
      expect(recorte()).toBe("Sem filtros");
      expect(linhas()).toHaveLength(2);
      expect(ranking.options.plugins.tooltip.callbacks.title([])).toBe("");
      expect(
        ranking.options.plugins.tooltip.callbacks.title([{ dataIndex: 99 }]),
      ).toBe("");
    });

    it("o plugin escreve a contagem da barra e ignora coordenadas ausentes", async () => {
      await montar(supabaseFalso({ data: PAYLOAD, error: null }));
      const barras = grafico("chartEliminados");
      const ctx = { save: vi.fn(), restore: vi.fn(), fillText: vi.fn() };
      const posicao = vi.fn(() => ({ x: 30, y: 60 }));
      barras.ctx = ctx;
      barras.getDatasetMeta = () => ({
        data: [
          { tooltipPosition: posicao },
          { tooltipPosition: () => ({ x: null, y: null }) },
        ],
      });
      barras.plugins[0].afterDatasetsDraw(barras);
      expect(posicao).toHaveBeenCalledWith(false);
      expect(ctx.fillText).toHaveBeenCalledTimes(1);
      expect(ctx.fillText).toHaveBeenCalledWith("2", 30, 56);
      expect(ctx.fillStyle).toBe("#526780");
      expect(ctx.save).toHaveBeenCalledTimes(1);
      expect(ctx.restore).toHaveBeenCalledTimes(1);
    });

    it("desenha os 5 gráficos Chart.js, com o medidor de contratação", async () => {
      await montar(supabaseFalso({ data: PAYLOAD, error: null }));
      expect(
        graficos
          .filter((g) => g.canvas.isConnected)
          .map((g) => g.canvas.id)
          .sort(),
      ).toEqual([
        "chartAnalise",
        "chartAptos",
        "chartContratados",
        "chartDsei",
        "chartEliminados",
      ]);
      const medidor = grafico("chartContratados");
      expect(medidor.config.type).toBe("doughnut");
      expect(medidor.options.circumference).toBe(180);
      expect(medidor.options.plugins.selecaoTextoNoCentro.principal).toBe(
        "25%",
      );
      expect(medidor.options.plugins.selecaoTextoNoCentro.secundario).toBe(
        "2 de 8 aprovados",
      );
      expect(grafico("chartEliminados").data.datasets[0].data).toEqual([
        2, 9, 0,
      ]);
      expect(grafico("chartDsei").canvas.getAttribute("role")).toBe("img");
    });

    it("clicar na barra do ranking filtra a unidade; clicar de novo tira o filtro", async () => {
      await montar(supabaseFalso({ data: PAYLOAD, error: null }));
      const ranking = grafico("chartDsei");
      const indice = ranking.data.labels.indexOf("DSEI Xingu");
      await act(async () => ranking.options.onClick(null, [{ index: indice }]));
      expect(linhas()).toHaveLength(1);
      expect(recorte()).toBe("Recorte ativo: Nome DSEI: DSEI Xingu");

      const depois = grafico("chartDsei");
      await act(async () => depois.options.onClick(null, [{ index: 0 }]));
      expect(linhas()).toHaveLength(2);
      expect(recorte()).toBe("Sem filtros");
    });
  });

  describe("tema do app", () => {
    it("segue o tema do app: o escuro (data-theme + agsus:tema-alterado) redesenha os gráficos", async () => {
      await montar(supabaseFalso({ data: PAYLOAD, error: null }));
      const barras = grafico("chartEliminados");
      const antes = barras.atualizacoes;
      expect(barras.options.scales.y.ticks.color).toBe("#526780");

      await act(async () => {
        document.documentElement.setAttribute("data-theme", "dark");
        document.dispatchEvent(new CustomEvent(EVENTO_TEMA_ALTERADO));
      });
      expect(barras.atualizacoes).toBeGreaterThan(antes);
      expect(barras.options.scales.y.ticks.color).toBe("#dbe8f5");
      // Não guarda tema próprio: quem guarda é o app.
      expect(localStorage.getItem("agsus_analises_theme_v3")).toBeNull();
    });

    it("as cores dos gráficos vêm dos tokens do app quando eles existem", async () => {
      document.documentElement.style.setProperty("--text-secondary", "#123456");
      document.documentElement.style.setProperty("--text-primary", "#654321");
      try {
        await montar(supabaseFalso({ data: PAYLOAD, error: null }));
        expect(grafico("chartDsei").options.scales.x.ticks.color).toBe(
          "#123456",
        );
        expect(
          grafico("chartContratados").options.plugins.selecaoTextoNoCentro.cor,
        ).toBe("#654321");
      } finally {
        document.documentElement.style.removeProperty("--text-secondary");
        document.documentElement.style.removeProperty("--text-primary");
      }
    });
  });

  describe("Exportar", () => {
    it("baixa o CSV do recorte, com a área no nome e as células protegidas", async () => {
      await montar(supabaseFalso({ data: PAYLOAD, error: null }));
      await clicar(opcaoDoFiltro("filtro-unidades", "DSEI Xingu"));
      await clicar(secao.querySelector('[data-acao="exportar-excel"]'));
      expect(baixar).toHaveBeenCalledTimes(1);
      const [bytes, nome] = baixar.mock.calls[0];
      const conteudo = new TextDecoder().decode(bytes);
      expect(nome).toMatch(/^selecao-saude-indigena-\d{4}-\d{2}-\d{2}\.xlsx$/);
      expect(conteudo).toContain("DSEI Xingu");
      expect(conteudo).not.toContain("Caminhoneiros");
      expect(conteudo).toContain("Entrevistas do Yeendé");
    });

    it("sem vagas no recorte, Exportar fica desativado", async () => {
      await montar(
        supabaseFalso({ data: { ...PAYLOAD, vagas: [] }, error: null }),
      );
      expect(secao.querySelector('[data-acao="exportar-excel"]').disabled).toBe(
        true,
      );
    });
  });

  describe("área atual do app", () => {
    it("trocar a área com a tela aberta recarrega com a nova e zera os filtros", async () => {
      const supabase = supabaseFalso({ data: PAYLOAD, error: null });
      await montar(supabase);
      await clicar(opcaoDoFiltro("filtro-unidades", "DSEI Xingu"));
      expect(linhas()).toHaveLength(1);

      await act(async () => definirAreaAtual("sede"));
      await esperar();
      expect(supabase.rpc).toHaveBeenLastCalledWith(
        "get_selecao_da_area_se_mudou",
        {
          p_area: "sede",
          p_versao: null,
        },
      );
      expect(painel.estado.obter().area).toBe("sede");
      expect(linhas()).toHaveLength(2);
      expect(recorte()).toBe("Sem filtros");
    });

    it("cada abertura pega a área de agora; na mesma área, relê por trás", async () => {
      const supabase = supabaseFalso({ data: PAYLOAD, error: null });
      await montar(supabase);
      await abrirATela();
      expect(supabase.rpc).toHaveBeenCalledTimes(2);
      definirAreaAtual("projetos");
      await abrirATela();
      expect(supabase.rpc).toHaveBeenLastCalledWith(
        "get_selecao_da_area_se_mudou",
        {
          p_area: "projetos",
          p_versao: null,
        },
      );
    });

    it("a volta à tela manda a versão que tem; inalterado, a tela fica como estava", async () => {
      const supabase = supabaseFalso({
        data: { ...PAYLOAD, versao: "v1" },
        error: null,
      });
      await montar(supabase);
      const antes = linhas().length;
      supabase.rpc.mockResolvedValue({
        data: { inalterado: true, versao: "v1" },
        error: null,
      });
      await abrirATela();
      expect(supabase.rpc).toHaveBeenLastCalledWith(
        "get_selecao_da_area_se_mudou",
        {
          p_area: "saude-indigena",
          p_versao: "v1",
        },
      );
      expect(linhas()).toHaveLength(antes);
      expect(kpi("inscritos")).toBe("122");
    });
  });

  describe("sessão", () => {
    it("sem sessão no cliente do app, avisa e não pede a seleção", async () => {
      const supabase = supabaseFalso(
        { data: PAYLOAD, error: null },
        { getSession: async () => ({ data: { session: null } }) },
      );
      await montar(supabase);
      expect(secao.querySelector(".ui-aviso[role=alert]").textContent).toBe(
        "Sessão não localizada. Entre de novo no Yeendé.",
      );
      expect(status().textContent).toBe("Sessão não localizada");
      expect(supabase.rpc).not.toHaveBeenCalled();
      expect(secao.querySelector(".selecao-kpis")).toBeNull();
      expect(secao.querySelector('[data-acao="atualizar"]').disabled).toBe(
        true,
      );
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
      expect(linhas()).toHaveLength(2);

      await todos({ user: { id: "b" } });
      expect(painel.estado.obter().carregado).toBe(false);
      expect(painel.estado.obter().area).toBe("");
      expect(naTela("DSEI Xingu")).toBe(false);
    });

    it("sem permissão (42501) mostra 'Sem acesso à Seleção', sem os blocos", async () => {
      await montar(
        supabaseFalso({ data: null, error: { code: "42501", message: "x" } }),
      );
      const aviso = secao.querySelector(".selecao-sem-acesso[role=alert]");
      expect(aviso.textContent).toContain("Sem acesso à Seleção");
      expect(aviso.textContent).toContain("Peça a liberação do módulo Seleção");
      expect(status().textContent).toBe("Sem acesso");
      expect(secao.querySelector(".selecao-kpis")).toBeNull();
      expect(secao.querySelector(".ui-tabela")).toBeNull();
    });
  });

  describe("carga", () => {
    it("antes do dado, o skeleton dos KPIs, gráficos e tabela; depois, os números", async () => {
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
      const inscritos = secao.querySelector(
        '.selecao-kpis [data-kpi="inscritos"]',
      );
      expect(inscritos.getAttribute("aria-busy")).toBe("true");
      expect(inscritos.querySelector(".ui-esqueleto")).not.toBeNull();
      expect(secao.querySelectorAll(".ui-grafico.is-carregando")).toHaveLength(
        5,
      );
      expect(
        secao.querySelectorAll('.ui-tabela tbody tr[aria-hidden="true"]'),
      ).toHaveLength(8);
      expect(secao.querySelector("#filtro-unidades").disabled).toBe(true);
      expect(status().textContent).toBe("Carregando dados…");

      await esperar(() => responder({ data: PAYLOAD, error: null }));
      expect(kpi("inscritos")).toBe("122");
      expect(secao.querySelector(".ui-grafico.is-carregando")).toBeNull();
    });

    it("área sem vagas mostra o estado vazio, sem alertas", async () => {
      await montar(
        supabaseFalso({ data: { ...PAYLOAD, vagas: [] }, error: null }),
      );
      expect(secao.querySelector(".ui-aviso[role=status]").textContent).toBe(
        "Nenhuma vaga carregada para esta área ainda.",
      );
      expect(secao.querySelector(".selecao-observacoes")).toBeNull();
      expect(kpi("inscritos")).toBe("0");
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
        "A aba Seleção ainda não foi publicada no banco.",
      );
      expect(status().textContent).toBe("Sem dados");
      falhar = false;
      await clicar(botao("Tentar novamente"));
      await esperar();
      expect(kpi("inscritos")).toBe("122");
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
        expect.stringContaining("Não foi possível atualizar a seleção"),
        "error",
      );
      expect(kpi("inscritos")).toBe("122");
    });
  });

  describe("cópia guardada (stale-while-revalidate)", () => {
    it("guarda na primeira carga e abre da cópia na seguinte, revalidando", async () => {
      const armazenamento = memoria();
      const primeiro = criarEstadoDaSelecao({
        supabase: supabaseFalso({ data: PAYLOAD, error: null }),
        armazenamento,
      });
      expect(await primeiro.carregar("saude-indigena")).toBe(true);
      await vi.waitFor(() =>
        expect(armazenamento.mapa.has("selecao:saude-indigena")).toBe(true),
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
      const segundo = criarEstadoDaSelecao({ supabase: lento, armazenamento });
      const carga = segundo.carregar("saude-indigena");
      await vi.waitFor(() => expect(segundo.obter().daCopia).toBe(true));
      expect(segundo.obter().dados.vagas).toHaveLength(2);
      responder({ data: { ...PAYLOAD, vagas: [] }, error: null });
      expect(await carga).toBe(true);
      expect(segundo.obter().daCopia).toBe(false);
      expect(segundo.obter().dados.vagas).toHaveLength(0);
    });

    it("sem rede, fica a cópia com a data dela, sem toast nem erro", async () => {
      const armazenamento = memoria();
      await criarEstadoDaSelecao({
        supabase: supabaseFalso({ data: PAYLOAD, error: null }),
        armazenamento,
      }).carregar("saude-indigena");
      await vi.waitFor(() =>
        expect(armazenamento.mapa.has("selecao:saude-indigena")).toBe(true),
      );
      const { guardadoEm } = armazenamento.mapa.get("selecao:saude-indigena");
      toast.mockClear();

      const semRede = criarEstadoDaSelecao({
        supabase: supabaseFalso({
          data: null,
          error: { message: "TypeError: Failed to fetch", code: "" },
        }),
        armazenamento,
        toast,
      });
      expect(await semRede.carregar("saude-indigena")).toBe(false);
      expect(semRede.obter()).toMatchObject({
        carregado: true,
        erroAoCarregar: "",
        copiaDe: guardadoEm,
      });
      expect(semRede.obter().dados.vagas).toHaveLength(2);
      expect(toast).not.toHaveBeenCalled();
    });

    it("acesso revogado apaga a cópia e mostra sem acesso", async () => {
      const armazenamento = memoria();
      await criarEstadoDaSelecao({
        supabase: supabaseFalso({ data: PAYLOAD, error: null }),
        armazenamento,
      }).carregar("saude-indigena");
      await vi.waitFor(() =>
        expect(armazenamento.mapa.size).toBeGreaterThan(0),
      );
      const estado = criarEstadoDaSelecao({
        supabase: supabaseFalso({ data: null, error: { code: "42501" } }),
        armazenamento,
      });
      await estado.carregar("saude-indigena");
      expect(estado.obter().semAcesso).toBe(true);
      expect(estado.obter().carregado).toBe(false);
      expect(armazenamento.mapa.size).toBe(0);
    });
  });
});

bloco("modulos/visao-geral", async () => {
  /*
  A Visão geral como módulo do app (src/modulos/visao-geral/): monta na
  própria `#page-dashboard`, lê as linhas que o legado publica
  (dados-do-monitoramento.ts) recortadas pela área atual; do banco, só os
  marcos do ano, os lugares do mapa de Projetos e o acompanhamento da área
  (etapas do cronograma e resumo das listas). Os mapas
  da área são React: Saúde Indígena e Projetos; a SEDE não tem.
*/

  // O Chart.js não desenha no jsdom (sem canvas): um falso guarda o que recebeu.
  /*
  O SIGEPSI (/api/dseis) simulado: o mapa da Saúde Indígena só desenha com a
  resposta dele. `entregarDoSigepsi` responde; `sigepsi.atual` começa
  "carregando" (o mapa espera), e "indisponivel" mostra o erro.
*/

  function responderDoSigepsi(atual) {
    sigepsi.atual = atual;
    for (const avisar of sigepsi.ouvintes) avisar();
  }

  const { criarVisaoGeral } =
    await import("../src/modulos/visao-geral/visao-geral.tsx");
  const { criarCarregadorDeMunicipios } =
    await import("../src/modulos/mapa-de-projetos/carregador.ts");
  const { criarEstadoDaVisaoGeral, CHAVE_DAS_COLUNAS, CHAVE_DOS_FILTROS } =
    await import("../src/modulos/visao-geral/estado.ts");
  // Os mapas chegam por import() (mapas-sob-demanda.tsx): já baixados, montam na hora.
  // O Leaflet é o falso de cada teste (globalThis.L), sem CDN.
  const { carregarMapasDaVisaoGeral } =
    await import("../src/modulos/visao-geral/mapas-sob-demanda.tsx");
  await carregarMapasDaVisaoGeral({ leaflet: async () => {} });

  const ETAPA_PERIGOSA = `"');alert(1);('" <img src=x onerror=alert(1)> d'água`;

  const LINHAS = [
    {
      id: 1,
      CO_AREA: "saude-indigena",
      unidade: "DSEI Xingu",
      edital: "03/2026",
      etapa: "Entrevistas",
      status: "Em Andamento",
      risco: "Alto",
      uf: "MT",
      vagas_total: 10,
      contratados: 4,
      vagas_ociosas: 6,
      inscritos: 80,
      // O atraso não cria crítico; a marcação vem da RPC simulada abaixo.
      data_fim: "2026-09-28",
      cronograma_automatico: true,
      cronograma_dias_para_proxima: 2,
      cronograma_proxima_data: "2026-10-03",
      cronograma_proxima_atividade: "Resultado preliminar das entrevistas",
      cronograma_percentual: 40,
      link_edital: "https://agsus.org.br/03-2026.pdf",
      observacoes: "x".repeat(200),
    },
    {
      id: 2,
      CO_AREA: "saude-indigena",
      unidade: "DSEI Xingu",
      edital: "11/2025",
      etapa: ETAPA_PERIGOSA,
      status: "em andamento",
      risco: "Médio",
      uf: "MT",
      vagas_total: 5,
      contratados: 5,
      vagas_ociosas: 0,
      inscritos: 20,
    },
    {
      id: 3,
      CO_AREA: "saude-indigena",
      unidade: "DSEI Yanomami",
      edital: "01/2026",
      etapa: "Resultado final do Processo Seletivo",
      status: "Concluído",
      risco: "Baixo",
      uf: "RR",
      vagas_total: 8,
      contratados: 8,
      vagas_ociosas: 0,
      inscritos: 40,
      link_edital: "javascript:alert(1)",
    },
    {
      id: 4,
      CO_AREA: "sede",
      unidade: "Sede Brasília",
      edital: "07/2026",
      etapa: "Entrevistas",
      status: "Em Andamento",
      risco: "Baixo",
      uf: "DF",
      vagas_total: 2,
      contratados: 0,
      vagas_ociosas: 2,
      inscritos: 9,
    },
    {
      id: 5,
      CO_AREA: "projetos",
      unidade: "Projeto Mais Médicos",
      edital: "05/2026",
      etapa: "Resultado final do Processo Seletivo",
      status: "Concluído",
      risco: "Baixo",
      uf: "DF",
      vagas_total: 4,
      contratados: 1,
      vagas_ociosas: 3,
      inscritos: 50,
    },
  ];

  function memoria() {
    const mapa = new Map();
    return {
      mapa,
      getItem: (chave) => (mapa.has(chave) ? mapa.get(chave) : null),
      setItem: (chave, valor) => void mapa.set(chave, String(valor)),
    };
  }

  function configuracoesFalsas(valores = {}) {
    const estado = { valores: new Map(Object.entries(valores)) };
    return { assinar: () => () => {}, obter: () => estado };
  }

  let secao;
  let tela;
  let estado;
  let armazenamento;
  const toast = vi.fn();
  const baixar = vi.fn();
  const perfil = { id: "p1", user_id: "u1", nome: "ANA LIMA" };

  async function montar({
    valores = {},
    comPerfil = false,
    supabase = {
      rpc: vi.fn(async (nome) => ({
        data:
          nome === "listar_editais_criticos_manuais"
            ? [
                {
                  monitoramento_id: 1,
                  motivo: "Cronograma suspenso pela diretoria",
                },
              ]
            : nome === "listar_acompanhamento_da_visao_geral_se_mudou"
              ? {}
              : null,
        error: null,
      })),
    },
    comemoracoes = false,
    carregar = true,
    carregadorDeMunicipios,
    aberta = true,
    perfilDaTela = null,
  } = {}) {
    armazenamento ||= memoria();
    estado = criarEstadoDaVisaoGeral({
      armazenamento,
      baixar,
      aberta,
      agora: () => new Date(2026, 9, 1, 9, 30).getTime(),
    });
    secao = document.createElement("section");
    secao.id = "page-dashboard";
    secao.className = "page active";
    document.body.append(secao);
    await act(async () => {
      tela = montarTela(criarVisaoGeral, "page-dashboard", {
        secao,
        estado,
        configuracoes: configuracoesFalsas(valores),
        toast,
        obterPerfil: () => perfilDaTela || (comPerfil ? perfil : null),
        supabase,
        comemoracoesLigadas: () => comemoracoes,
        agora: () => new Date(2026, 9, 1, 9, 30),
        ...(carregadorDeMunicipios ? { carregadorDeMunicipios } : {}),
      });
    });
    if (carregar) await act(async () => publicarLinhasDoMonitoramento(LINHAS));
    return tela;
  }

  const kpi = (chave) =>
    secao.querySelector(`.visao-geral-kpis [data-kpi="${chave}"]`);
  const valorDoKpi = (chave) =>
    kpi(chave)?.querySelector(".ui-kpi-valor")?.textContent;
  // Os críticos ficam em "Pede ação" (layout A), não na faixa das vagas.
  const criticos = () => secao.querySelector('[data-pendencia="criticos"]');
  const linhas = () =>
    secao.querySelectorAll(".visao-geral-tabela tbody tr.visao-geral-linha");
  const botao = (texto, raiz = document) =>
    [...raiz.querySelectorAll("button")].find((b) =>
      b.textContent.trim().startsWith(texto),
    );
  const cabecalhos = () =>
    [...secao.querySelectorAll(".visao-geral-tabela thead th")].map((th) =>
      th.textContent.trim(),
    );

  beforeEach(() => {
    redefinirDadosDoMonitoramento();
    definirAreaAtual("saude-indigena");
    localStorage.clear();
    armazenamento = null;
  });

  afterEach(async () => {
    await act(async () => tela?.raiz?.unmount());
    document.body.innerHTML = "";
    document.documentElement.removeAttribute("data-theme");
    redefinirDadosDoMonitoramento();
    toast.mockClear();
    baixar.mockClear();
    vi.useRealTimers();
  });

  describe("a tela dentro do app", () => {
    it("antes da carga: skeleton nos KPIs e 'Carregando dados…' uma vez só", async () => {
      await montar({ carregar: false });
      expect(secao.querySelector(".ui-tela.visao-geral-tela")).not.toBeNull();
      expect(kpi("vagas").getAttribute("aria-busy")).toBe("true");
      const status = secao.querySelectorAll(".status-discreto");
      expect(status).toHaveLength(1);
      expect(status[0].textContent).toBe("Carregando dados…");
    });

    it("os números da área atual fecham, com os rótulos de Configurações", async () => {
      await montar({
        valores: {
          kpi_vagas_label: "Vagas Imediatas Previstas",
          kpi_contratados_label: "Contratações de Vagas Imediatas + CR",
        },
      });
      await esperar();
      const chaves = [
        ...secao.querySelectorAll(".visao-geral-kpis [data-kpi]"),
      ].map((k) => k.dataset.kpi);
      expect(chaves).toEqual([
        "vagas",
        "contratadas",
        "emSelecao",
        "ociosas",
        "alemDasVagas",
        "inscritos",
      ]);
      expect(valorDoKpi("vagas")).toBe("23");
      expect(valorDoKpi("contratadas")).toBe("17");
      expect(valorDoKpi("emSelecao")).toBe("6");
      expect(valorDoKpi("ociosas")).toBe("0");
      expect(valorDoKpi("alemDasVagas")).toBe("0");
      expect(criticos().textContent).toContain("1 edital");
      expect(valorDoKpi("inscritos")).toBe("140");
      expect(kpi("vagas").textContent).toContain("Vagas Imediatas Previstas");
      // O rótulo antigo (imediatas + CR) não vale para Contratadas.
      expect(kpi("contratadas").textContent).toContain("Contratadas");
      expect(secao.querySelector(".status-discreto").textContent).toBe(
        "Atualizado às 09:30",
      );
    });

    it("o acompanhamento da área chega uma vez por carga: marcações e pós-resultado", async () => {
      const supabase = {
        rpc: vi.fn(async (nome) =>
          nome === "listar_acompanhamento_da_visao_geral_se_mudou"
            ? {
                data: {
                  etapas: [
                    {
                      monitoramento_id: 2,
                      atividade: "Análise",
                      data_inicio: "2026-08-20",
                      data_fim: "2026-09-10",
                    },
                    {
                      monitoramento_id: 2,
                      atividade: "Entrevistas",
                      data_inicio: "2026-10-20",
                      data_fim: "2026-10-25",
                    },
                  ],
                  listas: [
                    {
                      monitoramento_id: 3,
                      aprovados: 8,
                      com_status: 0,
                      contratados: 8,
                      desistentes: 0,
                    },
                  ],
                },
                error: null,
              }
            : {
                data:
                  nome === "listar_editais_criticos_manuais"
                    ? [1, 2].map((id) => ({
                        monitoramento_id: id,
                        motivo: "Cronograma suspenso pela diretoria",
                      }))
                    : null,
                error: null,
              },
        ),
      };
      await montar({ supabase });
      await esperar();
      const pedidos = () =>
        supabase.rpc.mock.calls.filter(
          ([nome]) => nome === "listar_acompanhamento_da_visao_geral_se_mudou",
        );
      expect(pedidos()).toEqual([
        [
          "listar_acompanhamento_da_visao_geral_se_mudou",
          { p_area: "saude-indigena", p_versao: null },
        ],
      ]);
      // Os dois editais foram marcados manualmente; datas não criam críticos.
      expect(criticos().textContent).toContain("2 editais");
      expect(
        secao.querySelector(".visao-geral-pede-acao").textContent,
      ).toContain("Lista sem status");
      // Filtro não pede de novo; outra carga das linhas, sim.
      await act(async () => estado.definirFiltro("uf", ["MT"]));
      await esperar();
      expect(pedidos()).toHaveLength(1);
      await act(async () => publicarLinhasDoMonitoramento([...LINHAS]));
      await esperar();
      expect(pedidos()).toHaveLength(2);
    });

    /*
    A tela fica montada escondida desde o início do app. Fechada (outra página
    aberta), não pede o acompanhamento nem monta mapas e marcos; ao voltar,
    pede o que ficou para trás (19/10/2026: o banco saturou com avaliadores
    que nunca abriam a Visão geral).
  */
    it("escondida desde o início: nada monta nem é pedido até a primeira abertura", async () => {
      const supabase = {
        rpc: vi.fn(async () => ({
          data: { etapas: [], listas: [] },
          error: null,
        })),
      };
      await montar({
        supabase,
        aberta: false,
        comPerfil: true,
        comemoracoes: true,
      });
      await esperar();
      expect(secao.querySelector(".ui-tela.visao-geral-tela")).toBeNull();
      expect(supabase.rpc).not.toHaveBeenCalled();
      await act(async () => estado.definirAberta(true));
      await esperar();
      expect(secao.querySelector(".ui-tela.visao-geral-tela")).not.toBeNull();
      expect(
        supabase.rpc.mock.calls.filter(
          ([nome]) => nome === "listar_acompanhamento_da_visao_geral_se_mudou",
        ),
      ).toHaveLength(1);
    });

    it("fechada, a releitura das linhas não pede o acompanhamento; ao voltar, pede uma vez", async () => {
      const supabase = {
        rpc: vi.fn(async () => ({
          data: { etapas: [], listas: [] },
          error: null,
        })),
      };
      await montar({ supabase });
      await esperar();
      const pedidos = () =>
        supabase.rpc.mock.calls.filter(
          ([nome]) => nome === "listar_acompanhamento_da_visao_geral_se_mudou",
        );
      expect(pedidos()).toHaveLength(1);
      await act(async () => estado.definirAberta(false));
      await act(async () => publicarLinhasDoMonitoramento([...LINHAS]));
      await act(async () => publicarLinhasDoMonitoramento([...LINHAS]));
      await esperar();
      expect(pedidos()).toHaveLength(1);
      // Fechada, a tela continua montada (sem remontar mapas ao voltar).
      expect(secao.querySelector(".ui-tela.visao-geral-tela")).not.toBeNull();
      await act(async () => estado.definirAberta(true));
      await esperar();
      expect(pedidos()).toHaveLength(2);
      // Voltar sem carga nova não pede de novo.
      await act(async () => estado.definirAberta(false));
      await act(async () => estado.definirAberta(true));
      await esperar();
      expect(pedidos()).toHaveLength(2);
    });

    /*
      Revisão de 17/11/2026: o número da linha leva aos dados que o compõem.
      A Lista de aprovados abre no edital, com o status do número; a volta
      destaca a linha; sem os registros, "Origem agregada"; sem acesso à
      tela, o número é texto.
    */
    describe("os números da linha levam aos dados", () => {
      const comLista = () => ({
        rpc: vi.fn(async (nome) => ({
          data:
            nome === "listar_acompanhamento_da_visao_geral_se_mudou"
              ? {
                  listas: [
                    {
                      monitoramento_id: 3,
                      aprovados: 8,
                      com_status: 8,
                      contratados: 8,
                      desistentes: 0,
                    },
                  ],
                }
              : null,
          error: null,
        })),
      });
      const leitor = {
        id: "p2",
        nome: "LEITOR",
        permissoes: { dashboard: "leitor", aprovados: "leitor" },
      };
      const celulaDe = (id, campo) =>
        secao.querySelector(`tr[data-linha="${id}"] td[data-campo="${campo}"]`);

      it("Contratados abre a Lista de aprovados no edital e a volta destaca a linha", async () => {
        const { consumirPedidoDeFiltro } =
          await import("../src/app/pedido-de-filtro.ts");
        const navegar = vi.fn();
        window.navigate = navegar;
        await montar({ supabase: comLista(), perfilDaTela: leitor });
        await esperar();
        const gatilho = celulaDe(3, "contratados").querySelector(
          ".visao-geral-numero-botao",
        );
        expect(gatilho.textContent).toBe("8");
        await clicar(gatilho);
        // O painel do número não abre a gaveta da linha.
        expect(document.querySelector("#visaoGeralGaveta")).toBeNull();
        await clicar(botao("Abrir na Lista de aprovados", secao));
        expect(navegar).toHaveBeenCalledWith("approved");
        expect(consumirPedidoDeFiltro("approved")).toEqual({
          edital: "01/2026",
          editalId: "3",
          metrica: "contratados",
        });
        // Saiu e voltou: a linha de onde saiu se destaca.
        await act(async () => estado.definirAberta(false));
        await act(async () => estado.definirAberta(true));
        expect(estado.obter().destaque?.id).toBe("3");
        delete window.navigate;
      });

      it("só o total, sem a lista: Origem agregada, nunca uma lista vazia", async () => {
        await montar({ supabase: comLista(), perfilDaTela: leitor });
        await esperar();
        // O 03/2026 tem 4 contratados e nenhuma lista vigente.
        await clicar(
          celulaDe(1, "contratados").querySelector(".visao-geral-numero-botao"),
        );
        const painel = celulaDe(1, "contratados").querySelector(
          ".ui-popover-painel",
        );
        expect(painel.textContent).toContain(
          "Origem agregada; detalhe individual não disponível",
        );
        expect(botao("Abrir na Lista de aprovados", painel)).toBeUndefined();
      });

      it("o número mostra a composição: na faixa e na linha", async () => {
        await montar();
        await esperar();
        // Faixa: Vagas imediatas = Contratadas + Em seleção + Ociosas.
        await clicar(kpi("vagas").querySelector(".visao-geral-numero-botao"));
        const faixa = kpi("vagas").querySelector(".visao-geral-composicao");
        expect(faixa.textContent).toContain("Contratadas17");
        expect(faixa.textContent).toContain("Em seleção+ 6");
        expect(faixa.textContent).toContain("Vagas imediatas= 23");
        // Linha: 10 vagas − 4 contratadas = 6 sem contratação.
        await clicar(
          celulaDe(1, "vagas_ociosas").querySelector(
            ".visao-geral-numero-botao",
          ),
        );
        expect(
          celulaDe(1, "vagas_ociosas").querySelector(".visao-geral-composicao")
            .textContent,
        ).toContain("Sem contratação= 6");
        expect(document.querySelector("#visaoGeralGaveta")).toBeNull();
      });

      it("a gaveta traz o Resultado e os avisos abertos do edital; o selo de Atenção leva a eles", async () => {
        const rpc = comLista().rpc;
        const supabase = {
          rpc: vi.fn(async (nome, args) =>
            nome === "listar_avisos_conferencia_se_mudou"
              ? {
                  data: {
                    avisos: [
                      {
                        id: "a1",
                        conferencia: "aprovados_sem_status",
                        gravidade: "ATENCAO",
                        modulo: "aprovados",
                        edital_id: "1",
                        edital: "03/2026",
                        quantidade: 2,
                        situacao: "ABERTO",
                      },
                      {
                        id: "a2",
                        conferencia: "aprovados_sem_status",
                        gravidade: "ATENCAO",
                        modulo: "aprovados",
                        edital_id: "2",
                        edital: "11/2025",
                        quantidade: 1,
                        situacao: "ABERTO",
                      },
                    ],
                  },
                  error: null,
                }
              : nome === "listar_editais_criticos_manuais"
                ? {
                    data: [
                      {
                        monitoramento_id: 1,
                        motivo: "Cronograma suspenso pela diretoria",
                      },
                    ],
                    error: null,
                  }
                : rpc(nome, args),
          ),
        };
        await montar({ supabase });
        await esperar();
        // O selo de Atenção do 03/2026 abre os detalhes nos avisos dele.
        await clicar(
          secao.querySelector(
            'tr[data-linha="1"] [data-acao="avisos-do-edital"]',
          ),
        );
        await esperar();
        const gaveta = document.querySelector("#visaoGeralGaveta");
        expect(gaveta).not.toBeNull();
        const resultado = gaveta.querySelector('[data-section="resultado"]');
        expect(resultado.textContent).toContain("Aprovados—");
        expect(resultado.textContent).toContain(
          "Sem lista de aprovados vigente.",
        );
        // Os avisos chegam por import() (fora do pacote de entrada).
        await vi.waitFor(
          async () => {
            await esperar();
            expect(
              gaveta.querySelector("[data-avisos-do-edital]"),
            ).not.toBeNull();
            expect(
              gaveta.querySelector("[data-avisos-do-edital]").textContent,
            ).toContain("1 aviso");
          },
          { timeout: 8000 },
        );
        const avisos = gaveta.querySelector("[data-avisos-do-edital]");
        expect(
          supabase.rpc.mock.calls.some(
            ([nome, args]) =>
              nome === "listar_avisos_conferencia_se_mudou" &&
              args.p_area === "saude-indigena",
          ),
        ).toBe(true);
        // Só o aviso do edital da linha (o do 11/2025 não entra).
        expect(avisos.textContent).toContain("1 aviso");
        expect(avisos.textContent).not.toContain("2 avisos");
        // Sem ser administrador global, sem o atalho para a central.
        expect(
          avisos.querySelector('[data-acao="abrir-central-de-avisos"]'),
        ).toBeNull();
      });

      it("sem acesso à Lista de aprovados, o número é texto", async () => {
        await montar({
          supabase: comLista(),
          perfilDaTela: { ...leitor, permissoes: { dashboard: "leitor" } },
        });
        await esperar();
        const celula = celulaDe(3, "contratados");
        expect(celula.textContent).toBe("8");
        expect(celula.querySelector("button")).toBeNull();
      });
    });

    it("sem o acompanhamento (erro ou banco sem a função), a página segue só com as linhas", async () => {
      const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
      const supabase = {
        rpc: vi.fn(async () => ({
          data: null,
          error: { code: "PGRST202", message: "função ausente" },
        })),
      };
      await montar({ supabase });
      await esperar();
      expect(criticos()).toBeNull();
      expect(aviso).toHaveBeenCalled();
      // As vagas saem como cada edital publicou, e a tela diz isso.
      expect(kpi("vagas").getAttribute("aria-busy")).toBeNull();
      expect(kpi("vagas").textContent).toContain("sem desconto das reabertas");
      aviso.mockRestore();
    });

    it("o mapa é da área: na Saúde Indígena o cartão do Mapa, em Projetos o mapa, na SEDE nada", async () => {
      await montar();
      // Saúde Indígena: o cartão (o mapa dos DSEIs é a aba Mapa).
      const cartao = secao.querySelector(".visao-geral-cartao-do-mapa");
      expect(cartao).not.toBeNull();
      expect(cartao.textContent).toContain("2 de 34");
      expect(secao.querySelector(".mapa-si")).toBeNull();
      expect(secao.querySelector(".mapa-projetos")).toBeNull();

      await act(async () => definirAreaAtual("projetos"));
      expect(secao.querySelector(".visao-geral-cartao-do-mapa")).toBeNull();
      expect(secao.querySelectorAll(".mapa-projetos")).toHaveLength(1);
      expect(secao.textContent).toContain("Municípios por vagas");
      expect(secao.textContent).not.toContain("Territórios por vagas");

      await act(async () => definirAreaAtual("sede"));
      expect(secao.querySelector(".visao-geral-cartao-do-mapa")).toBeNull();
      expect(secao.querySelector(".visao-geral-mapa")).toBeNull();
    });

    it("troca de área: só os editais dela, e o recorte sai", async () => {
      await montar();
      await act(async () => estado.alternarCriticos());
      await act(async () => definirAreaAtual("sede"));
      expect(valorDoKpi("vagas")).toBe("2");
      expect(estado.obter().atalho).toBe("");
      expect(linhas()).toHaveLength(1);
    });
  });

  describe("filtros e recorte", () => {
    it("Críticos (em Pede ação) recorta pelos marcados manualmente e tira no segundo clique", async () => {
      await montar();
      const alvo = criticos();
      await clicar(alvo);
      expect(estado.obter().atalho).toBe("criticos");
      expect(alvo.getAttribute("aria-pressed")).toBe("true");
      expect(toast).toHaveBeenLastCalledWith("Filtro aplicado: Críticos.");
      expect(linhas()).toHaveLength(1);
      expect(valorDoKpi("vagas")).toBe("10");
      const chip = [...secao.querySelectorAll(".ui-chip")].find((c) =>
        c.textContent.includes("Recorte"),
      );
      expect(chip.textContent).toContain("Críticos");
      await clicar(alvo);
      expect(estado.obter().atalho).toBe("");
      expect(linhas()).toHaveLength(3);
    });

    it("Ano escolhe os editais daquele ano; os filtros ficam guardados no navegador", async () => {
      await montar();
      // Os campos ficam fechados até o botão "Filtros" do cabeçalho.
      expect(secao.querySelector("#visaoGeralFiltroAno")).toBeNull();
      await clicar(botao("Filtros", secao));
      const ano = secao.querySelector("#visaoGeralFiltroAno");
      expect([...ano.options].map((o) => o.value)).toEqual([
        "",
        "2026",
        "2025",
      ]);
      await escolher(ano, "2026");
      expect(estado.obter().filtros.edital).toEqual(["01/2026", "03/2026"]);
      expect(
        JSON.parse(armazenamento.getItem(CHAVE_DOS_FILTROS)).edital,
      ).toEqual(["01/2026", "03/2026"]);
      // Um chip por campo, que tira o filtro.
      const chip = [...secao.querySelectorAll(".ui-chip")].find((c) =>
        c.textContent.includes("Edital"),
      );
      await clicar(chip);
      expect(estado.obter().filtros.edital).toEqual([]);
    });

    it("os filtros guardados voltam e são podados pela área", async () => {
      armazenamento = memoria();
      armazenamento.setItem(
        CHAVE_DOS_FILTROS,
        JSON.stringify({ uf: ["MT", "SP"], unidade: [], risco: ["Alto"] }),
      );
      await montar();
      expect(estado.obter().filtros.uf).toEqual(["MT"]);
      expect(estado.obter().filtros).not.toHaveProperty("risco");
      expect(valorDoKpi("vagas")).toBe("15");
    });

    it("'Mais opções' guarda Fase e UF", async () => {
      await montar();
      await clicar(botao("Filtros", secao));
      const mais = secao.querySelector("#visaoGeralMaisFiltros");
      expect(mais.hidden).toBe(true);
      expect(mais.querySelector("#visaoGeralFiltro-fase")).not.toBeNull();
      expect(mais.querySelector("#visaoGeralFiltro-uf")).not.toBeNull();
      expect(secao.querySelector("#visaoGeralFiltro-risco")).toBeNull();
      await clicar(botao("Mais opções", secao));
      expect(mais.hidden).toBe(false);
    });

    it("'Limpar tudo' zera o recorte", async () => {
      await montar();
      await act(async () => {
        estado.definirFiltro("uf", ["MT"]);
        estado.definirBusca("xingu");
        estado.alternarCriticos();
      });
      await clicar(botao("Limpar tudo", secao));
      expect(estado.obter().filtros.uf).toEqual([]);
      expect(estado.obter().busca).toBe("");
      expect(estado.obter().atalho).toBe("");
      expect(toast).toHaveBeenLastCalledWith("Filtros limpos.");
    });

    it("a busca da tabela vale para a página toda, depois de uma pausa", async () => {
      vi.useFakeTimers();
      await montar();
      const campo = secao.querySelector(".ui-tabela-busca");
      await digitar(campo, "yanomami");
      expect(estado.obter().busca).toBe("");
      await act(async () => vi.advanceTimersByTime(300));
      expect(estado.obter().busca).toBe("yanomami");
      expect(valorDoKpi("vagas")).toBe("8");
      expect(campo.value).toBe("yanomami");
      // A busca vinda do mapa (clique numa CASAI) aparece no campo.
      await act(async () => estado.definirBusca("CASAI Brasília"));
      expect(campo.value).toBe("CASAI Brasília");
    });
  });

  describe("blocos", () => {
    it("sem os blocos repetidos: a semana fica nas boas-vindas e os críticos no indicador", async () => {
      await montar();
      expect(secao.querySelector(".visao-geral-agenda")).toBeNull();
      expect(secao.querySelector(".visao-geral-atencao")).toBeNull();
    });

    it("Em andamento: só as fases com edital aberto; o clique filtra; texto do dado não vira HTML", async () => {
      const alertas = vi.spyOn(window, "alert").mockImplementation(() => {});
      await montar();
      const fases = [
        ...secao.querySelectorAll(".visao-geral-fases .visao-geral-fase-chip"),
      ];
      const nomes = fases.map((b) => b.dataset.fase);
      expect(nomes).toContain("Entrevistas");
      // Sem as vazias e sem as encerradas.
      expect(nomes).not.toContain("Recursos");
      expect(nomes).not.toContain("Cronograma encerrado");
      expect(nomes).not.toContain("Cancelado");
      // "Concluído" pelas datas não afirma o resultado: "com cronograma encerrado".
      expect(
        secao.querySelector(".visao-geral-encerrados").textContent,
      ).toMatch(/com cronograma encerrado/);
      expect(
        secao.querySelector(".visao-geral-encerrados").textContent,
      ).not.toMatch(/concluído/);
      // A etapa perigosa é "Outra" e fica como texto (title) na coluna Fase.
      expect(secao.querySelector("img")).toBeNull();
      const celula = [...secao.querySelectorAll("td")].find(
        (td) => td.title === ETAPA_PERIGOSA,
      );
      expect(celula.textContent).toBe("Outra");
      const entrevistas = fases.find((b) => b.dataset.fase === "Entrevistas");
      await clicar(entrevistas);
      expect(estado.obter().filtros.fase).toEqual(["Entrevistas"]);
      expect(entrevistas.getAttribute("aria-pressed")).toBe("true");
      expect(linhas()).toHaveLength(1);
      expect(toast).toHaveBeenLastCalledWith("Filtro de fase: Entrevistas");
      expect(alertas).not.toHaveBeenCalled();
      alertas.mockRestore();
    });

    it("Pede ação: sem 'Contratação abaixo de 50%' nem 'Desistências' (18/11/2026)", async () => {
      await montar();
      await act(async () =>
        publicarLinhasDoMonitoramento([
          ...LINHAS,
          {
            id: 6,
            CO_AREA: "saude-indigena",
            unidade: "DSEI Leste de Roraima",
            edital: "81/2026",
            status: "Concluído",
            etapa: "Resultado final do Processo Seletivo",
            vagas_total: 83,
            contratados: 1,
            uf: "RR",
          },
        ]),
      );
      const bloco = secao.querySelector(".visao-geral-pede-acao");
      expect(
        bloco.querySelector(
          '[data-pendencia="contratacao_baixa"], [data-pendencia="desistencias"]',
        ),
      ).toBeNull();
      expect(bloco.textContent).not.toContain("Contratação abaixo de");
      expect(bloco.textContent).not.toContain("Desistências");
      expect(valorDoKpi("ociosas")).toBe("82");
    });

    it("Processos por projeto só em Projetos; o clique filtra o projeto", async () => {
      await montar();
      expect(secao.querySelector(".visao-geral-projetos")).toBeNull();
      await act(async () => definirAreaAtual("projetos"));
      const item = secao.querySelector(
        ".visao-geral-projetos .visao-geral-item",
      );
      expect(item.textContent).toContain("Projeto Mais Médicos");
      expect(item.textContent).toContain("0 abertos · 4 vagas · 1 contratada");
      await clicar(item);
      expect(estado.obter().filtros.unidade).toEqual(["Projeto Mais Médicos"]);
      expect(item.getAttribute("aria-pressed")).toBe("true");
    });
  });

  describe("tabela de processos", () => {
    it("linhas da área, link seguro, prazo, cronograma e taxa de ociosas", async () => {
      await montar();
      expect(linhas()).toHaveLength(3);
      const primeira = linhas()[0];
      expect(primeira.querySelector("a.link").getAttribute("href")).toBe(
        "https://agsus.org.br/03-2026.pdf",
      );
      expect(primeira.dataset.urgencia).toBe("danger");
      expect(
        primeira.querySelector(".visao-geral-cronograma").textContent,
      ).toContain("Etapa atrasada há 3 dia(s)");
      expect(primeira.querySelector(".visao-geral-taxa").textContent).toBe(
        "60%",
      );
      // javascript: não vira link.
      const yanomami = [...linhas()].find((tr) =>
        tr.textContent.includes("Yanomami"),
      );
      expect(yanomami.querySelector("a")).toBeNull();
      expect(yanomami.textContent).toContain("Cronograma encerrado");
    });

    it("observação longa abre com 'Ver mais'", async () => {
      // Observações começa desligada; quem a ligou no menu "Colunas" a vê.
      armazenamento = memoria();
      armazenamento.setItem(
        CHAVE_DAS_COLUNAS,
        JSON.stringify(["unidade", "edital", "observacoes"]),
      );
      await montar();
      const ver = botao("Ver mais", linhas()[0]);
      await clicar(ver);
      expect(ver.textContent).toBe("Ver menos");
      expect(ver.getAttribute("aria-expanded")).toBe("true");
    });

    it("o cabeçalho ordena: crescente, decrescente e de volta à fila", async () => {
      await montar();
      const th = () =>
        [...secao.querySelectorAll(".visao-geral-tabela thead th")].find(
          (c) => c.textContent.trim() === "Unidade",
        );
      await clicar(th().querySelector("button"));
      expect(th().getAttribute("aria-sort")).toBe("ascending");
      expect(linhas()[0].textContent).toContain("DSEI Xingu");
      await clicar(th().querySelector("button"));
      expect(th().getAttribute("aria-sort")).toBe("descending");
      expect(linhas()[0].textContent).toContain("Yanomami");
      await clicar(th().querySelector("button"));
      expect(th().getAttribute("aria-sort")).toBe("none");
    });

    it("'Colunas' esconde e mostra, guarda no navegador e não deixa ouvinte para trás", async () => {
      await montar();
      const adicionar = vi.spyOn(document, "addEventListener");
      const remover = vi.spyOn(document, "removeEventListener");
      const abrir = botao("Colunas", secao);
      for (let vez = 0; vez < 3; vez += 1) {
        await clicar(abrir);
        await clicar(abrir);
      }
      const cliques = (spy) =>
        spy.mock.calls.filter(([tipo]) => tipo === "click").length;
      expect(cliques(adicionar)).toBe(cliques(remover));
      adicionar.mockRestore();
      remover.mockRestore();

      await clicar(abrir);
      expect(cabecalhos()).toContain("Fase");
      expect(cabecalhos()).not.toContain("Risco");
      const atencao = [
        ...secao.querySelectorAll(".visao-geral-colunas-menu label"),
      ]
        .find((l) => l.textContent.includes("Atenção"))
        .querySelector("input");
      await clicar(atencao);
      expect(cabecalhos()).not.toContain("Atenção");
      expect(
        JSON.parse(armazenamento.getItem(CHAVE_DAS_COLUNAS)),
      ).not.toContain("atencao");
      // Clique fora fecha o menu.
      await clicar(document.body);
      expect(secao.querySelector(".visao-geral-colunas-menu").hidden).toBe(
        true,
      );
    });

    it("o ⓘ de cada indicador pergunta à Aya sobre aquele número", async () => {
      const { consumirPerguntaParaAAya } =
        await import("../src/app/pergunta-para-a-aya.ts");
      await montar();
      await esperar();
      const info = secao.querySelector('[data-acao="significado-ociosas"]');
      expect(info.getAttribute("aria-label")).toBe("O que significa Ociosas");
      await clicar(info);
      expect(consumirPerguntaParaAAya()).toBe(
        "o que significa ociosas na visao geral",
      );
      // Todos os números da faixa têm o ⓘ; o texto explicativo não está na tela.
      expect(
        secao.querySelectorAll(".visao-geral-kpis .visao-geral-numero-info"),
      ).toHaveLength(6);
    });

    it("conjuntos de colunas: Prazos troca de uma vez, guarda e fica marcado", async () => {
      // Revisão de 17/11/2026: Gestão, Prazos e Contratação, com o seletor e as fixas.
      await montar();
      await clicar(botao("Colunas", secao));
      const prazos = secao.querySelector('[data-preset="prazos"]');
      expect(prazos.getAttribute("aria-pressed")).toBe("false");
      await clicar(prazos);
      expect(cabecalhos()).toEqual([
        "Unidade",
        "Edital",
        "Ciclo",
        "Início",
        "Encerramento",
        "Duração (dias)",
        "Status",
        "Fase",
      ]);
      expect(prazos.getAttribute("aria-pressed")).toBe("true");
      expect(JSON.parse(armazenamento.getItem(CHAVE_DAS_COLUNAS))).toContain(
        "data_fim",
      );
      // Uma coluna a mais pelo seletor: escolha própria, nenhum conjunto marcado.
      const vagas = [
        ...secao.querySelectorAll(".visao-geral-colunas-menu label"),
      ]
        .find((l) => l.textContent.trim() === "Vagas")
        .querySelector("input");
      await clicar(vagas);
      expect(cabecalhos()).toContain("Vagas");
      expect(prazos.getAttribute("aria-pressed")).toBe("false");
    });

    it("colunas padrão para todos: a escolha da v2 não vale; só Observações fica fora", async () => {
      // Pedidos de 13/11/2026: quem guardou colunas antes também passa a ver as
      // do resultado (v2) e Ciclo, 1ª e Última admissão (v3).
      armazenamento = memoria();
      armazenamento.setItem(
        "agsus_visible_cols_v2",
        JSON.stringify(["unidade", "edital", "vagas_total"]),
      );
      await montar();
      expect(cabecalhos()).toEqual([
        "Unidade",
        "Edital",
        "Ciclo",
        "Início",
        "Encerramento",
        "Duração (dias)",
        "Vagas",
        "Inscritos",
        "Aprovados",
        "Contratados",
        "1ª admissão",
        "Última admissão",
        "Aguardando chamada",
        "Sem contratação",
        "Status",
        "Fase",
        "Atenção",
      ]);
    });

    it("Unidade e Edital ficam presas à esquerda; sem Unidade, Edital é a primeira", async () => {
      await montar();
      const th = (rotulo) =>
        [...secao.querySelectorAll(".visao-geral-tabela thead th")].find(
          (c) => c.textContent.trim() === rotulo,
        );
      expect(th("Unidade").className).toContain("visao-geral-fixa");
      expect(th("Unidade").className).not.toContain("visao-geral-fixa-ultima");
      expect(th("Edital").className).toContain("visao-geral-fixa-segunda");
      expect(th("Edital").className).toContain("visao-geral-fixa-ultima");
      expect(th("Vagas").className).not.toContain("visao-geral-fixa");
      const [unidade, edital] = linhas()[0].children;
      expect(unidade.className).toContain("visao-geral-fixa");
      expect(edital.className).toContain("visao-geral-fixa-segunda");

      await act(async () => estado.alternarColuna("unidade", false));
      expect(th("Edital").className).toContain("visao-geral-fixa");
      expect(th("Edital").className).not.toContain("visao-geral-fixa-segunda");
    });

    it("selo de atenção leva o texto inteiro no title; sem recorte, a contagem não repete o total", async () => {
      await montar();
      const selo = secao.querySelector(".visao-geral-motivos .ui-selo");
      expect(selo).not.toBeNull();
      expect(selo.getAttribute("title")).toBe(selo.textContent);
      const contagem = () =>
        secao.querySelector("[data-tabela-contagem]").textContent;
      // "Mostrando 3 de 3 registros" já diz tudo; o total da área só com recorte.
      expect(contagem()).toBe("");
      await act(async () => estado.definirBusca("Yanomami"));
      expect(contagem()).toBe("3 editais na área");
    });

    it("a linha abre os detalhes (clique ou Enter); 'Voltar à linha' fecha e destaca", async () => {
      await montar();
      const primeira = linhas()[0];
      await act(async () =>
        primeira.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        ),
      );
      const gaveta = document.querySelector("#visaoGeralGaveta");
      expect(gaveta.textContent).toContain("03/2026");
      expect(gaveta.textContent).toContain("40% do cronograma");
      expect(
        gaveta.querySelector('a[href="https://agsus.org.br/03-2026.pdf"]'),
      ).not.toBeNull();
      await clicar(botao("Voltar à linha", gaveta));
      expect(document.querySelector("#visaoGeralGaveta")).toBeNull();
      expect(linhas()[0].classList.contains("is-destacada")).toBe(true);
      // O link do edital não abre a gaveta.
      await clicar(linhas()[0].querySelector("a.link"));
      expect(document.querySelector("#visaoGeralGaveta")).toBeNull();
    });

    it("Abrir página do edital fecha a gaveta e vai à página pelo número", async () => {
      const navigate = vi.fn(() => true);
      vi.stubGlobal("navigate", navigate);
      await montar();
      await clicar(linhas()[0]);
      const gaveta = document.querySelector("#visaoGeralGaveta");
      await clicar(gaveta.querySelector('[data-acao="pagina-do-edital"]'));
      expect(document.querySelector("#visaoGeralGaveta")).toBeNull();
      expect(navigate).toHaveBeenCalledWith("edital", { edital: "3-2026" });
      vi.unstubAllGlobals();
    });

    it("a linha do tempo do cronograma abre a do Núcleo", async () => {
      const abrirLinhaDoTempo = vi.fn();
      // Editais no registro das telas (src/app/telas.tsx), como no app.
      registrarTelas({
        nucleo: {
          criar: () => ({
            nome: "Editais",
            conteudo: null,
            render() {},
            estado: { abrirLinhaDoTempo },
          }),
        },
      });
      await montar();
      await clicar(linhas()[0]);
      await clicar(
        botao("Linha do", document.querySelector("#visaoGeralGaveta")),
      );
      expect(abrirLinhaDoTempo).toHaveBeenCalledWith(1);
      registrarTelas({});
    });

    it("busca global: localizar troca o recorte pela linha e a destaca", async () => {
      await montar();
      await act(async () => estado.definirFiltro("uf", ["RR"]));
      await act(async () => estado.localizar(LINHAS[1]));
      expect(estado.obter().filtros.unidade).toEqual(["DSEI Xingu"]);
      expect(estado.obter().filtros.edital).toEqual(["11/2025"]);
      expect(estado.obter().filtros.uf).toEqual([]);
      expect(linhas()).toHaveLength(1);
      expect(linhas()[0].classList.contains("is-destacada")).toBe(true);
    });

    /* 13/11/2026: Exportar abre o montador de relatório; o CSV é um dos formatos. */
    it("Exportar abre o montador; o formato CSV baixa o CSV do recorte", async () => {
      await montar();
      await act(async () => estado.definirFiltro("uf", ["RR"]));
      await clicar(secao.querySelector('[data-acao="exportar"]'));
      // O montador chega por import(), fora do pacote de entrada.
      await vi.waitFor(
        async () => {
          await esperar();
          expect(document.getElementById("visaoGeralRelatorio")).not.toBeNull();
        },
        { timeout: 8000 },
      );
      const montador = document.getElementById("visaoGeralRelatorio");
      const csv = [...montador.querySelectorAll('[role="radio"]')].find(
        (b) => b.textContent.trim() === "CSV",
      );
      await clicar(csv);
      await clicar(document.getElementById("visaoGeralRelatorioGerar"));
      expect(document.getElementById("visaoGeralRelatorio")).toBeNull();
      const [conteudo, nome] = baixar.mock.calls[0];
      expect(nome).toBe("AgSUS_Monitora_SaudeIndigena_20261001.csv");
      expect(conteudo).toContain("DSEI Yanomami");
      expect(conteudo).not.toContain("DSEI Xingu");
    });

    it("recorte sem nenhuma linha não exporta a área inteira", async () => {
      await montar();
      await act(async () => estado.definirBusca("nenhum processo tem isto"));
      expect(linhas()).toHaveLength(0);
      expect(secao.querySelector('[data-acao="exportar"]').disabled).toBe(true);
      estado.exportarCsv();
      expect(baixar).not.toHaveBeenCalled();
    });
  });

  describe("boas-vindas e marcos do ano", () => {
    // As comemorações são da casca; aqui, montadas como ela faz.
    comemoracoesNaPagina();
    it("o cabeçalho saúda quando o perfil e os editais chegaram", async () => {
      await montar({ comPerfil: true });
      const saudacao = secao.querySelector(".visao-geral-saudacao");
      expect(saudacao.textContent).toContain("Bom dia, Ana");
      expect(saudacao.textContent).toMatch(/próximos 7 dias/);
      // O card antigo de boas-vindas saiu (o dos marcos do ano usa a mesma classe).
      expect(
        secao.querySelector(".boas-vindas:not(.marcos-do-ano)"),
      ).toBeNull();
    });

    it("sem perfil, sem saudação (a semana continua)", async () => {
      await montar();
      expect(secao.querySelector(".visao-geral-saudacao-titulo")).toBeNull();
      expect(
        secao.querySelector(".visao-geral-saudacao-semana").textContent,
      ).toMatch(/7 dias/);
    });

    it("primeira leitura em silêncio: o marco já alcançado não é anunciado", async () => {
      const supabase = {
        rpc: vi.fn(async () => ({
          data: { ano: 2026, concluidas_no_ano: 7600 },
          error: null,
        })),
      };
      await montar({ comPerfil: true, supabase, comemoracoes: true });
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledWith("obter_marcos_da_area", {
        p_area: "saude-indigena",
      });
      expect(
        JSON.parse(
          localStorage.getItem("agsus_monitora_marco:ano:u1:saude-indigena"),
        ),
      ).toEqual({ ano: 2026, marco: 7500 });
      await new Promise((resolver) => setTimeout(resolver, 20));
      expect(document.querySelector(".comemoracao")).toBeNull();
      expect(secao.querySelector(".marcos-do-ano")).toBeNull();
    });

    it("marco novo da equipe: só o aviso com os fogos, uma vez, sem card na tela", async () => {
      localStorage.setItem(
        "agsus_monitora_marco:ano:u1:saude-indigena",
        JSON.stringify({ ano: 2026, marco: 5000 }),
      );
      const supabase = {
        rpc: vi.fn(async () => ({
          data: { ano: 2026, concluidas_no_ano: 7600 },
          error: null,
        })),
      };
      await montar({ comPerfil: true, supabase, comemoracoes: true });
      await esperar();
      expect(
        supabase.rpc.mock.calls.filter(
          ([nome]) => nome === "obter_marcos_da_area",
        ),
      ).toHaveLength(1);
      expect(supabase.rpc).toHaveBeenCalledWith("obter_marcos_da_area", {
        p_area: "saude-indigena",
      });
      // Sem card na Visão geral: o fato vai no aviso, com os fogos (o número
      // no céu); o desenho chega por import() (src/app/comemoracao-sob-demanda.ts).
      expect(secao.querySelector(".marcos-do-ano")).toBeNull();
      await vi.waitFor(() =>
        expect(document.querySelector(".comemoracao")).not.toBeNull(),
      );
      expect(document.querySelector(".comemoracao").textContent).toContain(
        "Saúde Indígena: 7.500 análises concluídas em 2026.",
      );
      await act(async () =>
        document.querySelector(".comemoracao__fechar").click(),
      );
    });

    it("comemorações desligadas: nem consulta o banco", async () => {
      const supabase = { rpc: vi.fn() };
      await montar({ comPerfil: true, supabase, comemoracoes: false });
      await esperar();
      expect(supabase.rpc).not.toHaveBeenCalledWith(
        "obter_marcos_da_area",
        expect.anything(),
      );
    });
  });

  describe("regras do código da tela", () => {
    const pasta = "src/modulos/visao-geral";
    const fontes = readdirSync(pasta).map((arquivo) => [
      arquivo,
      readFileSync(`${pasta}/${arquivo}`, "utf8"),
    ]);

    it("sem innerHTML nem dangerouslySetInnerHTML", () => {
      for (const [arquivo, fonte] of fontes) {
        expect(fonte, arquivo).not.toMatch(/innerHTML|dangerouslySetInnerHTML/);
      }
    });

    it("sem MutationObserver e sem atributo de evento em texto", () => {
      for (const [arquivo, fonte] of fontes) {
        expect(fonte, arquivo).not.toContain("MutationObserver");
        expect(fonte, arquivo).not.toMatch(/\son[a-z]+="/);
      }
    });

    it("o legado não guarda mais filtros, KPIs, tabela nem gráfico da página", () => {
      const legado = fonteDoApp();
      for (const nome of [
        "function renderKpis",
        "function renderTable",
        "function renderStatusSummary",
        "function renderChart",
        "function renderMultiUnits",
        "function renderRisks",
        "function exportCSV",
        "filterState",
        "FILTER_CONFIG",
      ])
        expect(legado, nome).not.toContain(nome);
      const html = htmlDaPagina();
      expect(html).toMatch(
        /<section id="page-dashboard" class="page active"><\/section>/,
      );
      for (const id of [
        "monitorRows",
        "kpiCriticosCard",
        "statusChart",
        "filterBody",
      ])
        expect(html, id).not.toContain(`id="${id}"`);
      // Nenhum mapa legado: os dois mapas são React.
      for (const id of ["mapaDaVisaoGeral", "mapaDosProjetos", "map"])
        expect(html, id).not.toContain(`id="${id}"`);
    });
  });

  /*
  O mapa da Saúde Indígena (src/modulos/mapa-saude-indigena/) na aba Mapa
  (src/modulos/mapa/), lendo o estado da Visão geral (as linhas da área
  inteira, sem os filtros dela) e com o DSEI aberto no endereço. Leaflet
  falso, SIGEPSI simulado, sem rede.
*/
  describe("o mapa da Saúde Indígena na aba Mapa", () => {
    const LMAP = {
      dsei: [
        {
          k: "XINGU",
          n: "Xingu",
          lat: -11.5,
          lon: -53.3,
          pop: 8000,
          ufs: ["MT"],
        },
        {
          k: "YANOMAMI",
          n: "Yanomami",
          lat: 2.8,
          lon: -60.7,
          pop: 30000,
          ufs: ["RR", "AM"],
        },
      ],
    };
    const NAC = [["CASAI DF", "", -15.8, -47.9, "BRASILIA", 53]];
    /* O SIGEPSI responde com os DSEIs do LMAP (sede = posição) e a CASAI DF. */
    async function entregarDoSigepsi() {
      const dseis = Object.fromEntries(
        LMAP.dsei.map((d) => [
          d.k,
          {
            nome: d.k,
            polos: [],
            sede: { lat: d.lat, lon: d.lon, uf: d.ufs[0], municipio: "" },
          },
        ]),
      );
      await act(async () => {
        estado.definirDadosDoMapa({ lmap: LMAP });
        responderDoSigepsi({
          estado: "pronto",
          dados: { dseis, casaisNacionais: NAC },
        });
      });
    }
    let leaflet;
    let aba;
    let raizDaAba;
    let irPara;
    const vivo = (id) =>
      leaflet.vivos().find((m) => m.elemento.id === id) || null;
    const bolhas = (mapa) =>
      leaflet
        .desenhadas(mapa, "circleMarker")
        .filter((b) => b.opcoes.interactive !== false);
    const url = () => location.pathname + location.search;

    /* A Visão geral (o estado e as linhas) e, ao lado, a aba Mapa. */
    async function montarMapa() {
      await montar();
      const { criarMapa } = await import("../src/modulos/mapa/mapa.tsx");
      irPara = vi.fn();
      estado.definirLidaPeloMapa(true);
      const mapa = criarMapa({
        estado,
        supabase: null,
        leaflet: async () => {},
        irPara,
        comAcompanhamento: true,
      });
      aba = document.createElement("section");
      aba.id = "page-mapa";
      document.body.append(aba);
      raizDaAba = createRoot(aba);
      await act(async () => raizDaAba.render(mapa.conteudo));
      return mapa;
    }

    beforeEach(() => {
      leaflet = criarLeafletFalso();
      globalThis.L = leaflet.L;
      history.replaceState(null, "", "/saude-indigena/mapa");
    });
    afterEach(async () => {
      await act(async () => raizDaAba?.unmount());
      raizDaAba = null;
      delete globalThis.L;
      responderDoSigepsi({ estado: "carregando", dados: null });
    });

    it("sem o SIGEPSI, mostra o erro e 'Tentar novamente' (sem os dados do banco)", async () => {
      await montarMapa();
      await act(async () => {
        estado.definirDadosDoMapa({ lmap: LMAP });
        responderDoSigepsi({ estado: "indisponivel", dados: null });
      });
      expect(aba.querySelector("#map")).toBeNull();
      const erro = aba.querySelector(".mapa-tela [role='alert']");
      expect(erro.textContent).toContain("o SIGEPSI não respondeu");
      const antes = sigepsi.tentativas;
      await clicar(erro.querySelector("[data-acao='tentar-novamente']"));
      expect(sigepsi.tentativas).toBe(antes + 1);
    });

    it("espera os dados do mapa e desenha um #map só, com a área inteira (sem os filtros da Visão geral)", async () => {
      await montarMapa();
      expect(document.querySelectorAll("#map")).toHaveLength(1);
      expect(aba.querySelector(".mapa-si-lista__esqueleto")).not.toBeNull();
      await entregarDoSigepsi();
      expect(bolhas(vivo("map"))).toHaveLength(2);
      const territorios = [...aba.querySelectorAll(".mapa-si-territorio")];
      expect(
        territorios.map((t) => t.querySelector("strong").textContent),
      ).toEqual(["Xingu", "Yanomami"]);
      // Filtro da Visão geral (UF RR) não recorta o Mapa.
      await act(async () => estado.definirFiltro("uf", ["RR"]));
      expect(
        aba.querySelector(".mapa-si-territorio .mapa-si-territorio__vagas b")
          .textContent,
      ).toBe("15");
    });

    it("a bolha abre o DSEI no endereço; 'Voltar ao Brasil' sai dele, sem recortar a Visão geral", async () => {
      await montarMapa();
      await entregarDoSigepsi();
      const xingu = bolhas(vivo("map")).find((b) => b.latlng[0] === -11.5);
      await act(async () => xingu.fire("click"));
      expect(url()).toBe("/saude-indigena/mapa/xingu");
      expect(vivo("detailMap")).not.toBeNull();
      expect(document.querySelectorAll("#detailMap")).toHaveLength(1);
      expect(aba.textContent).toContain("Mapa do DSEI Xingu");
      // A Visão geral não é recortada (o recorte por DSEI saiu com o mapa).
      expect(estado.obter().temRecorte).toBe(false);

      await clicar(aba.querySelector(".mapa-si-voltar"));
      expect(url()).toBe("/saude-indigena/mapa");
      expect(vivo("detailMap")).toBeNull();
    });

    it("o link com o DSEI abre o mapa já no distrito", async () => {
      history.replaceState(null, "", "/saude-indigena/mapa/yanomami");
      await montarMapa();
      await entregarDoSigepsi();
      expect(vivo("detailMap")).not.toBeNull();
      expect(aba.textContent).toContain("Mapa do DSEI Yanomami");
    });

    it("a CASAI nacional leva à Visão geral com a busca pela cidade", async () => {
      await montarMapa();
      await entregarDoSigepsi();
      const [casai] = leaflet.desenhadas(vivo("map"), "marker");
      await act(async () => casai.fire("click"));
      expect(estado.obter().busca).toBe("CASAI BRASILIA");
      expect(irPara).toHaveBeenCalledWith("dashboard");
    });

    it("trocar de área destrói o mapa da Saúde Indígena (cleanup do Leaflet)", async () => {
      await montarMapa();
      await entregarDoSigepsi();
      expect(vivo("map")).not.toBeNull();
      await act(async () => definirAreaAtual("sede"));
      expect(vivo("map")).toBeNull();
      expect(aba.querySelector("#map")).toBeNull();
      expect(aba.textContent).toContain("Saúde Indígena");
    });
  });

  /*
  A Etapa 5, parte 3: o mapa de Projetos (src/modulos/mapa-de-projetos/)
  ligado na Visão geral. Pede os lugares pelo carregador da tela depois da
  primeira carga da página (`carregadoEm`) e some fora de Projetos.
*/
  describe("o mapa de Projetos na Visão geral", () => {
    let leaflet;
    const vivo = (id) =>
      leaflet.vivos().find((m) => m.elemento.id === id) || null;

    function carregadorFalso() {
      const supabase = {
        auth: {
          getSession: async () => ({
            data: { session: { access_token: "teste" } },
            error: null,
          }),
        },
        rpc: vi.fn(async () => ({
          data: [
            {
              municipio_uf: "Irati/PR",
              uf: "PR",
              vagas: 5,
              candidatos: 70,
              projetos: ["Projeto Agora Tem Especialistas Caminhoneiros"],
            },
          ],
          error: null,
        })),
      };
      return {
        supabase,
        carregador: criarCarregadorDeMunicipios({
          obterSupabase: () => supabase,
        }),
      };
    }

    beforeEach(() => {
      leaflet = criarLeafletFalso();
      globalThis.L = leaflet.L;
    });
    afterEach(() => {
      delete globalThis.L;
    });

    it("só depois da carga pede os lugares, uma vez, e desenha o ponto e a lista", async () => {
      const { supabase, carregador } = carregadorFalso();
      await act(async () => definirAreaAtual("projetos"));
      await montar({ carregar: false, carregadorDeMunicipios: carregador });
      expect(vivo("mapaDosProjetos")).not.toBeNull();
      expect(supabase.rpc).not.toHaveBeenCalled();

      await act(async () => publicarLinhasDoMonitoramento(LINHAS));
      await esperar();
      expect(supabase.rpc).toHaveBeenCalledTimes(1);
      expect(supabase.rpc).toHaveBeenCalledWith(
        "listar_municipios_das_vagas_da_area",
        { p_area: "projetos" },
      );
      expect(
        leaflet.desenhadas(vivo("mapaDosProjetos"), "circleMarker"),
      ).toHaveLength(1);
      expect(
        secao.querySelector(".mapa-projetos-lugar strong").textContent,
      ).toBe("Irati/PR");

      // Trocar de área desmonta o mapa (remove do Leaflet); voltar usa o cache.
      await act(async () => definirAreaAtual("sede"));
      expect(leaflet.vivos()).toHaveLength(0);
      await act(async () => definirAreaAtual("projetos"));
      await esperar();
      expect(vivo("mapaDosProjetos")).not.toBeNull();
      expect(supabase.rpc).toHaveBeenCalledTimes(1);
    });

    it("os filtros da página recortam o mapa, como no da Saúde Indígena", async () => {
      const { supabase, carregador } = carregadorFalso();
      supabase.rpc.mockResolvedValue({
        data: [
          {
            municipio_uf: "Irati/PR",
            uf: "PR",
            vagas: 5,
            editais: [
              { id: 5, edital: "05/2026", projeto: "Projeto Mais Médicos" },
            ],
          },
          {
            municipio_uf: "Seropédica/RJ",
            uf: "RJ",
            vagas: 12,
            editais: [{ id: 77, edital: "99/2026", projeto: "Outro" }],
          },
        ],
        error: null,
      });
      await act(async () => definirAreaAtual("projetos"));
      await montar({ carregadorDeMunicipios: carregador });
      await esperar();
      const lugares = () =>
        [...secao.querySelectorAll(".mapa-projetos-lugar strong")].map(
          (nome) => nome.textContent,
        );
      expect(lugares()).toEqual(["Seropédica/RJ", "Irati/PR"]);

      // A busca deixa só o edital 05/2026 (linha 5): só Irati fica no mapa.
      await act(async () => estado.definirBusca("Mais Médicos"));
      expect(lugares()).toEqual(["Irati/PR"]);
      expect(
        leaflet.desenhadas(vivo("mapaDosProjetos"), "circleMarker"),
      ).toHaveLength(1);

      await act(async () => estado.definirBusca(""));
      expect(lugares()).toEqual(["Seropédica/RJ", "Irati/PR"]);
    });
  });
});

bloco("modulos/avaliacao-documental-fila-renders", () => {
  /*
  Quanto a Fila redesenha e reconta numa lista do tamanho do 114/2026 (7.726
  inscritos): selecionar uma linha, trocar um filtro, abrir e fechar o menu
  da coordenação, uma mensagem do estado e a releitura parcial. As linhas da
  tabela contam por `Celula` (uma por coluna de cada linha desenhada) e as
  recontagens da lista inteira pelas funções que elas chamam por inscrito:
  `podeIncluirPorDecisao` (os de fora do lote, para "Incluir por decisão"),
  `loteDaFila` (o lote do resumo) e `acoesDaSelecao` (o menu).
*/

  const EU = "u-ana";
  const TOTAL = 7726;
  const VAGAS = Array.from({ length: 12 }, (_, i) => ({
    codigo: String(180000 + i),
    cargo: `Cargo ${i + 1}`,
  }));
  const SITUACOES = ["PENDENTE", "EM_ANALISE", "CONCLUIDA"];

  function candidato(i) {
    const vaga = VAGAS[i % VAGAS.length].codigo;
    const noLote = i < 1800;
    return {
      id: `c-${i}`,
      vaga,
      codigo: String(100000 + i),
      nome: `Pessoa ${i}`,
      situacao_pre: noLote ? "NO_LOTE" : i % 3 ? "ELIMINADO" : "FORA_LOTE",
      motivo_eliminacao: noLote || !(i % 3) ? null : "Documento ausente",
      posicao: noLote ? i + 1 : null,
      lote: noLote ? 1 : null,
      art: 10 + (i % 40),
      modalidade: i % 5 ? "AC" : "PCD",
      ficha: noLote
        ? {
            id: `f-${i}`,
            versao: 1,
            situacao: SITUACOES[i % SITUACOES.length],
            responsavel: i % 4 ? null : EU,
            responsavel_nome: i % 4 ? null : "Ana",
            reserva: null,
            resultado: i % 3 === 2 ? "APTO" : null,
          }
        : null,
    };
  }

  function dadosDaFila() {
    return {
      schema_version: 1,
      edital: { id: "e114", rotulo: "114/2026" },
      papel: "COORDENADOR",
      pode_coordenar: true,
      pode_pegar: true,
      eu: EU,
      prazo_reserva_min: 15,
      distribuicao: { modo: "PEGAR_PROXIMO", criterio: "PARTES_IGUAIS" },
      sem_ficha: 0,
      vagas: VAGAS,
      analistas: [{ usuario: EU, nome: "Ana", vagas: null, limite: null }],
      filtros: [],
      candidatos: Array.from({ length: TOTAL }, (_, i) => candidato(i)),
    };
  }

  /* O banco falso: a primeira leitura é inteira; as seguintes, só o que mudou. */
  function supabaseFalso() {
    const base = dadosDaFila();
    let mudou = [];
    let leituras = 0;
    const supabase = {
      rpc: vi.fn(async (nome, args) => {
        if (nome !== "obter_fila_avaliacao_desde")
          return { data: null, error: null };
        leituras += 1;
        if (!args.p_desde)
          return {
            data: { ...base, gerado_em: "t0", marca: "m1", parcial: false },
            error: null,
          };
        const { vagas: _v, candidatos: _c, ...resto } = base;
        return {
          data: {
            ...resto,
            gerado_em: `t${leituras}`,
            marca: "m1",
            parcial: true,
            candidatos: mudou,
            saiu: [],
            total_nucleo: base.candidatos.length,
          },
          error: null,
        };
      }),
      auth: { getSession: async () => ({ data: { session: null } }) },
    };
    return {
      supabase,
      base,
      mudar: (linhas) => {
        mudou = linhas;
      },
    };
  }

  let raiz;
  let caixa;
  let estado;
  let banco;

  async function montar() {
    banco = supabaseFalso();
    estado = criarEstadoDaFila({
      supabase: banco.supabase,
      toast: () => {},
      armazenamento: null,
      sessao: null,
      agendar: () => 0,
      cancelar: () => {},
    });
    caixa = document.createElement("div");
    document.body.append(caixa);
    raiz = createRoot(caixa);
    await act(async () => {
      raiz.render(
        createElement(Fila, {
          e: { editalId: "e114", dados: { regra: null } },
          fila: estado,
        }),
      );
    });
    await esperar();
  }

  const contas = () => ({
    fila: renders.de("Fila"),
    tabela: renders.de("TabelaDaFila"),
    celulas: renders.de("Celula"),
    podeIncluir: telaDaPre.podeIncluirPorDecisao.mock.calls.length,
    lote: libDaFila.loteDaFila.mock.calls.length,
    acoes: libDaFila.acoesDaSelecao.mock.calls.length,
    resumoDaVaga: libDaFila.resumoDaVagaNaFila.mock.calls.length,
  });
  function zerar() {
    renders.zerar();
    vi.clearAllMocks();
  }
  /* Mede uma interação: as contagens e o tempo (só informativo, no console). */
  async function medir(nome, interacao) {
    zerar();
    const inicio = performance.now();
    await interacao();
    const ms = Math.round(performance.now() - inicio);
    const r = contas();
    console.info(`[fila-renders] ${nome}: ${JSON.stringify({ ...r, ms })}`);
    return r;
  }
  const linhasNaTela = () =>
    caixa.querySelectorAll(
      "[data-tour='avd-fila-tabela'] tbody tr[data-candidato]",
    );
  const caixaDaLinha = (i) =>
    linhasNaTela()[i].querySelector("input[type='checkbox']");
  const colunasPorLinha = () =>
    linhasNaTela()[0].querySelectorAll("td[data-coluna]").length;

  beforeEach(async () => {
    await montar();
  });
  afterEach(async () => {
    await act(async () => raiz.unmount());
    caixa.remove();
  });

  describe("Fila com 7.726 inscritos: redesenhos e recontagens", () => {
    it("monta com a lista inteira e 50 linhas na tabela", () => {
      expect(linhasNaTela()).toHaveLength(50);
      expect(estado.obter().dados.candidatos).toHaveLength(TOTAL);
    });

    it("selecionar 1 linha redesenha só essa linha e não reconta a lista", async () => {
      const r = await medir("selecionar 1 linha", () =>
        clicar(caixaDaLinha(0)),
      );
      expect(caixaDaLinha(0).checked).toBe(true);
      expect(r.fila).toBe(1);
      expect(r.tabela).toBe(1);
      // Só as células da linha marcada (antes: as 50 linhas inteiras).
      expect(r.celulas).toBe(colunasPorLinha());
      expect(r.podeIncluir).toBe(0);
      expect(r.lote).toBe(0);
      // O cabeçalho do grupo usa o resumo da vaga já calculado.
      expect(r.resumoDaVaga).toBe(0);
      expect(r.acoes).toBe(1);
      expect(banco.supabase.rpc).not.toHaveBeenCalled();
    });

    it("trocar um filtro (responsável) não reconta o lote nem os de fora do lote", async () => {
      const r = await medir("trocar filtro (responsável)", () =>
        escolher(
          [...caixa.querySelectorAll(".avd-fila-filtros select")][1],
          "eu",
        ),
      );
      expect(estado.obter().filtro.responsavel).toBe("eu");
      expect(r.podeIncluir).toBe(0);
      expect(r.lote).toBe(0);
      expect(r.acoes).toBe(0);
      expect(r.resumoDaVaga).toBe(0);
      // As linhas que continuam na tela (aqui, o primeiro grupo inteiro) não redesenham.
      expect(r.celulas).toBe(0);
      expect(banco.supabase.rpc).not.toHaveBeenCalled();
    });

    it("abrir e fechar o menu da coordenação não redesenha a tabela", async () => {
      const menu = () =>
        caixa.querySelector(
          "[data-tour='avd-fila-acoes-coordenacao'] [data-acao='abrir-menu']",
        );
      const r = await medir("abrir e fechar o menu", async () => {
        await clicar(menu());
        await clicar(menu());
      });
      expect(r.tabela).toBe(0);
      expect(r.celulas).toBe(0);
      expect(r.podeIncluir).toBe(0);
      expect(banco.supabase.rpc).not.toHaveBeenCalled();
    });

    it("uma ação da coordenação sem mudar a lista não redesenha as linhas", async () => {
      // "Abrir fichas do lote": publica st.acao, chama o banco e relê só o que mudou (nada).
      const r = await medir("ação + releitura sem mudança", async () => {
        await act(async () => {
          await estado.abrirFichasDoLote();
        });
        await esperar();
      });
      expect(r.celulas).toBe(0);
      // Uma recontagem só (a da lista relida), não uma por mensagem do estado.
      expect(r.tabela).toBe(1);
      // A inclusão por decisão saiu da Fila (fica na Triagem): nada a recontar.
      expect(r.podeIncluir).toBe(0);
      expect(r.lote).toBe(1);
    });

    it("releitura parcial com 1 inscrito mudado redesenha só a linha dele", async () => {
      const primeiro = estado.obter().dados.candidatos[0];
      banco.mudar([{ ...primeiro, nome: "Nome novo" }]);
      const r = await medir("releitura parcial (1 mudou)", async () => {
        await act(async () => {
          await estado.carregar("e114");
        });
        await esperar();
      });
      expect(caixa.textContent).toContain("Nome novo");
      expect(r.tabela).toBe(1);
      // A lista mudou: recontar o lote é devido, mas as linhas iguais ficam.
      expect(r.celulas).toBe(colunasPorLinha());
      // A inclusão por decisão saiu da Fila (fica na Triagem): nada a recontar.
      expect(r.podeIncluir).toBe(0);
    });
  });
});

bloco("modulos/aya-suporte-sem-varrer", async () => {
  /*
  22/10: o link "Feedback e suporte" do topo da Aya varria o DOM da página
  (collectAyaPageContext) a cada render, ou seja, a cada tecla no campo.
  Agora varre quando a conversa ou a página mudam e de novo no clique.
*/

  const { Aya } = await import("../src/modulos/aya/aya.tsx");
  const { definirPaginaDaAya, redefinirPaginaDaAya } =
    await import("../src/modulos/aya/estado.ts");

  let raiz;
  let controlador;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    redefinirDadosDoMonitoramento();
    definirAreasDoUsuario(["sede"]);
    definirAreaAtual("sede");
    redefinirPaginaDaAya();
    definirPaginaDaAya("recursos", "Painel de recursos");
  });
  afterEach(async () => {
    await act(async () => controlador?.desmontar());
    raiz?.remove();
  });

  describe("Aya: suporte sem varrer a página a cada tecla", () => {
    it("digitar não varre; o clique no suporte varre e atualiza o link", async () => {
      raiz = document.createElement("div");
      document.body.append(raiz);
      await act(async () => {
        controlador = desenharNoTeste(
          raiz,
          createElement(Aya, {
            perguntar: vi.fn(),
            navegar: vi.fn(),
            abrirSecao: vi.fn(),
            configuracao: (chave) =>
              chave === "support_email" ? "suporte@agenciasus.org.br" : "",
          }),
        );
      });
      await clicar(raiz.querySelector(".aya-arara"));
      const campo = raiz.querySelector("textarea");
      const antes = varrer.vezes;
      await digitar(campo, "c");
      await digitar(campo, "co");
      await digitar(campo, "com");
      expect(varrer.vezes).toBe(antes);

      const suporte = raiz.querySelector(".aya-painel__acoes .aya-suporte");
      suporte.addEventListener("click", (e) => e.preventDefault());
      await clicar(suporte);
      expect(varrer.vezes).toBe(antes + 1);
      expect(suporte.getAttribute("href")).toContain("suporte");
    });
  });
});

bloco("modulos/palco-de-testes-parado-escondido", async () => {
  /*
  22/10: Configurações monta no carregamento do app e a miniatura do palco de
  Comemorações animava o canvas para sempre, mesmo com a seção fechada. Agora
  o laço só anda com o canvas à vista (IntersectionObserver).
*/

  const { PalcoDeTestes } =
    await import("../src/modulos/configuracoes/palco-de-testes.tsx");

  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  let vigias;
  let raiz;
  let host;
  beforeEach(() => {
    vigias = [];
    window.IntersectionObserver = class {
      constructor(aoMudar) {
        this.aoMudar = aoMudar;
        this.desligado = false;
        vigias.push(this);
      }
      observe() {}
      disconnect() {
        this.desligado = true;
      }
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      setTransform() {},
      clearRect() {},
    });
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(7);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    host = document.createElement("div");
    document.body.append(host);
  });
  afterEach(async () => {
    await act(async () => raiz?.unmount());
    host.remove();
    delete window.IntersectionObserver;
    vi.restoreAllMocks();
  });

  describe("miniatura do palco de testes", () => {
    it("escondida não anima; à vista anda; escondida de novo para", async () => {
      await act(async () => {
        raiz = createRoot(host);
        raiz.render(createElement(PalcoDeTestes, { testar: () => {} }));
      });
      expect(vigias).toHaveLength(1);
      expect(window.requestAnimationFrame).not.toHaveBeenCalled();

      vigias[0].aoMudar([{ isIntersecting: true }]);
      expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);

      vigias[0].aoMudar([{ isIntersecting: false }]);
      expect(window.cancelAnimationFrame).toHaveBeenCalledWith(7);

      await act(async () => raiz.unmount());
      raiz = null;
      expect(vigias[0].desligado).toBe(true);
    });
  });
});

bloco("frontend-performance-carona", () => {
  /*
  O retrato de desempenho do front (frontend_performance) vai de carona na
  batida da presença quando ela está ligada (src/app/sistema.ts), sem chamada
  própria; sem ela, numa chamada à parte, como antes.
*/

  const rpc = vi.fn(async () => ({ data: 1, error: null }));

  /*
    A simulação do cliente vale só para este bloco (`vi.doMock`, não
    `vi.mock`): no topo do arquivo ela valeria para as telas dos outros blocos.
  */
  let PERFORMANCE_REPORT_DELAY_MS;
  let definirEnvioDoRetrato;
  let eventoDoRetrato;
  let installFrontendPerformanceMonitor;
  beforeAll(async () => {
    vi.resetModules();
    vi.doMock("../src/lib/sessao/supabaseClient", () => ({
      getSupabaseClient: () => ({
        rpc,
        auth: {
          getSession: async () => ({
            data: { session: { user: { id: "u1" } } },
          }),
        },
      }),
    }));
    ({
      PERFORMANCE_REPORT_DELAY_MS,
      definirEnvioDoRetrato,
      eventoDoRetrato,
      installFrontendPerformanceMonitor,
    } = await import("../src/lib/carga/frontend-performance-monitor"));
  });
  afterAll(() => {
    vi.doUnmock("../src/lib/sessao/supabaseClient");
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    definirEnvioDoRetrato(null);
  });

  describe("retrato de desempenho de carona", () => {
    it("o evento é o de sempre: origem, aba e versão do monitor", () => {
      expect(eventoDoRetrato({ x: 1 })).toEqual({
        evento: "frontend_performance",
        tela: "monitora",
        origem: "frontend",
        detalhes: { x: 1 },
        client_session_id: "performance-monitor",
        app_version: "frontend-performance-v1",
      });
    });

    it("com o envio de carona ligado, não chama o banco por conta própria", async () => {
      vi.useFakeTimers();
      const envio = vi.fn();
      definirEnvioDoRetrato(envio);
      installFrontendPerformanceMonitor();
      await vi.advanceTimersByTimeAsync(PERFORMANCE_REPORT_DELAY_MS);
      expect(envio).toHaveBeenCalledTimes(1);
      expect(envio.mock.calls[0][0]).toMatchObject({
        evento: "frontend_performance",
        origem: "frontend",
        client_session_id: "performance-monitor",
      });
      expect(rpc).not.toHaveBeenCalled();
    });
  });
});

bloco("ui/grafico-acessivel", () => {
  const DADOS = {
    labels: ["Cancelados", "Questionário", "Nota"],
    datasets: [{ label: "Eliminados", data: [1200, 35, 0] }],
  };
  let raiz = null;
  afterEach(() => {
    act(() => raiz?.unmount());
    raiz = null;
    document.body.innerHTML = "";
  });

  async function montarCard() {
    const caixa = document.createElement("div");
    document.body.append(caixa);
    raiz = createRoot(caixa);
    await act(async () =>
      raiz.render(
        createElement(
          CardDeGrafico,
          { titulo: "Eliminados" },
          createElement(Grafico, {
            tipo: "bar",
            rotulo: "Eliminados antes da análise",
            dependencias: [],
            montar: () => ({ data: DADOS }),
          }),
        ),
      ),
    );
    return caixa;
  }

  it("tabela dos valores: linhas são os rótulos e colunas as séries, em número brasileiro", () => {
    expect(dadosDaTabelaDoGrafico(DADOS)).toEqual({
      colunas: ["Eliminados"],
      linhas: [
        { rotulo: "Cancelados", valores: ["1.200"] },
        { rotulo: "Questionário", valores: ["35"] },
        { rotulo: "Nota", valores: ["0"] },
      ],
    });
    const duas = dadosDaTabelaDoGrafico({
      labels: [["Jan", "2026"], "Fev"],
      datasets: [{ data: [1.5, null] }, { label: "Aptos", data: [2] }],
    });
    expect(duas?.colunas).toEqual(["Série 1", "Aptos"]);
    expect(duas?.linhas).toEqual([
      { rotulo: "Jan 2026", valores: ["1,5", "2"] },
      { rotulo: "Fev", valores: ["—", "—"] },
    ]);
    expect(dadosDaTabelaDoGrafico({ labels: [], datasets: [] })).toBeNull();
  });

  it("o anúncio do item: rótulo e valor (com a série quando há nome)", () => {
    const uma = dadosDaTabelaDoGrafico({
      labels: ["Sim", "Não"],
      datasets: [{ data: [3, 4] }],
    });
    expect(textoDoPonto(uma, 1)).toBe("Não: 4");
    expect(textoDoPonto(dadosDaTabelaDoGrafico(DADOS), 0)).toBe(
      "Cancelados: Eliminados 1.200",
    );
  });

  it("as setas dão a volta; Home e End vão às pontas", () => {
    expect(proximoDestaque(null, "+1", 3)).toBe(0);
    expect(proximoDestaque(null, "-1", 3)).toBe(2);
    expect(proximoDestaque(2, "+1", 3)).toBe(0);
    expect(proximoDestaque(0, "-1", 3)).toBe(2);
    expect(proximoDestaque(1, "inicio", 3)).toBe(0);
    expect(proximoDestaque(1, "fim", 3)).toBe(2);
  });

  it("tabela escondida para o leitor de tela; o botão Tabela a mostra no lugar do gráfico", async () => {
    const caixa = await montarCard();
    const tabela = caixa.querySelector("[data-tabela-do-grafico]");
    expect(tabela.className).toBe("sr-only");
    expect(tabela.querySelector("caption").textContent).toBe(
      "Eliminados antes da análise",
    );
    expect(
      [...tabela.querySelectorAll("tbody tr")].map((tr) => tr.textContent),
    ).toEqual(["Cancelados1.200", "Questionário35", "Nota0"]);
    const botao = caixa.querySelector(".ui-grafico-alternar");
    expect(botao.textContent).toBe("Tabela");
    expect(botao.getAttribute("aria-pressed")).toBe("false");
    await clicar(botao);
    expect(botao.getAttribute("aria-pressed")).toBe("true");
    expect(caixa.querySelector("[data-tabela-do-grafico]").className).toBe(
      "ui-grafico-tabela",
    );
    expect(caixa.querySelector("canvas").hidden).toBe(true);
    expect(caixa.querySelector(".ui-grafico.is-em-tabela")).not.toBeNull();
  });

  it("o canvas entra no Tab; as setas destacam e anunciam o item", async () => {
    const caixa = await montarCard();
    const canvas = caixa.querySelector("canvas");
    expect(canvas.tabIndex).toBe(0);
    expect(canvas.getAttribute("role")).toBe("img");
    const vivo = caixa.querySelector('[aria-live="polite"]');
    const grafico = graficos.at(-1);
    await teclar(canvas, "ArrowRight");
    expect(vivo.textContent).toBe("Cancelados: Eliminados 1.200");
    expect(grafico.ativos).toEqual([{ datasetIndex: 0, index: 0 }]);
    await teclar(canvas, "End");
    expect(vivo.textContent).toBe("Nota: Eliminados 0");
    await teclar(canvas, "Escape");
    expect(vivo.textContent).toBe("");
    expect(grafico.ativos).toEqual([]);
  });

  it("card sem Grafico dentro não ganha o botão", async () => {
    const caixa = document.createElement("div");
    document.body.append(caixa);
    raiz = createRoot(caixa);
    await act(async () =>
      raiz.render(
        createElement(CardDeGrafico, { titulo: "T" }, createElement("canvas")),
      ),
    );
    expect(caixa.querySelector(".ui-grafico-alternar")).toBeNull();
  });
});
