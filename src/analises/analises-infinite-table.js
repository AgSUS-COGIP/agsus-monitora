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
  observer: null
};

const $ = id => document.getElementById(id);
const numberFromPtBr = value => Number(String(value || "0").replace(/\./g, "")) || 0;

function installStylesheet(){
  if(document.querySelector('link[data-analises-infinite-table]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/src/analises/analises-infinite-table.css";
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

function ensureUi(){
  const card = document.querySelector(".table-card");
  if(!card) return false;

  let status = $("analisesInfiniteStatus");
  if(!status){
    status = document.createElement("div");
    status.id = "analisesInfiniteStatus";
    status.className = "analises-infinite-status";
    card.querySelector(".pagination")?.insertAdjacentElement("beforebegin", status);
  }

  let sentinel = $("analisesInfiniteSentinel");
  if(!sentinel){
    sentinel = document.createElement("div");
    sentinel.id = "analisesInfiniteSentinel";
    sentinel.className = "analises-infinite-sentinel";
    status.insertAdjacentElement("afterend", sentinel);
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
    setStatus(`${shown.toLocaleString("pt-BR")} registros exibidos. Continue rolando para carregar mais.`);
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
  const option = [...select.options].find(item => Number(item.value || item.textContent) === state.rowsPerBatch);
  if(!option) return;
  if(Number(select.value) === state.rowsPerBatch) return;
  select.value = String(state.rowsPerBatch);
  select.dispatchEvent(new Event("change", { bubbles:true }));
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
    state.resetting = false;
  }, 40);
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

function startObserver(){
  const sentinel = $("analisesInfiniteSentinel");
  if(!sentinel || state.observer) return;
  state.observer = new IntersectionObserver(entries => {
    if(entries.some(entry => entry.isIntersecting)) loadNextPage();
  }, { root:null, rootMargin:"700px 0px", threshold:0 });
  state.observer.observe(sentinel);
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
}

function initStep(attempt = 0){
  if(ensureUi() && typeof window.goPage === "function" && $("tableBody")?.children.length){
    resetFromRenderedPage();
    startObserver();
    return;
  }
  if(attempt < 100) window.setTimeout(() => initStep(attempt + 1), 100);
}

function init(){
  if(state.initialized) return;
  state.initialized = true;
  installStylesheet();
  bindResetEvents();
  initStep();
}

window.analisesInfiniteTable = { snapshot, restore, scheduleReset };
init();
