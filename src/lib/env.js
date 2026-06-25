export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "";
export const SUPABASE_AUTH_STORAGE_KEY = "agsus-monitora-auth";

export function hasSupabaseEnv() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}
