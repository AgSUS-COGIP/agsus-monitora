import {
  anoDaSelecao,
  anosDosEditais,
  editaisDoAno,
  SITUACOES,
  situacaoDaSelecao,
  statusDaSituacao,
} from "../lib/atalhos-de-filtro.js";
import { enhanceHealthDetailsTable } from "./health-details-ux.js";

const state = {
  initialized: false,
  watchTimer: 0,
  lastSignature: "",
  only2026: false,
  previousEditalSelection: [],
};

const FILTER_FIELDS = ["unidade", "edital", "etapa", "status", "risco", "uf"];
const FILTER_ICONS = {
  filterUnidade: "fa-building",
  filterEdital: "fa-file-lines",
  filterEtapa: "fa-list-check",
  filterStatus: "fa-signal",
  filterRisco: "fa-triangle-exclamation",
  filterUf: "fa-map-location-dot",
};

const $ = (documentRef, id) => documentRef?.getElementById?.(id) || null;
const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
const rawFilterValue = (input) =>
  String(input?.dataset?.filterValue ?? input?.value ?? "").trim();
const is2026Edital = (value) => /\/2026(?:\D|$)/.test(String(value ?? ""));

function ensureIntro(documentRef) {
  const tableCard = documentRef.querySelector?.("#page-dashboard .table-card");
  const meta = $(documentRef, "tableMeta");
  if (!tableCard || !meta) return null;

  let intro = tableCard.querySelector(".health-details-intro");
  if (!intro) {
    intro = documentRef.createElement("div");
    intro.className = "health-details-intro health-details-intro-immediate";
    intro.innerHTML = `
      <div>
        <strong>Processos seletivos</strong>
      </div>
      <div class="health-details-legend">
        <span><i class="fa-solid fa-calendar-days health-legend-icon deadline"></i> Prazo do edital</span>
        <span><i class="fa-solid fa-route health-legend-icon schedule"></i> Próxima etapa</span>
      </div>`;
    meta.insertAdjacentElement("beforebegin", intro);
  }
  return intro;
}

function hideLegacy2026Button(documentRef) {
  const legacy = $(documentRef, "healthOnly2026Btn");
  if (!legacy) return null;
  legacy.hidden = true;
  legacy.classList.add("health-year-filter-sentinel");
  legacy.setAttribute("aria-hidden", "true");
  legacy.tabIndex = -1;
  return legacy;
}

function hideDuplicateClosedButton(documentRef) {
  const original = $(documentRef, "hideClosedBtn");
  if (!original) return null;
  original.hidden = true;
  original.classList.add("health-closed-filter-sentinel");
  original.setAttribute("aria-hidden", "true");
  original.tabIndex = -1;
  documentRef.body?.classList.add("health-filter-toolbar-ready");
  return original;
}

function filterInputs(documentRef, field) {
  return [
    ...documentRef.querySelectorAll(`input[data-filter-field="${field}"]`),
  ];
}

function selectedFilterValues(documentRef, field) {
  return filterInputs(documentRef, field)
    .filter((input) => input.checked)
    .map(rawFilterValue)
    .filter(Boolean);
}

function allFilterValues(documentRef, field) {
  return filterInputs(documentRef, field).map(rawFilterValue).filter(Boolean);
}

function edital2026Values(documentRef) {
  return allFilterValues(documentRef, "edital").filter(is2026Edital);
}

function isOnly2026Selection(documentRef) {
  const target = edital2026Values(documentRef);
  const selected = selectedFilterValues(documentRef, "edital");
  if (!target.length || selected.length !== target.length) return false;
  const selectedSet = new Set(selected);
  return target.every((value) => selectedSet.has(value));
}

function setFilterFieldSelection(
  documentRef,
  field,
  desiredValues,
  windowRef = null,
) {
  const desired = new Set(
    (desiredValues || []).map((value) => String(value).trim()).filter(Boolean),
  );
  // Uma mudança de estado só (um render), quando o app oferece o atalho.
  if (typeof windowRef?.definirSelecaoDeFiltro === "function") {
    return windowRef.definirSelecaoDeFiltro(field, [...desired]);
  }
  const knownValues = allFilterValues(documentRef, field);

  knownValues.forEach((value) => {
    const input = filterInputs(documentRef, field).find(
      (candidate) => rawFilterValue(candidate) === value,
    );
    if (!input || input.checked === desired.has(value)) return;
    input.click();
  });

  return selectedFilterValues(documentRef, field);
}

function findFilterInput(documentRef, field, predicate) {
  return filterInputs(documentRef, field).find((input) =>
    predicate(
      normalize(rawFilterValue(input) || input.parentElement?.textContent),
    ),
  );
}

