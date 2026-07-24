const state = {
  initialized: false,
  ready: false,
  loading: false,
  resetting: false,
  loadedPages: 0,
  totalPages: 1,
  totalRecords: 0,
  rowsPerBatch: 50,
  pageFragments: [],
  resetTimer: 0,
  activationTimer: 0,
  activationAttempts: 0,
  scrollBound: false,
  eventsBound: false
};

const $ = id => document.getElementById(id);
const numberFromPtBr = value => Number(String(value || "0").replace(/\./g, "")) || 0;

function installStylesheet(){
  if(!document.querySelector('link[href*="analises-infinite-table.css"]')){
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/src/analises/analises-infinite-table.css?v=20260724-4";
    link.dataset.analisesInfiniteTable = "true";
    document.head.appendChild(link);
  }

  if(document.getElementById("analisesInfiniteRuntimeStyles")) return;
  const style = document.createElement("style");
  style.id = "analisesInfiniteRuntimeStyles";
  style.textContent = `
    .analises-load-more{
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
    .analises-load-more:hover{background:color-mix(in srgb,var(--blue2) 12%,var(--card))}
    .analises-load-more:disabled{opacity:.58;cursor:wait}
    .analises-load-more[hidden]{display:none!important}
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
  const text = $("tableInfo")?.textContent || "";
  const patterns = [
    /Mostrando\s+[\d.]+(?:-[\d.]+)?\s+de\s+([\d.]+)\s+registros/i,
    /Exibindo\s+[\d.]+\s+de\s+([\d.]+)\s+registros/i,
    /\bde\s+([\d.]+)\s+registros/i
  ];
  for(const pattern of patterns){
    const match = text.match(pattern);
    if(match) return numberFromPtBr(match[1]);
  }
  return visibleRowCount();
}

function visibleRows(){
  return [...($("tableBody")?.querySelectorAll(":scope > tr:not(.detail-row)") || [])]
    .filter(row => !row.querySelector("td.empty") && !/Nenhum registro encontrado/i.test(row.textContent || ""));
}

function visibleRowCount(){
  return visibleRows().length;
}

function validFragment(html){
  if(!html || /Nenhum registro encontrado/i.test(html)) return false;
  const template = document.createElement("template");
  template.innerHTML = html;
  return [...template.content.querySelectorAll(":scope > tr:not(.detail-row)")]
    .some(row => !row.querySelector("td.empty"));
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

  let status = $("analisesInfiniteStatus");
  if(!status){
    status = document.createElement("div");
    status.id = "analisesInfiniteStatus";
    status.className = "analises-infinite-status";
    wrap.insertAdjacentElement("afterend", status);
  }
  status.dataset.infiniteManaged = "true";

  let loadMore = $("analisesLoadMore");
  if(!loadMore){
    loadMore = document.createElement("button");
    loadMore.type = "button";
    loadMore.id = "analisesLoadMore";
    loadMore.className = "analises-load-more";
    loadMore.innerHTML = '<i class="fa-solid fa-plus"></i> Carregar mais registros';
    loadMore.hidden = true;
    status.insertAdjacentElement("afterend", loadMore);
    loadMore.addEventListener("click", () => loadNextPage());
  }

  return true;
}

function setStatus(message, { loading = false, canLoadMore = false } = {}){
  const status = $("analisesInfiniteStatus");
  if(status){
    status.textContent = message;
    status.classList.toggle("is-loading", loading);
  }

  const loadMore = $("analisesLoadMore");
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

function waitForRenderedPage(page, previousHtml, attempts = 0){
  return new Promise(resolve => {
    const check = () => {
      const body = $("tableBody");
      const html = body?.innerHTML || "";
      const info = parsePageInfo();
      const changed = html && html !== previousHtml;
      const expectedPage = info?.current === page;

      if((changed && expectedPage && validFragment(html)) || attempts >= 80){
        resolve({ html, info });
        return;
      }

      attempts += 1;
      window.setTimeout(check, 20);
    };
    check();
  });
}

async function loadNextPage(){
  if(state.loading || state.resetting || !hasMorePages()) return;
  if(typeof window.goPage !== "function"){
    setStatus("A navegação da fila ainda não está disponível. Atualize a página e tente novamente.");
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
    if(!validFragment(result.html)){
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

async function resetFromRenderedPage(){
  if(state.loading || state.resetting) return false;
  if(!ensureUi()) return false;
  if(typeof window.goPage !== "function") return false;

  const body = $("tableBody");
  if(!body || !visibleRowCount()) return false;

  state.resetting = true;
  state.ready = false;

  try{
    configureBatchSize();
    window.goPage(1);
    await new Promise(resolve => window.setTimeout(resolve, 30));

    const page = parsePageInfo();
    const html = $("tableBody")?.innerHTML || "";
    const totalRecords = parseTotalRecords();
    if(!validFragment(html) || !totalRecords) return false;

    state.loadedPages = 1;
    state.totalPages = Math.max(1, page?.total || Math.ceil(totalRecords / state.rowsPerBatch));
    state.totalRecords = totalRecords;
    state.pageFragments = [html];
    state.ready = true;
    state.activationAttempts = 0;

    combineFragments({ preserveScroll:false });
    const wrap = document.querySelector(".table-wrap");
    if(wrap) wrap.scrollTop = 0;
    hideLegacyControls();
    return true;
  }finally{
    state.resetting = false;
  }
}

function scheduleActivation(delay = 120){
  window.clearTimeout(state.activationTimer);
  state.activationTimer = window.setTimeout(async () => {
    if(await resetFromRenderedPage()) return;

    state.activationAttempts += 1;
    const loadingVisible = $("loading")?.classList.contains("show") === true;
    if(loadingVisible || state.activationAttempts < 240){
      scheduleActivation(250);
    }
  }, delay);
}

function scheduleReset(delay = 260){
  window.clearTimeout(state.resetTimer);
  state.resetTimer = window.setTimeout(() => {
    state.ready = false;
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
