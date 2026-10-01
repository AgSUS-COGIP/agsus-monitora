import { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Aviso,
  Campo,
  CardDeGrafico,
  Carregando,
  ChipDeFiltro,
  ChipsDeFiltro,
  EstadoVazio,
  Gaveta,
  GradeDeKpis,
  Kpi,
  Kv,
  LinhaDoRecorte,
  ListaDePendencias,
  MaisOpcoes,
  MarcasDoRecorte,
  PainelDeFiltros,
  PainelNoQuadro,
  Recorte,
  Secao,
  Segmentado,
  Selo,
  TabelaInfinita,
  textoDoRecorte,
  TopoDoPainel,
} from "../../src/ui/index.js";
import { clicar, digitar, teclar } from "../componentes/interacoes.js";

/*
  Os componentes de src/ui/ (o design system): render básico e a interação
  principal de cada um, nos dois modos. Dentro do app (o padrão): classes
  `.ui-*` e nenhum id fixo. No quadro (<PainelNoQuadro>, Entrevistas e
  Seleção, ainda em iframe): a marcação do painel de análises, cujos ids e
  classes são contrato do CSS de src/analises/ — por isso conferidos aqui.
*/

let raiz = null;

const noQuadro = (elemento) => h(PainelNoQuadro, null, elemento);

async function montarNoApp(elemento) {
  document.body.innerHTML = `<div id="raiz"></div>`;
  await act(async () => {
    raiz = createRoot(document.getElementById("raiz"));
    raiz.render(elemento);
  });
}

/* Os blocos abaixo, até "Dentro do app", são o modo no quadro. */
const montar = (elemento) => montarNoApp(noQuadro(elemento));

async function redesenhar(elemento) {
  await act(async () => raiz.render(noQuadro(elemento)));
}

afterEach(async () => {
  await act(async () => raiz?.unmount());
  raiz = null;
  document.body.innerHTML = "";
});

const $ = (seletor) => document.querySelector(seletor);

describe("TopoDoPainel", () => {
  const props = (extra = {}) => ({
    titulo: "Painel X",
    subtitulo: "Saúde Indígena",
    status: "Atualizado às 10:00",
    escuro: false,
    aoTema: vi.fn(),
    aoTelaCheia: vi.fn(),
    aoAtualizar: vi.fn(),
    aoExportar: vi.fn(),
    ...extra,
  });

  it("desenha título, subtítulo, status discreto e os botões, com os ids de sempre", async () => {
    const p = props();
    await montar(h(TopoDoPainel, p, h("button", { id: "extra" }, "Extra")));
    expect($("#topbar h1").textContent).toBe("Painel X");
    expect($("#topbar .sub").textContent).toBe("Saúde Indígena");
    expect($("#updatedText.status-discreto").textContent).toBe(
      "Atualizado às 10:00",
    );
    for (const id of ["themeBtn", "fullBtn", "refreshBtn", "exportBtn"])
      expect($(`#${id}`), id).not.toBeNull();
    // Botões próprios do painel entram depois de Exportar.
    expect($("#exportBtn").nextElementSibling.id).toBe("extra");
    await clicar($("#refreshBtn"));
    await clicar($("#exportBtn"));
    await clicar($("#themeBtn"));
    expect(p.aoAtualizar).toHaveBeenCalledTimes(1);
    expect(p.aoExportar).toHaveBeenCalledTimes(1);
    expect(p.aoTema).toHaveBeenCalledTimes(1);
    expect($("#themeBtn").getAttribute("aria-label")).toBe("Usar tema escuro");
  });

  it("sem aoExportar, não mostra Exportar; desativa Atualizar quando pedido", async () => {
    await montar(
      h(
        TopoDoPainel,
        props({ aoExportar: undefined, atualizarDesativado: true }),
      ),
    );
    expect($("#exportBtn")).toBeNull();
    expect($("#refreshBtn").disabled).toBe(true);
  });

  it("mostra as visões e mede a altura do topo em --topbar-height", async () => {
    await montar(
      h(TopoDoPainel, {
        ...props({ escuro: true }),
        visoes: h("div", { className: "visoes" }, "abas"),
      }),
    );
    expect($(".brand .visoes").textContent).toBe("abas");
    expect($("#themeBtn").getAttribute("aria-label")).toBe("Usar tema claro");
    expect(
      document.documentElement.style.getPropertyValue("--topbar-height"),
    ).toMatch(/px$/);
  });
});

