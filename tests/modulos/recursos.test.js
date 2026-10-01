import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clicar,
  digitar,
  escolher,
  esperar,
} from "../componentes/interacoes.js";

/*
  O painel de recursos (recursos.html) em React, com a marcação do painel de
  análises: carga ao montar (skeleton de análises antes), consulta só de
  leitura para quem não edita, cadastro com o candidato das análises
  (autopreenchimento), aviso de duplicado, etapa marcada pela gaveta, KPI que
  filtra e o gráfico Chart.js de recursos por analista.
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

const { montarPainelDeRecursos } =
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
  situacao: "EM_ANALISE",
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

let raiz;
let painel;
const toast = vi.fn();
const baixar = vi.fn();

async function montar(supabase) {
  raiz = document.createElement("div");
  document.body.append(raiz);
  await act(async () => {
    painel = montarPainelDeRecursos({
      raiz,
      supabase,
      area: "saude-indigena",
      nomeDaArea: "Saúde Indígena",
      toast,
      baixar,
    });
  });
  await esperar();
  return painel;
}

const naTela = (texto) => document.body.textContent.includes(texto);
const botao = (texto) =>
  [...document.querySelectorAll("button")].find((b) =>
    b.textContent.trim().startsWith(texto),
  );
const kpi = (chave) => document.querySelector(`#kpiGrid [data-kpi="${chave}"]`);
const esperarBusca = () =>
  esperar(() => new Promise((ok) => setTimeout(ok, 350)));

afterEach(async () => {
  await act(async () => painel?.raiz?.unmount());
  raiz?.remove();
  document.body.innerHTML = "";
  document.body.className = "";
  delete document.documentElement.dataset.theme;
  localStorage.clear();
  toast.mockClear();
  baixar.mockClear();
});

describe("a cara do painel de análises", () => {
  it("topbar, filtros, KPIs, blocos e fila com as classes de análises", async () => {
    await montar(supabaseFalso());
    expect(document.querySelector("#topbar.topbar h1").textContent).toBe(
      "Painel de recursos",
    );
    expect(document.querySelector("#topbar .sub").textContent).toBe(
      "Saúde Indígena",
    );
    for (const id of ["themeBtn", "fullBtn", "refreshBtn", "exportBtn"])
      expect(document.getElementById(id), id).not.toBeNull();
    expect(document.getElementById("exportBtn").className).toBe("btn green");
    // O botão de cadastro fica no topo, ao lado de Atualizar e Exportar.
    expect(
      document.querySelector("#topbar .top-actions #novoRecursoBtn"),
    ).not.toBeNull();

    const filtros = document.querySelector("section.panel.filter-panel");
    // Sem eyebrow nem texto de ajuda: só o título (quem explica é a Aya).
    expect(filtros.querySelector(".eyebrow")).toBeNull();
    expect(filtros.querySelector(".hint")).toBeNull();
    expect(filtros.querySelector("h2.title").textContent).toBe(
      "Refinar resultados",
    );
    expect(document.getElementById("filterSummary").textContent).toBe(
      "Todos · nenhum filtro adicional",
    );
    expect(botao("Ocultar filtros")).toBeTruthy();

    expect(document.querySelectorAll("#kpiGrid > article.kpi")).toHaveLength(8);
    expect(kpi("prazo-vencido").className).toContain("k-red");
    expect(document.getElementById("contextLine").className).toBe(
      "context-line",
    );
    expect(document.querySelectorAll(".panel .eyebrow")).toHaveLength(0);
    expect(
      [...document.querySelectorAll(".panel h2.title")].map((e) =>
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
    expect(
      document.querySelector(".table-card .table-head h2.title").textContent,
    ).toBe("Fila de recursos");
    // Sem rodapé institucional (Agência ©, Atualizado, SECURE) desde 30/09/2026.
    expect(document.querySelector("footer.footer")).toBeNull();
  });

  it("recursos por analista é o Chart.js de barras empilhadas de análises", async () => {
    await montar(supabaseFalso());
    const grafico = graficos.find(
      (g) => g.canvas.id === "chartAnalista" && g.canvas.isConnected,
    );
    expect(grafico.config.type).toBe("bar");
    expect(grafico.data.labels).toEqual(["Carla"]);
    expect(grafico.data.datasets.map((d) => d.label)).toEqual([
      "Em análise",
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

  it("o botão de tema troca para o escuro, guarda a escolha e redesenha os gráficos", async () => {
    await montar(supabaseFalso());
    const grafico = graficos.find(
      (g) => g.canvas.id === "chartAnalista" && g.canvas.isConnected,
    );
    const antes = grafico.atualizacoes;
    await clicar(document.getElementById("themeBtn"));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("agsus_analises_theme_v3")).toBe("dark");
    expect(grafico.atualizacoes).toBeGreaterThan(antes);
    expect(grafico.options.scales.y.ticks.color).toBe("#dbe8f5");
  });
});

describe("carga", () => {
  it("pede ao banco ao montar, com a área do painel; antes do dado, o skeleton de análises", async () => {
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
    expect(supabase.rpc).toHaveBeenCalledWith("get_recursos_da_area", {
      p_area: "saude-indigena",
    });
    expect(document.body.classList.contains("analises-is-loading")).toBe(true);
    expect(document.querySelectorAll("#tableBody > tr")).toHaveLength(8);

    await esperar(() => responder({ data: payload(), error: null }));
    expect(document.body.classList.contains("analises-is-loading")).toBe(false);
    expect(document.getElementById("recursosContagem").textContent).toBe(
      "1 recurso",
    );
    expect(kpi("total").querySelector("b").textContent).toBe("1");
    // Prazo vencido (22/09) e nota que mudou (50 → 55) viram pendência.
    expect(naTela("Prazo de resposta vencido")).toBe(true);
    expect(naTela("Mudança de nota ou classificação")).toBe(true);
    expect(document.getElementById("updatedText").textContent).toMatch(
      /^Atualizado em 20\/09\/2026/,
    );
  });

  it("falha na primeira carga mostra o aviso de erro de análises, com “Tentar novamente”", async () => {
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
    expect(naTela("Seu acesso não inclui os recursos desta área.")).toBe(true);
    falhar = false;
    await clicar(botao("Tentar novamente"));
    await esperar();
    expect(document.getElementById("recursosContagem").textContent).toBe(
      "1 recurso",
    );
  });

  it("sem sessão do Supabase Auth, avisa e não pede os recursos", async () => {
    const supabase = supabaseFalso({
      auth: { getSession: async () => ({ data: { session: null } }) },
    });
    await montar(supabase);
    expect(document.getElementById("authWarning").textContent).toContain(
      "Sessão não localizada",
    );
    expect(supabase.rpc).not.toHaveBeenCalledWith(
      "get_recursos_da_area",
      expect.anything(),
    );
    expect(document.body.classList.contains("analises-is-loading")).toBe(false);
  });
});

describe("filtros", () => {
  it("o KPI filtra o painel e o recorte ativo diz o quê; clicar de novo tira", async () => {
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
    expect(kpi("prazo-vencido").className).toContain("is-active");
    expect(document.getElementById("contextLine").textContent).toBe(
      "Recorte ativo: Pendência: Prazo de resposta vencido",
    );
    expect(document.getElementById("recursosContagem").textContent).toBe(
      "1 de 2",
    );
    expect(document.getElementById("filterSummary").textContent).toBe(
      "Todos · 1 filtro adicional",
    );
    await clicar(botaoDoKpi);
    expect(document.getElementById("recursosContagem").textContent).toBe(
      "2 recursos",
    );
  });

  it("Exportar baixa o CSV do recorte, com a área no nome", async () => {
    await montar(supabaseFalso());
    await clicar(document.getElementById("exportBtn"));
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
    [...document.querySelectorAll("#tableBody .recursos-no-prazo")].map((s) => [
      s.textContent,
      s.classList.contains("aprovado"),
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
    const gaveta = document.querySelector(".recursos-gaveta");
    expect(gaveta).not.toBeNull();
    expect(gaveta.querySelector(".analises-drawer")).not.toBeNull();
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
    expect(form.classList.contains("analises-drawer")).toBe(true);
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

  it("cada campo tem o rótulo ligado ao controle (.field de análises)", async () => {
    const form = await abrirNovo(supabaseFalso());
    const edital = form.querySelector("select[name=edital_id]");
    expect(edital.closest(".field")).not.toBeNull();
    expect(form.querySelector(`label[for="${edital.id}"]`).textContent).toBe(
      "Edital *",
    );
  });

  it("outro recurso em análise do mesmo candidato, edital e origem: avisa e só grava confirmando", async () => {
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
    expect(naTela("Já existe o recurso nº 7 em análise")).toBe(true);
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
    expect(naTela("Já existe o recurso nº 9 em análise")).toBe(true);
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
  it("é a gaveta de análises e quem edita marca a etapa, que entra na hora", async () => {
    const supabase = supabaseFalso();
    await montar(supabase);
    await clicar(document.querySelector(".recursos-linha"));
    await esperar();
    const gaveta = document.querySelector(".recursos-gaveta");
    expect(gaveta.classList.contains("analises-drawer-backdrop")).toBe(true);
    expect(gaveta.querySelector(".analises-drawer-head h2").textContent).toBe(
      "Ana Ribeiro",
    );
    expect(
      [...gaveta.querySelectorAll(".analises-detail-section-head")].map((h) =>
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
      document.querySelector(".recursos-gaveta input[name=download_empregare]")
        .checked,
    ).toBe(true);
  });
});
