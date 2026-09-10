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

/*
  O botão de acesso era fixo em #101c2a — azul quase preto — para qualquer
  identidade escolhida. Medido contra as cores em uso:

    painel #6c009e (o de hoje)  botão escuro 1.74:1   botão claro  9.85:1
    painel #c898eb (o do SIGAV) botão escuro 7.49:1   botão claro  2.30:1

  Num painel escuro ele quase desaparecia, bem abaixo do mínimo de 3:1 que a
  WCAG pede para a superfície de um componente. Num painel claro o escuro é
  justamente o que funciona — por isso o botão inverte com o painel, em vez de
  ficar fixo numa das duas opções.

  Confirmado na build de produção, com as transições assentadas:

    #6c009e -> botão branco,  9.85:1 contra o painel, texto 17.19:1
    #c898eb -> botão escuro,  7.49:1
    #052029 -> botão branco, 16.87:1
    #ffffff -> botão escuro, 17.19:1
*/
describe("o botão de acesso acompanha a cor do painel", () => {
  const regra = post152.slice(
    post152.indexOf("#loginScreen.login-panel-dark .google-login-btn {"),
  );

  const canal = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const linear = (v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  const luminancia = (h) => {
    const [r, g, b] = canal(h);
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  };
  const contraste = (a, b) => {
    const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };

  it("num painel escuro o botão vira claro", () => {
    expect(regra).toContain("background: #ffffff");
    expect(regra).toContain("color: #101c2a");
  });

  it("o hover continua claro, sem sumir com o texto", () => {
    const hover = post152.slice(
      post152.indexOf(
        "#loginScreen.login-panel-dark .google-login-btn:hover {",
      ),
    );
    expect(hover).toContain("background: #eef4fb");
    // O texto do botão claro é escuro; o hover não pode escurecer o fundo.
    expect(contraste("#eef4fb", "#101c2a")).toBeGreaterThan(4.5);
  });

  /*
    Sobre um botão claro, o disco branco do "G" desapareceria sem contorno.
  */
  it("a marca do Google ganha contorno no botão claro", () => {
    const gmark = post152.slice(
      post152.indexOf(
        "#loginScreen.login-panel-dark .google-login-btn .gmark {",
      ),
    );
    expect(gmark).toContain("box-shadow: inset 0 0 0 1px");
  });

  it("as duas escolhas passam do mínimo de 3:1 contra os painéis reais", () => {
    // Painel escuro em uso hoje: o botão claro é o que funciona.
    expect(contraste("#ffffff", "#6c009e")).toBeGreaterThan(3);
    expect(contraste("#101c2a", "#6c009e")).toBeLessThan(3);
    // Painel claro do SIGAV: o escuro é que funciona.
    expect(contraste("#101c2a", "#c898eb")).toBeGreaterThan(3);
    expect(contraste("#ffffff", "#c898eb")).toBeLessThan(3);
  });

  it("é a mesma classe que já governa texto e logo", () => {
    expect(regra).toContain("#loginScreen.login-panel-dark");
    expect(post152).toContain("#loginScreen.login-panel-dark #loginLogo");
  });
});
