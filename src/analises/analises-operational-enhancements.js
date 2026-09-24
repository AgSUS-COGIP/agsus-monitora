const state = {
  initialized: false,
  scheduled: 0,
  bootAttempts: 0,
  lastFocus: null,
  activeShortcut: "",
};

const txt = (value) => String(value ?? "").trim();
const norm = (value) =>
  txt(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");

function ensureStyles() {
  if (document.getElementById("analisesOperationalEnhancementsStyles")) return;

  const style = document.createElement("style");
  style.id = "analisesOperationalEnhancementsStyles";
  style.textContent = `
    #fPdf,
    label[for="fPdf"],
    .pdf-strip,
    #applyBtn{display:none!important}

    #attentionList .attention-item{
      position:relative;
      transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease,background .16s ease
    }
    #attentionList .attention-item[data-action]{cursor:pointer;padding-right:40px}
    #attentionList .attention-item[data-action]::after{
      content:"\f061";
      font-family:"Font Awesome 6 Free";
      font-weight:900;
      position:absolute;
      right:14px;
      top:50%;
      transform:translateY(-50%);
      color:var(--blue)
    }
    #attentionList .attention-item[data-action]:hover{
      transform:translateY(-1px);
      box-shadow:0 8px 20px rgba(2,8,23,.10);
      border-color:color-mix(in srgb,var(--blue) 35%,transparent)
    }
    #attentionList .attention-item[data-action]:focus-visible{
      outline:3px solid color-mix(in srgb,var(--blue) 28%,transparent);
      outline-offset:2px
    }
    #attentionList .attention-item.is-active{
      border-color:var(--blue);
      background:color-mix(in srgb,var(--blue) 7%,var(--card));
      box-shadow:0 0 0 2px color-mix(in srgb,var(--blue) 12%,transparent)
    }
    .analises-shortcut-status{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      margin:0 0 10px;
      padding:9px 11px;
      border-radius:12px;
      background:color-mix(in srgb,var(--blue) 8%,var(--card));
      border:1px solid color-mix(in srgb,var(--blue) 20%,transparent);
      color:var(--strong);
      font-size:12px;
      font-weight:800
    }
    .analises-shortcut-status button{
      border:0;
      background:transparent;
      color:var(--blue);
      font:inherit;
      cursor:pointer
    }

    #tableBody > tr:not(.detail-row){transition:background .16s ease}
    #tableBody > tr:not(.detail-row):hover{background:color-mix(in srgb,var(--blue) 3%,transparent)}
    #tableBody .detail-row{display:none!important}

    .analises-drawer-backdrop{
      position:fixed;
      inset:0;
      z-index:160;
      background:rgba(2,8,23,.46);
      display:flex;
      justify-content:flex-end
    }
    .analises-drawer-backdrop[hidden]{display:none!important}
    .analises-drawer{
      width:min(650px,96vw);
      height:100%;
      overflow:auto;
      background:var(--card);
      color:var(--text);
      box-shadow:-22px 0 55px rgba(2,8,23,.24);
      padding:22px;
      display:grid;
      align-content:start;
      gap:18px
    }
    .analises-drawer-head{
      display:flex;
      justify-content:space-between;
      gap:16px;
      align-items:flex-start;
      position:sticky;
      top:-22px;
      margin:-22px -22px 0;
      padding:20px 22px 16px;
      background:var(--card);
      z-index:2;
      border-bottom:1px solid rgba(148,163,184,.22)
    }
    .analises-drawer-head h2{margin:4px 0 0;color:var(--strong);font-size:22px}
    .analises-drawer-close{
      border:0;
      background:transparent;
      color:var(--muted);
      font-size:22px;
      cursor:pointer;
      padding:8px;
      border-radius:10px
    }
    .analises-drawer-close:hover{background:rgba(148,163,184,.12);color:var(--strong)}
    .analises-drawer .detail-shell{display:grid;gap:18px}
    .analises-drawer .detail-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
    .analises-drawer .detail-actions .mini-chip{display:none!important}
    .analises-drawer-context{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
    .analises-drawer-context div{
      padding:9px 11px;
      border-radius:12px;
      background:rgba(148,163,184,.10);
      min-width:0
    }
    .analises-drawer-context small{
      display:block;
      color:var(--muted);
      font-size:10px;
      font-weight:900;
      letter-spacing:.04em;
      text-transform:uppercase;
      margin-bottom:3px
    }
    .analises-drawer-context strong{
      display:block;
      color:var(--strong);
      font-size:12px;
      overflow-wrap:anywhere
    }
    @media(max-width:640px){
      .analises-drawer{width:100%;padding:18px}
      .analises-drawer-head{top:-18px;margin:-18px -18px 0;padding:18px}
      .analises-drawer .detail-grid,.analises-drawer-context{grid-template-columns:1fr}
    }
  `;
  document.head.appendChild(style);
}

function renameSearches() {
  const globalSearch = document.getElementById("fBusca");
  const globalLabel = document.querySelector('label[for="fBusca"]');
  if (globalSearch)
    globalSearch.placeholder =
      "Candidato, vaga, edital, responsável ou análise";
  if (globalLabel) globalLabel.textContent = "Buscar em todo o painel";

  const tableSearch = document.getElementById("tableSearch");
  if (tableSearch) {
    tableSearch.placeholder = "Buscar somente na fila operacional";
    tableSearch.setAttribute(
      "aria-label",
      "Buscar somente na fila operacional",
    );
  }
}

function removePdfSignals() {
  document.querySelector('.field:has(> label[for="fPdf"])')?.remove();
  document.querySelector(".pdf-strip")?.remove();

  document
    .querySelectorAll("#attentionList .attention-item")
    .forEach((item) => {
      const title = norm(item.querySelector("b")?.textContent);
      if (title.includes("pdf") || title.includes("espelho")) item.remove();
    });
}

function attentionAction(title) {
  const key = norm(title);
  if (key === "pendentes") return "kpi:pendente";
  if (key === "em revisao") return "kpi:revisar";
  if (key === "data fora do periodo") return "validation:FORA_PERIODO";
  if (key === "etapa sem data") return "validation:SEM_DATA";
  return "";
}

function markAttentionActions() {
  const list = document.getElementById("attentionList");
  if (!list) return;

  list.querySelectorAll(".attention-item").forEach((item) => {
    const title = txt(item.querySelector("b")?.textContent);
    const action = attentionAction(title);

    item.classList.toggle(
      "is-active",
      Boolean(action && action === state.activeShortcut),
    );
    if (!action) {
      delete item.dataset.action;
      item.removeAttribute("tabindex");
      item.removeAttribute("role");
      item.removeAttribute("aria-label");
      return;
    }

    item.dataset.action = action;
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.setAttribute("aria-label", `Filtrar por ${title}`);
  });

  renderShortcutStatus(list);
}

function shortcutLabel(action) {
  return (
    {
      "kpi:pendente": "Pendentes",
      "kpi:revisar": "Em revisão",
      "validation:FORA_PERIODO": "Análises fora do período",
      "validation:SEM_DATA": "Análises sem data",
    }[action] || ""
  );
}

function renderShortcutStatus(list) {
  document.getElementById("analisesShortcutStatus")?.remove();
  if (!state.activeShortcut) return;

  const status = document.createElement("div");
  status.id = "analisesShortcutStatus";
  status.className = "analises-shortcut-status";
  status.innerHTML = `<span><i class="fa-solid fa-filter"></i> Atalho ativo: ${shortcutLabel(state.activeShortcut)}</span><button type="button">Limpar</button>`;
  status
    .querySelector("button")
    ?.addEventListener("click", clearActiveShortcut);
  list.insertAdjacentElement("beforebegin", status);
}

function ensureDrawer() {
  let backdrop = document.getElementById("analisesDetailDrawer");
  if (backdrop) return backdrop;

  backdrop = document.createElement("div");
  backdrop.id = "analisesDetailDrawer";
  backdrop.className = "analises-drawer-backdrop";
  backdrop.hidden = true;
  backdrop.innerHTML = `
    <aside class="analises-drawer" role="dialog" aria-modal="true" aria-labelledby="analisesDrawerTitle">
      <div class="analises-drawer-head">
        <div><span class="eyebrow">Detalhamento do candidato</span><h2 id="analisesDrawerTitle">Registro da análise</h2></div>
        <button type="button" class="analises-drawer-close" aria-label="Fechar detalhamento"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="analises-drawer-context" id="analisesDrawerContext"></div>
      <div id="analisesDrawerBody"></div>
    </aside>`;

  document.body.appendChild(backdrop);
  backdrop
    .querySelector(".analises-drawer-close")
    ?.addEventListener("click", closeDrawer);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeDrawer();
  });
  return backdrop;
}

