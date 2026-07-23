const state = {
  initialized: false,
  loadingTimer: 0,
  loadingAttempts: 0,
  drawerTimer: 0
};

const txt = value => String(value ?? "").trim();
const norm = value => txt(value)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/\s+/g, " ");

function installStyles(){
  if(document.getElementById("analisesInterfaceRefinementStyles")) return;

  const style = document.createElement("style");
  style.id = "analisesInterfaceRefinementStyles";
  style.textContent = `
    /* PDF não é pendência operacional: oculta desde o primeiro frame. */
    #attentionList .attention-item.low{display:none!important}

    .analises-drawer{
      width:min(760px,96vw)!important;
      padding:0!important;
      gap:0!important;
      background:var(--bg)!important
    }
    .analises-drawer-head{
      top:0!important;
      margin:0!important;
      padding:20px 24px 18px!important;
      background:var(--card)!important;
      box-shadow:0 6px 18px rgba(15,23,42,.06)
    }
    .analises-drawer-head .eyebrow{color:var(--blue)}
    .analises-drawer-head h2{
      font-size:20px!important;
      line-height:1.25;
      max-width:620px;
      overflow-wrap:anywhere
    }
    .analises-drawer-context{
      grid-template-columns:repeat(3,minmax(0,1fr))!important;
      padding:18px 24px 8px;
      gap:10px!important
    }
    .analises-drawer-context div{
      background:var(--card)!important;
      border:1px solid rgba(148,163,184,.22);
      padding:10px 12px!important;
      min-height:61px
    }
    .analises-drawer-context div:nth-child(5){grid-column:span 2}
    #analisesDrawerBody{padding:10px 24px 28px}
    .analises-drawer .detail-shell{gap:14px!important}
    .analises-detail-section{
      background:var(--card);
      border:1px solid rgba(148,163,184,.22);
      border-radius:16px;
      overflow:hidden
    }
    .analises-detail-section-head{
      display:flex;
      align-items:center;
      gap:9px;
      padding:13px 15px;
      border-bottom:1px solid rgba(148,163,184,.18);
      color:var(--strong);
      font-size:13px;
      font-weight:900
    }
    .analises-detail-section-head i{color:var(--blue)}
    .analises-detail-section-grid{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:10px;
      padding:12px
    }
    .analises-detail-section .kv{
      border:0!important;
      background:color-mix(in srgb,var(--blue) 3%,var(--card))!important;
      border-radius:12px!important;
      padding:11px 12px!important;
      min-height:70px
    }
    .analises-detail-section .kv-label{
      font-size:10px!important;
      letter-spacing:.045em;
      text-transform:uppercase;
      color:var(--muted)!important
    }
    .analises-detail-section .kv-value{
      margin-top:5px;
      font-size:14px!important;
      line-height:1.35;
      color:var(--strong)!important
    }
    .analises-detail-analysis{
      padding:16px;
      color:var(--text);
      font-size:14px;
      line-height:1.65;
      white-space:pre-wrap
    }
    .analises-drawer .detail-actions{
      display:flex;
      gap:8px;
      flex-wrap:wrap;
      padding:0 0 2px
    }
    .analises-drawer .detail-actions:empty{display:none}
    .analises-drawer .detail-block{
      display:grid;
      gap:12px;
      background:transparent!important;
      border:0!important;
      padding:0!important
    }
    .analises-drawer .analysis-text{display:none!important}
    .analises-detail-empty{
      color:var(--muted);
      font-style:italic
    }

    #loading .loading-card{width:min(470px,calc(100vw - 32px))}
    #loadingTitle{font-size:17px;font-weight:900;color:var(--strong)}
    #loadingText{line-height:1.45}

    @media(max-width:700px){
      .analises-drawer-context{grid-template-columns:1fr!important;padding:14px 16px 6px}
      .analises-drawer-context div:nth-child(5){grid-column:auto}
      #analisesDrawerBody{padding:8px 16px 22px}
      .analises-detail-section-grid{grid-template-columns:1fr}
      .analises-drawer-head{padding:17px 16px 15px!important}
    }
  `;
  document.head.appendChild(style);
}

function friendlyLoadingMessage(raw){
  const value = norm(raw);
  if(!value) return "Preparando os dados para visualização...";
  if(value.includes("cache consolidado indisponivel")) return "Buscando os dados mais recentes...";
  if(value.includes("consultando supabase em lotes")) return "Buscando os dados mais recentes...";
  if(value.includes("carregando supabase")) return "Recebendo os registros da análise...";
  if(value.includes("montando filtros") || value.includes("montando painel")) return "Organizando filtros e informações...";
  if(value.includes("calculando indicadores")) return "Calculando indicadores e gráficos...";
  if(value.includes("preparando sessao")) return "Validando seu acesso...";
  if(value.includes("painel pronto")) return "Finalizando a visualização...";
  return raw;
}

