import { installCsvBlobSecurityGuard } from "../lib/csv-security.js";
import { updateAraraGuide } from "../modules/arara-guide.js";
import { initAraraSpeakingEffects } from "../modules/arara-speaking-effects.js";
import "../styles/tokens.css";
import "../styles/icones-lucide.css";
import "../styles/arara-guide.css";
import { installSessionLifecycle } from "../lib/session-lifecycle.js";
import { installBackgroundResourceLifecycle } from "../lib/background-resource-lifecycle.js";
import { installFrontendPerformanceMonitor } from "../lib/frontend-performance-monitor.js";
import { installCspReportMonitor } from "../lib/csp-report-monitor.js";
import "../lib/chartjs-global.js";
import "./analises-responsive-fixes.css";
import "./analises-esqueleto.css";
import "./analises-area.js";
import "./analises-loading-feedback.js";
import "./analises-app.js";
import "./analises-filter-layout.js";
import "./analises-infinite-table.js?v=20260724-1";
import "./analises-detail-runtime-fix.js";
import "./analises-operational-enhancements.js";
import "./analises-missing-responsible-filter.js";
import "./analises-interface-refinement.js";
import "./analises-residual-ui-fixes.js";
import "./analises-dark-mode-fix.js";
// Por último: o visual comum dos painéis vem depois de todo o CSS acima (analises-painel.css).
import "./analises-painel.css";

const embeddedInParentApp = window.parent !== window;
if (!embeddedInParentApp) {
  initAraraSpeakingEffects();
  updateAraraGuide(
    "analises",
    "Análises",
    document.getElementById("araraGuideHost"),
  );
}

installCsvBlobSecurityGuard();
if (!embeddedInParentApp) {
  installSessionLifecycle();
}
installBackgroundResourceLifecycle();
installFrontendPerformanceMonitor();
installCspReportMonitor();
