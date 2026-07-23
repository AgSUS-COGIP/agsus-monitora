let initialized = false;
let timer = 0;
let attempts = 0;

const $ = id => document.getElementById(id);
const norm = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

function canonicalStatus(value) {
  const key = norm(value);
  if (key.includes("conclu")) return "Concluído";
  if (key.includes("cancel")) return "Cancelado";
  if (key.includes("suspens")) return "Suspenso";
  if (key.includes("paralis")) return "Paralisado";
  if (key.includes("planejad")) return "Planejado";
  if (key.includes("andamento")) return "Em andamento";
  if (key.includes("cronograma pendente") || !key) return "Cronograma pendente";
  return String(value || "Não informado").trim();
}

function statusColor(label) {
  const key = norm(label);
  if (key.includes("conclu")) return "#0ea76b";
  if (key.includes("andamento")) return "#2474e7";
  if (key.includes("planejad")) return "#15a7c8";
  if (key.includes("cancel")) return "#e43f4c";
  if (key.includes("suspens") || key.includes("paralis")) return "#8b5cf6";
  return "#94a3b8";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

function ensureLayout() {
  const canvas = $("statusChart");
  const wrap = canvas?.closest(".chart-wrap");
  const card = canvas?.closest(".card");
  if (!canvas || !wrap || !card) return null;

  if (!card.querySelector(".health-status-subtitle")) {
    card.querySelector(".panel-title")?.insertAdjacentHTML("afterend", '<p class="health-status-subtitle">Distribuição dos processos por situação operacional. Clique em uma categoria para filtrar.</p>');
  }
  if (!wrap.parentElement?.classList.contains("health-status-layout")) {
    const layout = document.createElement("div");
    layout.className = "health-status-layout";
    wrap.parentElement.insertBefore(layout, wrap);
    layout.appendChild(wrap);
    layout.insertAdjacentHTML("beforeend", '<div id="healthStatusLegend" class="health-status-legend"></div>');
  }
  if (!wrap.querySelector(".health-status-center")) {
    wrap.insertAdjacentHTML("beforeend", '<div class="health-status-center is-loading"><strong id="healthStatusTotal">—</strong><span>processos</span></div>');
  }
  return canvas;
}

function addCount(map, label, value) {
  const status = canonicalStatus(label);
  const number = Number(value || 0);
  if (number) map.set(status, (map.get(status) || 0) + number);
}

function collectEntries(chart) {
  const counts = new Map();
  const tableRows = [...document.querySelectorAll("#monitorRows tr")].filter(row => !row.querySelector("td[colspan]"));
  tableRows.forEach(row => {
    const statusCell = [...row.querySelectorAll("td")].find(cell => cell.querySelector(".chip") && /andamento|conclu|cancel|planejad|cronograma|suspens|paralis/i.test(cell.textContent));
    if (statusCell) addCount(counts, statusCell.textContent, 1);
  });
  if (!counts.size) {
    const labels = chart?.data?.labels || [];
    const values = chart?.data?.datasets?.[0]?.data || [];
    labels.forEach((label, index) => addCount(counts, label, values[index]));
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function syncChart() {
  const canvas = ensureLayout();
  const chart = canvas && window.Chart?.getChart?.(canvas);
  if (!chart) return false;
  const entries = collectEntries(chart);
  if (!entries.length) return false;

  const total = entries.reduce((sum, [, value]) => sum + Number(value || 0), 0);
  chart.data.labels = entries.map(([label]) => label);
  chart.data.datasets[0].data = entries.map(([, value]) => value);
  chart.data.datasets[0].backgroundColor = entries.map(([label]) => statusColor(label));
  chart.data.datasets[0].borderColor = "#fff";
  chart.data.datasets[0].borderWidth = 3;
  chart.data.datasets[0].hoverOffset = 6;
  chart.options.animation = false;
  chart.options.cutout = "72%";
  chart.options.plugins.legend.display = false;
  chart.options.plugins.tooltip.enabled = false;
  chart.options.interaction = { mode:"nearest", intersect:true };
  chart.update("none");

  const center = canvas.closest(".chart-wrap")?.querySelector(".health-status-center");
  center?.classList.remove("is-loading");
  if ($("healthStatusTotal")) $("healthStatusTotal").textContent = total.toLocaleString("pt-BR");

  const legend = $("healthStatusLegend");
  if (legend) legend.innerHTML = entries.map(([label, value]) => {
    const pct = total ? Math.round((value / total) * 100) : 0;
    return `<button type="button" class="health-status-legend-item" data-health-status="${escapeHtml(label)}"><span class="health-status-dot" style="background:${statusColor(label)}"></span><span class="health-status-name">${escapeHtml(label)}</span><strong>${Number(value).toLocaleString("pt-BR")}</strong><small>${pct}%</small></button>`;
  }).join("");
  return true;
}

function compactDetails() {
  const foot = $("monitorFoot");
  if (foot) {
    foot.hidden = true;
    foot.innerHTML = "";
  }
  document.querySelectorAll("#monitorRows .health-row-operational").forEach(badge => {
    const value = norm(badge.textContent);
    if (value.includes("concluido") || value.includes("cancelado")) {
      badge.remove();
      return;
    }
    if (value.includes("sem cronograma estruturado")) {
      badge.title = "Cronograma ainda não estruturado na Equipe Núcleo";
      badge.innerHTML = '<i class="fa-solid fa-calendar-xmark"></i><span>Sem cronograma</span>';
    }
  });
}

function sync() {
  compactDetails();
  return syncChart();
}

function stopLoop() {
  clearTimeout(timer);
  timer = 0;
  attempts = 0;
}

function step() {
  if ($("page-dashboard")?.classList.contains("active") && sync()) {
    stopLoop();
    return;
  }
  attempts += 1;
  if (attempts >= 80) return stopLoop();
  timer = setTimeout(step, 125);
}

function startLoop() {
  stopLoop();
  ensureLayout();
  timer = setTimeout(step, 0);
}

export function initHealthStatusDetailsRefinement() {
  if (initialized) return;
  initialized = true;
  startLoop();
  document.addEventListener("click", event => {
    if (event.target?.closest?.('[data-view="dashboard"]')) startLoop();
    if (event.target?.closest?.("#page-dashboard")) setTimeout(sync, 40);
  });
  document.addEventListener("input", event => { if (event.target?.closest?.("#page-dashboard")) setTimeout(sync, 40); });
  document.addEventListener("change", event => { if (event.target?.closest?.("#page-dashboard")) setTimeout(sync, 40); });
  document.addEventListener("agsus:nucleo-cronograma-saved", startLoop);
  window.addEventListener("focus", () => { if ($("page-dashboard")?.classList.contains("active")) startLoop(); });
}
