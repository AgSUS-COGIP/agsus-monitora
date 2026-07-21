const txt = value => String(value ?? "").trim();

function selectedCount(id){
  const select = document.getElementById(id);
  return select ? [...select.selectedOptions].length : 0;
}

function currentScopeLabel(){
  const select = document.getElementById("fSituacaoEdital");
  const option = select?.selectedOptions?.[0];
  return txt(option?.textContent || select?.value || "Recorte");
}

function currentTotal(){
  return txt(document.getElementById("kTotal")?.textContent) || "0";
}

function buildSummaryText(){
  const units = selectedCount("scopeGuardUnits");
  const editais = selectedCount("scopeGuardEditais");
  return `${currentScopeLabel()} · ${units} unidade(s) · ${editais} edital(is) · ${currentTotal()} registro(s)`;
}

function setCollapsed(collapsed){
  const guard = document.getElementById("scopeGuard");
  const summary = document.getElementById("scopeGuardSummary");
  if(!guard || !summary) return;

  guard.classList.toggle("scope-guard--collapsed", collapsed);
  summary.hidden = !collapsed;
  if(collapsed){
    const text = summary.querySelector(".scope-guard-summary-text");
    if(text) text.textContent = buildSummaryText();
  }
}

function ensureSummary(){
  const guard = document.getElementById("scopeGuard");
  if(!guard) return false;
  if(document.getElementById("scopeGuardSummary")) return true;

  const summary = document.createElement("div");
  summary.id = "scopeGuardSummary";
  summary.className = "scope-guard-summary";
  summary.hidden = true;
  summary.innerHTML = `
    <div class="scope-guard-summary-main">
      <span class="scope-guard-summary-icon" aria-hidden="true"><i class="fa-solid fa-filter-circle-check"></i></span>
      <div>
        <strong>Recorte aplicado</strong>
        <span class="scope-guard-summary-text"></span>
      </div>
    </div>
    <button type="button" class="btn scope-guard-summary-action" id="scopeGuardChange">
      <i class="fa-solid fa-pen-to-square"></i> Alterar recorte
    </button>
  `;

  guard.insertAdjacentElement("afterbegin", summary);
  document.getElementById("scopeGuardChange")?.addEventListener("click", () => setCollapsed(false));
  return true;
}

function ensureStyles(){
  if(document.getElementById("analisesScopeSummaryStyles")) return;
  const style = document.createElement("style");
  style.id = "analisesScopeSummaryStyles";
  style.textContent = `
    .scope-guard-summary{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:52px}
    .scope-guard-summary[hidden]{display:none!important}
    .scope-guard-summary-main{display:flex;align-items:center;gap:12px;min-width:0}
    .scope-guard-summary-icon{display:grid;place-items:center;width:36px;height:36px;border-radius:12px;background:color-mix(in srgb,var(--green) 15%,transparent);color:var(--green);flex:0 0 auto}
    .scope-guard-summary-main strong{display:block;color:var(--strong);font-size:14px}
    .scope-guard-summary-text{display:block;color:var(--muted);font-size:12px;font-weight:750;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .scope-guard--collapsed{border-left-color:var(--green);background:color-mix(in srgb,var(--green) 6%,var(--card));padding:10px 12px}
    .scope-guard--collapsed > .scope-guard-head,
    .scope-guard--collapsed > .scope-guard-grid,
    .scope-guard--collapsed > .scope-guard-status{display:none!important}
    .scope-guard-summary-action{white-space:nowrap}
    @media(max-width:720px){.scope-guard-summary{align-items:flex-start;flex-direction:column}.scope-guard-summary-action{width:100%}.scope-guard-summary-text{white-space:normal}}
  `;
  document.head.appendChild(style);
}

function start(){
  ensureStyles();

  const install = () => {
    if(!ensureSummary()) return false;

    const status = document.getElementById("scopeGuardStatus");
    const scope = document.getElementById("fSituacaoEdital");
    const units = document.getElementById("scopeGuardUnits");
    const editais = document.getElementById("scopeGuardEditais");

    if(status && status.dataset.summaryObserver !== "1"){
      status.dataset.summaryObserver = "1";
      const evaluate = () => {
        const message = txt(status.textContent).toLowerCase();
        const success = message.startsWith("consulta concluída:");
        const warning = status.classList.contains("is-warning");
        if(success && !warning) setCollapsed(true);
        if(warning || message.startsWith("consulta bloqueada") || message.includes("não foi possível")) setCollapsed(false);
      };
      new MutationObserver(evaluate).observe(status, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:["class"] });
      evaluate();
    }

    [scope, units, editais].forEach(element => {
      if(!element || element.dataset.summaryBound === "1") return;
      element.dataset.summaryBound = "1";
      element.addEventListener("change", () => setCollapsed(false), true);
    });

    return true;
  };

  if(install()) return;
  const observer = new MutationObserver(() => {
    if(install()) observer.disconnect();
  });
  observer.observe(document.body, { childList:true, subtree:true });
}

document.addEventListener("DOMContentLoaded", start, { once:true });
