const state = { initialized: false, selectedDsei: "" };

const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

function numberFromCell(cell) {
  const value = String(
    cell?.childNodes?.[0]?.textContent || cell?.textContent || "",
  )
    .replace(/[^0-9,-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function columnIndex(label) {
  const headers = [
    ...document.querySelectorAll("#page-dashboard .details-table thead th"),
  ];
  return headers.findIndex(
    (th) =>
      normalize(th.textContent).toLowerCase() ===
      normalize(label).toLowerCase(),
  );
}

function enhanceVacancyRates() {
  const vagasIndex = columnIndex("Vagas");
  const ociosasIndex = columnIndex("Ociosas");
  if (vagasIndex < 0 || ociosasIndex < 0) return;

  document.querySelectorAll("#monitorRows tr").forEach((row) => {
    const cells = row.querySelectorAll("td");
    const vagasCell = cells[vagasIndex];
    const ociosasCell = cells[ociosasIndex];
    if (
      !vagasCell ||
      !ociosasCell ||
      ociosasCell.querySelector(".health-vacancy-rate")
    )
      return;
    const vagas = numberFromCell(vagasCell);
    const ociosas = numberFromCell(ociosasCell);
    const rate = vagas > 0 ? Math.round((ociosas / vagas) * 100) : 0;
    const level =
      rate >= 60
        ? "critical"
        : rate >= 40
          ? "high"
          : rate >= 20
            ? "medium"
            : "low";
    ociosasCell.insertAdjacentHTML(
      "beforeend",
      `<span class="health-vacancy-rate ${level}" title="${rate}% das vagas estão ociosas">${rate}%</span>`,
    );
  });
}

function ensureSelectedBanner() {
  const mapCard = document.querySelector("#page-dashboard .map-card");
  if (!mapCard) return null;
  let banner = document.getElementById("healthSelectedDsei");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "healthSelectedDsei";
    banner.className = "health-selected-dsei";
    banner.hidden = true;
    banner.innerHTML = `<span class="health-selected-dot" aria-hidden="true"></span><div><small>DSEI selecionado</small><strong id="healthSelectedDseiName"></strong></div><button type="button" aria-label="Voltar à visão do Brasil" title="Voltar à visão do Brasil"><i class="fa-solid fa-xmark"></i></button>`;
    banner.querySelector("button")?.addEventListener("click", () => {
      const brasilButton = [...document.querySelectorAll("#map button")].find(
        (button) => normalize(button.textContent).includes("Brasil"),
      );
      if (brasilButton) brasilButton.click();
      else window.clearFilters?.();
      clearSelectedDsei();
    });
    mapCard.appendChild(banner);
  }
  return banner;
}

function showSelectedDsei(name) {
  const clean = normalize(name).replace(/^DSEI\s+/i, "");
  if (!clean) return;
  state.selectedDsei = clean;
  const banner = ensureSelectedBanner();
  const label = document.getElementById("healthSelectedDseiName");
  if (label) label.textContent = clean;
  if (banner) banner.hidden = false;
}

function clearSelectedDsei() {
  state.selectedDsei = "";
  const banner = document.getElementById("healthSelectedDsei");
  if (banner) banner.hidden = true;
}

function syncMapLegend() {
  const legend = document.getElementById("mapLegendBox");
  if (!legend) return;
  legend.querySelectorAll("span").forEach((span) => {
    const style = String(span.getAttribute("style") || "").toLowerCase();
    if (style.includes("#2e8b57") || style.includes("rgb(46, 139, 87)")) {
      span.style.background = "#facc15";
      span.style.borderColor = "#a16207";
      span.style.opacity = "0.42";
    }
  });
  if (
    legend.textContent.includes("estado atendido") &&
    !legend.textContent.includes("selecionado")
  ) {
    legend.innerHTML = legend.innerHTML.replace(
      "estado atendido",
      "estado atendido (selecionado)",
    );
  }
}

function refreshDecorations() {
  enhanceVacancyRates();
  syncMapLegend();
}

function scheduleRefresh() {
  [0, 120, 420].forEach((delay) =>
    window.setTimeout(refreshDecorations, delay),
  );
}

function handleMapClick(event) {
  const target = event.target;
  if (
    target?.closest?.("button") &&
    normalize(target.closest("button").textContent).includes("Brasil")
  ) {
    clearSelectedDsei();
    scheduleRefresh();
    return;
  }
  if (!target?.closest?.("#map")) return;
  window.setTimeout(() => {
    const searchValue = normalize(
      document.getElementById("tableSearch")?.value,
    );
    if (searchValue && !searchValue.toLowerCase().includes("casai"))
      showSelectedDsei(searchValue);
    refreshDecorations();
  }, 160);
}

export function initHealthDashboardRefinementsSafe() {
  if (state.initialized) return;
  state.initialized = true;
  ensureSelectedBanner();
  scheduleRefresh();
  document.addEventListener("click", handleMapClick, true);
  document.addEventListener("change", (event) => {
    if (event.target?.closest?.("#page-dashboard")) scheduleRefresh();
  });
  document.addEventListener("input", (event) => {
    if (event.target?.id === "tableSearch") scheduleRefresh();
  });
  document.addEventListener("agsus:dashboard-rendered", refreshDecorations);
  document.addEventListener("agsus:health-map-rendered", syncMapLegend);
}
