const state = {
  initialized: false,
  refreshTimer: 0
};

const normalize = value => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/\s+/g, " ")
  .trim();

export function formatDeadlineLabel(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  const days = text.match(/(\d+)\s*d(?:ia)?s?/i);
  if (days) {
    const count = Number(days[1]);
    return `Edital encerra em ${count} ${count === 1 ? "dia" : "dias"}`;
  }
  if (/encerrad/i.test(text)) return "Prazo do edital encerrado";
  if (/cancelad/i.test(text)) return "Processo cancelado";
  if (/conclu/i.test(text)) return "Processo concluído";
  return text;
}

export function installConfirmedLogout(
  windowRef = globalThis.window,
  confirmFn = message => windowRef?.confirm?.(message)
) {
  const original = windowRef?.logout;
  if (typeof original !== "function" || original.__agsusConfirmedLogout) return false;

  const wrapped = async function(...args) {
    const confirmed = confirmFn("Deseja realmente sair do AgSUS Monitora?");
    if (!confirmed) return false;
    return original.apply(this, args);
  };

  wrapped.__agsusConfirmedLogout = true;
  wrapped.__agsusOriginalLogout = original;
  windowRef.logout = wrapped;
  return true;
}

function columnIndexes(documentRef) {
  const headers = [...documentRef.querySelectorAll("#page-dashboard .details-table thead th[data-sort-field]")];
  return Object.fromEntries(headers.map((header, index) => [header.dataset.sortField, index]));
}

function decorateExpiryBadge(badge) {
  if (!badge || badge.dataset.healthDeadlineReady === "1") return;
  const label = formatDeadlineLabel(badge.textContent);
  badge.dataset.healthDeadlineReady = "1";
  badge.classList.add("health-deadline-badge");
  badge.title = label;
  badge.setAttribute("aria-label", label);
  const icon = badge.querySelector("i")?.outerHTML || '<i class="fa-solid fa-calendar-days" aria-hidden="true"></i>';
  badge.innerHTML = `${icon}<span>${label}</span>`;
}

function decorateOperationalBadge(badge) {
  if (!badge || badge.dataset.healthOperationalReady === "1") return;
  const text = String(badge.textContent || "").replace(/\s+/g, " ").trim();
  if (!text) return;
  badge.dataset.healthOperationalReady = "1";
  badge.classList.add("health-operational-badge");
  badge.title = `Cronograma: ${text}`;
  badge.setAttribute("aria-label", `Cronograma: ${text}`);
  const icon = badge.querySelector("i")?.outerHTML || '<i class="fa-solid fa-route" aria-hidden="true"></i>';
  badge.innerHTML = `${icon}<span class="health-operational-copy"><small>Cronograma</small><strong>${text}</strong></span>`;
}

function ensureDeadlineLegend(documentRef) {
  const legend = documentRef.querySelector("#page-dashboard .health-details-legend");
  if (!legend || legend.dataset.healthLegendReady === "1") return;
  legend.dataset.healthLegendReady = "1";
  legend.innerHTML = `
    <span><i class="fa-solid fa-calendar-days health-legend-icon deadline"></i> prazo do edital</span>
    <span><i class="fa-solid fa-route health-legend-icon schedule"></i> próxima etapa do cronograma</span>
    <span><i class="fa-solid fa-circle-info health-legend-icon details"></i> clique na linha para abrir detalhes</span>
  `;
}

export function enhanceHealthDetailsTable(documentRef = globalThis.document) {
  if (!documentRef?.querySelectorAll) return 0;
  const indexes = columnIndexes(documentRef);
  let enhanced = 0;

  ensureDeadlineLegend(documentRef);

  documentRef.querySelectorAll("#monitorRows tr").forEach(row => {
    if (row.querySelector("td[colspan]")) return;
    const cells = [...row.querySelectorAll("td")];
    if (!cells.length) return;

    row.classList.add("health-details-row-refined");
    row.title = "Clique para consultar o resumo operacional e o cronograma";

    const editalCell = cells[indexes.edital];
    const statusCell = cells[indexes.status];
    const etapaCell = cells[indexes.etapa];
    const riscoCell = cells[indexes.risco];

    editalCell?.classList.add("health-edital-cell");
    statusCell?.classList.add("health-status-cell");
    etapaCell?.classList.add("health-stage-cell");
    riscoCell?.classList.add("health-risk-cell");

    editalCell?.querySelectorAll(".expiry-badge").forEach(decorateExpiryBadge);
    editalCell?.querySelectorAll(".health-row-operational").forEach(decorateOperationalBadge);

    const statusChip = statusCell?.querySelector(".chip");
    if (statusChip) {
      const status = String(statusChip.textContent || "").replace(/\s+/g, " ").trim();
      statusChip.classList.add("health-status-chip");
      statusChip.title = `Status operacional: ${status}`;
      statusChip.setAttribute("aria-label", `Status operacional: ${status}`);
    }

    enhanced += 1;
  });

  return enhanced;
}

function scheduleEnhancement(windowRef, documentRef, delay = 60) {
  windowRef.clearTimeout(state.refreshTimer);
  state.refreshTimer = windowRef.setTimeout(() => enhanceHealthDetailsTable(documentRef), delay);
}

export function initHealthDetailsUx(
  windowRef = globalThis.window,
  documentRef = globalThis.document
) {
  if (state.initialized || !windowRef || !documentRef) return;
  state.initialized = true;

  installConfirmedLogout(windowRef);
  enhanceHealthDetailsTable(documentRef);

  documentRef.addEventListener("click", event => {
    if (event.target?.closest?.("#page-dashboard, [data-view='dashboard']")) {
      scheduleEnhancement(windowRef, documentRef);
    }
  });
  documentRef.addEventListener("change", event => {
    if (event.target?.closest?.("#page-dashboard")) scheduleEnhancement(windowRef, documentRef);
  });
  documentRef.addEventListener("input", event => {
    if (event.target?.closest?.("#page-dashboard")) scheduleEnhancement(windowRef, documentRef, 360);
  });
  documentRef.addEventListener("agsus:dashboard-rendered", () => scheduleEnhancement(windowRef, documentRef, 20));
  windowRef.addEventListener("focus", () => scheduleEnhancement(windowRef, documentRef));
}
