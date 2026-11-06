import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { achar } from "../dom.ts";
import { definido } from "../definido.ts";

/*
  O cabeçalho da ficha no notebook (cabecalho-da-ficha.tsx): "enxuto" em tela
  baixa (até 860 px de altura CSS), "compacto" em tela muito baixa (até 680 px)
  ou ao rolar a página, e volta ao normal quando a rolagem volta ao alto. A
  vaga inteira e o nome inteiro ficam na dica. Dados fictícios.
*/
const { CabecalhoDaFicha } =
  await import("../../src/modulos/avaliacao-documental/ficha/cabecalho-da-ficha.tsx");

let telas: string[] = [];
function simularTela(casam: string[]) {
  telas = casam;
  vi.stubGlobal("matchMedia", (consulta: string) => ({
    matches: telas.some((t) => consulta.includes(t)),
    addEventListener() {},
    removeEventListener() {},
  }));
}

let montagem: Root | undefined;
let raiz: HTMLDivElement | undefined;
const PROPS: Parameters<typeof CabecalhoDaFicha>[0] = {
  codigo: "7001",
  nome: "Maria Exemplo da Silva",
  vaga: "182428",
  cargo: "CARGO 2: BIÓLOGO - Análise da Água (Nível Superior)",
  nivel: "Superior",
  declarada: "40",
  posicao: "1º",
  modalidade: "AC",
  informacoes: [],
  voltar: () => {},
  navegacao: {
    posicao: 0,
    total: 3,
    anterior: null,
    proxima: null,
    abrindo: false,
    ir: () => {},
  },
};
async function montar() {
  const novaRaiz = document.createElement("div");
  raiz = novaRaiz;
  document.body.append(novaRaiz);
  const novaMontagem = createRoot(novaRaiz);
  montagem = novaMontagem;
  await act(async () =>
    novaMontagem.render(createElement(CabecalhoDaFicha, PROPS)),
  );
  return achar(".avd-analise-topo", novaRaiz);
}
let quadros: (() => void)[] = [];
async function rolarAte(y: number) {
  await act(async () => {
    Object.defineProperty(window, "scrollY", { configurable: true, value: y });
    window.dispatchEvent(new Event("scroll"));
    // O próximo quadro de animação.
    quadros.splice(0).forEach((fn) => fn());
  });
}

beforeEach(() => {
  quadros = [];
  vi.stubGlobal("requestAnimationFrame", (fn: () => void) => quadros.push(fn));
  vi.stubGlobal("cancelAnimationFrame", () => {});
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    value: 3000,
  });
});
afterEach(async () => {
  await act(async () => montagem?.unmount());
  raiz?.remove();
  vi.unstubAllGlobals();
});

describe("cabeçalho da ficha no notebook", () => {
  it("tela alta: normal, com a vaga e o nome inteiros na dica", async () => {
    simularTela([]);
    const topo = await montar();
    expect(topo.dataset.tamanho).toBeUndefined();
    expect(achar(".avd-analise-vaga", topo).title).toBe(
      "182428 · CARGO 2: BIÓLOGO - Análise da Água (Nível Superior) · Superior",
    );
    expect(achar(".avd-analise-nome", topo).title).toBe(
      "Maria Exemplo da Silva",
    );
    // "Voltar à fila" continua com nome acessível mesmo só com a seta.
    expect(
      topo.querySelector("[data-acao='voltar-a-fila']")?.textContent,
    ).toContain("Voltar à fila");
  });

  it("tela baixa: enxuto; muito baixa: compacto", async () => {
    simularTela(["max-height: 860px"]);
    expect((await montar()).dataset.tamanho).toBe("enxuto");
    await act(async () => definido(montagem).unmount());
    definido(raiz).remove();
    simularTela(["max-height: 860px", "max-height: 680px"]);
    expect((await montar()).dataset.tamanho).toBe("compacto");
  });

  it("ao rolar compacta e volta ao alto sem vaivém", async () => {
    simularTela([]);
    const topo = await montar();
    await rolarAte(30);
    expect(topo.dataset.tamanho).toBeUndefined();
    await rolarAte(120);
    expect(topo.dataset.tamanho).toBe("compacto");
    await rolarAte(30); // entre 8 e 48 px: continua compacto
    expect(topo.dataset.tamanho).toBe("compacto");
    await rolarAte(0);
    expect(topo.dataset.tamanho).toBeUndefined();
  });

  it("página quase sem rolagem não compacta (evita o vaivém)", async () => {
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: window.innerHeight + 100,
    });
    simularTela([]);
    const topo = await montar();
    await rolarAte(90);
    expect(topo.dataset.tamanho).toBeUndefined();
  });
});
