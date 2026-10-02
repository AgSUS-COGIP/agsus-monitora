import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clicar, teclar } from "../componentes/interacoes.js";

/*
  O tour guiado da Aya (src/modulos/aya/tour/tour.jsx): mostra um passo por
  vez com contador, pula o passo cujo elemento não existe (nas duas
  direções), navega pelas setas, sai com Esc, prende o foco no balão,
  anuncia o passo ao leitor de tela e, no passo de outra tela, pede a troca
  e espera o elemento aparecer.
*/

const { Tour, acharAlvo } = await import("../../src/modulos/aya/tour/tour.jsx");

let raiz;
let reactRoot;
let pagina;

const $ = (seletor) => document.querySelector(seletor);
const balao = () => $(".aya-tour__balao");
const titulo = () => $(".aya-tour__titulo")?.textContent;
const contador = () => $(".aya-tour__contador")?.textContent;
const botao = (texto) =>
  [...document.querySelectorAll(".aya-tour button")].find(
    (b) => b.textContent.trim() === texto,
  );
const visivel = (elemento) => elemento.isConnected && !elemento.hidden;

const PASSOS = [
  { alvo: "#um", titulo: "Um", texto: "Primeiro." },
  { alvo: "#ausente", titulo: "Ausente", texto: "Não existe." },
  { alvo: ["#tambem-ausente", "#tres"], titulo: "Três", texto: "Terceiro." },
  { titulo: "Fim", texto: "Sem alvo, no meio da tela." },
];

async function montar(props = {}) {
  raiz = document.createElement("div");
  document.body.append(raiz);
  reactRoot = createRoot(raiz);
  await act(async () => {
    reactRoot.render(
      createElement(Tour, {
        passos: PASSOS,
        visivel,
        aoFechar: props.aoFechar || vi.fn(),
        janela: window,
        documento: document,
        ...props,
      }),
    );
  });
}

beforeEach(() => {
  pagina = document.createElement("main");
  for (const id of ["um", "tres"]) {
    const el = document.createElement("div");
    el.id = id;
    el.textContent = id;
    pagina.append(el);
  }
  document.body.append(pagina);
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(async () => {
  await act(async () => reactRoot?.unmount());
  raiz?.remove();
  pagina?.remove();
  vi.useRealTimers();
});

describe("passos", () => {
  it("começa no primeiro, com contador, título e texto", async () => {
    await montar();
    expect(contador()).toBe("1 de 4");
    expect(titulo()).toBe("Um");
    expect(balao().getAttribute("role")).toBe("dialog");
    expect($(".aya-tour__recorte")).not.toBeNull();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("pula o passo cujo elemento não existe, indo e voltando", async () => {
    await montar();
    await clicar(botao("Próximo"));
    expect(titulo()).toBe("Três");
    expect(contador()).toBe("3 de 4");
    await clicar(botao("Voltar"));
    expect(titulo()).toBe("Um");
  });

  it("vale o primeiro seletor da lista que acha um elemento", () => {
    expect(acharAlvo(PASSOS[2], document, visivel)?.id).toBe("tres");
    expect(acharAlvo(PASSOS[1], document, visivel)).toBeNull();
    expect(acharAlvo({ alvo: "[[inválido" }, document, visivel)).toBeNull();
  });

  it("passo sem alvo fica no meio, sem recorte; Concluir fecha como concluído", async () => {
    const aoFechar = vi.fn();
    await montar({ aoFechar, inicio: 3 });
    expect(titulo()).toBe("Fim");
    expect($(".aya-tour__recorte")).toBeNull();
    expect($(".aya-tour__faixa--inteira")).not.toBeNull();
    await clicar(botao("Concluir"));
    expect(aoFechar).toHaveBeenCalledWith("concluiu", 3);
  });

  it("último passo ausente conclui ao avançar", async () => {
    const aoFechar = vi.fn();
    await montar({
      aoFechar,
      passos: [PASSOS[0], { alvo: "#nada", titulo: "X", texto: "x" }],
    });
    await clicar(botao("Próximo"));
    expect(aoFechar).toHaveBeenCalledWith("concluiu", 1);
  });

  it("avisa cada passo mostrado (a trilha guarda o progresso daí)", async () => {
    const aoMudarPasso = vi.fn();
    await montar({ aoMudarPasso });
    await clicar(botao("Próximo"));
    expect(aoMudarPasso.mock.calls.map(([i]) => i)).toEqual([0, 2]);
  });
});

describe("teclado e leitor de tela", () => {
  it("→ avança, ← volta", async () => {
    await montar();
    await teclar(document.activeElement, "ArrowRight");
    expect(titulo()).toBe("Três");
    await teclar(document.activeElement, "ArrowLeft");
    expect(titulo()).toBe("Um");
  });

  it("Esc sai como pulado, no passo em que estava", async () => {
    const aoFechar = vi.fn();
    await montar({ aoFechar });
    await teclar(document.activeElement, "ArrowRight");
    await teclar(document.activeElement, "Escape");
    expect(aoFechar).toHaveBeenCalledWith("pulou", 2);
  });

  it("Pular sai como pulado", async () => {
    const aoFechar = vi.fn();
    await montar({ aoFechar });
    await clicar(botao("Pular"));
    expect(aoFechar).toHaveBeenCalledWith("pulou", 0);
  });

  it("o foco vai para o balão e Tab não sai dele", async () => {
    await montar();
    expect(balao().contains(document.activeElement)).toBe(true);
    expect(document.activeElement.textContent).toBe("Próximo");
    // Tab no último focável volta ao primeiro (Voltar está desabilitado no 1º passo).
    await teclar(document.activeElement, "Tab");
    expect(document.activeElement.textContent).toBe("Pular");
    await teclar(document.activeElement, "Tab", { shiftKey: true });
    expect(document.activeElement.textContent).toBe("Próximo");
  });

  it("anuncia o passo numa região viva", async () => {
    await montar();
    const anuncio = $(".aya-tour [aria-live='polite']");
    expect(anuncio.textContent).toBe("Passo 1 de 4: Um. Primeiro.");
    expect(balao().getAttribute("aria-modal")).toBe("true");
  });
});

describe("passo em outra tela", () => {
  it("pede a troca de tela e espera o elemento aparecer", async () => {
    vi.useFakeTimers();
    const irPara = vi.fn(() => true);
    await montar({
      irPara,
      passos: [
        { pagina: "recursos", alvo: "#chega", titulo: "Chegou", texto: "." },
      ],
    });
    expect(irPara).toHaveBeenCalledWith(
      expect.objectContaining({ pagina: "recursos" }),
    );
    expect(balao()).toBeNull();
    const el = document.createElement("div");
    el.id = "chega";
    pagina.append(el);
    await act(async () => vi.advanceTimersByTime(300));
    expect(titulo()).toBe("Chegou");
  });

  it("se o elemento não aparece a tempo, pula", async () => {
    vi.useFakeTimers();
    const aoFechar = vi.fn();
    await montar({
      aoFechar,
      irPara: () => true,
      passos: [{ pagina: "recursos", alvo: "#nunca", titulo: "N", texto: "." }],
    });
    await act(async () => vi.advanceTimersByTime(2000));
    expect(aoFechar).toHaveBeenCalledWith("concluiu", 0);
  });
});
