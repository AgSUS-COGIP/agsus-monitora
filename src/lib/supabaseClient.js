import { createClient } from "@supabase/supabase-js";
import {
  SUPABASE_AUTH_STORAGE_KEY,
  SUPABASE_KEY,
  SUPABASE_URL,
  hasSupabaseEnv,
} from "./env.js";
import { createSafeAuthStorage } from "../modules/auth-storage.js";
import {
  EVENTO_TELA_ANTIGA,
  observarRespostasDoBanco,
} from "./versao-do-sistema.ts";

let supabaseClient = null;
let authStorage = null;

export function getSupabaseAuthStorage() {
  if (!authStorage) {
    authStorage = createSafeAuthStorage(SUPABASE_AUTH_STORAGE_KEY);
  }
  return authStorage;
}

/*
  RPC que falhou como "tela antiga" (src/lib/versao-do-sistema.ts) vira um
  evento: o aviso de versão (src/app/aviso-de-versao.ts) confere se há versão
  nova e pede para atualizar. A resposta segue igual para quem chamou.
*/
function avisarTelaAntiga(sinal) {
  if (typeof CustomEvent !== "function") return;
  globalThis.dispatchEvent?.(
    new CustomEvent(EVENTO_TELA_ANTIGA, { detail: sinal }),
  );
}

function decorateSharedClient(client) {
  const decorate = globalThis.__agsusDecorateOperationalClient;
  return typeof decorate === "function" ? decorate(client) : client;
}

export function getSupabaseClient() {
  if (!hasSupabaseEnv()) return null;

  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        storage: getSupabaseAuthStorage(),
        storageKey: SUPABASE_AUTH_STORAGE_KEY,
        persistSession: true,
        autoRefreshToken: true,
        flowType: "pkce",
        // O AgSUS Monitora trata o parâmetro ?code explicitamente no bootstrap
        // principal e em auth/callback.js. Desativar a deteção automática evita
        // duas tentativas concorrentes de exchangeCodeForSession.
        detectSessionInUrl: false,
      },
      global: {
        fetch: observarRespostasDoBanco(
          (...argumentos) => globalThis.fetch(...argumentos),
          avisarTelaAntiga,
        ),
      },
    });
    supabaseClient = decorateSharedClient(supabaseClient);
  }

  return supabaseClient;
}
