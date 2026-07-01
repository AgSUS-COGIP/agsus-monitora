import { createClient } from "@supabase/supabase-js";
import { SUPABASE_AUTH_STORAGE_KEY, SUPABASE_KEY, SUPABASE_URL, hasSupabaseEnv } from "./env.js";
import { createSafeAuthStorage } from "../modules/auth-storage.js";

let supabaseClient = null;
let authStorage = null;

export function getSupabaseAuthStorage() {
  if (!authStorage) {
    authStorage = createSafeAuthStorage(SUPABASE_AUTH_STORAGE_KEY);
  }
  return authStorage;
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
        flowType: "implicit",
        detectSessionInUrl: true
      }
    });
  }

  return supabaseClient;
}

export function resetSupabaseClientForTests() {
  supabaseClient = null;
  authStorage = null;
}
