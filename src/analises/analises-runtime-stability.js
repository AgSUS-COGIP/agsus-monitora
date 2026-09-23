const LOADING_CLASS = "analises-is-loading";
const PENDING_CLASS = "historical-scope-pending";

const state = {
  authorizedKey: "",
  queryInFlight: false,
  loadingWasVisible: false,
  pollTimer: 0,
  pollAttempts: 0,
  initialized: false,
};

const txt = (value) => String(value ?? "").trim();

function currentScope() {
  const value = txt(
    document.getElementById("fSituacaoEdital")?.value,
  ).toLowerCase();
  return ["ativo", "inativo", "todos"].includes(value) ? value : "ativo";
}

function selectedValues(id) {
  const element = document.getElementById(id);
  if (!element) return [];
  return [...element.selectedOptions]
    .map((option) => txt(option.value))
    .filter(Boolean);
}

function selectionKey() {
  return JSON.stringify({
    scope: currentScope(),
    unidades: selectedValues("scopeGuardUnits").sort(),
    editais: selectedValues("scopeGuardEditais").sort(),
  });
}

function hasHistoricalSelection() {
  return (
    selectedValues("scopeGuardUnits").length > 0 ||
    selectedValues("scopeGuardEditais").length > 0
  );
}

function isAuthorized() {
  return (
    currentScope() !== "ativo" &&
    Boolean(state.authorizedKey) &&
    state.authorizedKey === selectionKey()
  );
}

function ensureStyles() {
  if (document.getElementById("analisesRuntimeStabilityStyles")) return;
  const style = document.createElement("style");
  style.id = "analisesRuntimeStabilityStyles";
  style.textContent = `
    body.${PENDING_CLASS} main.content > section:not(.filter-panel):not(#authWarning){display:none!important}
    body.${PENDING_CLASS} #exportBtn{opacity:.55;cursor:not-allowed}
    #advancedBtn[hidden]{display:none!important}
    @keyframes analises-skeleton{0%{background-position:200% 0}100%{background-position:-200% 0}}
    body.${LOADING_CLASS} #kpiGrid .kpi b,
    body.${LOADING_CLASS} #pdfMetrics > *,
    body.${LOADING_CLASS} #attentionList > *,
    body.${LOADING_CLASS} #tableBody tr{
      color:transparent!important;
      border-color:transparent!important;
      background:linear-gradient(90deg,rgba(148,163,184,.10) 25%,rgba(148,163,184,.22) 50%,rgba(148,163,184,.10) 75%)!important;
      background-size:200% 100%!important;
      animation:analises-skeleton 1.35s ease-in-out infinite!important;
    }
    body.${LOADING_CLASS} #kpiGrid .kpi b{display:inline-block;min-width:72px;border-radius:8px;user-select:none}
    body.${LOADING_CLASS} .chart-wrap{position:relative;min-height:180px;overflow:hidden}
    body.${LOADING_CLASS} .chart-wrap::after{content:"";position:absolute;inset:12px;border-radius:12px;background:linear-gradient(90deg,rgba(148,163,184,.08) 25%,rgba(148,163,184,.18) 50%,rgba(148,163,184,.08) 75%);background-size:200% 100%;animation:analises-skeleton 1.35s ease-in-out infinite;pointer-events:none}
    .scope-guard-summary{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:52px}
    .scope-guard-summary[hidden]{display:none!important}
    .scope-guard-summary-main{display:flex;align-items:center;gap:12px;min-width:0}
    .scope-guard-summary-icon{display:grid;place-items:center;width:36px;height:36px;border-radius:12px;background:color-mix(in srgb,var(--green) 15%,transparent);color:var(--green);flex:0 0 auto}
    .scope-guard-summary-main strong{display:block;color:var(--strong);font-size:14px}
    .scope-guard-summary-text{display:block;color:var(--muted);font-size:12px;font-weight:750;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .scope-guard--collapsed{border-left-color:var(--green);background:color-mix(in srgb,var(--green) 6%,var(--card));padding:10px 12px}
    .scope-guard--collapsed > .scope-guard-head,
    .scope-guard--collapsed > .scope-guard-grid,
    .scope-guard--collapsed > .scope-guard-status{display:none!important}
    .scope-guard-summary-action{white-space:nowrap}
    @media(prefers-reduced-motion:reduce){body.${LOADING_CLASS} #kpiGrid .kpi b,body.${LOADING_CLASS} #pdfMetrics > *,body.${LOADING_CLASS} #attentionList > *,body.${LOADING_CLASS} #tableBody tr,body.${LOADING_CLASS} .chart-wrap::after{animation:none!important}}
    @media(max-width:720px){.scope-guard-summary{align-items:flex-start;flex-direction:column}.scope-guard-summary-action{width:100%}.scope-guard-summary-text{white-space:normal}}
  `;
  document.head.appendChild(style);
}

