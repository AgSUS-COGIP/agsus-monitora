const THEME_STORAGE_KEY = "agsus_analises_theme_v3";

function ensureDarkModeStyles(){
  if(document.getElementById("analisesDarkModeFixStyles")) return;

  const style = document.createElement("style");
  style.id = "analisesDarkModeFixStyles";
  style.textContent = `
    html[data-theme="dark"]{
      color-scheme:dark;
      --bg:#07111f!important;
      --bg2:#0b1727!important;
      --card:#0f1c2e!important;
      --card2:#122238!important;
      --line:rgba(255,255,255,.09)!important;
      --line2:rgba(255,255,255,.16)!important;
      --text:#dbe8f5!important;
      --strong:#f7fbff!important;
      --muted:#9db0c6!important;
      --shadow:0 18px 50px rgba(0,0,0,.32)!important;
      --shadow-sm:0 6px 18px rgba(0,0,0,.28)!important;
    }

    html[data-theme="dark"] body{
      background:#07111f!important;
      background-image:none!important;
      color:var(--text)!important;
    }

    html[data-theme="dark"] .topbar{
      background:rgba(11,23,39,.96)!important;
      border-color:var(--line)!important;
      box-shadow:0 4px 18px rgba(0,0,0,.35)!important;
    }

    html[data-theme="dark"] .logo,
    html[data-theme="dark"] .panel,
    html[data-theme="dark"] .kpi,
    html[data-theme="dark"] .status-pill,
    html[data-theme="dark"] .table-card,
    html[data-theme="dark"] .table-wrap,
    html[data-theme="dark"] .table-meta,
    html[data-theme="dark"] .table-head,
    html[data-theme="dark"] .filter-summary,
    html[data-theme="dark"] .filters-toolbar,
    html[data-theme="dark"] .attention-item,
    html[data-theme="dark"] .analises-detail-section,
    html[data-theme="dark"] .analises-drawer-context > div,
    html[data-theme="dark"] .analises-drawer-head{
      background:var(--card)!important;
      color:var(--text)!important;
      border-color:var(--line)!important;
    }

    html[data-theme="dark"] .kpi{
      background:linear-gradient(180deg,#0f1c2e,#0b1727)!important;
    }

    html[data-theme="dark"] h1,
    html[data-theme="dark"] .title,
    html[data-theme="dark"] .primary-text,
    html[data-theme="dark"] .kv-value,
    html[data-theme="dark"] .analises-detail-section-head,
    html[data-theme="dark"] .filters-toolbar-copy strong,
    html[data-theme="dark"] .attention-item b,
    html[data-theme="dark"] .context-line,
    html[data-theme="dark"] .chip-filter,
    html[data-theme="dark"] .meta-chip,
    html[data-theme="dark"] .filter-summary.has-filters{
      color:var(--strong)!important;
    }

    html[data-theme="dark"] .sub,
    html[data-theme="dark"] .hint,
    html[data-theme="dark"] .secondary-text,
    html[data-theme="dark"] .kv-label,
    html[data-theme="dark"] .filters-toolbar-copy small,
    html[data-theme="dark"] .attention-item small,
    html[data-theme="dark"] .table-meta,
    html[data-theme="dark"] .analises-infinite-status,
    html[data-theme="dark"] .context-line,
    html[data-theme="dark"] .filter-summary{
      color:var(--muted)!important;
    }

    html[data-theme="dark"] select,
    html[data-theme="dark"] input,
    html[data-theme="dark"] .multi-select-trigger,
    html[data-theme="dark"] .multi-select-menu,
    html[data-theme="dark"] .multi-select-search,
    html[data-theme="dark"] .table-tools input,
    html[data-theme="dark"] .btn.secondary{
      background:var(--card2)!important;
      color:var(--text)!important;
      border-color:var(--line2)!important;
    }

    html[data-theme="dark"] .btn.secondary:hover,
    html[data-theme="dark"] .multi-select-option:hover,
    html[data-theme="dark"] .multi-select-option.is-active,
    html[data-theme="dark"] tbody tr:hover td{
      background:#182a42!important;
    }

    html[data-theme="dark"] th,
    html[data-theme="dark"] .table-wrap th{
      background:#122238!important;
      color:#c8d7e8!important;
      border-color:var(--line)!important;
      box-shadow:0 1px 0 var(--line),0 7px 16px rgba(0,0,0,.22)!important;
    }

    html[data-theme="dark"] td{
      background:var(--card)!important;
      color:var(--text)!important;
      border-color:var(--line)!important;
    }

    html[data-theme="dark"] .table-wrap tbody tr:nth-child(even) td{
      background:#101f33!important;
    }

    html[data-theme="dark"] .context-line,
    html[data-theme="dark"] .chip-filter,
    html[data-theme="dark"] .meta-chip,
    html[data-theme="dark"] .filters-toolbar,
    html[data-theme="dark"] .filter-summary,
    html[data-theme="dark"] .analises-detail-section .kv{
      background:var(--card2)!important;
      border-color:var(--line)!important;
    }

    html[data-theme="dark"] .analises-drawer{
      background:#0b1727!important;
      color:var(--text)!important;
    }

    html[data-theme="dark"] .analises-drawer-backdrop{
      background:rgba(0,0,0,.68)!important;
    }

    html[data-theme="dark"] .analises-detail-analysis{
      color:var(--text)!important;
    }

    html[data-theme="dark"] .loading-card,
    html[data-theme="dark"] .toast{
      background:var(--card)!important;
      color:var(--text)!important;
      border-color:var(--line)!important;
    }

    html[data-theme="dark"] ::placeholder{
      color:#7890aa!important;
      opacity:1;
    }
  `;
  document.head.appendChild(style);
}

function updateThemeButton(){
  const button = document.getElementById("themeBtn");
  if(!button) return;

  const dark = document.documentElement.dataset.theme === "dark";
  button.title = dark ? "Usar tema claro" : "Usar tema escuro";
  button.setAttribute("aria-label", button.title);
  button.innerHTML = dark
    ? '<i class="fa-solid fa-sun"></i>'
    : '<i class="fa-solid fa-moon"></i>';
}

function normalizeStoredTheme(){
  try{
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if(saved === "dark") document.documentElement.dataset.theme = "dark";
    else if(document.documentElement.dataset.theme !== "dark") delete document.documentElement.dataset.theme;
  }catch(error){
    console.warn("Não foi possível restaurar o tema de Análises:", error);
  }
}

function init(){
  ensureDarkModeStyles();
  normalizeStoredTheme();
  updateThemeButton();

  const observer = new MutationObserver(mutations => {
    if(mutations.some(item => item.type === "attributes" && item.attributeName === "data-theme")){
      updateThemeButton();
    }
  });

  observer.observe(document.documentElement, {
    attributes:true,
    attributeFilter:["data-theme"]
  });

  document.addEventListener("click", event => {
    if(event.target?.closest?.("#themeBtn")) window.setTimeout(updateThemeButton, 0);
  }, true);
}

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true });
else init();
