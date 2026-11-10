import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { CarregandoConteudo } from "../../src/ui/index.ts";

/*
  Carregando não é cartão em branco (pedido de 10/11/2026): ao escolher o
  edital na Avaliação documental, a tela ficava ~4 s com um cartão vazio. As
  linhas `.ui-esqueleto-linha` não tinham a classe base `.ui-esqueleto` e não
  desenhavam nada; o mesmo em Classificação, Entrevistas, Triagem e Regras do
  edital. `CarregandoConteudo` diz o que carrega, com o indicador, e é
  anunciado ao leitor de tela; o CSS desenha a linha mesmo sem a classe base.
*/

let raiz: Root | null = null;
afterEach(() => {
  act(() => raiz?.unmount());
  raiz = null;
  document.body.innerHTML = "";
});

function desenhar(props: Parameters<typeof CarregandoConteudo>[0]) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const alvo = document.createElement("div");
  document.body.append(alvo);
  raiz = createRoot(alvo);
  act(() => raiz?.render(createElement(CarregandoConteudo, props)));
  return alvo.firstElementChild as HTMLElement;
}

describe("CarregandoConteudo", () => {
  it("diz o que carrega, num cartão anunciado ao leitor de tela", () => {
    const bloco = desenhar({ rotulo: "Carregando o edital 93/2026…" });
    expect(bloco.getAttribute("role")).toBe("status");
    expect(bloco.getAttribute("aria-busy")).toBe("true");
    expect(bloco.classList.contains("ui-card")).toBe(true);
    expect(bloco.textContent).toBe("Carregando o edital 93/2026…");
    expect(bloco.querySelector(".ui-carregando-indicador")).not.toBeNull();
    const linhas = bloco.querySelectorAll(".ui-esqueleto.ui-esqueleto-linha");
    expect(linhas).toHaveLength(2);
  });

  it("sem moldura, quantas linhas pedir e o texto padrão", () => {
    const bloco = desenhar({ semMoldura: true, linhas: 1 });
    expect(bloco.classList.contains("ui-card")).toBe(false);
    expect(bloco.textContent).toBe("Carregando…");
    expect(bloco.querySelectorAll(".ui-esqueleto-linha")).toHaveLength(1);
  });
});

describe("o esqueleto não volta a sair invisível", () => {
  const css = readFileSync("src/ui/ui.css", "utf8");

  it("a linha desenha mesmo sem a classe base, com a cor da borda padrão", () => {
    const regra = css.match(
      /\.ui-esqueleto,\s*\.ui-esqueleto-linha\s*\{[^}]*\}/,
    );
    expect(regra?.[0]).toContain("background: var(--color-border-default)");
    expect(regra?.[0]).toContain("animation: ui-esqueleto-pulso");
  });

  it("nenhuma tela desenha cartão em branco: cartão com aria-busy usa CarregandoConteudo", () => {
    const arquivos: string[] = [];
    const percorrer = (pasta: string) => {
      for (const nome of readdirSync(pasta)) {
        const caminho = join(pasta, nome);
        if (statSync(caminho).isDirectory()) percorrer(caminho);
        else if (caminho.endsWith(".tsx")) arquivos.push(caminho);
      }
    };
    percorrer("src/modulos");
    const vazios = arquivos.filter((arquivo) =>
      /className="ui-card[^"]*" aria-busy="true">\s*<div className="ui-esqueleto-linha"/.test(
        readFileSync(arquivo, "utf8"),
      ),
    );
    expect(vazios).toEqual([]);
  });
});
