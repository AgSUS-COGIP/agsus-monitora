const TARGET_VIEWS = new Set([
  "vw_analises_dashboard_base",
  "vw_analises_dashboard_base_todos"
]);
const FILTERED_RPC = "get_analises_dashboard_filtrado";
const RPC_PAGE_SIZE = 1000;
const CACHE_PREFIX = "agsus_analises_cache_v1_";

const state = {
  client: null,
  selectedUnit: "",
  selectedEdital: "",
  catalog: [],
  loadingCatalog: false,
  activeQueryKey: "",
  total: null
};

const txt = value => String(value ?? "").trim();
const esc = value => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function currentScope(){
  const value = txt(document.getElementById("fSituacaoEdital")?.value).toLowerCase();
  return ["ativo", "inativo", "todos"].includes(value) ? value : "ativo";
}

function clearScopeCache(scope){
  try{
    for(let index = localStorage.length - 1; index >= 0; index--){
      const key = localStorage.key(index);
      if(key && key.startsWith(CACHE_PREFIX) && key.endsWith(`_${scope}`)){
        localStorage.removeItem(key);
      }
    }
  }catch(error){
    console.warn("Não foi possível limpar o cache do recorte de análises:", error);
  }
}

function queryKey(){
  return JSON.stringify({
    scope: currentScope(),
    unidade: state.selectedUnit,
    edital: state.selectedEdital
  });
}

function invalidateQuery(){
  state.activeQueryKey = "";
  state.total = null;
  document.body.classList.add("analises-awaiting-scope");
}

function queryIsAuthorized(){
  return Boolean(
    state.activeQueryKey
    && state.selectedUnit
    && state.selectedEdital
    && state.activeQueryKey === queryKey()
  );
}

function updateStatus(message, warning = false){
  const status = document.getElementById("scopeGuardStatus");
  if(!status) return;
  status.classList.toggle("is-warning", warning);
  status.textContent = message;
}

async function fetchRpcPage(offset, limit){
  const includeTotal = offset === 0;
  const { data, error } = await state.client.rpc(FILTERED_RPC, {
    p_scope: currentScope(),
    p_unidades: [state.selectedUnit],
    p_editais: [state.selectedEdital],
    p_offset: offset,
    p_limit: Math.min(Math.max(limit, 1), RPC_PAGE_SIZE),
    p_include_total: includeTotal
  });
  if(error) throw error;

  const payload = data && typeof data === "object" ? data : {};
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  if(includeTotal && payload.total !== null && payload.total !== undefined){
    state.total = Number(payload.total || 0);
  }

  const loaded = Math.min(offset + rows.length, state.total ?? offset + rows.length);
  const totalText = state.total === null ? "" : ` de ${state.total.toLocaleString("pt-BR")}`;
  updateStatus(`Carregando ${loaded.toLocaleString("pt-BR")}${totalText} registro(s) de ${state.selectedUnit} · ${state.selectedEdital}...`);
  return { rows, total: state.total };
}

function createRpcBackedBuilder(){
  let rangeStart = 0;
  let rangeEnd = RPC_PAGE_SIZE - 1;
  const builder = {
    select(){ return builder; },
    range(start, end){
      rangeStart = Math.max(Number(start) || 0, 0);
      rangeEnd = Math.max(Number(end) || rangeStart, rangeStart);
      return builder;
    },
    order(){ return builder; },
    eq(){ return builder; },
    in(){ return builder; },
    then(resolve){
      const requested = rangeEnd - rangeStart + 1;
      return fetchRpcPage(rangeStart, requested)
        .then(result => resolve({ data: result.rows, error: null, count: result.total }))
        .catch(error => resolve({ data: [], error }));
    }
  };
  return builder;
}

function createBlockedBuilder(){
  const builder = {
    select(){ return builder; },
    range(){ return builder; },
    order(){ return builder; },
    eq(){ return builder; },
    in(){ return builder; },
    then(resolve){
      updateStatus("Escolha uma unidade e um edital para consultar os dados.");
      return Promise.resolve(resolve({ data: [], error: null, count: 0 }));
    }
  };
  return builder;
}

function patchSupabaseClient(){
  const supabase = window.supabase;
  if(!supabase?.createClient || supabase.__agsusAnalisesScopePatched) return;

  const originalCreateClient = supabase.createClient.bind(supabase);
  supabase.createClient = (...args) => {
    const client = originalCreateClient(...args);
    state.client = client;

    const originalFrom = client.from.bind(client);
    client.from = tableName => {
      if(TARGET_VIEWS.has(tableName)){
        return queryIsAuthorized() ? createRpcBackedBuilder() : createBlockedBuilder();
      }
      return originalFrom(tableName);
    };
    return client;
  };

  supabase.__agsusAnalisesScopePatched = true;
}

