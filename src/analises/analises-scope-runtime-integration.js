const CACHE_PREFIX = "agsus_analises_cache_v1_v";
const LEGACY_UNIT_ID = "scopeGuardUnits";
const LEGACY_EDITAL_ID = "scopeGuardEditais";

let syncingLegacySelections = false;

const txt = (value) => String(value ?? "").trim();
const currentScope = () => {
  const value = txt(
    document.getElementById("fSituacaoEdital")?.value,
  ).toLowerCase();
  return ["ativo", "inativo", "todos"].includes(value) ? value : "ativo";
};

function checkedValues(type) {
  return [
    ...document.querySelectorAll(
      `#scopeGuardSafe input[data-type="${type}"]:checked`,
    ),
  ]
    .map((input) => txt(input.value))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
}

function ensureLegacySelect(id) {
  let select = document.getElementById(id);
  if (select) return select;
  select = document.createElement("select");
  select.id = id;
  select.multiple = true;
  select.hidden = true;
  select.tabIndex = -1;
  select.setAttribute("aria-hidden", "true");
  select.dataset.scopeCompatibility = "true";
  document.body.appendChild(select);
  return select;
}

function replaceSelectedOptions(select, values) {
  const signature = JSON.stringify(values);
  if (select.dataset.selectionSignature === signature) return false;
  select.dataset.selectionSignature = signature;
  select.replaceChildren(
    ...values.map((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      option.selected = true;
      return option;
    }),
  );
  return true;
}

function syncLegacySelections({ notify = true } = {}) {
  if (syncingLegacySelections || !document.body) return;
  syncingLegacySelections = true;
  try {
    const units = ensureLegacySelect(LEGACY_UNIT_ID);
    const editais = ensureLegacySelect(LEGACY_EDITAL_ID);
    const changedUnits = replaceSelectedOptions(units, checkedValues("unit"));
    const changedEditais = replaceSelectedOptions(
      editais,
      checkedValues("edital"),
    );
    if (notify && (changedUnits || changedEditais)) {
      if (changedUnits)
        units.dispatchEvent(new Event("change", { bubbles: true }));
      if (changedEditais)
        editais.dispatchEvent(new Event("change", { bubbles: true }));
    }
  } finally {
    syncingLegacySelections = false;
  }
}

function hasCompleteSelection() {
  return checkedValues("unit").length > 0 && checkedValues("edital").length > 0;
}

function clearScopedCache() {
  const scope = currentScope();
  if (scope === "ativo") return;
  try {
    const suffix = `_${scope}`;
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(CACHE_PREFIX) && key.endsWith(suffix)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.warn(
      "Não foi possível limpar o cache do recorte de análises:",
      error,
    );
  }
}

function clearObsoletePendingClass() {
  if (
    currentScope() === "ativo" ||
    !document.body.classList.contains("analises-awaiting-scope")
  ) {
    document.body.classList.remove("historical-scope-pending");
  }
}

function ensureStyles() {
  if (document.getElementById("analisesScopeRuntimeIntegrationStyles")) return;
  const style = document.createElement("style");
  style.id = "analisesScopeRuntimeIntegrationStyles";
  style.textContent = `
    #${LEGACY_UNIT_ID},#${LEGACY_EDITAL_ID}{display:none!important}
    .scope-safe-options{gap:3px!important}
    .scope-safe-option{
      display:flex!important;
      align-items:flex-start!important;
      justify-content:flex-start!important;
      gap:10px!important;
      min-height:36px!important;
      padding:8px 10px!important;
      text-align:left!important;
    }
    .scope-safe-option input[type="checkbox"]{
      appearance:auto!important;
      -webkit-appearance:checkbox!important;
      width:16px!important;
      min-width:16px!important;
      max-width:16px!important;
      height:16px!important;
      min-height:16px!important;
      max-height:16px!important;
      flex:0 0 16px!important;
      margin:1px 0 0!important;
      padding:0!important;
      border-radius:3px!important;
      box-shadow:none!important;
    }
    .scope-safe-option > span{
      display:block!important;
      flex:1 1 auto!important;
      min-width:0!important;
      line-height:1.35!important;
      white-space:normal!important;
      overflow-wrap:anywhere!important;
    }
  `;
  document.head.appendChild(style);
}

function scheduleSync() {
  window.setTimeout(() => {
    syncLegacySelections();
    clearObsoletePendingClass();
  }, 0);
}

function init() {
  ensureStyles();
  syncLegacySelections({ notify: false });
  clearObsoletePendingClass();

  window.addEventListener(
    "click",
    (event) => {
      const consult = event.target?.closest?.("#scopeGuardLoad");
      if (!consult) return;
      syncLegacySelections();
      if (hasCompleteSelection()) clearScopedCache();
    },
    true,
  );

  window.addEventListener(
    "change",
    (event) => {
      if (event.target?.id === "fSituacaoEdital") syncLegacySelections();
    },
    true,
  );

  document.addEventListener("click", (event) => {
    if (event.target?.closest?.("#scopeGuardSafe")) scheduleSync();
  });

  document.addEventListener("change", (event) => {
    if (event.target?.matches?.("#scopeGuardSafe input[data-type]"))
      scheduleSync();
  });

  document.addEventListener("agsus:analises-loading-end", () => {
    clearObsoletePendingClass();
    const status = document.getElementById("scopeGuardStatus");
    const total = txt(document.getElementById("kTotal")?.textContent);
    if (
      status &&
      currentScope() !== "ativo" &&
      hasCompleteSelection() &&
      total
    ) {
      status.textContent = `Consulta concluída: ${total} registro(s) no recorte.`;
      status.classList.remove("is-warning");
    }
  });

  document.addEventListener(
    "agsus:analises-query-complete",
    clearObsoletePendingClass,
  );
}

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
