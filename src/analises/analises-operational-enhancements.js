const state = {
  initialized: false,
  originalToggleDetails: null,
  scheduled: 0,
  bootAttempts: 0
};

const txt = value => String(value ?? "").trim();

function ensureStyles(){
  if(document.getElementById("analisesOperationalEnhancementsStyles")) return;
  const style = document.createElement("style");
  style.id = "analisesOperationalEnhancementsStyles";
  style.textContent = `
    #fPdf,
    label[for="fPdf"],
    .field:has(> label[for="fPdf"]),
    .pdf-strip{display:none!important}
    #attentionList .attention-item{transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}
    #attentionList .attention-item[data-action]{cursor:pointer}
    #attentionList .attention-item[data-action]:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(2,8,23,.10);border-color:color-mix(in srgb,var(--blue) 35%,transparent)}
    #attentionList .attention-item[data-action]:focus-visible{outline:3px solid color-mix(in srgb,var(--blue) 28%,transparent);outline-offset:2px}
    .analises-drawer-backdrop{position:fixed;inset:0;z-index:160;background:rgba(2,8,23,.46);display:flex;justify-content:flex-end}
    .analises-drawer-backdrop[hidden]{display:none!important}
    .analises-drawer{width:min(620px,96vw);height:100%;overflow:auto;background:var(--card);color:var(--text);box-shadow:-22px 0 55px rgba(2,8,23,.24);padding:22px;display:grid;align-content:start;gap:18px}
    .analises-drawer-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;position:sticky;top:-22px;margin:-22px -22px 0;padding:20px 22px 16px;background:var(--card);z-index:2;border-bottom:1px solid rgba(148,163,184,.22)}
    .analises-drawer-head h2{margin:4px 0 0;color:var(--strong);font-size:22px}
    .analises-drawer-close{border:0;background:transparent;color:var(--muted);font-size:22px;cursor:pointer;padding:8px;border-radius:10px}
    .analises-drawer-close:hover{background:rgba(148,163,184,.12);color:var(--strong)}
    .analises-drawer .detail-shell{display:grid;gap:18px}
    .analises-drawer .detail-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
    .analises-drawer .detail-actions .mini-chip{display:none!important}
    .analises-drawer-context{display:flex;flex-wrap:wrap;gap:8px}
    .analises-drawer-context span{padding:6px 9px;border-radius:999px;background:rgba(148,163,184,.12);color:var(--muted);font-size:12px;font-weight:800}
    @media(max-width:640px){.analises-drawer{width:100%;padding:18px}.analises-drawer-head{top:-18px;margin:-18px -18px 0;padding:18px}.analises-drawer .detail-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function renameSearches(){
  const globalSearch = document.getElementById("fBusca");
  const globalLabel = document.querySelector('label[for="fBusca"]');
  if(globalSearch) globalSearch.placeholder = "Candidato, vaga, edital, responsável ou análise";
  if(globalLabel) globalLabel.textContent = "Buscar em todo o painel";

  const tableSearch = document.getElementById("tableSearch");
  if(tableSearch){
    tableSearch.placeholder = "Buscar somente na fila operacional";
    tableSearch.setAttribute("aria-label", "Buscar somente na fila operacional");
  }
}

function hidePdfSignals(){
  document.querySelector('.field:has(> label[for="fPdf"])')?.setAttribute("hidden", "");
  document.querySelector(".pdf-strip")?.setAttribute("hidden", "");

  document.querySelectorAll("#attentionList .attention-item").forEach(item => {
    const title = txt(item.querySelector("b")?.textContent).toLowerCase();
    if(title.includes("pdf") || title.includes("espelho")) item.remove();
  });
}

function markAttentionActions(){
  document.querySelectorAll("#attentionList .attention-item").forEach(item => {
    const title = txt(item.querySelector("b")?.textContent).toLowerCase();
    let action = "";
    if(title === "pendentes") action = "pendente";
    if(title === "em revisão") action = "revisar";
    if(!action) return;
    item.dataset.action = action;
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.setAttribute("aria-label", `Filtrar por ${txt(item.querySelector("b")?.textContent)}`);
  });
}

function ensureDrawer(){
  let backdrop = document.getElementById("analisesDetailDrawer");
  if(backdrop) return backdrop;
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
  backdrop.querySelector(".analises-drawer-close")?.addEventListener("click", closeDrawer);
  backdrop.addEventListener("click", event => { if(event.target === backdrop) closeDrawer(); });
  return backdrop;
}

function closeDrawer(){
  const backdrop = document.getElementById("analisesDetailDrawer");
  if(!backdrop) return;
  backdrop.hidden = true;
  document.body.style.overflow = "";
}

function openDrawerFromRow(button, detailRow){
  const backdrop = ensureDrawer();
  const row = button.closest("tr");
  const cells = [...(row?.querySelectorAll("td") || [])].map(cell => txt(cell.textContent));
  const title = cells[5] || "Registro da análise";
  const context = [cells[0], cells[1], cells[2], cells[3], cells[4], cells[6]].filter(Boolean);
  const detail = detailRow?.querySelector(".detail-shell")?.cloneNode(true);

  backdrop.querySelector("#analisesDrawerTitle").textContent = title;
  backdrop.querySelector("#analisesDrawerContext").innerHTML = context.map(value => `<span></span>`).join("");
  [...backdrop.querySelectorAll("#analisesDrawerContext span")].forEach((element, index) => { element.textContent = context[index]; });

  const body = backdrop.querySelector("#analisesDrawerBody");
  body.replaceChildren();
  if(detail){
    detail.querySelectorAll(".mini-chip").forEach(chip => chip.remove());
    const pdfLink = detail.querySelector('a[href*="pdf"],a.btn.green');
    if(pdfLink && !txt(pdfLink.getAttribute("href"))) pdfLink.remove();
    body.appendChild(detail);
  }else{
    body.innerHTML = '<div class="empty">Não foi possível montar o detalhamento deste registro.</div>';
  }

  backdrop.hidden = false;
  document.body.style.overflow = "hidden";
  backdrop.querySelector(".analises-drawer-close")?.focus();
}

function installDrawerOverride(){
  if(typeof window.toggleDetails !== "function") return false;
  if(window.toggleDetails.__agsusDrawerOverride) return true;
  state.originalToggleDetails = window.toggleDetails;

  const replacement = encoded => {
    const selector = `button[onclick*="${CSS.escape(String(encoded))}"]`;
    const button = document.querySelector(selector);
    state.originalToggleDetails(encoded);
    window.setTimeout(() => {
      const detailRow = button?.closest("tr")?.nextElementSibling;
      openDrawerFromRow(button, detailRow);
      state.originalToggleDetails(encoded);
    }, 0);
  };
  replacement.__agsusDrawerOverride = true;
  window.toggleDetails = replacement;
  return true;
}

function enhance(){
  renameSearches();
  hidePdfSignals();
  markAttentionActions();
  installDrawerOverride();
}

function scheduleEnhance(){
  window.clearTimeout(state.scheduled);
  state.scheduled = window.setTimeout(enhance, 0);
}

function activateAttention(item){
  const action = item?.dataset?.action;
  if(!action) return;
  document.querySelector(`[data-kpi="${action}"] button`)?.click();
}

function bindEvents(){
  document.addEventListener("click", event => {
    const attention = event.target?.closest?.("#attentionList .attention-item[data-action]");
    if(attention){
      event.preventDefault();
      activateAttention(attention);
      return;
    }
    scheduleEnhance();
  });
  document.addEventListener("change", scheduleEnhance, true);
  document.addEventListener("input", scheduleEnhance, true);
  document.addEventListener("keydown", event => {
    if(event.key === "Escape") closeDrawer();
    if((event.key === "Enter" || event.key === " ") && event.target?.matches?.("#attentionList .attention-item[data-action]")){
      event.preventDefault();
      activateAttention(event.target);
    }
  });
  document.addEventListener("agsus:analises-loading-end", scheduleEnhance);
  document.addEventListener("agsus:analises-scope-guard-ready", scheduleEnhance);
}

function bootStep(){
  enhance();
  state.bootAttempts += 1;
  if(state.bootAttempts < 80 && (!document.getElementById("tableBody") || typeof window.toggleDetails !== "function")){
    window.setTimeout(bootStep, 100);
  }
}

function start(){
  if(state.initialized) return;
  state.initialized = true;
  ensureStyles();
  bindEvents();
  bootStep();
}

document.addEventListener("DOMContentLoaded", start, { once:true });
