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
  PainelDeFiltros,
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
  principal de cada um. Desenham para dentro do app: classes `.ui-*` e nenhum
  id fixo (o modo "no quadro", da transição da Etapa 2, saiu com a Seleção).
*/

let raiz = null;

async function montarNoApp(elemento) {
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
  it("sem aoExportar, não mostra Exportar; desativa Atualizar quando pedido", async () => {
    await montarNoApp(
      h(TopoDoPainel, {
        status: "",
        aoAtualizar: () => {},
        atualizarDesativado: true,
      }),
    );
    expect($('[data-acao="exportar"]')).toBeNull();
    expect($('[data-acao="atualizar"]').disabled).toBe(true);
  });

  it("as visões entram antes do status e das ações", async () => {
    await montarNoApp(
      h(TopoDoPainel, {
        status: "Carga 01/10/2026",
        aoAtualizar: () => {},
        visoes: h("div", { className: "visoes" }, "abas"),
      }),
    );
    expect($(".ui-topo-titulo .visoes").textContent).toBe("abas");
    expect($(".ui-topo-titulo").nextElementSibling.className).toBe(
      "ui-topo-acoes",
    );
  });
});

describe("PainelDeFiltros e chips", () => {
  it("recolhe e expande o corpo, avisa quem pediu, e resume os filtros", async () => {
    const aoRecolher = vi.fn();
    await montarNoApp(
      h(
        PainelDeFiltros,
        { idDoTitulo: "t", quantos: 2, aoRecolher },
        h("div", { className: "campos" }, "campos"),
      ),
    );
    expect($("section.ui-filtros").getAttribute("aria-labelledby")).toBe("t");
    expect($(".ui-filtros-resumo").textContent).toContain(
      "2 filtros adicionais",
    );
    expect($(".ui-filtros-corpo .campos").textContent).toBe("campos");
    const recolher = $('[data-acao="recolher-filtros"]');
    await clicar(recolher);
    expect(recolher.getAttribute("aria-expanded")).toBe("false");
    expect(aoRecolher).toHaveBeenLastCalledWith(true);
    await clicar(recolher);
    expect($(".ui-filtros-corpo").hidden).toBe(false);
    expect(aoRecolher).toHaveBeenLastCalledWith(false);
  });

  it("sem filtro ativo, Limpar tudo fica desativado", async () => {
    await montarNoApp(h(PainelDeFiltros, { idDoTitulo: "t", quantos: 0 }));
    expect($('[data-acao="limpar-filtros"]').disabled).toBe(true);
    expect($(".ui-filtros-resumo").textContent).toContain(
      "nenhum filtro adicional",
    );
  });

  it("não recolhível: só o título e os filhos, sem ações", async () => {
    await montarNoApp(
      h(
        PainelDeFiltros,
        { idDoTitulo: "t", className: "extra", recolhivel: false },
        h("p", { id: "filho" }, "x"),
      ),
    );
    expect($("section").className).toBe("ui-card ui-filtros extra");
    expect($('[data-acao="recolher-filtros"]')).toBeNull();
    expect($(".ui-filtros-corpo")).toBeNull();
    expect($("section > #filho")).not.toBeNull();
  });

  it("o chip mostra rótulo e valor e diz o que tira", async () => {
    await montarNoApp(
      h(
        ChipsDeFiltro,
        null,
        h(ChipDeFiltro, { rotulo: "Edital", aoTirar: () => {} }, "03/2025"),
      ),
    );
    const chip = $(".ui-chips .ui-chip");
    expect(chip.querySelector("b").textContent).toBe("Edital");
    expect(chip.textContent).toContain("03/2025");
    expect(chip.title).toBe("Tirar o filtro Edital");
  });
});

