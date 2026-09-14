import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  "src/modules/health-map-immersive-workspace.js",
  "utf8",
);
const css = readFileSync(
  "src/styles/health-map-immersive-workspace.css",
  "utf8",
);
const main = readFileSync("src/main.js", "utf8");

describe("workspace imersivo dos mapas", () => {
  it("permite expandir e recolher cada painel", () => {
    expect(source).toContain("health-map-immersive-toggle");
    expect(source).toContain("is-immersive");
    expect(source).toContain("Sair da tela cheia");
    expect(source).toContain("Expandir mapa");
  });

  it("oferece saída por Escape", () => {
    expect(source).toContain('event.key !== "Escape"');
    expect(source).toContain("exitImmersive()");
  });

  it("recalcula o Leaflet ao mudar a geometria do painel", () => {
    expect(source).toContain('window.dispatchEvent(new Event("resize"))');
    expect(source).toContain("requestAnimationFrame");
  });

  it("preserva foco e expõe estado acessível", () => {
    expect(source).toContain('button.setAttribute("aria-pressed"');
    expect(source).toContain('button.setAttribute("aria-label"');
    expect(source).toContain("returnFocusTo?.focus()");
  });

  it("usa quase todo o viewport em desktop", () => {
    expect(css).toContain("position: fixed");
    expect(css).toContain("inset: 12px");
    expect(css).toContain("calc(100dvh - 126px)");
    expect(css).toContain("z-index: 12050");
  });

  it("mantém adaptação mobile", () => {
    expect(css).toContain("@media (max-width: 820px)");
    expect(css).toContain("calc(100dvh - 104px)");
  });

  it("está ligado no bootstrap principal", () => {
    expect(main).toContain(
      'import "./styles/health-map-immersive-workspace.css";',
    );
    expect(main).toContain(
      'import { initHealthMapImmersiveWorkspace } from "./modules/health-map-immersive-workspace.js";',
    );
    expect(main).toContain("initHealthMapImmersiveWorkspace();");
  });
});
