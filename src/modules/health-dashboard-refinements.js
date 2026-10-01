const state = { initialized: false };

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

function scheduleRefresh() {
  [0, 120, 420].forEach((delay) =>
    window.setTimeout(enhanceVacancyRates, delay),
  );
}

// Clicar no mapa (ou no "Brasil") refiltra a tabela: a taxa volta nas linhas novas.
function handleMapClick(event) {
  const target = event.target;
  const brasil =
    target?.closest?.("button") &&
    normalize(target.closest("button").textContent).includes("Brasil");
  if (brasil) {
    scheduleRefresh();
    return;
  }
  if (!target?.closest?.("#map")) return;
  window.setTimeout(enhanceVacancyRates, 160);
}

export function initHealthDashboardRefinementsSafe() {
  if (state.initialized) return;
  state.initialized = true;
  scheduleRefresh();
  document.addEventListener("click", handleMapClick, true);
  document.addEventListener("change", (event) => {
    if (event.target?.closest?.("#page-dashboard")) scheduleRefresh();
  });
  document.addEventListener("input", (event) => {
    if (event.target?.id === "tableSearch") scheduleRefresh();
  });
  document.addEventListener("agsus:dashboard-rendered", enhanceVacancyRates);
}
