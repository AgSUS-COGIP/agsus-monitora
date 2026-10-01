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
import "./styles/tokens.css";
import "./styles/icones-lucide.css";
import "./styles/visual-polish.css";
import "./styles/arara-guide.css";
import "./styles/nina-conversation.css";
import "./styles/loading-experience.css";
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
import "./styles/calendario-editais.css";
import "./styles/nucleo-cronograma-template-helper.css";
import "./styles/nucleo-cronograma-manual-only.css";
import "./styles/nucleo-operational-enhancements.css";
import "./styles/nucleo-cronograma-tools.css";
import "./styles/mobile-app.css";
import "./styles/mobile-bottom-navigation.css";
import "./styles/mobile-table-cards.css";
import "./styles/connectivity-status.css";
import "./styles/google-profile-photo.css";
import "./styles/platform-shell.css";
import "./styles/health-map-workspace.css";
import "./styles/health-map-size-tuning.css";
import "./styles/health-map-immersive-workspace.css";
import "./styles/map-base-layer-switcher.css";
import "./styles/indigenous-territories-layer.css";
import "./styles/legenda-das-terras.css";
import "./styles/system-ui-fixes.css";
import "./styles/nielsen-shell-ux.css";
import "./styles/post-152-regression-fixes.css";
import "./styles/post157-interface-tuning.css";
import "./styles/barra-lateral.css";
import "./styles/lista-aprovados.css";
import "./styles/lista-convocacao.css";
import "./styles/multi-select-busca.css";
import "./styles/carregamento.css";
import "./styles/acessos.css";
import "./styles/modulos-e-manutencao.css";
import "./styles/saude-das-cargas.css";
import "./styles/config-apresentacao.css";
import "./styles/configuracoes.css";
import { installLeafletMapGuard } from "./modules/map-guard.js";
import { installMapBaseLayerSwitcher } from "./modules/map-base-layer-switcher.js";
import { installMapZoomRange } from "./modules/map-zoom-range.js";
import { installIndigenousTerritoriesLayer } from "./modules/indigenous-territories-layer.js";
import "./modules/monitoramento-operational-transport.js";
import "./modules/lotacoes-geograficas-transport.js";
import "./modules/legacy-app.js";
import { initLoadingExperience } from "./modules/loading-experience.js";
import { instalarCarregamento } from "./modules/carregamento.js";
import { initVisualPolish } from "./modules/visual-polish.js";
import { initHealthDashboardRefinementsSafe } from "./modules/health-dashboard-refinements.js";
import { initHealthDashboardInteractionFixes } from "./modules/health-dashboard-interaction-fixes.js";
import { initHealthMapImmersiveWorkspace } from "./modules/health-map-immersive-workspace.js";
import { initHealthStatusDetails } from "./modules/health-status-details.js";
import { initHealthStatusDetailsRefinement } from "./modules/health-status-details-refinement.js";
import { initHealthDetailsUx } from "./modules/health-details-ux.js";
import { initHealthDetailsRuntimeFix } from "./modules/health-details-runtime-fix.js";
import { initSidebarBranding } from "./modules/sidebar-branding.js";
import { initAraraSpeakingEffects } from "./modules/arara-speaking-effects.js";
import { initNinaPanelDrag } from "./modules/nina-panel-drag.js";
import { aplicarLegendaDoMapaDetalhado } from "./modules/vinculos-territoriais.js";
import { instalarAvisoDoPainelDeAcesso } from "./modules/aviso-de-contraste.js";
import {
  organizarConfiguracoesEmSecoes,
  SECOES,
} from "./modules/config-secoes.js";
import { instalarApresentacaoDasConfiguracoes } from "./modules/config-apresentacao.js";
import { montarConfiguracoes } from "./componentes/configuracoes/configuracoes.jsx";
import { initMobileAppExperience } from "./modules/mobile-app-experience.js";
import { initMobileBottomNavigation } from "./modules/mobile-bottom-navigation.js";
import { initMobileGoogleOAuth } from "./modules/mobile-google-oauth.js";
import { initMobileTableCards } from "./modules/mobile-table-cards.js";
import { initPwaLifecycle } from "./modules/pwa-lifecycle.js";
import { initConnectivityStatus } from "./modules/connectivity-status.js";
import { initGoogleProfilePhoto } from "./modules/google-profile-photo.js";
import { initNielsenShellUx } from "./modules/nielsen-shell-ux.js";
import { initBoasVindas } from "./modules/boas-vindas.js";
import { initMarcosDoAno } from "./modules/marcos-do-ano.js";
import { montarBarraLateral } from "./componentes/barra-lateral/barra-lateral.jsx";
import { montarListaAprovados } from "./componentes/lista-aprovados/lista-aprovados.jsx";
import { montarCalendarioEditais } from "./componentes/calendario-editais/calendario-editais.jsx";
import { montarNucleo } from "./componentes/nucleo/nucleo.jsx";
import { montarAcessos } from "./componentes/acessos/acessos.jsx";
import { montarModulos } from "./componentes/modulos/modulos.jsx";
import { montarSaudeDasCargas } from "./componentes/saude-das-cargas/saude-das-cargas.jsx";
import { montarBuscaGlobal } from "./componentes/busca-global/busca-global.jsx";

