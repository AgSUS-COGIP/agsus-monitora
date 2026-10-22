import { beforeEach, describe, expect, it } from "vitest";
import { syncMobileState } from "../src/modules/mobile-app-experience.js";

/*
  No celular, a gaveta fechada sai da tela só pelo transform: precisa de
  `inert` para os links não ficarem na ordem do Tab nem no leitor de tela.
  No computador a barra é sempre navegável.
*/
function largura(px) {
  Object.defineProperty(window, "innerWidth", {
    value: px,
    configurable: true,
  });
}

const gaveta = () => document.querySelector(".sidebar");

beforeEach(() => {
  document.body.className = "sidebar-collapsed";
  document.body.innerHTML = `<aside class="sidebar"><a href="#">Editais</a></aside>
    <button id="sidebarOverlay" class="hidden"></button>`;
});

describe("gaveta do celular", () => {
  it("fechada fica inert; aberta, não", () => {
    largura(390);
    syncMobileState();
    expect(gaveta().hasAttribute("inert")).toBe(true);
    document.body.classList.add("sidebar-open");
    syncMobileState();
    expect(gaveta().hasAttribute("inert")).toBe(false);
    expect(
      document.getElementById("sidebarOverlay").classList.contains("hidden"),
    ).toBe(false);
  });

  it("no computador, a barra recolhida continua navegável", () => {
    largura(1280);
    syncMobileState();
    expect(gaveta().hasAttribute("inert")).toBe(false);
  });
});
