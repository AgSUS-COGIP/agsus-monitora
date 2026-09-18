import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const guard = readFileSync("src/modules/map-guard.js", "utf8");
const switcher = readFileSync("src/modules/map-base-layer-switcher.js", "utf8");

describe("faixa de zoom do mapa de Saude Indigena", () => {
  it("mantem guard e switcher no mesmo limite de 500 km", () => {
    expect(switcher).toContain("MAP_MIN_ZOOM = 4.5");
    expect(guard).toContain("HEALTH_MAP_MIN_ZOOM = 4.5");
    expect(guard).toContain("HEALTH_MAP_OVERVIEW_MAX_ZOOM = 4.5");
    expect(guard).not.toContain("originalSetMinZoom?.(3)");
    expect(guard).not.toContain("Math.min(requested, 3)");
  });

  it("pede imagem de satelite nativa ate o limite visual do mapa", () => {
    expect(switcher).toContain("SATELLITE_MAX_NATIVE_ZOOM = 19");
    expect(switcher).toContain("maxNativeZoom: SATELLITE_MAX_NATIVE_ZOOM");
    expect(switcher).toContain("MAP_MAX_ZOOM = 19");
  });
});
