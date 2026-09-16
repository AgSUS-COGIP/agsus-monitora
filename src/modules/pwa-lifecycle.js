let refreshingForUpdate = false;
let updateReloadRequested = false;
let lastUpdateCheckAt = 0;

const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;

export function shouldCheckForUpdate({
  now,
  lastCheckedAt,
  online,
  visible,
  minimumInterval = UPDATE_CHECK_INTERVAL_MS,
}) {
  if (!online || !visible) return false;
  if (!lastCheckedAt) return true;
  return now - lastCheckedAt >= minimumInterval;
}

export function shouldReloadAfterControllerChange({
  updateRequested,
  alreadyReloading,
}) {
  return Boolean(updateRequested && !alreadyReloading);
}

function showUpdateNotice(worker) {
  // Atualiza o service worker em segundo plano. O MONITORA continua sendo
  // uma aplicação web: não há prompt, banner nem orientação de instalação.
  updateReloadRequested = true;
  worker.postMessage({ type: "SKIP_WAITING" });
}

function watchRegistration(registration) {
  if (registration.waiting) showUpdateNotice(registration.waiting);

  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    if (!worker) return;

    worker.addEventListener("statechange", () => {
      const updateReady =
        worker.state === "installed" && navigator.serviceWorker.controller;
      if (updateReady) showUpdateNotice(worker);
    });
  });
}

function checkRegistrationForUpdate(registration) {
  const now = Date.now();
  const shouldCheck = shouldCheckForUpdate({
    now,
    lastCheckedAt: lastUpdateCheckAt,
    online: navigator.onLine,
    visible: document.visibilityState === "visible",
  });

  if (!shouldCheck) return;

  lastUpdateCheckAt = now;
  registration.update().catch(() => {});
}

function bindUpdateRefresh(registration) {
  const requestUpdateCheck = () => checkRegistrationForUpdate(registration);

  document.addEventListener("visibilitychange", requestUpdateCheck);
  window.addEventListener("online", requestUpdateCheck);
}

function bindServiceWorkerUpdates() {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.ready
    .then((registration) => {
      watchRegistration(registration);
      bindUpdateRefresh(registration);
      lastUpdateCheckAt = Date.now();
    })
    .catch(() => {});

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    const shouldReload = shouldReloadAfterControllerChange({
      updateRequested: updateReloadRequested,
      alreadyReloading: refreshingForUpdate,
    });
    if (!shouldReload) return;

    updateReloadRequested = false;
    refreshingForUpdate = true;
    window.location.reload();
  });
}

export function initPwaLifecycle() {
  bindServiceWorkerUpdates();
}
