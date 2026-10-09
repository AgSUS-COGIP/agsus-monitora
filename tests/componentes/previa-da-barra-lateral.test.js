import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { montarArvoreDoMenu } from "../../src/lib/menu-lateral.ts";
import { EVENTO_MENU_ATUALIZADO } from "../../src/lib/eventos-da-barra-lateral.js";
import { SECOES } from "../../src/modulos/configuracoes/secoes.js";
import { montarBarraLateral } from "../../src/componentes/barra-lateral/barra-lateral.tsx";
import {
  atualizarMenuLateral,
  marcarItemAtivoNoMenu,
  redefinirBarraLateral,
} from "../../src/componentes/barra-lateral/estado.ts";
import {
  definirAreaAtual,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.js";
import { criarEstadoDasConfiguracoes } from "../../src/modulos/configuracoes/estado.js";
import { SecaoMarca } from "../../src/modulos/configuracoes/marca.jsx";
import { PreviaDaBarraLateral } from "../../src/modulos/configuracoes/previa-da-barra-lateral.tsx";

/*
  A prévia da barra lateral (Configurações › Marca) é a barra de verdade, em
  miniatura: as mesmas peças (`PecasDaBarraLateral`) dentro de um quadro. O
  primeiro teste desenha as duas e compara a estrutura — mudou a barra,
  mudou a prévia; se este teste quebrar, a prévia deixou de usar a barra.
  Pedido de 08/10/2026: "a prévia não está refletindo o real".
*/

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const VERSAO = { rotulo: "Versão", valor: "V2.9.35" };

function arvoreDaPessoa() {
  return montarArvoreDoMenu({
    permitidas: {
      dashboard: true,
      nucleo: true,
      recursos: true,
      "analisar-recursos": true,
      approved: true,
      config: true,
    },
    areas: ["saude-indigena", "projetos"],
    paineis: [{ codigo: "x", titulo: "Painel X" }],
    secoesDeConfiguracao: SECOES,
  });
}

const raizes = [];

async function montarBarraDeVerdade() {
  document.body.insertAdjacentHTML(
    "beforeend",
    `<section id="appScreen" class="app">
       <aside class="sidebar" aria-label="Navegação principal"></aside>
       <main class="main"><header class="top"><div class="title-row"></div></header></main>
     </section>`,
  );
  await act(async () => {
    raizes.push(
      montarBarraLateral(document.querySelector("#appScreen .sidebar")),
    );
  });
  return document.querySelector("#appScreen .sidebar");
}

async function desenhar(elemento) {
  const lugar = document.createElement("div");
  document.body.append(lugar);
  const raiz = createRoot(lugar);
  raizes.push(raiz);
  await act(async () => raiz.render(elemento));
  return lugar;
}

async function montarPrevia(props = {}) {
  const lugar = await desenhar(
    createElement(PreviaDaBarraLateral, {
      logo: "/assets/agsus-logo.webp",
      cor: "#ffffff",
      versao: VERSAO,
      ...props,
    }),
  );
  const quadro = lugar.querySelector("iframe");
  return { lugar, quadro, documento: quadro.contentDocument };
}

const barraDaPrevia = (documento) => documento.querySelector(".sidebar");

/*
  A estrutura: tag, classes e os atributos que o CSS e o app leem, de cada
  elemento, na ordem. Fica de fora o que muda de propósito na prévia: o `src`
  da logo (rascunho) e o texto da versão (que o legado escreve na barra).
*/
const ATRIBUTOS = [
  "id",
  "data-view",
  "data-secao",
  "data-area",
  "data-icone",
  "data-seletor-de-area",
  "data-cor-da-area",
  "data-opcao-de-area",
  "data-tema",
  "aria-pressed",
  "aria-current",
  "aria-expanded",
  "aria-label",
];
function estrutura(elemento) {
  return [...elemento.querySelectorAll("*")].map((no) =>
    [
      no.tagName.toLowerCase(),
      [...no.classList].sort().join("."),
      ...ATRIBUTOS.map((nome) =>
        no.hasAttribute(nome) ? `${nome}=${no.getAttribute(nome)}` : "",
      ),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

beforeEach(() => {
  localStorage.clear();
  document.body.className = "";
  document.documentElement.removeAttribute("data-theme");
});

afterEach(async () => {
  for (const raiz of raizes.splice(0)) await act(async () => raiz.unmount());
  document.body.innerHTML = "";
  await act(async () => redefinirBarraLateral());
  await act(async () => redefinirDadosDoMonitoramento());
});

describe("a prévia é a barra lateral de verdade", () => {
  it("desenha a mesma estrutura da barra: marca, área, itens, Administração e rodapé", async () => {
    const real = await montarBarraDeVerdade();
    await act(async () => {
      definirAreaAtual("projetos");
      atualizarMenuLateral(arvoreDaPessoa());
      marcarItemAtivoNoMenu("config", "marca");
    });
    const { documento } = await montarPrevia();
    const previa = barraDaPrevia(documento);

    expect(estrutura(previa)).toEqual(estrutura(real));
    // O que a pessoa vê na barra está na prévia.
    expect(previa.querySelector(".side-brand-copy").textContent).toBe(
      "MONITORA",
    );
    expect(
      previa.querySelector(".menu-seletor__rotulo strong").textContent,
    ).toBe("Projetos");
    expect(
      previa.querySelector(
        '.menu-item[data-view="analisar-recursos"] .menu-item__selo',
      )?.textContent,
    ).toBe("BETA");
    expect(
      previa.querySelector('.menu-item[data-view="recursos"]').textContent,
    ).toBe("Painel de recursos");
    expect(
      previa.querySelector('.menu-item.active[aria-current="page"]').dataset
        .secao,
    ).toBe("marca");
    expect(previa.querySelector(".side-recolher").textContent).toBe(
      "Recolher menu",
    );
    expect(previa.querySelector("#sidebarLogoutBtn").textContent).toBe("Sair");
    expect(previa.querySelector(".side-version").textContent).toBe(
      "VersãoV2.9.35",
    );
  });

  it("não tem o rodapé de equipe que a barra não tem", async () => {
    const estado = criarEstadoDasConfiguracoes();
    estado.definirValoresCarregados({ cogip_nome: "COGIP" });
    const lugar = await desenhar(createElement(SecaoMarca, { estado }));
    const documento = lugar.querySelector(
      ".config-previa iframe",
    ).contentDocument;

    expect(documento.querySelector(".sidebar")).not.toBeNull();
    expect(documento.body.textContent).not.toContain("COGIP");
    expect(lugar.querySelector(".config-previa").textContent).not.toMatch(
      /Nome da equipe|Função/,
    );
  });

  it("sem menu ainda, mostra o catálogo de abas com os selos BETA", async () => {
    const { documento } = await montarPrevia();
    const previa = barraDaPrevia(documento);

    expect(previa.querySelectorAll(".menu-item__selo").length).toBeGreaterThan(
      0,
    );
    expect(previa.querySelector(".menu-area--administracao")).not.toBeNull();
    expect(
      previa.querySelector('.menu-item[aria-current="page"]').dataset.secao,
    ).toBe("marca");
  });
});

describe("a prévia mostra o rascunho, sem interação", () => {
  it("usa a cor do rascunho, com o contraste da barra de verdade", async () => {
    const { documento } = await montarPrevia({ cor: "#0B3D5C" });
    const raiz = documento.documentElement;

    expect(raiz.style.getPropertyValue("--sidebar-custom-bg")).toBe("#0b3d5c");
    expect(documento.body.classList.contains("sidebar-theme-dark")).toBe(true);
    // A barra da página não muda até salvar.
    expect(document.body.classList.contains("sidebar-theme-dark")).toBe(false);
  });

  it("usa a logo do rascunho; endereço inválido volta para a padrão", async () => {
    const { documento } = await montarPrevia({
      logo: "https://cdn.test/logo.png",
    });
    const logo = () => barraDaPrevia(documento).querySelector("#sideLogo");
    expect(logo().getAttribute("src")).toBe("https://cdn.test/logo.png");

    await act(async () => logo().dispatchEvent(new Event("error")));
    expect(logo().getAttribute("src")).toBe("/assets/agsus-logo.webp");
  });

  it("segue o tema do app, claro ou escuro", async () => {
    document.documentElement.setAttribute("data-theme", "dark");
    const { documento } = await montarPrevia();

    expect(documento.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(
      barraDaPrevia(documento)
        .querySelector('.side-tema__opcao[aria-pressed="true"]')
        .getAttribute("data-tema"),
    ).toBe("escuro");
  });

  it("é inerte: fora da tabulação e da leitura, sem gravar nem avisar", async () => {
    const avisos = [];
    const ouvir = (evento) => avisos.push(evento);
    document.addEventListener(EVENTO_MENU_ATUALIZADO, ouvir);
    const { quadro, documento } = await montarPrevia();
    document.removeEventListener(EVENTO_MENU_ATUALIZADO, ouvir);

    expect(quadro.getAttribute("tabindex")).toBe("-1");
    expect(quadro.getAttribute("aria-hidden")).toBe("true");
    expect(barraDaPrevia(documento).hasAttribute("inert")).toBe(true);
    expect(avisos).toHaveLength(0);
    // Os ids da barra ficam no documento do quadro, sem repetir os da página.
    expect(document.getElementById("nav")).toBeNull();
    expect(documento.getElementById("nav")).not.toBeNull();
  });
});
