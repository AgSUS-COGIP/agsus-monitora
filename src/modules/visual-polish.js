import * as echarts from "echarts";
import { hasMeaningfulMetrics, readDashboardKpiSeries } from "../lib/dashboardMetrics.js";

let dashboardChart = null;
let observer = null;
let resizeHandler = null;
let updateTimer = null;

export function initVisualPolish() {
  const start = () => {
    document.body.classList.add("visual-polish-ready");
    ensureDashboardSummaryChart();
    observeDashboardMetrics();
    updateDashboardSummaryChart();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
}

function ensureDashboardSummaryChart() {
  const statusSummary = document.getElementById("statusSummary");
  if (!statusSummary || document.getElementById("executiveMiniChart")) return;

  const shell = document.createElement("section");
  shell.className = "executive-mini-chart";
  shell.setAttribute("aria-label", "Resumo visual dos indicadores principais");
  shell.innerHTML = `
    <div class="executive-mini-chart-head">
      <span>Resumo executivo</span>
      <strong id="executiveMiniChartStatus">Aguardando dados</strong>
    </div>
    <div id="executiveMiniChart" class="executive-mini-chart-canvas"></div>
  `;

  statusSummary.insertAdjacentElement("afterend", shell);
}

function observeDashboardMetrics() {
  if (observer) observer.disconnect();

  const targets = ["kProcessos", "kContratados", "kOciosas", "kCriticos", "kInscritos"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  if (!targets.length) return;

  observer = new MutationObserver(scheduleDashboardSummaryUpdate);
  targets.forEach((target) => observer.observe(target, { childList: true, characterData: true, subtree: true }));

  if (!resizeHandler) {
    resizeHandler = () => dashboardChart?.resize();
    window.addEventListener("resize", resizeHandler);
  }
}

function scheduleDashboardSummaryUpdate() {
  window.clearTimeout(updateTimer);
  updateTimer = window.setTimeout(updateDashboardSummaryChart, 120);
}

function updateDashboardSummaryChart() {
  const chartElement = document.getElementById("executiveMiniChart");
  if (!chartElement) {
    ensureDashboardSummaryChart();
    return;
  }

  const series = readDashboardKpiSeries(document);
  const hasData = hasMeaningfulMetrics(series);
  const statusElement = document.getElementById("executiveMiniChartStatus");
  if (statusElement) {
    statusElement.textContent = hasData ? "Dados carregados" : "Aguardando dados";
  }

  if (!dashboardChart) {
    dashboardChart = echarts.init(chartElement, null, { renderer: "canvas" });
  }

  dashboardChart.setOption({
    animationDuration: 450,
    grid: { top: 10, right: 8, bottom: 26, left: 34 },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      valueFormatter: (value) => Number(value || 0).toLocaleString("pt-BR")
    },
    xAxis: {
      type: "category",
      data: series.map((item) => item.label),
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { color: "#63748d", fontSize: 10, interval: 0 }
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: "rgba(99,116,141,.16)" } },
      axisLabel: { color: "#63748d", fontSize: 10 }
    },
    series: [
      {
        type: "bar",
        barWidth: 18,
        data: series.map((item) => ({
          value: item.value,
          itemStyle: {
            color: item.color,
            borderRadius: [6, 6, 0, 0]
          }
        }))
      }
    ]
  });
}
