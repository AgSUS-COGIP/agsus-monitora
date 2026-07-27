const state = {
  initialized: false,
  refreshTimer: 0,
  only2026: false,
  logoutResolve: null
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

function ensureLogoutModal(documentRef = globalThis.document) {
  if (!documentRef?.body) return null;
  let modal = documentRef.getElementById("healthLogoutModal");
  if (modal) return modal;

  modal = documentRef.createElement("div");
  modal.id = "healthLogoutModal";
  modal.className = "health-logout-modal";
  modal.hidden = true;
  modal.innerHTML = `
    <div class="health-logout-dialog" role="dialog" aria-modal="true" aria-labelledby="healthLogoutTitle" aria-describedby="healthLogoutDescription">
      <div class="health-logout-icon" aria-hidden="true"><i class="fa-solid fa-arrow-right-from-bracket"></i></div>
      <div class="health-logout-copy">
        <span>Encerrar sessão</span>
        <h2 id="healthLogoutTitle">Deseja realmente sair?</h2>
        <p id="healthLogoutDescription">Sua sessão no AgSUS Monitora será encerrada neste navegador.</p>
      </div>
      <div class="health-logout-actions">
        <button type="button" class="btn outline" data-health-logout="cancel">Continuar no sistema</button>
        <button type="button" class="btn health-logout-confirm" data-health-logout="confirm"><i class="fa-solid fa-arrow-right-from-bracket"></i> Sair</button>
      </div>
    </div>`;
  documentRef.body.appendChild(modal);

  const finish = confirmed => {
    modal.hidden = true;
    documentRef.body.classList.remove("health-logout-open");
    const resolve = state.logoutResolve;
    state.logoutResolve = null;
    resolve?.(confirmed);
  };

  modal.addEventListener("click", event => {
    const action = event.target.closest?.("[data-health-logout]")?.dataset.healthLogout;
    if (action === "confirm") finish(true);
    if (action === "cancel" || event.target === modal) finish(false);
  });
  documentRef.addEventListener("keydown", event => {
    if (event.key === "Escape" && !modal.hidden) finish(false);
  });
  return modal;
}

export function openLogoutConfirmation(documentRef = globalThis.document) {
  const modal = ensureLogoutModal(documentRef);
  if (!modal) return Promise.resolve(false);
  if (state.logoutResolve) return Promise.resolve(false);

  modal.hidden = false;
  documentRef.body.classList.add("health-logout-open");
  requestAnimationFrame(() => modal.querySelector('[data-health-logout="cancel"]')?.focus());
  return new Promise(resolve => { state.logoutResolve = resolve; });
}

export function installConfirmedLogout(
  windowRef = globalThis.window,
  confirmFn = () => openLogoutConfirmation(windowRef?.document || globalThis.document)
) {
  const original = windowRef?.logout;
  if (typeof original !== "function" || original.__agsusConfirmedLogout) return false;

  const wrapped = async function(...args) {
    const confirmed = await Promise.resolve(confirmFn("Deseja realmente sair do AgSUS Monitora?"));
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

function editalYearFromRow(row, editalIndex) {
  const cells = [...row.querySelectorAll("td")];
  const text = String(cells[editalIndex]?.querySelector("a")?.textContent || cells[editalIndex]?.textContent || "");
  return text.match(/\/(20\d{2})\b/)?.[1] || "";
}

function updateQuickFilterButton(documentRef) {
  const button = documentRef.getElementById("healthOnly2026Btn");
  if (!button) return;
  button.classList.toggle("active", state.only2026);
  button.setAttribute("aria-pressed", String(state.only2026));
  button.innerHTML = `<i class="fa-solid fa-calendar-check"></i><span>${state.only2026 ? "Mostrando editais 2026" : "Editais 2026"}</span>`;
}

function applyOnly2026Filter(documentRef, indexes = columnIndexes(documentRef)) {
  const rows = [...documentRef.querySelectorAll("#monitorRows tr")].filter(row => !row.querySelector("td[colspan]"));
  let visible = 0;
  rows.forEach(row => {
    const show = !state.only2026 || editalYearFromRow(row, indexes.edital) === "2026";
    row.hidden = !show;
    row.classList.toggle("health-filtered-out", !show);
    if (show) visible += 1;
  });

  const meta = documentRef.getElementById("tableMeta");
  if (meta) {
    if (!meta.dataset.healthOriginalText) meta.dataset.healthOriginalText = meta.textContent || "";
    if (state.only2026) meta.textContent = `Exibindo ${visible} edital(is) de 2026. Clique nos cabeçalhos para ordenar.`;
    else if (meta.dataset.healthOriginalText) meta.textContent = meta.dataset.healthOriginalText;
  }
  updateQuickFilterButton(documentRef);
  return visible;
}

export function ensureOnly2026Button(documentRef = globalThis.document) {
  if (!documentRef?.getElementById) return null;
  let button = documentRef.getElementById("healthOnly2026Btn");
  if (button) return button;

  const search = documentRef.getElementById("tableSearch");
  const host = search?.closest(".table-actions, .details-actions") || search?.parentElement?.parentElement || search?.parentElement;
  if (!host) return null;

  button = documentRef.createElement("button");
  button.id = "healthOnly2026Btn";
  button.type = "button";
  button.className = "btn outline health-quick-year";
  button.title = "Mostrar somente processos seletivos cujo edital é de 2026";
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", () => {
    state.only2026 = !state.only2026;
    enhanceHealthDetailsTable(documentRef);
  });

  const searchWrap = search?.parentElement;
  if (searchWrap && searchWrap.parentElement === host) host.insertBefore(button, searchWrap);
  else host.insertBefore(button, host.firstChild);
  updateQuickFilterButton(documentRef);
  return button;
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
    <span><i class="fa-solid fa-circle-info health-legend-icon details"></i> clique na linha para abrir detalhes</span>`;
}

export function enhanceHealthDetailsTable(documentRef = globalThis.document) {
  if (!documentRef?.querySelectorAll) return 0;
  const indexes = columnIndexes(documentRef);
  let enhanced = 0;

  ensureOnly2026Button(documentRef);
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

  applyOnly2026Filter(documentRef, indexes);
  return enhanced;
}

function scheduleEnhancement(windowRef, documentRef, delay = 0) {
  windowRef.clearTimeout(state.refreshTimer);
  state.refreshTimer = windowRef.setTimeout(() => enhanceHealthDetailsTable(documentRef), delay);
}

function wrapRenderAction(windowRef, documentRef, name, delay = 0) {
  const original = windowRef?.[name];
  if (typeof original !== "function" || original.__healthDetailsWrapped) return;
  const wrapped = function(...args) {
    const result = original.apply(this, args);
    scheduleEnhancement(windowRef, documentRef, delay);
    return result;
  };
  wrapped.__healthDetailsWrapped = true;
  wrapped.__healthDetailsOriginal = original;
  windowRef[name] = wrapped;
}

export function initHealthDetailsUx(
  windowRef = globalThis.window,
  documentRef = globalThis.document
) {
  if (state.initialized || !windowRef || !documentRef) return;
  state.initialized = true;

  installConfirmedLogout(windowRef);
  ensureLogoutModal(documentRef);
  ensureOnly2026Button(documentRef);
  enhanceHealthDetailsTable(documentRef);

  ["sortDetails", "toggleHideClosed", "toggleSelectFilter", "clearFilterField", "clearFilters"].forEach(name => {
    wrapRenderAction(windowRef, documentRef, name, 0);
  });
  wrapRenderAction(windowRef, documentRef, "debouncedSearch", 330);

  documentRef.addEventListener("click", event => {
    if (event.target?.closest?.("#page-dashboard, [data-view='dashboard']")) scheduleEnhancement(windowRef, documentRef, 0);
  });
  documentRef.addEventListener("change", event => {
    if (event.target?.closest?.("#page-dashboard")) scheduleEnhancement(windowRef, documentRef, 0);
  });
  documentRef.addEventListener("input", event => {
    if (event.target?.closest?.("#page-dashboard")) scheduleEnhancement(windowRef, documentRef, 330);
  });
  documentRef.addEventListener("agsus:dashboard-rendered", () => scheduleEnhancement(windowRef, documentRef, 0));
  windowRef.addEventListener("focus", () => scheduleEnhancement(windowRef, documentRef, 0));
}