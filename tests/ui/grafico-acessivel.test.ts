// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

// O Chart.js não desenha no jsdom: um falso guarda o destaque pedido pelo teclado.
const destaques = vi.hoisted(() => [] as unknown[][]);
vi.mock("../../src/lib/base/chartjs-global.ts", () => {
  class Chart {
    data: { datasets: unknown[] };
    tooltip = { setActiveElements: () => undefined };
    constructor(_canvas: unknown, configuracao: { data: { datasets: [] } }) {
      this.data = configuracao.data;
    }
    setActiveElements(ativos: unknown[]) {
      destaques.push(ativos);
    }
    update() {}
    destroy() {}
  }
  return { chartCarregado: () => Chart, carregarChart: async () => Chart };
});

const { CardDeGrafico, Grafico } = await import("../../src/ui/index.ts");
const { dadosDaTabelaDoGrafico, textoDoPonto } =
  await import("../../src/ui/tabela-do-grafico.tsx");
const { proximoDestaque } = await import("../../src/ui/grafico.tsx");

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let raiz: Root | null = null;
afterEach(() => {
  act(() => raiz?.unmount());
  raiz = null;
  document.body.innerHTML = "";
  destaques.length = 0;
});

const DADOS = {
  labels: ["Cancelados", "Questionário", "Nota"],
  datasets: [{ label: "Eliminados", data: [1200, 35, 0] }],
};

async function montarCard() {
  const caixa = document.createElement("div");
  document.body.append(caixa);
  raiz = createRoot(caixa);
  await act(async () =>
    raiz!.render(
      h(
        CardDeGrafico,
        { titulo: "Eliminados" },
        h(Grafico<"bar">, {
          tipo: "bar",
          rotulo: "Eliminados antes da análise",
          dependencias: [],
          montar: () => ({ data: DADOS }),
        }),
      ),
    ),
  );
  return caixa;
}

describe("tabela dos valores do gráfico", () => {
  it("linhas são os rótulos e colunas as séries, em número brasileiro", () => {
    expect(dadosDaTabelaDoGrafico(DADOS)).toEqual({
      colunas: ["Eliminados"],
      linhas: [
        { rotulo: "Cancelados", valores: ["1.200"] },
        { rotulo: "Questionário", valores: ["35"] },
        { rotulo: "Nota", valores: ["0"] },
      ],
    });
    const duas = dadosDaTabelaDoGrafico({
      labels: [["Jan", "2026"], "Fev"],
      datasets: [{ data: [1.5, null] }, { label: "Aptos", data: [2] }],
    });
    expect(duas?.colunas).toEqual(["Série 1", "Aptos"]);
    expect(duas?.linhas).toEqual([
      { rotulo: "Jan 2026", valores: ["1,5", "2"] },
      { rotulo: "Fev", valores: ["—", "—"] },
    ]);
    expect(dadosDaTabelaDoGrafico({ labels: [], datasets: [] })).toBeNull();
  });

  it("o anúncio do item: rótulo e valor (com a série quando há mais de uma)", () => {
    const uma = dadosDaTabelaDoGrafico({
      labels: ["Sim", "Não"],
      datasets: [{ data: [3, 4] }],
    })!;
    expect(textoDoPonto(uma, 1)).toBe("Não: 4");
    expect(textoDoPonto(dadosDaTabelaDoGrafico(DADOS)!, 0)).toBe(
      "Cancelados: Eliminados 1.200",
    );
  });

  it("as setas dão a volta; Home e End vão às pontas", () => {
    expect(proximoDestaque(null, "+1", 3)).toBe(0);
    expect(proximoDestaque(null, "-1", 3)).toBe(2);
    expect(proximoDestaque(2, "+1", 3)).toBe(0);
    expect(proximoDestaque(0, "-1", 3)).toBe(2);
    expect(proximoDestaque(1, "inicio", 3)).toBe(0);
    expect(proximoDestaque(1, "fim", 3)).toBe(2);
  });
});

describe("Grafico no CardDeGrafico", () => {
  it("tabela escondida para o leitor de tela; o botão Tabela a mostra no lugar do gráfico", async () => {
    const caixa = await montarCard();
    const tabela = caixa.querySelector("[data-tabela-do-grafico]")!;
    expect(tabela.className).toBe("sr-only");
    expect(tabela.querySelector("caption")?.textContent).toBe(
      "Eliminados antes da análise",
    );
    expect(
      [...tabela.querySelectorAll("tbody tr")].map((tr) => tr.textContent),
    ).toEqual(["Cancelados1.200", "Questionário35", "Nota0"]);

    const botao = caixa.querySelector<HTMLButtonElement>(
      ".ui-grafico-alternar",
    )!;
    expect(botao.textContent).toBe("Tabela");
    expect(botao.getAttribute("aria-pressed")).toBe("false");
    await act(async () => botao.click());
    expect(botao.getAttribute("aria-pressed")).toBe("true");
    expect(caixa.querySelector("[data-tabela-do-grafico]")!.className).toBe(
      "ui-grafico-tabela",
    );
    expect(caixa.querySelector("canvas")!.hidden).toBe(true);
    expect(caixa.querySelector(".ui-grafico.is-em-tabela")).not.toBeNull();
  });

  it("o canvas entra no Tab; as setas destacam e anunciam o item", async () => {
    const caixa = await montarCard();
    const canvas = caixa.querySelector("canvas")!;
    expect(canvas.tabIndex).toBe(0);
    expect(canvas.getAttribute("role")).toBe("img");
    const vivo = caixa.querySelector('[aria-live="polite"]')!;
    const teclar = (key: string) =>
      act(async () => {
        canvas.dispatchEvent(
          new KeyboardEvent("keydown", { key, bubbles: true }),
        );
      });
    await teclar("ArrowRight");
    expect(vivo.textContent).toBe("Cancelados: Eliminados 1.200");
    expect(destaques.at(-1)).toEqual([{ datasetIndex: 0, index: 0 }]);
    await teclar("End");
    expect(vivo.textContent).toBe("Nota: Eliminados 0");
    await teclar("Escape");
    expect(vivo.textContent).toBe("");
    expect(destaques.at(-1)).toEqual([]);
  });

  it("card sem Grafico dentro não ganha o botão", async () => {
    const caixa = document.createElement("div");
    document.body.append(caixa);
    raiz = createRoot(caixa);
    await act(async () =>
      raiz!.render(h(CardDeGrafico, { titulo: "T" }, h("canvas"))),
    );
    expect(caixa.querySelector(".ui-grafico-alternar")).toBeNull();
  });
});
