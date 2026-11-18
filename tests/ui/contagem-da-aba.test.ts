// @vitest-environment jsdom
import { act, createElement as h } from "react";
import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Abas,
  ContagemDaAba,
  formatarContagem,
  Segmentado,
} from "../../src/ui/index.ts";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let raiz: Root | null = null;

function montar(elemento: ReactElement) {
  const caixa = document.createElement("div");
  document.body.append(caixa);
  raiz = createRoot(caixa);
  act(() => raiz!.render(elemento));
  return caixa;
}

afterEach(() => {
  act(() => raiz?.unmount());
  raiz = null;
  document.body.innerHTML = "";
});

describe("formatarContagem", () => {
  it("milhar com ponto, texto como veio, nada no zero", () => {
    expect(formatarContagem(18325)).toBe("18.325");
    expect(formatarContagem(7)).toBe("7");
    expect(formatarContagem("3%")).toBe("3%");
    expect(formatarContagem(" 4/12 ")).toBe("4/12");
    expect(formatarContagem(0)).toBe("");
    expect(formatarContagem("0")).toBe("");
    expect(formatarContagem("")).toBe("");
    expect(formatarContagem(null)).toBe("");
    expect(formatarContagem(undefined)).toBe("");
    expect(formatarContagem(Number.NaN)).toBe("");
    expect(formatarContagem(0, true)).toBe("0");
  });
});

describe("ContagemDaAba", () => {
  it("desenha o número com o tom; some no zero", () => {
    const caixa = montar(
      h("div", null, [
        h(ContagemDaAba, { key: "a", valor: 18325, id: "alertas" }),
        h(ContagemDaAba, { key: "b", valor: 3, tom: "alerta", id: "pend" }),
        h(ContagemDaAba, { key: "c", valor: 0, id: "zero" }),
      ]),
    );
    const alertas = caixa.querySelector("#alertas")!;
    expect(alertas.textContent).toBe("18.325");
    expect(alertas.className).toBe("ui-aba-contagem");
    expect(alertas.getAttribute("data-tom")).toBe("neutro");
    expect(caixa.querySelector("#pend")!.getAttribute("data-tom")).toBe(
      "alerta",
    );
    expect(caixa.querySelector("#zero")).toBeNull();
  });
});

describe("contagem no rótulo", () => {
  it("Abas: o número entra no nome da aba", () => {
    const caixa = montar(
      h(Abas, {
        rotulo: "Visões",
        ativa: "alertas",
        aoEscolher: vi.fn(),
        abas: [
          { id: "alertas", rotulo: "Alertas", contagem: 18325 },
          { id: "cobertura", rotulo: "Cobertura", contagem: "3%" },
          { id: "vazia", rotulo: "Vazia", contagem: 0 },
        ],
      }),
    );
    const textos = [...caixa.querySelectorAll('[role="tab"]')].map(
      (aba) => aba.textContent,
    );
    expect(textos).toEqual(["Alertas18.325", "Cobertura3%", "Vazia"]);
    expect(caixa.querySelectorAll(".ui-aba-contagem")).toHaveLength(2);
  });

  it("Segmentado: a opção leva a contagem e o tom", () => {
    const caixa = montar(
      h(Segmentado, {
        rotulo: "Seções",
        valor: "fila",
        aoMudar: vi.fn(),
        opcoes: [
          { valor: "fila", rotulo: "Fila", contagem: 12 },
          {
            valor: "pendencias",
            rotulo: "Pendências",
            contagem: 2,
            tomDaContagem: "alerta",
          },
          { valor: "preparar", rotulo: "Preparar" },
        ],
      }),
    );
    const opcoes = caixa.querySelectorAll('[role="radio"]');
    expect(opcoes[0]!.textContent).toBe("Fila12");
    expect(
      opcoes[1]!.querySelector(".ui-aba-contagem")!.getAttribute("data-tom"),
    ).toBe("alerta");
    expect(opcoes[2]!.querySelector(".ui-aba-contagem")).toBeNull();
  });
});
