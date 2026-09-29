const state = { initialized: false, timer: 0, attempts: 0 };
const norm = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function friendly(raw) {
  const value = norm(raw);
  if (
    value.includes("cache consolidado indisponivel") ||
    value.includes("consultando supabase")
  )
    return "Buscando os dados mais recentes...";
  if (value.includes("carregando supabase"))
    return "Recebendo os registros da análise...";
  if (value.includes("montando filtros") || value.includes("montando painel"))
    return "Organizando filtros e informações...";
  if (value.includes("calculando indicadores"))
    return "Calculando indicadores e gráficos...";
  if (value.includes("preparando sessao")) return "Validando seu acesso...";
  return raw || "Preparando os dados para visualização...";
}

function refineLoading() {
  const loading = document.getElementById("loading"),
    title = document.getElementById("loadingTitle"),
    text = document.getElementById("loadingText");
  if (!loading || !title || !text) return false;
  const active = loading.classList.contains("show");
  if (active) {
    title.textContent = "Carregando análises";
    text.textContent = friendly(text.textContent);
  }
  return active;
}

function step() {
  const active = refineLoading();
  state.attempts += 1;
  if (active || state.attempts < 25) state.timer = setTimeout(step, 120);
  else {
    state.attempts = 0;
    state.timer = 0;
  }
}
function startLoading() {
  clearTimeout(state.timer);
  state.attempts = 0;
  state.timer = setTimeout(step, 0);
}
function recolorCharts() {
  const charts = Object.values(window.Chart?.instances || {});
  charts.forEach((chart) => {
    if (chart.config.type === "bar" && chart.data.datasets?.length >= 4) {
      const colors = ["#f59e0b", "#3b82f6", "#10b981", "#ef4444"];
      chart.data.datasets.forEach((ds, i) => {
        ds.backgroundColor = colors[i] || "#64748b";
        ds.borderRadius = 6;
      });
    }
    if (chart.config.type === "line" && chart.data.datasets?.[0]) {
      chart.data.datasets[0].borderColor = "#2563eb";
      chart.data.datasets[0].backgroundColor = "rgba(37,99,235,.08)";
    }
    chart.update("none");
  });
}
function init() {
  if (state.initialized) return;
  state.initialized = true;
  startLoading();
  setTimeout(recolorCharts, 500);
  document.addEventListener(
    "click",
    (e) => {
      if (e.target?.closest?.("#refreshBtn")) startLoading();
    },
    true,
  );
}
init();
