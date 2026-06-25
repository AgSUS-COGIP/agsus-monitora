import { hasSupabaseEnv } from "./lib/env.js";
import "./modules/legacy-app.js";

if (!hasSupabaseEnv()) {
  console.warn("Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no Vercel.");
}
