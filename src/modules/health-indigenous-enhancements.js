const UNIT_FILTER_ID = "filterUnidade";
let unitQuery = "";
let initialized = false;

export function normalizeHealthFilterValue(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function visibleUnitOptions(container) {
  return [...container.querySelectorAll(".multi-option:not(.empty)")].filter(
    (option) => !option.hidden && getComputedStyle(option).display !== "none",
  );
}

function visibleUnitValues(container) {
  return visibleUnitOptions(container)
    .map(
      (option) =>
        option.querySelector("input[data-filter-value]")?.dataset.filterValue ||
        "",
    )
    .filter(Boolean);
}

function applyUnitSearch(container, query) {
  const normalizedQuery = normalizeHealthFilterValue(query);
  const options = [...container.querySelectorAll(".multi-option:not(.empty)")];
  let visible = 0;

  options.forEach((option) => {
    const matches =
      !normalizedQuery ||
      normalizeHealthFilterValue(option.textContent).includes(normalizedQuery);
    option.hidden = !matches;
    if (matches) visible += 1;
  });

  const hint = container.querySelector(".multi-hint");
  if (hint) {
    hint.textContent = normalizedQuery
      ? `${visible} de ${options.length} unidade(s) encontrada(s).`
      : `${options.length} unidade(s) disponível(is).`;
  }

  const selectVisible = container.querySelector(
    '[data-filter-action="select-all"]',
  );
  if (selectVisible) {
    selectVisible.textContent = normalizedQuery
      ? `Selecionar ${visible} visível(is)`
      : "Selecionar todas";
    selectVisible.disabled = normalizedQuery.length > 0 && visible === 0;
  }

  let empty = container.querySelector(".health-unit-search-empty");
  if (normalizedQuery && visible === 0) {
    if (!empty) {
      empty = document.createElement("div");
      empty.className = "health-unit-search-empty";
      empty.textContent = "Nenhuma unidade encontrada.";
      container.querySelector(".multi-options")?.appendChild(empty);
    }
    empty.hidden = false;
  } else if (empty) {
    empty.hidden = true;
  }
}

function resetUnitSearch() {
  unitQuery = "";
  const container = document.getElementById(UNIT_FILTER_ID);
  const input = container?.querySelector(".health-unit-search input");
  if (input) input.value = "";
  if (container) applyUnitSearch(container, "");
}

function ensureUnitSearch(container, focus = false) {
  const menu = container?.querySelector(".multi-select-menu");
  if (!menu) return;

  let wrap = menu.querySelector(".health-unit-search");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "health-unit-search";
    wrap.innerHTML = `
      <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
      <input type="search" autocomplete="off" aria-label="Pesquisar unidade" placeholder="Pesquisar unidade...">
    `;

    const input = wrap.querySelector("input");
    input.value = unitQuery;

    ["click", "pointerdown", "keydown"].forEach((eventName) => {
      wrap.addEventListener(eventName, (event) => event.stopPropagation());
    });

    input.addEventListener("input", () => {
      unitQuery = input.value;
      applyUnitSearch(container, unitQuery);
    });

    input.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      resetUnitSearch();
      container.classList.remove("open");
      container.querySelector(".multi-select-toggle")?.focus();
    });

    menu.insertAdjacentElement("afterbegin", wrap);
  }

  const input = wrap.querySelector("input");
  if (input && input.value !== unitQuery) input.value = unitQuery;
  applyUnitSearch(container, unitQuery);
  if (focus) requestAnimationFrame(() => input?.focus());
}

function refreshAfterLegacyRender(focus = false) {
  window.setTimeout(() => {
    const container = document.getElementById(UNIT_FILTER_ID);
    if (container?.classList.contains("open"))
      ensureUnitSearch(container, focus);
  }, 0);
}

async function selectOnlyVisibleUnits(container, values) {
  const clear = window.clearFilterField;
  if (typeof clear !== "function") return;

  clear("unidade");
  for (const value of values) {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    const current = document.getElementById(UNIT_FILTER_ID);
    const selector = `input[data-filter-field="unidade"][data-filter-value="${CSS.escape(value)}"]`;
    const input = current?.querySelector(selector);
    if (input && !input.checked) {
      input.checked = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
  refreshAfterLegacyRender(true);
}

function interceptVisibleSelection(event) {
  const action = event.target.closest?.(
    `#${UNIT_FILTER_ID} [data-filter-action="select-all"]`,
  );
  if (!action || !unitQuery.trim()) return;

  const container = document.getElementById(UNIT_FILTER_ID);
  const values = container ? visibleUnitValues(container) : [];
  event.preventDefault();
  event.stopImmediatePropagation();
  if (values.length) void selectOnlyVisibleUnits(container, values);
}

function checkedRiskValues() {
  return [
    ...document.querySelectorAll(
      '#filterRisco input[data-filter-field="risco"]:checked',
    ),
  ].map((input) => normalizeHealthFilterValue(input.dataset.filterValue));
}

function availableCriticalRiskValues() {
  return [
    ...document.querySelectorAll(
      '#filterRisco input[data-filter-field="risco"]',
    ),
  ]
    .map((input) => normalizeHealthFilterValue(input.dataset.filterValue))
    .filter((value) => value === "alto" || value === "medio");
}

function exactCriticalRiskSelection() {
  const selected = new Set(checkedRiskValues());
  const expected = new Set(availableCriticalRiskValues());
  return (
    expected.size > 0 &&
    selected.size === expected.size &&
    [...expected].every((value) => selected.has(value))
  );
}

function wrapLegacyActions() {
  const originalClear = window.clearFilters;
  if (typeof originalClear === "function" && !originalClear.__healthWrapped) {
    const wrappedClear = function (...args) {
      resetUnitSearch();
      return originalClear.apply(this, args);
    };
    wrappedClear.__healthWrapped = true;
    window.clearFilters = wrappedClear;
  }

  const originalCritical = window.toggleCriticalRiskFilter;
  if (
    typeof originalCritical === "function" &&
    !originalCritical.__healthWrapped
  ) {
    const wrappedCritical = function (...args) {
      const exactBefore = exactCriticalRiskSelection();
      if (exactBefore) return originalCritical.apply(this, args);

      let result = originalCritical.apply(this, args);
      if (!exactCriticalRiskSelection())
        result = originalCritical.apply(this, args);
      return result;
    };
    wrappedCritical.__healthWrapped = true;
    window.toggleCriticalRiskFilter = wrappedCritical;
  }
}

function handleClick(event) {
  const toggle = event.target.closest?.(
    `#${UNIT_FILTER_ID} .multi-select-toggle`,
  );
  if (toggle) {
    refreshAfterLegacyRender(true);
    return;
  }

  const action = event.target.closest?.(
    `#${UNIT_FILTER_ID} [data-filter-action]`,
  );
  if (action) refreshAfterLegacyRender(false);
}

function handleChange(event) {
  if (event.target.matches?.(`#${UNIT_FILTER_ID} input[data-filter-field]`)) {
    refreshAfterLegacyRender(false);
  }
}

export function initHealthIndigenousEnhancements() {
  if (initialized) return;
  initialized = true;
  wrapLegacyActions();
  document.addEventListener("click", interceptVisibleSelection, true);
  document.addEventListener("click", handleClick);
  document.addEventListener("change", handleChange);
}
