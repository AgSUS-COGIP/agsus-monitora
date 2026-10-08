import { existsSync, readFileSync } from "node:fs";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { montarArvoreDoMenu } from "../../src/lib/menu-lateral.ts";
import {
  avisar,
  EVENTO_BARRA_ALTERNADA,
  EVENTO_MENU_ATUALIZADO,
  EVENTO_TEMA_ALTERADO,
} from "../../src/lib/eventos-da-barra-lateral.js";
import { SECOES } from "../../src/modulos/configuracoes/secoes.js";
import { performExplicitLogout } from "../../src/modules/nielsen-shell-ux.js";
import { montarBarraLateral } from "../../src/componentes/barra-lateral/barra-lateral.tsx";
import {
  atualizarMenuLateral,
  marcarItemAtivoNoMenu,
  redefinirBarraLateral,
} from "../../src/componentes/barra-lateral/estado.ts";
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
const PAINEL_X = [{ codigo: "x", titulo: "Painel X" }];

function arvoreCompleta(paineis = []) {
  return montarArvoreDoMenu({
    permitidas: {
      dashboard: true,
      nucleo: true,
      calendario: true,
      approved: true,
      analises: true,
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
      ["Painel das análises", "saude-indigena"],
      ["Lista de aprovados", "saude-indigena"],
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
  Com mais de uma área, o topo é o seletor de área e, abaixo, só as páginas da
  área atual. Trocar de área abre a mesma página na área nova, ou a primeira
  dela. As páginas esperadas vêm da árvore: o teste não supõe qual view é a
  Visão geral de cada área.
*/
describe("as áreas do usuário: seletor de área", () => {
  const TODAS = ["saude-indigena", "sede", "projetos"];
  const itemDaArea = (id, view) =>
    area(id)?.querySelector(`.menu-item[data-view="${view}"]`);
  const seletor = () => document.querySelector(".menu-seletor");
  const opcao = (id) => document.querySelector(`[data-opcao-de-area="${id}"]`);
  const areasDesenhadas = () =>
    [...document.querySelectorAll(".menu-area[data-area]")].map(
      (secao) => secao.dataset.area,
    );
  const viewsDoGrupo = (arvore, id) =>
    arvore.find((grupo) => grupo.id === id).itens.map((item) => item.view);

  it("com três áreas, mostra o seletor e só as páginas da área atual", async () => {
    const arvore = montarArvoreDoMenu({
      permitidas: {
        dashboard: true,
        nucleo: true,
        calendario: true,
        approved: true,
        analises: true,
        config: true,
      },
      secoesDeConfiguracao: SECOES,
      areas: TODAS,
    });
    await montar(arvore);

    expect(seletor().querySelector("strong").textContent).toBe(
      "Saúde Indígena",
    );
    expect(
      [...seletor().querySelectorAll(".menu-seletor__opcao")].map(
        (botao) => botao.textContent,
      ),
    ).toEqual(["Saúde Indígena", "SEDE", "Projetos"]);
    // As opções não são páginas: o celular e os ganchos do mapa não as veem.
    expect(seletor().querySelector("[data-view]")).toBeNull();
    // No lugar das três áreas abertas uma sob a outra, só a atual.
    expect(areasDesenhadas()).toEqual(["saude-indigena", "administracao"]);
    // Expandida, o seletor é o cabeçalho: a área não repete o nome.
    expect(area("saude-indigena").querySelector(".menu-area__cabecalho")).toBe(
      null,
    );
    expect(
      area("administracao").classList.contains("menu-area--administracao"),
    ).toBe(true);
    // Administração lista todas as seções de Configurações.
    expect(
      [...area("administracao").querySelectorAll(".menu-item")].map(
        (botao) => botao.dataset.secao,
      ),
    ).toEqual(SECOES.map((secao) => secao.id));

    await act(async () => definirAreaAtual("sede"));
    expect(seletor().querySelector("strong").textContent).toBe("SEDE");
    expect(areasDesenhadas()).toEqual(["sede", "administracao"]);
    expect(
      [...area("sede").querySelectorAll(".menu-item")].map(
        (botao) => botao.dataset.view,
      ),
    ).toEqual(viewsDoGrupo(arvore, "sede"));
  });

  it("com uma área só, não há seletor e a área é acordeão como antes", async () => {
    await montar();
    expect(seletor()).toBeNull();
    expect(
      area("saude-indigena").querySelector(".menu-area__cabecalho"),
    ).not.toBeNull();
  });

  it("trocar de área abre a mesma página na área nova; sem ela, a primeira", async () => {
    const chamadas = [];
    /*
      Hoje toda aba existe nas três áreas; para o "sem ela", a Visão geral
      fica só na Saúde Indígena nesta árvore.
    */
    const arvore = montarArvoreDoMenu({
      permitidas: { dashboard: true, nucleo: true, calendario: true },
      areas: TODAS,
    }).map((grupo) =>
      grupo.id === "saude-indigena"
        ? grupo
        : {
            ...grupo,
            itens: grupo.itens.filter((item) => item.view !== "dashboard"),
          },
    );
    await montar(arvore, {
      navegar: (view) => {
        // A área já mudou quando a navegação acontece.
        chamadas.push([view, obterDadosDoMonitoramento().areaAtual]);
        marcarItemAtivoNoMenu(view);
      },
    });

    await clicar(itemDaArea("saude-indigena", "calendario"));
    await clicar(seletor().querySelector(".menu-area__cabecalho"));
    expect(seletor().classList.contains("menu-area--aberta")).toBe(true);
    await clicar(opcao("sede"));

    expect(seletor().classList.contains("menu-area--aberta")).toBe(false);
    expect(seletor().dataset.seletorDeArea).toBe("sede");
    expect(itemDaArea("sede", "calendario").getAttribute("aria-current")).toBe(
      "page",
    );
    expect(
      document.querySelectorAll('#nav [aria-current="page"]'),
    ).toHaveLength(1);

    // Uma página que só a Saúde Indígena tem: em Projetos, abre a primeira dela.
    const sede = viewsDoGrupo(arvore, "sede");
    const soDaSaude = viewsDoGrupo(arvore, "saude-indigena").find(
      (view) => !sede.includes(view),
    );
    await clicar(opcao("saude-indigena"));
    await clicar(itemDaArea("saude-indigena", soDaSaude));
    await clicar(opcao("projetos"));

    expect(chamadas).toEqual([
      ["calendario", "saude-indigena"],
      ["calendario", "sede"],
      ["calendario", "saude-indigena"],
      [soDaSaude, "saude-indigena"],
      [viewsDoGrupo(arvore, "projetos")[0], "projetos"],
    ]);
  });

  it("recolhida, o seletor é um ícone e a lista das áreas flutua no clique", async () => {
    await montar(
      montarArvoreDoMenu({ permitidas: { nucleo: true }, areas: TODAS }),
      { navegar: () => {} },
    );
    await recolher();
    const botao = seletor().querySelector(".menu-area__cabecalho");
    expect(botao.getAttribute("aria-label")).toBe(
      "Área atual: Saúde Indígena. Trocar de área",
    );
    // No trilho a área atual não tem cabeçalho: as páginas são ícones diretos.
    expect(
      area("saude-indigena").querySelector(".menu-area__cabecalho"),
    ).toBeNull();

    // Apontar e focar só mostram a dica; quem abre a lista é o clique.
    await act(async () => {
      botao.dispatchEvent(
        new PointerEvent("pointerover", {
          bubbles: true,
          pointerType: "mouse",
        }),
      );
      botao.focus();
    });
    expect(seletor().classList.contains("menu-area--flutuante")).toBe(false);

    await clicar(botao);
    expect(seletor().classList.contains("menu-area--flutuante")).toBe(true);
    await clicar(opcao("projetos"));
    expect(seletor().classList.contains("menu-area--flutuante")).toBe(false);
    expect(obterDadosDoMonitoramento().areaAtual).toBe("projetos");
    expect(document.activeElement).toBe(
      seletor().querySelector(".menu-area__cabecalho"),
    );
  });

  it("o ícone do seletor é o da área atual, com a cor e a dica dela", async () => {
    await montar(
      montarArvoreDoMenu({ permitidas: { nucleo: true }, areas: TODAS }),
      { navegar: () => {} },
    );
    await recolher();
    const botao = () => seletor().querySelector(".menu-seletor__botao");
    const icone = () =>
      botao().querySelector(".menu-seletor__icone").dataset.icone;

    const esperado = {
      "saude-indigena": ["heart-pulse", "Área: Saúde Indígena"],
      sede: ["building-2", "Área: SEDE"],
      projetos: ["folder-kanban", "Área: Projetos"],
    };
    for (const [id, [nome, dica]] of Object.entries(esperado)) {
      await act(async () => definirAreaAtual(id));
      expect(icone()).toBe(nome);
      expect(botao().dataset.corDaArea).toBe(id);
      expect(botao().dataset.dica).toBe(dica);
      expect(
        botao().querySelector(".menu-seletor__ponto").dataset.corDaArea,
      ).toBe(id);
    }

    // Expandida, a marca é a mesma (ícone e bolinha); a dica é só do trilho.
    await recolher(false);
    expect(icone()).toBe("folder-kanban");
    expect(botao().hasAttribute("data-dica")).toBe(false);
  });
});

/*
  Recolhida, cada página da área atual é um ícone que navega num clique, com a
  dica do nome e a página aberta em destaque. Painéis e Administração
  continuam agrupados, com o painel flutuante.
*/
describe("barra recolhida: páginas da área como ícones", () => {
  const TODAS = ["saude-indigena", "sede", "projetos"];
  const arvoreDasAreas = () =>
    montarArvoreDoMenu({
      permitidas: {
        dashboard: true,
        nucleo: true,
        calendario: true,
        approved: true,
        analises: true,
        recursos: true,
        config: true,
      },
      paineis: [{ codigo: "x", titulo: "Painel X" }],
      secoesDeConfiguracao: SECOES,
      areas: TODAS,
    });
  const paginasDoTrilho = () => [
    ...document.querySelectorAll(".menu-area--direta .menu-item"),
  ];

  it("de cima para baixo: área, páginas, Painéis e Administração", async () => {
    await montar(arvoreDasAreas(), { navegar: () => {} });
    await recolher();

    const ordem = [...document.querySelectorAll("#nav > section")].map(
      (secao) => (secao.dataset.seletorDeArea ? "seletor" : secao.dataset.area),
    );
    expect(ordem).toEqual([
      "seletor",
      "saude-indigena",
      "paineis",
      "administracao",
    ]);
    expect(
      paginasDoTrilho().map((botao) => [
        botao.dataset.rotulo,
        botao.querySelector(".menu-item__icone").dataset.icone,
        botao.dataset.dica,
      ]),
    ).toEqual([
      ["Visão geral", "map", "Visão geral"],
      ["Editais", "file-text", "Editais"],
      ["Cronograma", "calendar-days", "Cronograma"],
      ["Painel das análises", "file-search", "Painel das análises"],
      ["Recursos", "scale", "Recursos · BETA"],
      ["Lista de aprovados", "user-round-check", "Lista de aprovados"],
    ]);
    // O nome continua no botão para o leitor de tela.
    expect(
      paginasDoTrilho().map(
        (botao) => botao.querySelector(".menu-item__rotulo").textContent,
      ),
    ).toContain("Cronograma");
    // Painéis e Administração continuam agrupados, sem dica (a pílula diz o nome).
    expect(cabecalho("paineis").getAttribute("aria-expanded")).toBe("false");
    expect(cabecalho("administracao").hasAttribute("data-dica")).toBe(false);
  });

  it("um clique navega e marca a página aberta, sem painel", async () => {
    const chamadas = [];
    await montar(arvoreDasAreas(), {
      navegar: (view) => {
        chamadas.push(view);
        marcarItemAtivoNoMenu(view);
      },
    });
    await recolher();

    const cronograma = item("calendario");
    expect(cronograma.closest(".menu-area--direta")).not.toBeNull();
    await clicar(cronograma);

    expect(chamadas).toEqual(["calendario"]);
    expect(item("calendario").getAttribute("aria-current")).toBe("page");
    expect(item("calendario").classList.contains("active")).toBe(true);
    expect(
      document.querySelectorAll('#nav [aria-current="page"]'),
    ).toHaveLength(1);
    expect(document.querySelector(".menu-area--flutuante")).toBeNull();

    // Apontar uma página não abre painel nenhum.
    await act(async () =>
      area("saude-indigena").dispatchEvent(
        new PointerEvent("pointerover", {
          bubbles: true,
          pointerType: "mouse",
        }),
      ),
    );
    expect(document.querySelector(".menu-area--flutuante")).toBeNull();
  });

  it("trocar de área troca os ícones das páginas", async () => {
    await montar(arvoreDasAreas(), { navegar: () => {} });
    await recolher();
    expect(
      new Set(paginasDoTrilho().map((botao) => botao.dataset.area)),
    ).toEqual(new Set(["saude-indigena"]));

    await act(async () => definirAreaAtual("projetos"));
    expect(
      new Set(paginasDoTrilho().map((botao) => botao.dataset.area)),
    ).toEqual(new Set(["projetos"]));
  });

  it("com uma área só, as páginas também são ícones diretos", async () => {
    await montar(arvoreCompleta(), { navegar: () => {} });
    await recolher();
    expect(area("saude-indigena").classList.contains("menu-area--direta")).toBe(
      true,
    );
    expect(
      area("saude-indigena").querySelector(".menu-area__cabecalho"),
    ).toBeNull();
    expect(item("nucleo").dataset.dica).toBe("Editais");
  });

  it("a dica aparece na altura do ícone apontado ou focado", async () => {
    await montar(arvoreDasAreas(), { navegar: () => {} });
    await recolher();
    const editais = item("nucleo");
    editais.getBoundingClientRect = () => ({ top: 100, height: 36 });
    await act(async () => editais.focus());
    expect(editais.style.getPropertyValue("--dica-topo")).toBe("118px");
  });
});

/*
  O menu aberto mostra o ícone de cada página à esquerda do nome (o mesmo do
  trilho), e a aba beta leva o selo "BETA".
*/
describe("ícones e selo beta no menu aberto", () => {
  const arvore = () =>
    montarArvoreDoMenu({
      permitidas: {
        dashboard: true,
        nucleo: true,
        recursos: true,
        config: true,
      },
      paineis: [{ codigo: "x", titulo: "Painel X" }],
      secoesDeConfiguracao: SECOES,
    });

  it("todo item tem o ícone da página antes do nome", async () => {
    await montar(arvore());
    const itens = [...document.querySelectorAll("#nav .menu-item")];
    expect(itens.length).toBeGreaterThan(0);
    for (const botao of itens) {
      const icone = botao.firstElementChild;
      expect(icone.classList.contains("menu-item__icone")).toBe(true);
      expect(icone.dataset.icone).toBe(botao.dataset.icone);
      expect(icone.nextElementSibling.className).toBe("menu-item__rotulo");
    }
    expect(item("dashboard").dataset.icone).toBe("map");
    expect(item("panel:x").dataset.icone).toBe("square-arrow-out-up-right");
    expect(item("config", "acessos").dataset.icone).toBe("users");
    // Expandida não há dica: o nome está à vista.
    expect(document.querySelector("#nav [data-dica]")).toBeNull();
  });

  it("só a aba beta leva o selo, ao lado do nome", async () => {
    await montar(arvore());
    const selos = document.querySelectorAll("#nav .menu-item__selo");
    expect(selos).toHaveLength(1);
    expect(selos[0].textContent).toBe("BETA");
    expect(selos[0].closest(".menu-item")).toBe(item("recursos"));
    expect(item("recursos").classList.contains("menu-item--beta")).toBe(true);
    expect(selos[0].previousElementSibling.textContent).toBe("Recursos");
    // O mobile lê o nome de `data-rotulo`: o selo não entra nele.
    expect(item("recursos").dataset.rotulo).toBe("Recursos");
    expect(item("nucleo").querySelector(".menu-item__selo")).toBeNull();
  });

  it("aba e área em manutenção levam a chave inglesa, com a mensagem na dica", async () => {
    const base = arvore();
    const [saude, ...demais] = base;
    await montar([
      {
        ...saude,
        manutencao: { mensagem: "Área em ajuste", previsao: null },
        itens: saude.itens.map((i) =>
          i.view === "nucleo"
            ? {
                ...i,
                manutencao: { mensagem: "Editais", previsao: "2026-10-05" },
              }
            : i,
        ),
      },
      ...demais,
    ]);
    const indicador = item("nucleo").querySelector(".menu-manutencao");
    expect(indicador.title).toBe(
      "Em manutenção · Editais · Previsão de volta: 05/10/2026",
    );
    expect(item("nucleo").classList.contains("menu-item--manutencao")).toBe(
      true,
    );
    expect(item("dashboard").querySelector(".menu-manutencao")).toBeNull();
    expect(
      cabecalho(saude.id).querySelector(".menu-manutencao").title,
    ).toContain("Área em ajuste");
  });
});

describe("escolher uma página", () => {
  it("chama a navegação com a view do item", async () => {
    const chamadas = [];
    await montar(arvoreCompleta(), { navegar: (view) => chamadas.push(view) });

    await clicar(item("nucleo"));
    await clicar(item("dashboard"));
    await clicar(item("analises"));

    expect(chamadas).toEqual(["nucleo", "dashboard", "analises"]);
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
  Recolhida, Painéis e Administração são um ícone cada, e o painel deles
  flutua ao lado do trilho. O estado é o de `proximoFlutuante` (testado em
  tests/menu-lateral.test.js).
*/
describe("barra recolhida: painel flutuante", () => {
  it("o clique no ícone abre e fixa; o segundo fecha", async () => {
    await montar(arvoreCompleta(PAINEL_X), { navegar: () => {} });
    await recolher();

    await clicar(cabecalho("paineis"));
    expect(flutuando("paineis")).toBe(true);
    expect(cabecalho("paineis").getAttribute("aria-expanded")).toBe("true");
    expect(
      area("paineis").style.getPropertyValue("--menu-flutuante-topo"),
    ).toMatch(/px$/);

    await clicar(cabecalho("paineis"));
    expect(flutuando("paineis")).toBe(false);
    expect(cabecalho("paineis").getAttribute("aria-expanded")).toBe("false");
  });

  it("só um painel por vez", async () => {
    await montar(arvoreCompleta(PAINEL_X), { navegar: () => {} });
    await recolher();
    await clicar(cabecalho("paineis"));
    await clicar(cabecalho("administracao"));
    expect(flutuando("paineis")).toBe(false);
    expect(flutuando("administracao")).toBe(true);
  });

  it("Esc fecha e devolve o foco ao ícone, sem reabrir", async () => {
    await montar(arvoreCompleta(PAINEL_X), { navegar: () => {} });
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
    await montar(arvoreCompleta(PAINEL_X), { navegar: () => {} });
    await recolher();

    await clicar(cabecalho("paineis"));
    await clicar(item("panel:x"));
    expect(flutuando("paineis")).toBe(false);

    await clicar(cabecalho("paineis"));
    await act(async () =>
      document.body.dispatchEvent(
        new MouseEvent("pointerdown", { bubbles: true }),
      ),
    );
    expect(flutuando("paineis")).toBe(false);

    await clicar(cabecalho("paineis"));
    await recolher(false);
    expect(flutuando("paineis")).toBe(false);
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
  Um controle só para recolher, com o id de sempre. Acima de 900px mora no
  rodapé, entre o tema e o Sair, no mesmo lugar expandida ou recolhida; até
  900px a barra é gaveta fora da tela e o botão vai para o cabeçalho (portal),
  senão sairia da tela junto com ela.
*/
describe("o botão de recolher", () => {
  const botoes = () => document.querySelectorAll("#globalSidebarToggle");
  const filhosDoRodape = () =>
    [...document.querySelector(".side-footer").children].map(
      (filho) => filho.id || filho.className,
    );

  it("no desktop fica no rodapé, entre o tema e o Sair, nos dois modos", async () => {
    await montar();
    const botao = document.getElementById("globalSidebarToggle");

    expect(botoes()).toHaveLength(1);
    expect(botao.parentElement.className).toBe("side-footer");
    expect(filhosDoRodape()).toEqual([
      "side-tema",
      "globalSidebarToggle",
      "sidebarLogoutBtn",
      "side-version",
    ]);
    expect(botao.querySelector("svg").dataset.icone).toBe("panel-left");
    expect(botao.textContent).toBe("Recolher menu");
    expect(botao.getAttribute("aria-expanded")).toBe("true");
    expect(botao.getAttribute("aria-label")).toBe("Recolher menu");
    // A marca ficou só com a logo e o nome: nenhuma alça na borda.
    expect(document.querySelector(".side-brand button")).toBeNull();

    await recolher();
    expect(botoes()).toHaveLength(1);
    expect(filhosDoRodape()).toEqual([
      "side-tema",
      "globalSidebarToggle",
      "sidebarLogoutBtn",
      "side-version",
    ]);
    expect(
      document.getElementById("globalSidebarToggle").querySelector("svg")
        .dataset.icone,
    ).toBe("panel-left");
  });

  it("acompanha a classe de body, com rótulo e dica, e chama window.toggleSidebar", async () => {
    await montar();
    window.toggleSidebar = vi.fn();
    await recolher();

    const botao = document.getElementById("globalSidebarToggle");
    expect(botao.getAttribute("aria-expanded")).toBe("false");
    expect(botao.getAttribute("aria-label")).toBe("Expandir menu");
    expect(botao.dataset.dica).toBe("Expandir menu");
    expect(botao.textContent).toBe("Expandir menu");
    await clicar(botao);
    expect(window.toggleSidebar).toHaveBeenCalledTimes(1);

    await recolher(false);
    expect(botao.dataset.dica).toBe("Recolher menu");
  });

  it("até 900px vai para o cabeçalho, e o hambúrguer antigo fica onde está", async () => {
    await montar();
    await larguraDaJanela(390);

    const botao = document.getElementById("globalSidebarToggle");
    expect(botoes()).toHaveLength(1);
    expect(botao.parentElement.classList.contains("title-row")).toBe(true);
    expect(botao.closest(".sidebar")).toBeNull();
    expect(botao.querySelector("svg").dataset.icone).toBe("menu");
    expect(
      document.getElementById("hambToggle").closest("header.top"),
    ).not.toBeNull();
    // Na gaveta, `sidebar-collapsed` quer dizer fechada.
    await recolher();
    expect(
      document.getElementById("globalSidebarToggle").getAttribute("aria-label"),
    ).toBe("Abrir menu");
    await recolher(false);
    expect(
      document.getElementById("globalSidebarToggle").getAttribute("aria-label"),
    ).toBe("Fechar menu");

    await larguraDaJanela(1440);
    expect(
      document.getElementById("globalSidebarToggle").parentElement.className,
    ).toBe("side-footer");
    expect(botoes()).toHaveLength(1);
  });
});

/*
  No trilho, todo controle só com ícone tem nome acessível e dica visível
  (`data-dica`, que o CSS desenha no ponteiro e no foco).
*/
describe("barra recolhida: nomes e dicas dos ícones", () => {
  it("seletor, páginas, tema, recolher e Sair têm aria-label ou nome e dica", async () => {
    await montar(
      montarArvoreDoMenu({
        permitidas: { dashboard: true, nucleo: true, config: true },
        secoesDeConfiguracao: SECOES,
        areas: ["saude-indigena", "sede"],
      }),
      { navegar: () => {} },
    );
    await recolher();

    const comDica = [...document.querySelectorAll(".sidebar [data-dica]")];
    expect(comDica.map((botao) => botao.dataset.dica)).toEqual([
      "Área: Saúde Indígena",
      "Visão geral",
      "Editais",
      "Alternar para tema escuro",
      "Expandir menu",
      "Sair",
    ]);
    for (const botao of comDica) {
      expect(botao.tagName).toBe("BUTTON");
      const nome =
        botao.getAttribute("aria-label") ||
        botao.querySelector(".menu-item__rotulo")?.textContent;
      expect(nome).toBeTruthy();
      // Sem `title`: o nativo repetiria a dica, com atraso.
      expect(botao.hasAttribute("title")).toBe(false);
    }
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

// CRLF vira LF: no Windows o checkout pode trazer \r\n, e as buscas por "\n" passariam por vacuidade.
const semComentarios = (fonte) =>
  fonte
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
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

  it("fica no rodapé (sem alça na marca) e no fluxo do cabeçalho, nunca fixo", () => {
    expect(css).not.toContain(".side-brand > .global-side-toggle");
    expect(bloco(css, ".side-footer > .side-recolher {")).toContain(
      "grid-auto-flow: column",
    );
    const noCabecalho = bloco(
      css,
      "#appScreen .title-row > .global-side-toggle",
    );
    expect(noCabecalho).toContain("position: static");
    expect(noCabecalho).toContain("order: -1");
    expect(css).not.toContain("position: fixed;\n  top: 50%");
  });

  it("recolhida, as dicas aparecem no ponteiro e no foco, fixas ao lado do trilho", () => {
    const dica = bloco(
      css,
      "body.sidebar-collapsed .sidebar [data-dica]::after",
    );
    expect(dica).toContain("content: attr(data-dica)");
    expect(dica).toContain("position: fixed");
    expect(dica).toContain("top: var(--dica-topo");
    expect(css).toMatch(
      /body\.sidebar-collapsed \.sidebar \[data-dica\]:hover::after,\s*body\.sidebar-collapsed \.sidebar \[data-dica\]:focus-visible::after\s*\{[^}]*visibility:\s*visible/,
    );
  });

  it("recolhida, as páginas da área atual ficam no trilho, sem painel flutuante", () => {
    const painel = bloco(
      css,
      "body.sidebar-collapsed .menu-area--direta > .menu-area__painel",
    );
    expect(painel).toContain("position: static");
    expect(painel).toContain("visibility: visible");
  });

  it("nenhum remendo esconde o botão nem guarda folga para a alça", () => {
    // O system-ui-fixes.css foi dissolvido: o cabeçalho é de app.css e platform-shell.css.
    expect(existsSync("src/styles/system-ui-fixes.css")).toBe(false);
    const cabecalho = semComentarios(
      readFileSync("src/styles/app.css", "utf8") +
        readFileSync("src/styles/platform-shell.css", "utf8"),
    );
    expect(cabecalho).not.toMatch(
      /\.top\s*\{[^}]*padding-left:\s*var\(--space-6\)/,
    );
    expect(cabecalho).not.toMatch(/\.app \.global-side-toggle\s*\{/);
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
      'import { montarBarraLateral } from "./componentes/barra-lateral/barra-lateral.tsx"',
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
