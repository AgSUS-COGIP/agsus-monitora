import { hasSupabaseEnv } from "./lib/env.js";
// Antes de qualquer rede: pinta a tela de acesso com a marca da visita anterior.
import "./lib/access-branding-boot.js";
import { installCsvBlobSecurityGuard } from "./lib/csv-security.js";
import { installSessionLifecycle } from "./lib/session-lifecycle.js";
import { installBackgroundResourceLifecycle } from "./lib/background-resource-lifecycle.js";
import { installFrontendPerformanceMonitor } from "./lib/frontend-performance-monitor.js";
import { installCspReportMonitor } from "./lib/csp-report-monitor.js";
import "./lib/chartjs-global.js";
import "./lib/supabase-legacy-bridge.js";
import "./styles/visual-polish.css";
import "./styles/arara-guide.css";
import "./styles/loading-experience.css";
import "./styles/access-dashboard.css";
import "./styles/health-indigenous.css";
import "./styles/health-map-contrast.css";
import "./styles/health-reference-kpis.css";
import "./styles/health-dashboard-refinements.css";
import "./styles/health-dashboard-interaction-fixes.css";
import "./styles/health-status-details.css";
import "./styles/health-status-details-refinement.css";
import "./styles/health-details-ux.css";
import "./styles/health-details-runtime-fix.css";
import "./styles/config-page.css";
import "./styles/config-governance.css";
import "./styles/nucleo-cronograma.css";
import "./styles/nucleo-cronograma-template-helper.css";
import "./styles/nucleo-cronograma-manual-only.css";
import "./styles/nucleo-operational-enhancements.css";
import "./styles/nucleo-cronograma-tools.css";
import "./styles/mobile-app.css";
import "./styles/mobile-bottom-navigation.css";
import "./styles/mobile-table-cards.css";
import "./styles/pwa-lifecycle.css";
import "./styles/connectivity-status.css";
import "./styles/google-profile-photo.css";
import "./styles/platform-shell.css";
import "./styles/health-map-workspace.css";
import "./styles/health-map-size-tuning.css";
import "./styles/health-map-immersive-workspace.css";
import "./styles/map-base-layer-switcher.css";
import "./styles/system-ui-fixes.css";
import "./styles/nielsen-shell-ux.css";
import "./styles/post-152-regression-fixes.css";
import "./styles/post157-interface-tuning.css";
import "./styles/colapsar-a-sidebar.css";
import { installLeafletMapGuard } from "./modules/map-guard.js";
import { installMapBaseLayerSwitcher } from "./modules/map-base-layer-switcher.js";
import { installMapZoomRange } from "./modules/map-zoom-range.js";
import "./modules/monitoramento-operational-transport.js";
import "./modules/legacy-app.js";
import { initLoadingExperience } from "./modules/loading-experience.js";
import { initVisualPolish } from "./modules/visual-polish.js";
import { initHealthIndigenousEnhancements } from "./modules/health-indigenous-enhancements.js";
import { initHealthDashboardRefinementsSafe } from "./modules/health-dashboard-refinements.js";
import { initHealthDashboardInteractionFixes } from "./modules/health-dashboard-interaction-fixes.js";
import { initHealthMapLegendCleanup } from "./modules/health-map-legend-cleanup.js";
import { initHealthMapImmersiveWorkspace } from "./modules/health-map-immersive-workspace.js";
import { initHealthStatusDetails } from "./modules/health-status-details.js";
import { initHealthStatusDetailsRefinement } from "./modules/health-status-details-refinement.js";
import { initHealthDetailsUx } from "./modules/health-details-ux.js";
import { initHealthDetailsRuntimeFix } from "./modules/health-details-runtime-fix.js";
import { initSidebarBranding } from "./modules/sidebar-branding.js";
import { initAraraSpeakingEffects } from "./modules/arara-speaking-effects.js";
import { aplicarLegendaDoMapaDetalhado } from "./modules/vinculos-territoriais.js";
import { instalarAvisoDoPainelDeAcesso } from "./modules/aviso-de-contraste.js";
import {
  organizarConfiguracoesEmSecoes,
  removerNavegadorAntigo,
} from "./modules/config-secoes.js";
import { initConfigPageEnhancements } from "./modules/config-page-enhancements.js";
import { initConfigGovernance } from "./modules/config-governance.js";
import { initNucleoCronograma } from "./modules/nucleo-cronograma.js";
import { initNucleoEditorSafe } from "./modules/nucleo-editor.js";
import { initNucleoOperationalSafe } from "./modules/nucleo-operational.js";
import { initNucleoCronogramaTools } from "./modules/nucleo-cronograma-tools.js";
import { initNucleoCronogramaOpenHook } from "./modules/nucleo-cronograma-open-hook.js";
import { initMobileAppExperience } from "./modules/mobile-app-experience.js";
import { initMobileBottomNavigation } from "./modules/mobile-bottom-navigation.js";
import { initMobileTableCards } from "./modules/mobile-table-cards.js";
import { initPwaLifecycle } from "./modules/pwa-lifecycle.js";
import { initConnectivityStatus } from "./modules/connectivity-status.js";
import { initGoogleProfilePhoto } from "./modules/google-profile-photo.js";
import { initNielsenShellUx } from "./modules/nielsen-shell-ux.js";
import { initColapsarDaSidebar } from "./modules/colapsar-a-sidebar.js";

installCsvBlobSecurityGuard();
installLeafletMapGuard();
installMapBaseLayerSwitcher();
installMapZoomRange();
installSessionLifecycle();
installBackgroundResourceLifecycle();
installFrontendPerformanceMonitor();
installCspReportMonitor();
initLoadingExperience();
initVisualPolish();
initAraraSpeakingEffects();
initHealthIndigenousEnhancements();
initHealthDashboardRefinementsSafe();
initHealthDashboardInteractionFixes();
initHealthMapLegendCleanup();
initHealthMapImmersiveWorkspace();
initHealthStatusDetails();
aplicarLegendaDoMapaDetalhado();
instalarAvisoDoPainelDeAcesso();
initHealthStatusDetailsRefinement();
initHealthDetailsUx();
initHealthDetailsRuntimeFix();
// Instala antes do guard de Configurações para que o botão global salve também
// as duas chaves independentes da sidebar usando a RPC existente.
initSidebarBranding();
/*
  Depois da sidebar: ela injeta os proprios campos em Configuracoes, e so
  existe o que organizar quando eles ja estao no DOM.
*/
organizarConfiguracoesEmSecoes();
initConfigPageEnhancements();
initConfigGovernance();
removerNavegadorAntigo();
initNucleoCronograma();
initNucleoEditorSafe();
initNucleoOperationalSafe();
initNucleoCronogramaTools();
initNucleoCronogramaOpenHook();
initMobileAppExperience();
initMobileBottomNavigation();
initMobileTableCards();
initPwaLifecycle();
initConnectivityStatus();
initGoogleProfilePhoto();
initNielsenShellUx();
initColapsarDaSidebar();

if (!hasSupabaseEnv()) {
  console.warn(
    "Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no Vercel.",
  );
}
