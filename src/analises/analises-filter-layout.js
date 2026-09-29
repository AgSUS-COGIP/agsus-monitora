const state = {
  initialized: false,
  updateTimer: 0,
};

const FILTER_IDS = [
  "fUnidade",
  "fMunicipio",
  "fEdital",
  "fVaga",
  "fStatus",
  "fResponsavel",
  "fCategoria",
  "fModalidade",
  "fValidacao",
];

const ADVANCED_FILTER_IDS = ["fCategoria", "fModalidade", "fValidacao"];

function txt(value) {
  return String(value ?? "").trim();
}

function selectedCount(id) {
  const badge = document.getElementById(`ms-count-${id}`);
  if (badge && !badge.hidden) {
    const value = Number(txt(badge.textContent));
    if (Number.isFinite(value) && value > 0) return value;
  }

  const select = document.getElementById(id);
  if (!select) return 0;
  if (select.multiple)
    return [...select.selectedOptions].filter((option) => txt(option.value))
      .length;
  return txt(select.value) ? 1 : 0;
}

function activeFilterCount() {
  const selected = FILTER_IDS.reduce(
    (total, id) => total + (selectedCount(id) > 0 ? 1 : 0),
    0,
  );
  const search = txt(document.getElementById("fBusca")?.value) ? 1 : 0;
  return selected + search;
}

function activeAdvancedCount() {
  const selected = ADVANCED_FILTER_IDS.reduce(
    (total, id) => total + (selectedCount(id) > 0 ? 1 : 0),
    0,
  );
  const search = txt(document.getElementById("fBusca")?.value) ? 1 : 0;
  return selected + search;
}

function currentScopeLabel() {
  const select = document.getElementById("fSituacaoEdital");
  return txt(
    select?.selectedOptions?.[0]?.textContent || select?.value || "Ativos",
  );
}

function ensureStructure() {
  const panel = document.querySelector(".filter-panel");
  const head = panel?.querySelector(".filter-head");
  const actions = head?.querySelector(".filter-actions");
  const body = document.getElementById("filtersBody");
  const advancedButton = document.getElementById("advancedBtn");
  if (!panel || !head || !actions || !body || !advancedButton) return false;

  const eyebrow = head.querySelector(".eyebrow");
  const title = head.querySelector(".title");
  const hint = head.querySelector(".hint");
  if (eyebrow) eyebrow.textContent = "Filtros da visualização";
  if (title) title.textContent = "Refinar resultados";
  if (hint)
    hint.textContent =
      "Use os filtros para refinar as análises exibidas. Indicadores, gráficos e a fila são atualizados conforme o recorte selecionado.";

  let summary = document.getElementById("filterSummary");
  if (!summary) {
    summary = document.createElement("span");
    summary.id = "filterSummary";
    summary.className = "filter-summary";
    summary.setAttribute("aria-live", "polite");
    actions.insertBefore(summary, actions.firstChild);
  }

  let toolbar = document.getElementById("filtersToolbar");
  if (!toolbar) {
    toolbar = document.createElement("div");
    toolbar.id = "filtersToolbar";
    toolbar.className = "filters-toolbar";
    toolbar.innerHTML = `
      <div class="filters-toolbar-copy">
        <strong>Filtros principais</strong>
        <small>Unidade, edital, vaga, status e responsável.</small>
      </div>`;
    body.insertBefore(toolbar, body.firstChild);
  }

  if (advancedButton.parentElement !== toolbar)
    toolbar.appendChild(advancedButton);

  const toggle = document.getElementById("toggleFiltersBtn");
  if (toggle) toggle.type = "button";

  const clear = document.getElementById("clearBtn");
  if (clear) {
    clear.type = "button";
    clear.textContent = "Limpar tudo";
    clear.title =
      "Remove os filtros e retorna à visualização padrão de processos Ativos.";
  }

  return true;
}

function updateAdvancedButton(open) {
  const button = document.getElementById("advancedBtn");
  if (!button) return;

  const count = activeAdvancedCount();
  const counter = count ? `<span class="advanced-count">${count}</span>` : "";
  button.innerHTML = open
    ? `<i class="fa-solid fa-chevron-up"></i> Menos opções ${counter}`
    : `<i class="fa-solid fa-sliders"></i> Mais opções ${counter}`;
  button.setAttribute("aria-expanded", String(open));
  button.title = open
    ? "Ocultar filtros adicionais"
    : "Mostrar categoria, modalidade, validação e busca";
}

