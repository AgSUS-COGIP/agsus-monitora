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
    expect(records.every((record) => record[2] >= -90 && record[2] <= 90)).toBe(
      true,
    );
    expect(
      records.every((record) => record[3] >= -180 && record[3] <= 180),
    ).toBe(true);
  });

  it("substitui sede e polo por coordenadas da planilha e preserva a estrutura existente", () => {
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
      { chave: "rede_cnes", payload: { rede: {}, nac: [] } },
    ];
    const dataset = {
      "ALAGOAS E SERGIPE": [
        [
          "SEDE",
          "SEDE DSEI",
          -9.60197359211841,
          -35.748154999352536,
          "MACEIO",
          "AL",
          "Muito acessível",
          "",
        ],
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
        [
          "UNIDADE DE LOTAÇÃO",
          "UBSI TESTE",
          -9.8,
          -37.1,
          "TRAIPU",
          "AL",
          "Acessível",
          "Terrestre",
        ],
      ],
    };

    const result = applyLotacoesGeograficas(rows, dataset);
    const dsei = result[0].payload.dsei[0];
    const polo = dsei.polos[0];
    const network = result[1].payload.rede["ALAGOAS E SERGIPE"];

    expect(dsei.lat).toBe(-9.60197359211841);
    expect(dsei.lon).toBe(-35.748154999352536);
    expect(dsei.coord_fonte).toContain("Lotações");
    expect(polo.p).toBe(120);
    expect(polo.lat).toBe(-9.971);
    expect(polo.lon).toBe(-37.003);
    expect(polo.meio_acesso).toBe("Terrestre/Fluvial");
    expect(network.u.some((item) => item[0] === "UBSI TESTE")).toBe(true);
  });

  it("atualiza as CASAIs nacionais sem duplicá-las", () => {
    const rows = [
      { chave: "lmap", payload: { dsei: [] } },
      {
        chave: "rede_cnes",
        payload: {
          rede: {},
          nac: [["CASAI BRASÍLIA", "7898215", -15.72, -47.79, "BRASÍLIA", 53]],
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
    expect(nac[0][2]).toBe(-15.7432639227901);
    expect(nac[0][3]).toBe(-47.713302417615324);
  });
});
