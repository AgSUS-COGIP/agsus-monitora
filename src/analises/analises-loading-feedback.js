const LOADING_CLASS = "analises-is-loading";

function setLoading(active){
  document.body.classList.toggle(LOADING_CLASS, active);
  const main = document.querySelector("main.content");
  if(main) main.setAttribute("aria-busy", String(active));

  ["refreshBtn", "applyBtn", "scopeGuardLoad"].forEach(id => {
    const button = document.getElementById(id);
    if(!button) return;
    button.setAttribute("aria-busy", String(active));
  });
}

function ensureStyles(){
  if(document.getElementById("analisesLoadingFeedbackStyles")) return;
  const style = document.createElement("style");
  style.id = "analisesLoadingFeedbackStyles";
  style.textContent = `
    @keyframes analises-skeleton{0%{background-position:200% 0}100%{background-position:-200% 0}}
    body.${LOADING_CLASS} #kpiGrid .kpi b,
    body.${LOADING_CLASS} #pdfMetrics > *,
    body.${LOADING_CLASS} #attentionList > *,
    body.${LOADING_CLASS} #tableBody tr{
      color:transparent!important;
      border-color:transparent!important;
      background:linear-gradient(90deg,rgba(148,163,184,.10) 25%,rgba(148,163,184,.22) 50%,rgba(148,163,184,.10) 75%)!important;
      background-size:200% 100%!important;
      animation:analises-skeleton 1.35s ease-in-out infinite!important;
    }
    body.${LOADING_CLASS} #kpiGrid .kpi b{display:inline-block;min-width:72px;border-radius:8px;user-select:none}
    body.${LOADING_CLASS} .chart-wrap{position:relative;min-height:180px;overflow:hidden}
    body.${LOADING_CLASS} .chart-wrap::after{content:"";position:absolute;inset:12px;border-radius:12px;background:linear-gradient(90deg,rgba(148,163,184,.08) 25%,rgba(148,163,184,.18) 50%,rgba(148,163,184,.08) 75%);background-size:200% 100%;animation:analises-skeleton 1.35s ease-in-out infinite;pointer-events:none}
    @media(prefers-reduced-motion:reduce){body.${LOADING_CLASS} #kpiGrid .kpi b,body.${LOADING_CLASS} #pdfMetrics > *,body.${LOADING_CLASS} #attentionList > *,body.${LOADING_CLASS} #tableBody tr,body.${LOADING_CLASS} .chart-wrap::after{animation:none!important}}
  `;
  document.head.appendChild(style);
}

function start(){
  ensureStyles();
  const loading = document.getElementById("loading");
  if(!loading) return;

  const update = () => setLoading(loading.classList.contains("show"));
  update();
  const observer = new MutationObserver(update);
  observer.observe(loading, { attributes:true, attributeFilter:["class"] });
}

document.addEventListener("DOMContentLoaded", start, { once:true });
