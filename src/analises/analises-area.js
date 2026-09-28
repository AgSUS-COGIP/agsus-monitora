/*
  A área deste painel, lida uma vez da URL (`?area=`). Saúde Indígena, SEDE e
  Projetos abrem o mesmo painel; sem `?area=` ele é o da Saúde Indígena.
  A regra (códigos aceitos, rótulos, chaves de cache) mora em
  `src/lib/area-do-painel-de-analises.js`.
*/
import {
  areaDaUrlDoPainel,
  ehAreaSaudeIndigena,
  rotuloDaAreaDoPainel,
  subtituloDoPainelDeAnalises,
  tituloDaAbaDoPainelDeAnalises,
  tituloDoPainelDeAnalises,
} from "../lib/area-do-painel-de-analises.js";

export const AREA_DO_PAINEL = areaDaUrlDoPainel(window.location.search);
export const PAINEL_DA_SAUDE_INDIGENA = ehAreaSaudeIndigena(AREA_DO_PAINEL);
export const ROTULO_DA_AREA_DO_PAINEL = rotuloDaAreaDoPainel(AREA_DO_PAINEL);

function aplicarTitulo() {
  document.title = tituloDaAbaDoPainelDeAnalises(AREA_DO_PAINEL);
  const cabecalho = document.querySelector("#topbar .brand h1");
  if (cabecalho) cabecalho.textContent = tituloDoPainelDeAnalises();
  const subtitulo = document.querySelector("#topbar .brand .sub");
  if (subtitulo)
    subtitulo.textContent = subtituloDoPainelDeAnalises(AREA_DO_PAINEL);
  document.documentElement.dataset.areaDoPainel = AREA_DO_PAINEL;
}

aplicarTitulo();
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", aplicarTitulo, { once: true });
