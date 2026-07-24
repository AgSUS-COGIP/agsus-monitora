import {
  isValidAnalisesRowsFragment,
  numberFromPtBr
} from "./analises-infinite-table-utils.js";

const BATCH_SIZE = 50;
const MAX_ACTIVATION_ATTEMPTS = 240;

const state = {
  initialized: false,
  ready: false,
  loading: false,
  resetting: false,
  loadedPages: 0,
  totalPages: 1,
  totalRecords: 0,
  pageFragments: [],
  resetTimer: 0,
  activationTimer: 0,
  activationAttempts: 0,
  scrollBound: false,
  eventsBound: false
};

const $ = id => document.getElementById(id);

function installStylesheet(){
  if(!document.querySelector('link[href*="analises-infinite-table.css"]')){
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/src/analises/analises-infinite-table.css?v=20260724-5";
    link.dataset.analisesInfiniteTable = "true";
    document.head.appendChild(link);
  }

  if(document.getElementById("analisesInfiniteV2Styles")) return;
  const style = document.createElement("style");
  style.id = "analisesInfiniteV2Styles";
  style.textContent = `
    #analisesInfiniteStatus,#analisesLoadMore{display:none!important}
    .analises-load-more-v2{
      display:flex;
      align-items:center;
      justify-content:center;
      width:100%;
      min-height:42px;
      padding:8px 14px;
      border:0;
      border-top:1px solid var(--line);
      background:color-mix(in srgb,var(--blue2) 7%,var(--card));
      color:var(--blue2);
      font:inherit;
      font-size:12px;
      font-weight:900;
      cursor:pointer
    }
    .analises-load-more-v2:hover{background:color-mix(in srgb,var(--blue2) 12%,var(--card))}
    .analises-load-more-v2:disabled{opacity:.58;cursor:wait}
    .analises-load-more-v2[hidden]{display:none!important}
  `;
  document.head.appendChild(style);
}

function parsePageInfo(){
  const text = $("pageInfo")?.textContent || "";
  const match = text.match(/Página\s+([\d.]+)\s+de\s+([\d.]+)/i);
  return match ? {
    current: numberFromPtBr(match[1]),
    total: Math.max(1, numberFromPtBr(match[2]))
  } : null;
}

function parseTotalRecords(){
  const tableInfo = $("tableInfo")?.textContent || "";
  const pageInfo = $("pageInfo")?.textContent || "";
  const candidates = [];

  [
    /Mostrando\s+[\d.]+(?:-[\d.]+)?\s+de\s+([\d.]+)\s+registros/i,
    /Exibindo\s+[\d.]+\s+de\s+([\d.]+)\s+registros/i,
    /\bde\s+([\d.]+)\s+registros/i
  ].forEach(pattern => {
    const match = tableInfo.match(pattern);
    if(match) candidates.push(numberFromPtBr(match[1]));
  });

  const recorte = pageInfo.match(/Recorte atual:\s*([\d.]+)/i);
  if(recorte) candidates.push(numberFromPtBr(recorte[1]));

  const continuo = pageInfo.match(/Carregamento contínuo\s*·\s*[\d.]+\s+de\s+([\d.]+)/i);
  if(continuo) candidates.push(numberFromPtBr(continuo[1]));

  return Math.max(visibleRowCount(), ...candidates, 0);
}

function visibleRows(){
  return [...($("tableBody")?.querySelectorAll(":scope > tr:not(.detail-row)") || [])]
    .filter(row => !row.querySelector("td.empty") && !/Nenhum registro encontrado/i.test(row.textContent || ""));
}

function visibleRowCount(){
  return visibleRows().length;
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
  const wrap = card?.querySelector(".table-wrap");
  if(!card || !wrap) return false;

  hideLegacyControls();

  let status = $("analisesInfiniteStatusV2");
  if(!status){
    status = document.createElement("div");
    status.id = "analisesInfiniteStatusV2";
    status.className = "analises-infinite-status";
    status.dataset.infiniteManaged = "v2";
    wrap.insertAdjacentElement("afterend", status);
  }

  let loadMore = $("analisesLoadMoreV2");
  if(!loadMore){
    loadMore = document.createElement("button");
    loadMore.type = "button";
    loadMore.id = "analisesLoadMoreV2";
    loadMore.className = "analises-load-more-v2";
    loadMore.innerHTML = '<i class="fa-solid fa-plus"></i> Carregar mais registros';
    loadMore.hidden = true;
    status.insertAdjacentElement("afterend", loadMore);
    loadMore.addEventListener("click", () => loadNextPage());
  }

  return true;
}

