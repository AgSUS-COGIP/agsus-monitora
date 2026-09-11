import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import {
  DESTINO_BARRA,
  DESTINO_CABECALHO,
  destinoDoColapsar,
  initColapsarDaSidebar,
  posicionarColapsarDaSidebar,
} from "../src/modules/colapsar-a-sidebar.js";

const main = readFileSync("src/main.js", "utf8");
const css = readFileSync("src/styles/colapsar-a-sidebar.css", "utf8");
const platformShell = readFileSync("src/styles/platform-shell.css", "utf8");

/*
  Os comentários destes ficheiros citam os seletores concorrentes para explicar
  por que o id é necessário. Verificar o texto cru acusaria a própria
  explicação; o que vale são as declarações.
*/
const semComentarios = (fonte) =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const regras = semComentarios(css);

/*
  Um dono só para recolher a barra lateral.

  Havia dois controles: `#hambToggle` no cabeçalho e `#globalSidebarToggle`
  flutuante, cada um visível numa faixa de largura. Dentro de um painel externo
  o cabeçalho some e levava o hambúrguer junto — não sobrava nenhum, que foi o
  defeito do #176.

  Onde o botão fica depende da largura, e isso é física de layout, não estética.
  Medido no preview em 11/09/2026, a 390x844: a barra lateral é `position: fixed`
  com `transform: translateX(-105%)`. Um `transform` torna o elemento o bloco de
  contenção dos descendentes fixos, então um botão dentro da barra sai da tela
  junto com ela — inalcançável justamente com a gaveta fechada.
*/
describe("onde o botão fica depende da largura", () => {
  it("acima de 900 vai para a barra; até 900 vai para o cabeçalho", () => {
    expect(destinoDoColapsar(1440)).toBe(DESTINO_BARRA);
    expect(destinoDoColapsar(901)).toBe(DESTINO_BARRA);
    expect(destinoDoColapsar(900)).toBe(DESTINO_CABECALHO);
    expect(destinoDoColapsar(390)).toBe(DESTINO_CABECALHO);
  });
});

