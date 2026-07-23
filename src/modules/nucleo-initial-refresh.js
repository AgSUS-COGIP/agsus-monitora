let initialized = false;
let refreshing = false;
let lastRefreshAt = 0;

function isNucleoActive() {
  return document.getElementById("page-nucleo")?.classList.contains("active");
}

function hasRenderedRows() {
  return Boolean(document.querySelector("#nucleoRows tr td"));
}

function refreshOperationalNucleo(force = false) {
  if (!isNucleoActive() || !hasRenderedRows() || refreshing) return false;
  const now = Date.now();
  if (!force && now - lastRefreshAt < 1500) return false;

  const button = document.getElementById("nucleoOperationalRefresh");
  if (!button || button.disabled) return false;

  refreshing = true;
  lastRefreshAt = now;
  button.click();
  window.setTimeout(() => { refreshing = false; }, 1200);
  return true;
}

function refreshAfterOpen() {
  [0, 120, 360].forEach(delay => window.setTimeout(() => refreshOperationalNucleo(), delay));
}

export function initNucleoInitialRefresh() {
  if (initialized) return;
  initialized = true;

  document.addEventListener("click", event => {
    if (event.target?.closest?.('[data-view="nucleo"]')) refreshAfterOpen();
  });

  document.addEventListener("agsus:nucleo-rendered", refreshAfterOpen);
  document.addEventListener("agsus:nucleo-cronograma-saved", refreshAfterOpen);

  [300, 900, 1800].forEach(delay => window.setTimeout(() => {
    if (isNucleoActive()) refreshOperationalNucleo(true);
  }, delay));
}
