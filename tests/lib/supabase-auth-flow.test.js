import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { callbackResultUrl } from "../../src/auth/callback.js";
import {
  LOGIN_POPUP_MESSAGE,
  openLoginPopup,
  supportsLoginPopup,
} from "../../src/lib/auth-flow.js";

function source(path) {
  return readFileSync(path, "utf8");
}

describe("fluxo de autenticação Supabase", () => {
  it("mantém o cliente partilhado configurado com PKCE e troca explícita do código", () => {
    const clientSource = source("src/lib/supabaseClient.js");

    expect(clientSource).toContain('flowType: "pkce"');
    expect(clientSource).toContain("detectSessionInUrl: false");
    expect(clientSource).not.toContain('flowType: "implicit"');
  });

  it("mantém o callback independente do CDN e do global window.supabase", () => {
    const callbackHtml = source("auth/callback.html");
    const callbackSource = source("src/auth/callback.js");

    expect(callbackHtml).not.toContain(
      "cdn.jsdelivr.net/npm/@supabase/supabase-js",
    );
    expect(callbackSource).toContain(
      'import { getSupabaseClient } from "../lib/supabaseClient.js"',
    );
    expect(callbackSource).not.toContain("window.supabase.createClient");
  });

  it("gera URLs de retorno previsíveis para sucesso e falhas", () => {
    expect(callbackResultUrl("success")).toBe("/?auth=google");
    expect(callbackResultUrl("missing_env")).toBe("/?auth_error=missing_env");
    expect(callbackResultUrl("missing_code")).toBe("/?auth_error=missing_code");
    expect(callbackResultUrl("supabase_unavailable")).toBe(
      "/?auth_error=supabase_unavailable",
    );
    expect(callbackResultUrl("unexpected")).toBe("/?auth_error=oauth_callback");
  });

  it("abre o Google em uma janela centralizada no desktop, como o SIGAV", () => {
    let opened = null;
    const windowRef = {
      innerWidth: 1440,
      outerWidth: 1440,
      outerHeight: 900,
      screenX: 40,
      screenY: 20,
      open: (...args) => {
        opened = args;
        return { closed: false };
      },
    };

    expect(supportsLoginPopup(windowRef)).toBe(true);
    expect(openLoginPopup(windowRef)).toEqual({ closed: false });
    expect(opened?.[0]).toBe("about:blank");
    expect(opened?.[1]).toBe("agsus-monitora-login");
    expect(opened?.[2]).toContain("width=520");
    expect(LOGIN_POPUP_MESSAGE).toBe("agsus-monitora:login-concluido");
  });

  it("preserva o redirecionamento tradicional em telas pequenas", () => {
    expect(supportsLoginPopup({ innerWidth: 600, open() {} })).toBe(false);
    expect(openLoginPopup({ innerWidth: 600, open() {} })).toBeNull();
  });

  it("mantém o cabeçalho sem horário e a barra sem identificação repetida", () => {
    const html = source("index.html");
    expect(html).not.toContain('id="updatedPill"');
    expect(html).not.toContain("Agência Brasileira de Apoio à Gestão do SUS");
    expect(html).toContain('class="fa-solid fa-bars"');
    expect(html).toContain('id="topUserMenu"');
  });
});
