import { describe, expect, it } from "vitest";
import {
  LIMIAR_MESMO_ESTABELECIMENTO_KM,
  unirEstabelecimentosRepetidos,
} from "../src/lib/reconciliacao-unidades.js";

/*
  O painel do DSEI listava o POLO BASE JAPIIM duas vezes. São dois registos no
  CNES — códigos diferentes, mesmo nome, mesmo tipo, a mesma coordenada, um
  deles marcado "(em atualização cadastral)". A reconciliação nunca os via
  porque compara polo do lmap contra estabelecimento, e nada comparava
  estabelecimentos entre si.

  Os quatro pares reais estão em Médio Rio Purus, todos a 0,00 km.
*/
const japiim = (cnes, sufixo = "") => ({
  nome: `POLO BASE JAPIIM${sufixo}`,
  cnes,
  lat: -8.1234,
  lon: -67.4321,
});

describe("dois registos CNES para o mesmo estabelecimento", () => {
  it("une o par que partilha nome, tipo e coordenada", () => {
    const { estabelecimentos, unidos } = unirEstabelecimentosRepetidos([
      japiim("4206991"),
      japiim("9425616", " (em atualização cadastral)"),
    ]);

    expect(estabelecimentos).toHaveLength(1);
    expect(unidos).toHaveLength(1);
  });

  /*
    Fica o registo corrente, não o que está em atualização: é o nome que quem
    procurar a unidade no CNES vai encontrar.
  */
  it("mantém o registo que não está em atualização cadastral", () => {
    const { estabelecimentos } = unirEstabelecimentosRepetidos([
      japiim("9425616", " (em atualização cadastral)"),
      japiim("4206991"),
    ]);

    expect(estabelecimentos[0].cnes).toBe("4206991");
    expect(estabelecimentos[0].nome).not.toContain("atualização");
  });

  it("não perde o código do registo absorvido", () => {
    const { estabelecimentos } = unirEstabelecimentosRepetidos([
      japiim("4206991"),
      japiim("9425616", " (em atualização cadastral)"),
    ]);

    expect(estabelecimentos[0].cnes_absorvidos).toEqual(["9425616"]);
  });
});

describe("o que não se une", () => {
  /*
    Cinco pares reais têm o mesmo nome e o mesmo tipo a 222, 224, 305, 472 e
    598 km. Nome igual a essa distância não é o mesmo sítio, e uni-los faria o
    mapa apagar um ponto real.
  */
  it("nome igual a 222 km são dois registos, não um", () => {
    const { estabelecimentos } = unirEstabelecimentosRepetidos([
      {
        nome: "POSTO DE SAUDE ALDEIA SAO LUIZ",
        cnes: "7906331",
        lat: -9,
        lon: -63,
      },
      {
        nome: "POSTO DE SAUDE INDIGENA ALDEIA SAO LUIZ",
        cnes: "7916582",
        lat: -11,
        lon: -63,
      },
    ]);
    expect(estabelecimentos).toHaveLength(2);
  });

  it("tipos diferentes no mesmo lugar continuam dois equipamentos", () => {
    const { estabelecimentos } = unirEstabelecimentosRepetidos([
      { nome: "POLO BASE TUCUMA", cnes: "1", lat: -6.7, lon: -51.1 },
      { nome: "CASAI TUCUMA", cnes: "2", lat: -6.7, lon: -51.1 },
    ]);
    expect(estabelecimentos).toHaveLength(2);
  });

  /*
    "POLO BASE INDIGENA", em Tocantins, reduz-se a nada no canónico. Unir por
    um nome que não identifica ninguém juntaria unidades sem relação.
  */
  it("nome que não sobrevive ao canónico nunca une", () => {
    const { estabelecimentos } = unirEstabelecimentosRepetidos([
      { nome: "POLO BASE INDIGENA", cnes: "3426769", lat: -10, lon: -48 },
      {
        nome: "POLO BASE DE SAUDE INDIGENA",
        cnes: "7941226",
        lat: -10,
        lon: -48,
      },
    ]);
    expect(estabelecimentos).toHaveLength(2);
  });

  it("sem coordenada não se afirma que são o mesmo", () => {
    const { estabelecimentos } = unirEstabelecimentosRepetidos([
      { nome: "POLO BASE JAPIIM", cnes: "1", lat: null, lon: null },
      { nome: "POLO BASE JAPIIM", cnes: "2", lat: -8.1, lon: -67.4 },
    ]);
    expect(estabelecimentos).toHaveLength(2);
  });
});

describe("limiar", () => {
  it("meio quilómetro, porque a diferença entre dois registos do mesmo sítio é do tamanho do arredondamento", () => {
    expect(LIMIAR_MESMO_ESTABELECIMENTO_KM).toBe(0.5);
  });

  it("não altera a lista quando não há repetição", () => {
    const entrada = [
      { nome: "POLO BASE A", cnes: "1", lat: -5, lon: -40 },
      { nome: "POLO BASE B", cnes: "2", lat: -6, lon: -41 },
      { nome: "CASAI C", cnes: "3", lat: -7, lon: -42 },
    ];
    const { estabelecimentos, unidos } = unirEstabelecimentosRepetidos(entrada);
    expect(estabelecimentos).toHaveLength(3);
    expect(unidos).toHaveLength(0);
  });

  it("aguenta entrada vazia ou inválida", () => {
    expect(unirEstabelecimentosRepetidos([]).estabelecimentos).toEqual([]);
    expect(unirEstabelecimentosRepetidos().estabelecimentos).toEqual([]);
  });
});