function refineLoading(){
  const loading = document.getElementById("loading");
  const title = document.getElementById("loadingTitle");
  const text = document.getElementById("loadingText");
  if(!loading || !title || !text) return false;

  const active = loading.classList.contains("show");
  if(active){
    title.textContent = "Carregando análises";
    text.textContent = friendlyLoadingMessage(text.textContent);
  }
  return active;
}

function loadingStep(){
  const active = refineLoading();
  state.loadingAttempts += 1;
  if(active || state.loadingAttempts < 25){
    state.loadingTimer = window.setTimeout(loadingStep, 120);
  }else{
    state.loadingAttempts = 0;
    state.loadingTimer = 0;
  }
}

function startLoadingRefinement(){
  window.clearTimeout(state.loadingTimer);
  state.loadingAttempts = 0;
  state.loadingTimer = window.setTimeout(loadingStep, 0);
}

function sectionDefinition(label){
  const key = norm(label);
  if(["etapa","data da analise","validacao","janela oficial"].includes(key)){
    return { key:"status", title:"Situação da análise", icon:"fa-circle-check" };
  }
  if(["nota final","modalidade"].includes(key)){
    return { key:"result", title:"Resultado", icon:"fa-chart-simple" };
  }
  return { key:"score", title:"Composição da pontuação", icon:"fa-list-check" };
}

function makeSection(definition){
  const section = document.createElement("section");
  section.className = "analises-detail-section";
  section.dataset.section = definition.key;
  section.innerHTML = `
    <div class="analises-detail-section-head"><i class="fa-solid ${definition.icon}"></i><span>${definition.title}</span></div>
    <div class="analises-detail-section-grid"></div>`;
  return section;
}

function reorganizeDrawer(){
  const drawer = document.querySelector("#analisesDetailDrawer:not([hidden]) .analises-drawer");
  const shell = drawer?.querySelector("#analisesDrawerBody .detail-shell");
  if(!drawer || !shell || shell.dataset.refined === "true") return false;

  shell.dataset.refined = "true";
  const originalGrid = shell.querySelector(":scope > .detail-grid");
  const detailBlock = shell.querySelector(":scope > .detail-block");
  const analysisText = detailBlock?.querySelector(".analysis-text");
  const actions = detailBlock?.querySelector(".detail-actions");

  const sections = new Map();
  [...(originalGrid?.querySelectorAll(":scope > .kv") || [])].forEach(item => {
    const label = txt(item.querySelector(".kv-label")?.textContent);
    const definition = sectionDefinition(label);
    if(!sections.has(definition.key)){
      const section = makeSection(definition);
      sections.set(definition.key, section);
      shell.insertBefore(section, detailBlock || null);
    }
    sections.get(definition.key).querySelector(".analises-detail-section-grid")?.appendChild(item);
  });
  originalGrid?.remove();

  if(actions && actions.children.length){
    shell.insertBefore(actions, shell.firstChild);
  }

  const analysisSection = document.createElement("section");
  analysisSection.className = "analises-detail-section";
  analysisSection.innerHTML = `
    <div class="analises-detail-section-head"><i class="fa-solid fa-file-lines"></i><span>Parecer da análise</span></div>
    <div class="analises-detail-analysis"></div>`;
  const analysisBody = analysisSection.querySelector(".analises-detail-analysis");
  const analysisValue = txt(analysisText?.textContent);
  analysisBody.textContent = analysisValue || "Sem análise registrada.";
  if(!analysisValue || analysisValue === "Sem análise registrada.") analysisBody.classList.add("analises-detail-empty");
  shell.appendChild(analysisSection);

  detailBlock?.remove();
  return true;
}

function drawerStep(attempt = 0){
  if(reorganizeDrawer()) return;
  if(attempt >= 20) return;
  state.drawerTimer = window.setTimeout(() => drawerStep(attempt + 1), 35);
}

function startDrawerRefinement(){
  window.clearTimeout(state.drawerTimer);
  state.drawerTimer = window.setTimeout(() => drawerStep(0), 0);
}

function bindEvents(){
  document.addEventListener("click", event => {
    if(event.target?.closest?.("#refreshBtn")) startLoadingRefinement();
    if(event.target?.closest?.('#tableBody button[onclick*="toggleDetails"]')) startDrawerRefinement();
  }, true);

  document.addEventListener("agsus:analises-loading-start", startLoadingRefinement);
  document.addEventListener("agsus:analises-loading-end", () => {
    refineLoading();
    startDrawerRefinement();
  });
  window.addEventListener("focus", () => {
    startLoadingRefinement();
    startDrawerRefinement();
  });
}

function init(){
  if(state.initialized) return;
  state.initialized = true;
  installStyles();
  bindEvents();
  startLoadingRefinement();
}

init();
