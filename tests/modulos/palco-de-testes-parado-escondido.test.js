import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
  22/10: Configurações monta no carregamento do app e a miniatura do palco de
  Comemorações animava o canvas para sempre, mesmo com a seção fechada. Agora
  o laço só anda com o canvas à vista (IntersectionObserver).
*/

vi.mock("../../src/modules/comemoracao.js", async (original) => ({
  ...(await original()),
  desenharPrevia: () => {},
  semMovimento: () => false,
}));

const { PalcoDeTestes } =
  await import("../../src/modulos/configuracoes/palco-de-testes.tsx");

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let vigias;
let raiz;
let host;
beforeEach(() => {
  vigias = [];
  window.IntersectionObserver = class {
    constructor(aoMudar) {
      this.aoMudar = aoMudar;
      this.desligado = false;
      vigias.push(this);
    }
    observe() {}
    disconnect() {
      this.desligado = true;
    }
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    setTransform() {},
    clearRect() {},
  });
  vi.spyOn(window, "requestAnimationFrame").mockReturnValue(7);
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  host = document.createElement("div");
  document.body.append(host);
});
afterEach(async () => {
  await act(async () => raiz?.unmount());
  host.remove();
  delete window.IntersectionObserver;
  vi.restoreAllMocks();
});

describe("miniatura do palco de testes", () => {
  it("escondida não anima; à vista anda; escondida de novo para", async () => {
    await act(async () => {
      raiz = createRoot(host);
      raiz.render(createElement(PalcoDeTestes, { testar: () => {} }));
    });
    expect(vigias).toHaveLength(1);
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();

    vigias[0].aoMudar([{ isIntersecting: true }]);
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);

    vigias[0].aoMudar([{ isIntersecting: false }]);
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(7);

    await act(async () => raiz.unmount());
    raiz = null;
    expect(vigias[0].desligado).toBe(true);
  });
});
