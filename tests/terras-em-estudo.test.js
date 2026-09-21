import { describe, expect, it } from "vitest";
import {
  AVISO_DE_ESTUDO,
  funaiEstudoUrl,
  tooltipDaTerraEmEstudo,
} from "../src/modules/indigenous-territories-layer.js";

/*
  AS TERRAS QUE AINDA NÃO TÊM LIMITE

  `tis_poligonais` traz seis fases — Regularizada, Declarada, Delimitada,
  Encaminhada RI, Homologada e Em Estudo —, mas só quem já tem limite
  desenhado. As 163 terras em estudo sem limite definido existem apenas como
  ponto, na camada `tis_pontos`.

  Sem elas o mapa mostrava polos base aparentemente fora de qualquer terra
  indígena. Medido sobre os dados reais: dos 146 polos fora de polígono, nove
  estão a menos de 5 km de uma terra em estudo. O polo de João Câmara está a
  60 metros da TI Mendonça do Amarelão.
*/
describe("a camada das terras em estudo", () => {
  it("pede o conjunto pelo proxy same-origin", () => {
    expect(funaiEstudoUrl()).toBe("/api/funai-geodata?dataset=estudo");
  });
});

describe("o que o ponto diz de si", () => {
  const terra = {
    terrai_nome: "Mendonça do Amarelão",
    etnia_nome: "Potiguara",
    uf_sigla: "RN",
  };

  it("nomeia o povo e a terra, como a camada de polígonos", () => {
    const texto = tooltipDaTerraEmEstudo(terra);
    expect(texto).toContain("<b>Povo: Potiguara</b>");
    expect(texto).toContain("Terra Indígena Mendonça do Amarelão");
    expect(texto).toContain("RN");
  });

  /*
    Um ponto no mapa é lido como lugar. Sem esta frase, quem olha supõe que a
    terra tem aquele tamanho e aquela posição fechada — e nenhum documento
    sustenta isso enquanto o estudo corre.
  */
  it("diz sempre que não há limite publicado", () => {
    expect(tooltipDaTerraEmEstudo(terra)).toContain("sem limite publicado");
    expect(tooltipDaTerraEmEstudo({})).toContain("sem limite publicado");
    expect(AVISO_DE_ESTUDO).toContain("em estudo");
  });

  it("não inventa povo quando a Funai não declara", () => {
    const texto = tooltipDaTerraEmEstudo({ terrai_nome: "Katokinn" });
    expect(texto).not.toContain("Povo");
    expect(texto).toContain("Terra Indígena Katokinn");
  });

  it("escapa o que vem da Funai antes de virar HTML", () => {
    expect(
      tooltipDaTerraEmEstudo({ terrai_nome: "<img src=x onerror=alert(1)>" }),
    ).not.toContain("<img");
  });
});
