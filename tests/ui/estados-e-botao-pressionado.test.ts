import { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { Carregando, EstadoVazio } from "../../src/ui/index.ts";
import { TopoDaGaveta } from "../../src/ui/gaveta.tsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const CSS = readFileSync("src/ui/ui.css", "utf8");

const montados: HTMLElement[] = [];
afterEach(() => {
  for (const no of montados.splice(0)) no.remove();
});

async function montar(elemento: ReturnType<typeof h>): Promise<HTMLElement> {
  const no = document.createElement("div");
  document.body.append(no);
  montados.push(no);
  await act(async () => {
    createRoot(no).render(elemento);
  });
  return no;
}

describe("estados de bloco (DS 12 e 17)", () => {
  it("o carregamento é anunciado ao leitor de tela; o vazio não", async () => {
    const carregando = await montar(h(Carregando));
    expect(carregando.querySelector('[role="status"]')?.textContent).toBe(
      "Carregando…",
    );
    const vazio = await montar(h(EstadoVazio, null, "Nada aqui."));
    expect(vazio.querySelector("[role]")).toBeNull();
  });

  it("o botão de fechar da gaveta tem nome acessível mesmo sem rótulo", async () => {
    const no = await montar(
      h(TopoDaGaveta, { titulo: "Detalhe", aoFechar: () => undefined }),
    );
    expect(
      no.querySelector(".ui-gaveta-fechar")?.getAttribute("aria-label"),
    ).toBe("Fechar");
  });
});

describe("botão pressionado (DS 11.1)", () => {
  it("encolhe a 0,98 ao pressionar, só habilitado, e some com movimento reduzido", () => {
    expect(CSS).toMatch(
      /\.btn:active:not\(:disabled\)\s*\{\s*transform:\s*scale\(0\.98\);/,
    );
    expect(CSS).toMatch(
      /\.btn\s*\{\s*transition:\s*transform var\(--duration-fast\) var\(--ease-standard\);/,
    );
    expect(CSS).toMatch(
      /prefers-reduced-motion: reduce\)\s*\{\s*\.btn,\s*\.btn:active:not\(:disabled\)\s*\{\s*transition:\s*none;\s*transform:\s*none;/,
    );
  });
});
