import { hasSupabaseEnv } from "./lib/env.js";
import "./styles/visual-polish.css";
import "./modules/legacy-app.js";
import { initVisualPolish } from "./modules/visual-polish.js";

initVisualPolish();

if (!hasSupabaseEnv()) {
  console.warn("Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no Vercel.");
}
