export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://gnudtaxhjfgtvwkwpsel.supabase.co";
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_7uDcRD6KoroXlyHBp2K4rA_Ex242hpI";
export const SUPABASE_AUTH_STORAGE_KEY = "agsus-monitora-auth";

export function hasSupabaseEnv() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}
