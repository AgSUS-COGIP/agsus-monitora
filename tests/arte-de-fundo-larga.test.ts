import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { medirProporcaoDaArte } from "../src/app/entrada/marca.ts";

/*
  Tela de acesso, 11/11/2026: a arte ocupa a altura toda, ancorada à direita.
  Tela mais estreita que a arte → a arte cobre tudo (corte à esquerda); mais
  larga → a sobra é a arte desfocada, e a borda se dissolve. A proporção da
  arte (--login-arte-proporcao) é medida quando ela carrega: arte larga (21:9)
  cobre a tela larga inteira, sem a faixa desfocada.
*/

type Imagem = {
  onload: (() => void) | null;
  src: string;
  naturalWidth: number;
  naturalHeight: number;
};

function telaFalsa() {
  const vars = new Map<string, string>();
  return {
    vars,
    tela: {
      style: {
        setProperty: (nome: string, valor: string) => vars.set(nome, valor),
      },
    } as unknown as HTMLElement,
  };
}

const imagem = (largura: number, altura: number): Imagem => ({
  onload: null,
  src: "",
  naturalWidth: largura,
  naturalHeight: altura,
});

describe("medirProporcaoDaArte", () => {
  it("grava largura ÷ altura quando a arte carrega", () => {
    const { tela, vars } = telaFalsa();
    const img = imagem(2560, 1080);
    medirProporcaoDaArte(tela, " https://exemplo.test/arte.webp ", () => img);
    expect(img.src).toBe("https://exemplo.test/arte.webp");
    expect(vars.has("--login-arte-proporcao")).toBe(false);
    img.onload?.();
    expect(vars.get("--login-arte-proporcao")).toBe("2.3704");
  });

  it("arte 16:9 continua 16:9", () => {
    const { tela, vars } = telaFalsa();
    const img = imagem(1920, 1080);
    medirProporcaoDaArte(tela, "/arte.png", () => img);
    img.onload?.();
    expect(vars.get("--login-arte-proporcao")).toBe("1.7778");
  });

  it("sem endereço, sem tela, sem medidas ou sem Image: não grava nada", () => {
    const { tela, vars } = telaFalsa();
    const vazia = imagem(0, 0);
    medirProporcaoDaArte(tela, "", () => imagem(10, 10));
    medirProporcaoDaArte(null, "/arte.png", () => imagem(10, 10));
    medirProporcaoDaArte(tela, "/arte.png", () => vazia);
    vazia.onload?.();
    medirProporcaoDaArte(tela, "/arte.png", () => null);
    expect(vars.size).toBe(0);
  });
});

describe("o CSS da arte de fundo", () => {
  const css = readFileSync("src/styles/platform-shell.css", "utf8");

  it("não troca mais de modo numa proporção fixa de tela", () => {
    expect(css).not.toMatch(/min-aspect-ratio/);
  });

  it("a arte nítida ocupa a altura toda, à direita, e a borda usa a proporção medida", () => {
    const depois = css.slice(css.indexOf(".login-screen::after {"));
    expect(depois).toMatch(/background-size: auto 100%;/);
    expect(depois).toMatch(/background-position: right center;/);
    expect(depois).toMatch(/var\(--login-arte-proporcao, 1\.7778\)/);
    expect(depois).toMatch(/mask-image: linear-gradient\(/);
  });

  it("o fundo da própria tela não leva a arte (ela está nas camadas)", () => {
    const tela = css.slice(css.indexOf(".login-screen {"));
    expect(tela.slice(0, tela.indexOf("}"))).toMatch(/background-image: none;/);
  });
});
