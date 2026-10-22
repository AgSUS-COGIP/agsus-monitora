import { act, createElement, useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { montarModulo } from "../../src/app/montar-modulo.jsx";
import "../componentes/interacoes.js";

/*
  montarModulo: createRoot + StrictMode + ErrorBoundary, num helper só. Com
  `flushSync`, o DOM já existe quando a chamada volta (a barra lateral e os
  painéis dependem disso).
*/

let modulo = null;

beforeEach(() => {
  document.body.innerHTML = `<div id="a"></div><div id="b"></div>`;
});

afterEach(async () => {
  await act(async () => modulo?.desmontar());
  modulo = null;
  document.body.innerHTML = "";
});

describe("montarModulo", () => {
  it("com flushSync, desenha antes de a chamada voltar", () => {
    modulo = montarModulo(
      document.getElementById("a"),
      createElement("p", { id: "dentro" }, "pronto"),
      { flushSync: true },
    );
    expect(document.getElementById("dentro")?.textContent).toBe("pronto");
    expect(typeof modulo.desmontar).toBe("function");
    expect(typeof modulo.raiz.unmount).toBe("function");
  });

  it("sem flushSync, desenha no próximo ciclo do React", async () => {
    await act(async () => {
      modulo = montarModulo(
        document.getElementById("a"),
        createElement("p", { id: "dentro" }, "depois"),
      );
    });
    expect(document.getElementById("dentro")?.textContent).toBe("depois");
  });

  it("liga o StrictMode (efeitos montam, limpam e montam de novo)", async () => {
    const eventos = [];
    function ComEfeito() {
      useEffect(() => {
        eventos.push("montou");
        return () => eventos.push("limpou");
      }, []);
      return null;
    }
    await act(async () => {
      modulo = montarModulo(
        document.getElementById("a"),
        createElement(ComEfeito),
      );
    });
    expect(eventos).toEqual(["montou", "limpou", "montou"]);
  });

  it("isola o erro: um módulo quebrado não derruba o outro", async () => {
    const silencio = vi.spyOn(console, "error").mockImplementation(() => {});
    function Quebra() {
      throw new Error("quebrou");
    }
    let outro;
    await act(async () => {
      modulo = montarModulo(
        document.getElementById("a"),
        createElement(Quebra),
        {
          nome: "o módulo A",
        },
      );
      outro = montarModulo(
        document.getElementById("b"),
        createElement("p", null, "B de pé"),
      );
    });
    expect(
      document.querySelector("#a .ui-erro-do-modulo[role=alert]"),
    ).not.toBeNull();
    expect(document.getElementById("b").textContent).toBe("B de pé");
    await act(async () => outro.desmontar());
    silencio.mockRestore();
  });

  it("desmontar esvazia o elemento", async () => {
    modulo = montarModulo(
      document.getElementById("a"),
      createElement("p", null, "x"),
      { flushSync: true },
    );
    await act(async () => modulo.desmontar());
    modulo = null;
    expect(document.getElementById("a").innerHTML).toBe("");
  });
});
