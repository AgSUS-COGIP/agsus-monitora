import { act, createElement as h, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AcoesDaLinha,
  BarraDeFiltros,
  Campo,
  gravarNaSessao,
  Kpi,
  lerDaSessao,
  MenuDeAcoes,
  usarEstadoDaSessao,
} from "../../src/ui/index.ts";
import { SeletorDeEdital } from "../../src/componentes/seletor-de-edital.tsx";
import {
  clicar,
  digitar,
  escolher,
  teclar,
} from "../componentes/interacoes.js";

/*
  As peças compartilhadas das telas da seleção (Triagem, Avaliação
  documental e Classificação): a barra de "encontrar a pessoa", as ações da
  linha (principal + "⋯"), o complemento do KPI, o filtro guardado na sessão
  e o seletor de edital.
*/

let raiz = null;
async function montar(elemento) {
  document.body.innerHTML = `<div id="raiz"></div>`;
  await act(async () => {
    raiz = createRoot(document.getElementById("raiz"));
    raiz.render(elemento);
  });
}
afterEach(async () => {
  await act(async () => raiz?.unmount());
  raiz = null;
  document.body.innerHTML = "";
  sessionStorage.clear();
});
const $ = (seletor) => document.querySelector(seletor);

describe("BarraDeFiltros", () => {
  function Barra({ aoLimpar = () => {} }) {
    const [busca, setBusca] = useState("");
    const [vaga, setVaga] = useState("");
    return h(
      BarraDeFiltros,
      {
        rotulo: "Encontrar a pessoa",
        busca: {
          valor: busca,
          aoMudar: setBusca,
          placeholder: "Código ou nome",
          rotulo: "Buscar pessoa",
          acao: "buscar",
        },
        quantos: [busca, vaga].filter(Boolean).length,
        aoLimpar: () => {
          setBusca("");
          setVaga("");
          aoLimpar();
        },
        resultado: "12 pessoas",
        acoes: h("button", { type: "button", "data-acao": "minha" }, "Minha"),
      },
      h(
        Campo,
        { rotulo: "Vaga" },
        h(
          "select",
          { value: vaga, onChange: (ev) => setVaga(ev.target.value) },
          h("option", { value: "" }, "Todas"),
          h("option", { value: "1" }, "Vaga 1"),
        ),
      ),
    );
  }

  it("a busca vem primeiro, os filtros em linha, o resultado e Limpar só com filtro", async () => {
    const limpou = vi.fn();
    await montar(h(Barra, { aoLimpar: limpou }));
    const barra = $("section.ui-card.ui-barra-de-filtros");
    expect(barra.getAttribute("aria-label")).toBe("Encontrar a pessoa");
    const busca = $("[data-acao='buscar']");
    expect(busca.type).toBe("search");
    expect(busca.getAttribute("aria-keyshortcuts")).toBe("/");
    expect(barra.querySelector(".ui-barra-busca .sr-only").textContent).toBe(
      "Buscar pessoa",
    );
    expect($(".ui-barra-de-filtros-campos select")).not.toBeNull();
    expect($(".ui-barra-de-filtros-acoes [data-acao='minha']")).not.toBeNull();
    expect($(".ui-barra-resultado").textContent).toBe("12 pessoas");
    expect($(".ui-barra-quantos").textContent).toBe("Sem filtros");
    expect($("[data-acao='limpar-filtros']").disabled).toBe(true);

    await digitar(busca, "ana");
    await escolher($(".ui-barra-de-filtros-campos select"), "1");
    expect($(".ui-barra-quantos").textContent).toBe("2 filtros");
    expect($(".ui-barra-quantos").classList.contains("tem-filtros")).toBe(true);
    await clicar($("[data-acao='limpar-filtros']"));
    expect(limpou).toHaveBeenCalledTimes(1);
    expect(busca.value).toBe("");
    expect($(".ui-barra-quantos").textContent).toBe("Sem filtros");
  });

  it('"/" leva à busca de fora de um campo; dentro de um campo, é só um caractere; Esc apaga', async () => {
    await montar(h(Barra));
    const busca = $("[data-acao='buscar']");
    // O jsdom não calcula layout: a barra "está à vista" pelo offsetParent.
    Object.defineProperty(busca, "offsetParent", {
      configurable: true,
      get: () => document.body,
    });
    await teclar(document.body, "/");
    expect(document.activeElement).toBe(busca);
    const select = $(".ui-barra-de-filtros-campos select");
    select.focus();
    await teclar(select, "/");
    expect(document.activeElement).toBe(select);
    await digitar(busca, "maria");
    await teclar(busca, "Escape");
    expect(busca.value).toBe("");
  });
});

