import { act } from "react";
import { describe, expect, it, vi } from "vitest";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// O jsdom não tem matchMedia (a moldura pergunta a largura).
window.matchMedia ||= () => ({ matches: false });

/*
  A ligação do sistema (src/app/sistema.js): os contratos em window que o
  index.html, a barra lateral, a Aya, o chat e as telas usam, os ganchos da
  sessão e a busca global.
*/

describe("ligarSistema", () => {
  it("publica os contratos em window e liga os ganchos da sessão", async () => {
    document.body.innerHTML = `
      <section id="appScreen" class="app hidden"></section>
      <div id="pessoasOnlineApp"></div>
      <i id="fullscreenActionIcon"></i>`;
    const { sessaoDoApp } = await import("../../src/app/sessao.js");
    const ligar = vi.spyOn(sessaoDoApp, "ligarSistema");
    const sistema = await import("../../src/app/sistema.js");
    await act(async () => sistema.ligarSistema());

    for (const nome of [
      "getMonitoraProfile",
      "getMonitoraUser",
      "monitoraToast",
      "monitoraLoader",
      "exitExternalPanel",
      "exportPDF",
      "navigate",
      "refreshData",
      "reloadExternal",
      "toggleBrowserFullscreen",
      "toggleDarkMode",
      "toggleSidebar",
    ])
      expect(typeof window[nome], nome).toBe("function");
    expect(window.navigate).toBe(sistema.navegacao.irPara);
    expect(window.getMonitoraProfile()).toBeNull();

    const ganchos = ligar.mock.calls[0][0];
    expect(Object.keys(ganchos).sort()).toEqual(
      [
        "abrir",
        "antesDeSair",
        "aoAtualizarPerfil",
        "aoFicarSemAcesso",
        "aoLimparSessao",
        "aoSair",
        "aoVerificar",
        "carregarConfiguracao",
        "encerrarEspera",
        "mostrarEsqueleto",
      ].sort(),
    );

    // Pessoas online montou no cabeçalho, escondido até a primeira batida.
    expect(document.getElementById("onlinePresence").classList).toContain(
      "hidden",
    );

    // Sair esconde o app e limpa o que era da pessoa.
    document.getElementById("appScreen").classList.remove("hidden");
    await act(async () => ganchos.aoSair());
    expect(document.getElementById("appScreen").classList).toContain("hidden");
  });

  it("a busca global sem linha carregada não navega", async () => {
    const sistema = await import("../../src/app/sistema.js");
    const ir = vi.spyOn(sistema.navegacao, "irPara");
    sistema.localizarLinhaDoMonitoramento("999");
    expect(ir).not.toHaveBeenCalled();
  });
});
