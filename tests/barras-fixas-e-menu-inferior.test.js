import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  O menu inferior do celular (src/styles/mobile-bottom-navigation.css) fica
  preso ao pé da tela, por cima do conteúdo. Num teste real, a barra de salvar
  da regra (Avaliação documental) ficava por baixo dele e o toque em "Salvar"
  caía no item "Cronograma". Agora o espaço que o menu ocupa é um token
  (--recuo-da-navegacao-inferior, 0 sem o menu) e toda barra fixa ou presa
  ao pé o soma, em vez de um número solto por arquivo.

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

const TOKEN = "var(--recuo-da-navegacao-inferior";

describe("barras fixas acima do menu inferior do celular", () => {
  it("o token existe (0 sem o menu) e o menu o define quando aparece", () => {
    expect(ler("src/styles/tokens.css")).toMatch(
      /--recuo-da-navegacao-inferior:\s*0px;/,
    );
    const menu = ler("src/styles/mobile-bottom-navigation.css");
    const comMenu = bloco(
      menu,
      "body.mobile-app:has(> .mobile-bottom-nav:not(.hidden))",
    );
    expect(comMenu).toContain("--recuo-da-navegacao-inferior: calc(");
    expect(comMenu).toContain("var(--altura-da-navegacao-inferior)");
    expect(comMenu).toContain("var(--margem-da-navegacao-inferior)");
    // O fim da página também deixa o espaço do menu.
    expect(comMenu).toMatch(
      /padding-bottom:\s*calc\(var\(--recuo-da-navegacao-inferior\)/,
    );
    // O próprio menu usa as mesmas medidas.
    const nav = bloco(menu, "  .mobile-bottom-nav");
    expect(nav).toContain("bottom: var(--margem-da-navegacao-inferior)");
    expect(nav).toContain("min-height: var(--altura-da-navegacao-inferior)");
    expect(menu).not.toMatch(/\b(84|88)px\b/);
  });

  it("a barra de salvar e as outras barras do pé somam o recuo", () => {
    expect(bloco(ler("src/ui/ui.css"), ".ui-barra-de-salvar")).toContain(
      `bottom: ${TOKEN}`,
    );
    expect(
      bloco(
        ler("src/modulos/configuracoes/configuracoes.css"),
        ".config-barra",
      ),
    ).toContain(TOKEN);
    expect(
      bloco(ler("src/styles/connectivity-status.css"), ".connectivity-status"),
    ).toContain(TOKEN);
    expect(bloco(ler("src/modulos/chat/chat.css"), ".chat-avisos")).toContain(
      TOKEN,
    );
    expect(
      bloco(ler("src/modulos/aya/tour/tour.css"), ".aya-oferta--balao"),
    ).toContain(TOKEN);
    const aya = ler("src/modulos/aya/aya.css");
    const celular = aya.slice(aya.lastIndexOf("@media (max-width: 900px)"));
    expect(bloco(celular, "  .aya-arara")).toContain(TOKEN);
    expect(aya).not.toMatch(/bottom:[^;]*\b(76|92)px/);
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
