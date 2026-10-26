import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  SUPABASE_AUTH_STORAGE_KEY,
  SUPABASE_KEY,
  SUPABASE_URL,
  hasSupabaseEnv,
} from "./env";
import { createSafeAuthStorage } from "../modules/auth-storage.js";
import {
  EVENTO_TELA_ANTIGA,
  observarRespostasDoBanco,
  type SinalDeTelaAntiga,
} from "./versao-do-sistema.ts";

type ArmazenamentoDaSessao = ReturnType<typeof createSafeAuthStorage>;

let supabaseClient: SupabaseClient | null = null;
let authStorage: ArmazenamentoDaSessao | null = null;

export function getSupabaseAuthStorage(): ArmazenamentoDaSessao {
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
function avisarTelaAntiga(sinal: SinalDeTelaAntiga) {
  if (typeof CustomEvent !== "function") return;
  globalThis.dispatchEvent?.(
    new CustomEvent(EVENTO_TELA_ANTIGA, { detail: sinal }),
  );
}

export function getSupabaseClient(): SupabaseClient | null {
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
        // principal e em auth/callback.ts. Desativar a deteção automática evita
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
  }

  return supabaseClient;
}
