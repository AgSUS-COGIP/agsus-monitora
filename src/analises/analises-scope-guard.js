const TARGET_VIEWS = new Set([
  "VW_ANALISES_DASHBOARD_BASE",
  "VW_ANALISES_DASHBOARD_BASE_TODOS",
]);
const RPC = "get_analises_dashboard_filtrado";
const PAGE_SIZE = 1000;

const state = {
  client: null,
  catalog: [],
  units: [],
  editais: [],
  activeKey: "",
  total: null,
  loadingCatalog: false,
  catalogLoaded: false,
  catalogRetry: 0,
};

const txt = (value) => String(value ?? "").trim();
const esc = (value) =>
  txt(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
const norm = (value) => txt(value).toLowerCase();
const sorted = (values) =>
  [...new Set([...values].map(txt).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "pt-BR", { numeric: true }),
  );

function scope() {
  const value = norm(document.getElementById("fSituacaoEdital")?.value);
  return ["ativo", "inativo", "todos"].includes(value) ? value : "ativo";
}

function scopeLabel() {
  return (
    { ativo: "Ativo", inativo: "Inativo", todos: "Todos" }[scope()] || "Ativo"
  );
}

function scopedMode() {
  return scope() !== "ativo";
}
function key() {
  return JSON.stringify({
    scope: scope(),
    units: sorted(state.units),
    editais: sorted(state.editais),
  });
}
function authorized() {
  return Boolean(
    scopedMode() &&
    state.activeKey &&
    state.activeKey === key() &&
    state.units.length &&
    state.editais.length,
  );
}

function setStatus(message, warning = false) {
  const el = document.getElementById("scopeGuardStatus");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("is-warning", warning);
}

function resetSelection() {
  state.units = [];
  state.editais = [];
  state.activeKey = "";
  state.total = null;
}

function blockResults(block) {
  document.body.classList.toggle("analises-awaiting-scope", Boolean(block));
}

function syncPendingContext() {
  const context = document.getElementById("contextLine");
  const chips = document.getElementById("filterChips");
  const label = scopeLabel();
  if (context)
    context.textContent = `Aguardando definição do recorte para processos ${label.toLowerCase()}.`;
  if (chips)
    chips.innerHTML = `<span class="chip-filter"><b>Filtro</b>Situação do processo: ${esc(label)}</span>`;
}

async function rpcPage(offset, limit) {
  const includeTotal = offset === 0;
  const { data, error } = await state.client.rpc(RPC, {
    p_scope: scope(),
    p_unidades: state.units,
    p_editais: state.editais,
    p_offset: offset,
    p_limit: Math.min(Math.max(limit, 1), PAGE_SIZE),
    p_include_total: includeTotal,
  });
  if (error) throw error;
  const payload = data && typeof data === "object" ? data : {};
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  if (includeTotal && payload.total !== undefined && payload.total !== null)
    state.total = Number(payload.total || 0);
  const loaded = Math.min(
    offset + rows.length,
    state.total ?? offset + rows.length,
  );
  setStatus(
    `Carregando ${loaded.toLocaleString("pt-BR")}${state.total === null ? "" : ` de ${state.total.toLocaleString("pt-BR")}`} registro(s)...`,
  );
  return { rows, total: state.total };
}

function rpcBuilder() {
  let start = 0;
  let end = PAGE_SIZE - 1;
  const builder = {
    select() {
      return builder;
    },
    range(from, to) {
      start = Math.max(Number(from) || 0, 0);
      end = Math.max(Number(to) || start, start);
      return builder;
    },
    order() {
      return builder;
    },
    eq() {
      return builder;
    },
    in() {
      return builder;
    },
    then(resolve) {
      return rpcPage(start, end - start + 1)
        .then((result) =>
          resolve({ data: result.rows, error: null, count: result.total }),
        )
        .catch((error) => resolve({ data: [], error }));
    },
  };
  return builder;
}

function blockedBuilder() {
  const builder = {
    select() {
      return builder;
    },
    range() {
      return builder;
    },
    order() {
      return builder;
    },
    eq() {
      return builder;
    },
    in() {
      return builder;
    },
    then(resolve) {
      return Promise.resolve(resolve({ data: [], error: null, count: 0 }));
    },
  };
  return builder;
}

function patchClient() {
  const supabase = window.supabase;
  if (!supabase?.createClient || supabase.__agsusAnalisesScopeSafe) return;
  const originalCreate = supabase.createClient.bind(supabase);
  supabase.createClient = (...args) => {
    const client = originalCreate(...args);
    state.client = client;
    const originalFrom = client.from.bind(client);
    client.from = (table) => {
      if (!TARGET_VIEWS.has(table) || scope() === "ativo")
        return originalFrom(table);
      return authorized() ? rpcBuilder() : blockedBuilder();
    };
    queueMicrotask(() => loadCatalog());
    return client;
  };
  supabase.__agsusAnalisesScopeSafe = true;
}

function ensureStyles() {
  if (document.getElementById("analisesScopeSafeStyles")) return;
  const style = document.createElement("style");
  style.id = "analisesScopeSafeStyles";
  style.textContent = `
    .scope-safe{margin:0 0 14px;padding:15px;border:1px solid color-mix(in srgb,var(--blue2) 22%,var(--line));border-left:5px solid var(--blue2);border-radius:16px;background:linear-gradient(135deg,color-mix(in srgb,var(--blue2) 7%,var(--card)),var(--card));display:grid;gap:13px}
    .scope-safe[hidden]{display:none!important}.scope-safe-head{display:flex;gap:11px;align-items:flex-start}.scope-safe-head i{color:var(--blue2);margin-top:3px}.scope-safe-head strong{display:block;color:var(--strong);margin-bottom:4px}.scope-safe-head small{color:var(--muted);line-height:1.45}
    .scope-safe-grid{display:grid;grid-template-columns:minmax(230px,1fr) minmax(230px,1fr) auto;gap:12px;align-items:end}.scope-safe-field{display:grid;gap:6px;min-width:0}.scope-safe-field>label{font-size:11px;font-weight:850;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
    .scope-safe-multi{position:relative}.scope-safe-trigger{width:100%;min-height:44px;padding:0 12px;border:1px solid var(--line2);border-radius:12px;background:var(--card);color:var(--text);display:flex;align-items:center;justify-content:space-between;gap:10px;font:inherit;font-weight:750;cursor:pointer}.scope-safe-trigger:disabled{opacity:.55;cursor:not-allowed}.scope-safe-trigger span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.scope-safe-menu{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:90;max-height:290px;overflow:auto;padding:8px;border:1px solid var(--line2);border-radius:13px;background:var(--card);box-shadow:0 18px 45px rgba(15,23,42,.18)}.scope-safe-menu[hidden]{display:none!important}
    .scope-safe-actions{display:flex;justify-content:space-between;padding:4px 4px 8px;border-bottom:1px solid var(--line)}.scope-safe-actions button{border:0;background:transparent;color:var(--blue2);font-size:11px;font-weight:850;cursor:pointer}.scope-safe-options{display:grid;gap:2px;padding-top:6px}.scope-safe-option{display:flex;gap:8px;padding:8px;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer}.scope-safe-option:hover{background:color-mix(in srgb,var(--blue2) 7%,var(--card))}.scope-safe-option input{accent-color:var(--blue2)}
    .scope-guard-status{font-size:12px;font-weight:800;color:var(--muted)}.scope-guard-status.is-warning{color:#a05a00}.scope-safe .btn:disabled{opacity:.55;cursor:not-allowed}
    body.analises-awaiting-scope .kpis,body.analises-awaiting-scope .content>.panel.panel-pad,body.analises-awaiting-scope .oper-grid,body.analises-awaiting-scope .trend,body.analises-awaiting-scope .table-card{display:none!important}
    @media(max-width:820px){.scope-safe-grid{grid-template-columns:1fr}.scope-safe-grid .btn{width:100%}}
  `;
  document.head.appendChild(style);
}

function createGuard() {
  let guard = document.getElementById("scopeGuardSafe");
  if (guard) return guard;
  const panel = document.querySelector(".filter-panel");
  const head = panel?.querySelector(".filter-head");
  if (!panel || !head) return null;
  guard = document.createElement("div");
  guard.id = "scopeGuardSafe";
  guard.className = "scope-safe";
  guard.hidden = true;
  guard.innerHTML = `
    <div class="scope-safe-head"><i class="fa-solid fa-filter-circle-dollar"></i><div><strong>Defina o recorte da consulta</strong><small>Para processos inativos ou para a visão completa, selecione uma ou mais unidades e depois um ou mais editais.</small></div></div>
    <div class="scope-safe-grid">
      <div class="scope-safe-field"><label>Unidades</label><div class="scope-safe-multi"><button type="button" class="scope-safe-trigger" id="scopeUnitsTrigger"><span>Selecione uma ou mais unidades</span><i class="fa-solid fa-chevron-down"></i></button><div class="scope-safe-menu" id="scopeUnitsMenu" hidden><div class="scope-safe-actions"><button data-action="all-units">Selecionar todas</button><button data-action="clear-units">Limpar</button></div><div class="scope-safe-options" id="scopeUnitsOptions"></div></div></div></div>
      <div class="scope-safe-field"><label>Editais</label><div class="scope-safe-multi"><button type="button" class="scope-safe-trigger" id="scopeEditaisTrigger" disabled><span>Selecione primeiro as unidades</span><i class="fa-solid fa-chevron-down"></i></button><div class="scope-safe-menu" id="scopeEditaisMenu" hidden><div class="scope-safe-actions"><button data-action="all-editais">Selecionar todos</button><button data-action="clear-editais">Limpar</button></div><div class="scope-safe-options" id="scopeEditaisOptions"></div></div></div></div>
      <button type="button" class="btn" id="scopeGuardLoad" disabled><i class="fa-solid fa-magnifying-glass"></i> Consultar</button>
    </div><div class="scope-guard-status" id="scopeGuardStatus">Carregando unidades disponíveis...</div>`;
  panel.insertBefore(guard, head);
  guard.addEventListener("click", handleClick);
  document.getElementById("scopeGuardLoad")?.addEventListener("click", consult);
  document
    .getElementById("scopeUnitsTrigger")
    ?.addEventListener("click", (event) => toggleMenu("scopeUnits", event));
  document
    .getElementById("scopeEditaisTrigger")
    ?.addEventListener("click", (event) => toggleMenu("scopeEditais", event));
  document.addEventListener("click", (event) => {
    if (!event.target?.closest?.(".scope-safe-multi")) closeMenus();
  });
  return guard;
}

function toggleMenu(prefix, event) {
  event.stopPropagation();
  const trigger = document.getElementById(`${prefix}Trigger`);
  const menu = document.getElementById(`${prefix}Menu`);
  if (!trigger || !menu || trigger.disabled) return;
  document
    .querySelectorAll(".scope-safe-menu:not([hidden])")
    .forEach((item) => {
      if (item !== menu) item.hidden = true;
    });
  menu.hidden = !menu.hidden;
}

function closeMenus() {
  document
    .querySelectorAll(".scope-safe-menu:not([hidden])")
    .forEach((menu) => {
      menu.hidden = true;
    });
}

function isInactive(row) {
  return (
    row?.ativo === false ||
    ["false", "0", "nao", "não", "inativo"].includes(norm(row?.ativo))
  );
}

function catalogRows() {
  return scope() === "todos" ? state.catalog : state.catalog.filter(isInactive);
}

function availableUnits() {
  return sorted(catalogRows().map((row) => row.unidade));
}
function availableEditais() {
  const units = new Set(state.units);
  return sorted(
    catalogRows()
      .filter((row) => units.has(txt(row.unidade)))
      .map((row) => row.edital),
  );
}

function renderOptions(id, values, selected, type) {
  const target = document.getElementById(id);
  if (!target) return;
  const selectedSet = new Set(selected);
  target.innerHTML = values.length
    ? values
        .map(
          (value) =>
            `<label class="scope-safe-option"><input type="checkbox" data-type="${type}" value="${esc(value)}" ${selectedSet.has(value) ? "checked" : ""}><span>${esc(value)}</span></label>`,
        )
        .join("")
    : '<div class="scope-safe-option">Nenhuma opção disponível.</div>';
}

function updateLabel(prefix, values, empty) {
  const label = document
    .getElementById(`${prefix}Trigger`)
    ?.querySelector("span");
  if (label)
    label.textContent = values.length
      ? values.length <= 2
        ? values.join(", ")
        : `${values.length} opções selecionadas`
      : empty;
}

function syncUi() {
  const unitValues = availableUnits();
  state.units = state.units.filter((value) => unitValues.includes(value));
  const editalValues = availableEditais();
  state.editais = state.editais.filter((value) => editalValues.includes(value));
  renderOptions("scopeUnitsOptions", unitValues, state.units, "unit");
  renderOptions("scopeEditaisOptions", editalValues, state.editais, "edital");
  updateLabel(
    "scopeUnits",
    state.units,
    state.catalogLoaded
      ? "Selecione uma ou mais unidades"
      : "Carregando unidades...",
  );
  updateLabel(
    "scopeEditais",
    state.editais,
    state.units.length
      ? "Selecione um ou mais editais"
      : "Selecione primeiro as unidades",
  );
  const unitTrigger = document.getElementById("scopeUnitsTrigger");
  if (unitTrigger)
    unitTrigger.disabled = !state.catalogLoaded || !unitValues.length;
  const editalTrigger = document.getElementById("scopeEditaisTrigger");
  if (editalTrigger) editalTrigger.disabled = !state.units.length;
  const ready = Boolean(state.units.length && state.editais.length);
  const load = document.getElementById("scopeGuardLoad");
  if (load) load.disabled = !ready;
  if (!state.catalogLoaded)
    setStatus("Carregando unidades e editais disponíveis...");
  else if (!unitValues.length)
    setStatus(
      `Nenhuma unidade disponível para processos ${scopeLabel().toLowerCase()}.`,
      true,
    );
  else if (!state.units.length)
    setStatus("Selecione uma ou mais unidades para continuar.");
  else if (!state.editais.length)
    setStatus(
      `${state.units.length} unidade(s) selecionada(s). Agora escolha pelo menos um edital.`,
    );
  else
    setStatus(
      `Recorte pronto: ${state.units.length} unidade(s) e ${state.editais.length} edital(is).`,
    );
}

function handleClick(event) {
  const input = event.target?.closest?.("input[data-type]");
  if (input) {
    event.stopPropagation();
    const values = input.dataset.type === "unit" ? state.units : state.editais;
    const set = new Set(values);
    input.checked ? set.add(input.value) : set.delete(input.value);
    if (input.dataset.type === "unit") {
      state.units = sorted(set);
      state.editais = [];
    } else {
      state.editais = sorted(set);
    }
    state.activeKey = "";
    blockResults(true);
    syncPendingContext();
    syncUi();
    return;
  }
  const action = event.target?.closest?.("[data-action]")?.dataset?.action;
  if (!action) return;
  event.preventDefault();
  event.stopPropagation();
  if (action === "all-units") {
    state.units = availableUnits();
    state.editais = [];
  }
  if (action === "clear-units") {
    state.units = [];
    state.editais = [];
  }
  if (action === "all-editais") state.editais = availableEditais();
  if (action === "clear-editais") state.editais = [];
  state.activeKey = "";
  blockResults(true);
  syncPendingContext();
  syncUi();
}

async function loadCatalog() {
  if (state.loadingCatalog || state.catalogLoaded) return;
  if (!state.client) {
    if (state.catalogRetry < 40) {
      state.catalogRetry += 1;
      window.setTimeout(loadCatalog, 100);
    }
    return;
  }
  state.loadingCatalog = true;
  try {
    const { data, error } = await state.client
      .from("TB_EDITAL_ANALISE")
      .select("grupo,unidade,edital,ativo")
      .order("unidade", { ascending: true })
      .order("edital", { ascending: true });
    if (error) throw error;
    state.catalog = Array.isArray(data) ? data : [];
    state.catalogLoaded = true;
    state.catalogRetry = 0;
    if (scopedMode()) syncUi();
  } catch (error) {
    console.error(error);
    setStatus(
      "Não foi possível carregar unidades e editais. Atualize a página e tente novamente.",
      true,
    );
  } finally {
    state.loadingCatalog = false;
  }
}

function showGuard() {
  const guard = createGuard();
  if (!guard) return;
  guard.hidden = !scopedMode();
  if (scopedMode()) {
    blockResults(true);
    syncPendingContext();
    syncUi();
    loadCatalog();
  } else {
    blockResults(false);
  }
}

function consult() {
  if (!state.units.length || !state.editais.length) {
    setStatus("Selecione uma ou mais unidades e pelo menos um edital.", true);
    return;
  }
  state.total = null;
  state.activeKey = key();
  blockResults(false);
  setStatus(
    `Consultando ${state.units.length} unidade(s) e ${state.editais.length} edital(is)...`,
  );
  document
    .getElementById("fSituacaoEdital")
    ?.dispatchEvent(new Event("change", { bubbles: true }));
}

function init() {
  ensureStyles();
  createGuard();
  showGuard();
  const scopeSelect = document.getElementById("fSituacaoEdital");
  scopeSelect?.addEventListener(
    "change",
    (event) => {
      if (scope() === "ativo") {
        resetSelection();
        showGuard();
        return;
      }
      if (authorized()) return;
      event.stopImmediatePropagation();
      event.preventDefault();
      resetSelection();
      showGuard();
      const updated = document.getElementById("updatedText");
      const footer = document.getElementById("footerUpdated");
      if (updated) updated.textContent = "Aguardando definição do recorte";
      if (footer) footer.textContent = "Aguardando definição do recorte";
    },
    true,
  );
  loadCatalog();
}

patchClient();
document.addEventListener("DOMContentLoaded", init, { once: true });
