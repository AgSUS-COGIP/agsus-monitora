const state = { initialized:false };

function buttonParts(button){
  return {
    icon: button?.querySelector("i"),
    label: button?.querySelector(".toggle-label") || button
  };
}

function setFiltersCollapsed(collapsed){
  const body = document.getElementById("filtersBody");
  const button = document.getElementById("toggleFiltersBtn");
  if(!body || !button) return;

  body.hidden = collapsed;
  button.setAttribute("aria-expanded", String(!collapsed));
  button.title = collapsed ? "Mostrar filtros complementares" : "Ocultar filtros complementares";

  const { icon, label } = buttonParts(button);
  if(icon) icon.className = collapsed ? "fa-solid fa-eye" : "fa-solid fa-eye-slash";
  if(label) label.textContent = collapsed ? "Mostrar filtros" : "Ocultar filtros";

  if(collapsed){
    document.getElementById("advancedFilters")?.classList.remove("show");
    updateAdvancedButton(false);
  }
}

function updateAdvancedButton(open){
  const button = document.getElementById("advancedBtn");
  if(!button) return;
  button.innerHTML = open
    ? '<i class="fa-solid fa-sliders"></i> Fechar avançados'
    : '<i class="fa-solid fa-sliders"></i> Filtros avançados';
  button.setAttribute("aria-expanded", String(open));
}

function toggleAdvanced(){
  const body = document.getElementById("filtersBody");
  const advanced = document.getElementById("advancedFilters");
  if(!body || !advanced) return;

  if(body.hidden) setFiltersCollapsed(false);
  const open = !advanced.classList.contains("show");
  advanced.classList.toggle("show", open);
  updateAdvancedButton(open);
}

function bindControls(){
  document.addEventListener("click", event => {
    const toggle = event.target?.closest?.("#toggleFiltersBtn");
    if(toggle){
      event.preventDefault();
      event.stopImmediatePropagation();
      setFiltersCollapsed(!document.getElementById("filtersBody")?.hidden);
      return;
    }

    const advanced = event.target?.closest?.("#advancedBtn");
    if(advanced){
      event.preventDefault();
      event.stopImmediatePropagation();
      toggleAdvanced();
    }
  }, true);
}

function start(){
  if(state.initialized) return;
  state.initialized = true;

  const filtersBody = document.getElementById("filtersBody");
  if(filtersBody){
    filtersBody.hidden = true;
    setFiltersCollapsed(true);
  }
  updateAdvancedButton(false);
  bindControls();
}

document.addEventListener("DOMContentLoaded", start, { once:true });
