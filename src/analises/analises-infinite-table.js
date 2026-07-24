const state = {
  initialized: false,
  loading: false,
  resetting: false,
  loadedPages: 0,
  totalPages: 1,
  totalRecords: 0,
  rowsPerBatch: 50,
  pageFragments: [],
  resetTimer: 0,
  scrollBound: false
};

const $ = id => document.getElementById(id);
const numberFromPtBr = value => Number(String(value || "0").replace(/\./g, "")) || 0;

function installStylesheet(){
  if(document.querySelector('link[href*="analises-infinite-table.css"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/src/analises/analises-infinite-table.css?v=20260723-3";
  link.dataset.analisesInfiniteTable = "true";
  document.head.appendChild(link);
}

function parsePageInfo(){
  const text = $("pageInfo")?.textContent || "";
  const match = text.match(/Página\s+([\d.]+)\s+de\s+([\d.]+)/i);
  return match ? {
    current: numberFromPtBr(match[1]),
    total: Math.max(1, numberFromPtBr(match[2]))
  } : { current: 1, total: 1 };
}

function parseTotalRecords(){
  const text = $("tableInfo")?.textContent || "";
  const match = text.match(/de\s+([\d.]+)\s+registros/i);
  return match ? numberFromPtBr(match[1]) : $("tableBody")?.querySelectorAll(":scope > tr:not(.detail-row)").length || 0;
}

function rowCount(){
  return $("tableBody")?.querySelectorAll(":scope > tr:not(.detail-row)").length || 0;
}

function hideLegacyControls(){
  const rowsControl = document.querySelector(".table-tools .rows-control");
  const pagination = document.querySelector(".table-card .pagination");
  [rowsControl, pagination].forEach(element => {
    if(!element) return;
    element.hidden = true;
    element.setAttribute("aria-hidden", "true");
    element.style.display = "none";
  });
}

function ensureUi(){
  const card = document.querySelector(".table-card");
  if(!card) return false;

  hideLegacyControls();

  let status = $("analisesInfiniteStatus");
  if(!status){
    status = document.createElement("div");
    status.id = "analisesInfiniteStatus";
    status.className = "analises-infinite-status";
    card.querySelector(".table-wrap")?.insertAdjacentElement("afterend", status);
  }
  return true;
}

function setStatus(message, loading = false){
  const status = $("analisesInfiniteStatus");
  if(!status) return;
  status.textContent = message;
  status.classList.toggle("is-loading", loading);
}

function updateSummary(){
  const shown = rowCount();
  if($("tableInfo")){
    $("tableInfo").textContent = state.totalRecords
      ? `Exibindo ${shown.toLocaleString("pt-BR")} de ${state.totalRecords.toLocaleString("pt-BR")} registros`
      : "Nenhum registro encontrado";
  }
  if($("pageInfo")){
    $("pageInfo").textContent = state.totalRecords
      ? `Carregamento contínuo · ${shown.toLocaleString("pt-BR")} de ${state.totalRecords.toLocaleString("pt-BR")}`
      : "Carregamento contínuo";
  }

  if(!state.totalRecords){
    setStatus("Nenhum registro encontrado.");
  }else if(state.loadedPages >= state.totalPages){
    setStatus(`Todos os ${state.totalRecords.toLocaleString("pt-BR")} registros do recorte foram exibidos.`);
  }else{
    setStatus(`${shown.toLocaleString("pt-BR")} registros exibidos. Role a tabela para carregar mais.`);
  }
}

function combineFragments(){
  const body = $("tableBody");
  if(!body) return;
  body.innerHTML = state.pageFragments.join("");
  updateSummary();
}

function waitForPage(page, attempts = 0){
  return new Promise(resolve => {
    const check = () => {
      const info = parsePageInfo();
      const body = $("tableBody");
      if((info.current === page && body?.children.length) || attempts >= 30){
        resolve(body?.innerHTML || "");
        return;
      }
      attempts += 1;
      window.setTimeout(check, 20);
    };
    check();
  });
}

async function loadNextPage(){
  if(state.loading || state.resetting || state.loadedPages >= state.totalPages) return;
  if(typeof window.goPage !== "function") return;

  state.loading = true;
  const nextPage = state.loadedPages + 1;
  setStatus(`Carregando mais registros (${nextPage}/${state.totalPages})...`, true);

  window.goPage(nextPage);
  const fragment = await waitForPage(nextPage);

  if(fragment && !/Nenhum registro encontrado/i.test(fragment)){
    state.pageFragments.push(fragment);
    state.loadedPages = nextPage;
  }

  combineFragments();
  state.loading = false;
}

function configureBatchSize(){
  const select = $("rowsPerPage");
  if(!select) return;

  let option = [...select.options].find(item => Number(item.value || item.textContent) === state.rowsPerBatch);
  if(!option){
    option = document.createElement("option");
    option.value = String(state.rowsPerBatch);
    option.textContent = String(state.rowsPerBatch);
    select.appendChild(option);
  }

  if(Number(select.value) !== state.rowsPerBatch){
    select.value = String(state.rowsPerBatch);
    select.dispatchEvent(new Event("change", { bubbles:true }));
  }

  select.disabled = true;
  hideLegacyControls();
}

function resetFromRenderedPage(){
  if(state.loading) return;
  const body = $("tableBody");
  if(!body || !body.children.length || typeof window.goPage !== "function") return;

  state.resetting = true;
  configureBatchSize();
  window.goPage(1);

  window.setTimeout(() => {
    const page = parsePageInfo();
    state.loadedPages = 1;
    state.totalPages = Math.max(1, page.total);
    state.totalRecords = parseTotalRecords();
    state.pageFragments = [$("tableBody")?.innerHTML || ""];
    combineFragments();
    const wrap = document.querySelector(".table-wrap");
    if(wrap) wrap.scrollTop = 0;
    hideLegacyControls();
    state.resetting = false;
  }, 60);
}

function scheduleReset(delay = 260){
  window.clearTimeout(state.resetTimer);
  state.resetTimer = window.setTimeout(resetFromRenderedPage, delay);
}

function bindResetEvents(){
  document.addEventListener("change", event => {
    if(event.target?.closest?.("#rowsPerPage")) return;
    if(event.target?.closest?.(".filter-panel")) scheduleReset(260);
  }, true);

  document.addEventListener("input", event => {
    if(event.target?.matches?.("#fBusca,#tableSearch")) scheduleReset(360);
  }, true);

  document.addEventListener("click", event => {
    if(event.target?.closest?.('#tableBody button[onclick*="toggleDetails"]')) return;
    if(event.target?.closest?.("#clearBtn,[data-kpi],#attentionList .attention-item,#chartResponsavel")) scheduleReset(260);
  }, true);

  document.addEventListener("agsus:analises-loading-end", () => scheduleReset(80));
  document.addEventListener("agsus:analises-cache-cleared", () => scheduleReset(180));
}

function bindInternalScroll(){
  if(state.scrollBound) return;
  const wrap = document.querySelector(".table-wrap");
  if(!wrap) return;

  state.scrollBound = true;
  wrap.addEventListener("scroll", () => {
    if(state.loading || state.resetting || state.loadedPages >= state.totalPages) return;
    const remaining = wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight;
    if(remaining <= 420) loadNextPage();
  }, { passive:true });
}

function snapshot(){
  return {
    html: $("tableBody")?.innerHTML || "",
    tableInfo: $("tableInfo")?.textContent || "",
    pageInfo: $("pageInfo")?.textContent || ""
  };
}

function restore(saved){
  if(!saved) return;
  if($("tableBody")) $("tableBody").innerHTML = saved.html || "";
  if($("tableInfo")) $("tableInfo").textContent = saved.tableInfo || "";
  if($("pageInfo")) $("pageInfo").textContent = saved.pageInfo || "";
  hideLegacyControls();
}

function initStep(attempt = 0){
  if(ensureUi() && typeof window.goPage === "function" && $("tableBody")?.children.length){
    configureBatchSize();
    resetFromRenderedPage();
    bindInternalScroll();
    return;
  }
  if(attempt < 100) window.setTimeout(() => initStep(attempt + 1), 100);
}

function init(){
  if(state.initialized) return;
  state.initialized = true;
  installStylesheet();
  hideLegacyControls();
  bindResetEvents();
  initStep();
}

window.analisesInfiniteTable = { snapshot, restore, scheduleReset };
init();
