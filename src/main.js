import { hasSupabaseEnv } from "./lib/env.js";
import "./styles/visual-polish.css";
import "./styles/access-dashboard.css";
import "./styles/health-indigenous.css";
import "./styles/health-map-contrast.css";
import "./styles/health-reference-kpis.css";
import "./styles/config-page.css";
import "./styles/config-governance.css";
import { installLeafletMapGuard } from "./modules/map-guard.js";
import "./modules/legacy-app.js";
import { initVisualPolish } from "./modules/visual-polish.js";
import { initHealthIndigenousEnhancements } from "./modules/health-indigenous-enhancements.js";
import { initConfigPageEnhancements } from "./modules/config-page-enhancements.js";
import { installConfigGovernanceAuthShim } from "./modules/config-governance-auth-shim.js";
import { initConfigGovernance } from "./modules/config-governance.js";

installLeafletMapGuard();
initVisualPolish();
initHealthIndigenousEnhancements();
initConfigPageEnhancements();
installConfigGovernanceAuthShim();
initConfigGovernance();

if (!hasSupabaseEnv()) {
  console.warn("Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no Vercel.");
}
