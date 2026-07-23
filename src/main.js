import { hasSupabaseEnv } from "./lib/env.js";
import "./styles/visual-polish.css";
import "./styles/access-dashboard.css";
import "./styles/health-indigenous.css";
import "./styles/health-map-contrast.css";
import "./styles/health-reference-kpis.css";
import "./styles/health-dashboard-refinements.css";
import "./styles/config-page.css";
import "./styles/config-governance.css";
import "./styles/nucleo-cronograma.css";
import "./styles/nucleo-cronograma-template-helper.css";
import "./styles/nucleo-cronograma-manual-only.css";
import "./styles/nucleo-operational-enhancements.css";
import "./styles/nucleo-cronograma-tools.css";
import { installLeafletMapGuard } from "./modules/map-guard.js";
import "./modules/monitoramento-operational-transport.js";
import "./modules/legacy-app.js";
import { initVisualPolish } from "./modules/visual-polish.js";
import { initHealthIndigenousEnhancements } from "./modules/health-indigenous-enhancements.js";
import { initHealthDashboardRefinementsSafe } from "./modules/health-dashboard-refinements-safe.js";
import { initHealthMapLegendCleanup } from "./modules/health-map-legend-cleanup.js";
import { initConfigPageEnhancements } from "./modules/config-page-enhancements.js";
import { installConfigGovernanceAuthShim } from "./modules/config-governance-auth-shim.js";
import { initConfigGovernance } from "./modules/config-governance.js";
import { initNucleoCronograma } from "./modules/nucleo-cronograma.js";
import { initNucleoEditorSafe } from "./modules/nucleo-editor-safe.js";
import { initNucleoOperationalSafe } from "./modules/nucleo-operational-safe.js";
import { initNucleoCronogramaTools } from "./modules/nucleo-cronograma-tools.js";
import { initNucleoCronogramaOpenHook } from "./modules/nucleo-cronograma-open-hook.js";
import { initNucleoInitialRefresh } from "./modules/nucleo-initial-refresh.js";

installLeafletMapGuard();
initVisualPolish();
initHealthIndigenousEnhancements();
initHealthDashboardRefinementsSafe();
initHealthMapLegendCleanup();
initConfigPageEnhancements();
installConfigGovernanceAuthShim();
initConfigGovernance();
initNucleoCronograma();
initNucleoEditorSafe();
initNucleoOperationalSafe();
initNucleoCronogramaTools();
initNucleoCronogramaOpenHook();
initNucleoInitialRefresh();

if (!hasSupabaseEnv()) {
  console.warn("Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no Vercel.");
}
