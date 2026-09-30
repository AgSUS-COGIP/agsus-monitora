/*
  Painel de seleção (`selecao.html`): o bootstrap, como o do painel de
  recursos (src/recursos/main.jsx). O desenho é o do painel de análises —
  selecao.html carrega os mesmos arquivos de src/analises/ e aqui entram,
  na mesma ordem, os que o main de análises importa. Por cima, só
  selecao.css, com o que é só da seleção.

  A área vem de `?area=`; a sessão é a do Supabase Auth guardada no
  navegador, a mesma do MONITORA.
*/
import { installCsvBlobSecurityGuard } from "../lib/csv-security.js";
import "../styles/tokens.css";
import "../styles/icones-lucide.css";
import { installSessionLifecycle } from "../lib/session-lifecycle.js";
import { installBackgroundResourceLifecycle } from "../lib/background-resource-lifecycle.js";
import { installFrontendPerformanceMonitor } from "../lib/frontend-performance-monitor.js";
import { installCspReportMonitor } from "../lib/csp-report-monitor.js";
import "../lib/chartjs-global.js";
import "../analises/analises-responsive-fixes.css";
import "../analises/analises-esqueleto.css";
import "../analises/analises-infinite-table.css";
import "../analises/analises-painel.css";
import "../styles/multi-select-busca.css";
import "./selecao.css";
import { compactarCronometroDaSessao } from "../analises/cronometro-da-sessao.js";
import {
  areaDaUrlDoPainel,
  rotuloDaAreaDoPainel,
} from "../lib/area-do-painel-de-analises.js";
import { getSupabaseClient } from "../lib/supabaseClient.js";
import { aplicarTemaSalvoDoPainel } from "../lib/tema-do-painel.js";
import { montarPainelDeSelecao } from "../componentes/selecao/selecao.jsx";

const area = areaDaUrlDoPainel(window.location.search);
const nomeDaArea = rotuloDaAreaDoPainel(area);
document.title = `Painel de seleção · ${nomeDaArea} — MONITORA`;
document.documentElement.dataset.areaDoPainel = area;
aplicarTemaSalvoDoPainel();

montarPainelDeSelecao({
  supabase: getSupabaseClient(),
  area,
  nomeDaArea,
});

const embeddedInParentApp = window.parent !== window;
installCsvBlobSecurityGuard();
if (!embeddedInParentApp) {
  installSessionLifecycle();
  compactarCronometroDaSessao();
}
installBackgroundResourceLifecycle();
installFrontendPerformanceMonitor();
installCspReportMonitor();