describe("PainelDeFiltros e chips", () => {
  it("recolhe e expande o corpo, com o resumo e o Limpar tudo", async () => {
    const aoLimpar = vi.fn();
    const aoRecolher = vi.fn();
    await montar(
      h(
        PainelDeFiltros,
        { idDoTitulo: "t", quantos: 2, aoLimpar, aoRecolher },
        h("div", { className: "filter-grid" }, "campos"),
      ),
    );
    const painel = $("section.panel.filter-panel");
    expect(painel.getAttribute("aria-labelledby")).toBe("t");
    expect($("#t").textContent).toBe("Refinar resultados");
    expect($("#filterSummary").textContent).toContain("2 filtros adicionais");
    expect($("#filterSummary").classList.contains("has-filters")).toBe(true);
    expect($("#filtersBody .filter-grid").textContent).toBe("campos");

    await clicar($("#toggleFiltersBtn"));
    expect(painel.classList.contains("is-collapsed")).toBe(true);
    expect($("#filtersBody").hidden).toBe(true);
    expect($("#toggleFiltersBtn").getAttribute("aria-expanded")).toBe("false");
    expect(aoRecolher).toHaveBeenLastCalledWith(true);

    await clicar($("#toggleFiltersBtn"));
    expect($("#filtersBody").hidden).toBe(false);
    expect(aoRecolher).toHaveBeenLastCalledWith(false);

    await clicar($("#clearBtn"));
    expect(aoLimpar).toHaveBeenCalledTimes(1);
  });

  it("sem filtro ativo, Limpar tudo fica desativado", async () => {
    await montar(h(PainelDeFiltros, { idDoTitulo: "t", quantos: 0 }));
    expect($("#clearBtn").disabled).toBe(true);
    expect($("#filterSummary").textContent).toContain(
      "nenhum filtro adicional",
    );
  });

  it("não recolhível: só o título e os filhos, sem ações", async () => {
    await montar(
      h(
        PainelDeFiltros,
        { idDoTitulo: "t", className: "extra", recolhivel: false },
        h("p", { id: "filho" }, "x"),
      ),
    );
    expect($("section").className).toBe("panel filter-panel extra");
    expect($("#toggleFiltersBtn")).toBeNull();
    expect($("#filtersBody")).toBeNull();
    expect($("section > #filho")).not.toBeNull();
  });

  it("o chip mostra rótulo e valor e tira o filtro no clique", async () => {
    const aoTirar = vi.fn();
    await montar(
      h(
        ChipsDeFiltro,
        null,
        h(ChipDeFiltro, { rotulo: "Edital", aoTirar }, "03/2025"),
      ),
    );
    const chip = $("#filterChips .chip-filter");
    expect(chip.querySelector("b").textContent).toBe("Edital");
    expect(chip.textContent).toContain("03/2025");
    expect(chip.title).toBe("Tirar o filtro Edital");
    await clicar(chip);
    expect(aoTirar).toHaveBeenCalledTimes(1);
  });
});

describe("Kpi e GradeDeKpis", () => {
  it("card estático e card que filtra (aria-pressed, is-active)", async () => {
    const aoClicar = vi.fn();
    await montar(
      h(
        GradeDeKpis,
        { id: "kpiGrid", rotulo: "Indicadores", className: "x" },
        h(Kpi, { chave: "total", cor: "k-cyan", rotulo: "Total", valor: "10" }),
        h(Kpi, {
          chave: "abertos",
          rotulo: "Abertos",
          valor: "3",
          ativo: true,
          aoClicar,
        }),
      ),
    );
    expect($("#kpiGrid").className).toBe("kpis x");
    expect($("#kpiGrid").getAttribute("aria-label")).toBe("Indicadores");
    const total = $('[data-kpi="total"]');
    expect(total.className).toBe("kpi k-cyan");
    expect(total.querySelector("button")).toBeNull();
    expect(total.querySelector("b").textContent).toBe("10");

    const abertos = $('[data-kpi="abertos"]');
    expect(abertos.classList.contains("is-active")).toBe(true);
    const botao = abertos.querySelector("button");
    expect(botao.getAttribute("aria-pressed")).toBe("true");
    expect(botao.title).toBe("Filtrar o painel");
    await clicar(botao);
    expect(aoClicar).toHaveBeenCalledTimes(1);
  });

  it("atalho (sem `ativo`) não leva aria-pressed", async () => {
    await montar(
      h(Kpi, {
        chave: "a",
        rotulo: "A",
        valor: "1",
        titulo: "Ver a lista",
        aoClicar: () => {},
      }),
    );
    const botao = $("button");
    expect(botao.hasAttribute("aria-pressed")).toBe(false);
    expect(botao.title).toBe("Ver a lista");
  });
});

