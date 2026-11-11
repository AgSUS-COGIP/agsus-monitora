import { describe, expect, it } from "vitest";
import {
  DSEIS_OFICIAIS,
  nomeOficialDoDsei,
  numeroDoDsei,
} from "../src/lib/mapa-saude-indigena/dseis-oficiais.ts";
import {
  TOKEN_SEM_DADO,
  colorirValido,
  dicaDoDseiSimples,
  faixaDoValor,
  faixasDeOciosas,
  faixasDePreenchidas,
  indicadoresDosDseis,
  pintarDseis,
  tokenDaClasse,
} from "../src/lib/mapa-saude-indigena/mapa-simples.ts";
import { contornosValidos } from "../src/lib/mapa-saude-indigena/contornos-dos-dseis.ts";

/*
  O "Mapa DSEIs" sem Leaflet (src/lib/mapa-saude-indigena/): a numeração
  oficial dos 34 DSEIs, as faixas da cor, o "sem dado", a dica e os contornos
  aceitos do arquivo local.
*/

const territorio = (k, n, vagas, ociosas) => ({
  dsei: { k, n },
  chave: k,
  vagas,
  ociosas,
  preenchidas: vagas ? Math.round(((vagas - ociosas) / vagas) * 100) : 0,
});

describe("numeração dos 34 DSEIs", () => {
  it("são 34 nomes distintos, em ordem alfabética, de Alagoas e Sergipe a Yanomami", () => {
    expect(DSEIS_OFICIAIS).toHaveLength(34);
    expect(new Set(DSEIS_OFICIAIS).size).toBe(34);
    const ordenados = [...DSEIS_OFICIAIS].sort((a, b) =>
      a.localeCompare(b, "pt-BR", { sensitivity: "base" }),
    );
    expect(DSEIS_OFICIAIS).toEqual(ordenados);
    expect(nomeOficialDoDsei(1)).toBe("Alagoas e Sergipe");
    expect(nomeOficialDoDsei(34)).toBe("Yanomami");
    expect(nomeOficialDoDsei(0)).toBeNull();
    expect(nomeOficialDoDsei(35)).toBeNull();
  });

  it("cada nome oficial dá o próprio número", () => {
    DSEIS_OFICIAIS.forEach((nome, i) => expect(numeroDoDsei(nome)).toBe(i + 1));
  });

  it("casa as grafias do lmap, do edital e de outras fontes", () => {
    expect(numeroDoDsei("KAIAPO DO MATO GROSSO")).toBe(14);
    expect(numeroDoDsei("DSEI Kaiapó de Mato Grosso")).toBe(14);
    expect(numeroDoDsei("DSEI Guamá-Tocantins")).toBe(12);
    expect(numeroDoDsei("GUAMA TOCANTINS")).toBe(12);
    expect(numeroDoDsei("Yanomami e Ye'kuana")).toBe(34);
    expect(numeroDoDsei("MEDIO RIO SOLIMOES E AFLUENTES")).toBe(22);
    expect(numeroDoDsei("Potiguara")).toBe(27);
    expect(numeroDoDsei("Porto Velho")).toBe(26);
  });

  it("o que não é um dos 34 fica sem número", () => {
    expect(numeroDoDsei("CASAI Nacional Brasília")).toBeNull();
    expect(numeroDoDsei("")).toBeNull();
    expect(numeroDoDsei(null)).toBeNull();
  });
});

describe("faixas da cor", () => {
  it("% preenchidas: cinco faixas fixas de 20 pontos", () => {
    const faixas = faixasDePreenchidas();
    expect(faixas.map((f) => f.rotulo)).toEqual([
      "0–19%",
      "20–39%",
      "40–59%",
      "60–79%",
      "80–100%",
    ]);
    expect(faixaDoValor(0, faixas)?.classe).toBe(1);
    expect(faixaDoValor(19, faixas)?.classe).toBe(1);
    expect(faixaDoValor(20, faixas)?.classe).toBe(2);
    expect(faixaDoValor(79, faixas)?.classe).toBe(4);
    expect(faixaDoValor(100, faixas)?.classe).toBe(5);
    expect(faixaDoValor(null, faixas)).toBeNull();
  });

  it("vagas ociosas: cinco faixas por quantis, sem buraco nem repetição", () => {
    const valores = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 20, 40, 60, 80, 100];
    const faixas = faixasDeOciosas(valores);
    expect(faixas).toHaveLength(5);
    expect(faixas[0].minimo).toBe(0);
    expect(faixas.at(-1).maximo).toBe(100);
    for (let i = 1; i < faixas.length; i += 1)
      expect(faixas[i].minimo).toBe(faixas[i - 1].maximo + 1);
    for (const v of valores) expect(faixaDoValor(v, faixas)).not.toBeNull();
  });

  it("poucos valores distintos dão menos faixas; nenhum valor, nenhuma", () => {
    expect(faixasDeOciosas([3, 3, 7]).map((f) => f.rotulo)).toEqual([
      "3",
      "4–7",
    ]);
    expect(faixasDeOciosas([])).toEqual([]);
  });

  it("menos de cinco faixas se espalham pela escala inteira", () => {
    expect(tokenDaClasse(1, 5)).toBe("--mapa-simples-seq-1");
    expect(tokenDaClasse(5, 5)).toBe("--mapa-simples-seq-5");
    expect(tokenDaClasse(1, 2)).toBe("--mapa-simples-seq-1");
    expect(tokenDaClasse(2, 2)).toBe("--mapa-simples-seq-5");
    expect(tokenDaClasse(1, 1)).toBe("--mapa-simples-seq-5");
  });

  it("'Colorir por' desconhecido volta ao padrão (Cor do DSEI, desde 11/11/2026)", () => {
    expect(colorirValido("ociosas")).toBe("ociosas");
    expect(colorirValido("preenchidas")).toBe("preenchidas");
    expect(colorirValido("calor")).toBe("dsei");
    expect(colorirValido(null)).toBe("dsei");
  });
});

