import { describe, expect, it } from "vitest";
import {
  FUNAI_PROXY_GEOJSON,
  FUNAI_PROXY_WMS,
  FUNAI_TERRITORIES_LAYER,
  FUNAI_TERRITORIES_WFS,
  FUNAI_TERRITORIES_WMS,
  dseiFeatureMatches,
  dseiFeatureName,
  funaiDseiUrl,
  funaiFeatureName,
  funaiViewportUrl,
  isHealthMapElementId,
  povosDaTerraIndigena,
  tooltipDaTerraIndigena,
} from "../src/modules/indigenous-territories-layer.js";

describe("camada de Terras Indígenas", () => {
  it("usa a camada oficial de polígonos da Funai", () => {
    expect(FUNAI_TERRITORIES_WMS).toContain("geoserver.funai.gov.br");
    expect(FUNAI_TERRITORIES_LAYER).toBe("Funai:tis_poligonais");
  });

  it("mantém as fontes oficiais e usa proxy same-origin no navegador", () => {
    expect(FUNAI_TERRITORIES_WFS).toContain("geoserver.funai.gov.br");
    expect(FUNAI_PROXY_WMS).toBe("/api/funai-wms");
    expect(FUNAI_PROXY_GEOJSON).toBe("/api/funai-geodata");

    const url = funaiViewportUrl({
      getWest: () => -40,
      getSouth: () => -12,
      getEast: () => -35,
      getNorth: () => -8,
    });
    expect(url).toContain("/api/funai-geodata?");
    expect(url).toContain("dataset=territories");
    expect(url).toContain("bbox=-40%2C-12%2C-35%2C-8");
  });

  it("busca a área oficial dos DSEIs pelo proxy do catálogo atual da Funai", () => {
    expect(funaiDseiUrl()).toBe("/api/funai-geodata?dataset=dsei");
  });

  it("reconhece o nome do DSEI sem depender de um único atributo", () => {
    expect(dseiFeatureName({ nome_dsei: "Alagoas e Sergipe" })).toBe(
      "Alagoas e Sergipe",
    );
    expect(dseiFeatureName({ dsei: "Yanomami" })).toBe("Yanomami");
    expect(
      dseiFeatureMatches(
        { properties: { nome_dsei: "DSEI Alagoas e Sergipe" } },
        "Alagoas e Sergipe",
      ),
    ).toBe(true);
  });

  it("lê o nome no atributo que a Funai publica hoje", () => {
    // `terrai_nome` é o que o DescribeFeatureType de Funai:tis_poligonais lista.
    expect(funaiFeatureName({ terrai_nome: "Potiguara" })).toBe("Potiguara");
  });

  it("mantém os nomes antigos como reserva", () => {
    expect(funaiFeatureName({ terrai_nom: "Kariri-Xocó" })).toBe("Kariri-Xocó");
    expect(funaiFeatureName({ nome: "Munduruku" })).toBe("Munduruku");
  });

  it("não inventa nome quando a camada não traz nenhum", () => {
    expect(funaiFeatureName({ gid: 12 })).toBe("");
  });
});

describe("povos declarados na Terra Indígena", () => {
  it("lê um povo único", () => {
    expect(povosDaTerraIndigena({ etnia_nome: "Kokama" })).toEqual(["Kokama"]);
  });

  it("separa por vírgula, como em Aldeia Katurama", () => {
    expect(
      povosDaTerraIndigena({ etnia_nome: "Pataxó, Pataxo Há-Há-Há" }),
    ).toEqual(["Pataxó", "Pataxo Há-Há-Há"]);
  });

  it("separa por ' e ', como em São Jeronimo", () => {
    expect(
      povosDaTerraIndigena({ etnia_nome: "Guaraní e Kaingang e Xetá" }),
    ).toEqual(["Guaraní", "Kaingang", "Xetá"]);
  });

  it("não parte nomes que contêm a letra e sem espaços em volta", () => {
    expect(povosDaTerraIndigena({ etnia_nome: "Tenetehara" })).toEqual([
      "Tenetehara",
    ]);
    expect(povosDaTerraIndigena({ etnia_nome: "Guarani Kaiowá" })).toEqual([
      "Guarani Kaiowá",
    ]);
  });

  it("descarta repetição e sobras de separador", () => {
    expect(
      povosDaTerraIndigena({ etnia_nome: "Kaingang, kaingang, , Xokleng" }),
    ).toEqual(["Kaingang", "Xokleng"]);
  });

  it("devolve lista vazia quando a Funai não declara etnia", () => {
    expect(povosDaTerraIndigena({ terrai_nome: "Sem etnia" })).toEqual([]);
    expect(povosDaTerraIndigena()).toEqual([]);
  });
});

describe("marcação da Terra Indígena no mapa", () => {
  it("põe o povo em primeiro lugar, e a terra abaixo", () => {
    const texto = tooltipDaTerraIndigena({
      etnia_nome: "Potiguara",
      terrai_nome: "Potiguara de Monte-Mór",
      uf_sigla: "PB",
    });
    expect(texto).toBe(
      "<b>Povo: Potiguara</b><br>Terra Indígena Potiguara de Monte-Mór<br>PB",
    );
  });

  it("diz 'Povos' no plural quando há mais de um", () => {
    expect(
      tooltipDaTerraIndigena({
        etnia_nome: "Guaraní e Kaingang",
        terrai_nome: "São Jeronimo",
      }),
    ).toContain("<b>Povos: Guaraní, Kaingang</b>");
  });

  it("sem etnia declarada, identifica pela terra e não afirma povo", () => {
    const texto = tooltipDaTerraIndigena({
      terrai_nome: "Acapuri de Cima",
      uf_sigla: "AM",
    });
    expect(texto).toBe("<b>Terra Indígena Acapuri de Cima</b><br>AM");
    expect(texto).not.toContain("Povo");
  });

  it("não devolve marcação quando não há nada a dizer", () => {
    expect(tooltipDaTerraIndigena({ gid: 9 })).toBe("");
  });

  it("escapa o que vem da Funai antes de virar HTML", () => {
    expect(
      tooltipDaTerraIndigena({ etnia_nome: "<img src=x onerror=alert(1)>" }),
    ).not.toContain("<img");
  });
});

describe("instalação da camada", () => {
  it("só se instala nos dois mapas de Saúde Indígena", () => {
    expect(isHealthMapElementId("map")).toBe(true);
    expect(isHealthMapElementId("detailMap")).toBe(true);
    expect(isHealthMapElementId("otherMap")).toBe(false);
    expect(isHealthMapElementId({ id: "detailMap" })).toBe(true);
  });
});