describe("CardDeGrafico", () => {
  it("título e corpo em .chart-wrap, sem dica", async () => {
    await montar(
      h(
        CardDeGrafico,
        { titulo: "Situação", altura: "short", className: "extra" },
        h("canvas", { id: "c" }),
      ),
    );
    const card = $("article");
    expect(card.className).toBe("panel panel-pad extra");
    expect(card.querySelector("h2.title").textContent).toBe("Situação");
    expect(card.querySelector(".chart-wrap.short > #c")).not.toBeNull();
    expect(card.querySelector(".hint, .eyebrow")).toBeNull();
  });

  it("como seção, para o bloco da linha inteira", async () => {
    await montar(h(CardDeGrafico, { titulo: "T", elemento: "section" }));
    expect($("section.panel.panel-pad")).not.toBeNull();
    expect($(".chart-wrap").className).toBe("chart-wrap");
  });
});

describe("TabelaInfinita", () => {
  const colunas = [
    { rotulo: "Nome", largura: "70%" },
    { rotulo: "Total", largura: "30%", numero: true },
  ];
  const pelaBusca = (itens, busca) =>
    itens.filter((item) => item.nome.includes(busca));
  const props = (extra = {}) => ({
    idDoTitulo: "tabelaTitulo",
    titulo: "Fila",
    busca: { placeholder: "Buscar", rotulo: "Buscar na fila" },
    carregado: true,
    itens: [],
    filtrarPelaBusca: pelaBusca,
    colunas,
    linha: (item) =>
      h(
        "tr",
        { key: item.nome },
        h("td", null, item.nome),
        h("td", null, item.total),
      ),
    informacao: (quantos) => (quantos === null ? "Carregando…" : `${quantos}`),
    total: 0,
    vazio: "Nada carregado.",
    ...extra,
  });

  it("carregando: esqueleto, busca desligada e a informação de carga", async () => {
    await montar(h(TabelaInfinita, props({ carregado: false })));
    expect($("#tableSearch").disabled).toBe(true);
    expect($("#tableInfo").textContent).toBe("Mostrando 0 de 0 registros");
    expect($("#pageInfo").textContent).toBe("Carregando…");
    expect(
      document.querySelectorAll('#tableBody tr[aria-hidden="true"]').length,
    ).toBe(8);
    expect($("th.num").textContent).toBe("Total");
    expect($(".analises-infinite-status")).toBeNull();
  });

  it("vazio: a mensagem de nada carregado, ou 'Nenhum registro' quando a busca esvazia", async () => {
    await montar(h(TabelaInfinita, props()));
    expect($("#tableBody td.empty").textContent).toBe("Nada carregado.");
    expect($("#tableBody td.empty").colSpan).toBe(2);

    await redesenhar(
      h(
        TabelaInfinita,
        props({ itens: [{ nome: "Ana", total: 1 }], total: 1 }),
      ),
    );
    await digitar($("#tableSearch"), "Zé");
    expect($("#tableBody td.empty").textContent).toBe(
      "Nenhum registro encontrado.",
    );
  });

  it("mostra 50 por vez e carrega mais ao rolar perto do fim", async () => {
    const itens = Array.from({ length: 120 }, (_, i) => ({
      nome: `Pessoa ${i}`,
      total: i,
    }));
    await montar(h(TabelaInfinita, props({ itens, total: 120 })));
    expect(document.querySelectorAll("#tableBody tr").length).toBe(50);
    expect($("#tableInfo").textContent).toBe("Mostrando 50 de 120 registros");
    expect($("#pageInfo").textContent).toBe("120");
    expect($(".analises-infinite-status").textContent).toBe(
      "50 de 120 registros",
    );

    const caixa = $(".table-wrap");
    Object.defineProperty(caixa, "scrollHeight", { value: 1000 });
    Object.defineProperty(caixa, "clientHeight", { value: 400 });
    caixa.scrollTop = 500;
    await act(async () => {
      caixa.dispatchEvent(new Event("scroll"));
    });
    expect(document.querySelectorAll("#tableBody tr").length).toBe(100);
  });

  it("a busca da tabela recorta e a informação acompanha", async () => {
    await montar(
      h(
        TabelaInfinita,
        props({
          itens: [
            { nome: "Ana", total: 1 },
            { nome: "Bia", total: 2 },
          ],
          total: 2,
        }),
      ),
    );
    await digitar($("#tableSearch"), "Bi");
    expect(document.querySelectorAll("#tableBody tr").length).toBe(1);
    expect($("#pageInfo").textContent).toBe("1");
    expect($(".analises-infinite-status").textContent).toBe(
      "Todos os 1 registros do recorte foram carregados",
    );
  });
});

