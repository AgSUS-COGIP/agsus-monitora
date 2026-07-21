import { createIcons, icons } from "lucide";

const normalize = value => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/\s+/g, " ")
  .trim();

const state = { tab:"all", query:"" };

function iconMarkup(name, size = 18){
  return `<i data-lucide="${name}" width="${size}" height="${size}" aria-hidden="true"></i>`;
}

function refreshIcons(){
  try{
    createIcons({
      icons,
      attrs: {
        "stroke-width": 2,
        "aria-hidden": "true"
      }
    });
  }catch(error){
    console.warn("Não foi possível atualizar os ícones da tela de configurações:", error);
  }
}

function cardCategory(card){
  const id = card.id || "";
  const text = normalize(card.textContent);
  if(id.includes("access") || text.includes("acesso") || text.includes("usuario")) return "access";
  if(text.includes("painel externo") || text.includes("paineis externos") || text.includes("painel")) return "panels";
  return "system";
}

function configCards(page){
  return [...page.querySelectorAll(":scope .admin-grid > .admin-card")];
}

function updateSummary(page){
  const cards = configCards(page);
  const visible = cards.filter(card => !card.hidden && card.style.display !== "none");
  const fields = visible.reduce((total, card) => total + card.querySelectorAll("input,select,textarea").length, 0);
  const summary = page.querySelector("#configModernSummary");
  if(summary) summary.textContent = `${visible.length} seção(ões) · ${fields} campo(s) visível(is)`;
}

