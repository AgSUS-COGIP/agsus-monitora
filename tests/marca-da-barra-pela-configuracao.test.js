import { beforeEach, describe, expect, it } from "vitest";
import { aplicarMarcaDaConfiguracao } from "../src/modules/sidebar-branding.js";

/*
  A logo e a cor da barra lateral vêm da leitura da configuração que o app já
  faz (src/app/configuracao.ts), não de uma consulta própria a cada SIGNED_IN.
*/

beforeEach(() => {
  document.body.innerHTML = '<img id="sideLogo" src="" alt="" />';
  document.documentElement.style.removeProperty("--sidebar-custom-bg");
});

describe("aplicarMarcaDaConfiguracao", () => {
  it("pinta com a cor e a logo da configuração", () => {
    expect(
      aplicarMarcaDaConfiguracao({ ui_sidebar_background_color: "#0b3d2e" }),
    ).toBe(true);
    expect(
      document.documentElement.style.getPropertyValue("--sidebar-custom-bg"),
    ).toBe("#0b3d2e");
    expect(document.body.classList.contains("sidebar-theme-dark")).toBe(true);
  });

  it("leitura sem as chaves (tela de acesso, sem sessão) não mexe no que está pintado", () => {
    expect(aplicarMarcaDaConfiguracao({ footer_text: "x" })).toBe(false);
    expect(aplicarMarcaDaConfiguracao(null)).toBe(false);
    expect(
      document.documentElement.style.getPropertyValue("--sidebar-custom-bg"),
    ).toBe("");
  });
});
