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
  const status = document.getElementById("scopeGuardStatus");
  if(!status) return;
  const total = txt(document.getElementById("kTotal")?.textContent) || "0";
  status.classList.remove("is-warning");
  status.textContent = `Consulta concluída: ${total} registro(s) no recorte.`;
}

function ensureStyles(){
  if(document.getElementById("analisesScopeSafetyStyles")) return;
  const style = document.createElement("style");
  style.id = "analisesScopeSafetyStyles";
  style.textContent = `
    body.${PENDING_CLASS} main > section:not(.filter-panel):not(#authWarning){display:none!important}
    body.${PENDING_CLASS} #exportBtn{opacity:.55;cursor:not-allowed}
  `;
  document.head.appendChild(style);
}

function bindSafety(){
  ensureStyles();

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