function selectedFieldValues(documentRef, field) {
  return selectedFilterValues(documentRef, field)
    .map(normalize)
    .filter(Boolean);
}

function isHideClosedActive(documentRef) {
  return (
    $(documentRef, "hideClosedBtn")?.getAttribute("aria-pressed") === "true"
  );
}

function activeFilterCount(documentRef) {
  let count = FILTER_FIELDS.reduce((total, field) => {
    return (
      total +
      (documentRef.querySelector(`input[data-filter-field="${field}"]:checked`)
        ? 1
        : 0)
    );
  }, 0);
  if (String($(documentRef, "tableSearch")?.value || "").trim()) count += 1;
  if (isHideClosedActive(documentRef)) count += 1;
  return count;
}

function syncFilterToggle(documentRef, count) {
  const body = $(documentRef, "filterBody");
  const button = $(documentRef, "filterToggleBtn");
  if (!body || !button) return;
  const expanded = !body.classList.contains("hidden");
  button.classList.add("health-filter-toggle");
  button.setAttribute("aria-expanded", String(expanded));
  button.setAttribute("aria-controls", "filterBody");
  button.innerHTML = `
    <i class="fa-solid fa-sliders" aria-hidden="true"></i>
    <span>${expanded ? "Ocultar filtros" : "Mostrar filtros"}</span>
    ${count ? `<b>${count}</b>` : ""}
    <i class="fa-solid fa-chevron-${expanded ? "up" : "down"} health-filter-chevron" aria-hidden="true"></i>`;
}

export function syncFilterToolbar(
  windowRef = globalThis.window,
  documentRef = globalThis.document,
) {
  const exact2026Selection = isOnly2026Selection(documentRef);
  if (exact2026Selection && !state.only2026) {
    state.only2026 = true;
    state.previousEditalSelection = [];
  } else if (state.only2026 && !exact2026Selection) {
    state.only2026 = false;
    state.previousEditalSelection = [];
  }

  sincronizarAtalhos(documentRef);

  const count = activeFilterCount(documentRef);
  const clear = $(documentRef, "healthQuickClearBtn");
  if (clear) clear.hidden = count === 0;
  syncFilterToggle(documentRef, count);
  return count;
}

/*
  Ano ▾ e Situação (Todos · Em andamento · Encerrados), no lugar dos botões
  "Editais 2026", "Em andamento", "Risco médio/alto" e "Ocultar encerrados".
  Lógica em src/lib/atalhos-de-filtro.js; aqui só o DOM e os filtros do app.
*/
function montarAtalhos(windowRef, documentRef, grupo) {
  if (!$(documentRef, "healthFiltroAno")) {
    const campo = documentRef.createElement("label");
    campo.className = "health-filtro-ano";
    campo.innerHTML =
      '<span>Ano</span><select id="healthFiltroAno" aria-label="Ano do edital"></select>';
    campo.querySelector("select").addEventListener("change", (evento) => {
      const ano = evento.target.value;
      if (ano === "personalizado") return;
      const editais = allFilterValues(documentRef, "edital");
      state.only2026 = false;
      state.previousEditalSelection = [];
      setFilterFieldSelection(
        documentRef,
        "edital",
        ano ? editaisDoAno(editais, ano) : [],
        windowRef,
      );
      windowRef.setTimeout(() => syncFilterToolbar(windowRef, documentRef), 0);
    });
    grupo.appendChild(campo);
  }

  if (!$(documentRef, "healthFiltroSituacao")) {
    const seletor = documentRef.createElement("div");
    seletor.id = "healthFiltroSituacao";
    seletor.className = "health-filtro-situacao";
    seletor.setAttribute("role", "radiogroup");
    seletor.setAttribute("aria-label", "Situação do processo");
    seletor.innerHTML = SITUACOES.map(
      ({ id, rotulo }) =>
        `<button type="button" role="radio" aria-checked="false" data-situacao="${id}">${rotulo}</button>`,
    ).join("");
    seletor.addEventListener("click", (evento) => {
      const botao = evento.target.closest("[data-situacao]");
      if (!botao) return;
      // "Ocultar encerrados" deixou de ter botão: se estava ligado, desliga,
      // senão ninguém mais conseguiria tirar esse filtro.
      if (isHideClosedActive(documentRef)) windowRef?.toggleHideClosed?.();
      const alvo = statusDaSituacao(
        botao.dataset.situacao,
        allFilterValues(documentRef, "status"),
      );
      setFilterFieldSelection(documentRef, "status", alvo, windowRef);
      windowRef.setTimeout(() => syncFilterToolbar(windowRef, documentRef), 0);
    });
    grupo.appendChild(seletor);
  }

  // Preferência antiga de "Ocultar encerrados" salva no navegador, sem botão.
  if (isHideClosedActive(documentRef)) windowRef?.toggleHideClosed?.();
}

