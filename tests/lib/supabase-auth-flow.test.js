import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { callbackResultUrl } from "../../src/auth/callback.js";

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

    expect(callbackHtml).not.toContain("cdn.jsdelivr.net/npm/@supabase/supabase-js");
    expect(callbackSource).toContain('import { getSupabaseClient } from "../lib/supabaseClient.js"');
    expect(callbackSource).not.toContain("window.supabase.createClient");
  });

  it("gera URLs de retorno previsíveis para sucesso e falhas", () => {
    expect(callbackResultUrl("success")).toBe("/?auth=google");
    expect(callbackResultUrl("missing_env")).toBe("/?auth_error=missing_env");
    expect(callbackResultUrl("missing_code")).toBe("/?auth_error=missing_code");
    expect(callbackResultUrl("supabase_unavailable")).toBe("/?auth_error=supabase_unavailable");
    expect(callbackResultUrl("unexpected")).toBe("/?auth_error=oauth_callback");
  });
});
