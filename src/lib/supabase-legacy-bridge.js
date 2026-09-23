import { getSupabaseClient } from "./supabaseClient.js";

const BRIDGE_MARKER = "__agsusSharedClientBridge";

export function createSupabaseLegacyFacade(resolveClient = getSupabaseClient) {
  const facade = {
    createClient() {
      const client = resolveClient();
      if (!client) {
        throw new Error(
          "Supabase indisponível. Verifique as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.",
        );
      }
      return client;
    },
  };

  Object.defineProperty(facade, BRIDGE_MARKER, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  // A fachada precisa continuar extensível durante a migração. Os transportes
  // legados decoram createClient e adicionam marcadores próprios, mas todas as
  // chamadas continuam resolvendo a mesma instância singleton.
  return facade;
}

export function installSupabaseLegacyBridge(
  target = globalThis,
  resolveClient = getSupabaseClient,
) {
  if (!target) return null;
  if (target.supabase?.[BRIDGE_MARKER]) return target.supabase;

  const facade = createSupabaseLegacyFacade(resolveClient);

  try {
    Object.defineProperty(target, "supabase", {
      value: facade,
      enumerable: true,
      configurable: true,
      writable: false,
    });
  } catch (_) {
    target.supabase = facade;
  }

  return facade;
}

if (typeof window !== "undefined") {
  installSupabaseLegacyBridge(window);
}
