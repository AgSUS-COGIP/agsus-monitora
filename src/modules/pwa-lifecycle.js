let refreshingForUpdate = false;
let updateReloadRequested = false;
/* Versão nova já ativa, esperando a próxima troca de página para recarregar. */
let atualizacaoPendente = false;
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

  /*
    Antes recarregava aqui, na hora: quem estava digitando (notas de
    entrevista, resposta de recurso) perdia o texto. Agora a versão nova fica
    pendente e entra na próxima troca de página (aplicarAtualizacaoPendente,
    chamada pelo navigate do legado depois da guarda de alterações não salvas).
  */
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    const shouldReload = shouldReloadAfterControllerChange({
      updateRequested: updateReloadRequested,
      alreadyReloading: refreshingForUpdate,
    });
    if (!shouldReload) return;

    updateReloadRequested = false;
    atualizacaoPendente = true;
  });
}

/**
 * Se há versão nova esperando, recarrega agora (a pessoa acabou de pedir
 * outra página: nada digitado se perde) e devolve true — quem chamou não segue
 * com a navegação; a tela pedida abre depois da recarga, porque o legado já
 * guardou a última tela. Sem versão nova, devolve false.
 */
export function aplicarAtualizacaoPendente(
  recarregar = () => window.location.reload(),
) {
  if (!atualizacaoPendente || refreshingForUpdate) return false;
  atualizacaoPendente = false;
  refreshingForUpdate = true;
  recarregar();
  return true;
}

/** Só para teste: simula a versão nova ativa esperando a troca de página. */
export function marcarAtualizacaoPendenteParaTeste(valor = true) {
  atualizacaoPendente = valor;
  refreshingForUpdate = false;
}

export function initPwaLifecycle() {
  bindServiceWorkerUpdates();
}