function ensureStyles(){
  if(document.getElementById("analisesScopeGuardStyles")) return;
  const style = document.createElement("style");
  style.id = "analisesScopeGuardStyles";
  style.textContent = `
    .scope-guard{margin:0 0 14px;border:1px solid color-mix(in srgb,var(--blue2) 22%,var(--line));border-left:5px solid var(--blue2);border-radius:16px;background:linear-gradient(135deg,color-mix(in srgb,var(--blue2) 7%,var(--card)),var(--card));padding:15px;display:grid;gap:13px}
    .scope-guard-head{display:flex;gap:11px;align-items:flex-start;color:var(--text)}
    .scope-guard-head i{color:var(--blue2);margin-top:3px}.scope-guard-head strong{display:block;color:var(--strong);margin-bottom:4px;font-size:14px}.scope-guard-head small{color:var(--muted);line-height:1.45}
    .scope-guard-grid{display:grid;grid-template-columns:minmax(230px,1fr) minmax(230px,1fr) auto;gap:12px;align-items:end}
    .scope-guard-field{display:grid;gap:6px}.scope-guard-field label{font-size:11px;font-weight:850;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
    .scope-guard select{width:100%;min-height:44px;border:1px solid var(--line2);border-radius:12px;background:var(--card);color:var(--text);padding:0 12px;font:inherit;font-weight:700}
    .scope-guard select:disabled{opacity:.55;cursor:not-allowed;background:var(--card2)}
    .scope-guard .btn:disabled{opacity:.55;cursor:not-allowed}
    .scope-guard-status{font-size:12px;font-weight:800;color:var(--muted)}
    .scope-guard-status.is-warning{color:#a05a00}
    body.analises-awaiting-scope .kpis,
    body.analises-awaiting-scope .content > .panel.panel-pad,
    body.analises-awaiting-scope .oper-grid,
    body.analises-awaiting-scope .trend,
    body.analises-awaiting-scope .table-card{display:none!important}
    @media(max-width:820px){.scope-guard-grid{grid-template-columns:1fr}.scope-guard-grid .btn{width:100%}}
  `;
  document.head.appendChild(style);
}

function ensureGuard(){
  let guard = document.getElementById("scopeGuard");
  if(guard) return guard;
  const filterPanel = document.querySelector(".filter-panel");
  const filterHead = filterPanel?.querySelector(".filter-head");
  if(!filterPanel || !filterHead) return null;

  guard = document.createElement("div");
  guard.id = "scopeGuard";
  guard.className = "scope-guard";
  guard.innerHTML = `
    <div class="scope-guard-head">
      <i class="fa-solid fa-filter-circle-dollar"></i>
      <div><strong>Escolha o recorte da consulta</strong><small>Selecione primeiro a unidade e depois o edital. O painel carregará somente os registros desse processo seletivo.</small></div>
    </div>
    <div class="scope-guard-grid">
      <div class="scope-guard-field"><label for="scopeGuardUnit">Unidade</label><select id="scopeGuardUnit" aria-label="Unidade do recorte"><option value="">Selecione uma unidade</option></select></div>
      <div class="scope-guard-field"><label for="scopeGuardEdital">Edital</label><select id="scopeGuardEdital" aria-label="Edital do recorte" disabled><option value="">Selecione primeiro a unidade</option></select></div>
      <button type="button" class="btn" id="scopeGuardLoad" disabled><i class="fa-solid fa-magnifying-glass"></i> Consultar</button>
    </div>
    <div class="scope-guard-status" id="scopeGuardStatus">Carregando unidades disponíveis...</div>
  `;
  filterPanel.insertBefore(guard, filterHead);
  document.getElementById("scopeGuardLoad")?.addEventListener("click", requestScopedLoad);
  document.getElementById("scopeGuardUnit")?.addEventListener("change", onUnitChanged);
  document.getElementById("scopeGuardEdital")?.addEventListener("change", onEditalChanged);
  return guard;
}

function scopeCatalogRows(){
  const scope = currentScope();
  if(scope === "todos") return state.catalog;
  return state.catalog.filter(row => scope === "ativo" ? row.ativo !== false : row.ativo === false);
}

