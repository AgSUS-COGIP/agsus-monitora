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
  tituloDoPainelDeAnalises,
} from "../lib/area-do-painel-de-analises.js";

export const AREA_DO_PAINEL = areaDaUrlDoPainel(window.location.search);
export const PAINEL_DA_SAUDE_INDIGENA = ehAreaSaudeIndigena(AREA_DO_PAINEL);
export const ROTULO_DA_AREA_DO_PAINEL = rotuloDaAreaDoPainel(AREA_DO_PAINEL);

function aplicarTitulo() {
  const titulo = tituloDoPainelDeAnalises(AREA_DO_PAINEL);
  document.title = titulo;
  const cabecalho = document.querySelector("#topbar .brand h1");
  if (cabecalho) cabecalho.textContent = titulo;
  document.documentElement.dataset.areaDoPainel = AREA_DO_PAINEL;
}

aplicarTitulo();
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", aplicarTitulo, { once: true });
