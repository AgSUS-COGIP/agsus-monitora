import { hasSupabaseEnv } from "./lib/env.js";
import "./styles/visual-polish.css";
import "./styles/access-dashboard.css";
import { installLeafletMapGuard } from "./modules/map-guard.js";
import "./modules/legacy-app.js";
import { initVisualPolish } from "./modules/visual-polish.js";

installLeafletMapGuard();
initVisualPolish();

if (!hasSupabaseEnv()) {
  console.warn("Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no Vercel.");
}
