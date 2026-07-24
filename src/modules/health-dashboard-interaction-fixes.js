const state = {
  initialized: false,
  layoutTimers: new Set()
};

function eventFrom(documentRef, type, options = {}) {
  const EventCtor = documentRef?.defaultView?.Event || globalThis.Event;
  return EventCtor ? new EventCtor(type, options) : null;
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function checkedFilterValues(documentRef, field) {
  return new Set(
    [...documentRef.querySelectorAll?.(`input[data-filter-field="${field}"]:checked`) || []]
      .map(input => normalize(input.dataset.filterValue))
      .filter(Boolean)
  );
}

export function syncHealthInteractiveFilterStates(documentRef = globalThis.document) {
  if (!documentRef?.querySelectorAll) return false;

  const selectedStages = checkedFilterValues(documentRef, "etapa");
  const selectedStatuses = checkedFilterValues(documentRef, "status");

  documentRef.querySelectorAll('#statusSummary [data-etapa-toggle="true"]').forEach(item => {
    const label = normalize(item.querySelector("b")?.textContent || item.textContent);
    const active = selectedStages.has(label);
    item.classList.toggle("is-filter-active", active);
    item.setAttribute("aria-pressed", String(active));
  });

  documentRef.querySelectorAll("[data-health-status]").forEach(item => {
    const label = normalize(item.dataset.healthStatus);
    const active = [...selectedStatuses].some(value => {
      if (label.includes("conclu")) return value.includes("conclu");
      if (label.includes("cancel")) return value.includes("cancel");
      if (label.includes("andamento")) return value.includes("andamento");
      if (label.includes("planejad")) return value.includes("planejad");
      return value === label;
    });
    item.classList.toggle("is-filter-active", active);
    item.setAttribute("aria-pressed", String(active));
  });

  return true;
}

export function syncHealthDarkModeClass(
  root = globalThis.document?.documentElement,
  body = globalThis.document?.body
) {
  if (!root || !body) return false;
  const dark = root.getAttribute("data-theme") === "dark";
  body.classList.toggle("dark-mode", dark);
  return dark;
}

export function notifyHealthDashboardFiltersChanged(documentRef = globalThis.document) {
  const dashboard = documentRef?.getElementById?.("page-dashboard");
  if (!dashboard) return false;

  syncHealthInteractiveFilterStates(documentRef);

  // Os aprimoramentos do Status Operacional escutam interações do dashboard.
  // A renderização legada por innerHTML não emitia evento quando o filtro vinha
  // do Resumo por etapa, deixando a legenda e o total visualmente desatualizados.
  const changeEvent = eventFrom(documentRef, "change", { bubbles: true });
  const renderedEvent = eventFrom(documentRef, "agsus:dashboard-rendered");
  if (changeEvent) dashboard.dispatchEvent(changeEvent);
  if (renderedEvent) documentRef.dispatchEvent(renderedEvent);
  return true;
}

export function refreshHealthDashboardLayout(
  windowRef = globalThis.window,
  documentRef = globalThis.document
) {
  if (!windowRef || !documentRef) return false;

  const canvas = documentRef.getElementById?.("statusChart");
  const chart = canvas && windowRef.Chart?.getChart?.(canvas);
  try {
    chart?.resize?.();
    chart?.update?.("none");
  } catch (_) {}

  // O listener de resize já existente invalida o tamanho do Leaflet de forma
  // centralizada, sem acessar a instância privada do mapa por outro módulo.
  const resizeEvent = eventFrom(documentRef, "resize");
  if (resizeEvent) windowRef.dispatchEvent(resizeEvent);
  return true;
}

export function scheduleHealthDashboardLayoutRefresh(
  windowRef = globalThis.window,
  documentRef = globalThis.document,
  delays = [0, 120, 320]
) {
  if (!windowRef?.setTimeout) return [];

  const timers = delays.map(delay => {
    const timer = windowRef.setTimeout(() => {
      state.layoutTimers.delete(timer);
      refreshHealthDashboardLayout(windowRef, documentRef);
    }, delay);
    state.layoutTimers.add(timer);
    return timer;
  });

  return timers;
}

function wrapWindowAction(windowRef, name, after) {
  const original = windowRef?.[name];
  if (typeof original !== "function" || original.__healthInteractionWrapped) return false;

  const wrapped = function(...args) {
    const result = original.apply(this, args);
    after?.(args, result);
    return result;
  };
  wrapped.__healthInteractionWrapped = true;
  wrapped.__healthInteractionOriginal = original;
  windowRef[name] = wrapped;
  return true;
}

function installExplicitActionHooks(windowRef, documentRef) {
  wrapWindowAction(windowRef, "toggleDarkMode", () => {
    syncHealthDarkModeClass(documentRef.documentElement, documentRef.body);
    scheduleHealthDashboardLayoutRefresh(windowRef, documentRef);
  });

  wrapWindowAction(windowRef, "toggleExecutiveMode", () => {
    scheduleHealthDashboardLayoutRefresh(windowRef, documentRef);
  });

  ["toggleSelectFilter", "toggleCriticalRiskFilter", "clearFilterField", "clearFilters"].forEach(name => {
    wrapWindowAction(windowRef, name, () => {
      windowRef.setTimeout(() => notifyHealthDashboardFiltersChanged(documentRef), 0);
    });
  });
}

function installNativeFilterHooks(windowRef, documentRef) {
  documentRef.addEventListener("change", event => {
    if (!event.target?.matches?.("#page-dashboard input[data-filter-field]")) return;
    windowRef.setTimeout(() => notifyHealthDashboardFiltersChanged(documentRef), 0);
  });

  documentRef.addEventListener("click", event => {
    if (!event.target?.closest?.("#statusSummary [data-etapa-toggle='true'], [data-health-status]")) return;
    windowRef.setTimeout(() => notifyHealthDashboardFiltersChanged(documentRef), 0);
  }, true);
}

export function initHealthDashboardInteractionFixes(
  windowRef = globalThis.window,
  documentRef = globalThis.document
) {
  if (state.initialized || !windowRef || !documentRef) return;
  state.initialized = true;

  syncHealthDarkModeClass(documentRef.documentElement, documentRef.body);
  syncHealthInteractiveFilterStates(documentRef);
  installExplicitActionHooks(windowRef, documentRef);
  installNativeFilterHooks(windowRef, documentRef);

  windowRef.addEventListener("orientationchange", () => {
    scheduleHealthDashboardLayoutRefresh(windowRef, documentRef, [80, 260]);
  });
}
