import { describe, expect, it } from "vitest";
import {
  municipiosDaResposta,
  pontosDosMunicipios,
} from "../src/lib/visao-geral-da-area.ts";

describe("fronteira dos municípios do mapa de Projetos", () => {
  it("ignora formatos sem lugar e não transforma objetos em nomes", () => {
    expect(municipiosDaResposta({ municipio_uf: "Irati/PR" })).toEqual([]);
    expect(
      municipiosDaResposta([
        null,
        [],
        "Irati/PR",
        { municipio_uf: {} },
        { uf: [] },
      ]),
    ).toEqual([]);
  });

  it("normaliza números válidos e descarta valores numéricos malformados", () => {
    const [lugar] = municipiosDaResposta([
      {
        municipio_uf: "Irati/PR",
        vagas: "5",
        vagas_edital: {},
        candidatos: Infinity,
        aprovados: [3],
        reprovados: "2",
        codigo_ibge: true,
        latitude: [],
        longitude: -50,
        editais: [
          { projeto: "CCE", vagas: true, lotacoes: [null, {}, " Irati/PR "] },
        ],
      },
    ]);
    expect(lugar).toMatchObject({
      vagas: 5,
      vagasEdital: null,
      candidatos: 0,
      aprovados: 0,
      reprovados: 2,
      codigoIbge: null,
      coordenada: null,
    });
    expect(lugar.editais[0]).toMatchObject({
      vagas: null,
      lotacoes: ["Irati/PR"],
    });
    expect(pontosDosMunicipios([lugar])[0].coordenadas).toBeNull();
  });

  it("distingue coordenada ausente no banco antigo de posição ainda não cadastrada", () => {
    const lugares = municipiosDaResposta([
      { municipio_uf: "Irati/PR" },
      { municipio_uf: "Irati/PR", latitude: null, longitude: null },
      {
        municipio_uf: "Irati/PR",
        latitude: "-25.4",
        longitude: "-50.6",
        coordenada_origem: "MANUAL",
      },
    ]);
    expect(lugares[0].coordenada).toBeUndefined();
    expect(lugares[1].coordenada).toBeNull();
    expect(lugares[2].coordenada).toEqual({
      latitude: -25.4,
      longitude: -50.6,
      origem: "MANUAL",
    });
    const pontos = pontosDosMunicipios(lugares);
    expect(
      pontos.find((ponto) => ponto.coordenada === undefined).coordenadas,
    ).not.toBeNull();
    expect(
      pontos.find((ponto) => ponto.coordenada === null).coordenadas,
    ).toBeNull();
  });
});