function currentScopeLabel() {
  const select = document.getElementById("fSituacaoEdital");
  return txt(
    select?.selectedOptions?.[0]?.textContent || select?.value || "Recorte",
  );
}

function currentTotal() {
  return txt(document.getElementById("kTotal")?.textContent) || "0";
}

function buildSummaryText() {
  const units = selectedValues("scopeGuardUnits").length;
  const editais = selectedValues("scopeGuardEditais").length;
  return `${currentScopeLabel()} · ${units} unidade(s) · ${editais} edital(is) · ${currentTotal()} registro(s)`;
}

function ensureSummary() {
  const guard = document.getElementById("scopeGuard");
  if (!guard) return false;
  if (document.getElementById("scopeGuardSummary")) return true;

  const summary = document.createElement("div");
  summary.id = "scopeGuardSummary";
  summary.className = "scope-guard-summary";
  summary.hidden = true;
  summary.innerHTML = `
    <div class="scope-guard-summary-main">
      <span class="scope-guard-summary-icon" aria-hidden="true"><i class="fa-solid fa-filter-circle-check"></i></span>
      <div><strong>Recorte aplicado</strong><span class="scope-guard-summary-text"></span></div>
    </div>
    <button type="button" class="btn scope-guard-summary-action" id="scopeGuardChange">
      <i class="fa-solid fa-pen-to-square"></i> Alterar recorte
    </button>`;
  guard.insertAdjacentElement("afterbegin", summary);
  document
    .getElementById("scopeGuardChange")
    ?.addEventListener("click", () => setSummaryCollapsed(false));
  return true;
}

function setSummaryCollapsed(collapsed) {
  const guard = document.getElementById("scopeGuard");
  const summary = document.getElementById("scopeGuardSummary");
  if (!guard || !summary) return;
  guard.classList.toggle("scope-guard--collapsed", collapsed);
  summary.hidden = !collapsed;
  if (collapsed) {
    const label = summary.querySelector(".scope-guard-summary-text");
    if (label) label.textContent = buildSummaryText();
  }
}

function setLoading(active) {
  document.body.classList.toggle(LOADING_CLASS, active);
  document
    .querySelector("main.content")
    ?.setAttribute("aria-busy", String(active));
  ["refreshBtn", "applyBtn", "scopeGuardLoad"].forEach((id) => {
    document.getElementById(id)?.setAttribute("aria-busy", String(active));
  });
}

function setPending(pending) {
  document.body.classList.toggle(PENDING_CLASS, pending);
  const exportButton = document.getElementById("exportBtn");
  if (exportButton) {
    exportButton.disabled = pending;
    exportButton.title = pending
      ? "Consulte uma unidade ou edital antes de exportar"
      : "";
  }
}

function updateStatus(message, warning = false) {
  const status = document.getElementById("scopeGuardStatus");
  if (!status) return;
  status.classList.toggle("is-warning", warning);
  status.textContent = message;
}

function invalidateHistoricalResult() {
  state.authorizedKey = "";
  state.queryInFlight = false;
  setSummaryCollapsed(false);
  if (currentScope() !== "ativo") setPending(true);
}

function authorizeAndStart() {
  if (!hasHistoricalSelection()) {
    invalidateHistoricalResult();
    return false;
  }
  state.authorizedKey = selectionKey();
  state.queryInFlight = true;
  state.loadingWasVisible = false;
  setPending(true);
  setSummaryCollapsed(false);
  startCompletionPolling();
  return true;
}

function finishHistoricalQuery() {
  if (!state.queryInFlight || !isAuthorized()) return;
  const authWarning = document.getElementById("authWarning");
  if (authWarning && !authWarning.hidden && txt(authWarning.textContent)) {
    state.queryInFlight = false;
    setPending(true);
    updateStatus(
      "A consulta não foi concluída. Revise a mensagem de erro e tente novamente.",
      true,
    );
    return;
  }
  state.queryInFlight = false;
  setPending(false);
  updateStatus(`Consulta concluída: ${currentTotal()} registro(s) no recorte.`);
  ensureSummary();
  setSummaryCollapsed(true);
  document.dispatchEvent(
    new CustomEvent("agsus:analises-query-complete", {
      detail: { total: currentTotal() },
    }),
  );
}

