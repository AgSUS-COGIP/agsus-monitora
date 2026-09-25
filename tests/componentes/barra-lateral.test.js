import { readFileSync } from "node:fs";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { montarArvoreDoMenu } from "../../src/lib/menu-lateral.js";
import {
  avisar,
  EVENTO_BARRA_ALTERNADA,
  EVENTO_MENU_ATUALIZADO,
  EVENTO_TEMA_ALTERADO,
} from "../../src/lib/eventos-da-barra-lateral.js";
import { SECOES } from "../../src/modules/config-secoes.js";
import { performExplicitLogout } from "../../src/modules/nielsen-shell-ux.js";
import { montarBarraLateral } from "../../src/componentes/barra-lateral/barra-lateral.jsx";
import {
  atualizarMenuLateral,
  marcarItemAtivoNoMenu,
  redefinirBarraLateral,
} from "../../src/componentes/barra-lateral/estado.js";
import {
  definirAreaAtual,
  obterDadosDoMonitoramento,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.js";

vi.mock("../../src/modules/nielsen-shell-ux.js", async (original) => ({
  ...(await original()),
  performExplicitLogout: vi.fn(),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const CHAVE_FECHADAS = "agsus_monitora_menu_areas_fechadas_v1";
const LARGURA_ORIGINAL = window.innerWidth;

function arvoreCompleta(
  paineis = [{ codigo: "analises", titulo: "Análises" }],
) {
  return montarArvoreDoMenu({
    permitidas: {
      dashboard: true,
      nucleo: true,
      calendario: true,
      approved: true,
      config: true,
    },
    paineis,
    secoesDeConfiguracao: SECOES,
  });
}

let raiz = null;

function prepararPagina() {
  document.body.className = "";
  document.documentElement.setAttribute("data-theme", "");
  document.body.innerHTML = `
    <section id="appScreen" class="app">
      <aside class="sidebar" aria-label="Navegação principal"></aside>
      <main class="main">
        <header class="top">
          <div class="title-row">
            <button id="hambToggle" class="hamb">☰</button>
            <div class="page-title"><h1 id="pageTitle">Editais</h1></div>
          </div>
        </header>
      </main>
    </section>
    <section id="page-dashboard" class="page active"></section>
    <section id="page-config" class="page"></section>`;
}

async function montar(arvore = arvoreCompleta(), opcoes = {}) {
  prepararPagina();
  await act(async () => {
    raiz = montarBarraLateral(document.querySelector("#appScreen .sidebar"));
  });
  if (arvore) {
    await act(async () => atualizarMenuLateral(arvore, opcoes));
  }
}

async function larguraDaJanela(valor) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: valor,
  });
  await act(async () => window.dispatchEvent(new Event("resize")));
}

async function recolher(sim = true) {
  document.body.classList.toggle("sidebar-collapsed", sim);
  await act(async () => avisar(EVENTO_BARRA_ALTERNADA));
}

const clicar = (elemento) => act(async () => elemento.click());
const area = (id) => document.querySelector(`.menu-area[data-area="${id}"]`);
const cabecalho = (id) => area(id).querySelector(".menu-area__cabecalho");
const item = (view, secao) =>
  [...document.querySelectorAll("#nav .menu-item")].find(
    (botao) =>
      botao.dataset.view === view && (!secao || botao.dataset.secao === secao),
  );
const aberta = (id) => area(id).classList.contains("menu-area--aberta");
const flutuando = (id) => area(id).classList.contains("menu-area--flutuante");

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(async () => {
  await act(async () => raiz?.unmount());
  raiz = null;
  await act(async () => redefinirBarraLateral());
  await act(async () => redefinirDadosDoMonitoramento());
  await larguraDaJanela(LARGURA_ORIGINAL);
  delete window.navigate;
  delete window.toggleSidebar;
  delete window.toggleDarkMode;
  vi.clearAllMocks();
});

describe("a barra lateral em React", () => {
  it("monta marca, menu e rodapé dentro do <aside>", async () => {
    await montar();
    const aside = document.querySelector("#appScreen .sidebar");

    expect(
      aside.querySelector(".side-brand #sideLogo").getAttribute("src"),
    ).toBe("/assets/agsus-logo.webp");
    expect(
      aside.querySelector(".side-navigation > nav#nav.menu-lateral"),
    ).not.toBeNull();
    expect(aside.querySelectorAll(".side-tema__opcao")).toHaveLength(2);
    expect(aside.querySelector("#sidebarLogoutBtn.side-logout")).not.toBeNull();
    expect(aside.querySelector(".side-version #sidebarVersion")).not.toBeNull();
    expect(
      [...aside.querySelectorAll(".menu-area__rotulo")].map(
        (r) => r.textContent,
      ),
    ).toEqual(["Saúde Indígena", "Administração"]);
  });

  it("antes do primeiro buildNav não mostra aviso; perfil sem área mostra", async () => {
    await montar(null);
    expect(document.querySelector("#nav .alert")).toBeNull();

    await act(async () =>
      atualizarMenuLateral([], { textoVazio: "Peça acesso ao administrador." }),
    );
    expect(document.querySelector("#nav .alert.warn")?.textContent).toBe(
      "Peça acesso ao administrador.",
    );
  });

  it("título de painel vindo do banco entra como texto, nunca como HTML", async () => {
    await montar(
      arvoreCompleta([
        { codigo: "x", titulo: '<img src=x onerror="alert(1)">' },
      ]),
    );
    expect(item("panel:x").textContent).toBe('<img src=x onerror="alert(1)">');
    expect(document.querySelectorAll("#nav img")).toHaveLength(0);
  });
});

/*
  As áreas nascem abertas. Guarda-se só o que a pessoa fechou — então uma
  área nova no catálogo já aparece aberta.
*/
describe("áreas abertas por padrão", () => {
  it("sem preferência salva, toda área com submenu está aberta", async () => {
    await montar();
    expect(aberta("saude-indigena")).toBe(true);
    expect(aberta("administracao")).toBe(true);
    expect(cabecalho("saude-indigena").getAttribute("aria-expanded")).toBe(
      "true",
    );
  });

  it("fechar grava só as fechadas, e a próxima montagem lembra", async () => {
    await montar();
    await clicar(cabecalho("saude-indigena"));

    expect(aberta("saude-indigena")).toBe(false);
    expect(cabecalho("saude-indigena").getAttribute("aria-expanded")).toBe(
      "false",
    );
    expect(JSON.parse(localStorage.getItem(CHAVE_FECHADAS))).toEqual([
      "saude-indigena",
    ]);

    await act(async () => raiz.unmount());
    await montar();
    expect(aberta("saude-indigena")).toBe(false);
    expect(aberta("administracao")).toBe(true);
  });

  it("área que ninguém fechou nasce aberta, mesmo com outras fechadas", async () => {
    localStorage.setItem(CHAVE_FECHADAS, JSON.stringify(["administracao"]));
    await montar();
    expect(aberta("saude-indigena")).toBe(true);
    expect(aberta("administracao")).toBe(false);
  });

  it("Saúde Indígena é submenu: Visão geral, as páginas de edital e Análises", async () => {
    await montar();
    const cabecalhoDaArea = cabecalho("saude-indigena");
    expect(cabecalhoDaArea.hasAttribute("data-view")).toBe(false);
    expect(cabecalhoDaArea.getAttribute("aria-expanded")).toBe("true");
    expect(
      [...area("saude-indigena").querySelectorAll(".menu-item")].map(
        (botao) => [botao.dataset.rotulo, botao.dataset.area],
      ),
    ).toEqual([
      ["Visão geral", "saude-indigena"],
      ["Editais", "saude-indigena"],
      ["Cronograma", "saude-indigena"],
      ["Lista de aprovados", "saude-indigena"],
      ["Análises", "saude-indigena"],
    ]);
  });
});

describe("página ativa", () => {
  it("marca o item, destaca a área e avisa quem espelha o menu", async () => {
    await montar();
    let aviso = null;
    document.addEventListener(
      EVENTO_MENU_ATUALIZADO,
      (evento) => (aviso = evento.detail),
    );

    await act(async () => marcarItemAtivoNoMenu("calendario"));

    expect(item("calendario").getAttribute("aria-current")).toBe("page");
    expect(item("calendario").classList.contains("active")).toBe(true);
    expect(area("saude-indigena").classList.contains("menu-area--atual")).toBe(
      true,
    );
    expect(
      document.querySelectorAll('#nav [aria-current="page"]'),
    ).toHaveLength(1);
    expect(aviso).toEqual({
      view: "calendario",
      secao: null,
      area: "saude-indigena",
    });
  });

  it("abrir uma página reabre a área dela, se estava fechada", async () => {
    localStorage.setItem(CHAVE_FECHADAS, JSON.stringify(["saude-indigena"]));
    await montar();
    expect(aberta("saude-indigena")).toBe(false);

    await act(async () => marcarItemAtivoNoMenu("nucleo"));
    expect(aberta("saude-indigena")).toBe(true);
    expect(JSON.parse(localStorage.getItem(CHAVE_FECHADAS))).toEqual([]);
  });

  it("em Configurações marca a seção aberta", async () => {
    await montar();
    await act(async () => marcarItemAtivoNoMenu("config", "aparencia"));
    expect(item("config", "aparencia").getAttribute("aria-current")).toBe(
      "page",
    );
  });
});

/*
  Um grupo por área do usuário, com as mesmas páginas. O item escolhido torna
  a área dele a atual, e só o item da área atual acende.
*/
describe("as áreas do usuário", () => {
  const TODAS = ["saude-indigena", "sede", "projetos"];
  const itemDaArea = (id, view) =>
    area(id).querySelector(`.menu-item[data-view="${view}"]`);

  it("o admin vê as três áreas; SEDE e Projetos sem Visão geral nem Análises", async () => {
    await montar(
      montarArvoreDoMenu({
        permitidas: {
          dashboard: true,
          nucleo: true,
          calendario: true,
          approved: true,
        },
        paineis: [{ codigo: "analises", titulo: "Monitora Análises" }],
        areas: TODAS,
      }),
    );
    expect(
      [...document.querySelectorAll(".menu-area__rotulo")].map(
        (r) => r.textContent,
      ),
    ).toEqual(["Saúde Indígena", "SEDE", "Projetos"]);
    for (const id of ["sede", "projetos"]) {
      expect(
        [...area(id).querySelectorAll(".menu-item")].map(
          (botao) => botao.dataset.view,
        ),
      ).toEqual(["nucleo", "calendario", "approved"]);
    }
  });

  it("escolher Editais da SEDE torna a SEDE a área atual e só ele acende", async () => {
    const chamadas = [];
    await montar(
      montarArvoreDoMenu({
        permitidas: { nucleo: true, calendario: true },
        areas: TODAS,
      }),
      {
        navegar: (view) => {
          // A área já mudou quando a navegação acontece.
          chamadas.push([view, obterDadosDoMonitoramento().areaAtual]);
          marcarItemAtivoNoMenu(view);
        },
      },
    );

    await clicar(itemDaArea("sede", "nucleo"));

    expect(chamadas).toEqual([["nucleo", "sede"]]);
    expect(itemDaArea("sede", "nucleo").getAttribute("aria-current")).toBe(
      "page",
    );
    expect(
      itemDaArea("saude-indigena", "nucleo").hasAttribute("aria-current"),
    ).toBe(false);
    expect(area("sede").classList.contains("menu-area--atual")).toBe(true);
    expect(area("saude-indigena").classList.contains("menu-area--atual")).toBe(
      false,
    );

    await act(async () => definirAreaAtual("projetos"));
    expect(itemDaArea("projetos", "nucleo").getAttribute("aria-current")).toBe(
      "page",
    );
    expect(
      document.querySelectorAll('#nav [aria-current="page"]'),
    ).toHaveLength(1);
  });
});

describe("escolher uma página", () => {
  it("chama a navegação com a view do item", async () => {
    const chamadas = [];
    await montar(arvoreCompleta(), { navegar: (view) => chamadas.push(view) });

    await clicar(item("nucleo"));
    await clicar(item("dashboard"));
    await clicar(item("panel:analises"));

    expect(chamadas).toEqual(["nucleo", "dashboard", "panel:analises"]);
  });

  it("sem opção, usa window.navigate na hora do clique (os embrulhos valem)", async () => {
    await montar();
    window.navigate = vi.fn();
    await clicar(item("approved"));
    expect(window.navigate).toHaveBeenCalledWith("approved");
  });

  it("seção de Configurações: navega uma vez e abre a seção", async () => {
    const pagina = () => document.getElementById("page-config");
    const navegacoes = [];
    const secoes = [];
    await montar(arvoreCompleta(), {
      navegar: (view) => {
        navegacoes.push(view);
        pagina().classList.add("active");
      },
      aoAbrirSecao: (_view, secao) => secoes.push(secao),
    });

    await clicar(item("config", "acesso"));
    await clicar(item("config", "acessos"));

    expect(navegacoes).toEqual(["config"]);
    expect(secoes).toEqual(["acesso", "acessos"]);
    expect(item("config", "acessos").getAttribute("aria-current")).toBe("page");
  });

  it("se a navegação foi barrada, a seção não abre", async () => {
    const secoes = [];
    await montar(arvoreCompleta(), {
      navegar: () => {},
      aoAbrirSecao: (_view, secao) => secoes.push(secao),
    });
    await clicar(item("config", "operacao"));
    expect(secoes).toEqual([]);
  });
});

/*
  Recolhida, cada área é um ícone e o painel dela flutua ao lado do trilho. O
  estado é o de `proximoFlutuante` (testado em tests/menu-lateral.test.js).
*/
describe("barra recolhida: painel flutuante", () => {
  it("o clique no ícone abre e fixa; o segundo fecha", async () => {
    await montar(arvoreCompleta(), { navegar: () => {} });
    await recolher();

    await clicar(cabecalho("saude-indigena"));
    expect(flutuando("saude-indigena")).toBe(true);
    expect(cabecalho("saude-indigena").getAttribute("aria-expanded")).toBe(
      "true",
    );
    expect(
      area("saude-indigena").style.getPropertyValue("--menu-flutuante-topo"),
    ).toMatch(/px$/);

    await clicar(cabecalho("saude-indigena"));
    expect(flutuando("saude-indigena")).toBe(false);
    expect(cabecalho("saude-indigena").getAttribute("aria-expanded")).toBe(
      "false",
    );
  });

  it("só um painel por vez", async () => {
    await montar(arvoreCompleta(), { navegar: () => {} });
    await recolher();
    await clicar(cabecalho("saude-indigena"));
    await clicar(cabecalho("administracao"));
    expect(flutuando("saude-indigena")).toBe(false);
    expect(flutuando("administracao")).toBe(true);
  });

  it("Esc fecha e devolve o foco ao ícone, sem reabrir", async () => {
    await montar(arvoreCompleta(), { navegar: () => {} });
    await recolher();
    await clicar(cabecalho("administracao"));

    await act(async () => item("config", "marca").focus());
    await act(async () =>
      item("config", "marca").dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    );

    expect(flutuando("administracao")).toBe(false);
    expect(document.activeElement).toBe(cabecalho("administracao"));
  });

  it("escolher um item, clicar fora ou expandir a barra fecham o painel", async () => {
    await montar(arvoreCompleta(), { navegar: () => {} });
    await recolher();

    await clicar(cabecalho("saude-indigena"));
    await clicar(item("nucleo"));
    expect(flutuando("saude-indigena")).toBe(false);

    await clicar(cabecalho("saude-indigena"));
    await act(async () =>
      document.body.dispatchEvent(
        new MouseEvent("pointerdown", { bubbles: true }),
      ),
    );
    expect(flutuando("saude-indigena")).toBe(false);

    await clicar(cabecalho("saude-indigena"));
    await recolher(false);
    expect(flutuando("saude-indigena")).toBe(false);
  });

  it("expandida, o clique no cabeçalho volta a ser acordeão", async () => {
    await montar();
    await clicar(cabecalho("saude-indigena"));
    expect(flutuando("saude-indigena")).toBe(false);
    expect(aberta("saude-indigena")).toBe(false);
  });

  it("a navegação ganha .transborda quando os ícones não cabem", async () => {
    const observadores = [];
    const ResizeObserverOriginal = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      constructor(avisar) {
        this.avisar = avisar;
        observadores.push(this);
      }
      observe() {}
      disconnect() {}
    };
    try {
      await montar();
      const navegacao = document.querySelector(".side-navigation");
      Object.defineProperty(navegacao, "scrollHeight", {
        configurable: true,
        value: 900,
      });
      Object.defineProperty(navegacao, "clientHeight", {
        configurable: true,
        value: 500,
      });
      await act(async () => observadores.at(-1).avisar());
      expect(navegacao.classList.contains("transborda")).toBe(true);
    } finally {
      globalThis.ResizeObserver = ResizeObserverOriginal;
    }
  });
});

