const TARGET_VIEW = "vw_analises_dashboard_base_todos";
const FILTERED_RPC = "get_analises_dashboard_filtrado";
const MAX_SCOPED_ROWS = 5000;
const CACHE_PREFIX = "agsus_analises_cache_v1_";

const state = {
  client: null,
  allowScopeLoad: false,
  selectedUnits: [],
  selectedEditais: [],
  catalog: [],
  loadingCatalog: false,
  scopedPayloadKey: "",
  scopedPayload: null,
  scopedPayloadPromise: null
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

function clearRpcCache(){
  state.scopedPayloadKey = "";
  state.scopedPayload = null;
  state.scopedPayloadPromise = null;
}

function selectedValues(id){
  const element = document.getElementById(id);
  if(!element) return [];
  return [...element.selectedOptions].map(option => txt(option.value)).filter(Boolean);
}

function scopedKey(){
  return JSON.stringify({
    scope: currentScope(),
    unidades: [...state.selectedUnits].sort(),
    editais: [...state.selectedEditais].sort(),
    limit: MAX_SCOPED_ROWS
  });
}

async function fetchScopedPayload(){
  const key = scopedKey();
  if(state.scopedPayload && state.scopedPayloadKey === key) return state.scopedPayload;
  if(state.scopedPayloadPromise && state.scopedPayloadKey === key) return state.scopedPayloadPromise;

  state.scopedPayloadKey = key;
  state.scopedPayloadPromise = (async () => {
    const { data, error } = await state.client.rpc(FILTERED_RPC, {
      p_scope: currentScope(),
      p_unidades: state.selectedUnits.length ? state.selectedUnits : null,
      p_editais: state.selectedEditais.length ? state.selectedEditais : null,
      p_limit: MAX_SCOPED_ROWS
    });
    if(error) throw error;
    const payload = data && typeof data === "object" ? data : {};
    payload.rows = Array.isArray(payload.rows) ? payload.rows : [];
    state.scopedPayload = payload;
    updatePayloadStatus(payload);
    return payload;
  })();

  try{
    return await state.scopedPayloadPromise;
  }catch(error){
    clearRpcCache();
    throw error;
  }finally{
    state.scopedPayloadPromise = null;
  }
}

function createRpcBackedBuilder(){
  let rangeStart = 0;
  let rangeEnd = 999;
  const builder = {
    select(){ return builder; },
    range(start, end){
      rangeStart = Number(start) || 0;
      rangeEnd = Number(end) || rangeStart;
      return builder;
    },
    order(){ return builder; },
    eq(){ return builder; },
    in(){ return builder; },
    then(resolve){
      return fetchScopedPayload()
        .then(payload => {
          const rows = payload.rows.slice(rangeStart, rangeEnd + 1);
          return resolve({ data: rows, error: null, count: Number(payload.total || rows.length) });
        })
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
      if(tableName === TARGET_VIEW && currentScope() !== "ativo" && state.allowScopeLoad){
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
      <div><strong>Defina um recorte antes da consulta</strong><small>Processos inativos e a opção Todos possuem muitos registros. Selecione pelo menos uma unidade ou um edital. A consulta é validada no banco e limitada a ${MAX_SCOPED_ROWS.toLocaleString("pt-BR")} registros.</small></div>
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
  document.getElementById("scopeGuardUnits")?.addEventListener("change", syncSelections);
  document.getElementById("scopeGuardEditais")?.addEventListener("change", syncSelections);
  return guard;
}

function syncSelections(){
  state.selectedUnits = selectedValues("scopeGuardUnits");
  state.selectedEditais = selectedValues("scopeGuardEditais");
  clearRpcCache();
  const status = document.getElementById("scopeGuardStatus");
  if(status){
    status.classList.remove("is-warning");
    const total = state.selectedUnits.length + state.selectedEditais.length;
    status.textContent = total
      ? `${state.selectedUnits.length} unidade(s) e ${state.selectedEditais.length} edital(is) selecionado(s).`
      : "Selecione pelo menos uma unidade ou um edital.";
  }
}

function updatePayloadStatus(payload){
  const status = document.getElementById("scopeGuardStatus");
  if(!status) return;
  const total = Number(payload.total || payload.rows?.length || 0);
  const returned = Array.isArray(payload.rows) ? payload.rows.length : 0;
  status.classList.toggle("is-warning", Boolean(payload.truncated));
  status.textContent = payload.truncated
    ? `Foram encontrados ${total.toLocaleString("pt-BR")} registros. O painel exibiu os primeiros ${returned.toLocaleString("pt-BR")} por segurança; refine o recorte.`
    : `Consulta concluída: ${returned.toLocaleString("pt-BR")} registro(s).`;
}

function renderCatalog(){
  const scope = currentScope();
  const catalogRows = state.catalog.filter(row => scope === "todos" || row.ativo === false);
  const units = [...new Set(catalogRows.map(row => txt(row.unidade)).filter(Boolean))].sort((a,b) => a.localeCompare(b,"pt-BR",{numeric:true}));
  const editais = [...new Set(catalogRows.map(row => txt(row.edital)).filter(Boolean))].sort((a,b) => a.localeCompare(b,"pt-BR",{numeric:true}));
  const unitSelect = document.getElementById("scopeGuardUnits");
  const editalSelect = document.getElementById("scopeGuardEditais");
  if(unitSelect) unitSelect.innerHTML = units.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join("");
  if(editalSelect) editalSelect.innerHTML = editais.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join("");
  state.selectedUnits = [];
  state.selectedEditais = [];
  syncSelections();
}

async function loadCatalog(){
  if(state.loadingCatalog) return;
  if(!state.client){
    setTimeout(loadCatalog, 120);
    return;
  }
  state.loadingCatalog = true;
  const status = document.getElementById("scopeGuardStatus");
  if(status) status.textContent = "Carregando catálogo de editais...";
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
    if(status) status.textContent = "Não foi possível carregar o catálogo de editais.";
  }finally{
    state.loadingCatalog = false;
  }
}

function showGuard(){
  const guard = ensureGuard();
  if(!guard) return;
  guard.hidden = currentScope() === "ativo";
  if(!guard.hidden) loadCatalog();
}

function requestScopedLoad(){
  syncSelections();
  if(currentScope() === "ativo") return;
  if(!state.selectedUnits.length && !state.selectedEditais.length){
    const status = document.getElementById("scopeGuardStatus");
    if(status){
      status.classList.add("is-warning");
      status.textContent = "Consulta bloqueada: selecione pelo menos uma unidade ou um edital.";
    }
    return;
  }

  clearScopeCache(currentScope());
  clearRpcCache();
  state.allowScopeLoad = true;
  document.getElementById("fSituacaoEdital")?.dispatchEvent(new Event("change", { bubbles:true }));
}

function bindGuard(){
  ensureStyles();
  ensureGuard();
  const scopeSelect = document.getElementById("fSituacaoEdital");
  if(!scopeSelect) return;

  scopeSelect.addEventListener("change", event => {
    const scope = currentScope();
    showGuard();
    if(scope !== "ativo" && !state.allowScopeLoad){
      event.stopImmediatePropagation();
      event.preventDefault();
      const updated = document.getElementById("updatedText");
      const footer = document.getElementById("footerUpdated");
      const message = "Aguardando seleção de unidade ou edital";
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
