import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  O celular não tem mais menu preso ao pé da tela (o menu é a gaveta do ☰).
  Antes, o espaço dele era um recuo (--recuo-da-navegacao-inferior) que toda
  barra fixa ou presa ao pé somava, e o corpo da página reservava a altura
  dele no fim. Agora o conteúdo usa a altura toda: as barras do pé encostam
  no pé (ou na área segura do aparelho) e nada reserva espaço para o menu.

  E o link de pular: escondido por um "top" fixo, a segunda linha dele
  ("…principal") aparecia por cima do cabeçalho quando o texto quebrava.
*/
const ler = (caminho) =>
  readFileSync(caminho, "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");
const bloco = (css, seletor) => {
  const i = css.indexOf(`${seletor} {`);
  expect(i, seletor).toBeGreaterThan(-1);
  return css.slice(i, css.indexOf("}", i));
};

describe("barras do pé no celular, sem menu inferior", () => {
  it("o menu inferior e o recuo dele saíram", () => {
    expect(existsSync("src/styles/mobile-bottom-navigation.css")).toBe(false);
    expect(existsSync("src/modules/mobile-bottom-navigation.js")).toBe(false);
    expect(ler("src/styles/tokens.css")).not.toContain(
      "--recuo-da-navegacao-inferior",
    );
    expect(ler("src/styles/mobile-app.css")).not.toContain(".mobile-app");
  });

  it("a barra de salvar e as outras barras do pé encostam no pé", () => {
    expect(bloco(ler("src/ui/ui.css"), ".ui-barra-de-salvar")).toContain(
      "bottom: 0;",
    );
    expect(
      bloco(
        ler("src/modulos/configuracoes/configuracoes.css"),
        ".config-barra",
      ),
    ).toContain("bottom: var(--space-4);");
    expect(
      bloco(ler("src/styles/connectivity-status.css"), ".connectivity-status"),
    ).toContain("env(safe-area-inset-bottom");
    expect(
      bloco(ler("src/modulos/aya/tour/tour.css"), ".aya-oferta--balao"),
    ).toContain("bottom: calc(clamp(16px, 2vw, 24px) + 92px);");
    const aya = ler("src/modulos/aya/aya.css");
    const celular = aya.slice(aya.lastIndexOf("@media (max-width: 900px)"));
    expect(bloco(celular, "  .aya-arara")).toContain(
      "env(safe-area-inset-bottom",
    );
  });

  it("nenhum CSS reserva espaço no fim da página para um menu inferior", () => {
    for (const arquivo of [
      "src/styles/app.css",
      "src/styles/mobile-app.css",
      "src/styles/platform-shell.css",
    ]) {
      const css = ler(arquivo);
      expect(css, arquivo).not.toMatch(/navegacao-inferior|bottom-nav/);
    }
  });
});

describe("link de pular", () => {
  it("fica fora da tela pela própria altura, não por um top fixo", () => {
    const app = ler("src/styles/app.css");
    const link = bloco(app, ".skip-link");
    expect(link).not.toMatch(/top:\s*-/);
    expect(link).toContain("transform: translateY(-100%)");
    expect(link).toContain("max-width: calc(100vw - 16px)");
    expect(bloco(app, ".skip-link:focus")).toContain("transform: none");
  });
});