/*
  Um controle só para recolher, com o id de sempre. Acima de 900px é a alça na
  marca; até 900px a barra é gaveta fora da tela e o botão vai para o cabeçalho
  (portal), senão sairia da tela junto com ela.
*/
describe("o botão de recolher", () => {
  const botoes = () => document.querySelectorAll("#globalSidebarToggle");

  it("no desktop é a alça dentro da marca, com seta e hambúrguer", async () => {
    await montar();
    const botao = document.getElementById("globalSidebarToggle");

    expect(botoes()).toHaveLength(1);
    expect(botao.parentElement.className).toBe("side-brand");
    expect(botao.querySelector(".icone-recolher").dataset.icone).toBe(
      "chevron-left",
    );
    expect(botao.querySelector(".icone-menu").dataset.icone).toBe("menu");
    expect(botao.getAttribute("aria-expanded")).toBe("true");
    expect(botao.getAttribute("aria-label")).toBe("Recolher menu lateral");
  });

  it("acompanha a classe de body e chama window.toggleSidebar", async () => {
    await montar();
    window.toggleSidebar = vi.fn();
    await recolher();

    const botao = document.getElementById("globalSidebarToggle");
    expect(botao.getAttribute("aria-expanded")).toBe("false");
    expect(botao.getAttribute("aria-label")).toBe("Expandir menu lateral");
    await clicar(botao);
    expect(window.toggleSidebar).toHaveBeenCalledTimes(1);
  });

  it("até 900px vai para o cabeçalho, e o hambúrguer antigo fica onde está", async () => {
    await montar();
    await larguraDaJanela(390);

    const botao = document.getElementById("globalSidebarToggle");
    expect(botoes()).toHaveLength(1);
    expect(botao.parentElement.classList.contains("title-row")).toBe(true);
    expect(botao.closest(".sidebar")).toBeNull();
    expect(
      document.getElementById("hambToggle").closest("header.top"),
    ).not.toBeNull();

    await larguraDaJanela(1440);
    expect(
      document.getElementById("globalSidebarToggle").parentElement.className,
    ).toBe("side-brand");
    expect(botoes()).toHaveLength(1);
  });
});