describe("Gaveta", () => {
  it("abre com o topo (sobretítulo, título, resumo) e fecha pelo X e pelo Esc", async () => {
    const aoFechar = vi.fn();
    await montar(
      h(
        Gaveta,
        {
          id: "g",
          tituloId: "gTitulo",
          aoFechar,
          className: "extra",
          cartaoClassName: "larga",
          sobretitulo: "Recurso nº 1",
          titulo: "Fulana",
          resumo: h("span", null, "Em análise"),
          rotuloDoFechar: "Fechar detalhe",
        },
        h("p", { id: "corpo" }, "corpo"),
      ),
    );
    const fundo = document.getElementById("g");
    expect(fundo.className).toBe("modal analises-drawer-backdrop extra show");
    expect(fundo.getAttribute("aria-labelledby")).toBe("gTitulo");
    expect(fundo.querySelector(".modal-card").className).toBe(
      "modal-card analises-drawer larga",
    );
    expect($(".analises-drawer-head .eyebrow").textContent).toBe(
      "Recurso nº 1",
    );
    expect($("#gTitulo").textContent).toBe("Fulana");
    expect($(".analises-drawer-summary").textContent).toBe("Em análise");
    expect($("#corpo")).not.toBeNull();

    await clicar($('.analises-drawer-close[aria-label="Fechar detalhe"]'));
    expect(aoFechar).toHaveBeenCalledTimes(1);
    await teclar(document, "Escape");
    expect(aoFechar).toHaveBeenCalledTimes(2);
  });

  it("sem sobretítulo nem resumo, eles não aparecem", async () => {
    await montar(
      h(Gaveta, {
        id: "g",
        tituloId: "gt",
        aoFechar: () => {},
        titulo: "Modelos",
        rotuloDoFechar: "Fechar",
      }),
    );
    expect($(".eyebrow")).toBeNull();
    expect($(".analises-drawer-summary")).toBeNull();
  });
});

describe("Aviso, Campo, Selo e estados", () => {
  it("Aviso: tom, papel e o elemento pedido", async () => {
    await montar(
      h(
        "div",
        null,
        h(Aviso, { tom: "danger", papel: "alert" }, "Falhou"),
        h(Aviso, { como: "p", className: "recursos-aviso" }, "Info"),
      ),
    );
    const [erro, info] = document.querySelectorAll(".ui-aviso");
    expect(erro.tagName).toBe("DIV");
    expect(erro.dataset.tone).toBe("danger");
    expect(erro.getAttribute("role")).toBe("alert");
    expect(info.tagName).toBe("P");
    expect(info.className).toBe("ui-aviso recursos-aviso");
    expect(info.hasAttribute("data-tone")).toBe(false);
  });

  it("Campo: liga o rótulo ao controle, marca o erro e mostra a dica", async () => {
    await montar(
      h(
        Campo,
        {
          rotulo: "Motivo",
          obrigatorio: true,
          dica: "3 a 500 caracteres",
          erro: "Obrigatório",
          largo: true,
        },
        h("textarea", { defaultValue: "" }),
      ),
    );
    const campo = $(".field");
    expect(campo.classList.contains("ui-campo-largo")).toBe(true);
    const rotulo = campo.querySelector("label");
    const controle = campo.querySelector("textarea");
    expect(rotulo.htmlFor).toBe(controle.id);
    expect(rotulo.textContent).toBe("Motivo *");
    expect(controle.getAttribute("aria-invalid")).toBe("true");
    expect($(".ui-campo-dica").textContent).toBe("3 a 500 caracteres");
    expect($(".ui-campo-erro[role=alert]").textContent).toContain(
      "Obrigatório",
    );
  });

  it("Campo: mantém o id que o controle já tem", async () => {
    await montar(
      h(Campo, { rotulo: "Busca" }, h("input", { id: "filtro-busca" })),
    );
    expect($("label").htmlFor).toBe("filtro-busca");
    expect($("input").hasAttribute("aria-invalid")).toBe(false);
  });

  it("Selo: badge com o tom (neutro por padrão), título e classe extra", async () => {
    await montar(
      h(
        "div",
        null,
        h(Selo, null, "Sem análise"),
        h(
          Selo,
          { tom: "aprovado", titulo: "No prazo", className: "extra" },
          "OK",
        ),
      ),
    );
    const [neutro, aprovado] = document.querySelectorAll(".badge");
    expect(neutro.className).toBe("badge neutro");
    expect(aprovado.className).toBe("badge aprovado extra");
    expect(aprovado.title).toBe("No prazo");
  });

  it("EstadoVazio e Carregando usam .empty (ou a classe pedida)", async () => {
    await montar(
      h(
        "div",
        null,
        h(EstadoVazio, null, "Nada aqui."),
        h(Carregando),
        h(Carregando, { className: "analises-detail-analysis" }),
      ),
    );
    const blocos = document.querySelectorAll("#raiz > div > div");
    expect(blocos[0].className).toBe("empty");
    expect(blocos[0].textContent).toBe("Nada aqui.");
    expect(blocos[1].textContent).toBe("Carregando…");
    expect(blocos[2].className).toBe("analises-detail-analysis");
  });
});