describe("Kpi e GradeDeKpis", () => {
  it("card estático: sem botão, com o título; a grade leva id, classe e rótulo", async () => {
    await montarNoApp(
      h(
        GradeDeKpis,
        { id: "grade", rotulo: "Indicadores", className: "x" },
        h(Kpi, {
          chave: "total",
          cor: "k-cyan",
          rotulo: "Total",
          valor: "10",
          titulo: "Soma",
        }),
      ),
    );
    expect($("#grade").className).toBe("ui-kpis x");
    expect($("#grade").getAttribute("aria-label")).toBe("Indicadores");
    const total = $('[data-kpi="total"]');
    expect(total.className).toBe("ui-kpi");
    expect(total.title).toBe("Soma");
    expect(total.querySelector("button")).toBeNull();
  });

  it("atalho (sem `ativo`) não leva aria-pressed", async () => {
    await montarNoApp(
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
  it("título e corpo, sem dica; como seção, para o bloco da linha inteira", async () => {
    await montarNoApp(
      h(
        "div",
        null,
        h(
          CardDeGrafico,
          { titulo: "Situação", className: "extra" },
          h("canvas", { id: "c" }),
        ),
        h(CardDeGrafico, { titulo: "T", elemento: "section" }),
      ),
    );
    const card = $("article");
    expect(card.className).toBe("ui-card ui-card-de-grafico extra");
    expect(card.querySelector(".ui-grafico > #c")).not.toBeNull();
    expect(card.querySelector(".ui-grafico").hasAttribute("data-altura")).toBe(
      false,
    );
    expect(card.querySelector(".hint, .eyebrow")).toBeNull();
    expect($("section.ui-card-de-grafico")).not.toBeNull();
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
  const linhas = () => document.querySelectorAll(".ui-tabela-rolagem tbody tr");

  it("carregando: esqueleto, busca desligada e a informação de carga", async () => {
    await montarNoApp(h(TabelaInfinita, props({ carregado: false })));
    expect($(".ui-tabela-busca").disabled).toBe(true);
    expect($("[data-tabela-mostrando]").textContent).toBe(
      "Mostrando 0 de 0 registros",
    );
    expect($("[data-tabela-contagem]").textContent).toBe("Carregando…");
    expect(
      document.querySelectorAll('tbody tr[aria-hidden="true"] .ui-esqueleto')
        .length,
    ).toBe(16);
    expect($("th.num").textContent).toBe("Total");
    expect($(".ui-tabela-status")).toBeNull();
  });

  it("vazio: a mensagem de nada carregado, ou 'Nenhum registro' quando a busca esvazia", async () => {
    await montarNoApp(h(TabelaInfinita, props()));
    expect($("tbody td.ui-vazio").textContent).toBe("Nada carregado.");
    expect($("tbody td.ui-vazio").colSpan).toBe(2);

    await redesenhar(
      h(
        TabelaInfinita,
        props({ itens: [{ nome: "Ana", total: 1 }], total: 1 }),
      ),
    );
    await digitar($(".ui-tabela-busca"), "Zé");
    expect($("tbody td.ui-vazio").textContent).toBe(
      "Nenhum registro encontrado.",
    );
  });

  it("mostra 50 por vez e carrega mais ao rolar perto do fim", async () => {
    const itens = Array.from({ length: 120 }, (_, i) => ({
      nome: `Pessoa ${i}`,
      total: i,
    }));
    await montarNoApp(h(TabelaInfinita, props({ itens, total: 120 })));
    expect(linhas().length).toBe(50);
    expect($("[data-tabela-mostrando]").textContent).toBe(
      "Mostrando 50 de 120 registros",
    );
    expect($("[data-tabela-contagem]").textContent).toBe("120");
    expect($(".ui-tabela-status").textContent).toBe("50 de 120 registros");

    const caixa = $(".ui-tabela-rolagem");
    Object.defineProperty(caixa, "scrollHeight", { value: 1000 });
    Object.defineProperty(caixa, "clientHeight", { value: 400 });
    caixa.scrollTop = 500;
    await act(async () => {
      caixa.dispatchEvent(new Event("scroll"));
    });
    expect(linhas().length).toBe(100);
  });
});

describe("Gaveta", () => {
  it("classes extras no fundo e no cartão; sem sobretítulo nem resumo, eles não aparecem", async () => {
    await montarNoApp(
      h(
        Gaveta,
        {
          id: "g",
          tituloId: "gt",
          aoFechar: () => {},
          className: "extra",
          cartaoClassName: "larga",
          titulo: "Modelos",
          rotuloDoFechar: "Fechar",
        },
        h("p", { id: "corpo" }, "corpo"),
      ),
    );
    const fundo = document.getElementById("g");
    expect(fundo.className).toBe("modal ui-gaveta-fundo extra show");
    expect(fundo.getAttribute("aria-labelledby")).toBe("gt");
    expect(fundo.querySelector(".modal-card").className).toBe(
      "modal-card ui-gaveta larga",
    );
    expect($("#gt").textContent).toBe("Modelos");
    expect($("#corpo")).not.toBeNull();
    expect($(".ui-gaveta-sobretitulo")).toBeNull();
    expect($(".ui-gaveta-resumo")).toBeNull();
  });
});

describe("Aviso, Campo, Selo e estados", () => {
  it("Aviso: tom, papel e o elemento pedido", async () => {
    await montarNoApp(
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
    await montarNoApp(
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
    const campo = $(".ui-campo");
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
    await montarNoApp(
      h(Campo, { rotulo: "Busca" }, h("input", { id: "filtro-busca" })),
    );
    expect($("label").htmlFor).toBe("filtro-busca");
    expect($("input").hasAttribute("aria-invalid")).toBe(false);
  });

  it("Selo: neutro por padrão, título e classe extra", async () => {
    await montarNoApp(
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
    const [neutro, aprovado] = document.querySelectorAll(".ui-selo");
    expect(neutro.dataset.tom).toBe("neutro");
    expect(aprovado.className).toBe("ui-selo extra");
    expect(aprovado.title).toBe("No prazo");
  });

  it("EstadoVazio e Carregando: a classe pedida no lugar de .ui-vazio", async () => {
    await montarNoApp(h(Carregando, { className: "ui-secao-vazio" }));
    expect($("#raiz > div").className).toBe("ui-secao-vazio");
  });
});

describe("Classes .ui-* e nenhum id fixo", () => {
  const IDS_DO_PAINEL_DE_ANALISES = [
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
  const idsDoPainelDeAnalises = () =>
    IDS_DO_PAINEL_DE_ANALISES.filter((id) => document.getElementById(id));

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
    expect(idsDoPainelDeAnalises()).toEqual([]);
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
    expect(idsDoPainelDeAnalises()).toEqual([]);
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
    expect(idsDoPainelDeAnalises()).toEqual([]);
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
