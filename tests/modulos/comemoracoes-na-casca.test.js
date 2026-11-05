import { StrictMode, act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { criarAleatorio } from "../../src/lib/fogos.ts";
import { filaDeComemoracoes } from "../../src/app/fila-de-comemoracoes.ts";
import { ComemoracoesDoApp } from "../../src/app/casca/pecas.tsx";
import {
  Comemoracoes,
  comemorar,
} from "../../src/modulos/comemoracao/comemoracoes.tsx";
import { filaDeQuadros } from "../shows-de-comemoracao.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/*
  As comemorações são filhas da casca (src/app/casca/pecas.tsx): o desenho
  baixa quando a primeira entra na fila; no StrictMode (que monta, desmonta
  e monta de novo) o laço de quadros não dobra e nada sobra no fim.
*/

let raiz = null;
let lugar = null;
afterEach(() => {
  act(() => filaDeComemoracoes.esvaziar());
  act(() => raiz?.unmount());
  lugar?.remove();
  raiz = null;
});

function montar(componente) {
  lugar = document.createElement("div");
  document.body.append(lugar);
  raiz = createRoot(lugar);
  act(() => raiz.render(createElement(StrictMode, null, componente)));
}

function janelaComCanvas() {
  const { quadros, requestAnimationFrame } = filaDeQuadros();
  const contexto = new Proxy({}, { get: () => () => {}, set: () => true });
  const doc = document.implementation.createHTMLDocument("t");
  Object.defineProperty(doc, "hidden", { value: false, configurable: true });
  const criar = doc.createElement.bind(doc);
  doc.createElement = (tag) => {
    const el = criar(tag);
    if (tag === "canvas") el.getContext = () => contexto;
    return el;
  };
  const janela = {
    innerWidth: 800,
    innerHeight: 600,
    requestAnimationFrame,
    matchMedia: () => ({ matches: false }),
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  };
  return { doc, janela, quadros };
}

describe("comemorações na casca", () => {
  it("sem comemoração, nada (nem o desenho baixa); com uma, o aviso aparece", async () => {
    montar(createElement(ComemoracoesDoApp));
    expect(document.querySelector(".comemoracao")).toBeNull();
    await act(async () => {
      comemorar({ texto: "Parabéns!", confete: false });
    });
    await act(async () => new Promise((r) => setTimeout(r, 0)));
    expect(document.querySelector(".comemoracao").textContent).toContain(
      "Parabéns!",
    );
  });

  it("no StrictMode, um laço de quadros só, e o show limpa tudo ao acabar", () => {
    const { doc, janela, quadros } = janelaComCanvas();
    montar(createElement(Comemoracoes));
    act(() => {
      comemorar({
        texto: "Fogos",
        teste: true,
        efeito: "fogos",
        doc,
        janela,
        aleatorio: criarAleatorio(2),
      });
    });
    expect(doc.querySelectorAll("canvas.comemoracao__fogos")).toHaveLength(1);
    // O StrictMode pediu dois quadros (monta duas vezes), mas só um laço anda.
    quadros.shift()(0);
    quadros.shift()(0);
    expect(quadros).toHaveLength(1);
    let agora = 0;
    let dancou = false;
    let confete = false;
    while (quadros.length) {
      quadros.shift()((agora += 16.7));
      // Um laço só até o fim (a dança e o confete não abrem outro).
      expect(quadros.length).toBeLessThanOrEqual(1);
      const danca = doc.querySelectorAll(".comemoracao__aya--danca");
      expect(danca.length).toBeLessThanOrEqual(1);
      if (danca.length) dancou = true;
      if (doc.querySelector("canvas.comemoracao__motor")) confete = true;
    }
    // A Aya dançou e soltou confete também no StrictMode.
    expect(dancou).toBe(true);
    expect(confete).toBe(true);
    expect(
      doc.querySelectorAll(
        ".comemoracao__fogos, .comemoracao__veu, .comemoracao__aya",
      ),
    ).toHaveLength(0);
    // O aviso fica até o tempo de leitura (ou o ×).
    expect(doc.querySelector(".comemoracao")).not.toBeNull();
  });
});
