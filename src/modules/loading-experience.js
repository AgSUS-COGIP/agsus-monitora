import {
  getLoadingStage,
  isGenericLoadingCopy,
  normalizeLoadingProgress,
} from "../lib/loading-copy.js";

const UPDATE_INTERVAL_MS = 1_000;
let loadingStartedAt = 0;
let loadingTimer = null;

function getProgress() {
  const textProgress = document.getElementById("loaderPct")?.textContent;
  const barProgress = document.getElementById("loaderBar")?.style.width;
  return normalizeLoadingProgress(textProgress || barProgress || 0);
}

function ensureSupportElements(card) {
  let meta = document.getElementById("loaderMeta");
  if (!meta) {
    meta = document.createElement("div");
    meta.id = "loaderMeta";
    meta.className = "loader-meta";
    meta.setAttribute("aria-live", "polite");
    card.appendChild(meta);
  }

  let retry = document.getElementById("loaderRetry");
  if (!retry) {
    retry = document.createElement("button");
    retry.id = "loaderRetry";
    retry.className = "loader-retry";
    retry.type = "button";
    retry.textContent = "Tentar novamente";
    retry.hidden = true;
    retry.addEventListener("click", () => window.location.reload());
    card.appendChild(retry);
  }

  return { meta, retry };
}

function updateLoadingExperience() {
  const loader = document.getElementById("loader");
  const card = loader?.querySelector(".loader-card");
  if (!loader || !card || !loader.classList.contains("show")) return;

  const title = document.getElementById("loaderTitle");
  const detail = document.getElementById("loaderSub");
  const { meta, retry } = ensureSupportElements(card);
  const elapsedMs = Math.max(0, Date.now() - loadingStartedAt);
  const stage = getLoadingStage({ progress: getProgress(), elapsedMs });

  if (title && isGenericLoadingCopy(title.textContent)) {
    title.textContent = stage.title;
  }
  if (detail && isGenericLoadingCopy(detail.textContent)) {
    detail.textContent = stage.detail;
  }

  meta.textContent = stage.delayMessage || `Etapa ${stage.step} de ${stage.totalSteps}`;
  meta.classList.toggle("is-delayed", stage.delayed);
  retry.hidden = !stage.canRetry;
}

function startTimer() {
  stopTimer();
  loadingStartedAt = Date.now();
  updateLoadingExperience();
  loadingTimer = window.setInterval(updateLoadingExperience, UPDATE_INTERVAL_MS);
}

function stopTimer() {
  if (loadingTimer) window.clearInterval(loadingTimer);
  loadingTimer = null;
  loadingStartedAt = 0;
}

export function initLoadingExperience() {
  const loader = document.getElementById("loader");
  if (!loader) return;

  loader.setAttribute("role", "status");
  loader.setAttribute("aria-live", "polite");
  loader.setAttribute("aria-atomic", "true");

  const sync = () => {
    const active = loader.classList.contains("show");
    loader.setAttribute("aria-hidden", String(!active));
    document.body.setAttribute("aria-busy", String(active));
    if (active && !loadingTimer) startTimer();
    if (!active) stopTimer();
  };

  sync();
  new MutationObserver(sync).observe(loader, {
    attributes: true,
    attributeFilter: ["class"],
  });
}