describe("Dentro do app (sem PainelNoQuadro): classes .ui-* e nenhum id fixo", () => {
  const IDS_DO_QUADRO = [
    "topbar",
    "updatedText",
    "themeBtn",
    "fullBtn",
    "refreshBtn",
    "exportBtn",
    "filterSummary",
    "toggleFiltersBtn",
    "clearBtn",
    "filtersBody",
    "filterChips",
    "tableSearch",
    "tableInfo",
    "pageInfo",
    "tableBody",
  ];
  const idsDoQuadroNaTela = () =>
    IDS_DO_QUADRO.filter((id) => document.getElementById(id));

  it("TopoDoPainel: só status e ações; sem tema e tela cheia, sem esses botões", async () => {
    const aoAtualizar = vi.fn();
    const aoExportar = vi.fn();
    await montarNoApp(
      h(
        TopoDoPainel,
        { status: "Atualizado em 01/10/2026", aoAtualizar, aoExportar },
        h("button", { id: "extra" }, "Extra"),
      ),
    );
    const topo = $("header.ui-topo");
    expect(topo).not.toBeNull();
    expect(topo.querySelector("h1, h2")).toBeNull();
    expect($(".ui-topo .status-discreto").textContent).toBe(
      "Atualizado em 01/10/2026",
    );
    expect($('[aria-label="Usar tema escuro"]')).toBeNull();
    expect($('[aria-label="Alternar tela cheia"]')).toBeNull();
    const exportar = $('[data-acao="exportar"]');
    expect(exportar.nextElementSibling.id).toBe("extra");
    await clicar($('[data-acao="atualizar"]'));
    await clicar(exportar);
    expect(aoAtualizar).toHaveBeenCalledTimes(1);
    expect(aoExportar).toHaveBeenCalledTimes(1);
    expect(idsDoQuadroNaTela()).toEqual([]);
  });

  it("TopoDoPainel: com título e tema pedidos, eles aparecem", async () => {
    const aoTema = vi.fn();
    await montarNoApp(
      h(TopoDoPainel, {
        titulo: "Tela",
        subtitulo: "SEDE",
        status: "",
        escuro: true,
        aoTema,
        aoAtualizar: () => {},
      }),
    );
    expect($(".ui-topo-titulo h2").textContent).toBe("Tela");
    expect($(".ui-topo-titulo p").textContent).toBe("SEDE");
    await clicar($('[aria-label="Usar tema claro"]'));
    expect(aoTema).toHaveBeenCalledTimes(1);
  });

  it("PainelDeFiltros e chips: card .ui-filtros, recolhe, limpa", async () => {
    const aoLimpar = vi.fn();
    const aoTirar = vi.fn();
    await montarNoApp(
      h(
        PainelDeFiltros,
        { idDoTitulo: "t", quantos: 1, aoLimpar },
        h(
          ChipsDeFiltro,
          null,
          h(ChipDeFiltro, { rotulo: "Edital", aoTirar }, "1"),
        ),
      ),
    );
    const painel = $("section.ui-card.ui-filtros");
    expect(painel.querySelector("h2.ui-titulo").textContent).toBe(
      "Refinar resultados",
    );
    expect($(".ui-filtros-resumo.tem-filtros").textContent).toContain(
      "1 filtro adicional",
    );
    await clicar($(".ui-chips .ui-chip"));
    expect(aoTirar).toHaveBeenCalledTimes(1);
    await clicar($('[data-acao="recolher-filtros"]'));
    expect(painel.classList.contains("is-recolhido")).toBe(true);
    expect($(".ui-filtros-corpo").hidden).toBe(true);
    await clicar($('[data-acao="limpar-filtros"]'));
    expect(aoLimpar).toHaveBeenCalledTimes(1);
    expect(idsDoQuadroNaTela()).toEqual([]);
    expect($(".panel, .filter-panel, .chip-filter")).toBeNull();
  });

  it("Kpi: card compacto com tile no tom da cor, filtro e skeleton ao carregar", async () => {
    const aoClicar = vi.fn();
    await montarNoApp(
      h(
        GradeDeKpis,
        { rotulo: "Indicadores" },
        h(Kpi, {
          chave: "a",
          cor: "k-red",
          icone: "fa-clock",
          rotulo: "Atrasados",
          valor: "4",
          ativo: true,
          aoClicar,
        }),
        h(Kpi, { chave: "b", rotulo: "Total", valor: "9", carregando: true }),
      ),
    );
    expect($("section.ui-kpis")).not.toBeNull();
    const a = $('[data-kpi="a"]');
    expect(a.className).toBe("ui-kpi ui-kpi-clicavel is-ativo");
    expect(a.dataset.tom).toBe("perigo");
    expect(a.querySelector(".ui-kpi-icone i").className).toContain("fa-clock");
    expect(a.querySelector(".ui-kpi-valor").textContent).toBe("4");
    const botao = a.querySelector("button.ui-kpi-alvo");
    expect(botao.getAttribute("aria-pressed")).toBe("true");
    await clicar(botao);
    expect(aoClicar).toHaveBeenCalledTimes(1);
    const b = $('[data-kpi="b"]');
    expect(b.dataset.tom).toBe("info");
    expect(b.getAttribute("aria-busy")).toBe("true");
    expect(b.querySelector(".ui-kpi-valor.ui-esqueleto").textContent).toBe("");
    expect($(".kpi, .kpis")).toBeNull();
  });

  it("CardDeGrafico, Selo, Kv, Secao e estados com as classes .ui-*", async () => {
    await montarNoApp(
      h(
        "div",
        null,
        h(CardDeGrafico, { titulo: "G", altura: "short", carregando: true }),
        h(Selo, { tom: "aprovado" }, "No prazo"),
        h(
          Secao,
          { icone: "fa-list-check", titulo: "Etapas", secao: "e" },
          h(Kv, { rotulo: "Nota" }, ""),
        ),
        h(EstadoVazio, null, "Nada."),
        h(Carregando),
      ),
    );
    expect(
      $("article.ui-card.ui-card-de-grafico h2.ui-titulo").textContent,
    ).toBe("G");
    expect($(".ui-grafico.is-carregando").dataset.altura).toBe("short");
    expect($(".ui-selo").dataset.tom).toBe("sucesso");
    expect($(".ui-secao .ui-secao-topo").textContent).toBe("Etapas");
    expect($(".ui-kv[data-empty] .ui-kv-valor").textContent).toBe("—");
    expect(
      [...document.querySelectorAll(".ui-vazio")].map((e) => e.textContent),
    ).toEqual(["Nada.", "Carregando…"]);
    expect(
      $(".panel, .badge, .kv, .empty, .analises-detail-section"),
    ).toBeNull();
  });

  it("TabelaInfinita: .ui-tabela, sem ids, e avisa agsus:content-updated ao desenhar", async () => {
    const avisos = vi.fn();
    document.addEventListener("agsus:content-updated", avisos);
    await montarNoApp(
      h(TabelaInfinita, {
        idDoTitulo: "tt",
        titulo: "Fila",
        busca: { placeholder: "Buscar", rotulo: "Buscar na fila" },
        carregado: true,
        itens: [{ nome: "Ana" }, { nome: "Bia" }],
        filtrarPelaBusca: (itens, busca) =>
          itens.filter((i) => i.nome.includes(busca)),
        colunas: [{ rotulo: "Nome" }],
        linha: (item) => h("tr", { key: item.nome }, h("td", null, item.nome)),
        informacao: (quantos) => `${quantos}`,
        total: 2,
        vazio: "Nada.",
      }),
    );
    expect($("section.ui-card.ui-tabela h2.ui-titulo").textContent).toBe(
      "Fila",
    );
    expect(
      document.querySelectorAll(".ui-tabela-rolagem tbody tr"),
    ).toHaveLength(2);
    expect($("[data-tabela-mostrando]").textContent).toBe(
      "Mostrando 2 de 2 registros",
    );
    expect(avisos).toHaveBeenCalled();
    await digitar($(".ui-tabela-busca"), "Bi");
    expect($("[data-tabela-contagem]").textContent).toBe("1");
    expect($(".ui-tabela-status").textContent).toBe(
      "Todos os 1 registros do recorte foram carregados",
    );
    expect(idsDoQuadroNaTela()).toEqual([]);
    document.removeEventListener("agsus:content-updated", avisos);
  });

  it("Gaveta: encostada à direita (.ui-gaveta), fecha pelo X e pelo Esc", async () => {
    const aoFechar = vi.fn();
    await montarNoApp(
      h(Gaveta, {
        id: "g",
        tituloId: "gt",
        aoFechar,
        sobretitulo: "Recurso nº 1",
        titulo: "Fulana",
        resumo: h("span", null, "Em análise"),
        rotuloDoFechar: "Fechar detalhe",
      }),
    );
    expect(document.getElementById("g").className).toBe(
      "modal ui-gaveta-fundo show",
    );
    expect(
      $(".modal-card.ui-gaveta .ui-gaveta-topo .ui-gaveta-sobretitulo")
        .textContent,
    ).toBe("Recurso nº 1");
    expect($(".ui-gaveta-resumo").textContent).toBe("Em análise");
    await clicar($('.ui-gaveta-fechar[aria-label="Fechar detalhe"]'));
    await teclar(document, "Escape");
    expect(aoFechar).toHaveBeenCalledTimes(2);
    expect($(".analises-drawer, .eyebrow")).toBeNull();
  });

  it("Campo: .ui-campo no lugar de .field", async () => {
    await montarNoApp(h(Campo, { rotulo: "Busca" }, h("input", null)));
    expect($(".ui-campo label").htmlFor).toBe($("input").id);
    expect($(".field")).toBeNull();
  });
});

