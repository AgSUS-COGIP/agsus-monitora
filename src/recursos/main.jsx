/*
  Painel de recursos (`recursos.html`): o bootstrap, como o de
  src/analises/main.js. O desenho é o do painel de análises — recursos.html
  carrega os mesmos arquivos de src/analises/ (analises.css e
  analises-layout-modern.css) e aqui entram, na mesma ordem, os que o main de
  análises importa (tokens, ícones, responsivo, skeleton, a fila contínua e o
  visual comum dos painéis, por último). Por cima, só recursos.css, com o que é só de
  recursos (etapas, prazo, formulário).

  A área vem de `?area=` (a mesma regra do painel de análises); a sessão é a
  do Supabase Auth guardada no navegador, a mesma do MONITORA — dentro do
  quadro ou sozinho numa aba.
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
import "./recursos.css";
import { compactarCronometroDaSessao } from "../analises/cronometro-da-sessao.js";
import {
  areaDaUrlDoPainel,
  rotuloDaAreaDoPainel,
} from "../lib/area-do-painel-de-analises.js";
import { getSupabaseClient } from "../lib/supabaseClient.js";
import { aplicarTemaSalvoDoPainel } from "../lib/tema-do-painel.js";
import { montarPainelDeRecursos } from "../componentes/recursos/recursos.jsx";

const area = areaDaUrlDoPainel(window.location.search);
const nomeDaArea = rotuloDaAreaDoPainel(area);
document.title = `Painel de recursos · ${nomeDaArea} — MONITORA`;
document.documentElement.dataset.areaDoPainel = area;
aplicarTemaSalvoDoPainel();

montarPainelDeRecursos({
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