function updateSummary() {
  const summary = document.getElementById("filterSummary");
  const clear = document.getElementById("clearBtn");
  const count = activeFilterCount();
  const scope = currentScopeLabel();
  const tableSearch = txt(document.getElementById("tableSearch")?.value);
  const hasAnything =
    count > 0 ||
    tableSearch ||
    txt(document.getElementById("fSituacaoEdital")?.value) !== "ativo";

  if (summary) {
    summary.classList.toggle("has-filters", count > 0);
    summary.innerHTML = count
      ? `<i class="fa-solid fa-filter-circle-check"></i><span>${scope} · ${count} filtro${count === 1 ? "" : "s"} adicional${count === 1 ? "" : "is"}</span>`
      : `<i class="fa-solid fa-layer-group"></i><span>${scope} · nenhum filtro adicional</span>`;
  }

  if (clear) clear.disabled = !hasAnything;

  const advanced = document.getElementById("advancedFilters");
  updateAdvancedButton(Boolean(advanced?.classList.contains("show")));
}

function scheduleUpdate() {
  window.clearTimeout(state.updateTimer);
  state.updateTimer = window.setTimeout(updateSummary, 0);
}

function setFiltersCollapsed(collapsed) {
  const panel = document.querySelector(".filter-panel");
  const body = document.getElementById("filtersBody");
  const button = document.getElementById("toggleFiltersBtn");
  const advancedButton = document.getElementById("advancedBtn");
  if (!panel || !body || !button) return;

  body.hidden = collapsed;
  panel.classList.toggle("is-collapsed", collapsed);
  button.setAttribute("aria-expanded", String(!collapsed));
  button.title = collapsed
    ? "Mostrar os filtros da visualização"
    : "Ocultar os filtros da visualização";
  button.innerHTML = collapsed
    ? '<i class="fa-solid fa-filter"></i><span class="toggle-label">Mostrar filtros</span>'
    : '<i class="fa-solid fa-chevron-up"></i><span class="toggle-label">Ocultar filtros</span>';

  if (advancedButton) advancedButton.hidden = collapsed;

  if (collapsed) {
    document.getElementById("advancedFilters")?.classList.remove("show");
    updateAdvancedButton(false);
  }

  scheduleUpdate();
}

function toggleAdvanced() {
  const body = document.getElementById("filtersBody");
  const advanced = document.getElementById("advancedFilters");
  if (!body || !advanced) return;

  if (body.hidden) setFiltersCollapsed(false);
  const open = !advanced.classList.contains("show");
  advanced.classList.toggle("show", open);
  updateAdvancedButton(open);
}

function bindControls() {
  document.addEventListener(
    "click",
    (event) => {
      const toggle = event.target?.closest?.("#toggleFiltersBtn");
      if (toggle) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setFiltersCollapsed(!document.getElementById("filtersBody")?.hidden);
        return;
      }

      const advanced = event.target?.closest?.("#advancedBtn");
      if (advanced) {
        event.preventDefault();
        event.stopImmediatePropagation();
        toggleAdvanced();
        return;
      }

      if (
        event.target?.closest?.(
          "#clearBtn,.multi-select-option,.multi-select-link,[data-kpi]",
        )
      )
        scheduleUpdate();
    },
    true,
  );

  document.addEventListener(
    "change",
    (event) => {
      if (
        event.target?.closest?.(".filter-panel") ||
        event.target?.id === "fSituacaoEdital"
      )
        scheduleUpdate();
    },
    true,
  );

  document.addEventListener(
    "input",
    (event) => {
      if (event.target?.matches?.("#fBusca,#tableSearch")) scheduleUpdate();
    },
    true,
  );

  document.addEventListener("agsus:analises-query-complete", scheduleUpdate);
}

function start() {
  if (state.initialized) return;
  state.initialized = true;

  if (!ensureStructure()) return;
  bindControls();
  // No carregamento normal: filtros principais à vista, Mais opções à vista e
  // os avançados fechados. Arrancar recolhido escondia o próprio botão que dá
  // acesso a eles.
  setFiltersCollapsed(false);
  updateSummary();
}

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
