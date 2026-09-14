import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/modules/map-base-layer-switcher.js", "utf8");
const main = readFileSync("src/main.js", "utf8");
const css = readFileSync("src/styles/map-base-layer-switcher.css", "utf8");

describe("seletor Mapa | Satélite", () => {
  it("usa World Imagery como camada satélite real", () => {
    expect(source).toContain("World_Imagery/MapServer/tile/{z}/{y}/{x}");
    expect(source).toContain("Esri, Maxar, Earthstar Geographics");
  });

  it("não depende de chave secreta no frontend", () => {
    expect(source).not.toMatch(/accessToken|apiKey|VITE_.*(?:MAP|ESRI)/i);
  });

  it("reconhece os provedores cartográficos atuais sem alterar o legado", () => {
    expect(source).toContain("tile.openstreetmap.org");
    expect(source).toContain("basemaps.cartocdn.com");
    expect(source).toContain("classifyBaseLayerUrl");
  });

  it("troca apenas tile layers e preserva overlays vetoriais", () => {
    expect(source).toContain("__agsusBaseMapKind");
    expect(source).toContain("map.eachLayer");
    expect(source).toContain("map.removeLayer(layer)");
    expect(source).not.toContain("clearLayers()");
  });

  it("volta ao mapa após quatro falhas consecutivas de tiles", () => {
    expect(source).toContain("SATELLITE_ERROR_LIMIT = 4");
    expect(source).toContain(
      "setBaseMapMode(L, map, MODE_MAP, { persist: true })",
    );
    expect(source).toContain("agsus:map-satellite-fallback");
  });

  it("expõe o estado por aria-pressed e rótulos legíveis", () => {
    expect(source).toContain('"Mapa"');
    expect(source).toContain('"Satélite"');
    expect(source).toContain("aria-pressed");
    expect(source).toContain('aria-label", "Camada de fundo do mapa"');
  });

  it("é instalado depois do guard do Leaflet e carrega o CSS próprio", () => {
    const guardCall = main.indexOf("installLeafletMapGuard();");
    const switcherCall = main.indexOf("installMapBaseLayerSwitcher();");
    expect(guardCall).toBeGreaterThan(-1);
    expect(switcherCall).toBeGreaterThan(guardCall);
    expect(main).toContain('import "./styles/map-base-layer-switcher.css";');
    expect(main).toContain(
      'import { installMapBaseLayerSwitcher } from "./modules/map-base-layer-switcher.js";',
    );
  });

  it("mantém os dois botões utilizáveis em tela estreita e tema escuro", () => {
    expect(css).toContain("@media (max-width: 700px)");
    expect(css).toContain('[data-theme="dark"] .agsus-basemap-switcher');
    expect(css).toContain(".agsus-basemap-switcher__button:focus-visible");
  });
});
