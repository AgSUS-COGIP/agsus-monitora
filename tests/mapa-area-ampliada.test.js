import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const main = readFileSync("src/main.js", "utf8");
const css = readFileSync("src/styles/health-map-size-tuning.css", "utf8");

describe("área ampliada do mapa", () => {
  it("carrega o ajuste depois do workspace base", () => {
    const base = main.indexOf('import "./styles/health-map-workspace.css";');
    const tuning = main.indexOf('import "./styles/health-map-size-tuning.css";');
    const immersive = main.indexOf(
      'import "./styles/health-map-immersive-workspace.css";',
    );

    expect(base).toBeGreaterThan(-1);
    expect(tuning).toBeGreaterThan(base);
    expect(immersive).toBeGreaterThan(tuning);
  });

  it("dá mais altura útil ao mapa em desktop", () => {
    expect(css).toContain("--health-map-height: clamp(520px, 70vh, 840px)");
  });

  it("prioriza o mapa nacional sem remover a lista lateral", () => {
    expect(css).toContain(
      "minmax(0, calc(var(--health-map-height) * 1.55))",
    );
    expect(css).toContain("minmax(340px, 1fr)");
  });

  it("mantém fallback responsivo em telas estreitas", () => {
    expect(css).toContain("@media (max-width: 900px)");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr)");
  });
});
