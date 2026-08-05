import {
  getLoadingStage,
  isGenericLoadingCopy,
  normalizeLoadingProgress,
} from "../lib/loading-copy.js";

const LOADING_CLASS = "analises-is-loading";
const UPDATE_INTERVAL_MS = 1_000;
const STATE_SYNC_INTERVAL_MS = 250;
let loadingStartedAt = 0;
let loadingTimer = null;

function setButtonLoading(button, active) {
  if (!button) return;

  button.setAttribute("aria-busy", String(active));
  if (active) {
    button.dataset.loadingPreviouslyDisabled = String(button.disabled);
    button.disabled = true;
    return;
  }

  button.disabled = button.dataset.loadingPreviouslyDisabled === "true";
  delete button.dataset.loadingPreviouslyDisabled;
}

function setLoading(active) {
  document.body.classList.toggle(LOADING_CLASS, active);
  const main = document.querySelector("main.content");
  if (main) main.setAttribute("aria-busy", String(active));

  ["refreshBtn", "applyBtn", "scopeGuardLoad"].forEach((id) => {
    setButtonLoading(document.getElementById(id), active);
  });
}

function ensureStyles() {
  if (document.getElementById("analisesLoadingFeedbackStyles")) return;
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
    .loading-card{position:relative;overflow:hidden}
    .loading-card::before{content:"";position:absolute;inset:0 0 auto;height:4px;background:linear-gradient(90deg,var(--blue),var(--cyan),var(--green))}
    .analises-loading-meta{margin-top:12px;color:var(--muted);font-size:12px;font-weight:750;line-height:1.45;text-align:center}
    .analises-loading-meta.is-delayed{padding:9px 11px;border:1px solid rgba(226,164,0,.34);border-radius:11px;background:rgba(226,164,0,.10);color:color-mix(in srgb,var(--yellow) 70%,var(--strong))}
    .analises-loading-retry{display:block;margin:10px auto 0;min-height:38px;padding:0 15px;border:1px solid var(--line2);border-radius:11px;background:var(--card);color:var(--blue2);font:inherit;font-weight:850;cursor:pointer}
    .analises-loading-retry:hover{border-color:var(--blue2);background:var(--card2)}
    @media(prefers-reduced-motion:reduce){body.${LOADING_CLASS} #kpiGrid .kpi b,body.${LOADING_CLASS} #pdfMetrics > *,body.${LOADING_CLASS} #attentionList > *,body.${LOADING_CLASS} #tableBody tr,body.${LOADING_CLASS} .chart-wrap::after{animation:none!important}}
  `;
  document.head.appendChild(style);
}

function ensureSupportElements(card) {
  let meta = document.getElementById("analisesLoadingMeta");
  if (!meta) {
    meta = document.createElement("div");
    meta.id = "analisesLoadingMeta";
    meta.className = "analises-loading-meta";
    meta.setAttribute("aria-live", "polite");
    card.appendChild(meta);
  }

  let retry = document.getElementById("analisesLoadingRetry");
  if (!retry) {
    retry = document.createElement("button");
    retry.id = "analisesLoadingRetry";
    retry.className = "analises-loading-retry";
    retry.type = "button";
    retry.textContent = "Tentar novamente";
    retry.hidden = true;
    retry.addEventListener("click", () => window.location.reload());
    card.appendChild(retry);
  }

  return { meta, retry };
}

function getProgress() {
  return normalizeLoadingProgress(
    document.getElementById("progressBar")?.style.width || 0,
  );
}

function updateCopy(loading) {
  const card = loading.querySelector(".loading-card");
  if (!card) return;

  const elapsedMs = Math.max(0, Date.now() - loadingStartedAt);
  const stage = getLoadingStage({
    context: "analises",
    progress: getProgress(),
    elapsedMs,
  });
  const title = document.getElementById("loadingTitle");
  const detail = document.getElementById("loadingText");
  const { meta, retry } = ensureSupportElements(card);

  if (title && isGenericLoadingCopy(title.textContent)) {
    title.textContent = stage.title;
  }
  if (detail && isGenericLoadingCopy(detail.textContent)) {
    detail.textContent = stage.detail;
  }

  meta.textContent =
    stage.delayMessage || `Etapa ${stage.step} de ${stage.totalSteps}`;
  meta.classList.toggle("is-delayed", stage.delayed);
  retry.hidden = !stage.canRetry;
}

function stopTimer() {
  if (loadingTimer) window.clearInterval(loadingTimer);
  loadingTimer = null;
  loadingStartedAt = 0;
}

function startTimer(loading) {
  stopTimer();
  loadingStartedAt = Date.now();
  updateCopy(loading);
  loadingTimer = window.setInterval(
    () => updateCopy(loading),
    UPDATE_INTERVAL_MS,
  );
}

function start() {
  ensureStyles();
  const loading = document.getElementById("loading");
  if (!loading) return;

  loading.setAttribute("role", "status");
  loading.setAttribute("aria-live", "polite");
  loading.setAttribute("aria-atomic", "true");

  let lastActive = null;
  const sync = () => {
    const active = loading.classList.contains("show");
    if (active === lastActive) return;
    lastActive = active;
    loading.setAttribute("aria-hidden", String(!active));
    setLoading(active);
    if (active) startTimer(loading);
    else stopTimer();
  };

  sync();
  window.setInterval(sync, STATE_SYNC_INTERVAL_MS);
}

document.addEventListener("DOMContentLoaded", start, { once: true });
