export const DASHBOARD_KPI_CONFIG = [
  { id: "kProcessos", label: "Processos", color: "#003b70" },
  { id: "kContratados", label: "Contratados", color: "#0b8f58" },
  { id: "kOciosas", label: "Ociosas", color: "#d92d3a" },
  { id: "kCriticos", label: "Críticos", color: "#f2b705" },
  { id: "kInscritos", label: "Inscritos", color: "#00a8d6" }
];

export function parseMetricNumber(value) {
  const normalized = String(value ?? "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function readDashboardKpiSeries(root = document) {
  return DASHBOARD_KPI_CONFIG.map((item) => {
    const element = root.getElementById?.(item.id);
    return {
      ...item,
      value: parseMetricNumber(element?.textContent)
    };
  });
}

export function hasMeaningfulMetrics(series) {
  return (series || []).some((item) => Number(item.value) > 0);
}
