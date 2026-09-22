import { describe, expect, it } from "vitest";
import {
  SOBREPOSICAO_EM_PIXELS,
  agruparCoincidentes,
  agruparPorProximidadeNaTela,
} from "../src/lib/mapa-render.js";

/*
  DOIS REGISTOS A DEZ METROS SÃO UM PIXEL SÓ

  `agruparCoincidentes` junta o que partilha a coordenada até à quinta casa —
  cerca de um metro. No DSEI Ceará há dois pares a dez metros, que passavam por
  esse crivo e ficavam um em cima do outro, sem leque e sem forma de clicar no
  de baixo:

    440205  UBSI Guiomar Alves Julião, Rua Santa Rosa
    9566201 UBSI Reserva Taba Anacé, CE-085 km 13

    9565302 Polo Base Potyró, BR-222 Jandaiguaba
    9566171 UBSI Victor Tapeba, BR-222 Capuan

  Os endereços no CNES são diferentes; as coordenadas, não. O cadastro é que
  dá quase o mesmo ponto a lugares distintos — o mapa não conserta isso, mas
  para de esconder um atrás do outro.
*/
const caucaia = [
  { nome: "UBSI Guiomar Alves Julião", lat: -3.732944, lon: -38.656018 },
  { nome: "UBSI Reserva Taba Anacé", lat: -3.73303, lon: -38.655975 },
];

// Projeção de brincar: 1 grau = 100 000 px. A 10 m dão ~9 px de distância.
const projetarDeDistrito = (r) => ({ x: r.lon * 100000, y: -r.lat * 100000 });
// Aproximado vinte vezes mais: os mesmos 10 m passam a ~180 px.
const projetarDeRua = (r) => ({ x: r.lon * 2000000, y: -r.lat * 2000000 });

describe("o agrupamento antigo não via estes dois", () => {
  it("dez metros passam pelo crivo da quinta casa decimal", () => {
    expect(agruparCoincidentes(caucaia)).toHaveLength(2);
  });
});

describe("agrupamento por proximidade na tela", () => {
  it("junta os que caem no mesmo punhado de pixels", () => {
    const grupos = agruparPorProximidadeNaTela(caucaia, projetarDeDistrito);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].registros).toHaveLength(2);
  });

  /*
    Ampliado, os dez metros viram um quarteirão. Aí são dois pontos mesmo, e
    juntá-los seria mentir sobre a distância entre eles.
  */
  it("separa os mesmos dois quando o zoom os distingue", () => {
    expect(agruparPorProximidadeNaTela(caucaia, projetarDeRua)).toHaveLength(2);
  });

  it("a coordenada do grupo é a de um registo real, não uma média", () => {
    const [grupo] = agruparPorProximidadeNaTela(caucaia, projetarDeDistrito);
    const original = caucaia.some(
      (r) => r.lat === grupo.lat && r.lon === grupo.lon,
    );
    expect(original).toBe(true);
  });

  it("quem está longe fica sozinho", () => {
    const registos = [
      ...caucaia,
      { nome: "Itarema", lat: -2.9845, lon: -39.8236 },
    ];
    const grupos = agruparPorProximidadeNaTela(registos, projetarDeDistrito);
    expect(grupos).toHaveLength(2);
    expect(grupos.map((g) => g.registros.length).sort()).toEqual([1, 2]);
  });

  it("descarta registo sem coordenada utilizável", () => {
    const grupos = agruparPorProximidadeNaTela(
      [{ nome: "sem coord", lat: null, lon: null }, ...caucaia],
      projetarDeDistrito,
    );
    expect(grupos).toHaveLength(1);
    expect(grupos[0].registros).toHaveLength(2);
  });

  it("descarta o que a projeção não sabe posicionar", () => {
    const grupos = agruparPorProximidadeNaTela(caucaia, () => ({
      x: Number.NaN,
      y: 0,
    }));
    expect(grupos).toEqual([]);
  });

  /*
    Sem projeção não se inventa uma: volta-se ao comportamento antigo, que é
    conservador e nunca junta o que não partilha a coordenada.
  */
  it("sem projeção, cai no agrupamento por coordenada", () => {
    expect(agruparPorProximidadeNaTela(caucaia)).toHaveLength(2);
    expect(agruparPorProximidadeNaTela(caucaia, "não é função")).toHaveLength(
      2,
    );
  });

  it("aguenta lista vazia", () => {
    expect(agruparPorProximidadeNaTela([], projetarDeDistrito)).toEqual([]);
    expect(agruparPorProximidadeNaTela(undefined, projetarDeDistrito)).toEqual(
      [],
    );
  });

  it("a tolerância é do tamanho de um marcador", () => {
    expect(SOBREPOSICAO_EM_PIXELS).toBe(14);
  });
});