describe("AcoesDaLinha", () => {
  it("o principal com rótulo direto e o ⋯ com o nome da pessoa; ocupado troca o texto", async () => {
    const abrir = vi.fn();
    const copiar = vi.fn();
    await montar(
      h(AcoesDaLinha, {
        pessoa: "7000123",
        principal: { rotulo: "Abrir", acao: "abrir", aoClicar: abrir },
        outras: [
          {
            id: "copiar",
            rotulo: "Copiar código",
            aoEscolher: copiar,
            atalho: "C",
            dados: { "data-acao": "copiar" },
          },
        ],
      }),
    );
    await clicar($("[data-acao='abrir']"));
    expect(abrir).toHaveBeenCalledTimes(1);
    const mais = $(".ui-menu-compacto [data-acao='abrir-menu']");
    expect(mais.className).toBe("ui-menu-reticencias");
    expect(mais.getAttribute("aria-label")).toBe("Mais ações de 7000123");
    expect(mais.textContent).toBe("");
    await clicar(mais);
    const lista = $("[role='menu']");
    // Presa à janela: a rolagem da tabela não corta a lista.
    expect(lista.style.position).toBe("fixed");
    expect($("[data-acao='copiar'] kbd.ui-menu-atalho").textContent).toBe("C");
    expect($("[data-acao='copiar']").getAttribute("aria-keyshortcuts")).toBe(
      "C",
    );
    await clicar($("[data-acao='copiar']"));
    expect(copiar).toHaveBeenCalledTimes(1);
    expect($("[role='menu']")).toBeNull();
  });

  it("a lista fixa fecha quando a página rola; sem nada, nada é desenhado", async () => {
    await montar(
      h(MenuDeAcoes, {
        compacto: true,
        rotulo: "Mais ações de 1",
        acoes: [{ id: "a", rotulo: "A", aoEscolher: () => {} }],
      }),
    );
    await clicar($("[data-acao='abrir-menu']"));
    expect($("[role='menu']")).not.toBeNull();
    await act(async () => {
      document.dispatchEvent(new Event("scroll"));
    });
    expect($("[role='menu']")).toBeNull();

    await act(async () => raiz.render(h(AcoesDaLinha, { pessoa: "1" })));
    expect($(".ui-acoes-da-linha")).toBeNull();
  });

  it("principal ocupado: o texto da ação e o botão desligado", async () => {
    await montar(
      h(AcoesDaLinha, {
        pessoa: "1",
        principal: {
          rotulo: "PDF",
          icone: "fa-file-pdf",
          ocupado: "Gerando PDF…",
          aoClicar: () => {},
        },
      }),
    );
    const botao = $(".ui-acoes-da-linha button");
    expect(botao.textContent.trim()).toBe("Gerando PDF…");
    expect(botao.disabled).toBe(true);
    expect($(".ui-menu")).toBeNull();
  });
});

describe("Kpi com detalhe", () => {
  it("o complemento fica ao lado do número, menor; vazio não aparece", async () => {
    await montar(
      h(
        "div",
        null,
        h(Kpi, {
          chave: "a",
          rotulo: "Concluídas",
          valor: "120",
          detalhe: "45%",
        }),
        h(Kpi, { chave: "b", rotulo: "Pendentes", valor: "3", detalhe: "" }),
      ),
    );
    // O número continua sozinho no .ui-kpi-valor (contrato das telas).
    expect($("[data-kpi='a'] .ui-kpi-valor").textContent).toBe("120");
    expect($("[data-kpi='a'] .ui-kpi-linha .ui-kpi-detalhe").textContent).toBe(
      "45%",
    );
    expect($("[data-kpi='b'] .ui-kpi-linha")).toBeNull();
    expect($("[data-kpi='b'] .ui-kpi-detalhe")).toBeNull();
  });
});

