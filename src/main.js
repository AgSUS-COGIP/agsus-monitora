import { hasSupabaseEnv } from "./lib/env.js";
// Antes de qualquer rede: pinta a tela de acesso com a marca da visita anterior.
import "./app/entrada/marca.js";
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
import "./styles/loading-experience.css";
import "./styles/config-page.css";
import "./styles/config-governance.css";
import "./styles/mobile-app.css";
import "./styles/mobile-bottom-navigation.css";
import "./styles/mobile-table-cards.css";
import "./styles/connectivity-status.css";
import "./styles/google-profile-photo.css";
import "./styles/platform-shell.css";
import "./styles/map-base-layer-switcher.css";
import "./styles/indigenous-territories-layer.css";
import "./styles/system-ui-fixes.css";
import "./styles/nielsen-shell-ux.css";
import "./styles/post-152-regression-fixes.css";
import "./styles/post157-interface-tuning.css";
import "./styles/barra-lateral.css";
import "./styles/multi-select-busca.css";
import "./styles/carregamento.css";
import "./styles/acessos.css";
import "./styles/modulos-e-manutencao.css";
import "./styles/saude-das-cargas.css";
import "./styles/config-apresentacao.css";
import "./styles/configuracoes.css";
// Componentes de src/ui/ e, depois, o CSS próprio de cada módulo de src/modulos/.
import "./ui/ui.css";
import "./modulos/editais/editais.css";
import "./modulos/cronograma/cronograma.css";
import "./modulos/aprovados/aprovados.css";
import "./modulos/aprovados/convocacao.css";
import "./modulos/recursos/recursos.css";
import "./modulos/entrevistas/entrevistas.css";
import "./modulos/selecao/selecao.css";
import "./modulos/classificacao/classificacao.css";
import "./modulos/visao-geral/visao-geral.css";
import "./modulos/aya/aya.css";
import "./modulos/aya/tour/tour.css";
import "./modulos/mapa-saude-indigena/mapa-saude-indigena.css";
import "./modulos/mapa-de-projetos/mapa-de-projetos.css";
import { installLeafletMapGuard } from "./modules/map-guard.js";
import { installMapBaseLayerSwitcher } from "./modules/map-base-layer-switcher.js";
import { installMapZoomRange } from "./modules/map-zoom-range.js";
import { installIndigenousTerritoriesLayer } from "./modules/indigenous-territories-layer.js";
import "./modules/monitoramento-operational-transport.js";
import "./modules/legacy-app.js";
import { initLoadingExperience } from "./modules/loading-experience.js";
import { instalarCarregamento } from "./modules/carregamento.js";
import { initVisualPolish } from "./modules/visual-polish.js";
import { initSidebarBranding } from "./modules/sidebar-branding.js";
import {
  organizarConfiguracoesEmSecoes,
  SECOES,
} from "./modules/config-secoes.js";
import { montarConfiguracoes } from "./componentes/configuracoes/configuracoes.jsx";
import { initMobileAppExperience } from "./modules/mobile-app-experience.js";
import { initMobileBottomNavigation } from "./modules/mobile-bottom-navigation.js";
import { initMobileTableCards } from "./modules/mobile-table-cards.js";
import { initPwaLifecycle } from "./modules/pwa-lifecycle.js";
import { initConnectivityStatus } from "./modules/connectivity-status.js";
import { initGoogleProfilePhoto } from "./modules/google-profile-photo.js";
import { initNielsenShellUx } from "./modules/nielsen-shell-ux.js";
import { montarBarraLateral } from "./componentes/barra-lateral/barra-lateral.jsx";
import { montarListaAprovados } from "./modulos/aprovados/lista-aprovados.jsx";
import { montarCalendarioEditais } from "./modulos/cronograma/calendario-editais.jsx";
import { montarNucleo } from "./modulos/editais/nucleo.jsx";
import { montarRecursos } from "./modulos/recursos/recursos.jsx";
import { montarEntrevistas } from "./modulos/entrevistas/entrevistas.jsx";
import { montarAnalises } from "./modulos/analises/analises.jsx";
import { montarSelecao } from "./modulos/selecao/selecao.jsx";
import { montarClassificacao } from "./modulos/classificacao/classificacao.jsx";
import { montarVisaoGeral } from "./modulos/visao-geral/visao-geral.jsx";
import { situacaoDoSistema } from "./modules/situacao-dos-modulos.js";
import { montarAcessos } from "./componentes/acessos/acessos.jsx";
import { montarModulos } from "./componentes/modulos/modulos.jsx";
import { montarSaudeDasCargas } from "./componentes/saude-das-cargas/saude-das-cargas.jsx";
import { montarBuscaGlobal } from "./componentes/busca-global/busca-global.jsx";
import { montarEntrada } from "./app/entrada/entrada.jsx";
import { sessaoDoApp } from "./app/sessao.js";

