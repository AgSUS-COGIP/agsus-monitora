const state = {
  initialized: false,
  selectedName: "",
  selectedQuery: "",
  lastZoomed: "",
  searchProxy: null,
  summaryRendering: false,
  syncScheduled: false
};

const nativeValueDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");

const normalize = value => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/\s+/g, " ")
  .trim();

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;"
}[character]));

function selectedBanner() {
  return document.getElementById("healthSelectedDsei");
}

function selectedNameFromBanner() {
  const banner = selectedBanner();
  if (!banner || banner.hidden) return "";
  return normalize(document.getElementById("healthSelectedDseiName")?.textContent);
}

function searchInput() {
  return document.getElementById("tableSearch");
}

function nativeSearchValue(input = searchInput()) {
  if (!input || !nativeValueDescriptor) return "";
  return nativeValueDescriptor.get.call(input);
}

function installSearchProxy(name) {
  const input = searchInput();
  if (!input || !nativeValueDescriptor) return;

  const currentQuery = normalize(nativeSearchValue(input)) || normalize(name);
  state.selectedQuery = currentQuery;

  if (!state.searchProxy) {
    state.searchProxy = {
      input,
      placeholder: input.getAttribute("placeholder") || ""
    };

    Object.defineProperty(input, "value", {
      configurable: true,
      enumerable: true,
      get() {
        return state.selectedName ? state.selectedQuery : nativeValueDescriptor.get.call(input);
      },
      set(value) {
        if (state.selectedName) {
          state.selectedQuery = String(value ?? "");
          nativeValueDescriptor.set.call(input, "");
          return;
        }
        nativeValueDescriptor.set.call(input, value);
      }
    });
  }

  nativeValueDescriptor.set.call(input, "");
  input.readOnly = true;
  input.dataset.healthDseiFilter = "true";
  input.placeholder = `DSEI ${name} aplicado pelo mapa`;
  input.setAttribute("aria-label", `DSEI ${name} aplicado ao painel. Limpe a seleção no mapa para pesquisar.`);
}

function releaseSearchProxy() {
  const proxy = state.searchProxy;
  if (!proxy || !nativeValueDescriptor) return;

  const { input, placeholder } = proxy;
  state.searchProxy = null;
  state.selectedQuery = "";
  try {
    delete input.value;
  } catch (error) {
    console.warn("Não foi possível restaurar o campo de pesquisa:", error);
  }
  nativeValueDescriptor.set.call(input, "");
  input.readOnly = false;
  delete input.dataset.healthDseiFilter;
  input.placeholder = placeholder;
  input.setAttribute("aria-label", placeholder || "Pesquisar processos");
}

function updateBannerLabel() {
  const banner = selectedBanner();
  const label = banner?.querySelector("small");
  if (label) label.textContent = "DSEI aplicado ao painel";
}

function kpiValue(id) {
  return normalize(document.getElementById(id)?.textContent) || "0";
}

function summarySignature(name) {
  return [
    name,
    kpiValue("kProcessos"),
    kpiValue("kVagas"),
    kpiValue("kContratados"),
    kpiValue("kOciosas")
  ].join("|");
}

function renderSelectedSummary(name) {
  const card = document.getElementById("multiUnitsCard");
  if (!card || state.summaryRendering) return;

  const signature = summarySignature(name);
  if (card.dataset.healthDseiSummary === signature && card.querySelector(".health-dsei-summary")) return;

  state.summaryRendering = true;
  card.dataset.healthDseiSummary = signature;
  card.classList.remove("hidden");
  card.classList.add("health-dsei-summary-card");
  card.innerHTML = `
    <div class="health-dsei-summary">
      <div class="health-dsei-summary-heading">
        <span class="health-dsei-summary-icon" aria-hidden="true"><i class="fa-solid fa-location-dot"></i></span>
        <div>
          <small>DSEI aplicado ao painel</small>
          <strong>DSEI ${escapeHtml(name)}</strong>
        </div>
      </div>
      <div class="health-dsei-summary-metrics" aria-label="Resumo do DSEI selecionado">
        <div><span>Processos</span><b>${escapeHtml(kpiValue("kProcessos"))}</b></div>
        <div><span>Vagas previstas</span><b>${escapeHtml(kpiValue("kVagas"))}</b></div>
        <div><span>Contratações</span><b>${escapeHtml(kpiValue("kContratados"))}</b></div>
        <div><span>Vagas ociosas</span><b>${escapeHtml(kpiValue("kOciosas"))}</b></div>
      </div>
      <div class="health-dsei-summary-actions">
        <button type="button" class="btn secondary" data-health-dsei-action="details">
          <i class="fa-solid fa-table-list"></i> Ver tabela
        </button>
        <button type="button" class="btn outline" data-health-dsei-action="clear">
          <i class="fa-solid fa-map"></i> Voltar ao Brasil
        </button>
      </div>
    </div>
  `;
  state.summaryRendering = false;
}

function restoreSummaryShell() {
  const card = document.getElementById("multiUnitsCard");
  if (!card) return;
  card.classList.remove("health-dsei-summary-card");
  delete card.dataset.healthDseiSummary;
  if (card.querySelector(".health-dsei-summary")) {
    card.innerHTML = "";
    card.classList.add("hidden");
  }
}