function stopCompletionPolling() {
  window.clearTimeout(state.pollTimer);
  state.pollTimer = 0;
  state.pollAttempts = 0;
  state.loadingWasVisible = false;
}

function completionStep() {
  if (!state.queryInFlight) {
    stopCompletionPolling();
    return;
  }
  const loadingVisible =
    document.getElementById("loading")?.classList.contains("show") === true;
  setLoading(loadingVisible);
  if (loadingVisible) state.loadingWasVisible = true;
  if (!loadingVisible && state.loadingWasVisible) {
    finishHistoricalQuery();
    stopCompletionPolling();
    return;
  }
  state.pollAttempts += 1;
  if (state.pollAttempts >= 600) {
    state.queryInFlight = false;
    setPending(true);
    updateStatus(
      "A consulta excedeu o tempo esperado. Tente atualizar novamente.",
      true,
    );
    stopCompletionPolling();
    return;
  }
  state.pollTimer = window.setTimeout(completionStep, 100);
}

function startCompletionPolling() {
  stopCompletionPolling();
  state.queryInFlight = true;
  state.pollTimer = window.setTimeout(completionStep, 0);
}

function syncLoadingBriefly() {
  let attempts = 0;
  const step = () => {
    const active =
      document.getElementById("loading")?.classList.contains("show") === true;
    setLoading(active);
    attempts += 1;
    if (active || attempts < 20) window.setTimeout(step, 100);
  };
  step();
}

function requestGuardLoad() {
  document.getElementById("scopeGuardLoad")?.click();
}

function bindEvents() {
  document.getElementById("fSituacaoEdital")?.addEventListener(
    "change",
    () => {
      if (currentScope() === "ativo") {
        state.authorizedKey = "";
        state.queryInFlight = false;
        setPending(false);
        setSummaryCollapsed(false);
        return;
      }
      if (state.authorizedKey === selectionKey()) {
        state.queryInFlight = true;
        setPending(true);
        startCompletionPolling();
        return;
      }
      invalidateHistoricalResult();
    },
    true,
  );

  document.addEventListener(
    "change",
    (event) => {
      if (
        event.target?.id === "scopeGuardUnits" ||
        event.target?.id === "scopeGuardEditais"
      )
        invalidateHistoricalResult();
    },
    true,
  );

  document.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.("#scopeGuardLoad")) {
        if (authorizeAndStart()) syncLoadingBriefly();
        return;
      }
      if (event.target?.closest?.("#refreshBtn")) {
        syncLoadingBriefly();
        if (currentScope() !== "ativo") {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (!authorizeAndStart()) {
            requestGuardLoad();
            return;
          }
          document.dispatchEvent(
            new CustomEvent("agsus:analises-force-refresh", {
              detail: { scope: currentScope() },
            }),
          );
          requestGuardLoad();
        }
        return;
      }
      if (
        event.target?.closest?.("#exportBtn") &&
        currentScope() !== "ativo" &&
        !isAuthorized()
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        invalidateHistoricalResult();
        requestGuardLoad();
        return;
      }
      if (
        event.target?.closest?.("#applyBtn") &&
        currentScope() !== "ativo" &&
        !isAuthorized()
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        requestGuardLoad();
      }
    },
    true,
  );

  document.addEventListener("agsus:analises-scope-guard-ready", () => {
    ensureSummary();
    setPending(currentScope() !== "ativo" && !isAuthorized());
  });

  document.addEventListener("agsus:analises-loading-start", () =>
    setLoading(true),
  );
  document.addEventListener("agsus:analises-loading-end", () =>
    setLoading(false),
  );
}

function installStep(attempt = 0) {
  ensureSummary();
  const ready =
    document.getElementById("loading") &&
    document.getElementById("fSituacaoEdital");
  if (ready) {
    bindEvents();
    setLoading(
      document.getElementById("loading")?.classList.contains("show") === true,
    );
    setPending(currentScope() !== "ativo" && !isAuthorized());
    return;
  }
  if (attempt < 80) window.setTimeout(() => installStep(attempt + 1), 100);
}

function start() {
  if (state.initialized) return;
  state.initialized = true;
  ensureStyles();
  installStep();
}

document.addEventListener("DOMContentLoaded", start, { once: true });
