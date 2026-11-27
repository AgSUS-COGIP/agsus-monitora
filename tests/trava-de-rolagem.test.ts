import { describe, expect, it } from "vitest";
import { travarRolagemDaPagina } from "../src/lib/base/trava-de-rolagem.ts";

describe("trava de rolagem da página", () => {
  it("só solta quando a última trava sai e devolve o overflow de antes", () => {
    const corpo = { style: { overflow: "auto" } };
    const mapa = travarRolagemDaPagina(corpo);
    expect(corpo.style.overflow).toBe("hidden");
    const busca = travarRolagemDaPagina(corpo);
    busca();
    // A busca fechou sobre o mapa em tela cheia: a página continua travada.
    expect(corpo.style.overflow).toBe("hidden");
    mapa();
    expect(corpo.style.overflow).toBe("auto");
  });

  it("soltar duas vezes a mesma trava não solta a dos outros", () => {
    const corpo = { style: { overflow: "" } };
    const uma = travarRolagemDaPagina(corpo);
    const outra = travarRolagemDaPagina(corpo);
    uma();
    uma();
    expect(corpo.style.overflow).toBe("hidden");
    outra();
    expect(corpo.style.overflow).toBe("");
  });
});
