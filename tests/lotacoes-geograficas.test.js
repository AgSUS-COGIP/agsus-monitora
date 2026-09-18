import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyLotacoesGeograficas } from "../src/modules/lotacoes-geograficas-transport.js";

function loadDataset() {
  return Object.assign(
    {},
    ...Array.from({ length: 8 }, (_, index) => {
      const file = `public/data/lotacoes-geograficas-${String(index + 1).padStart(2, "0")}.json`;
      return JSON.parse(readFileSync(file, "utf8"));
    }),
  );
}

describe("lotações geográficas", () => {
  it("mantém somente os 598 registros aceitos da planilha", () => {
    const dataset = loadDataset();
    const records = Object.values(dataset).flat();

    expect(records).toHaveLength(598);
    expect(records.filter((record) => record[0] === "SEDE")).toHaveLength(34);
    expect(records.filter((record) => record[0] === "POLO BASE")).toHaveLength(
      403,
    );
    expect(records.filter((record) => record[0] === "CASAI")).toHaveLength(79);
    expect(
      records.filter((record) =>
        ["UNIDADE DE LOTAÇÃO", "ROTA"].includes(record[0]),
      ),
    ).toHaveLength(82);
    expect(
      records.every(
        (record) => Number.isFinite(record[2]) && Number.isFinite(record[3]),
      ),
    ).toBe(true);
  });

  it("preserva polo no lmap e não cria cópia do polo dentro da rede", () => {
    const rows = [
      {
        chave: "lmap",
        payload: {
          dsei: [
            {
              k: "ALAGOAS E SERGIPE",
              n: "Alagoas e Sergipe",
              lat: -9.64,
              lon: -35.7,
              polos: [{ n: "Aconã", lat: -9, lon: -37, p: 120 }],
            },
          ],
        },
      },
      {
        chave: "rede_cnes",
        payload: {
          rede: {
            "ALAGOAS E SERGIPE": {
              u: [["POLO BASE ACONA", "1234567", -9.95, -37.01, "TRAIPU", 27]],
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
          "PB ACONÃ",
          -9.971,
          -37.003,
          "TRAIPU",
          "AL",
          "Muito acessível",
          "Terrestre/Fluvial",
        ],
      ],
    };

    const result = applyLotacoesGeograficas(rows, dataset);
    const dsei = result[0].payload.dsei[0];
    const network = result[1].payload.rede["ALAGOAS E SERGIPE"];

    expect(dsei.polos).toHaveLength(1);
    expect(dsei.polos[0].cnes).toBe("1234567");
    expect(dsei.polos[0].lat).toBe(-9.95);
    expect(dsei.polos[0].lon).toBe(-37.01);
    expect(dsei.polos[0].coord_fonte).toBe("CNES");
    expect(dsei.polos[0].coord_lotacoes).toEqual({ lat: -9.971, lon: -37.003 });
    expect(network.u).toHaveLength(1);
    expect(network.u[0][1]).toBe("1234567");
    expect(network.u[0][8]).toContain("CNES");
    expect(network.u[0][9].coordenada_exibida).toBe("CNES");
  });

  it("reconcilia UBSI da planilha com CNES e mantém a coordenada CNES", () => {
    const rows = [
      {
        chave: "lmap",
        payload: { dsei: [{ k: "CEARA", n: "Ceará", polos: [] }] },
      },
      {
        chave: "rede_cnes",
        payload: {
          rede: {
            CEARA: {
              u: [
                [
                  "UBSI MONGUBA POVO PITAGUARY",
                  "7216262",
                  -3.984098,
                  -38.617984,
                  "PACATUBA",
                  23,
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
      CEARA: [
        [
          "UNIDADE DE LOTAÇÃO",
          "UBSI MONGUBA POVO PITAGUARY",
          -3.98,
          -38.62,
          "PACATUBA",
          "CE",
          "Acessível",
          "Terrestre",
        ],
      ],
    };

    const result = applyLotacoesGeograficas(rows, dataset);
    const row = result[1].payload.rede.CEARA.u[0];

    expect(result[1].payload.rede.CEARA.u).toHaveLength(1);
    expect(row[1]).toBe("7216262");
    expect(row[2]).toBe(-3.984098);
    expect(row[3]).toBe(-38.617984);
    expect(row[7]).toBe("Terrestre");
    expect(row[9].coordenadas.lotacoes).toEqual({ lat: -3.98, lon: -38.62 });
  });

  it("mantém unidade sem CNES quando não existe correspondência confiável", () => {
    const rows = [
      {
        chave: "lmap",
        payload: { dsei: [{ k: "CEARA", n: "Ceará", polos: [] }] },
      },
      {
        chave: "rede_cnes",
        payload: { rede: { CEARA: { u: [], c: [] } }, nac: [] },
      },
    ];
    const dataset = {
      CEARA: [
        [
          "UNIDADE DE LOTAÇÃO",
          "UBSI NOVA",
          -4,
          -39,
          "CAUCAIA",
          "CE",
          "Acessível",
          "Terrestre",
        ],
      ],
    };

    const result = applyLotacoesGeograficas(rows, dataset);
    const row = result[1].payload.rede.CEARA.u[0];

    expect(row[0]).toBe("UBSI NOVA");
    expect(row[1]).toBe("");
    expect(row[8]).toContain("Lotações");
    expect(row[9].divergencia).toBe("sem_cnes");
  });

  it("não transforma rota da planilha em UBSI ou estabelecimento CNES", () => {
    const rows = [
      {
        chave: "lmap",
        payload: { dsei: [{ k: "ALTAMIRA", n: "Altamira", polos: [] }] },
      },
      {
        chave: "rede_cnes",
        payload: { rede: { ALTAMIRA: { u: [], c: [] } }, nac: [] },
      },
    ];
    const dataset = {
      ALTAMIRA: [
        [
          "ROTA",
          "ROTA VOLTA GRANDE",
          -3.6,
          -51.6,
          "ALTAMIRA",
          "PA",
          "Remoto",
          "Fluvial",
        ],
      ],
    };

    const result = applyLotacoesGeograficas(rows, dataset);
    expect(result[1].payload.rede.ALTAMIRA.u).toHaveLength(0);
  });

  it("deduplica registros CNES repetidos pelo mesmo código", () => {
    const rows = [
      {
        chave: "lmap",
        payload: { dsei: [{ k: "CEARA", n: "Ceará", polos: [] }] },
      },
      {
        chave: "rede_cnes",
        payload: {
          rede: {
            CEARA: {
              u: [
                ["UBSI TESTE", "9999999", -3.7, -38.6, "CAUCAIA", 23],
                ["UBSI TESTE DUP", "9999999", -3.7, -38.6, "CAUCAIA", 23],
              ],
              c: [],
            },
          },
          nac: [],
        },
      },
    ];

    const result = applyLotacoesGeograficas(rows, {});
    expect(result[1].payload.rede.CEARA.u).toHaveLength(2);

    const dataset = { CEARA: [] };
    const deduped = applyLotacoesGeograficas(rows, dataset);
    expect(deduped[1].payload.rede.CEARA.u).toHaveLength(1);
  });

  it("atualiza as CASAIs nacionais sem duplicá-las e preserva CNES", () => {
    const rows = [
      { chave: "lmap", payload: { dsei: [] } },
      {
        chave: "rede_cnes",
        payload: {
          rede: {},
          nac: [["CASAI BRASÍLIA", "7898215", -15.72, -47.79, "BRASILIA", 53]],
        },
      },
    ];
    const dataset = {
      "CASAI DF": [
        [
          "CASAI",
          "CASAI DF",
          -15.7432639227901,
          -47.713302417615324,
          "BRASILIA",
          "DF",
          "Muito acessível",
          "Terrestre",
        ],
      ],
    };

    const result = applyLotacoesGeograficas(rows, dataset);
    const nac = result[1].payload.nac;

    expect(nac).toHaveLength(1);
    expect(nac[0][1]).toBe("7898215");
    expect(nac[0][2]).toBe(-15.72);
    expect(nac[0][3]).toBe(-47.79);
    expect(nac[0][9].coordenadas.lotacoes.lat).toBe(-15.7432639227901);
  });
});