describe("indicadores e sem dado", () => {
  const territorios = [
    territorio("YANOMAMI", "Yanomami", 40, 30),
    territorio("ALAGOAS E SERGIPE", "Alagoas e Sergipe", 10, 1),
    territorio("LESTE DE RORAIMA", "Leste de Roraima", 0, 0),
  ];

  it("os 34, na ordem, com os números da lista; quem não está ou não tem vaga fica sem dado", () => {
    const ind = indicadoresDosDseis(territorios);
    expect(ind).toHaveLength(34);
    expect(ind[33]).toMatchObject({
      numero: 34,
      nome: "Yanomami",
      vagas: 40,
      ociosas: 30,
      preenchidas: 25,
      temDado: true,
    });
    expect(ind[0].preenchidas).toBe(90);
    expect(ind[15]).toMatchObject({ numero: 16, temDado: false });
    expect(ind[15].preenchidas).toBeNull();
    expect(ind[1]).toMatchObject({
      numero: 2,
      territorio: null,
      temDado: false,
    });
  });

  it("pinta pela faixa e põe 'sem dado' na legenda", () => {
    const pintura = pintarDseis(
      indicadoresDosDseis(territorios),
      "preenchidas",
    );
    expect(pintura.tokens.get(34)).toBe("--mapa-simples-seq-2");
    expect(pintura.tokens.get(1)).toBe("--mapa-simples-seq-5");
    expect(pintura.tokens.get(16)).toBe(TOKEN_SEM_DADO);
    expect(pintura.legenda.at(-1)).toEqual({
      token: TOKEN_SEM_DADO,
      rotulo: "sem dado",
      semDado: true,
    });
    expect(pintura.legenda).toHaveLength(6);
  });

  it("vagas ociosas: faixas só com quem tem dado", () => {
    const pintura = pintarDseis(indicadoresDosDseis(territorios), "ociosas");
    expect(pintura.legenda.map((i) => i.rotulo)).toEqual([
      "1",
      "2–30",
      "sem dado",
    ]);
    expect(pintura.tokens.get(1)).toBe("--mapa-simples-seq-1");
    expect(pintura.tokens.get(34)).toBe("--mapa-simples-seq-5");
  });

  it("cor do DSEI: uma cor estável por número, sem 'sem dado'", () => {
    const pintura = pintarDseis(indicadoresDosDseis(territorios), "dsei");
    expect(pintura.tokens.get(16)).toBe("--mapa-simples-dsei-16");
    expect(pintura.tokens.size).toBe(34);
    expect(pintura.legenda).toEqual([]);
  });

  it("a dica: número, nome, vagas, ociosas e % preenchidas", () => {
    const ind = indicadoresDosDseis(territorios);
    expect(dicaDoDseiSimples(ind[33])).toBe(
      "34 · Yanomami — 40 vagas, 30 ociosas, 25% preenchidas",
    );
    expect(dicaDoDseiSimples(ind[0])).toBe(
      "1 · Alagoas e Sergipe — 10 vagas, 1 ociosa, 90% preenchidas",
    );
    expect(dicaDoDseiSimples(ind[15])).toBe("16 · Leste de Roraima — sem dado");
  });
});

describe("contornos locais", () => {
  const quadrado = [
    [-40, -10],
    [-39, -10],
    [-39, -9],
    [-40, -9],
    [-40, -10],
  ];
  const feicao = (numero, extra = {}) => ({
    type: "Feature",
    properties: { numero, nome: "qualquer", rotulo: [-9.5, -39.5] },
    geometry: { type: "Polygon", coordinates: [quadrado] },
    ...extra,
  });

  it("aceita só número de 1 a 34, polígono válido e rótulo; o nome é o oficial", () => {
    const validos = contornosValidos({
      type: "FeatureCollection",
      features: [
        feicao(34),
        feicao(1),
        feicao(1),
        feicao(99),
        feicao(2, { geometry: { type: "Point", coordinates: [0, 0] } }),
        feicao(3, { properties: { numero: 3 } }),
      ],
    });
    expect(validos.map((f) => f.properties.numero)).toEqual([1, 34]);
    expect(validos[1].properties.nome).toBe("Yanomami");
  });

  it("arquivo estranho vira lista vazia", () => {
    expect(contornosValidos(null)).toEqual([]);
    expect(contornosValidos({ features: "x" })).toEqual([]);
  });
});
