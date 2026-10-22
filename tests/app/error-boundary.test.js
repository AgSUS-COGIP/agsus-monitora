import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "../../src/app/ErrorBoundary.jsx";
import { clicar } from "../componentes/interacoes.js";

/*
  O ErrorBoundary de src/app/: erro de render num filho vira um aviso curto
  (com "Tentar de novo"), o erro vai para o console, e o resto da página fica.
*/

let raiz = null;
let espiaoDoConsole;

beforeEach(() => {
  // O React também reclama no console de erro capturado; o teste só confere o nosso.
  espiaoDoConsole = vi.spyOn(console, "error").mockImplementation(() => {});
  document.body.innerHTML = `<div id="fora">fora</div><div id="raiz"></div>`;
});

afterEach(async () => {
  await act(async () => raiz?.unmount());
  raiz = null;
  espiaoDoConsole.mockRestore();
  document.body.innerHTML = "";
});

async function montar(elemento) {
  await act(async () => {
    raiz = createRoot(document.getElementById("raiz"));
    raiz.render(elemento);
  });
}

describe("ErrorBoundary", () => {
  it("desenha os filhos quando não há erro", async () => {
    await montar(
      createElement(ErrorBoundary, null, createElement("p", null, "conteúdo")),
    );
    expect(document.getElementById("raiz").textContent).toBe("conteúdo");
    expect(document.querySelector("[role=alert]")).toBeNull();
  });

  it("captura o erro do filho, mostra o aviso e registra no console", async () => {
    function Quebra() {
      throw new Error("falhou o render");
    }
    await montar(
      createElement(ErrorBoundary, { nome: "o teste" }, createElement(Quebra)),
    );
    const aviso = document.querySelector(".ui-erro-do-modulo[role=alert]");
    expect(aviso).not.toBeNull();
    expect(aviso.textContent).toContain("Não foi possível mostrar");
    expect(aviso.querySelector("button").textContent).toBe("Tentar de novo");
    // O resto da página continua lá.
    expect(document.getElementById("fora").textContent).toBe("fora");
    const nosso = espiaoDoConsole.mock.calls.find((chamada) =>
      String(chamada[0]).includes("[MONITORA] Erro ao desenhar o teste"),
    );
    expect(nosso?.[1]?.message).toBe("falhou o render");
  });

  it("“Tentar de novo” remonta os filhos do zero", async () => {
    let falhar = true;
    let montagens = 0;
    function Instavel() {
      if (falhar) throw new Error("ainda não");
      montagens += 1;
      return createElement("p", null, "voltou");
    }
    await montar(createElement(ErrorBoundary, null, createElement(Instavel)));
    expect(document.querySelector(".ui-erro-do-modulo")).not.toBeNull();

    falhar = false;
    await clicar(document.querySelector(".ui-erro-do-modulo button"));
    expect(document.querySelector(".ui-erro-do-modulo")).toBeNull();
    expect(document.getElementById("raiz").textContent).toBe("voltou");
    expect(montagens).toBeGreaterThan(0);
  });
});
