import TomSelect from "tom-select";
import "tom-select/dist/css/tom-select.css";

const SELECT_IDS = ["scopeGuardUnits", "scopeGuardEditais"];
const instances = new Map();
let globalCloseHandlersBound = false;
let installTimer = 0;
let installAttempts = 0;

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

function counterText(select){
  const selected = selectedValues(select).length;
  const total = [...select.options].filter(option => !option.disabled).length;
  return `${selected} de ${total} selecionado(s)`;
}

function updateCounter(select){
  const counter = select.closest(".scope-guard-field")?.querySelector(".scope-modern-counter");
  if(counter) counter.textContent = counterText(select);
}

function closeInstances(except = null){
  instances.forEach(instance => {
    if(instance !== except) instance.close?.();
  });
}

function bindGlobalCloseHandlers(){
  if(globalCloseHandlersBound) return;
  globalCloseHandlersBound = true;

  document.addEventListener("keydown", event => {
    if(event.key === "Escape") closeInstances();
  });

  document.addEventListener("pointerdown", event => {
    instances.forEach(instance => {
      const clickedInside = instance.wrapper?.contains(event.target)
        || instance.dropdown?.contains(event.target);
      if(!clickedInside) instance.close?.();
    });
  }, true);

  window.addEventListener("scroll", () => closeInstances(), { passive:true });
  window.addEventListener("resize", () => closeInstances(), { passive:true });
}

function syncTomSelect(select, instance){
  const values = selectedValues(select);
  instance.close?.();
  instance.clear(true);
  instance.clearOptions();
  instance.addOptions(optionData(select));
  instance.setValue(values, true);
  instance.refreshOptions(false);
  updateCounter(select);
}

function dispatchNativeChange(select){
  select.dispatchEvent(new Event("change", { bubbles:true }));
}

function setAll(select, instance, selected){
  const values = selected
    ? [...select.options].filter(option => !option.disabled).map(option => option.value)
    : [];
  instance.setValue(values, true);
  instance.close?.();
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
  allButton.setAttribute("aria-label", `Selecionar todas as opções de ${label.textContent}`);
  allButton.addEventListener("click", () => setAll(select, instance, true));

  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.className = "scope-modern-action";
  clearButton.textContent = "Limpar";
  clearButton.setAttribute("aria-label", `Limpar seleção de ${label.textContent}`);
  clearButton.addEventListener("click", () => setAll(select, instance, false));

  const counter = document.createElement("span");
  counter.className = "scope-modern-counter";
  counter.setAttribute("aria-live", "polite");
  counter.textContent = counterText(select);

  actions.append(allButton, clearButton, counter);
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
    maxOptions: 250,
    create: false,
    persist: false,
    closeAfterSelect: true,
    hideSelected: true,
    openOnFocus: false,
    placeholder,
    searchField: ["text"],
    onDropdownOpen(){
      closeInstances(this);
    },
    onItemAdd(){
      this.close?.();
    },
    render: {
      no_results(){
        return '<div class="no-results">Nenhum resultado encontrado</div>';
      }
    }
  });

  instances.set(select.id, instance);
  ensureActions(select, instance);
  instance.control_input?.setAttribute("aria-label", placeholder);
  instance.control_input?.setAttribute("autocomplete", "off");

  let syncing = false;
  const syncFromNative = () => {
    if(syncing) return;
    syncing = true;
    try{
      instance.setValue(selectedValues(select), true);
      instance.close?.();
      updateCounter(select);
    }finally{
      syncing = false;
    }
  };

  select.addEventListener("change", syncFromNative);
  select.addEventListener("agsus:options-updated", () => {
    if(syncing) return;
    syncing = true;
    try{
      syncTomSelect(select, instance);
    }finally{
      syncing = false;
    }
  });

  return instance;
}

function ensureStyles(){
  if(document.getElementById("analisesModernSelectStyles")) return;
  const style = document.createElement("style");
  style.id = "analisesModernSelectStyles";
  style.textContent = `
    .scope-modern-actions{display:flex;gap:12px;align-items:center;margin-top:-2px;margin-bottom:2px;flex-wrap:wrap}
    .scope-modern-action{border:0;background:transparent;color:var(--blue);font:inherit;font-size:12px;font-weight:850;padding:0;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
    .scope-modern-action:hover{filter:brightness(1.15)}
    .scope-modern-action:focus-visible{outline:2px solid var(--blue);outline-offset:3px;border-radius:4px}
    .scope-modern-counter{margin-left:auto;color:var(--muted);font-size:12px;font-weight:800}
    .scope-guard .ts-wrapper{width:100%;position:relative}
    .scope-guard .ts-control{min-height:48px;border:1px solid rgba(148,163,184,.28);border-radius:12px;background:var(--card);color:var(--text);padding:8px 10px;box-shadow:none}
    .scope-guard .ts-wrapper.focus .ts-control{border-color:var(--blue);box-shadow:0 0 0 3px color-mix(in srgb,var(--blue) 20%,transparent)}
    .scope-guard .ts-control input{color:var(--text);min-width:180px}
    .scope-guard .ts-control .item{background:color-mix(in srgb,var(--blue) 16%,var(--card));border:1px solid color-mix(in srgb,var(--blue) 35%,transparent);color:var(--strong);border-radius:999px;padding:5px 10px;font-size:12px;font-weight:800}
    .scope-guard .ts-control .item .remove{border-left:0;margin-left:6px;padding-left:6px;color:var(--muted)}
    .scope-guard .ts-dropdown{z-index:80;border:1px solid rgba(148,163,184,.28);border-radius:12px;background:var(--card);color:var(--text);box-shadow:0 18px 45px rgba(2,8,23,.28);overflow:hidden}
    .scope-guard .ts-dropdown-content{max-height:220px;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable}
    .scope-guard .ts-dropdown .option{padding:10px 12px}
    .scope-guard .ts-dropdown .option.active{background:color-mix(in srgb,var(--blue) 15%,var(--card));color:var(--strong)}
    .scope-guard .ts-dropdown .selected{background:color-mix(in srgb,var(--green) 12%,var(--card));color:var(--strong)}
    .scope-guard .ts-dropdown .no-results{padding:12px;color:var(--muted);font-size:13px}
    .scope-guard select[multiple]{position:absolute!important;opacity:0!important;pointer-events:none!important;width:1px!important;height:1px!important}
    @media(max-width:640px){.scope-modern-counter{width:100%;margin-left:0}.scope-guard .ts-dropdown-content{max-height:180px}}
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

function stopInstallLoop(){
  window.clearTimeout(installTimer);
  installTimer = 0;
  installAttempts = 0;
}

function installStep(){
  if(install()){
    stopInstallLoop();
    return;
  }
  installAttempts += 1;
  if(installAttempts >= 80){
    stopInstallLoop();
    console.warn("Seletores históricos de Análises não ficaram disponíveis no tempo esperado.");
    return;
  }
  installTimer = window.setTimeout(installStep, 100);
}

function startInstallLoop(){
  stopInstallLoop();
  installTimer = window.setTimeout(installStep, 0);
}

function start(){
  ensureStyles();
  bindGlobalCloseHandlers();
  startInstallLoop();
  document.addEventListener("agsus:analises-scope-guard-ready", startInstallLoop);
}

document.addEventListener("DOMContentLoaded", start, { once:true });
