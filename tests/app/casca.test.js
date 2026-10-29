import { readFileSync } from "node:fs";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { montarCasca } from "../../src/app/casca/casca.tsx";
import { TELAS_DA_CASCA } from "../../src/app/casca/areas-das-telas.tsx";

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
  casca = montarCasca();
  return document.getElementById("appScreen");
}

describe("montarCasca", () => {
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

  it("sem #appScreen, não monta nada", () => {
    document.body.innerHTML = "";
    expect(montarCasca()).toBeNull();
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
      ...TELAS_DA_CASCA,
      "page-external",
      "page-config",
    ]);
    expect(
      secoes.filter((s) => s.classList.contains("active")).map((s) => s.id),
    ).toEqual(["page-dashboard"]);
    // As telas montam nelas: chegam vazias.
    for (const id of TELAS_DA_CASCA)
      expect(document.getElementById(id).childNodes, id).toHaveLength(0);
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

  it("src/main.ts desenha a casca antes de ligar o sistema e montar as ilhas", () => {
    const casca = main.indexOf("montarCasca();");
    expect(casca).toBeGreaterThan(-1);
    for (const depois of [
      "ligarSistema();",
      "montarEntrada();",
      "montarBarraLateral();",
      "montarVisaoGeral(",
      "montarAya();",
    ])
      expect(main.indexOf(depois), depois).toBeGreaterThan(casca);
  });

  it("o index.html só tem a raiz do #appScreen, escondida", () => {
    expect(indice).toContain(
      '<section id="appScreen" class="app hidden"></section>',
    );
    expect(indice).not.toContain('id="conteudoPrincipal"');
    expect(indice).not.toMatch(/\sonclick=/);
  });
});
