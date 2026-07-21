const TARGET_VIEW = "vw_analises_dashboard_base_todos";
const FILTERED_RPC = "get_analises_dashboard_filtrado";
const RPC_PAGE_SIZE = 1000;
const CACHE_PREFIX = "agsus_analises_cache_v1_";

const state = {
  client: null,
  selectedUnits: [],
  selectedEditais: [],
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

function selectedValues(id){
  const element = document.getElementById(id);
  if(!element) return [];
  return [...element.selectedOptions].map(option => txt(option.value)).filter(Boolean);
}

function queryKey(){
  return JSON.stringify({
    scope: currentScope(),
    unidades: [...state.selectedUnits].sort(),
    editais: [...state.selectedEditais].sort()
  });
}

function invalidateQuery(){
  state.activeQueryKey = "";
  state.total = null;
}

function queryIsAuthorized(){
  return currentScope() !== "ativo"
    && Boolean(state.activeQueryKey)
    && state.activeQueryKey === queryKey();
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
    p_unidades: state.selectedUnits.length ? state.selectedUnits : null,
    p_editais: state.selectedEditais.length ? state.selectedEditais : null,
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
  updateStatus(`Carregando ${loaded.toLocaleString("pt-BR")}${totalText} registro(s)...`);
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

function patchSupabaseClient(){
  const supabase = window.supabase;
  if(!supabase?.createClient || supabase.__agsusAnalisesScopePatched) return;

  const originalCreateClient = supabase.createClient.bind(supabase);
  supabase.createClient = (...args) => {
    const client = originalCreateClient(...args);
    state.client = client;

    const originalFrom = client.from.bind(client);
    client.from = tableName => {
      if(tableName === TARGET_VIEW && queryIsAuthorized()){
        return createRpcBackedBuilder();
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
    .scope-guard{margin:0 0 14px;border:1px solid rgba(226,164,0,.35);border-left:5px solid var(--yellow);border-radius:16px;background:color-mix(in srgb,var(--yellow) 8%,var(--card));padding:14px;display:grid;gap:12px}
    .scope-guard[hidden]{display:none!important}
    .scope-guard-head{display:flex;gap:10px;align-items:flex-start;color:var(--text)}
    .scope-guard-head i{color:var(--yellow);margin-top:3px}.scope-guard-head strong{display:block;color:var(--strong);margin-bottom:4px}.scope-guard-head small{color:var(--muted);line-height:1.45}
    .scope-guard-grid{display:grid;grid-template-columns:1fr 1fr auto;gap:12px;align-items:end}
    .scope-guard-field{display:grid;gap:6px}.scope-guard-field label{font-size:12px;font-weight:850;color:var(--muted)}
    .scope-guard select[multiple]{min-height:116px;padding:8px}.scope-guard-status{font-size:12px;font-weight:800;color:var(--muted)}
    .scope-guard-status.is-warning{color:#a05a00}
    @media(max-width:820px){.scope-guard-grid{grid-template-columns:1fr}.scope-guard-grid .btn{width:100%}}
  `;
  document.head.appendChild(style);
}

function ensureGuard(){
  let guard = document.getElementById("scopeGuard");
  if(guard) return guard;
  const filtersBody = document.getElementById("filtersBody");
  if(!filtersBody) return null;

  guard = document.createElement("div");
  guard.id = "scopeGuard";
  guard.className = "scope-guard";
  guard.hidden = true;
  guard.innerHTML = `
    <div class="scope-guard-head">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <div><strong>Defina um recorte antes da consulta</strong><small>Selecione pelo menos uma unidade ou um edital. Os registros são carregados em lotes, sem limite total fixo.</small></div>
    </div>
    <div class="scope-guard-grid">
      <div class="scope-guard-field"><label for="scopeGuardUnits">Unidades do recorte</label><select id="scopeGuardUnits" multiple aria-label="Unidades do recorte"></select></div>
      <div class="scope-guard-field"><label for="scopeGuardEditais">Editais do recorte</label><select id="scopeGuardEditais" multiple aria-label="Editais do recorte"></select></div>
      <button type="button" class="btn" id="scopeGuardLoad"><i class="fa-solid fa-magnifying-glass"></i> Consultar dados</button>
    </div>
    <div class="scope-guard-status" id="scopeGuardStatus">Selecione uma ou mais opções usando Ctrl ou Shift.</div>
  `;
  filtersBody.insertAdjacentElement("afterbegin", guard);
  document.getElementById("scopeGuardLoad")?.addEventListener("click", requestScopedLoad);
  document.getElementById("scopeGuardUnits")?.addEventListener("change", onUnitsChanged);
  document.getElementById("scopeGuardEditais")?.addEventListener("change", syncSelections);
  return guard;
}

function scopeCatalogRows(){
  const scope = currentScope();
  return state.catalog.filter(row => scope === "todos" || row.ativo === false);
}

function renderEditalOptions(){
  const editalSelect = document.getElementById("scopeGuardEditais");
  if(!editalSelect) return;

  const selectedUnitSet = new Set(state.selectedUnits);
  const previous = new Set(selectedValues("scopeGuardEditais"));
  const rows = scopeCatalogRows().filter(row => !selectedUnitSet.size || selectedUnitSet.has(txt(row.unidade)));
  const editais = [...new Set(rows.map(row => txt(row.edital)).filter(Boolean))]
    .sort((a,b) => a.localeCompare(b,"pt-BR",{numeric:true}));

  editalSelect.innerHTML = editais.map(value => `<option value="${esc(value)}" ${previous.has(value) ? "selected" : ""}>${esc(value)}</option>`).join("");
  state.selectedEditais = selectedValues("scopeGuardEditais");
}

function onUnitsChanged(){
  state.selectedUnits = selectedValues("scopeGuardUnits");
  renderEditalOptions();
  syncSelections();
}

function syncSelections(){
  state.selectedUnits = selectedValues("scopeGuardUnits");
  state.selectedEditais = selectedValues("scopeGuardEditais");
  invalidateQuery();

  const total = state.selectedUnits.length + state.selectedEditais.length;
  updateStatus(total
    ? `${state.selectedUnits.length} unidade(s) e ${state.selectedEditais.length} edital(is) selecionado(s).`
    : "Selecione pelo menos uma unidade ou um edital.");
}

function renderCatalog(){
  const rows = scopeCatalogRows();
  const units = [...new Set(rows.map(row => txt(row.unidade)).filter(Boolean))]
    .sort((a,b) => a.localeCompare(b,"pt-BR",{numeric:true}));
  const unitSelect = document.getElementById("scopeGuardUnits");
  if(unitSelect) unitSelect.innerHTML = units.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join("");

  state.selectedUnits = [];
  state.selectedEditais = [];
  renderEditalOptions();
  syncSelections();
}

async function loadCatalog(){
  if(state.loadingCatalog) return;
  if(!state.client){ setTimeout(loadCatalog, 120); return; }

  state.loadingCatalog = true;
  updateStatus("Carregando catálogo de editais...");
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
    updateStatus("Não foi possível carregar o catálogo de editais.", true);
  }finally{
    state.loadingCatalog = false;
  }
}

function showGuard(preserveSelection = false){
  const guard = ensureGuard();
  if(!guard) return;
  guard.hidden = currentScope() === "ativo";
  if(guard.hidden) return;

  if(!state.catalog.length){
    loadCatalog();
  }else if(!preserveSelection){
    renderCatalog();
  }
}

function requestScopedLoad(){
  state.selectedUnits = selectedValues("scopeGuardUnits");
  state.selectedEditais = selectedValues("scopeGuardEditais");
  if(currentScope() === "ativo") return;

  if(!state.selectedUnits.length && !state.selectedEditais.length){
    updateStatus("Consulta bloqueada: selecione pelo menos uma unidade ou um edital.", true);
    return;
  }

  clearScopeCache(currentScope());
  state.total = null;
  state.activeQueryKey = queryKey();
  document.getElementById("fSituacaoEdital")?.dispatchEvent(new Event("change", { bubbles:true }));
}

function bindGuard(){
  ensureStyles();
  ensureGuard();
  const scopeSelect = document.getElementById("fSituacaoEdital");
  if(!scopeSelect) return;

  scopeSelect.addEventListener("change", event => {
    const authorized = queryIsAuthorized();
    if(!authorized) invalidateQuery();
    showGuard(authorized);

    if(currentScope() !== "ativo" && !authorized){
      event.stopImmediatePropagation();
      event.preventDefault();
      const message = "Aguardando seleção de unidade ou edital";
      const updated = document.getElementById("updatedText");
      const footer = document.getElementById("footerUpdated");
      if(updated) updated.textContent = message;
      if(footer) footer.textContent = message;
    }
  }, true);

  document.getElementById("applyBtn")?.addEventListener("click", event => {
    if(currentScope() === "ativo") return;
    event.stopImmediatePropagation();
    event.preventDefault();
    requestScopedLoad();
  }, true);
}

patchSupabaseClient();
document.addEventListener("DOMContentLoaded", bindGuard, { once:true });
