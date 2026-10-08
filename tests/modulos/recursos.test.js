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
  A tela de Recursos como módulo do app (src/modulos/recursos/): monta na
  própria `#page-recursos`, carrega a área atual do app quando o legado abre a
  tela (`render()`), segue o tema do app, usa o aviso global e os componentes
  de src/ui/ (classes .ui-*). Consulta só de leitura para quem não edita,
  cadastro com o candidato das análises (autopreenchimento), aviso de
  duplicado, etapa marcada pela gaveta, KPI que filtra e os gráficos Chart.js.
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

const { montarRecursos } =
  await import("../../src/modulos/recursos/recursos.jsx");

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
    { id: "e2", edital: "30/2026", unidade: "DSEI Bahia", tem_analises: false },
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
          c.candidato.toLowerCase().includes(argumentos.p_busca.toLowerCase()),
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
    painel = montarRecursos({ supabase, toast, baixar, ...opcoes });
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
const contagem = () => document.querySelector(".recursos-contagem").textContent;
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
    ).toEqual(["Atualizar", "Exportar", "Novo recurso"]);
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
    expect(document.body.classList.contains("analises-is-loading")).toBe(false);
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
    await montar(supabase);
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
        getSession: async () => ({ data: { session: { user: { id: "a" } } } }),
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
    expect(secao.querySelectorAll(".ui-grafico.is-carregando")).toHaveLength(4);
    expect(
      secao.querySelectorAll('.ui-tabela tbody tr[aria-hidden="true"]'),
    ).toHaveLength(8);
    expect(status().textContent).toBe("Carregando dados...");

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
      "Sessão não localizada. Entre de novo no MONITORA.",
    );
    expect(supabase.rpc).not.toHaveBeenCalledWith(
      "get_recursos_da_area",
      expect.anything(),
    );
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

  it("“Mais opções” mostra a busca em toda a tela, que vira filtro", async () => {
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
    await clicar(document.querySelector('[data-acao="exportar"]'));
    expect(baixar).toHaveBeenCalledTimes(1);
    const [conteudo, nome] = baixar.mock.calls[0];
    expect(conteudo).toContain("Ana Ribeiro");
    expect(nome).toMatch(/^recursos-saude-indigena-\d{4}-\d{2}-\d{2}\.csv$/);
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
    [...document.querySelectorAll(".ui-tabela .recursos-no-prazo")].map((s) => [
      s.textContent,
      s.dataset.tom === "sucesso",
    ]);

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
    await montar(supabase);
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
    await montar(supabaseFalso());
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
    await montar(supabase);
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
    await montar(supabase);
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
