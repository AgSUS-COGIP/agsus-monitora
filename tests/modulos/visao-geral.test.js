import { readdirSync, readFileSync } from "node:fs";
import { fonteDoApp } from "../fonte-do-app.js";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  definirAreaAtual,
  publicarLinhasDoMonitoramento,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.js";
import {
  clicar,
  digitar,
  escolher,
  esperar,
} from "../componentes/interacoes.js";
import { criarLeafletFalso } from "./leaflet-falso.js";

/*
  A Visão geral como módulo do app (src/modulos/visao-geral/): monta na
  própria `#page-dashboard`, lê as linhas que o legado publica
  (dados-do-monitoramento.js) recortadas pela área atual; do banco, só os
  marcos do ano, os lugares do mapa de Projetos e o acompanhamento da área
  (etapas do cronograma e resumo das listas). Os mapas
  da área são React: Saúde Indígena e Projetos; a SEDE não tem.
*/

// O Chart.js não desenha no jsdom (sem canvas): um falso guarda o que recebeu.
const graficos = vi.hoisted(() => []);
vi.mock("../../src/lib/chartjs-global.js", () => ({
  Chart: class {
    constructor(canvas, configuracao) {
      this.canvas = canvas;
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

const { montarVisaoGeral } =
  await import("../../src/modulos/visao-geral/visao-geral.jsx");
const { criarCarregadorDeMunicipios } =
  await import("../../src/modulos/mapa-de-projetos/carregador.js");
const { criarEstadoDaVisaoGeral, CHAVE_DAS_COLUNAS, CHAVE_DOS_FILTROS } =
  await import("../../src/modulos/visao-geral/estado.js");

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
    // Crítico por atraso (etapa chegando não faz crítico).
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
  supabase = null,
  comemoracoes = false,
  carregar = true,
  carregadorDeMunicipios,
} = {}) {
  armazenamento ||= memoria();
  estado = criarEstadoDaVisaoGeral({
    armazenamento,
    baixar,
    agora: () => new Date(2026, 9, 1, 9, 30).getTime(),
  });
  secao = document.createElement("section");
  secao.id = "page-dashboard";
  secao.className = "page active";
  document.body.append(secao);
  await act(async () => {
    tela = montarVisaoGeral({
      secao,
      estado,
      configuracoes: configuracoesFalsas(valores),
      toast,
      obterPerfil: () => (comPerfil ? perfil : null),
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
  it("antes da carga: skeleton nos KPIs e 'Carregando dados...' uma vez só", async () => {
    await montar({ carregar: false });
    expect(secao.querySelector(".ui-tela.visao-geral-tela")).not.toBeNull();
    expect(kpi("vagas").getAttribute("aria-busy")).toBe("true");
    const status = secao.querySelectorAll(".status-discreto");
    expect(status).toHaveLength(1);
    expect(status[0].textContent).toBe("Carregando dados...");
  });

  it("os sete KPIs da área atual fecham, com os rótulos de Configurações", async () => {
    await montar({
      valores: {
        kpi_vagas_label: "Vagas Imediatas Previstas",
        kpi_contratados_label: "Contratações de Vagas Imediatas + CR",
      },
    });
    const chaves = [
      ...secao.querySelectorAll(".visao-geral-kpis [data-kpi]"),
    ].map((k) => k.dataset.kpi);
    expect(chaves).toEqual([
      "vagas",
      "contratadas",
      "emSelecao",
      "ociosas",
      "cadastroReserva",
      "criticos",
      "inscritos",
    ]);
    expect(valorDoKpi("vagas")).toBe("23");
    expect(valorDoKpi("contratadas")).toBe("17");
    expect(valorDoKpi("emSelecao")).toBe("6");
    expect(valorDoKpi("ociosas")).toBe("0");
    expect(valorDoKpi("cadastroReserva")).toBe("0");
    expect(valorDoKpi("criticos")).toBe("1");
    expect(valorDoKpi("inscritos")).toBe("140");
    expect(kpi("vagas").textContent).toContain("Vagas Imediatas Previstas");
    // O rótulo antigo (imediatas + CR) não vale para Contratadas.
    expect(kpi("contratadas").textContent).toContain("Contratadas");
    expect(secao.querySelector(".status-discreto").textContent).toBe(
      "Atualizado às 09:30",
    );
  });

  it("o acompanhamento da área chega uma vez por carga: parado e pós-resultado", async () => {
    const supabase = {
      rpc: vi.fn(async (nome) =>
        nome === "listar_acompanhamento_da_visao_geral"
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
          : { data: null, error: null },
      ),
    };
    await montar({ supabase });
    await esperar();
    const pedidos = () =>
      supabase.rpc.mock.calls.filter(
        ([nome]) => nome === "listar_acompanhamento_da_visao_geral",
      );
    expect(pedidos()).toEqual([
      ["listar_acompanhamento_da_visao_geral", { p_area: "saude-indigena" }],
    ]);
    // 11/2025: sem etapa em curso desde 11/09 → parado há 20 dias.
    expect(valorDoKpi("criticos")).toBe("2");
    expect(
      secao.querySelector(".visao-geral-pos-resultado").textContent,
    ).toContain("Lista sem status");
    // Filtro não pede de novo; outra carga das linhas, sim.
    await act(async () => estado.definirFiltro("uf", ["MT"]));
    await esperar();
    expect(pedidos()).toHaveLength(1);
    await act(async () => publicarLinhasDoMonitoramento([...LINHAS]));
    await esperar();
    expect(pedidos()).toHaveLength(2);
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
    expect(valorDoKpi("criticos")).toBe("1");
    expect(aviso).toHaveBeenCalled();
    aviso.mockRestore();
  });

  it("o mapa é da área: Saúde Indígena e Projetos em React, SEDE nenhum", async () => {
    await montar();
    // Saúde Indígena: o componente dos DSEIs.
    expect(secao.querySelectorAll(".mapa-si")).toHaveLength(1);
    expect(secao.querySelector(".mapa-projetos")).toBeNull();

    await act(async () => definirAreaAtual("projetos"));
    expect(secao.querySelectorAll(".mapa-si")).toHaveLength(1);
    expect(secao.querySelectorAll(".mapa-projetos")).toHaveLength(1);
    expect(secao.textContent).toContain("Municípios por vagas");
    expect(secao.textContent).not.toContain("Territórios por vagas");

    await act(async () => definirAreaAtual("sede"));
    expect(secao.querySelector(".mapa-si")).toBeNull();
    expect(secao.querySelector(".visao-geral-mapa")).toBeNull();
  });

  it("troca de área: só os editais dela, e o DSEI aberto e o recorte saem", async () => {
    await montar();
    await act(async () => estado.definirDsei("xingu", "DSEI Xingu"));
    await act(async () => estado.alternarCriticos());
    await act(async () => definirAreaAtual("sede"));
    expect(valorDoKpi("vagas")).toBe("2");
    expect(estado.obter().dsei.chave).toBe("");
    expect(estado.obter().atalho).toBe("");
    expect(linhas()).toHaveLength(1);
  });
});

describe("filtros e recorte", () => {
  it("o KPI Críticos recorta pelos críticos calculados e tira no segundo clique", async () => {
    await montar();
    const alvo = kpi("criticos").querySelector("button");
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
    const ano = secao.querySelector("#visaoGeralFiltroAno");
    expect([...ano.options].map((o) => o.value)).toEqual(["", "2026", "2025"]);
    await escolher(ano, "2026");
    expect(estado.obter().filtros.edital).toEqual(["01/2026", "03/2026"]);
    expect(JSON.parse(armazenamento.getItem(CHAVE_DOS_FILTROS)).edital).toEqual(
      ["01/2026", "03/2026"],
    );
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
    const mais = secao.querySelector("#visaoGeralMaisFiltros");
    expect(mais.hidden).toBe(true);
    expect(mais.querySelector("#visaoGeralFiltro-fase")).not.toBeNull();
    expect(mais.querySelector("#visaoGeralFiltro-uf")).not.toBeNull();
    expect(secao.querySelector("#visaoGeralFiltro-risco")).toBeNull();
    await clicar(botao("Mais opções", secao));
    expect(mais.hidden).toBe(false);
  });

  it("'Limpar tudo' zera o recorte e o mapa volta ao Brasil", async () => {
    await montar();
    await act(async () => {
      estado.definirFiltro("uf", ["MT"]);
      estado.definirBusca("xingu");
      estado.definirDsei("xingu", "DSEI Xingu");
      estado.alternarCriticos();
    });
    // O chip do DSEI sai do território, sem limpar o resto.
    const chipDoDsei = [...secao.querySelectorAll(".ui-chip")].find((c) =>
      c.textContent.includes("DSEI Xingu"),
    );
    await clicar(chipDoDsei);
    expect(estado.obter().dsei.chave).toBe("");
    expect(estado.obter().filtros.uf).toEqual(["MT"]);
    expect(estado.obter().busca).toBe("xingu");
    await act(async () => estado.definirDsei("xingu", "DSEI Xingu"));
    await clicar(botao("Limpar tudo", secao));
    expect(estado.obter().filtros.uf).toEqual([]);
    expect(estado.obter().busca).toBe("");
    expect(estado.obter().atalho).toBe("");
    expect(estado.obter().dsei.chave).toBe("");
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

  it("Fases: fixas, o clique filtra a fase; texto vindo do dado não vira HTML", async () => {
    const alertas = vi.spyOn(window, "alert").mockImplementation(() => {});
    await montar();
    const fases = [
      ...secao.querySelectorAll(".visao-geral-fases .visao-geral-item"),
    ];
    expect(fases.map((b) => b.dataset.fase)).toEqual([
      "Edital",
      "Inscrições",
      "Análise curricular",
      "Recursos",
      "Entrevistas",
      "Resultado",
      "Contratação",
      "Concluído",
      "Outra",
    ]);
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
    // Fase sem edital não filtra.
    expect(fases.find((b) => b.dataset.fase === "Recursos").disabled).toBe(
      true,
    );
    expect(alertas).not.toHaveBeenCalled();
    alertas.mockRestore();
  });

  it("Pós-resultado: contratação abaixo de 50% filtra; sem pendência, estado vazio", async () => {
    await montar();
    expect(
      secao.querySelector(".visao-geral-pos-resultado").textContent,
    ).toContain("Nenhuma pendência.");
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
    const item = secao.querySelector(
      '.visao-geral-pos-resultado [data-pendencia="contratacao_baixa"]',
    );
    expect(item.textContent).toContain("Contratação abaixo de 50%");
    expect(item.textContent).toContain("1 edital");
    await clicar(item);
    expect(estado.obter().atalho).toBe("pos:contratacao_baixa");
    expect(linhas()).toHaveLength(1);
    expect(valorDoKpi("ociosas")).toBe("82");
  });

  it("Processos por projeto só em Projetos; o clique filtra o projeto", async () => {
    await montar();
    expect(secao.querySelector(".visao-geral-projetos")).toBeNull();
    await act(async () => definirAreaAtual("projetos"));
    const item = secao.querySelector(".visao-geral-projetos .visao-geral-item");
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
    expect(primeira.querySelector(".visao-geral-taxa").textContent).toBe("60%");
    // javascript: não vira link.
    const yanomami = [...linhas()].find((tr) =>
      tr.textContent.includes("Yanomami"),
    );
    expect(yanomami.querySelector("a")).toBeNull();
    expect(yanomami.textContent).toContain("Processo concluído");
  });

  it("observação longa abre com 'Ver mais'", async () => {
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
    expect(JSON.parse(armazenamento.getItem(CHAVE_DAS_COLUNAS))).not.toContain(
      "atencao",
    );
    // Clique fora fecha o menu.
    await clicar(document.body);
    expect(secao.querySelector(".visao-geral-colunas-menu").hidden).toBe(true);
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
    expect(gaveta.textContent).toContain("40% concluído");
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

  it("a linha do tempo do cronograma abre a do Núcleo", async () => {
    const abrirLinhaDoTempo = vi.fn();
    window.nucleoController = { estado: { abrirLinhaDoTempo } };
    await montar();
    await clicar(linhas()[0]);
    await clicar(
      botao("Linha do", document.querySelector("#visaoGeralGaveta")),
    );
    expect(abrirLinhaDoTempo).toHaveBeenCalledWith(1);
    delete window.nucleoController;
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

  it("Exportar baixa o CSV do recorte", async () => {
    await montar();
    await act(async () => estado.definirFiltro("uf", ["RR"]));
    await clicar(secao.querySelector('[data-acao="exportar"]'));
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
  it("saúda quando o perfil e os editais chegaram, sem botão de fechar", async () => {
    await montar({ comPerfil: true });
    const card = secao.querySelector(".boas-vindas");
    expect(card.textContent).toContain("Bom dia, Ana");
    expect(card.querySelector('[data-boas-vindas="fechar"]')).toBeNull();
  });

  it("sem perfil, sem card", async () => {
    await montar();
    expect(secao.querySelector(".boas-vindas")).toBeNull();
  });

  it("marco novo da equipe aparece uma vez (comemorações ligadas)", async () => {
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
    const marco = secao.querySelector(".marcos-do-ano");
    expect(marco.textContent).toContain("Saúde Indígena passou de");
    // E os fogos do marco, com o agradecimento à equipe (o número vai no céu).
    expect(document.querySelector(".comemoracao").textContent).toContain(
      "7.500 análises concluídas em 2026. Obrigado, equipe da Saúde Indígena!",
    );
    document.querySelector(".comemoracao__fechar").click();
    await clicar(marco.querySelector("button"));
    expect(secao.querySelector(".marcos-do-ano")).toBeNull();
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
    const html = readFileSync("index.html", "utf8");
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
  A Etapa 5, parte 2: o mapa da Saúde Indígena (src/modulos/mapa-saude-indigena/)
  ligado na Visão geral, lendo o MESMO estado (linhas recortadas, DSEI aberto,
  busca) e pedindo a ele. Leaflet falso, sem rede.
*/
describe("o mapa da Saúde Indígena na Visão geral", () => {
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
  const REDE = {
    rede: {},
    nac: [["CASAI DF", "", -15.8, -47.9, "BRASILIA", 53]],
  };
  let leaflet;
  const vivo = (id) =>
    leaflet.vivos().find((m) => m.elemento.id === id) || null;
  const bolhas = (mapa) =>
    leaflet
      .desenhadas(mapa, "circleMarker")
      .filter((b) => b.opcoes.interactive !== false);

  beforeEach(() => {
    leaflet = criarLeafletFalso();
    globalThis.L = leaflet.L;
  });
  afterEach(() => {
    delete globalThis.L;
  });

  it("espera os dados do mapa e desenha um #map só, com as bolhas do recorte", async () => {
    await montar();
    expect(secao.querySelectorAll("#map")).toHaveLength(1);
    expect(secao.querySelector(".mapa-si-lista__esqueleto")).not.toBeNull();
    await act(async () =>
      estado.definirDadosDoMapa({ lmap: LMAP, redeCnes: REDE }),
    );
    const mapa = vivo("map");
    expect(bolhas(mapa)).toHaveLength(2);
    const territorios = [...secao.querySelectorAll(".mapa-si-territorio")];
    expect(
      territorios.map((t) => t.querySelector("strong").textContent),
    ).toEqual(["Xingu", "Yanomami"]);
    // Filtro da página (UF RR): o ranking segue o recorte.
    await act(async () => estado.definirFiltro("uf", ["RR"]));
    expect(
      secao.querySelector(".mapa-si-territorio .mapa-si-territorio__vagas b")
        .textContent,
    ).toBe("8");
  });

  it("a bolha recorta a página pelo DSEI; 'Voltar ao Brasil' sai sem limpar os filtros", async () => {
    await montar();
    await act(async () =>
      estado.definirDadosDoMapa({ lmap: LMAP, redeCnes: REDE }),
    );
    await act(async () => estado.definirFiltro("uf", ["MT"]));
    const xingu = bolhas(vivo("map")).find((b) => b.latlng[0] === -11.5);
    await act(async () => xingu.fire("click"));
    expect(estado.obter().dsei).toEqual({ chave: "XINGU", nome: "Xingu" });
    expect(valorDoKpi("vagas")).toBe("15");
    // O mapa do DSEI abre no #detailMap; o chip do DSEI aparece nos filtros.
    expect(vivo("detailMap")).not.toBeNull();
    expect(secao.querySelectorAll("#detailMap")).toHaveLength(1);
    expect(secao.textContent).toContain("Mapa do DSEI Xingu");

    await clicar(secao.querySelector(".mapa-si-voltar"));
    expect(estado.obter().dsei.chave).toBe("");
    expect(estado.obter().filtros.uf).toEqual(["MT"]);
    expect(vivo("detailMap")).toBeNull();
  });

  it("o chip DSEI volta ao Brasil com o mesmo voo do botão, sem mexer no foco", async () => {
    await montar();
    await act(async () =>
      estado.definirDadosDoMapa({ lmap: LMAP, redeCnes: REDE }),
    );
    await act(async () => estado.definirDsei("DSEI Xingu", "Xingu"));
    expect(vivo("detailMap")).not.toBeNull();
    const nacional = vivo("map");
    nacional.chamadas.length = 0;
    const chipDoDsei = [...secao.querySelectorAll(".ui-chip")].find((c) =>
      c.textContent.includes("Xingu"),
    );
    chipDoDsei.focus();
    await clicar(chipDoDsei);
    expect(estado.obter().dsei.chave).toBe("");
    expect(vivo("detailMap")).toBeNull();
    const voos = nacional.chamadas.filter(([nome]) => nome === "flyToBounds");
    expect(voos).toHaveLength(1);
    expect(voos[0][2].duration).toBe(0.8);
    expect(document.activeElement?.closest?.(".mapa-si")).toBeFalsy();
  });

  it("o DSEI aberto pelo chip ou por 'Limpar tudo' fecha o mapa do distrito", async () => {
    await montar();
    await act(async () =>
      estado.definirDadosDoMapa({ lmap: LMAP, redeCnes: REDE }),
    );
    await act(async () => estado.definirDsei("DSEI Xingu", "Xingu"));
    expect(vivo("detailMap")).not.toBeNull();
    await clicar(botao("Limpar tudo", secao));
    expect(vivo("detailMap")).toBeNull();
    expect(vivo("map")).not.toBeNull();
  });

  it("a CASAI nacional procura pela cidade na busca da página", async () => {
    await montar();
    await act(async () =>
      estado.definirDadosDoMapa({ lmap: LMAP, redeCnes: REDE }),
    );
    const [casai] = leaflet.desenhadas(vivo("map"), "marker");
    await act(async () => casai.fire("click"));
    expect(estado.obter().busca).toBe("CASAI BRASILIA");
  });

  it("trocar de área destrói o mapa da Saúde Indígena (cleanup do Leaflet)", async () => {
    await montar();
    await act(async () =>
      estado.definirDadosDoMapa({ lmap: LMAP, redeCnes: REDE }),
    );
    expect(leaflet.vivos()).toHaveLength(1);
    await act(async () => definirAreaAtual("projetos"));
    expect(vivo("map")).toBeNull();
    expect(secao.querySelector("#map")).toBeNull();
    // No lugar, o mapa de Projetos (outro Leaflet).
    expect(leaflet.vivos().map((m) => m.elemento.id)).toEqual([
      "mapaDosProjetos",
    ]);
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
    expect(secao.querySelector(".mapa-projetos-lugar strong").textContent).toBe(
      "Irati/PR",
    );

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
