import { readFileSync } from "node:fs";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { montarCasca } from "../../src/app/casca/casca.tsx";
import { criarMoldura } from "../../src/app/moldura.ts";
import { montarBarraLateral } from "../../src/componentes/barra-lateral/barra-lateral.tsx";
import {
  atualizarMenuLateral,
  marcarItemAtivoNoMenu,
  redefinirBarraLateral,
} from "../../src/componentes/barra-lateral/estado.ts";
import { redefinirDadosDoMonitoramento } from "../../src/componentes/dados-do-monitoramento.ts";
import { montarArvoreDoMenu } from "../../src/lib/menu-lateral.ts";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/*
  No celular a navegação é uma só: o ☰ do cabeçalho abre a barra lateral como
  gaveta por cima do conteúdo (src/app/casca/gaveta-do-celular.tsx). Não há
  menu preso ao pé da tela. Escolher uma página, tocar fora e o Esc fecham; a
  gaveta fechada sai do Tab (`inert`) e, aberta, é o resto que sai.
*/

const LARGURA_ORIGINAL = window.innerWidth;
const MATCH_MEDIA_ORIGINAL = window.matchMedia;

let casca = null;
let barra = null;

async function largura(px) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: px,
  });
  await act(async () => window.dispatchEvent(new Event("resize")));
}

async function montar(px = 390) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: px,
  });
  document.body.className = "sidebar-collapsed";
  document.body.innerHTML = '<section id="appScreen" class="app"></section>';
  const moldura = criarMoldura({ armazenamento: () => null });
  window.toggleSidebar = moldura.alternarBarra;
  casca = montarCasca();
  await act(async () => {
    barra = montarBarraLateral();
  });
  await act(async () =>
    atualizarMenuLateral(
      montarArvoreDoMenu({
        permitidas: { dashboard: true, nucleo: true, calendario: true },
        areas: ["saude-indigena"],
      }),
      { navegar: (view) => marcarItemAtivoNoMenu(view) },
    ),
  );
  await act(async () => marcarItemAtivoNoMenu("nucleo"));
}

const aside = () => document.querySelector("#appScreen .sidebar");
const conteudo = () => document.getElementById("conteudoPrincipal");
const veu = () => document.getElementById("sidebarOverlay");
const botao = () => document.getElementById("globalSidebarToggle");
const aberta = () => !document.body.classList.contains("sidebar-collapsed");
const clicar = (elemento) => act(async () => elemento.click());

async function abrir() {
  await clicar(botao());
  expect(aberta()).toBe(true);
}

beforeEach(() => {
  window.matchMedia = (consulta) => ({
    matches:
      window.innerWidth <=
      Number(/max-width:\s*(\d+)px/.exec(consulta)?.[1] ?? 0),
  });
  localStorage.clear();
});

afterEach(async () => {
  await act(async () => barra?.unmount());
  await act(async () => casca?.desmontar());
  barra = null;
  casca = null;
  await act(async () => redefinirBarraLateral());
  await act(async () => redefinirDadosDoMonitoramento());
  delete window.toggleSidebar;
  window.matchMedia = MATCH_MEDIA_ORIGINAL;
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: LARGURA_ORIGINAL,
  });
  document.body.className = "";
  document.body.innerHTML = "";
});

describe("navegação no celular", () => {
  it("não há menu no pé da tela nem outro ☰: só o botão da gaveta no topo", async () => {
    await montar();
    expect(document.getElementById("mobileBottomNav")).toBeNull();
    expect(document.querySelector(".mobile-bottom-nav")).toBeNull();
    expect(document.getElementById("hambToggle")).toBeNull();
    expect(
      document.querySelectorAll("header.top .title-row button"),
    ).toHaveLength(1);
    expect(botao().closest("header.top .title-row")).not.toBeNull();
  });

  it("fechada, a gaveta sai do Tab e o véu some", async () => {
    await montar();
    expect(aberta()).toBe(false);
    expect(aside().hasAttribute("inert")).toBe(true);
    expect(conteudo().hasAttribute("inert")).toBe(false);
    expect(veu().hidden).toBe(true);
    expect(botao().getAttribute("aria-expanded")).toBe("false");
  });

  it("o ☰ abre a mesma barra lateral por cima; o foco vai para a página atual", async () => {
    await montar();
    await abrir();
    expect(aside().hasAttribute("inert")).toBe(false);
    expect(conteudo().hasAttribute("inert")).toBe(true);
    expect(veu().hidden).toBe(false);
    expect(veu().getAttribute("aria-label")).toBe("Fechar menu");
    expect(botao().getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(
      document.querySelector('#nav [aria-current="page"]'),
    );
    expect(document.activeElement.dataset.view).toBe("nucleo");
  });

  it("Esc fecha e o foco volta para o ☰", async () => {
    await montar();
    await abrir();
    await act(async () =>
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
    );
    expect(aberta()).toBe(false);
    expect(aside().hasAttribute("inert")).toBe(true);
    expect(conteudo().hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe(botao());
  });

  it("tocar fora (no véu) fecha", async () => {
    await montar();
    await abrir();
    await clicar(veu());
    expect(aberta()).toBe(false);
    expect(veu().hidden).toBe(true);
  });

  it("escolher uma página fecha; abrir uma área, não", async () => {
    await montar();
    await abrir();
    await clicar(
      document.querySelector(
        '.menu-area[data-area="saude-indigena"] .menu-area__cabecalho',
      ),
    );
    expect(aberta()).toBe(true);
    await clicar(document.querySelector('.menu-item[data-view="calendario"]'));
    expect(aberta()).toBe(false);
    expect(
      document.querySelector('#nav [aria-current="page"]').dataset.view,
    ).toBe("calendario");
  });

  it("Esc com a gaveta fechada não a abre", async () => {
    await montar();
    await act(async () =>
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
    );
    expect(aberta()).toBe(false);
  });

  it("no computador, a barra recolhida continua navegável e não há véu", async () => {
    await montar(1280);
    expect(aside().hasAttribute("inert")).toBe(false);
    expect(conteudo().hasAttribute("inert")).toBe(false);
    expect(veu().hidden).toBe(true);
    // Passou de celular para computador com a gaveta aberta: tudo navegável.
    await largura(390);
    document.body.classList.remove("sidebar-collapsed");
    await largura(1280);
    expect(aside().hasAttribute("inert")).toBe(false);
    expect(conteudo().hasAttribute("inert")).toBe(false);
  });
});

describe("o que saiu com o menu do pé da tela", () => {
  const ler = (caminho) => readFileSync(caminho, "utf8");

  it("nenhum módulo, estilo ou recuo do menu inferior sobra no código", () => {
    const main = ler("src/main.ts");
    expect(main).not.toContain("mobile-bottom-navigation");
    expect(main).not.toContain("mobile-app-experience");
    expect(main).not.toContain("mobile-table-cards.js");
    expect(ler("src/styles/tokens.css")).not.toContain(
      "--recuo-da-navegacao-inferior",
    );
    expect(ler("src/lib/aya-tours.ts")).not.toContain("mobileBottomNav");
  });
});
