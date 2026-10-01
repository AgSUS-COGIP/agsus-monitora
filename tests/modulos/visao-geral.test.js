import { readdirSync, readFileSync } from "node:fs";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  definirAreaAtual,
  publicarLinhasDoMonitoramento,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.js";
import { EVENTO_TEMA_ALTERADO } from "../../src/lib/eventos-da-barra-lateral.js";
import {
  clicar,
  digitar,
  escolher,
  esperar,
} from "../componentes/interacoes.js";

/*
  A Visão geral como módulo do app (src/modulos/visao-geral/): monta na
  própria `#page-dashboard`, lê as linhas que o legado publica
  (dados-do-monitoramento.js) recortadas pela área atual e não pede nada ao
  banco (fora os marcos do ano). O bloco do mapa é uma folha do legado: a tela
  só reserva o lugar e muda o nó para dentro dele.
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
    cronograma_automatico: true,
    cronograma_dias_para_proxima: 2,
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
let reserva;
let bloco;
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
  reserva = document.createElement("div");
  reserva.hidden = true;
  bloco = document.createElement("div");
  bloco.className = "health-map-workspace";
  bloco.id = "mapaDaVisaoGeral";
  bloco.textContent = "Mapa do legado";
  reserva.append(bloco);
  document.body.append(secao, reserva);
  await act(async () => {
    tela = montarVisaoGeral({
      secao,
      blocoDoMapa: bloco,
      reservaDoMapa: reserva,
      estado,
      configuracoes: configuracoesFalsas(valores),
      toast,
      obterPerfil: () => (comPerfil ? perfil : null),
      supabase,
      comemoracoesLigadas: () => comemoracoes,
      agora: () => new Date(2026, 9, 1, 9, 30),
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
    expect(kpi("processos").getAttribute("aria-busy")).toBe("true");
    const status = secao.querySelectorAll(".status-discreto");
    expect(status).toHaveLength(1);
    expect(status[0].textContent).toBe("Carregando dados...");
  });

  it("os seis KPIs da área atual, com os rótulos de Configurações", async () => {
    await montar({ valores: { kpi_vagas_label: "Vagas imediatas" } });
    expect(valorDoKpi("processos")).toBe("3");
    expect(valorDoKpi("vagas")).toBe("23");
    expect(valorDoKpi("contratados")).toBe("17");
    expect(valorDoKpi("ociosas")).toBe("6");
    expect(valorDoKpi("criticos")).toBe("2");
    expect(valorDoKpi("inscritos")).toBe("140");
    expect(kpi("vagas").textContent).toContain("Vagas imediatas");
    expect(kpi("processos").textContent).toContain("Processos");
    expect(secao.querySelector(".status-discreto").textContent).toBe(
      "Atualizado às 09:30",
    );
  });

  it("o resumo do servidor só vale sem recorte e com a área inteira na base", async () => {
    await montar();
    await act(async () =>
      estado.definirResumoDoServidor({ kpis: { processos_ativos: 99 } }),
    );
    // A base tem uma linha da SEDE: o resumo (de todas as áreas) não serve.
    expect(valorDoKpi("processos")).toBe("3");
    await act(async () =>
      publicarLinhasDoMonitoramento(LINHAS.filter((l) => l.CO_AREA !== "sede")),
    );
    expect(valorDoKpi("processos")).toBe("99");
  });

  it("o bloco do mapa (legado) entra no lugar reservado e volta à reserva ao desmontar", async () => {
    await montar();
    const lugar = secao.querySelector(".visao-geral-mapa");
    expect(lugar.firstChild).toBe(bloco);
    expect(bloco.textContent).toBe("Mapa do legado");
    await act(async () => tela.raiz.unmount());
    expect(reserva.firstChild).toBe(bloco);
    tela = null;
  });

  it("troca de área: só os editais dela, e o DSEI aberto sai", async () => {
    await montar();
    await act(async () => estado.definirDsei("xingu", "DSEI Xingu"));
    await act(async () => definirAreaAtual("sede"));
    expect(valorDoKpi("processos")).toBe("1");
    expect(estado.obter().dsei.chave).toBe("");
    expect(linhas()).toHaveLength(1);
  });
});

describe("filtros e recorte", () => {
  it("o KPI Críticos filtra Médio/Alto e tira no segundo clique", async () => {
    await montar();
    const alvo = kpi("criticos").querySelector("button");
    await clicar(alvo);
    expect(estado.obter().filtros.risco).toEqual(["Alto", "Médio"]);
    expect(alvo.getAttribute("aria-pressed")).toBe("true");
    expect(toast).toHaveBeenLastCalledWith(
      "Filtro aplicado: risco Médio/Alto.",
    );
    expect(valorDoKpi("processos")).toBe("2");
    await clicar(alvo);
    expect(estado.obter().filtros.risco).toEqual([]);
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
      JSON.stringify({ uf: ["MT", "SP"], unidade: [] }),
    );
    await montar();
    expect(estado.obter().filtros.uf).toEqual(["MT"]);
    expect(valorDoKpi("processos")).toBe("2");
  });

  it("'Mais opções' guarda Etapa, Risco e UF", async () => {
    await montar();
    const mais = secao.querySelector("#visaoGeralMaisFiltros");
    expect(mais.hidden).toBe(true);
    expect(mais.querySelector("#visaoGeralFiltro-uf")).not.toBeNull();
    await clicar(botao("Mais opções", secao));
    expect(mais.hidden).toBe(false);
  });

  it("'Limpar tudo' zera o recorte e volta o mapa ao Brasil (pelo legado)", async () => {
    await montar();
    const aoLimpar = vi.fn();
    const sairDoTerritorio = vi.fn();
    await act(async () => estado.ligarMapa({ aoLimpar, sairDoTerritorio }));
    await act(async () => {
      estado.definirFiltro("uf", ["MT"]);
      estado.definirBusca("xingu");
      estado.definirDsei("xingu", "DSEI Xingu");
    });
    // O chip do DSEI sai do território, sem limpar o resto.
    const chipDoDsei = [...secao.querySelectorAll(".ui-chip")].find((c) =>
      c.textContent.includes("DSEI Xingu"),
    );
    await clicar(chipDoDsei);
    expect(sairDoTerritorio).toHaveBeenCalledTimes(1);
    await clicar(botao("Limpar tudo", secao));
    expect(estado.obter().filtros.uf).toEqual([]);
    expect(estado.obter().busca).toBe("");
    expect(estado.obter().dsei.chave).toBe("");
    expect(aoLimpar).toHaveBeenCalledTimes(1);
  });

  it("a busca da tabela vale para a página toda, depois de uma pausa", async () => {
    vi.useFakeTimers();
    await montar();
    const campo = secao.querySelector(".ui-tabela-busca");
    await digitar(campo, "yanomami");
    expect(estado.obter().busca).toBe("");
    await act(async () => vi.advanceTimersByTime(300));
    expect(estado.obter().busca).toBe("yanomami");
    expect(valorDoKpi("processos")).toBe("1");
    expect(campo.value).toBe("yanomami");
    // A busca vinda do mapa (clique numa CASAI) aparece no campo.
    await act(async () => estado.definirBusca("CASAI Brasília"));
    expect(campo.value).toBe("CASAI Brasília");
  });
});

describe("blocos", () => {
  it("unidades com mais de um processo: o clique filtra a unidade", async () => {
    await montar();
    const chip = secao.querySelector(".visao-geral-unidade");
    expect(chip.textContent).toContain("DSEI Xingu");
    expect(chip.textContent).toContain("2");
    await clicar(chip);
    expect(estado.obter().filtros.unidade).toEqual(["DSEI Xingu"]);
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    expect(toast).toHaveBeenLastCalledWith("Filtro de unidade: DSEI Xingu");
  });

  it("resumo por etapa: nome vindo do dado é texto (sem XSS) e o clique filtra a etapa exata", async () => {
    const alertas = vi.spyOn(window, "alert").mockImplementation(() => {});
    await montar();
    const etapas = [...secao.querySelectorAll(".visao-geral-etapa")];
    const perigosa = etapas.find((b) => b.textContent.includes("d'água"));
    expect(perigosa).toBeTruthy();
    expect(perigosa.querySelector("img")).toBeNull();
    expect(secao.querySelector("img")).toBeNull();
    expect(perigosa.getAttribute("onclick")).toBeNull();
    expect(perigosa.querySelector("b").textContent).toBe(ETAPA_PERIGOSA);
    expect(perigosa.querySelector("b").title).toBe(ETAPA_PERIGOSA);
    await clicar(perigosa);
    expect(estado.obter().filtros.etapa).toEqual([ETAPA_PERIGOSA]);
    expect(perigosa.getAttribute("aria-pressed")).toBe("true");
    expect(valorDoKpi("processos")).toBe("1");
    expect(alertas).not.toHaveBeenCalled();
    alertas.mockRestore();
  });

  it("status operacional: rosca com o total e legenda que filtra todas as grafias", async () => {
    await montar();
    const rosca = graficos.find((g) => g.canvas.isConnected);
    expect(rosca.data.labels).toEqual(["Em andamento", "Concluído"]);
    expect(
      secao.querySelector(".visao-geral-rosca-centro").textContent,
    ).toContain("3");
    const item = [...secao.querySelectorAll(".visao-geral-legenda-item")].find(
      (b) => b.textContent.includes("Em andamento"),
    );
    await clicar(item);
    // "Em Andamento" e "em andamento" são uma opção só, e a seleção pega as duas linhas.
    expect(estado.obter().filtros.status).toEqual(["Em Andamento"]);
    expect(valorDoKpi("processos")).toBe("2");
    expect(item.getAttribute("aria-pressed")).toBe("true");
    // O clique na fatia faz o mesmo.
    await act(async () => rosca.options.onClick(null, [{ index: 0 }]));
    expect(estado.obter().filtros.status).toEqual([]);
  });

  it("o gráfico acompanha o tema do app", async () => {
    await montar();
    const rosca = graficos.find((g) => g.canvas.isConnected);
    const antes = rosca.atualizacoes;
    await act(async () => {
      document.documentElement.setAttribute("data-theme", "dark");
      document.dispatchEvent(new Event(EVENTO_TEMA_ALTERADO));
    });
    expect(rosca.atualizacoes).toBeGreaterThan(antes);
  });

  it("Atenção lista os processos Médio/Alto abertos e abre os detalhes", async () => {
    await montar();
    const itens = secao.querySelectorAll(".visao-geral-atencao .ui-pendencia");
    expect(itens).toHaveLength(2);
    expect(itens[0].textContent).toContain("03/2026");
    await clicar(itens[0]);
    expect(document.querySelector("#visaoGeralGaveta")).not.toBeNull();
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
    ).toContain("Próxima etapa em 2 dia(s)");
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
    const risco = [...secao.querySelectorAll(".visao-geral-colunas-menu label")]
      .find((l) => l.textContent.includes("Risco"))
      .querySelector("input");
    await clicar(risco);
    expect(cabecalhos()).not.toContain("Risco");
    expect(JSON.parse(armazenamento.getItem(CHAVE_DAS_COLUNAS))).not.toContain(
      "risco",
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
});

describe("boas-vindas e marcos do ano", () => {
  it("saúda quando o perfil e os editais chegaram; fechar vale até o fim do dia", async () => {
    await montar({ comPerfil: true });
    const card = secao.querySelector(".boas-vindas");
    expect(card.textContent).toContain("Bom dia, Ana");
    await clicar(card.querySelector('[data-boas-vindas="fechar"]'));
    expect(secao.querySelector(".boas-vindas")).toBeNull();
    await act(async () => tela.raiz.unmount());
    await montar({ comPerfil: true });
    expect(secao.querySelector(".boas-vindas:not(.marcos-do-ano)")).toBeNull();
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
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith("obter_marcos_da_area", {
      p_area: "saude-indigena",
    });
    const marco = secao.querySelector(".marcos-do-ano");
    expect(marco.textContent).toContain("Saúde Indígena passou de");
    await clicar(marco.querySelector("button"));
    expect(secao.querySelector(".marcos-do-ano")).toBeNull();
  });

  it("comemorações desligadas: nem consulta o banco", async () => {
    const supabase = { rpc: vi.fn() };
    await montar({ comPerfil: true, supabase, comemoracoes: false });
    await esperar();
    expect(supabase.rpc).not.toHaveBeenCalled();
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
    const legado = readFileSync("src/modules/legacy-app.js", "utf8");
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
    expect(html).toContain('id="mapaDaVisaoGeral"');
  });
});