describe("rodapé", () => {
  const opcao = (tema) =>
    document.querySelector(`.side-tema__opcao[data-tema="${tema}"]`);

  it("o seletor de tema troca o tema, e o segmento ativo não inverte", async () => {
    await montar();
    window.toggleDarkMode = vi.fn(() => {
      const escuro =
        document.documentElement.getAttribute("data-theme") === "dark";
      document.documentElement.setAttribute("data-theme", escuro ? "" : "dark");
      avisar(EVENTO_TEMA_ALTERADO);
    });

    expect(opcao("claro").getAttribute("aria-pressed")).toBe("true");
    await clicar(opcao("escuro"));
    expect(window.toggleDarkMode).toHaveBeenCalledTimes(1);
    expect(opcao("escuro").getAttribute("aria-pressed")).toBe("true");
    expect(
      document.querySelector(".side-tema__alternar").getAttribute("aria-label"),
    ).toBe("Tema escuro ativo. Alternar para tema claro.");

    await clicar(opcao("escuro"));
    expect(window.toggleDarkMode).toHaveBeenCalledTimes(1);
  });

  it("o Sair abre a confirmação de saída", async () => {
    await montar();
    await clicar(document.getElementById("sidebarLogoutBtn"));
    expect(performExplicitLogout).toHaveBeenCalledTimes(1);
  });

  /*
    Duas folhas continuam do legado: o `src` da logo (sidebar-branding.js) e o
    texto da versão (applyConfigToUi). O React cria os nós e não mexe mais
    neles — uma nova renderização não pode desfazer o que o legado escreveu.
  */
  it("logo e versão escritas pelo legado sobrevivem às renderizações", async () => {
    await montar();
    document
      .getElementById("sideLogo")
      .setAttribute("src", "/assets/outra.webp");
    document.getElementById("sidebarVersion").textContent = "2.0.1";

    await act(async () => atualizarMenuLateral(arvoreCompleta([])));
    await act(async () => marcarItemAtivoNoMenu("nucleo"));
    await recolher();

    expect(document.getElementById("sideLogo").getAttribute("src")).toBe(
      "/assets/outra.webp",
    );
    expect(document.getElementById("sidebarVersion").textContent).toBe("2.0.1");
  });
});

