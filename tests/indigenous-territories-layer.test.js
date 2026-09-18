import { describe, expect, it } from "vitest";
import {
  FUNAI_TERRITORIES_LAYER,
  FUNAI_TERRITORIES_WFS,
  FUNAI_TERRITORIES_WMS,
  funaiFeatureName,
  funaiViewportUrl,
  isHealthMapElementId,
} from "../src/modules/indigenous-territories-layer.js";

describe("camada de Terras Indígenas", () => {
  it("usa a camada oficial de polígonos da Funai", () => {
    expect(FUNAI_TERRITORIES_WMS).toContain("geoserver.funai.gov.br");
    expect(FUNAI_TERRITORIES_LAYER).toBe("Funai:tis_poligonais");
  });

  it("usa WFS oficial para os polígonos vetoriais no zoom territorial", () => {
    expect(FUNAI_TERRITORIES_WFS).toContain("geoserver.funai.gov.br");
    const url = funaiViewportUrl({
      getWest: () => -40,
      getSouth: () => -12,
      getEast: () => -35,
      getNorth: () => -8,
    });
    expect(url).toContain("service=WFS");
    expect(url).toContain("Funai%3Atis_poligonais");
    expect(url).toContain("bbox=-40%2C-12%2C-35%2C-8%2CEPSG%3A4326");
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
