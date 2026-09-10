import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import {
  initColapsarNoPainelExterno,
  moverColapsarParaSidebar,
} from "../src/modules/colapsar-no-painel-externo.js";

const css = readFileSync("src/styles/platform-shell.css", "utf8");
const main = readFileSync("src/main.js", "utf8");

/*
  Os comentários deste CSS explicam o defeito citando `padding`, `!important` e
  `#conteudoPrincipal`. Verificar o texto cru acusaria a própria explicação; o
  que vale são as declarações.
*/
const regras = css.replace(/\/\*[\s\S]*?\*\//g, "");

/*
  Recorta a regra que declara o seletor pedido. Procurar a primeira ocorrência do
  texto não serve: `body.external-panel-mode .main` aparece antes, na regra que
  esconde o cabeçalho.
*/
const bloco = (seletor, declaracao) =>
  regras
    .split("}")
    .map((parte) => parte + "}")
    .find(
      (r) => r.includes(seletor) && (!declaracao || r.includes(declaracao)),
    ) || "";

/*
  Duas barras de rolagem no painel externo.

  Medido no preview em 10/09/2026, com o painel de Análises embarcado:

    1440x900   scrollHeight 934 contra clientHeight 900   -> 34px a mais
     800x900   scrollHeight 948 contra clientHeight 900   -> 48px a mais

  O quadro é travado em `min-height: 100dvh` — uma tela inteira — e cada caixa da
  cadeia soma o seu espaçamento por cima. Não era um espaçamento, eram três:
  `.table-card` 14, `.content` 34, `.main` 20.
*/
describe("o painel externo não pode ter duas barras de rolagem", () => {
  it("zera a cadeia inteira, não só uma caixa", () => {
    const alvo = bloco("body.external-panel-mode .main", "padding");
    for (const parte of [
      "body.external-panel-mode .main",
      "body.external-panel-mode #conteudoPrincipal",
      "body.external-panel-mode #page-external .table-card",
    ]) {
      expect(alvo, `${parte} ficou fora da regra`).toContain(parte);
    }
    expect(alvo).toContain("padding: 0 !important");
    expect(
      bloco("body.external-panel-mode .content", "padding-bottom"),
    ).toContain("padding-bottom: 0 !important");
  });

  /*
    Sem `!important` a correção valia só no largo: `mobile-app.css` declara os
    mesmos espaçamentos com `!important`, que vence especificidade. E sem o id a
    regra concorrente ainda ganhava no `.main`, porque alcança o elemento por
    `#conteudoPrincipal` — um id vence qualquer número de classes.
  */
  it("alcança as declarações concorrentes, que são !important e por id", () => {
    const alvo = bloco("body.external-panel-mode .main", "padding");
    expect(alvo).toContain("#conteudoPrincipal");
    expect(alvo).toMatch(/!important/);
  });

  it("trava o transbordo para o caso de alguém acrescentar espaçamento amanhã", () => {
    expect(bloco("body.external-panel-mode .app")).toContain(
      "overflow: hidden",
    );
  });

  /*
    O escopo é o que garante que nada mudou fora do painel externo: toda regra
    nova nasce de `body.external-panel-mode`.
  */
  it("nenhuma regra nova escapa do modo painel externo", () => {
    const novas = [
      "body.external-panel-mode .main",
      "body.external-panel-mode .content",
      "body.external-panel-mode .app",
      "body.external-panel-mode .sidebar .global-side-toggle",
    ];
    for (const seletor of novas) {
      expect(regras, `${seletor} ausente`).toContain(seletor);
    }
  });
});

/*
  O botão de recolher, no painel externo.

  Há dois controles para a mesma ação e, no painel externo, medi os dois fora de
  alcance a 1440x900: `header.top` com `display:none` levava `#hambToggle` junto,
  e `#globalSidebarToggle` já era `display:none` por `system-ui-fixes.css`. Não
  sobrava nenhum.
*/
describe("o botão de recolher vai para a barra lateral", () => {
  const montar = () => {
    document.body.innerHTML = `
      <section id="appScreen" class="app">
        <button id="globalSidebarToggle" class="global-side-toggle" onclick="toggleSidebar()" title="Expandir menu lateral">
          <i class="fa-solid fa-bars"></i>
        </button>
        <aside class="sidebar">
          <div class="side-brand"><img id="sideLogo" /></div>
          <div class="side-navigation"><nav id="nav" class="nav"></nav></div>
        </aside>
        <main class="main" id="conteudoPrincipal">
          <header class="top"><button id="hambToggle" class="hamb">☰</button></header>
        </main>
      </section>`;
  };

  beforeEach(montar);

  it("move para dentro da barra, logo depois da marca", () => {
    expect(moverColapsarParaSidebar(document)).toBe(true);
    const botao = document.getElementById("globalSidebarToggle");
    expect(botao.closest(".sidebar")).not.toBeNull();
    expect(botao.previousElementSibling.className).toBe("side-brand");
  });

  /*
    Mover, e não recriar. O `id` é como `syncSidebarToggle()` e os rótulos
    encontram o botão, e o `onclick` é o que de facto recolhe a barra.
  */
  it("é o mesmo nó, com o onclick do markup intacto", () => {
    const antes = document.getElementById("globalSidebarToggle");

    moverColapsarParaSidebar(document);

    const movido = document.getElementById("globalSidebarToggle");
    // Reparentar não recria: é o mesmo objeto, então atributos e ouvintes vão
    // junto por construção. É isso que mantém `toggleSidebar()` ligado e o que
    // `syncSidebarToggle()` escreve no rótulo.
    expect(movido).toBe(antes);
    expect(movido.getAttribute("onclick")).toBe("toggleSidebar()");
    expect(movido.title).toBe("Expandir menu lateral");
    expect(movido.querySelector("i")).not.toBeNull();
  });

  it("não move duas vezes", () => {
    expect(moverColapsarParaSidebar(document)).toBe(true);
    expect(moverColapsarParaSidebar(document)).toBe(false);
    expect(document.querySelectorAll("#globalSidebarToggle")).toHaveLength(1);
  });

  it("sem barra lateral, não faz nada", () => {
    document.querySelector(".sidebar").remove();
    expect(moverColapsarParaSidebar(document)).toBe(false);
    expect(document.getElementById("globalSidebarToggle")).not.toBeNull();
  });

  it("sem o botão, não estoura", () => {
    document.getElementById("globalSidebarToggle").remove();
    expect(() => moverColapsarParaSidebar(document)).not.toThrow();
    expect(moverColapsarParaSidebar(document)).toBe(false);
  });

  it("o arranque usa o documento da página", () => {
    expect(initColapsarNoPainelExterno()).toBe(true);
    expect(
      document.getElementById("globalSidebarToggle").closest(".sidebar"),
    ).not.toBeNull();
  });

  /*
    O hambúrguer fica onde está. Ele é o controle do desktop fora do painel
    externo, e movê-lo mudaria uma tela que não está em causa.
  */
  it("não mexe no hambúrguer do cabeçalho", () => {
    moverColapsarParaSidebar(document);
    const hamb = document.getElementById("hambToggle");
    expect(hamb.closest("header.top")).not.toBeNull();
  });
});

describe("ligação no arranque", () => {
  it("main.js chama o módulo", () => {
    expect(main).toContain(
      'import { initColapsarNoPainelExterno } from "./modules/colapsar-no-painel-externo.js"',
    );
    expect(main).toContain("initColapsarNoPainelExterno();");
  });
});
