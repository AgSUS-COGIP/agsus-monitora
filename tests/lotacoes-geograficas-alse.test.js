import { describe, expect, it } from "vitest";
import { applyLotacoesGeograficas } from "../src/modules/lotacoes-geograficas-transport.js";

describe("deduplicação real de Alagoas e Sergipe", () => {
  it("liga Xucuru-Kariri ao CNES mesmo com ordinal no nome cadastral", () => {
    const rows = [
      {
        chave: "lmap",
        payload: {
          dsei: [
            {
              k: "ALAGOAS E SERGIPE",
              n: "Alagoas e Sergipe",
              polos: [
                {
                  n: "XUCURU-KARIRI",
                  lat: -9.3884,
                  lon: -36.6218,
                  uf: "AL",
                },
              ],
            },
          ],
        },
      },
      {
        chave: "rede_cnes",
        payload: {
          rede: {
            "ALAGOAS E SERGIPE": {
              u: [
                [
                  "POLO BASE II XUCURU KARIRI",
                  "2010674",
                  -9.417027,
                  -36.632751,
                  "PALMEIRA DOS INDIOS",
                  27,
                ],
              ],
              c: [],
            },
          },
          nac: [],
        },
      },
    ];

    const dataset = {
      "ALAGOAS E SERGIPE": [
        [
          "POLO BASE",
          "PB XUCURU KARIRI",
          -9.408696,
          -36.650698,
          "PALMEIRA DOS INDIOS",
          "AL",
          "Muito acessível",
          "Terrestre",
        ],
      ],
    };

    const result = applyLotacoesGeograficas(rows, dataset);
    const polo = result[0].payload.dsei[0].polos[0];
    const rede = result[1].payload.rede["ALAGOAS E SERGIPE"];

    expect(result[0].payload.dsei[0].polos).toHaveLength(1);
    expect(polo.cnes).toBe("2010674");
    expect(polo.mun_lotacao).toBe("PALMEIRA DOS INDIOS");
    expect(polo.lat).toBe(-9.3884);
    expect(polo.lon).toBe(-36.6218);
    expect(polo.coord_fonte).toBe("lmap");
    expect(polo.coord_lmap).toEqual({ lat: -9.3884, lon: -36.6218 });
    expect(polo.coord_lotacoes).toEqual({
      lat: -9.408696,
      lon: -36.650698,
    });
    expect(polo.coord_cnes).toEqual({
      lat: -9.417027,
      lon: -36.632751,
    });
    expect(rede.u).toHaveLength(1);
    expect(rede.u[0][1]).toBe("2010674");
  });

  it("Kariri-Xokó mantém as três fontes sem tratar CNES e Lotações como validação independente", () => {
    const rows = [
      {
        chave: "lmap",
        payload: {
          dsei: [
            {
              k: "ALAGOAS E SERGIPE",
              n: "Alagoas e Sergipe",
              polos: [
                {
                  n: "KARIRI-XOKÓ",
                  lat: -10.1744,
                  lon: -36.8367,
                  uf: "AL",
                },
              ],
            },
          ],
        },
      },
      {
        chave: "rede_cnes",
        payload: {
          rede: {
            "ALAGOAS E SERGIPE": {
              u: [
                [
                  "POLO BASE INDIGENA KARIRI XOCO",
                  "9982787",
                  -10.186,
                  -36.84,
                  "PORTO REAL DO COLEGIO",
                  27,
                ],
              ],
              c: [],
            },
          },
          nac: [],
        },
      },
    ];

    const dataset = {
      "ALAGOAS E SERGIPE": [
        [
          "POLO BASE",
          "PB KARIRI XOKÓ",
          -10.186,
          -36.84,
          "PORTO REAL DO COLEGIO",
          "AL",
          "Muito acessível",
          "Terrestre",
        ],
      ],
    };

    const result = applyLotacoesGeograficas(rows, dataset);
    const polo = result[0].payload.dsei[0].polos[0];

    expect(polo.cnes).toBe("9982787");
    expect(polo.lat).toBe(-10.1744);
    expect(polo.lon).toBe(-36.8367);
    expect(polo.coord_lmap).toEqual({ lat: -10.1744, lon: -36.8367 });
    expect(polo.coord_lotacoes).toEqual({ lat: -10.186, lon: -36.84 });
    expect(polo.coord_cnes).toEqual({ lat: -10.186, lon: -36.84 });
    expect(polo.coord_validacao).toBe("pendente");
  });

  it("não identifica polo diferente só porque está perto no mesmo município", () => {
    const rows = [
      {
        chave: "lmap",
        payload: {
          dsei: [
            {
              k: "D",
              n: "D",
              polos: [{ n: "POVO", lat: -9, lon: -37 }],
            },
          ],
        },
      },
      {
        chave: "rede_cnes",
        payload: {
          rede: {
            D: {
              u: [["POLO BASE OUTRO POVO", "1", -9.001, -37, "MUNICIPIO", 27]],
              c: [],
            },
          },
          nac: [],
        },
      },
    ];
    const dataset = {
      D: [
        [
          "POLO BASE",
          "PB POVO",
          -9,
          -37,
          "MUNICIPIO",
          "AL",
          "Acessível",
          "Terrestre",
        ],
      ],
    };

    const result = applyLotacoesGeograficas(rows, dataset);
    const polo = result[0].payload.dsei[0].polos[0];

    expect(polo.cnes).toBeUndefined();
    expect(polo.lat).toBe(-9);
    expect(polo.lon).toBe(-37);
  });

  it("não escolhe candidato quando duas unidades ficam espacialmente empatadas", () => {
    const rows = [
      {
        chave: "lmap",
        payload: {
          dsei: [
            {
              k: "D",
              n: "D",
              polos: [{ n: "POVO", lat: -9, lon: -37 }],
            },
          ],
        },
      },
      {
        chave: "rede_cnes",
        payload: {
          rede: {
            D: {
              u: [
                ["POLO BASE ALFA", "1", -9.001, -37, "MUNICIPIO", 27],
                ["POLO BASE BETA", "2", -9.002, -37, "MUNICIPIO", 27],
              ],
              c: [],
            },
          },
          nac: [],
        },
      },
    ];
    const dataset = {
      D: [
        [
          "POLO BASE",
          "PB POVO",
          -9,
          -37,
          "MUNICIPIO",
          "AL",
          "Acessível",
          "Terrestre",
        ],
      ],
    };

    const result = applyLotacoesGeograficas(rows, dataset);
    const polo = result[0].payload.dsei[0].polos[0];
    expect(polo.cnes).toBeUndefined();
  });
});