// Os imports de CSS acima já rodaram: a tela de acesso pode aparecer (index.html, `vite-dev-carregando`).
document.documentElement.classList.remove("vite-dev-carregando");

installCsvBlobSecurityGuard();
installLeafletMapGuard();
installMapBaseLayerSwitcher();
installMapZoomRange();
installIndigenousTerritoriesLayer();
installSessionLifecycle();
installBackgroundResourceLifecycle();
installFrontendPerformanceMonitor();
installCspReportMonitor();
/*
  A barra lateral é React e monta primeiro, de forma síncrona: o branding, o
  legado e o menu do celular a encontram no DOM quando rodam.
*/
montarBarraLateral();
instalarCarregamento();
initLoadingExperience();
initVisualPolish();
initAraraSpeakingEffects();
initNinaPanelDrag();
initHealthDashboardRefinementsSafe();
initHealthDashboardInteractionFixes();
initHealthMapImmersiveWorkspace();
initHealthStatusDetails();
aplicarLegendaDoMapaDetalhado();
instalarAvisoDoPainelDeAcesso();
initHealthStatusDetailsRefinement();
initHealthDetailsUx();
initHealthDetailsRuntimeFix();
// Instala antes da moldura de Configurações para que o botão global salve também
// as duas chaves independentes da sidebar usando a RPC existente.
initSidebarBranding();
/*
  Depois da sidebar: ela injeta os proprios campos em Configuracoes, e so
  existe o que organizar quando eles ja estao no DOM.
*/
organizarConfiguracoesEmSecoes();
// Grupos, dicas e prévias das seções legadas (Página inicial, Tela de acesso e Recursos).
instalarApresentacaoDasConfiguracoes();
// A moldura React de Configurações (cabeçalho, salvar, histórico) e a seção Marca.
montarConfiguracoes();
initMobileAppExperience();
initMobileBottomNavigation();
initMobileGoogleOAuth();
initMobileTableCards();
initPwaLifecycle();
initBoasVindas();
initMarcosDoAno();
initConnectivityStatus();
initGoogleProfilePhoto();
initNielsenShellUx();

/*
  Núcleo, Lista de Aprovados e Calendário são React e montam nas próprias
  <section>. O legado as abre por estes controladores (`render()` ao navegar e
  `openImportModal` no Núcleo), nunca pelo DOM delas.
*/
window.nucleoController = montarNucleo({
  toast: window.monitoraToast,
  loader: window.monitoraLoader,
  getProfile: window.getMonitoraProfile,
});

// Sem loader de tela cheia: skeleton na carga, e cada ação mostra o estado no botão.
window.aprovadosController = montarListaAprovados({
  toast: window.monitoraToast,
  getProfile: window.getMonitoraProfile,
});

// Sem loader de tela cheia: a grade mostra "Carregando…" por conta própria.
window.calendarioEditaisController = montarCalendarioEditais({
  toast: window.monitoraToast,
});

// Configurações › Acessos: abre pela seção (config-secoes.js → render()).
window.acessosController = montarAcessos({
  toast: window.monitoraToast,
  getProfile: window.getMonitoraProfile,
  secoesDeConfiguracao: SECOES,
});

// Configurações › Módulos e abas (só admin global): abre pela seção (config-secoes.js → render()).
window.modulosController = montarModulos({
  toast: window.monitoraToast,
  getProfile: window.getMonitoraProfile,
});

// Configurações › Status das atualizações (só admin global): relê a cada abertura da seção.
window.saudeDasCargasController = montarSaudeDasCargas({
  getProfile: window.getMonitoraProfile,
});

/*
  Busca global (Ctrl+K / Cmd+K): só abre com usuário conectado. A escolha vai
  ao legado por evento (filtros e navegação continuam lá).
*/
montarBuscaGlobal({
  estaConectado: () => Boolean(window.getMonitoraUser?.()),
});

if (!hasSupabaseEnv()) {
  console.warn(
    "Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no Vercel.",
  );
}