function closeDrawer() {
  const backdrop = document.getElementById("analisesDetailDrawer");
  if (!backdrop || backdrop.hidden) return;

  backdrop.hidden = true;
  document.body.style.overflow = "";
  if (state.lastFocus?.isConnected) state.lastFocus.focus();
  state.lastFocus = null;
}

function encodedDetailKey(button) {
  const inline = txt(button?.getAttribute("onclick"));
  const match = inline.match(/toggleDetails\('([^']+)'\)/);
  return match ? match[1] : "";
}

function contextItems(cells) {
  return [
    ["Grupo", cells[0]],
    ["Unidade", cells[1]],
    ["Edital", cells[2]],
    ["Código da vaga", cells[3]],
    ["Vaga", cells[4]],
    ["Status", cells[6]],
  ].filter(([, value]) => Boolean(value));
}

function openDrawerFromRenderedDetail(button, detailRow) {
  const backdrop = ensureDrawer();
  const row = button.closest("tr");
  const cells = [...(row?.querySelectorAll("td") || [])].map((cell) =>
    txt(cell.textContent),
  );
  const candidate = cells[5] || "Registro da análise";
  const detail = detailRow?.querySelector(".detail-shell")?.cloneNode(true);

  backdrop.querySelector("#analisesDrawerTitle").textContent = candidate;
  backdrop.querySelector("#analisesDrawerContext").innerHTML = contextItems(
    cells,
  )
    .map(
      ([label, value]) =>
        `<div><small>${label}</small><strong>${value}</strong></div>`,
    )
    .join("");

  const body = backdrop.querySelector("#analisesDrawerBody");
  body.replaceChildren();

  if (detail) {
    detail.querySelectorAll(".mini-chip").forEach((chip) => chip.remove());
    detail.querySelectorAll("a").forEach((link) => {
      const href = txt(link.getAttribute("href"));
      if (!href || !/^https?:\/\//i.test(href)) link.remove();
    });
    body.appendChild(detail);
  } else {
    body.innerHTML =
      '<div class="empty">Não foi possível montar o detalhamento deste registro.</div>';
  }

  state.lastFocus = button;
  backdrop.hidden = false;
  document.body.style.overflow = "hidden";
  backdrop.querySelector(".analises-drawer-close")?.focus();
}

function openDrawerFromButton(button) {
  const encoded = encodedDetailKey(button);
  if (!encoded || typeof window.toggleDetails !== "function") return;

  window.toggleDetails(encoded);
  window.setTimeout(() => {
    const detailRow = button.closest("tr")?.nextElementSibling;
    openDrawerFromRenderedDetail(button, detailRow);
    window.toggleDetails(encoded);
  }, 0);
}

function clickMultiFilter(id, value) {
  const input = document.querySelector(
    `#ms-options-${CSS.escape(id)} input[value="${CSS.escape(value)}"]`,
  );
  if (!input) return false;

  const isSame =
    input.checked && state.activeShortcut === `validation:${value}`;
  if (isSame) {
    document.getElementById(`ms-clear-${id}`)?.click();
    return true;
  }

  document.getElementById(`ms-clear-${id}`)?.click();
  window.setTimeout(() => {
    const refreshed = document.querySelector(
      `#ms-options-${CSS.escape(id)} input[value="${CSS.escape(value)}"]`,
    );
    if (refreshed && !refreshed.checked) refreshed.click();
  }, 0);
  return true;
}

function activateAttention(item) {
  const action = item?.dataset?.action;
  if (!action) return;

  if (action.startsWith("kpi:")) {
    const key = action.split(":")[1];
    document.querySelector(`[data-kpi="${CSS.escape(key)}"] button`)?.click();
    state.activeShortcut = state.activeShortcut === action ? "" : action;
  } else if (action.startsWith("validation:")) {
    const value = action.split(":")[1];
    if (clickMultiFilter("fValidacao", value)) {
      state.activeShortcut = state.activeShortcut === action ? "" : action;
    }
  }

  scheduleEnhance();
}

function clearActiveShortcut() {
  const action = state.activeShortcut;
  state.activeShortcut = "";

  if (action.startsWith("kpi:")) {
    const key = action.split(":")[1];
    document
      .querySelector(`[data-kpi="${CSS.escape(key)}"].is-active button`)
      ?.click();
  } else if (action.startsWith("validation:")) {
    document.getElementById("ms-clear-fValidacao")?.click();
  }

  scheduleEnhance();
}

function enhance() {
  renameSearches();
  removePdfSignals();
  markAttentionActions();
  ensureDrawer();
}

function scheduleEnhance() {
  window.clearTimeout(state.scheduled);
  state.scheduled = window.setTimeout(enhance, 0);
}

function bindEvents() {
  document.addEventListener(
    "click",
    (event) => {
      const detailButton = event.target?.closest?.(
        '#tableBody button[onclick*="toggleDetails"]',
      );
      if (detailButton) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openDrawerFromButton(detailButton);
        return;
      }

      const attention = event.target?.closest?.(
        "#attentionList .attention-item[data-action]",
      );
      if (attention) {
        event.preventDefault();
        activateAttention(attention);
        return;
      }

      scheduleEnhance();
    },
    true,
  );

  document.addEventListener("change", scheduleEnhance, true);
  document.addEventListener("input", scheduleEnhance, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDrawer();
    if (
      (event.key === "Enter" || event.key === " ") &&
      event.target?.matches?.("#attentionList .attention-item[data-action]")
    ) {
      event.preventDefault();
      activateAttention(event.target);
    }
  });
  document.addEventListener("agsus:analises-cache-cleared", scheduleEnhance);
}

function bootStep() {
  enhance();
  state.bootAttempts += 1;
  if (
    state.bootAttempts < 80 &&
    (!document.getElementById("tableBody") ||
      typeof window.toggleDetails !== "function")
  ) {
    window.setTimeout(bootStep, 100);
  }
}

function start() {
  if (state.initialized) return;
  state.initialized = true;
  ensureStyles();
  bindEvents();
  bootStep();
}

document.addEventListener("DOMContentLoaded", start, { once: true });
