const PENDING_CLASS = "historical-scope-pending";

const txt = value => String(value ?? "").trim();

function currentScope(){
  const value = txt(document.getElementById("fSituacaoEdital")?.value).toLowerCase();
  return ["ativo", "inativo", "todos"].includes(value) ? value : "ativo";
}

function selectedValues(id){
  const element = document.getElementById(id);
  if(!element) return [];
  return [...element.selectedOptions].map(option => txt(option.value)).filter(Boolean);
}

function selectionKey(){
  return JSON.stringify({
    scope: currentScope(),
    unidades: selectedValues("scopeGuardUnits").sort(),
    editais: selectedValues("scopeGuardEditais").sort()
  });
}

const state = {
  authorizedKey: ""
};

function hasHistoricalSelection(){
  return selectedValues("scopeGuardUnits").length > 0
    || selectedValues("scopeGuardEditais").length > 0;
}

function isAuthorized(){
  return currentScope() !== "ativo"
    && Boolean(state.authorizedKey)
    && state.authorizedKey === selectionKey();
}

function setPending(pending){
  document.body.classList.toggle(PENDING_CLASS, pending);
  const exportBtn = document.getElementById("exportBtn");
  if(exportBtn){
    exportBtn.disabled = pending;
    exportBtn.title = pending ? "Consulte uma unidade ou edital antes de exportar" : "";
  }
}

function invalidateHistoricalResult(){
  state.authorizedKey = "";
  if(currentScope() !== "ativo") setPending(true);
}

function requestGuardLoad(){
  const button = document.getElementById("scopeGuardLoad");
  if(button) button.click();
}

function markQueryComplete(){
  if(!isAuthorized()) return;
  const loading = document.getElementById("loading");
  if(loading?.classList.contains("show")) return;
  setPending(false);
  const status = document.getElementById("scopeGuardStatus");
  if(!status) return;
  const total = txt(document.getElementById("kTotal")?.textContent) || "0";
  status.classList.remove("is-warning");
  status.textContent = `Consulta concluída: ${total} registro(s) no recorte.`;
}

function setAdvancedExpanded(expanded){
  const advancedBtn = document.getElementById("advancedBtn");
  const advancedFilters = document.getElementById("advancedFilters");
  if(!advancedBtn || !advancedFilters) return;

  advancedFilters.classList.toggle("show", expanded);
  advancedBtn.setAttribute("aria-expanded", String(expanded));
  advancedBtn.title = expanded ? "Ocultar filtros avançados" : "Mostrar filtros avançados";
  advancedBtn.innerHTML = expanded
    ? '<i class="fa-solid fa-sliders"></i> Ocultar avançados'
    : '<i class="fa-solid fa-sliders"></i> Filtros avançados';
}

function setFiltersCollapsed(collapsed){
  const toggleBtn = document.getElementById("toggleFiltersBtn");
  const filtersBody = document.getElementById("filtersBody");
  const advancedBtn = document.getElementById("advancedBtn");
  if(!toggleBtn || !filtersBody) return;

  filtersBody.hidden = collapsed;
  toggleBtn.setAttribute("aria-expanded", String(!collapsed));
  toggleBtn.title = collapsed ? "Mostrar filtros" : "Ocultar filtros";

  const icon = toggleBtn.querySelector("i");
  const label = toggleBtn.querySelector(".toggle-label");
  if(icon) icon.className = collapsed ? "fa-solid fa-eye" : "fa-solid fa-eye-slash";
  if(label) label.textContent = collapsed ? "Mostrar filtros" : "Ocultar filtros";

  if(advancedBtn) advancedBtn.hidden = collapsed;
  if(collapsed) setAdvancedExpanded(false);
}

