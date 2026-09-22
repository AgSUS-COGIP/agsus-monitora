import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CATALOGO_DE_TERRAS,
  CATALOGO_DE_TERRAS_LARGO,
  ZOOM_DO_CATALOGO_FINO,
  caixaDaFeature,
  catalogoParaOZoom,
  faseDaTerra,
} from "../src/modules/indigenous-territories-layer.js";

/*
  O MAPA NACIONAL NÃO MOSTRAVA A FASE

  A camada passou a separar terra com limite definitivo de terra em processo, e
  a legenda passou a nomear as três famílias. Mas abaixo do zoom 7 quem desenhava
  era o raster da Funai — uma imagem só, recolorida por inteiro —, e uma imagem
  não sabe distinguir fase. A legenda prometia três coisas e o mapa do Brasil
  mostrava uma.

  O piso de zoom existia porque, antes do catálogo local, pedir a geometria
  nessa escala traria o país inteiro da Funai. Essa razão morreu quando o
  catálogo chegou: ele JÁ é o país inteiro, e está em memória.

  O que restava era o custo de desenhar 113.864 vértices numa escala em que o
  pixel vale 9,8 km. Daí o segundo catálogo.
*/
describe("qual catálogo cada escala usa", () => {
  it("a visão do país usa o largo", () => {
    expect(catalogoParaOZoom(4)).toBe(CATALOGO_DE_TERRAS_LARGO);
    expect(catalogoParaOZoom(6.9)).toBe(CATALOGO_DE_TERRAS_LARGO);
  });

  it("a visão de um distrito usa o fino", () => {
    expect(catalogoParaOZoom(ZOOM_DO_CATALOGO_FINO)).toBe(CATALOGO_DE_TERRAS);
    expect(catalogoParaOZoom(12)).toBe(CATALOGO_DE_TERRAS);
  });

  /*
    A 1113 metros de tolerância o desvio passa a valer um pixel por volta do
    zoom 7 — que é também onde se deixa de ver o país e se passa a ver um
    distrito. As duas coisas coincidirem não é sorte: a tolerância foi escolhida
    para isso.
  */
  it("a troca é no zoom 7", () => {
    expect(ZOOM_DO_CATALOGO_FINO).toBe(7);
  });

  it("zoom inválido não escolhe o fino por acidente", () => {
    expect(catalogoParaOZoom(NaN)).toBe(CATALOGO_DE_TERRAS_LARGO);
    expect(catalogoParaOZoom(undefined)).toBe(CATALOGO_DE_TERRAS_LARGO);
  });
});

describe("o catálogo largo", () => {
  const largo = JSON.parse(
    readFileSync("public/data/terras-indigenas-largo.json", "utf8"),
  );
  const fino = JSON.parse(
    readFileSync("public/data/terras-indigenas.json", "utf8"),
  );

  /*
    Uma terra que desaparecesse no catálogo largo sumiria do mapa nacional
    enquanto a lista do distrito continuaria a nomeá-la. O compilador guarda a
    versão fina quando a simplificação larga apaga a geometria.
  */
  it("traz as mesmas terras que o fino", () => {
    expect(largo.features).toHaveLength(fino.features.length);
    const nomes = (c) =>
      new Set(c.features.map((f) => f.properties.terrai_nome)).size;
    expect(nomes(largo)).toBe(nomes(fino));
  });

  it("é bem menor do que o fino", () => {
    const kb = (c) => Buffer.byteLength(JSON.stringify(c)) / 1024;
    expect(kb(largo)).toBeLessThan(kb(fino) / 2);
  });

  it("leva a fase, que é a razão de ele existir", () => {
    for (const f of largo.features) {
      expect(faseDaTerra(f.properties)).not.toBe("desconhecida");
    }
  });

  it("declara a tolerância com que foi simplificado", () => {
    expect(largo.tolerancia_graus).toBe(0.01);
    expect(largo.tolerancia_graus).toBeGreaterThan(fino.tolerancia_graus);
  });

  /*
    Simplificar não pode mover uma terra de sítio. A caixa de cada uma tem de
    continuar onde estava, dentro da própria tolerância.

    A comparação é por ÍNDICE, e não por nome. Onze nomes de terra repetem-se no
    catálogo — há duas Bacurizinho, duas Buriti, duas Kariri-Xocó —, e a
    primeira versão deste caso indexava por nome: comparava a caixa de uma
    Bacurizinho com a da outra e acusava um deslocamento de 12,4 km que não
    existia. Os dois ficheiros saem do mesmo laço, na mesma ordem.
  */
  it("nenhuma terra se desloca ao ser simplificada", () => {
    expect(largo.features).toHaveLength(fino.features.length);
    for (let i = 0; i < largo.features.length; i += 1) {
      const daqui = caixaDaFeature(largo.features[i]);
      const dela = caixaDaFeature(fino.features[i]);
      const nome = largo.features[i].properties.terrai_nome;
      expect(fino.features[i].properties.terrai_nome).toBe(nome);
      if (!dela || !daqui) continue;
      // 0,02° são o dobro da tolerância larga: folga para o arredondamento.
      for (const lado of ["sul", "norte", "oeste", "leste"]) {
        expect(
          Math.abs(daqui[lado] - dela[lado]),
          `${nome} (${lado})`,
        ).toBeLessThan(0.02);
      }
    }
  });

  /*
    O DEFEITO QUE ESTE BLOCO ENCONTROU

    `simplificarAnel` devolvia `pontos.slice(0, 4)` quando a simplificação
    deixava menos de quatro pontos. Isso não é uma versão simplificada do anel:
    são os quatro primeiros vértices do contorno, uma lasca arbitrária dele — e
    a terra passava a ser desenhada como um triângulo em sítio nenhum.

    Com o anel original no lugar da lasca, o catálogo largo passou de 17.598
    para 43.450 vértices. Vinte e seis mil vértices de diferença é a medida de
    quantos anéis estavam a ser desenhados errados.
  */
  it("o compilador não volta a cortar o anel nos quatro primeiros", () => {
    const compilador = readFileSync(
      "scripts/compilar-terras-indigenas.mjs",
      "utf8",
    );
    expect(compilador).not.toContain("pontos.slice(0, 4)");
    expect(compilador).toContain("if (saida.length < 4) return pontos;");
  });

  it("toda terra continua a ser área, e não ponto", () => {
    for (const f of largo.features) {
      expect(["Polygon", "MultiPolygon"]).toContain(f.geometry.type);
    }
  });
});

/*
  O raster continua a existir, e tem de continuar: é o que resta quando o
  catálogo não carrega. O que mudou é deixar de ser o normal.
*/
describe("o raster passa a ser só o recurso", () => {
  const camada = readFileSync(
    "src/modules/indigenous-territories-layer.js",
    "utf8",
  );

  it("não há mais piso de zoom para o vetorial", () => {
    expect(camada).not.toContain("VECTOR_MIN_ZOOM");
    expect(camada).not.toContain("zoom < piso");
  });

  it("o recurso ao raster continua, para quando o catálogo falha", () => {
    expect(camada).toContain("useRasterFallback()");
  });

  /*
    Cruzar o zoom 7 troca de ficheiro. Sem o catálogo na chave, o mapa ficaria
    com o traçado largo depois de aproximar.
  */
  it("o catálogo entra na chave que evita redesenhar", () => {
    expect(camada).toContain("const key = [\n      urlDoCatalogo,");
  });
});