function structureActiveFilterPill(name) {
  const bar = document.getElementById("activeFiltersBar");
  if (!bar || bar.classList.contains("hidden")) return;

  const normalizedName = normalize(name).toLowerCase();
  const pill = [...bar.querySelectorAll(".filter-pill")].find(candidate => {
    const text = normalize(candidate.textContent).toLowerCase();
    return candidate.querySelector(".fa-magnifying-glass") && text.includes(normalizedName);
  });
  if (!pill || pill.dataset.healthDseiStructured === normalizedName) return;

  pill.dataset.healthDseiStructured = normalizedName;
  pill.classList.add("health-dsei-filter-pill");
  pill.innerHTML = `
    <i class="fa-solid fa-location-dot" aria-hidden="true"></i>
    <span><small>DSEI aplicado ao painel</small><strong>${escapeHtml(name)}</strong></span>
    <button type="button" data-health-dsei-action="clear" title="Voltar à visão do Brasil" aria-label="Remover seleção do DSEI ${escapeHtml(name)}">×</button>
  `;
}

function zoomIntoSelectedDsei(name) {
  if (!name || state.lastZoomed === name) return;
  state.lastZoomed = name;

  window.setTimeout(() => {
    if (state.selectedName !== name) return;
    const zoomIn = document.querySelector("#map .leaflet-control-zoom-in");
    if (!zoomIn) return;
    zoomIn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    window.setTimeout(() => {
      if (state.selectedName === name) {
        zoomIn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      }
    }, 140);
  }, 420);
}

function removeDuplicateToasts() {
  const toastBox = document.getElementById("toastBox");
  if (!toastBox) return;
  [...toastBox.children].forEach(toast => {
    const text = normalize(toast.textContent).toLowerCase();
    if (text.includes("exibindo polos base") || text.includes("visao geral do brasil")) toast.remove();
  });
}

function scheduleSync() {
  if (state.syncScheduled) return;
  state.syncScheduled = true;
  queueMicrotask(() => {
    state.syncScheduled = false;
    syncSelection();
  });
}

function clearLocalSelection() {
  releaseSearchProxy();
  state.selectedName = "";
  state.lastZoomed = "";
  restoreSummaryShell();
}

function findBrasilButton() {
  return [...document.querySelectorAll("#map button")].find(button => normalize(button.textContent).toLowerCase().includes("brasil"));
}

function returnToBrazil() {
  clearLocalSelection();
  const brasilButton = findBrasilButton();
  if (brasilButton) {
    brasilButton.click();
    return;
  }
  window.clearFilters?.();
}

function syncSelection() {
  const name = selectedNameFromBanner();
  if (!name) {
    if (state.selectedName) clearLocalSelection();
    removeDuplicateToasts();
    return;
  }

  const changed = state.selectedName !== name;
  state.selectedName = name;
  installSearchProxy(name);
  updateBannerLabel();
  structureActiveFilterPill(name);
  renderSelectedSummary(name);
  if (changed) zoomIntoSelectedDsei(name);
  removeDuplicateToasts();
}

function handleClick(event) {
  const action = event.target.closest?.("[data-health-dsei-action]")?.dataset.healthDseiAction;
  if (action === "details") {
    document.querySelector("#page-dashboard .table-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (action === "clear") {
    event.preventDefault();
    event.stopImmediatePropagation();
    returnToBrazil();
    return;
  }

  if (event.target.closest?.("#healthSelectedDsei button")) {
    clearLocalSelection();
    return;
  }

  const mapButton = event.target.closest?.("#map button");
  if (mapButton && normalize(mapButton.textContent).toLowerCase().includes("brasil")) {
    clearLocalSelection();
    return;
  }

  if (event.target.closest?.(".filters-clear-all") || event.target.closest?.('.filter-card button[onclick*="clearFilters"]')) {
    clearLocalSelection();
  }

  window.setTimeout(scheduleSync, 180);
}

function installObservers() {
  const banner = selectedBanner();
  if (banner) {
    new MutationObserver(scheduleSync).observe(banner, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden"]
    });
  }

  const filterBar = document.getElementById("activeFiltersBar");
  if (filterBar) new MutationObserver(scheduleSync).observe(filterBar, { childList: true, subtree: true, attributes: true });

  const summaryCard = document.getElementById("multiUnitsCard");
  if (summaryCard) new MutationObserver(scheduleSync).observe(summaryCard, { childList: true, subtree: true });

  const kpis = document.querySelector("#page-dashboard .kpis-main");
  if (kpis) new MutationObserver(scheduleSync).observe(kpis, { childList: true, subtree: true, characterData: true });

  const toastBox = document.getElementById("toastBox");
  if (toastBox) new MutationObserver(removeDuplicateToasts).observe(toastBox, { childList: true });
}

export function initHealthMapDrilldown() {
  if (state.initialized) return;
  state.initialized = true;
  installObservers();
  document.addEventListener("click", handleClick, true);
  scheduleSync();
}
