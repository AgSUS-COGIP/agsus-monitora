/// <reference types="vite/client" />

const ENV_SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
const ENV_SUPABASE_KEY = String(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    "",
).trim();

export const SUPABASE_URL: string = ENV_SUPABASE_URL;
export const SUPABASE_KEY: string = ENV_SUPABASE_KEY;
export const SUPABASE_AUTH_STORAGE_KEY = "agsus-monitora-auth";

export function hasSupabaseEnv(): boolean {
  return Boolean(ENV_SUPABASE_URL && ENV_SUPABASE_KEY);
}
