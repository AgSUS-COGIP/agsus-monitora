import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync("index.html", "utf8");
const app = readFileSync("src/modules/legacy-app.js", "utf8");

describe("platform shell invariants", () => {
  it("remove o modo executivo da interface e do runtime", () => {
    expect(html).not.toContain("executiveModeBtn");
    expect(app).not.toContain("toggleExecutiveMode");
    expect(app).not.toContain("feature_modo_executivo");
  });

  it("mantém painéis no shell sem redirecionamento de página", () => {
    const openPanel = app.slice(
      app.indexOf("function openPanel"),
      app.indexOf("function buildExternalPanel"),
    );
    expect(openPanel).not.toContain("window.location.assign");
    expect(openPanel).not.toContain('classList.add("external-clean")');
    expect(openPanel).toContain('classList.remove("external-clean")');
  });

  it("usa a marca oficial também na sidebar", () => {
    expect(app).toContain(
      'normalizeAccessLogoUrl(cfgValue("auth_access_logo_url"))',
    );
  });
});