function applyFilters(page){
  const query = normalize(state.query);
  configCards(page).forEach(card => {
    const category = cardCategory(card);
    card.dataset.configCategory = category;
    const tabMatch = state.tab === "all" || category === state.tab;
    const queryMatch = !query || normalize(card.textContent).includes(query);
    card.style.display = tabMatch && queryMatch ? "" : "none";
  });
  updateSummary(page);

  page.querySelectorAll("[data-config-tab]").forEach(button => {
    const active = button.dataset.configTab === state.tab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
}

function buildToolbar(page){
  if(page.querySelector("#configModernToolbar")) return;
  const grid = page.querySelector(":scope > .admin-grid");
  if(!grid) return;

  const toolbar = document.createElement("section");
  toolbar.id = "configModernToolbar";
  toolbar.className = "config-modern-toolbar card";
  toolbar.innerHTML = `
    <div class="config-modern-hero">
      <div class="config-modern-icon">${iconMarkup("settings", 22)}</div>
      <div>
        <span class="config-modern-eyebrow">Administração do sistema</span>
        <h2>Central de configurações</h2>
        <p>Localize parâmetros, gerencie acessos e organize painéis em uma única área.</p>
      </div>
      <span id="configModernSummary" class="config-modern-summary"></span>
    </div>
    <div class="config-modern-controls">
      <div class="config-modern-tabs" role="tablist" aria-label="Seções de configuração">
        <button type="button" class="active" data-config-tab="all" role="tab">${iconMarkup("settings")} Tudo</button>
        <button type="button" data-config-tab="system" role="tab">${iconMarkup("shield-check")} Sistema</button>
        <button type="button" data-config-tab="access" role="tab">${iconMarkup("users")} Acessos</button>
        <button type="button" data-config-tab="panels" role="tab">${iconMarkup("panels-top-left")} Painéis</button>
      </div>
      <label class="config-modern-search">
        ${iconMarkup("search")}
        <span class="sr-only">Pesquisar configurações</span>
        <input id="configModernSearch" type="search" placeholder="Pesquisar configuração, acesso ou painel..." autocomplete="off">
      </label>
    </div>
  `;

  grid.insertAdjacentElement("beforebegin", toolbar);
  refreshIcons();

  toolbar.querySelectorAll("[data-config-tab]").forEach(button => {
    button.addEventListener("click", () => {
      state.tab = button.dataset.configTab || "all";
      applyFilters(page);
    });
  });

  toolbar.querySelector("#configModernSearch")?.addEventListener("input", event => {
    state.query = event.target.value;
    applyFilters(page);
  });
}

function decorateCards(page){
  let changed = false;
  configCards(page).forEach(card => {
    if(card.dataset.configModernized === "true") return;
    card.dataset.configModernized = "true";
    const heading = card.querySelector("h3");
    if(heading && !heading.closest(".config-modern-card-heading")){
      const wrapper = document.createElement("div");
      wrapper.className = "config-modern-card-heading";
      heading.parentNode.insertBefore(wrapper, heading);
      wrapper.appendChild(heading);
      changed = true;
    }
  });
  return changed;
}

function ensureStyles(){
  if(document.getElementById("configModernizationStyles")) return;
  const style = document.createElement("style");
  style.id = "configModernizationStyles";
  style.textContent = `
    #page-config{display:none}
    #page-config.active{display:block}
    .config-modern-toolbar{margin-bottom:18px;padding:20px;border:1px solid rgba(0,59,112,.12);box-shadow:0 10px 28px rgba(15,35,60,.07)}
    .config-modern-hero{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center}
    .config-modern-icon{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(135deg,#003b70,#0d6efd);color:#fff}
    .config-modern-eyebrow{display:block;color:#0b8f58;font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;margin-bottom:3px}
    .config-modern-hero h2{margin:0;color:#10243e;font-size:22px}.config-modern-hero p{margin:4px 0 0;color:#60758f;font-size:13px}
    .config-modern-summary{font-size:12px;font-weight:800;color:#60758f;background:#f3f7fb;border:1px solid rgba(0,59,112,.1);border-radius:999px;padding:8px 12px;white-space:nowrap}
    .config-modern-controls{margin-top:18px;display:flex;justify-content:space-between;gap:14px;align-items:center;flex-wrap:wrap}
    .config-modern-tabs{display:flex;gap:8px;flex-wrap:wrap}.config-modern-tabs button{border:1px solid rgba(0,59,112,.16);background:#fff;color:#43566d;border-radius:10px;min-height:38px;padding:0 12px;display:inline-flex;gap:7px;align-items:center;font:inherit;font-size:12px;font-weight:800;cursor:pointer}
    .config-modern-tabs button:hover,.config-modern-tabs button.active{background:#003b70;color:#fff;border-color:#003b70}.config-modern-tabs svg{width:16px;height:16px}
    .config-modern-search{min-width:min(360px,100%);min-height:42px;border:1px solid rgba(0,59,112,.16);border-radius:12px;background:#fff;display:flex;align-items:center;gap:9px;padding:0 12px;color:#60758f}
    .config-modern-search input{border:0;outline:0;background:transparent;width:100%;font:inherit;color:#10243e}.config-modern-search svg{width:17px;height:17px;flex:none}
    #page-config .admin-grid{gap:18px}#page-config .admin-card{border-color:rgba(0,59,112,.12);box-shadow:0 8px 24px rgba(15,35,60,.06);transition:box-shadow .2s ease,transform .2s ease}
    #page-config .admin-card:hover{box-shadow:0 12px 30px rgba(15,35,60,.09)}
    #page-config .config-card-title{padding-bottom:14px;margin-bottom:16px;border-bottom:1px solid rgba(0,59,112,.1)}
    #page-config .form-row label{font-size:12px;font-weight:800;color:#43566d;margin-bottom:6px}
    #page-config input,#page-config select,#page-config textarea{border-radius:10px;border-color:rgba(0,59,112,.18);min-height:42px}
    #page-config input:focus,#page-config select:focus,#page-config textarea:focus{border-color:#0d6efd;box-shadow:0 0 0 3px rgba(13,110,253,.12);outline:0}
    @media(max-width:760px){.config-modern-hero{grid-template-columns:auto 1fr}.config-modern-summary{grid-column:1/-1;justify-self:start}.config-modern-controls{align-items:stretch}.config-modern-search{width:100%}}
  `;
  document.head.appendChild(style);
}

function initialize(){
  const page = document.getElementById("page-config");
  if(!page) return;
  ensureStyles();
  buildToolbar(page);
  decorateCards(page);
  applyFilters(page);

  let refreshQueued = false;
  const observer = new MutationObserver(() => {
    if(refreshQueued) return;
    refreshQueued = true;
    queueMicrotask(() => {
      refreshQueued = false;
      decorateCards(page);
      applyFilters(page);
      refreshIcons();
    });
  });
  observer.observe(page, { childList:true, subtree:true });
}

export function initConfigModernization(){
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once:true });
  else initialize();
}
