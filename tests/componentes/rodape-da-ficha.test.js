import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { RodapeDaFicha } from "../../src/modulos/avaliacao-documental/ficha/rodape-da-ficha.tsx";

/*
  No celular as setas Anterior / Próximo da ficha escondem o texto
  (ficha.css, display: none no span) e ficavam sem nome acessível
  (auditoria das telas, 13/10/2026).
*/
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let raiz = null;
afterEach(() => {
  act(() => raiz?.unmount());
  raiz = null;
  document.body.innerHTML = "";
});

describe("rodapé da ficha", () => {
  it("as setas têm nome mesmo sem o texto à vista", () => {
    const conteiner = document.createElement("div");
    document.body.append(conteiner);
    raiz = createRoot(conteiner);
    act(() =>
      raiz.render(
        createElement(RodapeDaFicha, {
          estado: "Salvo às 10:43",
          anterior: {
            rotulo: "Anterior",
            acao: "anterior",
            aoClicar: () => {},
          },
          proximo: { rotulo: "Próximo", acao: "proximo", aoClicar: () => {} },
        }),
      ),
    );
    expect(
      conteiner
        .querySelector("[data-acao=anterior]")
        .getAttribute("aria-label"),
    ).toBe("Anterior");
    expect(
      conteiner.querySelector("[data-acao=proximo]").getAttribute("aria-label"),
    ).toBe("Próximo");
  });
});
