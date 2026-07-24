const COMPATIBILITY_SELECT_IDS = ["scopeGuardUnits", "scopeGuardEditais"];
const ORPHAN_PLACEHOLDERS = new Set([
  "Pesquise e selecione unidades",
  "Pesquise e selecione editais"
]);

const txt = value => String(value ?? "").trim();
const numberFromPtBr = value => Number(txt(value).replace(/\./g, "")) || 0;
let tableScrollBound = false;
let sweepTimer = 0;

function removeCompatibilityTomSelect(select){
  if(!select || select.dataset.scopeCompatibility !== "true") return;

  try{
    select.tomselect?.destroy?.();
  }catch(error){
    console.warn("Não foi possível desmontar seletor de compatibilidade:", error);
  }

  const sibling = select.nextElementSibling;
  if(sibling?.classList?.contains("ts-wrapper")) sibling.remove();

  select.hidden = true;
  select.tabIndex = -1;
  select.setAttribute("aria-hidden", "true");
  select.style.setProperty("display", "none", "important");
}

function removeOrphanTomSelects(){
  document.querySelectorAll(".ts-wrapper").forEach(wrapper => {
    const input = wrapper.querySelector("input");
    if(ORPHAN_PLACEHOLDERS.has(txt(input?.placeholder))) wrapper.remove();
  });
}

function cleanupCompatibilitySelectors(){
  COMPATIBILITY_SELECT_IDS.forEach(id => removeCompatibilityTomSelect(document.getElementById(id)));
  removeOrphanTomSelects();
}

function visibleTableRows(){
  return [...document.querySelectorAll("#tableBody > tr:not(.detail-row)")]
    .filter(row => !row.querySelector("td.empty") && !/Nenhum registro encontrado/i.test(txt(row.textContent)))
    .length;
}

function totalFromInterface(){
  const tableInfo = txt(document.getElementById("tableInfo")?.textContent);
  const pageInfo = txt(document.getElementById("pageInfo")?.textContent);
  const totals = [];

  const tableMatch = tableInfo.match(/\bde\s+([\d.]+)\s+registros/i);
  if(tableMatch) totals.push(numberFromPtBr(tableMatch[1]));

  const continuousMatch = tableInfo.match(/Exibindo\s+[\d.]+\s+de\s+([\d.]+)/i);
  if(continuousMatch) totals.push(numberFromPtBr(continuousMatch[1]));

  const recorteMatch = pageInfo.match(/Recorte atual:\s*([\d.]+)/i);
  if(recorteMatch) totals.push(numberFromPtBr(recorteMatch[1]));

  const continuousPageMatch = pageInfo.match(/Carregamento contínuo\s*·\s*[\d.]+\s+de\s+([\d.]+)/i);
  if(continuousPageMatch) totals.push(numberFromPtBr(continuousPageMatch[1]));

  return Math.max(0, ...totals);
}

function reconcileInfiniteStatus(){
  const status = document.getElementById("analisesInfiniteStatus");
  if(!status) return;

  const shown = visibleTableRows();
  const total = Math.max(totalFromInterface(), shown);

  if(shown > 0){
    status.classList.remove("is-loading");
    status.textContent = shown >= total
      ? `Todos os ${total.toLocaleString("pt-BR")} registros do recorte foram exibidos.`
      : `${shown.toLocaleString("pt-BR")} registros exibidos. Role a tabela para carregar mais.`;
    return;
  }

  if(total > 0 && /Nenhum registro encontrado/i.test(txt(status.textContent))){
    status.textContent = `Carregando registros do recorte (${total.toLocaleString("pt-BR")} no total)...`;
    status.classList.add("is-loading");
  }
}

function ensureStyles(){
  if(document.getElementById("analisesResidualUiFixStyles")) return;
  const style = document.createElement("style");
  style.id = "analisesResidualUiFixStyles";
  style.textContent = `
    #scopeGuardUnits[data-scope-compatibility="true"],
    #scopeGuardEditais[data-scope-compatibility="true"],
    #scopeGuardUnits[data-scope-compatibility="true"] + .ts-wrapper,
    #scopeGuardEditais[data-scope-compatibility="true"] + .ts-wrapper{
      display:none!important
    }
    .analises-drawer-backdrop{z-index:2147483000!important}
  `;
  document.head.appendChild(style);
}

function bindTableScroll(){
  if(tableScrollBound) return;
  const wrap = document.querySelector(".table-wrap");
  if(!wrap) return;
  tableScrollBound = true;
  wrap.addEventListener("scroll", () => window.setTimeout(reconcileInfiniteStatus, 120), { passive:true });
}

function sweep(attempt = 0){
  cleanupCompatibilitySelectors();
  reconcileInfiniteStatus();
  bindTableScroll();

  if(attempt < 30){
    window.clearTimeout(sweepTimer);
    sweepTimer = window.setTimeout(() => sweep(attempt + 1), 120);
  }
}

function scheduleSweep(){
  window.clearTimeout(sweepTimer);
  sweepTimer = window.setTimeout(() => sweep(0), 0);
}

function init(){
  ensureStyles();
  scheduleSweep();

  [
    "agsus:analises-loading-end",
    "agsus:analises-query-complete",
    "agsus:analises-cache-cleared",
    "agsus:analises-scope-guard-ready"
  ].forEach(eventName => document.addEventListener(eventName, scheduleSweep));

  document.addEventListener("click", event => {
    if(event.target?.closest?.("#scopeGuardLoad,#refreshBtn,#clearBtn,[data-kpi]")) scheduleSweep();
  }, true);

  document.addEventListener("change", event => {
    if(event.target?.closest?.(".filter-panel")) scheduleSweep();
  }, true);

  window.addEventListener("load", scheduleSweep, { once:true });
}

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true });
else init();
