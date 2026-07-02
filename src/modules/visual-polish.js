let cleanupTimer = null;

export function initVisualPolish() {
  const start = () => {
    document.body.classList.add("visual-polish-ready");
    removeExecutiveMiniChart();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
}

function removeExecutiveMiniChart() {
  window.clearTimeout(cleanupTimer);

  const chart = document.querySelector(".executive-mini-chart");
  if (chart) chart.remove();

  // O app legado monta algumas partes de forma assíncrona. A segunda limpeza
  // evita que um HTML antigo em cache mantenha o gráfico na tela após o deploy.
  cleanupTimer = window.setTimeout(() => {
    document.querySelector(".executive-mini-chart")?.remove();
  }, 250);
}
