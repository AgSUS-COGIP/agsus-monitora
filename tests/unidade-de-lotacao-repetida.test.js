import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { unidadeDeLotacaoEhOPolo } from "../src/lib/reconciliacao-unidades.js";
import { applyLotacoesGeograficas } from "../src/modules/lotacoes-geograficas-transport.js";

/*
  TERESINA APARECIA DUAS VEZES NO DSEI CEARÁ

  A planilha de Lotações tem duas linhas no mesmo ponto:

      POLO BASE           PB TERESINA (SEDE)   -5.07992, -42.78681
      UNIDADE DE LOTAÇÃO  UN TERESINA (SEDE)   -5.07992, -42.78681

  A primeira vira polo; a segunda caía no ramo final do transporte e virava
  unidade da rede. A reconciliação nunca as juntava porque compara tipos, e
  "unidade de lotação" fica `outro`, que não casa com nada.

  A lotação em si está certa — o atendimento à população indígena do Piauí é
  responsabilidade do DSEI Ceará, e a CASAI Teresina, essa sim, é do Maranhão.
  O que estava errado era mostrar o mesmo equipamento duas vezes.
*/
describe("a unidade de lotação que é o próprio polo", () => {
  it("reconhece o par de Teresina", () => {
    expect(
      unidadeDeLotacaoEhOPolo("UN TERESINA (SEDE)", "PB TERESINA (SEDE)"),
    ).toBe(true);
  });

  it("reconhece o par do Médio Rio Purus", () => {
    expect(unidadeDeLotacaoEhOPolo("UN FUNAI/MPI", "PB FUNAI/MPI")).toBe(true);
  });

  /*
    O parêntese é o que separa o duplicado do vizinho. `FLEXAL (SUBPOLO -
    CARACANÃ)`, em Leste de Roraima, está sobre o `PB FLEXAL` e não é ele: é um
    subpolo de Caracanã que herdou a coordenada. Apagá-lo tiraria do mapa uma
    estrutura real.
  */
  it("não confunde o subpolo com o polo de onde herdou a coordenada", () => {
    expect(
      unidadeDeLotacaoEhOPolo("FLEXAL (SUBPOLO - CARACANÃ)", "PB FLEXAL"),
    ).toBe(false);
  });

  it("nome que não identifica ninguém não autoriza nada", () => {
    expect(unidadeDeLotacaoEhOPolo("UN", "PB")).toBe(false);
    expect(unidadeDeLotacaoEhOPolo("", "PB TERESINA")).toBe(false);
  });

  it("nomes diferentes continuam diferentes", () => {
    expect(unidadeDeLotacaoEhOPolo("UN SAPOTAL", "PB TERESINA")).toBe(false);
  });
});

function estadoInicial() {
  return [
    {
      chave: "lmap",
      payload: { dsei: [{ k: "CEARA", n: "Ceará", ufs: ["CE"], polos: [] }] },
    },
    {
      chave: "rede_cnes",
      payload: { rede: { CEARA: { u: [], c: [] } }, nac: [] },
    },
  ];
}

const linha = (tipo, nome, lat, lon) => [
  tipo,
  nome,
  lat,
  lon,
  "TERESINA",
  "PI",
  "Muito acessível",
  "Terrestre",
];

describe("o que o transporte faz com ela", () => {
  it("deixa um só Teresina no Ceará", () => {
    const saida = applyLotacoesGeograficas(estadoInicial(), {
      CEARA: [
        linha("POLO BASE", "PB TERESINA (SEDE)", -5.07992, -42.78681),
        linha("UNIDADE DE LOTAÇÃO", "UN TERESINA (SEDE)", -5.07992, -42.78681),
      ],
    });

    const lmap = saida.find((r) => r.chave === "lmap").payload;
    const rede = saida.find((r) => r.chave === "rede_cnes").payload;

    expect(lmap.dsei[0].polos).toHaveLength(1);
    expect(rede.rede.CEARA.u).toHaveLength(0);
  });

  /*
    A ordem das linhas na planilha não é garantida, e o crivo compara linha com
    linha justamente para não depender dela.
  */
  it("não depende da ordem das duas linhas", () => {
    const saida = applyLotacoesGeograficas(estadoInicial(), {
      CEARA: [
        linha("UNIDADE DE LOTAÇÃO", "UN TERESINA (SEDE)", -5.07992, -42.78681),
        linha("POLO BASE", "PB TERESINA (SEDE)", -5.07992, -42.78681),
      ],
    });

    const rede = saida.find((r) => r.chave === "rede_cnes").payload;
    expect(rede.rede.CEARA.u).toHaveLength(0);
  });

  /*
    Setenta e sete das 79 unidades de lotação são subpolos, aldeias e UBSIs.
    Se o crivo as apanhasse, o mapa perderia equipamento real.
  */
  it("mantém a unidade de lotação que não repete polo nenhum", () => {
    const saida = applyLotacoesGeograficas(estadoInicial(), {
      CEARA: [
        linha("POLO BASE", "PB TERESINA (SEDE)", -5.07992, -42.78681),
        linha("UNIDADE DE LOTAÇÃO", "UBSI BANANAL", -5.2, -42.9),
      ],
    });

    const rede = saida.find((r) => r.chave === "rede_cnes").payload;
    expect(rede.rede.CEARA.u).toHaveLength(1);
    expect(rede.rede.CEARA.u[0][0]).toContain("BANANAL");
  });

  /*
    `UN SANTA MARIA`, no Guamá, tem o nome do `PB SANTA MARIA` e está a 18,9 km
    dele. É outro lugar com o mesmo nome, e o mapa tem de mostrar os dois.
  */
  it("nome igual longe do polo continua a ser outro equipamento", () => {
    const saida = applyLotacoesGeograficas(estadoInicial(), {
      CEARA: [
        linha("POLO BASE", "PB SANTA MARIA", -1.4, -47.5),
        linha("UNIDADE DE LOTAÇÃO", "UN SANTA MARIA", -1.55, -47.6),
      ],
    });

    const rede = saida.find((r) => r.chave === "rede_cnes").payload;
    expect(rede.rede.CEARA.u).toHaveLength(1);
  });
});

/*
  O crivo é estreito de propósito. Este caso mede-o contra a planilha inteira:
  se uma alteração o alargar, o número sobe aqui antes de subir no mapa.
*/
describe("contra a planilha inteira", () => {
  it("apanha exatamente duas das 79 unidades de lotação", () => {
    const dataset = Object.assign(
      {},
      ...Array.from({ length: 8 }, (_, i) =>
        JSON.parse(
          readFileSync(
            `public/data/lotacoes-geograficas-${String(i + 1).padStart(2, "0")}.json`,
            "utf8",
          ),
        ),
      ),
    );

    let apanhadas = 0;
    for (const linhas of Object.values(dataset)) {
      const polos = linhas.filter((r) => r[0] === "POLO BASE");
      for (const r of linhas.filter((x) => x[0] === "UNIDADE DE LOTAÇÃO")) {
        const repete = polos.some(
          (p) =>
            unidadeDeLotacaoEhOPolo(r[1], p[1]) &&
            Math.abs(r[2] - p[2]) < 0.002 &&
            Math.abs(r[3] - p[3]) < 0.002,
        );
        if (repete) apanhadas += 1;
      }
    }

    expect(apanhadas).toBe(2);
  });
});
