import TomSelect from "tom-select";
import "tom-select/dist/css/tom-select.css";

const SELECT_IDS = ["scopeGuardUnits", "scopeGuardEditais"];
const instances = new Map();

export function normalizeLabel(value){
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function selectedValues(select){
  return [...select.selectedOptions].map(option => option.value).filter(Boolean);
}

function optionData(select){
  return [...select.options].map(option => ({
    value: option.value,
    text: normalizeLabel(option.textContent),
    disabled: option.disabled
  }));
}

function syncTomSelect(select, instance){
  const values = selectedValues(select);
  instance.clear(true);
  instance.clearOptions();
  instance.addOptions(optionData(select));
  instance.setValue(values, true);
  instance.refreshOptions(false);
}

function dispatchNativeChange(select){
  select.dispatchEvent(new Event("change", { bubbles:true }));
}

function setAll(select, instance, selected){
  const values = selected ? [...select.options].filter(option => !option.disabled).map(option => option.value) : [];
  instance.setValue(values, true);
  dispatchNativeChange(select);
}

function ensureActions(select, instance){
  const field = select.closest(".scope-guard-field");
  const label = field?.querySelector("label");
  if(!field || !label || field.querySelector(".scope-modern-actions")) return;

  const actions = document.createElement("div");
  actions.className = "scope-modern-actions";

  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = "scope-modern-action";
  allButton.textContent = "Selecionar tudo";
  allButton.addEventListener("click", () => setAll(select, instance, true));

  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.className = "scope-modern-action";
  clearButton.textContent = "Limpar";
  clearButton.addEventListener("click", () => setAll(select, instance, false));

  actions.append(allButton, clearButton);
  label.insertAdjacentElement("afterend", actions);
}

function createInstance(select){
  if(instances.has(select.id)) return instances.get(select.id);

  const placeholder = select.id === "scopeGuardUnits"
    ? "Pesquise e selecione unidades"
    : "Pesquise e selecione editais";

  const instance = new TomSelect(select, {
    plugins: {
      remove_button: { title:"Remover" }
    },
    maxItems: null,
    create: false,
    persist: false,
    closeAfterSelect: false,
    hideSelected: false,
    placeholder,
    searchField: ["text"],
    render: {
      no_results(){
        return '<div class="no-results">Nenhum resultado encontrado</div>';
      }
    }
  });

  instances.set(select.id, instance);
  ensureActions(select, instance);

  let syncing = false;
  const syncFromNative = () => {
    if(syncing) return;
    syncing = true;
    try{
      instance.setValue(selectedValues(select), true);
    }finally{
      syncing = false;
    }
  };

  select.addEventListener("change", syncFromNative);

  const observer = new MutationObserver(() => {
    if(syncing) return;
    syncing = true;
    try{
      syncTomSelect(select, instance);
    }finally{
      syncing = false;
    }
  });
  observer.observe(select, { childList:true });

  return instance;
}

function ensureStyles(){
  if(document.getElementById("analisesModernSelectStyles")) return;
  const style = document.createElement("style");
  style.id = "analisesModernSelectStyles";
  style.textContent = `
    .scope-modern-actions{display:flex;gap:12px;align-items:center;margin-top:-2px;margin-bottom:2px}
    .scope-modern-action{border:0;background:transparent;color:var(--blue);font:inherit;font-size:12px;font-weight:850;padding:0;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
    .scope-modern-action:hover{filter:brightness(1.15)}
    .scope-guard .ts-wrapper{width:100%}
    .scope-guard .ts-control{min-height:48px;border:1px solid rgba(148,163,184,.28);border-radius:12px;background:var(--card);color:var(--text);padding:8px 10px;box-shadow:none}
    .scope-guard .ts-wrapper.focus .ts-control{border-color:var(--blue);box-shadow:0 0 0 3px color-mix(in srgb,var(--blue) 20%,transparent)}
    .scope-guard .ts-control input{color:var(--text);min-width:180px}
    .scope-guard .ts-control .item{background:color-mix(in srgb,var(--blue) 16%,var(--card));border:1px solid color-mix(in srgb,var(--blue) 35%,transparent);color:var(--strong);border-radius:999px;padding:5px 10px;font-size:12px;font-weight:800}
    .scope-guard .ts-control .item .remove{border-left:0;margin-left:6px;padding-left:6px;color:var(--muted)}
    .scope-guard .ts-dropdown{border:1px solid rgba(148,163,184,.28);border-radius:12px;background:var(--card);color:var(--text);box-shadow:0 18px 45px rgba(2,8,23,.28);overflow:hidden}
    .scope-guard .ts-dropdown .option{padding:10px 12px}
    .scope-guard .ts-dropdown .option.active{background:color-mix(in srgb,var(--blue) 15%,var(--card));color:var(--strong)}
    .scope-guard .ts-dropdown .selected{background:color-mix(in srgb,var(--green) 12%,var(--card));color:var(--strong)}
    .scope-guard .ts-dropdown .no-results{padding:12px;color:var(--muted);font-size:13px}
    .scope-guard select[multiple]{position:absolute!important;opacity:0!important;pointer-events:none!important;width:1px!important;height:1px!important}
  `;
  document.head.appendChild(style);
}

function install(){
  let installed = 0;
  SELECT_IDS.forEach(id => {
    const select = document.getElementById(id);
    if(!select) return;
    createInstance(select);
    installed += 1;
  });
  return installed === SELECT_IDS.length;
}

function start(){
  ensureStyles();
  if(install()) return;

  const observer = new MutationObserver(() => {
    if(install()) observer.disconnect();
  });
  observer.observe(document.body, { childList:true, subtree:true });
}

document.addEventListener("DOMContentLoaded", start, { once:true });
