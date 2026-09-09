import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { needsLightForeground } from "../src/lib/access-branding.js";

const post152 = readFileSync(
  "src/styles/post-152-regression-fixes.css",
  "utf8",
);
const systemUi = readFileSync("src/styles/system-ui-fixes.css", "utf8");
const sidebar = readFileSync("src/modules/sidebar-branding.js", "utf8");

/*
  A logo da barra lateral sumia quando a cor escolhida era escura.

  O tema escuro do app já clareava a marca; a **cor da barra**, escolhida em
  Configurações, não — e as duas são independentes. Dava para ter barra escura
  com tema claro, e aí a logo escura ficava sobre fundo escuro.

  O fundo branco atrás dela não salvava: `system-ui-fixes.css` zera o fundo de
  `.side-logo-wrap` com `background: transparent !important`, então a imagem
  repousa direto sobre a cor da barra.

  Medido no navegador, nas quatro combinações:

    barra escura + tema claro   -> brightness(0) invert(0.96)   (era `none`)
    barra escura + tema escuro  -> brightness(0) invert(0.96)
    barra clara  + tema escuro  -> brightness(0) invert(0.96)
    tudo claro                  -> none
*/
describe("a marca acompanha o contraste da barra lateral", () => {
  const regra = post152.slice(
    post152.indexOf("#loginScreen.login-panel-dark #loginLogo"),
    post152.indexOf("#loginScreen.login-panel-dark .login-product-mark i"),
  );

  it("a cor escolhida da barra clareia a logo", () => {
    expect(regra).toContain("body.sidebar-theme-dark .app #sideLogo");
    expect(regra).toContain("body.sidebar-theme-dark .app .side-logo");
  });

  it("usa o mesmo filtro já aplicado ao tema escuro e ao login", () => {
    expect(regra).toContain("filter: brightness(0) invert(0.96) !important");
    // Um filtro só, para as quatro situações — não uma variante por caso.
    expect(regra.match(/filter:/g)).toHaveLength(1);
  });

  it("os casos que já funcionavam continuam na mesma regra", () => {
    expect(regra).toContain("#loginScreen.login-panel-dark #loginLogo");
    expect(regra).toContain('html[data-theme="dark"] .app .side-logo');
  });

  /*
    Se o fundo do invólucro voltasse a ser branco, a logo escura teria onde
    repousar e o filtro deixaria de ser necessário — mas hoje ele é zerado.
  */
  it("o invólucro continua sem fundo próprio", () => {
    expect(systemUi).toMatch(
      /\.app \.side-logo-wrap[^{]*\{[^}]*background:\s*transparent\s*!important/,
    );
  });

  it("quem decide o contraste continua sendo a luminância da cor", () => {
    expect(sidebar).toContain("needsLightForeground(currentColor)");
    expect(sidebar).toContain("sidebar-theme-dark");
  });

  it("a classe só aparece em cores que pedem primeiro plano claro", () => {
    expect(needsLightForeground("#1b2d3e")).toBe(true);
    expect(needsLightForeground("#052029")).toBe(true);
    expect(needsLightForeground("#ffffff")).toBe(false);
    expect(needsLightForeground("#f2e8d5")).toBe(false);
  });
});