describe("peças de Análises curriculares e Recursos", () => {
  it("LinhaDoRecorte com `texto` e MarcasDoRecorte: marcas com tom (neutro por padrão)", async () => {
    await montarNoApp(
      h(
        LinhaDoRecorte,
        { texto: "Recorte ativo: Situação do processo: Ativo" },
        h(MarcasDoRecorte, {
          marcas: [
            { chave: "j", icone: "fa-calendar-days", texto: "Janela" },
            { chave: "f", tom: "alerta", texto: "2 fora" },
          ],
        }),
      ),
    );
    expect($("[data-recorte]").textContent).toBe(
      "Recorte ativo: Situação do processo: Ativo",
    );
    expect(
      [...document.querySelectorAll(".ui-recorte-marcas .ui-marca")].map(
        (m) => m.dataset.tom,
      ),
    ).toEqual(["neutro", "alerta"]);
    await act(async () => raiz.render(h(MarcasDoRecorte, { marcas: [] })));
    expect($(".ui-recorte-marcas")).toBeNull();
  });

  it("MaisOpcoes: alterna o bloco e mostra quantos filtros adicionais estão em uso", async () => {
    const aoAlternar = vi.fn();
    await montarNoApp(
      h(
        MaisOpcoes,
        {
          id: "extra",
          aberto: false,
          aoAlternar,
          quantos: 2,
          titulo: "Mostrar mais",
        },
        h("span", null, "campo"),
      ),
    );
    const botao = $('[data-acao="mais-opcoes"]');
    expect(botao.getAttribute("aria-controls")).toBe("extra");
    expect(botao.getAttribute("aria-expanded")).toBe("false");
    expect(botao.textContent).toContain("Mais opções");
    expect($(".ui-contagem").textContent).toBe("2");
    expect(document.getElementById("extra").hidden).toBe(true);
    await clicar(botao);
    expect(aoAlternar).toHaveBeenCalled();
  });

  it("PainelDeFiltros: o resumo começa pelo escopo e o Limpar segue `podeLimpar`", async () => {
    await montarNoApp(
      h(PainelDeFiltros, {
        idDoTitulo: "f",
        quantos: 0,
        escopo: "Inativo",
        podeLimpar: true,
        aoLimpar: vi.fn(),
      }),
    );
    expect($(".ui-filtros-resumo").textContent).toContain(
      "Inativo · nenhum filtro adicional",
    );
    expect($('[data-acao="limpar-filtros"]').disabled).toBe(false);
  });

  it("TabelaInfinita: busca controlada pela tela e Carregar mais", async () => {
    const aoMudar = vi.fn();
    const itens = Array.from({ length: 70 }, (_, i) => ({ nome: `P${i}` }));
    const props = (valor) => ({
      idDoTitulo: "t",
      titulo: "Fila",
      busca: { placeholder: "Buscar", rotulo: "Buscar", valor, aoMudar },
      carregado: true,
      itens,
      filtrarPelaBusca: (lista, busca) =>
        lista.filter((i) => i.nome.includes(busca)),
      colunas: [{ rotulo: "Nome" }],
      linha: (item) => h("tr", { key: item.nome }, h("td", null, item.nome)),
      informacao: () => "",
      total: 70,
      vazio: "Nada.",
    });
    await montarNoApp(h(TabelaInfinita, props("")));
    expect(document.querySelectorAll("tbody tr")).toHaveLength(50);
    expect($('[data-acao="carregar-mais"]').textContent).toContain(
      "Carregar mais 20",
    );
    await clicar($('[data-acao="carregar-mais"]'));
    expect(document.querySelectorAll("tbody tr")).toHaveLength(70);
    expect($('[data-acao="carregar-mais"]')).toBeNull();

    await digitar($(".ui-tabela-busca"), "P6");
    expect(aoMudar).toHaveBeenCalledWith("P6");
    await act(async () => raiz.render(h(TabelaInfinita, props("P69"))));
    expect(document.querySelectorAll("tbody tr")).toHaveLength(1);
    expect($(".ui-tabela-busca").value).toBe("P69");
  });

  it("Campo: `idDoControle` liga o rótulo a um controle que não é input/select", async () => {
    await montarNoApp(
      h(
        Campo,
        { rotulo: "Unidade", idDoControle: "x-unidade" },
        h("button", { id: "x-unidade", type: "button" }, "Todas"),
      ),
    );
    expect($(".ui-campo label").htmlFor).toBe("x-unidade");
  });
});

