import { createIcons, icons } from "lucide";

const ICON_MAP = {
  "fa-folder-open": "folder-open",
  "fa-briefcase": "briefcase-business",
  "fa-user-check": "user-check",
  "fa-triangle-exclamation": "triangle-alert",
  "fa-circle-exclamation": "circle-alert",
  "fa-users": "users",
  "fa-table-list": "table-properties",
  "fa-magnifying-glass": "search",
  "fa-eye": "eye",
  "fa-eye-slash": "eye-off",
  "fa-table-columns": "columns-3",
  "fa-keyboard": "keyboard",
  "fa-pen-to-square": "square-pen",
  "fa-rotate-right": "refresh-cw",
  "fa-download": "download",
  "fa-expand": "maximize",
  "fa-ellipsis-vertical": "ellipsis-vertical",
  "fa-moon": "moon",
  "fa-right-from-bracket": "log-out",
  "fa-arrow-right-from-bracket": "log-out",
  "fa-arrow-left": "arrow-left",
  "fa-angles-right": "chevrons-right",
  "fa-display": "monitor",
  "fa-file-pdf": "file-text",
  "fa-paper-plane": "send",
  "fa-layer-group": "layers-3",
  "fa-circle": "circle",
  "fa-gear": "settings",
  "fa-shield": "shield-check",
  "fa-gauge": "gauge",
  "fa-map-location-dot": "map-pinned",
  "fa-location-dot": "map-pin",
  "fa-house": "house",
  "fa-chart-line": "chart-no-axes-combined",
  "fa-chart-pie": "chart-pie",
  "fa-list-check": "list-checks",
  "fa-floppy-disk": "save",
  "fa-plus": "plus",
  "fa-trash": "trash-2",
  "fa-xmark": "x",
  "fa-check": "check",
  "fa-lock": "lock-keyhole",
  "fa-unlock": "lock-keyhole-open",
  "fa-link": "link",
  "fa-arrow-up-right-from-square": "external-link"
};

let iconRefreshQueued = false;
let filterRefreshQueued = false;
const pendingFilterRoots = new Set();

