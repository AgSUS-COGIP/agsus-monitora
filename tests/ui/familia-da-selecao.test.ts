import { act, createElement as h, useState } from "react";
import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AcoesDaLinha,
  Campo,
  gravarNaSessao,
  Kpi,
  lerDaSessao,
  MenuDeAcoes,
  usarEstadoDaSessao,
} from "../../src/ui/index.ts";
import { definido } from "../definido.ts";
import { SeletorDeEdital } from "../../src/componentes/seletor-de-edital.tsx";
import {
  clicar,
  digitar,
  escolher,
  teclar,
} from "../componentes/interacoes.ts";

/*
  As peças compartilhadas das telas da seleção (Triagem, Avaliação
  documental e Classificação): a barra de "encontrar a pessoa", as ações da
  linha (principal + "⋯"), o complemento do KPI, o filtro guardado na sessão
  e o seletor de edital.
*/

let raiz: Root | null = null;
async function montar(elemento: ReactElement) {
  document.body.innerHTML = `<div id="raiz"></div>`;
  await act(async () => {
    const novaRaiz = createRoot(definido(document.getElementById("raiz")));
    raiz = novaRaiz;
    novaRaiz.render(elemento);
  });
}
afterEach(async () => {
  await act(async () => raiz?.unmount());
  raiz = null;
  document.body.innerHTML = "";
  sessionStorage.clear();
});
const $ = <E extends Element = HTMLElement>(seletor: string) =>
  document.querySelector<E>(seletor);

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
    const mais = definido(
      $<HTMLElement>(".ui-menu-compacto [data-acao='abrir-menu']"),
    );
    expect(mais.className).toBe("ui-menu-reticencias");
    expect(mais.getAttribute("aria-label")).toBe("Mais ações de 7000123");
    expect(mais.textContent).toBe("");
    await clicar(mais);
    const lista = definido($<HTMLElement>("[role='menu']"));
    // Presa à janela: a rolagem da tabela não corta a lista.
    expect(lista.style.position).toBe("fixed");
    expect($("[data-acao='copiar'] kbd.ui-menu-atalho")?.textContent).toBe("C");
    expect($("[data-acao='copiar']")?.getAttribute("aria-keyshortcuts")).toBe(
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

    await act(async () =>
      definido(raiz).render(h(AcoesDaLinha, { pessoa: "1" })),
    );
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
    const botao = definido($<HTMLButtonElement>(".ui-acoes-da-linha button"));
    expect(botao.textContent?.trim()).toBe("Gerando PDF…");
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
    expect($("[data-kpi='a'] .ui-kpi-valor")?.textContent).toBe("120");
    expect($("[data-kpi='a'] .ui-kpi-linha .ui-kpi-detalhe")?.textContent).toBe(
      "45%",
    );
    expect($("[data-kpi='b'] .ui-kpi-linha")).toBeNull();
    expect($("[data-kpi='b'] .ui-kpi-detalhe")).toBeNull();
  });
});

describe("estado guardado na sessão", () => {
  // O guardado pode ser qualquer coisa: só o `busca` de um objeto conta.
  const normalizar = (v: unknown) => ({
    busca: String(
      v && typeof v === "object" ? (Reflect.get(v, "busca") ?? "") : "",
    ),
  });
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
    let mudar: ((novo: { busca: string }) => void) | undefined;
    function Tela({ chave }: { chave: string }) {
      const [f, setF] = usarEstadoDaSessao(chave, { busca: "" }, normalizar);
      mudar = setF;
      return h("output", null, f.busca);
    }
    await montar(h(Tela, { chave: "tela:e1" }));
    expect($("output")?.textContent).toBe("guardada");
    await act(async () => definido(raiz).render(h(Tela, { chave: "tela:e2" })));
    expect($("output")?.textContent).toBe("");
    await act(async () => definido(mudar)({ busca: "nova" }));
    expect(sessionStorage.getItem("tela:e2")).toBe('{"busca":"nova"}');
    await act(async () => definido(raiz).render(h(Tela, { chave: "tela:e1" })));
    expect($("output")?.textContent).toBe("guardada");
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

  it("em linha no cabeçalho: campo Edital, selo de treinamento e a classe da tela", async () => {
    const escolheu = vi.fn();
    await montar(
      h(SeletorDeEdital, {
        className: "avd-edital",
        tour: "seletor",
        editais: EDITAIS,
        escolhido: "e3",
        carregado: true,
        aoEscolher: escolheu,
      }),
    );
    const card = definido(
      $<HTMLElement>("section.ui-seletor-de-edital.avd-edital"),
    );
    expect(card.classList.contains("ui-card")).toBe(false);
    expect(card.getAttribute("aria-label")).toBe("Edital");
    const opcoes = [...card.querySelectorAll("option")].map(
      (o) => o.textContent,
    );
    expect(opcoes).toEqual([
      "Escolha o edital",
      "93/2026 - Boa Vista",
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
      definido(raiz).render(
        h(SeletorDeEdital, {
          editais: [],
          escolhido: "",
          carregado: false,
          aoEscolher: () => {},
        }),
      ),
    );
    expect($("option")?.textContent).toBe("Carregando…");
    expect($<HTMLSelectElement>("select")?.disabled).toBe(true);
    await act(async () =>
      definido(raiz).render(
        h(SeletorDeEdital, {
          editais: [],
          escolhido: "",
          carregado: true,
          vazio: "Nenhum edital com análises nesta área",
          aoEscolher: () => {},
        }),
      ),
    );
    expect($("option")?.textContent).toBe(
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
    expect($(".ui-kpi-valor")?.textContent).toBe("1.512");
    expect($(".ui-kpi-detalhe")?.title).toBe(
      "1.511 pela regra · 1 por decisão",
    );
  });
});
