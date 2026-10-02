import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { comemorar, soltarFogos } from "../src/modules/comemoracao.js";

/* Canvas 2D falso: só registra que desenhou. */
function janelaComCanvas() {
  const quadros = [];
  const contexto = new Proxy(
    {},
    {
      get: (alvo, chave) => (chave in alvo ? alvo[chave] : () => {}),
      set: () => true,
    },
  );
  const doc = document.implementation.createHTMLDocument("t");
  const criar = doc.createElement.bind(doc);
  doc.createElement = (tag) => {
    const el = criar(tag);
    if (tag === "canvas") el.getContext = () => contexto;
    return el;
  };
  const janela = {
    innerWidth: 1000,
    innerHeight: 700,
    requestAnimationFrame: (fn) => quadros.push(fn),
    matchMedia: () => ({ matches: false }),
  };
  return { doc, janela, quadros };
}

describe("fogos de artifício ao concluir", () => {
  it("sem canvas 2D não faz nada", () => {
    const doc = document.implementation.createHTMLDocument("t");
    expect(soltarFogos(doc, { requestAnimationFrame: () => {} })).toBe(false);
  });

  it("solta os fogos num canvas e o remove ao fim", () => {
    const { doc, janela, quadros } = janelaComCanvas();
    expect(soltarFogos(doc, janela, { intensidade: "festa" })).toBe(true);
    expect(doc.querySelectorAll("canvas.comemoracao__confete")).toHaveLength(1);
    quadros.shift()(0);
    quadros.shift()(100000);
    expect(doc.querySelector("canvas")).toBeNull();
  });

  it('"fogos" e "festa" põem fogos e confete juntos, com o aviso', () => {
    const { doc, janela } = janelaComCanvas();
    comemorar({ texto: "Parabéns!", confete: "festa", doc, janela });
    expect(doc.querySelector(".comemoracao").textContent).toContain(
      "Parabéns!",
    );
    expect(doc.querySelectorAll("canvas.comemoracao__confete")).toHaveLength(2);
  });

  it("com menos movimento, só o aviso", () => {
    const { doc, janela } = janelaComCanvas();
    janela.matchMedia = () => ({ matches: true });
    comemorar({ texto: "Parabéns!", confete: "fogos", doc, janela });
    expect(doc.querySelector(".comemoracao")).not.toBeNull();
    expect(doc.querySelector("canvas")).toBeNull();
  });

  it("o fim do tour (Concluir) celebra: fogos no tour, festa na trilha", () => {
    const aya = readFileSync("src/modulos/aya/aya.jsx", "utf8");
    expect(aya).toMatch(/motivo === "concluiu"\) celebrarFimDoTour\(tour\)/);
    expect(aya).toContain('confete: concluido.trilha ? "festa" : "fogos"');
    vi.restoreAllMocks();
  });
});