import { montarAya } from "./modulos/aya/aya.jsx";

// Os imports de CSS acima já rodaram: a tela de acesso pode aparecer (index.html, `vite-dev-carregando`).
document.documentElement.classList.remove("vite-dev-carregando");

/*
  A tela de acesso (React, src/app/entrada/) monta primeiro: o cartão vazio do
  index.html vira o de verdade. Quem entra é a sessão (src/app/sessao.js),
  iniciada no fim, depois de o legado e as telas se ligarem a ela.
*/
montarEntrada();

installCsvBlobSecurityGuard();
installLeafletMapGuard();
installMapBaseLayerSwitcher();
installMapZoomRange();
installIndigenousTerritoriesLayer();
installSessionLifecycle({
  aoExpirar: (mensagem) => sessaoDoApp.mostrarMensagem(mensagem, "warn"),
});
installBackgroundResourceLifecycle();
installFrontendPerformanceMonitor();
installCspReportMonitor();
/*
  A barra lateral é React e monta primeiro, de forma síncrona: o branding, o
  legado e o menu do celular a encontram no DOM quando rodam.
*/
montarBarraLateral();
/*
  A Visão geral (React, src/modulos/visao-geral/, com os mapas da Saúde
  Indígena e de Projetos) também monta já, de forma síncrona. O legado fala
  com ela pelo estado (estado.js), não pelo DOM.
*/
window.visaoGeralController = montarVisaoGeral({
  toast: window.monitoraToast,
  comemoracoesLigadas: () => situacaoDoSistema().comemoracoes === true,
});
instalarCarregamento();
initLoadingExperience();
initVisualPolish();
// A logo e a cor gravadas da barra lateral (a escolha é de Configurações › Aparência).
initSidebarBranding();
// O esqueleto das seções de Configurações, depois a moldura e as seções em React (portais).
organizarConfiguracoesEmSecoes();
montarConfiguracoes();
initMobileAppExperience();
initMobileBottomNavigation();
initMobileTableCards();
initPwaLifecycle();
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

/*
  Recursos dos candidatos: módulo de src/modulos/, na própria <section>. A
  área é a atual do app; `render()` recarrega a cada abertura (permissões do
  banco e comemorações relidas).
*/
window.recursosController = montarRecursos({
  toast: window.monitoraToast,
  comemoracoesLigadas: () => situacaoDoSistema().comemoracoes === true,
});

/*
  Entrevistas: módulo de src/modulos/, na própria <section>, como Recursos
  (área do app, render() a cada abertura, comemorações relidas).
*/
window.entrevistasController = montarEntrevistas({
  toast: window.monitoraToast,
  comemoracoesLigadas: () => situacaoDoSistema().comemoracoes === true,
});

/*
  Análises curriculares: módulo de src/modulos/, na própria <section>. A área
  é a atual do app; `render()` carrega na primeira abertura (e relê por trás
  se a carga tiver mais de 5 minutos).
*/
window.analisesController = montarAnalises({
  toast: window.monitoraToast,
  comemoracoesLigadas: () => situacaoDoSistema().comemoracoes === true,
});

/*
  Seleção: módulo de src/modulos/, na própria <section>, como Recursos e
  Entrevistas (área do app, render() a cada abertura). Só leitura.
*/
window.selecaoController = montarSelecao({ toast: window.monitoraToast });

/*
  Classificação: módulo de src/modulos/, na própria <section> (área do app,
  render() a cada abertura). A regra é de cada edital; a conta, do motor puro
  (src/lib/classificacao/).
*/
window.classificacaoController = montarClassificacao({
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
  estaConectado: () => Boolean(sessaoDoApp.obter().usuario),
});

// A entrada: sessão guardada, retorno do Google ou a tela de acesso.
void sessaoDoApp.iniciar();

/*
  A Aya (src/modulos/aya/): a arara flutuante e o painel de conversa. Sabe a
  página pelo estado que o legado atualiza a cada navegação (setPageTitle →
  definirPaginaDaAya) e a área pelo estado do monitoramento.
*/
montarAya();

if (!hasSupabaseEnv()) {
  console.warn(
    "Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no Vercel.",
  );
}
