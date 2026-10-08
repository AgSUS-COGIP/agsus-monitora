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
import { montarArvoreDoMenu } from "../../src/lib/menu-lateral.ts";
import { SECOES } from "../../src/modulos/configuracoes/secoes.js";
import { montarBarraLateral } from "../../src/componentes/barra-lateral/barra-lateral.tsx";
import {
  atualizarMenuLateral,
  marcarItemAtivoNoMenu,
  redefinirBarraLateral,
} from "../../src/componentes/barra-lateral/estado.ts";
import {
  collectPrimaryItems,
  initMobileBottomNavigation,
  syncActiveItem,
} from "../../src/modules/mobile-bottom-navigation.js";
import { initMobileAppExperience } from "../../src/modules/mobile-app-experience.js";
import {
  definirAreaAtual,
  obterDadosDoMonitoramento,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.ts";

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
  paineis = [{ codigo: "recursos", titulo: "Recursos" }],
  areas = ["saude-indigena"],
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
        areas,
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
  sessionStorage.clear();
});
afterEach(async () => {
  await act(async () => raiz?.unmount());
  raiz = null;
  await act(async () => redefinirBarraLateral());
  await act(async () => redefinirDadosDoMonitoramento());
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
      "Visão geral",
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

  /*
    Com várias áreas, o menu lateral só desenha a área atual (seletor de área):
    o de baixo mostra as páginas dela, sem as das outras áreas, e acompanha a
    troca de área.
  */
  it("com várias áreas, mostra as páginas da área atual, sem repetir", async () => {
    await montarMenu(TUDO, [], ["saude-indigena", "sede", "projetos"]);
    await act(async () => definirAreaAtual("sede"));

    const origens = collectPrimaryItems();
    const views = origens.map((el) => el.dataset.view);
    expect(new Set(views).size).toBe(views.length);
    expect(views.slice(0, 3)).toEqual(["dashboard", "nucleo", "calendario"]);
    // Só a SEDE; o que vem sem área é a Administração.
    for (const el of origens) {
      expect([undefined, "sede"]).toContain(el.dataset.area);
    }
    expect(origens[0].dataset.area).toBe("sede");

    await act(async () => definirAreaAtual("projetos"));
    const deProjetos = collectPrimaryItems();
    expect(deProjetos[0].dataset.area).toBe("projetos");
    for (const el of deProjetos) {
      expect([undefined, "projetos"]).toContain(el.dataset.area);
    }
  });

  it("escolher pelo menu de baixo troca a área e remonta com as páginas dela", async () => {
    const navegacoes = [];
    await montarMenu(TUDO, [], ["saude-indigena", "sede"]);
    await act(async () =>
      atualizarMenuLateral(
        montarArvoreDoMenu({
          permitidas: TUDO,
          secoesDeConfiguracao: SECOES,
          areas: ["saude-indigena", "sede"],
        }),
        {
          navegar: (view) => {
            navegacoes.push([view, obterDadosDoMonitoramento().areaAtual]);
            marcarItemAtivoNoMenu(view);
          },
        },
      ),
    );
    await act(async () => marcarItemAtivoNoMenu("nucleo"));
    initMobileBottomNavigation();
    const areasDaBarra = () =>
      [...document.querySelectorAll("#mobileBottomNav [data-source-id]")]
        .map(
          (botao) =>
            document.getElementById(botao.dataset.sourceId).dataset.area,
        )
        .filter(Boolean);
    expect(new Set(areasDaBarra())).toEqual(new Set(["saude-indigena"]));

    // A troca de área vem do seletor do menu lateral; o de baixo acompanha.
    await act(async () =>
      document.querySelector('[data-opcao-de-area="sede"]').click(),
    );
    expect(new Set(areasDaBarra())).toEqual(new Set(["sede"]));

    const botaoDoCronograma = document.querySelector(
      '#mobileBottomNav [data-view="calendario"]',
    );
    await act(async () => botaoDoCronograma.click());
    expect(navegacoes).toEqual([
      ["nucleo", "sede"],
      ["calendario", "sede"],
    ]);
    expect(
      document.querySelector("#mobileBottomNav .is-active")?.dataset.view,
    ).toBe("calendario");
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
          '.menu-area[data-area="saude-indigena"] .menu-area__cabecalho',
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
