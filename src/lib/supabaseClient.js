import { createClient } from "@supabase/supabase-js";
import {
  SUPABASE_AUTH_STORAGE_KEY,
  SUPABASE_KEY,
  SUPABASE_URL,
  hasSupabaseEnv,
} from "./env.js";
import { createSafeAuthStorage } from "../modules/auth-storage.js";

let supabaseClient = null;
let authStorage = null;

export function getSupabaseAuthStorage() {
  if (!authStorage) {
    authStorage = createSafeAuthStorage(SUPABASE_AUTH_STORAGE_KEY);
  }
  return authStorage;
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
    });
    supabaseClient = decorateSharedClient(supabaseClient);
  }

  return supabaseClient;
}

export function resetSupabaseClientForTests() {
  supabaseClient = null;
  authStorage = null;
}
