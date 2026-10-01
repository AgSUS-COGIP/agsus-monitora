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
  PainelDeFiltros,
  Selo,
  TabelaInfinita,
  TopoDoPainel,
} from "../../src/ui/index.js";
import { clicar, digitar, teclar } from "../componentes/interacoes.js";

/*
  Os componentes de src/ui/ (o design system): render básico e a interação
  principal de cada um. O DOM (ids, classes) é contrato do CSS de
  src/analises/ e dos testes dos painéis — por isso é conferido aqui.
*/

let raiz = null;

async function montar(elemento) {
  document.body.innerHTML = `<div id="raiz"></div>`;
  await act(async () => {
    raiz = createRoot(document.getElementById("raiz"));
    raiz.render(elemento);
  });
}

async function redesenhar(elemento) {
  await act(async () => raiz.render(elemento));
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