function sincronizarAtalhos(documentRef) {
  const select = $(documentRef, "healthFiltroAno");
  if (select) {
    const editais = allFilterValues(documentRef, "edital");
    const atual = anoDaSelecao(
      selectedFilterValues(documentRef, "edital"),
      editais,
    );
    const opcoes = [
      '<option value="">Todos os anos</option>',
      ...anosDosEditais(editais).map(
        (ano) => `<option value="${ano}">${ano}</option>`,
      ),
      atual === "personalizado"
        ? '<option value="personalizado" disabled>Seleção própria</option>'
        : "",
    ].join("");
    if (select.dataset.opcoes !== opcoes) {
      select.innerHTML = opcoes;
      select.dataset.opcoes = opcoes;
    }
    select.value = atual;
    select.closest("label")?.classList.toggle("is-active", atual !== "");
  }

  const seletor = $(documentRef, "healthFiltroSituacao");
  if (seletor) {
    const situacao = situacaoDaSelecao(
      selectedFilterValues(documentRef, "status"),
      allFilterValues(documentRef, "status"),
    );
    seletor.querySelectorAll("[data-situacao]").forEach((botao) => {
      botao.setAttribute(
        "aria-checked",
        String(botao.dataset.situacao === situacao),
      );
    });
  }
}

export function ensureTopFilterToolbar(
  windowRef = globalThis.window,
  documentRef = globalThis.document,
) {
  const head = documentRef.querySelector?.("#page-dashboard .filter-head");
  const toggle = $(documentRef, "filterToggleBtn");
  if (!head || !toggle) return null;

  hideLegacy2026Button(documentRef);
  hideDuplicateClosedButton(documentRef);
  head.classList.add("health-filter-head");
  $(documentRef, "filterBody")?.classList.add("health-filter-body-enhanced");

  let actions = head.querySelector(".health-filter-actions");
  if (!actions) {
    actions = documentRef.createElement("div");
    actions.className = "health-filter-actions";
    head.appendChild(actions);
  }

  let quickGroup = actions.querySelector(".health-filter-quick-group");
  if (!quickGroup) {
    quickGroup = documentRef.createElement("div");
    quickGroup.className = "health-filter-quick-group";
    actions.appendChild(quickGroup);
  }

  montarAtalhos(windowRef, documentRef, quickGroup);

  let clear = $(documentRef, "healthQuickClearBtn");
  if (!clear) {
    clear = documentRef.createElement("button");
    clear.id = "healthQuickClearBtn";
    clear.type = "button";
    clear.className = "health-filter-clear-top";
    clear.title = "Limpar todos os filtros";
    clear.innerHTML =
      '<i class="fa-solid fa-xmark" aria-hidden="true"></i><span>Limpar</span>';
    clear.addEventListener("click", () => {
      state.only2026 = false;
      state.previousEditalSelection = [];
      windowRef?.clearFilters?.();
      windowRef.setTimeout(() => syncFilterToolbar(windowRef, documentRef), 0);
    });
  }
  if (clear.parentElement !== actions) actions.appendChild(clear);
  if (toggle.parentElement !== actions) actions.appendChild(toggle);

  syncFilterToolbar(windowRef, documentRef);
  return actions;
}

