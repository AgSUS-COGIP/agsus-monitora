import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { needsLightForeground } from "../src/lib/access-branding.js";

// A tela de acesso e a marca da barra lateral são de platform-shell.css (seção Login).
const shell = readFileSync("src/styles/platform-shell.css", "utf8").replace(
  /\r\n/g,
  "\n",
);
const semComentarios = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const sidebar = readFileSync("src/modules/sidebar-branding.js", "utf8");

/*
  A logo da barra lateral sumia quando a cor escolhida era escura.

  O tema escuro do app já clareava a marca; a **cor da barra**, escolhida em
  Configurações, não — e as duas são independentes. Dava para ter barra escura
  com tema claro, e aí a logo escura ficava sobre fundo escuro.

  O fundo branco atrás dela não salvava: `.side-logo-wrap` não tem fundo
  próprio, então a imagem repousa direto sobre a cor da barra.

  Medido no navegador, nas quatro combinações:

    barra escura + tema claro   -> brightness(0) invert(0.96)   (era `none`)
    barra escura + tema escuro  -> brightness(0) invert(0.96)
    barra clara  + tema escuro  -> brightness(0) invert(0.96)
    tudo claro                  -> none
*/
describe("a marca acompanha o contraste da barra lateral", () => {
  const regra = shell.slice(
    shell.indexOf("#loginScreen.login-panel-dark #loginLogo"),
    shell.indexOf("#loginScreen.login-panel-dark .login-product-mark i"),
  );

  it("a cor escolhida da barra clareia a logo", () => {
    expect(regra).toContain("body.sidebar-theme-dark .app #sideLogo");
    expect(regra).toContain("body.sidebar-theme-dark .app .side-logo");
  });

  it("usa o mesmo filtro já aplicado ao tema escuro e ao login", () => {
    // Sem !important: nenhuma outra regra dá filtro à logo.
    expect(regra).toContain("filter: brightness(0) invert(0.96);");
    // Um filtro só, para as quatro situações — não uma variante por caso.
    expect(regra.match(/filter:/g)).toHaveLength(1);
  });

  it("os casos que já funcionavam continuam na mesma regra", () => {
    expect(regra).toContain("#loginScreen.login-panel-dark #loginLogo");
    expect(regra).toContain('html[data-theme="dark"] .app .side-logo');
  });

  /*
    Se o fundo do invólucro voltasse a ser branco, a logo escura teria onde
    repousar e o filtro deixaria de ser necessário — nenhum CSS lhe dá fundo.
  */
  it("o invólucro continua sem fundo próprio", () => {
    const comFundo = readdirSync("src/styles")
      .filter((nome) => nome.endsWith(".css"))
      .flatMap((nome) =>
        [
          ...semComentarios(
            readFileSync(`src/styles/${nome}`, "utf8"),
          ).matchAll(/([^{}]*)\{([^}]*)\}/g),
        ]
          .filter(([, seletor]) =>
            seletor.split(",").some((s) => /\.side-logo-wrap$/.test(s.trim())),
          )
          .filter(([, , corpo]) =>
            /background(-color|-image)?\s*:\s*(?!transparent|none)/.test(corpo),
          )
          .map(([, seletor]) => `${nome}: ${seletor.trim()}`),
      );
    expect(comFundo).toEqual([]);
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
  O botão de acesso, claro como no SIGAV.

  Ele era fixo em #101c2a — azul quase preto. O SIGAV usa
  `bg-white text-[#003b70] shadow-lg hover:bg-slate-100`, e é essa a aparência
  pedida.

  Medido contra os painéis reais:

    branco sobre #c090eb (o atual)   2.49:1
    branco sobre #c898eb (o SIGAV)   2.30:1
    branco sobre #6c009e (escuro)    9.85:1
    texto #003b70 sobre branco      11.29:1
    borda #003b70 sobre #c090eb      4.53:1

  O preenchimento branco fica abaixo de 3:1 num painel claro — no SIGAV também.
  A WCAG pede que a **borda do componente** seja perceptível, e é a borda que
  garante isso aqui.
*/
describe("o botão de acesso é claro, como no SIGAV", () => {
  const regra = shell.slice(shell.indexOf("#loginScreen .google-login-btn {"));

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

  // O azul do SIGAV (#003b70) virou o blue-800 do Design System AgSUS (#153B6F).
  it("usa o azul institucional do Design System", () => {
    expect(regra).toContain("background: #ffffff");
    expect(regra).toContain("color: var(--color-blue-800)");
  });

  it("o hover é o slate-100 do SIGAV", () => {
    const hover = shell.slice(
      shell.indexOf("#loginScreen .google-login-btn:hover {"),
    );
    expect(hover).toContain("background: #f1f5f9");
    // O texto é escuro; o hover clareia, então continua legível.
    expect(contraste("#f1f5f9", "#153B6F")).toBeGreaterThan(4.5);
  });

  /*
    Sem a borda, a aresta do botão mede 2.49:1 contra o painel atual — é o que
    acontece no SIGAV. Com ela, 4.53:1.
  */
  it("a borda torna a aresta perceptível onde o preenchimento não basta", () => {
    expect(regra).toContain("border: 1px solid var(--color-blue-800)");
    expect(contraste("#ffffff", "#c090eb")).toBeLessThan(3);
    expect(contraste("#153B6F", "#c090eb")).toBeGreaterThan(3);
    expect(contraste("#153B6F", "#c898eb")).toBeGreaterThan(3);
  });

  it("o texto sobre o botão tem folga larga", () => {
    expect(contraste("#153B6F", "#ffffff")).toBeGreaterThan(7);
  });

  /*
    Num painel escuro o branco sozinho já resolve — a borda some no fundo e não
    faz falta.
  */
  it("num painel escuro o botão claro tem contraste de sobra", () => {
    expect(contraste("#ffffff", "#6c009e")).toBeGreaterThan(7);
  });

  it("o disco branco do G ganha anel para não sumir", () => {
    const gmark = shell.slice(
      shell.indexOf("#loginScreen .google-login-btn .gmark {"),
    );
    expect(gmark).toContain("box-shadow: inset 0 0 0 1px #dadce0");
  });

  /*
    Escopado ao `#loginScreen`: a regra vale para o botão principal e para o de
    trocar de conta, e não escapa para outras telas.
  */
  it("vale só na tela de acesso", () => {
    expect(regra).toContain("#loginScreen .google-login-btn");
    expect(shell).not.toMatch(/^\.google-login-btn\s*\{/m);
  });
});
