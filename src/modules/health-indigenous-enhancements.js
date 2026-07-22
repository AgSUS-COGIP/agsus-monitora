const UNIT_FILTER_ID = "filterUnidade";
let unitQuery = "";

function normalize(value){
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function applyUnitSearch(container, query){
  const normalizedQuery = normalize(query);
  const options = [...container.querySelectorAll(".multi-option:not(.empty)")];
  let visible = 0;

  options.forEach(option => {
    const matches = !normalizedQuery || normalize(option.textContent).includes(normalizedQuery);
    option.hidden = !matches;
    if(matches) visible += 1;
  });

  const hint = container.querySelector(".multi-hint");
  if(hint){
    hint.textContent = normalizedQuery
      ? `${visible} de ${options.length} unidade(s) encontrada(s).`
      : `${options.length} unidade(s) disponível(is).`;
  }

  let empty = container.querySelector(".health-unit-search-empty");
  if(normalizedQuery && visible === 0){
    if(!empty){
      empty = document.createElement("div");
      empty.className = "health-unit-search-empty";
      empty.textContent = "Nenhuma unidade encontrada.";
      container.querySelector(".multi-options")?.appendChild(empty);
    }
    empty.hidden = false;
  }else if(empty){
    empty.hidden = true;
  }
}

function ensureUnitSearch(container, focus = false){
  const menu = container?.querySelector(".multi-select-menu");
  if(!menu) return;

  let wrap = menu.querySelector(".health-unit-search");
  if(!wrap){
    wrap = document.createElement("div");
    wrap.className = "health-unit-search";
    wrap.innerHTML = `
      <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
      <input type="search" autocomplete="off" aria-label="Pesquisar unidade" placeholder="Pesquisar unidade...">
    `;

    const input = wrap.querySelector("input");
    input.value = unitQuery;

    ["click", "pointerdown", "keydown"].forEach(eventName => {
      wrap.addEventListener(eventName, event => event.stopPropagation());
    });

    input.addEventListener("input", () => {
      unitQuery = input.value;
      applyUnitSearch(container, unitQuery);
    });

    input.addEventListener("keydown", event => {
      if(event.key !== "Escape") return;
      event.preventDefault();
      unitQuery = "";
      input.value = "";
      applyUnitSearch(container, "");
      container.classList.remove("open");
      container.querySelector(".multi-select-toggle")?.focus();
    });

    menu.insertAdjacentElement("afterbegin", wrap);
  }

  const input = wrap.querySelector("input");
  if(input && input.value !== unitQuery) input.value = unitQuery;
  applyUnitSearch(container, unitQuery);
  if(focus) requestAnimationFrame(() => input?.focus());
}

function refreshAfterLegacyRender(focus = false){
  window.setTimeout(() => {
    const container = document.getElementById(UNIT_FILTER_ID);
    if(container?.classList.contains("open")) ensureUnitSearch(container, focus);
  }, 0);
}

function handleClick(event){
  const toggle = event.target.closest?.(`#${UNIT_FILTER_ID} .multi-select-toggle`);
  if(toggle){
    refreshAfterLegacyRender(true);
    return;
  }

  const action = event.target.closest?.(`#${UNIT_FILTER_ID} [data-filter-action]`);
  if(action) refreshAfterLegacyRender(false);
}

function handleChange(event){
  if(event.target.matches?.(`#${UNIT_FILTER_ID} input[data-filter-field]`)){
    refreshAfterLegacyRender(false);
  }
}

export function initHealthIndigenousEnhancements(){
  document.addEventListener("click", handleClick);
  document.addEventListener("change", handleChange);
}
