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

  it("lê nomes conhecidos sem depender de um único campo do GeoServer", () => {
    expect(funaiFeatureName({ terrai_nom: "Kariri-Xocó" })).toBe("Kariri-Xocó");
    expect(funaiFeatureName({ nome: "Munduruku" })).toBe("Munduruku");
  });

  it("só se instala nos dois mapas de Saúde Indígena", () => {
    expect(isHealthMapElementId("map")).toBe(true);
    expect(isHealthMapElementId("detailMap")).toBe(true);
    expect(isHealthMapElementId("otherMap")).toBe(false);
    expect(isHealthMapElementId({ id: "detailMap" })).toBe(true);
  });
});
