import { SUPABASE_AUTH_STORAGE_KEY } from "../lib/env.js";

const TARGET_VIEW = "vw_analises_dashboard_base_todos";
const CACHE_PREFIX = "agsus_analises_cache_v1_";
const state = {
  client: null,
  allowScopeLoad: false,
  selectedUnits: [],
  selectedEditais: [],
  catalog: [],
  loadingCatalog: false
};

const txt = value => String(value ?? "").trim();
const norm = value => txt(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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

function patchSupabaseClient(){
  const supabase = window.supabase;
  if(!supabase?.createClient || supabase.__agsusAnalisesScopePatched) return;

  const originalCreateClient = supabase.createClient.bind(supabase);
  supabase.createClient = (...args) => {
    const client = originalCreateClient(...args);
    state.client = client;

    const originalFrom = client.from.bind(client);
    client.from = tableName => {
      const builder = originalFrom(tableName);
      if(tableName !== TARGET_VIEW) return builder;

      const originalSelect = builder.select.bind(builder);
      builder.select = (...selectArgs) => {
        let query = originalSelect(...selectArgs);
        const scope = currentScope();
        if(scope !== "ativo"){
          if(state.selectedUnits.length) query = query.in("unidade", state.selectedUnits);
          if(state.selectedEditais.length) query = query.in("edital", state.selectedEditais);
        }
        return query;
      };
      return builder;
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
      <div><strong>Defina um recorte antes da consulta</strong><small>Processos inativos e a opção Todos possuem muitos registros. Selecione pelo menos uma unidade ou um edital para evitar uma carga ampla e lenta.</small></div>
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
  const status = document.getElementById("scopeGuardStatus");
  if(status){
    const total = state.selectedUnits.length + state.selectedEditais.length;
    status.textContent = total
      ? `${state.selectedUnits.length} unidade(s) e ${state.selectedEditais.length} edital(is) selecionado(s).`
      : "Selecione pelo menos uma unidade ou um edital.";
  }
}

function renderCatalog(){
  const scope = currentScope();
  const rows = state.catalog.filter(row => scope === "todos" || row.ativo === false);
  const units = [...new Set(rows.map(row => txt(row.unidade)).filter(Boolean))].sort((a,b) => a.localeCompare(b,"pt-BR",{numeric:true}));
  const editais = [...new Set(rows.map(row => txt(row.edital)).filter(Boolean))].sort((a,b) => a.localeCompare(b,"pt-BR",{numeric:true}));
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
    if(status) status.textContent = "Consulta bloqueada: selecione pelo menos uma unidade ou um edital.";
    return;
  }

  clearScopeCache(currentScope());
  state.allowScopeLoad = true;
  document.getElementById("fSituacaoEdital")?.dispatchEvent(new Event("change", { bubbles:true }));
  state.allowScopeLoad = false;
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