const semComentarios = (fonte) =>
  fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const bloco = (css, seletor) => {
  const i = css.indexOf(seletor);
  return i < 0 ? "" : css.slice(i, css.indexOf("}", i));
};

describe("contrato de CSS e ligação no arranque", () => {
  const css = semComentarios(
    readFileSync("src/styles/barra-lateral.css", "utf8"),
  );
  const platformShell = semComentarios(
    readFileSync("src/styles/platform-shell.css", "utf8"),
  );
  const app = semComentarios(readFileSync("src/styles/app.css", "utf8"));
  const main = readFileSync("src/main.js", "utf8");
  const html = readFileSync("index.html", "utf8");

  it("o hambúrguer antigo sai de cena e o botão único aparece em todo modo", () => {
    expect(css).toMatch(/#hambToggle\s*\{\s*display:\s*none\s*!important/);
    expect(css).toMatch(
      /#appScreen \.global-side-toggle\s*\{\s*display:\s*grid\s*!important/,
    );
  });

  it("é alça na borda da barra e fica no fluxo do cabeçalho, nunca fixo", () => {
    const alca = bloco(
      css,
      "#appScreen .sidebar .side-brand > .global-side-toggle",
    );
    expect(alca).toContain("position: absolute");
    expect(alca).toContain("left: auto");
    expect(alca).toMatch(/right:\s*-12px/);
    const noCabecalho = bloco(
      css,
      "#appScreen .title-row > .global-side-toggle",
    );
    expect(noCabecalho).toContain("position: static");
    expect(noCabecalho).toContain("order: -1");
    expect(css).not.toContain("position: fixed;\n  top: 50%");
  });

  it("a seta gira recolhida, e cada lugar mostra o seu ícone", () => {
    expect(css).toMatch(
      /body\.sidebar-collapsed \.side-brand > \.global-side-toggle \.icone-recolher\s*\{\s*transform:\s*rotate\(180deg\)/,
    );
    expect(css).toMatch(
      /\.side-brand > \.global-side-toggle \.icone-menu,\s*\.title-row > \.global-side-toggle \.icone-recolher\s*\{\s*display:\s*none/,
    );
  });

  it("recolhida, quem rola é a navegação, e só quando transborda", () => {
    expect(platformShell).not.toContain("max-height: 620px");
    expect(
      bloco(
        platformShell,
        "body.sidebar-collapsed .side-navigation.transborda",
      ),
    ).toContain("overflow-y: auto");
    expect(platformShell).not.toContain(
      "body.external-panel-mode .sidebar .global-side-toggle",
    );
  });

  it("a barra é fixa em todo o desktop", () => {
    expect(app).not.toContain("min-width: 1481px");
    expect(bloco(app, "@media (min-width: 901px)")).toContain(
      "position: fixed",
    );
  });

  it("o main.js monta a barra antes do branding e importa o CSS dela", () => {
    expect(main).toContain(
      'import { montarBarraLateral } from "./componentes/barra-lateral/barra-lateral.jsx"',
    );
    expect(main).toContain('import "./styles/barra-lateral.css"');
    expect(main.indexOf("montarBarraLateral();")).toBeGreaterThan(-1);
    expect(main.indexOf("montarBarraLateral();")).toBeLessThan(
      main.indexOf("initSidebarBranding();"),
    );
    expect(main).not.toContain("colapsar-a-sidebar");
    expect(main).not.toContain("menu-lateral.css");
  });

  it("o <aside> do index.html é só o ponto de montagem", () => {
    const aside = html.match(/<aside class="sidebar"[^>]*>([\s\S]*?)<\/aside>/);
    expect(aside).not.toBeNull();
    expect(aside[1].trim()).toBe("");
    expect(html).not.toContain('id="globalSidebarToggle"');
    expect(html).not.toContain('id="nav"');
  });
});