function normalize(value){
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function mappedIconName(element){
  for(const className of element.classList){
    if(ICON_MAP[className]) return ICON_MAP[className];
  }
  return "";
}

function convertIcons(root = document){
  const candidates = [];
  if(root instanceof Element && root.matches("i.fa-solid, i.fa-regular")) candidates.push(root);
  if(root.querySelectorAll) candidates.push(...root.querySelectorAll("i.fa-solid, i.fa-regular"));

  candidates.forEach(element => {
    if(element.dataset.lucideConverted === "true") return;
    const iconName = mappedIconName(element);
    if(!iconName) return;

    const replacement = document.createElement("i");
    replacement.dataset.lucide = iconName;
    replacement.dataset.lucideConverted = "true";
    replacement.setAttribute("aria-hidden", element.getAttribute("aria-hidden") || "true");
    replacement.className = "agsus-lucide-icon";

    const style = element.getAttribute("style");
    if(style) replacement.setAttribute("style", style);
    element.replaceWith(replacement);
  });

  scheduleIconRefresh();
}

function scheduleIconRefresh(){
  if(iconRefreshQueued) return;
  iconRefreshQueued = true;
  queueMicrotask(() => {
    iconRefreshQueued = false;
    try{
      createIcons({
        icons,
        attrs: {
          width: 17,
          height: 17,
          "stroke-width": 2,
          class: "lucide agsus-lucide-icon"
        }
      });
    }catch(error){
      console.warn("Não foi possível atualizar os ícones Lucide:", error);
    }
  });
}

function fieldLabel(select){
  const wrapper = select.closest("#filterBody > div, .filter-body > div");
  return wrapper?.querySelector("label")?.textContent?.trim() || "opções";
}

function updateVisibleOptions(select, query){
  const normalizedQuery = normalize(query);
  const options = [...select.querySelectorAll(".multi-option:not(.empty)")];
  let visible = 0;

  options.forEach(option => {
    const matches = !normalizedQuery || normalize(option.textContent).includes(normalizedQuery);
    option.hidden = !matches;
    if(matches) visible += 1;
  });

  const hint = select.querySelector(".multi-hint");
  if(hint){
    const total = options.length;
    hint.textContent = normalizedQuery
      ? `${visible} de ${total} opção(ões) encontrada(s).`
      : `${total} opção(ões) disponível(is).`;
  }

  let empty = select.querySelector(".multi-search-empty");
  if(normalizedQuery && visible === 0){
    if(!empty){
      empty = document.createElement("div");
      empty.className = "multi-search-empty";
      empty.textContent = "Nenhum resultado encontrado.";
      select.querySelector(".multi-options")?.appendChild(empty);
    }
    empty.hidden = false;
  }else if(empty){
    empty.hidden = true;
  }
}

function enhanceFilter(select){
  if(!(select instanceof Element) || !select.classList.contains("multi-select")) return;
  const menu = select.querySelector(".multi-select-menu");
  if(!menu || menu.querySelector(".multi-search-wrap")) return;

  const wrap = document.createElement("div");
  wrap.className = "multi-search-wrap";
  wrap.innerHTML = `
    <i data-lucide="search" aria-hidden="true"></i>
    <input type="search" class="multi-search-input" autocomplete="off">
  `;

  const input = wrap.querySelector("input");
  const label = fieldLabel(select);
  input.placeholder = `Pesquisar ${label.toLowerCase()}`;
  input.setAttribute("aria-label", `Pesquisar ${label}`);

  ["click", "pointerdown", "keydown"].forEach(eventName => {
    wrap.addEventListener(eventName, event => event.stopPropagation());
  });
  input.addEventListener("input", () => updateVisibleOptions(select, input.value));
  input.addEventListener("keydown", event => {
    if(event.key === "Escape"){
      input.value = "";
      updateVisibleOptions(select, "");
      select.classList.remove("open");
      select.querySelector(".multi-select-toggle")?.focus();
    }
  });

  menu.insertAdjacentElement("afterbegin", wrap);
  scheduleIconRefresh();
}

function enhanceFilters(root = document){
  if(root instanceof Element && root.classList.contains("multi-select")) enhanceFilter(root);
  root.querySelectorAll?.(".multi-select").forEach(enhanceFilter);
}

function scheduleFilterRefresh(root = document){
  pendingFilterRoots.add(root);
  if(filterRefreshQueued) return;
  filterRefreshQueued = true;
  queueMicrotask(() => {
    filterRefreshQueued = false;
    const roots = [...pendingFilterRoots];
    pendingFilterRoots.clear();
    roots.forEach(enhanceFilters);
  });
}

function ensureStyles(){
  if(document.getElementById("agsusUiModernizationStyles")) return;
  const style = document.createElement("style");
  style.id = "agsusUiModernizationStyles";
  style.textContent = `
    .agsus-lucide-icon{display:inline-block;vertical-align:-.18em;flex:0 0 auto}
    button .agsus-lucide-icon,.btn .agsus-lucide-icon{margin-right:2px}
    .nav-ico .agsus-lucide-icon{width:19px;height:19px;margin:0}
    .multi-search-wrap{position:relative;padding:10px 10px 6px;border-bottom:1px solid rgba(148,163,184,.16)}
    .multi-search-wrap .agsus-lucide-icon,.multi-search-wrap svg{position:absolute;left:21px;top:50%;transform:translateY(-42%);width:15px;height:15px;color:#7890aa;pointer-events:none}
    .multi-search-input{width:100%;min-height:38px;border:1px solid rgba(96,117,143,.25);border-radius:10px;background:#fff;color:#10243e;padding:8px 10px 8px 34px;font:inherit;font-size:13px;outline:none}
    .multi-search-input:focus{border-color:#0d6efd;box-shadow:0 0 0 3px rgba(13,110,253,.12)}
    .multi-search-input::placeholder{color:#7890aa}
    .multi-option[hidden]{display:none!important}
    .multi-search-empty{padding:14px 10px;color:#7890aa;font-size:12px;font-weight:700;text-align:center}
    body.dark-mode .multi-search-input{background:#10243e;color:#e7f0fb;border-color:rgba(174,196,219,.25)}
    body.dark-mode .multi-search-input::placeholder{color:#9fb3c8}
  `;
  document.head.appendChild(style);
}

function processAddedNode(node){
  if(!(node instanceof Element)) return;
  convertIcons(node);
  const parentFilter = node.closest?.(".multi-select");
  if(parentFilter) scheduleFilterRefresh(parentFilter);
  scheduleFilterRefresh(node);
}

export function initUiModernization(){
  const start = () => {
    ensureStyles();
    convertIcons(document);
    enhanceFilters(document);

    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => mutation.addedNodes.forEach(processAddedNode));
    });
    observer.observe(document.body, { childList:true, subtree:true });
  };

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", start, { once:true });
  }else{
    start();
  }
}
