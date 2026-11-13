import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  medirArte,
  type ImagemMedivel,
  type MedidaDaArte,
} from "../src/app/entrada/marca.ts";

/*
  Tela de acesso, 11/11/2026: a arte ocupa a altura toda, ancorada à direita.
  Tela mais estreita que a arte → a arte cobre tudo (corte à esquerda); mais
  larga → a sobra é a arte desfocada, e a borda se dissolve. A proporção da
  arte (--login-arte-proporcao) é medida quando ela carrega: arte larga (21:9)
  cobre a tela larga inteira, sem a faixa desfocada.

  13/11/2026: a medida (proporção e cor da borda esquerda) é guardada com o
  endereço da arte, e o primeiro quadro da visita seguinte já sai com ela.
*/

function telaFalsa() {
  const vars = new Map<string, string>();
  return {
    vars,
    tela: {
      style: {
        setProperty: (nome: string, valor: string) => {
          vars.set(nome, valor);
        },
      },
    },
  };
}

const imagem = (largura: number, altura: number): ImagemMedivel => ({
  onload: null,
  onerror: null,
  crossOrigin: null,
  src: "",
  naturalWidth: largura,
  naturalHeight: altura,
});

const semCor = () => null;
const naoGuarda = () => {};

describe("medirArte", () => {
  it("grava largura ÷ altura quando a arte carrega", () => {
    const { tela, vars } = telaFalsa();
    const img = imagem(2560, 1080);
    medirArte(tela, " https://exemplo.test/arte.webp ", {
      criarImagem: () => img,
      lerCor: semCor,
      guardar: naoGuarda,
    });
    expect(img.src).toBe("https://exemplo.test/arte.webp");
    expect(vars.has("--login-arte-proporcao")).toBe(false);
    img.onload?.(new Event("load"));
    expect(vars.get("--login-arte-proporcao")).toBe("2.3704");
  });

  it("arte 16:9 continua 16:9", () => {
    const { tela, vars } = telaFalsa();
    const img = imagem(1920, 1080);
    medirArte(tela, "/arte.png", {
      criarImagem: () => img,
      lerCor: semCor,
      guardar: naoGuarda,
    });
    img.onload?.(new Event("load"));
    expect(vars.get("--login-arte-proporcao")).toBe("1.7778");
  });

  it("pede a arte com CORS, grava a cor da borda e guarda a medida com o endereço", () => {
    const { tela, vars } = telaFalsa();
    const img = imagem(3200, 1370);
    const guardadas: MedidaDaArte[] = [];
    medirArte(tela, "https://exemplo.test/arte.jpg", {
      criarImagem: () => img,
      lerCor: () => "#043231",
      guardar: (medida) => guardadas.push(medida),
    });
    expect(img.crossOrigin).toBe("anonymous");
    img.onload?.(new Event("load"));
    expect(vars.get("--login-arte-cor")).toBe("#043231");
    expect(guardadas).toEqual([
      {
        arteMedidaDe: "https://exemplo.test/arte.jpg",
        arteProporcao: "2.3358",
        arteCor: "#043231",
      },
    ]);
  });

  it("servidor sem CORS: mede de novo sem CORS, só a proporção", () => {
    const { tela, vars } = telaFalsa();
    const comCors = imagem(3200, 1370);
    const semCors = imagem(3200, 1370);
    const fila = [comCors, semCors];
    const guardadas: MedidaDaArte[] = [];
    let lida = false;
    medirArte(tela, "https://outro.test/arte.jpg", {
      criarImagem: () => fila.shift() ?? null,
      lerCor: () => {
        lida = true;
        return "#ffffff";
      },
      guardar: (medida) => guardadas.push(medida),
    });
    comCors.onerror?.(new Event("error"));
    expect(semCors.crossOrigin).toBeNull();
    semCors.onload?.(new Event("load"));
    expect(lida).toBe(false);
    expect(vars.get("--login-arte-proporcao")).toBe("2.3358");
    expect(vars.has("--login-arte-cor")).toBe(false);
    expect(guardadas).toEqual([
      {
        arteMedidaDe: "https://outro.test/arte.jpg",
        arteProporcao: "2.3358",
      },
    ]);
  });

  it("sem endereço, sem tela, sem medidas ou sem Image: não grava nada", () => {
    const { tela, vars } = telaFalsa();
    const vazia = imagem(0, 0);
    const opcoes = (img: ImagemMedivel | null) => ({
      criarImagem: () => img,
      lerCor: semCor,
      guardar: naoGuarda,
    });
    medirArte(tela, "", opcoes(imagem(10, 10)));
    medirArte(null, "/arte.png", opcoes(imagem(10, 10)));
    medirArte(tela, "/arte.png", opcoes(vazia));
    vazia.onload?.(new Event("load"));
    medirArte(tela, "/arte.png", opcoes(null));
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

  it("enquanto a arte não aparece, o fundo é a cor da borda dela", () => {
    const partida = readFileSync(
      "src/styles/post157-interface-tuning.css",
      "utf8",
    );
    const tela = partida.slice(partida.indexOf(".login-screen {"));
    expect(tela.slice(0, tela.indexOf("}"))).toContain(
      "background-color: var(--login-arte-cor, #eef4f8);",
    );
  });
});