function renderEditalOptions(){
  const editalSelect = document.getElementById("scopeGuardEdital");
  const loadButton = document.getElementById("scopeGuardLoad");
  if(!editalSelect) return;

  if(!state.selectedUnit){
    editalSelect.disabled = true;
    editalSelect.innerHTML = '<option value="">Selecione primeiro a unidade</option>';
    state.selectedEdital = "";
    if(loadButton) loadButton.disabled = true;
    return;
  }

  const editais = [...new Set(scopeCatalogRows()
    .filter(row => txt(row.unidade) === state.selectedUnit)
    .map(row => txt(row.edital))
    .filter(Boolean))]
    .sort((a,b) => a.localeCompare(b,"pt-BR",{numeric:true}));

  editalSelect.disabled = false;
  editalSelect.innerHTML = '<option value="">Selecione um edital</option>'
    + editais.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join("");
  state.selectedEdital = "";
  if(loadButton) loadButton.disabled = true;
}

function onUnitChanged(event){
  state.selectedUnit = txt(event.target.value);
  state.selectedEdital = "";
  invalidateQuery();
  renderEditalOptions();
  updateStatus(state.selectedUnit ? "Agora selecione o edital dessa unidade." : "Selecione uma unidade para continuar.");
}

function onEditalChanged(event){
  state.selectedEdital = txt(event.target.value);
  invalidateQuery();
  const loadButton = document.getElementById("scopeGuardLoad");
  if(loadButton) loadButton.disabled = !(state.selectedUnit && state.selectedEdital);
  updateStatus(state.selectedEdital
    ? `Recorte pronto: ${state.selectedUnit} · Edital ${state.selectedEdital}.`
    : "Selecione um edital para continuar.");
}

function renderCatalog(){
  const units = [...new Set(scopeCatalogRows().map(row => txt(row.unidade)).filter(Boolean))]
    .sort((a,b) => a.localeCompare(b,"pt-BR",{numeric:true}));
  const unitSelect = document.getElementById("scopeGuardUnit");
  if(unitSelect){
    unitSelect.innerHTML = '<option value="">Selecione uma unidade</option>'
      + units.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join("");
  }
  state.selectedUnit = "";
  state.selectedEdital = "";
  renderEditalOptions();
  updateStatus(units.length ? "Selecione uma unidade para iniciar." : "Nenhuma unidade disponível para este escopo.", !units.length);
}

async function loadCatalog(){
  if(state.loadingCatalog) return;
  if(!state.client){ setTimeout(loadCatalog, 120); return; }

  state.loadingCatalog = true;
  updateStatus("Carregando unidades e editais disponíveis...");
  try{
    const { data, error } = await state.client
      .from("analises_editais")
      .select("grupo,unidade,edital,ativo")
      .order("unidade", { ascending:true })
      .order("edital", { ascending:true });
    if(error) throw error;
    state.catalog = Array.isArray(data) ? data : [];
    renderCatalog();
  }catch(error){
    console.error("Falha ao carregar catálogo de editais:", error);
    updateStatus("Não foi possível carregar as unidades e editais.", true);
  }finally{
    state.loadingCatalog = false;
  }
}

function requestScopedLoad(){
  if(!state.selectedUnit || !state.selectedEdital){
    updateStatus("Consulta bloqueada: selecione uma unidade e um edital.", true);
    return;
  }

  clearScopeCache(currentScope());
  state.total = null;
  state.activeQueryKey = queryKey();
  document.body.classList.remove("analises-awaiting-scope");
  updateStatus(`Consultando ${state.selectedUnit} · Edital ${state.selectedEdital}...`);
  document.getElementById("fSituacaoEdital")?.dispatchEvent(new Event("change", { bubbles:true }));
}

function bindGuard(){
  ensureStyles();
  ensureGuard();
  document.body.classList.add("analises-awaiting-scope");

  const scopeSelect = document.getElementById("fSituacaoEdital");
  if(scopeSelect){
    scopeSelect.addEventListener("change", event => {
      if(queryIsAuthorized()) return;
      event.stopImmediatePropagation();
      event.preventDefault();
      state.selectedUnit = "";
      state.selectedEdital = "";
      invalidateQuery();
      renderCatalog();
      const message = "Aguardando escolha de unidade e edital";
      const updated = document.getElementById("updatedText");
      const footer = document.getElementById("footerUpdated");
      if(updated) updated.textContent = message;
      if(footer) footer.textContent = message;
    }, true);
  }

  document.addEventListener("agsus:analises-loading-end", () => {
    if(queryIsAuthorized()){
      const totalText = state.total === null ? "" : ` · ${state.total.toLocaleString("pt-BR")} registro(s)`;
      updateStatus(`Recorte carregado: ${state.selectedUnit} · Edital ${state.selectedEdital}${totalText}.`);
    }
  });

  loadCatalog();
}

patchSupabaseClient();
document.addEventListener("DOMContentLoaded", bindGuard, { once:true });
