import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  definirAreaAtual,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.ts";
import { EVENTO_TEMA_ALTERADO } from "../../src/lib/eventos-da-barra-lateral.js";
import { clicar, digitar, esperar, teclar } from "../componentes/interacoes.js";

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
const graficos = vi.hoisted(() => []);
vi.mock("../../src/lib/chartjs-global.js", () => ({
  Chart: class {
    constructor(canvas, configuracao) {
      this.canvas = canvas;
      this.config = configuracao;
      this.data = configuracao.data;
      this.options = configuracao.options;
      this.plugins = configuracao.plugins;
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

const { montarSelecao } = await import("../../src/modulos/selecao/selecao.tsx");
const { criarEstadoDaSelecao } =
  await import("../../src/modulos/selecao/estado.ts");

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
    painel = montarSelecao({
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
const recorte = () => secao.querySelector("[data-recorte]").textContent;
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
    expect(supabase.rpc).toHaveBeenCalledWith("get_selecao_da_area", {
      p_area: "saude-indigena",
    });
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
    ).toEqual(["Atualizar", "Exportar"]);
    expect(topo.querySelector('[aria-label*="tema"]')).toBeNull();
    expect(topo.querySelector('[aria-label*="tela cheia"]')).toBeNull();
    // "Conferido …": a última carga, discreta e uma vez só.
    expect(status().textContent).toBe("Conferido em 01/10, 09:02");
    expect(document.querySelectorAll(".status-discreto")).toHaveLength(1);
    expect(document.body.textContent.match(/Conferido em \d/g)).toHaveLength(1);
    for (const texto of [
      "AgSUS Monitora Recrutamento e Seleção",
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
    expect(document.body.classList.contains("analises-is-loading")).toBe(false);
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

  it("sem filtros, o recorte diz só 'Sem filtros'", async () => {
    await montar(supabaseFalso({ data: PAYLOAD, error: null }));
    expect(recorte()).toBe("Sem filtros");
  });

  it("mostra os alertas da coluna Observação como texto", async () => {
    await montar(supabaseFalso({ data: PAYLOAD, error: null }));
    const alertas = secao.querySelector(".selecao-observacoes");
    expect(alertas.textContent).toContain("Alertas identificados no recorte");
    const item = alertas.querySelector("[data-observacao]");
    expect(item.querySelector("b").textContent).toBe("<b>1 Interessado</b>");
    expect(item.textContent).toContain("1 vaga · DSEI Xingu · Edital 06/2026");
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
    expect(medidor.options.plugins.selecaoTextoNoCentro.principal).toBe("25%");
    expect(medidor.options.plugins.selecaoTextoNoCentro.secundario).toBe(
      "2 de 8 aprovados",
    );
    expect(grafico("chartEliminados").data.datasets[0].data).toEqual([2, 9, 0]);
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
      expect(grafico("chartDsei").options.scales.x.ticks.color).toBe("#123456");
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
    await clicar(secao.querySelector('[data-acao="exportar"]'));
    expect(baixar).toHaveBeenCalledTimes(1);
    const [conteudo, nome] = baixar.mock.calls[0];
    expect(nome).toMatch(/^selecao-saude-indigena-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(conteudo).toContain("DSEI Xingu");
    expect(conteudo).not.toContain("Caminhoneiros");
    expect(conteudo).toContain("Entrevistas do MONITORA");
  });

  it("sem vagas no recorte, Exportar fica desativado", async () => {
    await montar(
      supabaseFalso({ data: { ...PAYLOAD, vagas: [] }, error: null }),
    );
    expect(secao.querySelector('[data-acao="exportar"]').disabled).toBe(true);
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
    expect(supabase.rpc).toHaveBeenLastCalledWith("get_selecao_da_area", {
      p_area: "sede",
    });
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
    expect(supabase.rpc).toHaveBeenLastCalledWith("get_selecao_da_area", {
      p_area: "projetos",
    });
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
      "Sessão não localizada. Entre de novo no MONITORA.",
    );
    expect(status().textContent).toBe("Sessão não localizada");
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(secao.querySelector(".selecao-kpis")).toBeNull();
    expect(secao.querySelector('[data-acao="atualizar"]').disabled).toBe(true);
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
    expect(secao.querySelectorAll(".ui-grafico.is-carregando")).toHaveLength(5);
    expect(
      secao.querySelectorAll('.ui-tabela tbody tr[aria-hidden="true"]'),
    ).toHaveLength(8);
    expect(secao.querySelector("#filtro-unidades").disabled).toBe(true);
    expect(status().textContent).toBe("Carregando dados...");

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

  it("acesso revogado apaga a cópia e mostra sem acesso", async () => {
    const armazenamento = memoria();
    await criarEstadoDaSelecao({
      supabase: supabaseFalso({ data: PAYLOAD, error: null }),
      armazenamento,
    }).carregar("saude-indigena");
    await vi.waitFor(() => expect(armazenamento.mapa.size).toBeGreaterThan(0));
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
