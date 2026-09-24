import { act } from "react";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { montarArvoreDoMenu } from "../../src/lib/menu-lateral.js";
import { SECOES } from "../../src/modules/config-secoes.js";
import { montarBarraLateral } from "../../src/componentes/barra-lateral/barra-lateral.jsx";
import {
  atualizarMenuLateral,
  marcarItemAtivoNoMenu,
  redefinirBarraLateral,
} from "../../src/componentes/barra-lateral/estado.js";
import {
  collectPrimaryItems,
  initMobileBottomNavigation,
  syncActiveItem,
} from "../../src/modules/mobile-bottom-navigation.js";
import { initMobileAppExperience } from "../../src/modules/mobile-app-experience.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const TUDO = {
  dashboard: true,
  nucleo: true,
  calendario: true,
  approved: true,
  config: true,
};

let raiz = null;

async function montarMenu(
  permitidas = TUDO,
  paineis = [{ codigo: "analises", titulo: "Análises" }],
) {
  document.body.className = "";
  document.body.innerHTML = `
    <section id="appScreen" class="app">
      <aside class="sidebar"></aside>
      <main class="main">
        <header class="top"><div class="title-row"></div></header>
      </main>
    </section>
    <section id="page-config" class="page"></section>`;
  await act(async () => {
    raiz = montarBarraLateral(document.querySelector("#appScreen .sidebar"));
  });
  await act(async () =>
    atualizarMenuLateral(
      montarArvoreDoMenu({
        permitidas,
        paineis,
        secoesDeConfiguracao: SECOES,
      }),
      { navegar: () => {} },
    ),
  );
}

let larguraOriginal;
beforeAll(() => {
  larguraOriginal = window.innerWidth;
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 390,
  });
});
afterAll(() => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: larguraOriginal,
  });
});
beforeEach(() => {
  document.getElementById("mobileBottomNav")?.remove();
  localStorage.clear();
});
afterEach(async () => {
  await act(async () => raiz?.unmount());
  raiz = null;
  await act(async () => redefinirBarraLateral());
});

/*
  O menu inferior do celular espelha as quatro primeiras páginas do menu
  lateral. Com as áreas, ele não pode copiar os cabeçalhos (que só abrem o
  acordeão) nem esconder as páginas de uma área fechada. A barra é React, mas
  o DOM dela continua sendo o contrato: `#nav [data-view]` e `aria-current`.
*/
describe("menu inferior do celular", () => {
  it("pega as quatro primeiras páginas, sem cabeçalhos de área", async () => {
    await montarMenu();
    expect(collectPrimaryItems().map((el) => el.dataset.view)).toEqual([
      "dashboard",
      "nucleo",
      "calendario",
      "approved",
    ]);
  });

  it("as sete seções de Configurações contam como uma página", async () => {
    await montarMenu({ config: true }, []);
    expect(collectPrimaryItems().map((el) => el.dataset.view)).toEqual([
      "config",
    ]);
  });

  it("monta com ícone Lucide e rótulo em texto, e o Mais por último", async () => {
    await montarMenu();
    initMobileBottomNavigation();

    const barra = document.getElementById("mobileBottomNav");
    const itens = [...barra.querySelectorAll(".mobile-bottom-nav__item")];
    expect(itens.map((botao) => botao.textContent)).toEqual([
      "Saúde indígena",
      "Editais",
      "Cronograma",
      "Lista de aprovados",
      "Mais",
    ]);
    expect(itens.every((botao) => botao.querySelector("svg.icone"))).toBe(true);
    expect(barra.querySelector("i")).toBeNull();
  });

  it("acompanha a página ativa e se remonta quando o menu é refeito", async () => {
    await montarMenu();
    initMobileBottomNavigation();

    await act(async () => marcarItemAtivoNoMenu("calendario"));
    const ativo = () =>
      document.querySelector("#mobileBottomNav .is-active")?.dataset.view;
    expect(ativo()).toBe("calendario");

    // buildNav troca a árvore; o menu inferior não pode guardar os nós antigos.
    await act(async () =>
      atualizarMenuLateral(
        montarArvoreDoMenu({ permitidas: { nucleo: true, approved: true } }),
        { navegar: () => {} },
      ),
    );
    await act(async () => marcarItemAtivoNoMenu("approved"));

    const barra = document.getElementById("mobileBottomNav");
    expect(
      [...barra.querySelectorAll("[data-view]")].map((b) => b.dataset.view),
    ).toEqual(["nucleo", "approved"]);
    expect(ativo()).toBe("approved");
  });

  it("syncActiveItem compara pela página, não pelo nó", async () => {
    await montarMenu();
    const barra = document.createElement("nav");
    barra.innerHTML =
      '<button class="mobile-bottom-nav__item" data-view="config"></button>';
    await act(async () => marcarItemAtivoNoMenu("config", "aparencia"));
    syncActiveItem(barra);
    expect(barra.firstElementChild.getAttribute("aria-current")).toBe("page");
  });
});

describe("gaveta do celular", () => {
  beforeAll(() => {
    initMobileAppExperience();
  });

  it("abrir uma área não fecha a gaveta; escolher uma página fecha", async () => {
    await montarMenu();
    document.body.classList.add("sidebar-open");

    await act(async () =>
      document
        .querySelector(
          '.menu-area[data-area="recrutamento"] .menu-area__cabecalho',
        )
        .click(),
    );
    expect(document.body.classList.contains("sidebar-open")).toBe(true);

    await act(async () =>
      document.querySelector('.menu-item[data-view="nucleo"]').click(),
    );
    expect(document.body.classList.contains("sidebar-open")).toBe(false);
    expect(document.body.classList.contains("sidebar-collapsed")).toBe(true);
  });
});
