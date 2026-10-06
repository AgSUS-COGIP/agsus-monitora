import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  comemorar,
  soltarConfete,
  soltarFogos,
} from "../src/modules/comemoracao.js";

/* Canvas 2D falso: registra o que foi chamado e o que foi atribuído. */
function janelaComCanvas({ dpr = 1, tema = "" } = {}) {
  const quadros = [];
  const chamadas = [];
  const contagem = {};
  const atribuicoes = {};
  const contexto = new Proxy(
    {},
    {
      get:
        (_, chave) =>
        (...args) => {
          contagem[chave] = (contagem[chave] || 0) + 1;
          if (chave === "setTransform") chamadas.push([chave, ...args]);
        },
      set: (_, chave, valor) => {
        (atribuicoes[chave] ??= new Set()).add(valor);
        return true;
      },
    },
  );
  const doc = document.implementation.createHTMLDocument("t");
  // O documento do jsdom nasce "oculto"; aqui a aba está visível.
  Object.defineProperty(doc, "hidden", { value: false, configurable: true });
  if (tema) doc.documentElement.setAttribute("data-theme", tema);
  const criar = doc.createElement.bind(doc);
  doc.createElement = (tag) => {
    const el = criar(tag);
    if (tag === "canvas") el.getContext = () => contexto;
    return el;
  };
  const janela = {
    innerWidth: 1000,
    innerHeight: 700,
    devicePixelRatio: dpr,
    requestAnimationFrame: (fn) => quadros.push(fn),
    matchMedia: () => ({ matches: false }),
    getComputedStyle: () => ({
      getPropertyValue: (nome) => (nome === "--brand-primary" ? "#0f5db7" : ""),
    }),
  };
  /* Roda os quadros a ~60 fps até o show acabar (ou `limite` quadros). */
  const rodar = (limite = 2000) => {
    let agora = 0;
    let n = 0;
    while (quadros.length && n < limite) {
      quadros.shift()(agora);
      agora += 16.7;
      n += 1;
    }
    return { n, agora };
  };
  return { doc, janela, quadros, chamadas, contagem, atribuicoes, rodar };
}

describe("fogos de artifício no canvas", () => {
  it("sem canvas 2D ou sem requestAnimationFrame não faz nada", () => {
    const doc = document.implementation.createHTMLDocument("t");
    expect(soltarFogos(doc, { requestAnimationFrame: () => {} })).toBe(false);
    const { doc: comCanvas } = janelaComCanvas();
    expect(soltarFogos(comCanvas, { innerWidth: 10 })).toBe(false);
    expect(comCanvas.querySelector("canvas")).toBeNull();
  });

  it("um canvas sem clique, escondido do leitor de tela, nítido no devicePixelRatio", () => {
    const { doc, janela, chamadas } = janelaComCanvas({ dpr: 3 });
    expect(soltarFogos(doc, janela)).toBe(true);
    const canvas = doc.querySelector("canvas.comemoracao__fogos");
    expect(canvas.getAttribute("aria-hidden")).toBe("true");
    // DPR limitado a 2.
    expect(canvas.width).toBe(2000);
    expect(canvas.height).toBe(1400);
    expect(chamadas).toContainEqual(["setTransform", 2, 0, 0, 2, 0, 0]);
    const css = readFileSync("src/styles/comemoracao.css", "utf8");
    expect(css).toMatch(/\.comemoracao__fogos \{[^}]*pointer-events: none/);
  });

  it("desenha estouros com rastro e remove o canvas sozinho em até 4,5 s", () => {
    const { doc, janela, contagem, atribuicoes, rodar } = janelaComCanvas({
      tema: "dark",
    });
    soltarFogos(doc, janela, { intensidade: "festa" });
    const { agora } = rodar();
    expect(doc.querySelector("canvas")).toBeNull();
    expect(agora).toBeLessThanOrEqual(4600);
    expect(contagem.stroke).toBeGreaterThan(1000);
    expect([...atribuicoes.globalCompositeOperation]).toEqual(
      expect.arrayContaining(["destination-out", "lighter"]),
    );
    // A cor da marca, lida do tema.
    expect(atribuicoes.strokeStyle.has("#0f5db7")).toBe(true);
  });

  it("no tema claro não soma luz (some no fundo branco)", () => {
    const { doc, janela, atribuicoes, rodar } = janelaComCanvas();
    soltarFogos(doc, janela);
    rodar();
    expect(atribuicoes.globalCompositeOperation.has("lighter")).toBe(false);
    expect(atribuicoes.globalCompositeOperation.has("source-over")).toBe(true);
  });

  it("com a aba oculta, o show não avança", () => {
    const { doc, janela, quadros } = janelaComCanvas();
    soltarFogos(doc, janela);
    Object.defineProperty(doc, "hidden", { value: true, configurable: true });
    let agora = 0;
    for (let i = 0; i < 600; i += 1) quadros.shift()((agora += 16.7));
    expect(doc.querySelector("canvas")).not.toBeNull();
    Object.defineProperty(doc, "hidden", { value: false, configurable: true });
    while (quadros.length) quadros.shift()((agora += 16.7));
    expect(doc.querySelector("canvas")).toBeNull();
  });

  it("soltarConfete (nome antigo) solta os mesmos fogos", () => {
    const { doc, janela } = janelaComCanvas();
    expect(soltarConfete(doc, janela, { quantidade: 50 })).toBe(true);
    expect(doc.querySelectorAll("canvas.comemoracao__fogos")).toHaveLength(1);
  });

  it("comemorar põe o aviso e um canvas de fogos", () => {
    const { doc, janela } = janelaComCanvas();
    comemorar({ texto: "Parabéns!", confete: "festa", doc, janela });
    expect(doc.querySelector(".comemoracao").textContent).toContain(
      "Parabéns!",
    );
    expect(doc.querySelectorAll("canvas.comemoracao__fogos")).toHaveLength(1);
  });

  it("confete: false, só o aviso", () => {
    const { doc, janela } = janelaComCanvas();
    comemorar({ texto: "Oi", confete: false, doc, janela });
    expect(doc.querySelector(".comemoracao")).not.toBeNull();
    expect(doc.querySelector("canvas")).toBeNull();
  });

  it("com menos movimento, só o aviso, sem animação", () => {
    const { doc, janela, quadros } = janelaComCanvas();
    janela.matchMedia = () => ({ matches: true });
    comemorar({ texto: "Parabéns!", confete: "fogos", doc, janela });
    expect(doc.querySelector(".comemoracao")).not.toBeNull();
    expect(doc.querySelector("canvas")).toBeNull();
    expect(quadros).toHaveLength(0);
    expect(soltarFogos(doc, janela)).toBe(false);
  });

  it("o fim do tour (Concluir) celebra: fogos no tour, festa na trilha", () => {
    const aya = readFileSync("src/modulos/aya/aya.jsx", "utf8");
    expect(aya).toMatch(/motivo === "concluiu"\) celebrarFimDoTour\(tour\)/);
    expect(aya).toContain('confete: concluido.trilha ? "festa" : "fogos"');
  });
});
