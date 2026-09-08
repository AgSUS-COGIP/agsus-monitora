import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function arquivosJs(raiz) {
  const achados = [];
  for (const nome of readdirSync(raiz)) {
    const caminho = join(raiz, nome);
    if (statSync(caminho).isDirectory()) achados.push(...arquivosJs(caminho));
    else if (nome.endsWith(".js")) achados.push(caminho);
  }
  return achados;
}

/*
  A regra que este arquivo protege: existe **um** cliente Supabase de verdade em
  todo o frontend, criado em `src/lib/supabaseClient.js`. Tudo mais — inclusive a
  ponte `window.supabase` que o código legado usa — resolve para essa instância.

  Dois clientes reais na mesma página significam dois `GoTrueClient` disputando a
  mesma chave de armazenamento, dois relógios de renovação de token e dois
  verificadores PKCE. Foi assim que nasceu boa parte da falsa "Sessão expirada".

  Estes testes falham se alguém "consertar" um problema criando outro cliente.
*/
describe("um único cliente Supabase", () => {
  it("só `lib/supabaseClient.js` importa createClient da biblioteca", () => {
    const culpados = arquivosJs("src").filter((caminho) => {
      const fonte = readFileSync(caminho, "utf8");
      return /import\s*\{[^}]*\bcreateClient\b[^}]*\}\s*from\s*["']@supabase\/supabase-js["']/.test(
        fonte,
      );
    });
    expect(culpados).toEqual([join("src", "lib", "supabaseClient.js")]);
  });

  it("nenhum módulo importa o pacote direto para montar cliente próprio", () => {
    const culpados = arquivosJs("src").filter((caminho) => {
      if (caminho.endsWith(join("lib", "supabaseClient.js"))) return false;
      const fonte = readFileSync(caminho, "utf8");
      return (
        /from\s*["']@supabase\/supabase-js["']/.test(fonte) &&
        /createClient\s*\(/.test(fonte)
      );
    });
    expect(culpados).toEqual([]);
  });

  it("a chave de armazenamento é declarada uma única vez", () => {
    const declaracoes = arquivosJs("src").filter((caminho) =>
      /SUPABASE_AUTH_STORAGE_KEY\s*=/.test(readFileSync(caminho, "utf8")),
    );
    expect(declaracoes).toEqual([join("src", "lib", "env.js")]);
  });
});

describe("a instância compartilhada", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://exemplo.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "chave-de-teste");
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("devolve sempre o mesmo objeto", async () => {
    const { getSupabaseClient } = await import("../src/lib/supabaseClient.js");
    const primeiro = getSupabaseClient();
    const segundo = getSupabaseClient();
    expect(primeiro).not.toBeNull();
    expect(primeiro).toBe(segundo);
  });

  it("a ponte legada resolve para a mesma instância, não para uma nova", async () => {
    const { getSupabaseClient } = await import("../src/lib/supabaseClient.js");
    const { createSupabaseLegacyFacade } =
      await import("../src/lib/supabase-legacy-bridge.js");
    const fachada = createSupabaseLegacyFacade();
    expect(fachada.createClient()).toBe(getSupabaseClient());
    expect(fachada.createClient().auth).toBe(getSupabaseClient().auth);
  });

  it("usa a chave de armazenamento única e o fluxo PKCE", async () => {
    const { getSupabaseClient } = await import("../src/lib/supabaseClient.js");
    const { SUPABASE_AUTH_STORAGE_KEY } = await import("../src/lib/env.js");
    const cliente = getSupabaseClient();
    expect(SUPABASE_AUTH_STORAGE_KEY).toBe("agsus-monitora-auth");
    expect(cliente.auth.storageKey).toBe(SUPABASE_AUTH_STORAGE_KEY);
    expect(cliente.auth.flowType).toBe("pkce");
  });
});