describe("estado guardado na sessão", () => {
  const normalizar = (v) => ({ busca: String(v?.busca ?? "") });
  it("lê e grava por chave; o inicial apaga; sem chave, não guarda", () => {
    expect(lerDaSessao("k", { busca: "" }, normalizar)).toEqual({ busca: "" });
    gravarNaSessao("k", { busca: "ana" }, { busca: "" });
    expect(sessionStorage.getItem("k")).toBe('{"busca":"ana"}');
    expect(lerDaSessao("k", { busca: "" }, normalizar)).toEqual({
      busca: "ana",
    });
    gravarNaSessao("k", { busca: "" }, { busca: "" });
    expect(sessionStorage.getItem("k")).toBeNull();
    gravarNaSessao("", { busca: "x" }, { busca: "" });
    expect(sessionStorage.length).toBe(0);
    sessionStorage.setItem("ruim", "{nao é json");
    expect(lerDaSessao("ruim", { busca: "" }, normalizar)).toEqual({
      busca: "",
    });
  });

  it("o hook volta com o guardado e troca junto com a chave", async () => {
    sessionStorage.setItem("tela:e1", '{"busca":"guardada"}');
    let mudar;
    function Tela({ chave }) {
      const [f, setF] = usarEstadoDaSessao(chave, { busca: "" }, normalizar);
      mudar = setF;
      return h("output", null, f.busca);
    }
    await montar(h(Tela, { chave: "tela:e1" }));
    expect($("output").textContent).toBe("guardada");
    await act(async () => raiz.render(h(Tela, { chave: "tela:e2" })));
    expect($("output").textContent).toBe("");
    await act(async () => mudar({ busca: "nova" }));
    expect(sessionStorage.getItem("tela:e2")).toBe('{"busca":"nova"}');
    await act(async () => raiz.render(h(Tela, { chave: "tela:e1" })));
    expect($("output").textContent).toBe("guardada");
  });
});

describe("SeletorDeEdital", () => {
  const EDITAIS = [
    { id: "e1", edital: "93/2026", unidade: "Boa Vista", ativo: true },
    {
      id: "e2",
      edital: "50/2025",
      unidade: "Manaus",
      ativo: false,
    },
    { id: "e3", edital: "Treino", treinamento: true, ativo: true },
  ];

  it("o card de sempre: campo Edital, selo de treinamento e a classe da tela", async () => {
    const escolheu = vi.fn();
    await montar(
      h(SeletorDeEdital, {
        className: "classificacao-edital",
        tour: "seletor",
        editais: EDITAIS,
        escolhido: "e3",
        carregado: true,
        complemento: (ed) => (ed.id === "e1" ? " (120)" : ""),
        aoEscolher: escolheu,
      }),
    );
    const card = $("section.ui-card.ui-seletor-de-edital.classificacao-edital");
    expect(card.getAttribute("aria-label")).toBe("Edital");
    const opcoes = [...card.querySelectorAll("option")].map(
      (o) => o.textContent,
    );
    expect(opcoes).toEqual([
      "Escolha o edital",
      "93/2026 - Boa Vista (120)",
      "50/2025 - Manaus",
      "Treino · Treinamento",
    ]);
    expect(card.querySelector(".selo-de-treinamento")).not.toBeNull();
    expect(card.querySelector("input[type='checkbox']")).toBeNull();
    await escolher(card.querySelector("select[data-tour='seletor']"), "e1");
    expect(escolheu).toHaveBeenCalledWith("e1");
  });

  it("só vigentes: o inativo sai e volta com Mostrar todos; carregando e vazio", async () => {
    await montar(
      h(SeletorDeEdital, {
        editais: EDITAIS,
        escolhido: "",
        carregado: true,
        soVigentes: true,
        aoEscolher: () => {},
      }),
    );
    const valores = () =>
      [...document.querySelectorAll("option")].map((o) => o.value);
    expect(valores()).not.toContain("e2");
    await clicar($(".ui-seletor-todos input"));
    expect(valores()).toContain("e2");

    await act(async () =>
      raiz.render(
        h(SeletorDeEdital, {
          editais: [],
          escolhido: "",
          carregado: false,
          aoEscolher: () => {},
        }),
      ),
    );
    expect($("option").textContent).toBe("Carregando…");
    expect($("select").disabled).toBe(true);
    await act(async () =>
      raiz.render(
        h(SeletorDeEdital, {
          editais: [],
          escolhido: "",
          carregado: true,
          vazio: "Nenhum edital com análises nesta área",
          aoEscolher: () => {},
        }),
      ),
    );
    expect($("option").textContent).toBe(
      "Nenhum edital com análises nesta área",
    );
  });
});

describe("Kpi com número grande", () => {
  it("o número é formatado pela tela; o detalhe longo leva o texto inteiro no title", async () => {
    await montar(
      h(Kpi, {
        chave: "lote",
        rotulo: "Lote",
        valor: (1512).toLocaleString("pt-BR"),
        detalhe: "1.511 pela regra · 1 por decisão",
      }),
    );
    expect($(".ui-kpi-valor").textContent).toBe("1.512");
    expect($(".ui-kpi-detalhe").title).toBe("1.511 pela regra · 1 por decisão");
  });
});