describe("o botão único, em todos os modos", () => {
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
          <header class="top"><div class="title-row"><button id="hambToggle" class="hamb">☰</button><div class="page-title"></div></div></header>
        </main>
      </section>`;
  };

  beforeEach(montar);

  it("no desktop entra na barra, logo depois da marca", () => {
    expect(posicionarColapsarDaSidebar(document, 1440)).toBe(DESTINO_BARRA);
    const botao = document.getElementById("globalSidebarToggle");
    expect(botao.closest(".sidebar")).not.toBeNull();
    expect(botao.previousElementSibling.className).toBe("side-brand");
  });

  /*
    O caso que a medição obrigou a separar: dentro da barra, no estreito, o
    botão iria para fora da tela junto com a gaveta.
  */
  it("no estreito vai para a vaga do hambúrguer, no cabeçalho", () => {
    expect(posicionarColapsarDaSidebar(document, 390)).toBe(DESTINO_CABECALHO);
    const botao = document.getElementById("globalSidebarToggle");
    expect(botao.closest(".sidebar")).toBeNull();
    expect(botao.parentElement.className).toBe("title-row");
  });

  it("atravessa as duas larguras sem recriar o nó", () => {
    const antes = document.getElementById("globalSidebarToggle");

    posicionarColapsarDaSidebar(document, 1440);
    posicionarColapsarDaSidebar(document, 390);
    posicionarColapsarDaSidebar(document, 1440);

    const depois = document.getElementById("globalSidebarToggle");
    expect(depois).toBe(antes);
    expect(depois.getAttribute("onclick")).toBe("toggleSidebar()");
    expect(depois.title).toBe("Expandir menu lateral");
    expect(depois.querySelector("i")).not.toBeNull();
    expect(document.querySelectorAll("#globalSidebarToggle")).toHaveLength(1);
  });

  it("chamar duas vezes na mesma largura não muda nada", () => {
    expect(posicionarColapsarDaSidebar(document, 1440)).toBe(DESTINO_BARRA);
    expect(posicionarColapsarDaSidebar(document, 1440)).toBe(DESTINO_BARRA);
    expect(document.querySelectorAll("#globalSidebarToggle")).toHaveLength(1);
  });

  it("sem botão ou sem destino, devolve null sem estourar", () => {
    document.getElementById("globalSidebarToggle").remove();
    expect(posicionarColapsarDaSidebar(document, 1440)).toBeNull();

    montar();
    document.querySelector(".sidebar").remove();
    expect(posicionarColapsarDaSidebar(document, 1440)).toBeNull();

    montar();
    document.querySelector(".title-row").remove();
    expect(posicionarColapsarDaSidebar(document, 390)).toBeNull();
    expect(document.getElementById("globalSidebarToggle")).not.toBeNull();
  });

  /*
    O hambúrguer deixa de ser controle, mas o markup fica: `updateConfig`
    escreve título e rótulo nele pelo id.
  */
  it("o hambúrguer nunca é movido", () => {
    posicionarColapsarDaSidebar(document, 1440);
    posicionarColapsarDaSidebar(document, 390);
    expect(
      document.getElementById("hambToggle").closest("header.top"),
    ).not.toBeNull();
  });

  it("o arranque posiciona e devolve onde ficou", () => {
    expect([DESTINO_BARRA, DESTINO_CABECALHO]).toContain(
      initColapsarDaSidebar(),
    );
    expect(document.getElementById("globalSidebarToggle")).not.toBeNull();
  });
});

describe("a duplicidade visual acabou", () => {
  it("o hambúrguer sai de cena em toda parte", () => {
    expect(regras).toMatch(/#hambToggle\s*\{\s*display:\s*none\s*!important/);
  });

  /*
    As regras concorrentes usam `!important` em três ficheiros diferentes. Entre
    declarações `!important` quem decide é a especificidade, e por isso os
    seletores daqui partem de `#appScreen`.
  */
  it("o botão único aparece em toda largura e todo modo", () => {
    expect(regras).toMatch(
      /#appScreen \.global-side-toggle\s*\{\s*display:\s*grid\s*!important/,
    );
    expect(regras).toContain("#appScreen .sidebar > .global-side-toggle");
    expect(regras).toContain("#appScreen .title-row > .global-side-toggle");
  });

  /*
    Nos dois lugares o botão entra no fluxo. Flutuar seria pior no estreito:
    medido, `.top` tem `z-index: 10030` e as ações dele ocupam o canto superior
    esquerdo, então um botão fixo ali nasce coberto.
  */
  it("é estático nos dois lugares: entra no fluxo, não flutua", () => {
    const bloco = (seletor) => {
      const i = regras.indexOf(seletor);
      return i < 0 ? "" : regras.slice(i, regras.indexOf("}", i));
    };
    expect(bloco("#appScreen .sidebar > .global-side-toggle")).toContain(
      "position: static",
    );
    expect(bloco("#appScreen .title-row > .global-side-toggle")).toContain(
      "position: static",
    );
    expect(regras).not.toContain("position: fixed");
  });

  /*
    A regra do #176 valia só em `external-panel-mode` e acima de 901px. O
    ficheiro novo cobre todos os modos, então ela deixa de existir — duas fontes
    para a mesma decisão seria o defeito que este PR remove.
  */
  it("a regra parcial do #176 não sobrevive em platform-shell.css", () => {
    expect(semComentarios(platformShell)).not.toContain(
      "body.external-panel-mode .sidebar .global-side-toggle",
    );
  });
});

describe("ligação no arranque", () => {
  it("main.js importa e chama o módulo com o nome novo", () => {
    expect(main).toContain(
      'import { initColapsarDaSidebar } from "./modules/colapsar-a-sidebar.js"',
    );
    expect(main).toContain("initColapsarDaSidebar();");
    expect(main).toContain('import "./styles/colapsar-a-sidebar.css"');
  });

  it("o nome antigo não ficou para trás", () => {
    expect(main).not.toContain("colapsar-no-painel-externo");
    expect(main).not.toContain("initColapsarNoPainelExterno");
  });
});