function setStatus(message, { loading = false, canLoadMore = false } = {}){
  const status = $("analisesInfiniteStatusV2");
  if(status){
    status.textContent = message;
    status.classList.toggle("is-loading", loading);
  }

  const loadMore = $("analisesLoadMoreV2");
  if(loadMore){
    loadMore.hidden = !canLoadMore;
    loadMore.disabled = loading;
    loadMore.innerHTML = loading
      ? '<i class="fa-solid fa-spinner fa-spin"></i> Carregando registros...'
      : '<i class="fa-solid fa-plus"></i> Carregar mais registros';
  }
}

function hasMorePages(){
  return state.ready
    && state.totalRecords > visibleRowCount()
    && state.loadedPages < state.totalPages;
}

function updateSummary(){
  const shown = visibleRowCount();

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

  if(state.loading){
    setStatus(`Carregando mais registros (${state.loadedPages + 1}/${state.totalPages})...`, { loading:true });
  }else if(!state.totalRecords){
    setStatus("Nenhum registro encontrado.");
  }else if(!hasMorePages()){
    setStatus(`Todos os ${state.totalRecords.toLocaleString("pt-BR")} registros do recorte foram exibidos.`);
  }else{
    setStatus(`${shown.toLocaleString("pt-BR")} registros exibidos. Role a tabela ou use o botão abaixo para carregar mais.`, { canLoadMore:true });
  }
}

function combineFragments({ preserveScroll = true } = {}){
  const body = $("tableBody");
  const wrap = document.querySelector(".table-wrap");
  if(!body) return;

  const previousScrollTop = preserveScroll ? (wrap?.scrollTop || 0) : 0;
  body.innerHTML = state.pageFragments.join("");
  if(wrap) wrap.scrollTop = previousScrollTop;
  updateSummary();
}

function ensureBatchSize(){
  const select = $("rowsPerPage");
  if(!select) return false;

  let option = [...select.options].find(item => Number(item.value || item.textContent) === BATCH_SIZE);
  if(!option){
    option = document.createElement("option");
    option.value = String(BATCH_SIZE);
    option.textContent = String(BATCH_SIZE);
    select.appendChild(option);
  }

  const synchronized = select.dataset.infiniteBatchSize === String(BATCH_SIZE);
  const valueMatches = Number(select.value) === BATCH_SIZE;
  select.value = String(BATCH_SIZE);

  if(!synchronized || !valueMatches){
    select.dataset.infiniteBatchSize = String(BATCH_SIZE);
    select.dispatchEvent(new Event("change", { bubbles:true }));
  }

  select.disabled = true;
  hideLegacyControls();
  return true;
}

function waitForRenderedPage(page, previousHtml = "", { allowSameHtml = false, attempts = 0 } = {}){
  return new Promise(resolve => {
    const check = () => {
      const body = $("tableBody");
      const html = body?.innerHTML || "";
      const info = parsePageInfo();
      const changed = allowSameHtml || (html && html !== previousHtml);
      const expectedPage = info?.current === page;

      if((changed && expectedPage && isValidAnalisesRowsFragment(html)) || attempts >= 100){
        resolve({ html, info });
        return;
      }

      attempts += 1;
      window.setTimeout(check, 20);
    };
    check();
  });
}

async function resetFromRenderedPage(){
  if(state.loading || state.resetting) return false;
  if(!ensureUi() || typeof window.goPage !== "function") return false;

  const body = $("tableBody");
  if(!body || !visibleRowCount()) return false;

  state.resetting = true;
  state.ready = false;

  try{
    const totalBefore = parseTotalRecords();
    ensureBatchSize();
    window.goPage(1);

    const result = await waitForRenderedPage(1, "", { allowSameHtml:true });
    const totalRecords = Math.max(totalBefore, parseTotalRecords(), visibleRowCount());
    if(!isValidAnalisesRowsFragment(result.html) || !totalRecords) return false;

    state.loadedPages = 1;
    state.totalPages = Math.max(1, result.info?.total || Math.ceil(totalRecords / BATCH_SIZE));
    state.totalRecords = totalRecords;
    state.pageFragments = [result.html];
    state.ready = true;
    state.activationAttempts = 0;

    combineFragments({ preserveScroll:false });
    const wrap = document.querySelector(".table-wrap");
    if(wrap) wrap.scrollTop = 0;
    return true;
  }finally{
    state.resetting = false;
  }
}