function bindFilterControls(){
  const advancedBtn = document.getElementById("advancedBtn");
  const advancedFilters = document.getElementById("advancedFilters");
  const toggleBtn = document.getElementById("toggleFiltersBtn");
  const filtersBody = document.getElementById("filtersBody");

  if(advancedBtn && advancedFilters){
    setAdvancedExpanded(advancedFilters.classList.contains("show"));
    advancedBtn.addEventListener("click", event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if(filtersBody?.hidden) setFiltersCollapsed(false);
      setAdvancedExpanded(!advancedFilters.classList.contains("show"));
    }, true);
  }

  if(toggleBtn && filtersBody){
    setFiltersCollapsed(Boolean(filtersBody.hidden));
    toggleBtn.addEventListener("click", event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      setFiltersCollapsed(!filtersBody.hidden);
    }, true);
  }
}

function ensureStyles(){
  if(document.getElementById("analisesScopeSafetyStyles")) return;
  const style = document.createElement("style");
  style.id = "analisesScopeSafetyStyles";
  style.textContent = `
    body.${PENDING_CLASS} main > section:not(.filter-panel):not(#authWarning){display:none!important}
    body.${PENDING_CLASS} #exportBtn{opacity:.55;cursor:not-allowed}
    #advancedBtn[hidden]{display:none!important}
  `;
  document.head.appendChild(style);
}

function bindSafety(){
  ensureStyles();
  bindFilterControls();

  const scopeSelect = document.getElementById("fSituacaoEdital");
  const refreshBtn = document.getElementById("refreshBtn");
  const exportBtn = document.getElementById("exportBtn");
  const applyBtn = document.getElementById("applyBtn");
  const clearBtn = document.getElementById("clearBtn");
  const loading = document.getElementById("loading");

  scopeSelect?.addEventListener("change", () => {
    if(currentScope() === "ativo"){
      state.authorizedKey = "";
      setPending(false);
      return;
    }

    // A consulta histórica autorizada dispara internamente um evento change
    // no mesmo escopo. Nesse caso, o resultado não pode voltar ao estado pendente.
    if(state.authorizedKey && state.authorizedKey === selectionKey()){
      setPending(false);
      return;
    }

    invalidateHistoricalResult();
  }, true);

  document.addEventListener("change", event => {
    if(event.target?.id === "scopeGuardUnits" || event.target?.id === "scopeGuardEditais"){
      invalidateHistoricalResult();
    }
  }, true);

  document.addEventListener("click", event => {
    if(event.target?.closest?.("#scopeGuardLoad")){
      if(hasHistoricalSelection()){
        state.authorizedKey = selectionKey();
        setPending(false);
      }else{
        invalidateHistoricalResult();
      }
    }
  }, true);

  refreshBtn?.addEventListener("click", event => {
    if(currentScope() === "ativo") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if(!hasHistoricalSelection()){
      invalidateHistoricalResult();
      requestGuardLoad();
      return;
    }
    state.authorizedKey = selectionKey();
    setPending(false);
    requestGuardLoad();
  }, true);

  exportBtn?.addEventListener("click", event => {
    if(currentScope() === "ativo" || isAuthorized()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    invalidateHistoricalResult();
    requestGuardLoad();
  }, true);

  applyBtn?.addEventListener("click", event => {
    if(currentScope() === "ativo") return;
    event.preventDefault();
    event.stopImmediatePropagation();

    if(!isAuthorized()){
      requestGuardLoad();
      return;
    }

    if(typeof applyBtn.onclick === "function"){
      applyBtn.onclick.call(applyBtn, event);
    }
  }, true);

  clearBtn?.addEventListener("click", () => {
    setTimeout(() => {
      if(currentScope() === "ativo"){
        state.authorizedKey = "";
        setPending(false);
        const guard = document.getElementById("scopeGuard");
        if(guard) guard.hidden = true;
      }
    }, 0);
  }, true);

  if(loading){
    const observer = new MutationObserver(() => {
      if(!loading.classList.contains("show")) setTimeout(markQueryComplete, 0);
    });
    observer.observe(loading, { attributes:true, attributeFilter:["class"] });
  }
}

document.addEventListener("DOMContentLoaded", bindSafety, { once:true });
