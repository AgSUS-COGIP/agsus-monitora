import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { MaisDaCarga, usarCargaContinua } from "../../src/ui/index.ts";

/*
  O carregamento contínuo das listas em blocos e cartões (pente fino de
  16/11/2026): 50 itens por vez, "Carregar mais" (ou rolar perto do fim) traz
  mais 50, e recorte novo (outro filtro) volta aos 50 no mesmo desenho.
*/

let raiz: Root | null = null;
afterEach(() => {
  act(() => raiz?.unmount());
  raiz = null;
  document.body.innerHTML = "";
});

function Lista({ itens }: { itens: readonly number[] }) {
  const carga = usarCargaContinua(itens, itens.length);
  return createElement(
    "div",
    null,
    createElement(
      "ul",
      null,
      itens
        .slice(0, carga.limite)
        .map((i) => createElement("li", { key: i }, String(i))),
    ),
    createElement(MaisDaCarga, { carga, oQue: "pessoas" }),
  );
}

function desenhar(itens: readonly number[]) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const alvo = document.createElement("div");
  document.body.append(alvo);
  raiz = createRoot(alvo);
  act(() => raiz?.render(createElement(Lista, { itens })));
  return alvo;
}

const numeros = (quantos: number) =>
  Array.from({ length: quantos }, (_, i) => i);

describe("usarCargaContinua + MaisDaCarga", () => {
  it("desenha 50 e diz quanto falta", () => {
    const alvo = desenhar(numeros(130));
    expect(alvo.querySelectorAll("li")).toHaveLength(50);
    expect(alvo.querySelector("[role=status]")?.textContent).toBe(
      "50 de 130 pessoas",
    );
    expect(
      alvo.querySelector("[data-acao=carregar-mais]")?.textContent,
    ).toContain("Carregar mais 50");
  });

  it("Carregar mais traz mais 50 e some quando não falta nada", () => {
    const alvo = desenhar(numeros(130));
    const mais = () =>
      alvo.querySelector<HTMLButtonElement>("[data-acao=carregar-mais]");
    act(() => mais()?.click());
    expect(alvo.querySelectorAll("li")).toHaveLength(100);
    expect(mais()?.textContent).toContain("Carregar mais 30");
    act(() => mais()?.click());
    expect(alvo.querySelectorAll("li")).toHaveLength(130);
    expect(mais()).toBeNull();
    expect(alvo.querySelector("[data-carga-continua]")).toBeNull();
  });

  it("recorte novo volta aos 50", () => {
    const alvo = desenhar(numeros(130));
    act(() =>
      alvo
        .querySelector<HTMLButtonElement>("[data-acao=carregar-mais]")
        ?.click(),
    );
    expect(alvo.querySelectorAll("li")).toHaveLength(100);
    act(() => raiz?.render(createElement(Lista, { itens: numeros(120) })));
    expect(alvo.querySelectorAll("li")).toHaveLength(50);
  });

  it("lista curta: tudo à vista, sem botão", () => {
    const alvo = desenhar(numeros(12));
    expect(alvo.querySelectorAll("li")).toHaveLength(12);
    expect(alvo.querySelector("[data-carga-continua]")).toBeNull();
  });
});