async function loadNextPage(){
  if(state.loading || state.resetting || !hasMorePages()) return;
  if(typeof window.goPage !== "function"){
    setStatus("A navegação da fila ainda não está disponível. Atualize a página e tente novamente.", { canLoadMore:true });
    return;
  }

  state.loading = true;
  updateSummary();

  const nextPage = state.loadedPages + 1;
  const body = $("tableBody");
  const combinedHtml = body?.innerHTML || "";

  try{
    window.goPage(nextPage);
    const result = await waitForRenderedPage(nextPage, combinedHtml);
    if(!isValidAnalisesRowsFragment(result.html)){
      throw new Error(`A página ${nextPage} não produziu registros válidos.`);
    }

    state.pageFragments.push(result.html);
    state.loadedPages = nextPage;
    if(result.info?.total) state.totalPages = Math.max(state.totalPages, result.info.total);
    combineFragments({ preserveScroll:true });
  }catch(error){
    console.error("Falha ao carregar o próximo lote da fila de análises:", error);
    if(body) body.innerHTML = combinedHtml;
    setStatus("Não foi possível carregar o próximo lote. Use o botão para tentar novamente.", { canLoadMore:true });
  }finally{
    state.loading = false;
    updateSummary();
  }
}

function scheduleActivation(delay = 120){
  window.clearTimeout(state.activationTimer);
  state.activationTimer = window.setTimeout(async () => {
    if(await resetFromRenderedPage()) return;

    state.activationAttempts += 1;
    const loadingVisible = $("loading")?.classList.contains("show") === true;
    if(loadingVisible || state.activationAttempts < MAX_ACTIVATION_ATTEMPTS){
      scheduleActivation(250);
    }
  }, delay);
}

function scheduleReset(delay = 260){
  window.clearTimeout(state.resetTimer);
  state.resetTimer = window.setTimeout(() => {
    state.ready = false;
    state.pageFragments = [];
    state.loadedPages = 0;
    scheduleActivation(0);
  }, delay);
}

function bindResetEvents(){
  if(state.eventsBound) return;
  state.eventsBound = true;

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

  document.addEventListener("agsus:analises-loading-start", () => {
    state.ready = false;
  });
  document.addEventListener("agsus:analises-loading-end", () => scheduleReset(80));
  document.addEventListener("agsus:analises-query-complete", () => scheduleReset(80));
  document.addEventListener("agsus:analises-cache-cleared", () => scheduleReset(180));
  window.addEventListener("load", () => scheduleActivation(0), { once:true });
}

function bindInternalScroll(){
  if(state.scrollBound) return;
  const wrap = document.querySelector(".table-wrap");
  if(!wrap) return;

  state.scrollBound = true;
  wrap.addEventListener("scroll", () => {
    if(state.loading || state.resetting || !hasMorePages()) return;
    const remaining = wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight;
    if(remaining <= 320) loadNextPage();
  }, { passive:true });
}

function snapshot(){
  const wrap = document.querySelector(".table-wrap");
  return {
    html: $("tableBody")?.innerHTML || "",
    tableInfo: $("tableInfo")?.textContent || "",
    pageInfo: $("pageInfo")?.textContent || "",
    scrollTop: wrap?.scrollTop || 0
  };
}

function restore(saved){
  if(!saved) return;
  if($("tableBody")) $("tableBody").innerHTML = saved.html || "";
  if($("tableInfo")) $("tableInfo").textContent = saved.tableInfo || "";
  if($("pageInfo")) $("pageInfo").textContent = saved.pageInfo || "";
  const wrap = document.querySelector(".table-wrap");
  if(wrap) wrap.scrollTop = Number(saved.scrollTop) || 0;
  hideLegacyControls();
  updateSummary();
}

function init(){
  if(state.initialized) return;
  state.initialized = true;
  installStylesheet();
  ensureUi();
  hideLegacyControls();
  bindInternalScroll();
  bindResetEvents();
  scheduleActivation(0);
}

window.analisesInfiniteTable = { snapshot, restore, scheduleReset, loadNextPage };

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true });
else init();
