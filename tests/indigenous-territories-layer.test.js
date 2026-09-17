import { describe, expect, it } from "vitest";
import {
  FUNAI_TERRITORIES_LAYER,
  FUNAI_TERRITORIES_WMS,
  isHealthMapElementId,
} from "../src/modules/indigenous-territories-layer.js";

describe("camada de Terras Indígenas", () => {
  it("usa a camada oficial de polígonos da Funai", () => {
    expect(FUNAI_TERRITORIES_WMS).toContain("geoserver.funai.gov.br");
    expect(FUNAI_TERRITORIES_LAYER).toBe("Funai:tis_poligonais");
  });

  it("só se instala nos dois mapas de Saúde Indígena", () => {
    expect(isHealthMapElementId("map")).toBe(true);
    expect(isHealthMapElementId("detailMap")).toBe(true);
    expect(isHealthMapElementId("otherMap")).toBe(false);
    expect(isHealthMapElementId({ id: "detailMap" })).toBe(true);
  });
});
