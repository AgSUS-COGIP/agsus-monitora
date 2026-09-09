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

  /*
    Este teste travava o contrário do que se quer hoje.

    `auth_access_logo_url` é a marca da tela de **login**. Enquanto
    `applyConfigToUi()` a empurrava também para `#sideLogo`, escolher uma logo
    para a barra lateral não sobrevivia ao carregamento das configurações — a do
    login voltava por cima. A barra lateral passou a ter chave própria
    (`ui_sidebar_logo_url`) e um dono só, `sidebar-branding.js`.

    O que continua garantido: a marca do login segue normalizada onde ela
    pertence, e a barra lateral não volta a ser sequestrada por ela.
  */
  it("normaliza a marca oficial na tela de acesso", () => {
    expect(app).toContain("normalizeAccessLogoUrl(logoDoBanco)");
  });

  it("não deixa a marca do login mandar na sidebar", () => {
    const applyConfig = app.slice(
      app.indexOf("function applyConfigToUi"),
      app.indexOf("function normalizeUnitName"),
    );
    expect(applyConfig).not.toContain('"sideLogo"');
  });
});
