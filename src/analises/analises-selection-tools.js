const txt = value => String(value ?? "").trim();

function normalizeLabel(value){
  return txt(value).replace(/\s+/g, " ");
}

function selectAllOptions(select){
  [...select.options].forEach(option => { option.selected = true; });
  select.dispatchEvent(new Event("change", { bubbles:true }));
}

function clearOptions(select){
  [...select.options].forEach(option => { option.selected = false; });
  select.dispatchEvent(new Event("change", { bubbles:true }));
}

function createAction(label, onClick){
  const button = document.createElement("button");
  button.type = "button";
  button.className = "scope-guard-link";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function installActions(selectId){
  const select = document.getElementById(selectId);
  if(!select || select.dataset.selectionTools === "1") return;

  select.dataset.selectionTools = "1";
  const field = select.closest(".scope-guard-field");
  const label = field?.querySelector("label");
  if(!field || !label) return;

  const actions = document.createElement("span");
  actions.className = "scope-guard-actions";
  actions.append(
    createAction("Selecionar tudo", () => selectAllOptions(select)),
    createAction("Limpar", () => clearOptions(select))
  );
  label.insertAdjacentElement("afterend", actions);
}

function normalizeVisibleOptions(){
  ["scopeGuardUnits", "scopeGuardEditais"].forEach(id => {
    const select = document.getElementById(id);
    if(!select) return;
    [...select.options].forEach(option => {
      const normalized = normalizeLabel(option.textContent);
      option.textContent = normalized;
      option.title = normalized;
    });
  });
}

function install(){
  const guard = document.getElementById("scopeGuard");
  if(!guard) return false;

  installActions("scopeGuardUnits");
  installActions("scopeGuardEditais");
  normalizeVisibleOptions();
  return true;
}

function ensureStyles(){
  if(document.getElementById("analisesSelectionToolsStyles")) return;
  const style = document.createElement("style");
  style.id = "analisesSelectionToolsStyles";
  style.textContent = `
    .scope-guard-actions{display:flex;gap:10px;align-items:center;margin-top:-2px}
    .scope-guard-link{border:0;background:transparent;padding:0;color:var(--blue);font:inherit;font-size:12px;font-weight:850;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
    .scope-guard-link:hover{filter:brightness(1.15)}
  `;
  document.head.appendChild(style);
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
