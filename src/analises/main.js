import { installCsvBlobSecurityGuard } from "../lib/csv-security.js";
import { updateAraraGuide } from "../modules/arara-guide.js";
import { initAraraSpeakingEffects } from "../modules/arara-speaking-effects.js";
import "../styles/tokens.css";
import "../styles/arara-guide.css";
import { installSessionLifecycle } from "../lib/session-lifecycle.js";
import { installBackgroundResourceLifecycle } from "../lib/background-resource-lifecycle.js";
import { installFrontendPerformanceMonitor } from "../lib/frontend-performance-monitor.js";
import { installCspReportMonitor } from "../lib/csp-report-monitor.js";
import "../lib/chartjs-global.js";
import "../lib/supabase-legacy-bridge.js";
import "./analises-responsive-fixes.css";
import "./analises-active-cache-recovery.js";
import "./analises-consolidated-transport.js";
import "./analises-scope-guard.js";
import "./analises-scope-runtime-integration.js";
import "./analises-shared-client-bootstrap.js";
import "./analises-modern-selects.js";
import "./analises-runtime-stability.js";
import "./analises-loading-feedback.js";
import "./analises-app.js";
import "./analises-filter-layout.js";
import "./analises-infinite-table.js?v=20260724-1";
import "./analises-detail-drawer-controller.js";
import "./analises-detail-runtime-fix.js";
import "./analises-operational-enhancements.js";
import "./analises-missing-responsible-filter.js";
import "./analises-interface-refinement.js";
import "./analises-residual-ui-fixes.js";
import "./analises-dark-mode-fix.js";

function compactAnalisesSessionTimer() {
  const timer = document.getElementById("agsusSessionTimer");
  const footerMeta = document.querySelector(".footer > span:last-child");
  if (!timer || !footerMeta) return;

  timer.classList.add("analises-session-compact");
  timer.setAttribute("aria-label", "Tempo restante da sessão");
  timer.title = "Tempo restante até o encerramento da sessão por inatividade.";

  if (timer.parentElement !== footerMeta) {
    footerMeta.prepend(timer);
  }
}

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
  compactAnalisesSessionTimer();
}
installBackgroundResourceLifecycle();
installFrontendPerformanceMonitor();
installCspReportMonitor();