describe("Segmentado, LinhaDoRecorte e ListaDePendencias (só dentro do app)", () => {
  const OPCOES = [
    { valor: "a", rotulo: "Alfa", icone: "fa-chart-column" },
    { valor: "b", rotulo: "Beta" },
    { valor: "c", rotulo: "Gama" },
  ];

  it("Segmentado: radiogroup, só a escolhida no Tab, setas movem e dão a volta", async () => {
    const aoMudar = vi.fn();
    await montarNoApp(
      h(Segmentado, {
        rotulo: "Visão",
        opcoes: OPCOES,
        valor: "a",
        aoMudar,
        className: "extra",
      }),
    );
    const grupo = $(".ui-segmentado.extra[role=radiogroup]");
    expect(grupo.getAttribute("aria-label")).toBe("Visão");
    const botoes = [...grupo.querySelectorAll("button[role=radio]")];
    expect(botoes.map((b) => b.tabIndex)).toEqual([0, -1, -1]);
    expect(botoes[0].getAttribute("aria-checked")).toBe("true");
    expect(botoes[0].classList.contains("is-ativo")).toBe(true);
    expect(botoes[0].querySelector("i.fa-chart-column")).not.toBeNull();
    await teclar(botoes[0], "ArrowLeft");
    expect(aoMudar).toHaveBeenLastCalledWith("c");
    expect(document.activeElement).toBe(botoes[2]);
    await teclar(botoes[2], "ArrowRight");
    expect(aoMudar).toHaveBeenLastCalledWith("a");
    await clicar(grupo.querySelector('[data-valor="b"]'));
    expect(aoMudar).toHaveBeenLastCalledWith("b");
  });

  it("Segmentado: sem escolha, a primeira entra no Tab; desabilitado não muda", async () => {
    const aoMudar = vi.fn();
    await montarNoApp(
      h(Segmentado, {
        rotulo: "Comparecimento",
        opcoes: OPCOES,
        valor: null,
        aoMudar,
        desabilitado: true,
      }),
    );
    const botoes = [...document.querySelectorAll(".ui-segmentado button")];
    expect(botoes.map((b) => b.tabIndex)).toEqual([0, -1, -1]);
    expect(botoes.every((b) => b.disabled)).toBe(true);
    await teclar(botoes[0], "ArrowRight");
    expect(aoMudar).not.toHaveBeenCalled();
  });

  it("LinhaDoRecorte: diz os filtros ativos (ou 'Sem filtros') e leva os filhos", async () => {
    await montarNoApp(
      h(
        LinhaDoRecorte,
        {
          ativos: [
            ["edital", "Edital", "01/2026"],
            ["busca", "Busca", "ana"],
          ],
        },
        h("span", { className: "marca" }, "3 vencidos"),
      ),
    );
    expect($(".ui-card.ui-recorte [data-recorte]").textContent).toBe(
      "Recorte ativo: Edital: 01/2026 · Busca: ana",
    );
    expect($(".ui-recorte .marca").textContent).toBe("3 vencidos");
    expect(textoDoRecorte([])).toBe("Sem filtros");
  });

  it("ListaDePendencias: botões com tom, filtro com aria-pressed, atalho sem; skeleton e vazio", async () => {
    const filtrar = vi.fn();
    const abrir = vi.fn();
    const itens = [
      {
        chave: "x",
        titulo: "Sem edital",
        detalhe: "2 entrevistas",
        tom: "perigo",
        ativo: true,
        aoClicar: filtrar,
      },
      { chave: "y", titulo: "Sem entrevista", detalhe: "1", aoClicar: abrir },
    ];
    await montarNoApp(h(ListaDePendencias, { itens, vazio: "Nada" }));
    const [primeiro, segundo] = document.querySelectorAll(".ui-pendencia");
    expect(primeiro.dataset.tom).toBe("perigo");
    expect(primeiro.getAttribute("aria-pressed")).toBe("true");
    expect(primeiro.classList.contains("is-ativo")).toBe(true);
    expect(primeiro.textContent).toBe("Sem edital2 entrevistas");
    expect(segundo.dataset.tom).toBe("alerta");
    expect(segundo.hasAttribute("aria-pressed")).toBe(false);
    await clicar(primeiro);
    await clicar(segundo);
    expect(filtrar).toHaveBeenCalledTimes(1);
    expect(abrir).toHaveBeenCalledTimes(1);

    await act(async () =>
      raiz.render(h(ListaDePendencias, { itens, carregando: true })),
    );
    expect(
      document.querySelectorAll(".ui-pendencias .ui-esqueleto"),
    ).toHaveLength(4);
    await act(async () =>
      raiz.render(h(ListaDePendencias, { itens: [], vazio: "Nada" })),
    );
    expect($(".ui-pendencias .ui-vazio").textContent).toBe("Nada");
  });
});