function decorateFilterFields(documentRef) {
  const body = $(documentRef, "filterBody");
  if (!body) return;

  [...body.children].forEach((child) => {
    if (child.tagName === "BUTTON") {
      child.classList.add("health-filter-clear-body");
      child.innerHTML =
        '<i class="fa-solid fa-eraser" aria-hidden="true"></i> Limpar filtros';
      return;
    }

    const select = child.querySelector?.(".multi-select");
    const label = child.querySelector?.("label");
    if (!select || !label) return;
    child.classList.add("health-filter-field");
    if (label.dataset.healthReady !== "1") {
      const icon = FILTER_ICONS[select.id] || "fa-filter";
      const text = label.textContent.trim();
      label.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i><span>${text}</span>`;
      label.dataset.healthReady = "1";
    }
  });
}

function ensureFilterExperience(windowRef, documentRef) {
  ensureTopFilterToolbar(windowRef, documentRef);
  decorateFilterFields(documentRef);
  syncFilterToolbar(windowRef, documentRef);
}

function ensureOperationalPlaceholders(documentRef) {
  const headers = [
    ...documentRef.querySelectorAll(
      "#page-dashboard .details-table thead th[data-sort-field]",
    ),
  ];
  const editalIndex = headers.findIndex(
    (header) => header.dataset.sortField === "edital",
  );
  if (editalIndex < 0) return 0;

  let inserted = 0;
  documentRef.querySelectorAll("#monitorRows tr").forEach((row) => {
    if (row.querySelector("td[colspan]")) return;
    const cell = row.querySelectorAll("td")[editalIndex];
    if (!cell) return;

    const realBadge = cell.querySelector(".health-row-operational");
    const placeholder = cell.querySelector(".health-operational-loading");
    /*
      `data-health-detail-id` chega com os dados de cronograma
      (health-status-details.js). Depois disso, linha sem selo é linha que não
      tem selo — o refinement remove o dos editais concluídos e cancelados —, e
      o "Carregando cronograma..." ficava nela para sempre (83 de 99 linhas).
    */
    if (realBadge || row.dataset.healthDetailId) {
      placeholder?.remove();
      return;
    }
    if (placeholder) return;

    cell.insertAdjacentHTML(
      "beforeend",
      `
      <div class="health-operational-loading tone-neutral" aria-label="Carregando cronograma">
        <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
        <span>Carregando cronograma...</span>
      </div>`,
    );
    inserted += 1;
  });
  return inserted;
}

function rowSignature(documentRef) {
  const tbody = $(documentRef, "monitorRows");
  if (!tbody) return "";
  return [
    tbody.querySelectorAll("tr").length,
    tbody.querySelectorAll(".expiry-badge,.health-deadline-badge").length,
    tbody.querySelectorAll(".health-row-operational").length,
    tbody.querySelectorAll(".health-operational-loading").length,
    tbody.textContent.length,
  ].join("|");
}

function applyImmediateEnhancement(documentRef) {
  ensureIntro(documentRef);
  ensureOperationalPlaceholders(documentRef);
  enhanceHealthDetailsTable(documentRef);
  ensureOperationalPlaceholders(documentRef);
}

export function startTableRenderWatch(
  windowRef = globalThis.window,
  documentRef = globalThis.document,
  options = {},
) {
  const interval = Number(options.interval || 40);
  const maxAttempts = Number(options.maxAttempts || 200);
  let attempts = 0;
  let stableChecks = 0;

  windowRef.clearTimeout(state.watchTimer);

  const tick = () => {
    attempts += 1;
    ensureFilterExperience(windowRef, documentRef);
    const signature = rowSignature(documentRef);
    if (signature && signature !== state.lastSignature) {
      state.lastSignature = signature;
      stableChecks = 0;
      applyImmediateEnhancement(documentRef);
    } else if (signature) {
      stableChecks += 1;
    }

    const hasRows = !!$(documentRef, "monitorRows")?.querySelector("tr");
    const loading = !!$(documentRef, "monitorRows")?.querySelector(
      ".health-operational-loading",
    );
    const canStop = hasRows && !loading && stableChecks >= 8;

    if (!canStop && attempts < maxAttempts) {
      state.watchTimer = windowRef.setTimeout(tick, interval);
    }
  };

  tick();
}

export function initHealthDetailsRuntimeFix(
  windowRef = globalThis.window,
  documentRef = globalThis.document,
) {
  if (state.initialized || !windowRef || !documentRef) return;
  state.initialized = true;

  ensureFilterExperience(windowRef, documentRef);
  ensureIntro(documentRef);
  startTableRenderWatch(windowRef, documentRef);

  documentRef.addEventListener("input", (event) => {
    if (event.target?.id === "tableSearch") {
      windowRef.setTimeout(() => syncFilterToolbar(windowRef, documentRef), 0);
    }
  });

  documentRef.addEventListener("click", (event) => {
    if (!event.target?.closest?.("#page-dashboard")) return;
    windowRef.setTimeout(() => {
      ensureFilterExperience(windowRef, documentRef);
      applyImmediateEnhancement(documentRef);
    }, 0);
  });

  documentRef.addEventListener("change", (event) => {
    if (!event.target?.closest?.("#page-dashboard")) return;
    windowRef.setTimeout(
      () => ensureFilterExperience(windowRef, documentRef),
      0,
    );
  });

  // Aviso único do app a cada aplicação de filtros (ver applyFilters).
  documentRef.addEventListener("agsus:filtros-alterados", () => {
    syncFilterToolbar(windowRef, documentRef);
  });

  documentRef.addEventListener("agsus:dashboard-rendered", () => {
    ensureFilterExperience(windowRef, documentRef);
    startTableRenderWatch(windowRef, documentRef, { maxAttempts: 100 });
  });

  windowRef.addEventListener("focus", () => {
    if ($(documentRef, "page-dashboard")?.classList.contains("active")) {
      ensureFilterExperience(windowRef, documentRef);
      startTableRenderWatch(windowRef, documentRef, { maxAttempts: 100 });
    }
  });
}
