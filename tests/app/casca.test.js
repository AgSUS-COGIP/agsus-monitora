import { readFileSync } from "node:fs";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { Casca } from "../../src/app/casca/casca.tsx";
import { TELAS_DA_CASCA } from "../../src/app/telas.tsx";
import { desenharNoTeste } from "../montar-tela.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/*
  A casca do app (src/app/casca/): a marcação fixa do #appScreen, que era do
  index.html, desenhada pelo React uma vez e na hora. O resto do app a acha
  pelos mesmos ids e classes de antes.
*/

const ACOES = [
  "exitExternalPanel",
  "toggleSidebar",
  "refreshData",
  "toggleBrowserFullscreen",
  "exportPDF",
  "reloadExternal",
];

let casca = null;

afterEach(() => {
  act(() => casca?.desmontar());
  casca = null;
  for (const nome of ACOES) delete window[nome];
  document.body.innerHTML = "";
});

function montar() {
  document.body.innerHTML =
    '<section id="appScreen" class="app hidden"></section>';
  const raiz = document.getElementById("appScreen");
  // Como a raiz do app (src/app/raiz.tsx): na hora, com flushSync.
  casca = desenharNoTeste(raiz, createElement(Casca), { sincrono: true });
  return raiz;
}

describe("Casca", () => {
  it("desenha na hora (sem esperar o React), dentro do #appScreen, que continua escondido", () => {
    const raiz = montar();
    // Sem act: o código seguinte de src/main.ts procura os ids logo depois.
    expect(raiz.querySelector(":scope > #externalReturnBar")).not.toBeNull();
    expect(
      raiz.querySelector(
        ':scope > aside.sidebar[aria-label="Navegação principal"]',
      ),
    ).not.toBeNull();
    expect(
      raiz.querySelector(":scope > main#conteudoPrincipal.main"),
    ).not.toBeNull();
    expect(raiz.classList).toContain("hidden");
  });

  it("tem os ids que o sistema, as ilhas e o legado procuram", () => {
    montar();
    for (const id of [
      "externalBackBtn",
      "externalBackText",
      "pageTitle",
      "pageSubtitle",
      "pessoasOnlineApp",
      "topUserMenu",
      "topUserAvatar",
      "seloNoAvatarApp",
      "userName",
      "userProfileBadge",
      "topUserPopoverName",
      "userEmail",
      "topUserPopoverProfile",
      "selosDoEditalApp",
      "refreshActionText",
      "fullscreenActionIcon",
      "fullscreenActionText",
      "exportPdfActionText",
      "avisoDeVersaoApp",
      "ayaApp",
      "encerramentoDoEditalApp",
      "broadcastBar",
      "externalTitle",
      "externalRefreshBtn",
      "externalRefreshText",
      "externalOpen",
      "externalMount",
      "configuracoesApp",
      "acessosApp",
      "modulosApp",
      "saudeDasCargasApp",
      "automacaoApp",
    ])
      expect(document.getElementById(id), id).not.toBeNull();
    expect(
      document.querySelector("#conteudoPrincipal > header.top > .title-row"),
    ).not.toBeNull();
    expect(document.getElementById("broadcastBar").hidden).toBe(true);
    expect(document.getElementById("conteudoPrincipal").tabIndex).toBe(-1);
  });

  it("as seções das telas, na ordem de antes, com a Visão geral ativa", () => {
    montar();
    const secoes = [
      ...document.querySelectorAll(
        "#conteudoPrincipal > .content > section.page",
      ),
    ];
    expect(secoes.map((s) => s.id)).toEqual([
      ...TELAS_DA_CASCA.map((view) => `page-${view}`),
      "page-external",
      "page-config",
      "page-sem-acesso",
    ]);
    expect(
      secoes.filter((s) => s.classList.contains("active")).map((s) => s.id),
    ).toEqual(["page-dashboard"]);
    // Sem telas registradas (a raiz registra), as seções chegam vazias.
    for (const view of TELAS_DA_CASCA)
      expect(
        document.getElementById(`page-${view}`).childNodes,
        view,
      ).toHaveLength(0);
  });

  it("os botões chamam os contratos de window na hora do clique, fechando o menu da conta como antes", () => {
    montar();
    const menu = document.getElementById("topUserMenu");
    const chamadas = [];
    for (const nome of ACOES)
      window[nome] = () =>
        chamadas.push(
          `${nome}:${menu.hasAttribute("open") ? "aberto" : "fechado"}`,
        );
    const clicar = (botao) => {
      menu.setAttribute("open", "");
      act(() => botao.click());
    };
    clicar(document.getElementById("externalBackBtn"));
    for (const botao of document.querySelectorAll(
      ".top-user-popover-actions button",
    ))
      clicar(botao);
    clicar(document.getElementById("externalRefreshBtn"));
    expect(chamadas).toEqual([
      "exitExternalPanel:aberto",
      // Atualizar chama e depois fecha; Tela cheia e PDF fecham antes.
      "refreshData:aberto",
      "toggleBrowserFullscreen:fechado",
      "exportPDF:fechado",
      "reloadExternal:aberto",
    ]);
    expect(menu.hasAttribute("open")).toBe(true);
  });

  it("sem o contrato em window (antes de ligarSistema), o clique não quebra", () => {
    montar();
    expect(() =>
      act(() => document.getElementById("externalBackBtn").click()),
    ).not.toThrow();
  });

  it("não tem onclick inline: as ações são do React", () => {
    montar();
    expect(document.querySelectorAll("#appScreen [onclick]")).toHaveLength(0);
  });
});

describe("arranque", () => {
  const main = readFileSync("src/main.ts", "utf8");
  const indice = readFileSync("index.html", "utf8");

  it("src/main.ts desenha a raiz (com a casca) antes de ligar o sistema e montar as ilhas", () => {
    const raiz = main.indexOf("montarRaiz({");
    expect(raiz).toBeGreaterThan(-1);
    for (const depois of [
      "ligarSistema();",
      "ligarEntradaAPagina(",
      "montarBuscaGlobal(",
      "montarAya();",
    ])
      expect(main.indexOf(depois), depois).toBeGreaterThan(raiz);
    // As telas são rotas da raiz, não ilhas de src/main.ts.
    expect(main).not.toMatch(/montar(VisaoGeral|Nucleo|BarraLateral|Casca)\(/);
  });

  it("o index.html só tem a raiz do #appScreen, escondida", () => {
    expect(indice).toContain(
      '<section id="appScreen" class="app hidden"></section>',
    );
    expect(indice).not.toContain('id="conteudoPrincipal"');
    expect(indice).not.toMatch(/\sonclick=/);
  });
});
