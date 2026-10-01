import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import {
  definirPaginaDaAya,
  obterPaginaDaAya,
} from "../src/modulos/aya/estado.js";
import { definirPaginaDaAba } from "../src/lib/identidade-da-aba.js";

const app = readFileSync("src/modules/legacy-app.js", "utf8");
const start = app.indexOf("function setPageTitle(");
const end = app.indexOf("function isSidebarLockedViewport(", start);

/*
  A navegação real (setPageTitle do legado) avisa a Aya da página aberta: é
  daí que saem a saudação, as sugestões e o contexto das perguntas.
*/
describe("título e Aya conectados à navegação real", () => {
  it.each([
    ["dashboard", "Saúde Indígena"],
    ["nucleo", "Editais"],
    ["recursos", "Recursos"],
    ["config", "Configurações"],
  ])("avisa a Aya de %s sem renomear a aba", (view, title) => {
    document.body.innerHTML =
      '<h1 id="pageTitle"></h1><p id="pageSubtitle"></p>';
    const setPageTitle = runInNewContext(
      `${app.slice(start, end)}; setPageTitle`,
      {
        document,
        $: (id) => document.getElementById(id),
        currentView: view,
        definirPaginaDaAya,
        definirPaginaDaAba,
      },
    );
    setPageTitle(title, "Orientações da seção");
    expect(document.title).toBe("MONITORA");
    expect(document.getElementById("pageTitle").textContent).toBe(title);
    expect(obterPaginaDaAya()).toMatchObject({ view, titulo: title });
  });
});
