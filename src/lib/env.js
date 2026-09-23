const ENV_SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
const ENV_SUPABASE_KEY = String(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    "",
).trim();

export const SUPABASE_URL = ENV_SUPABASE_URL;
export const SUPABASE_KEY = ENV_SUPABASE_KEY;
export const SUPABASE_AUTH_STORAGE_KEY = "agsus-monitora-auth";

export function hasSupabaseEnv() {
  return Boolean(ENV_SUPABASE_URL && ENV_SUPABASE_KEY);
}

export function assertSupabaseEnv() {
  if (hasSupabaseEnv()) return;
  throw new Error(
    "Configuração do Supabase ausente. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no ambiente de implantação.",
  );
}
