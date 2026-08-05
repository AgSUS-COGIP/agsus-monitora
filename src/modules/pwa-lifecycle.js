let deferredInstallPrompt = null;
let refreshingForUpdate = false;

function createActionButton(label, action, secondary = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = secondary
    ? "pwa-notice__action pwa-notice__action--secondary"
    : "pwa-notice__action";
  button.textContent = label;
  button.addEventListener("click", action);
  return button;
}

function ensureNotice() {
  let notice = document.getElementById("pwaLifecycleNotice");
  if (notice) return notice;

  notice = document.createElement("aside");
  notice.id = "pwaLifecycleNotice";
  notice.className = "pwa-notice hidden";
  notice.setAttribute("role", "status");
  notice.setAttribute("aria-live", "polite");
  document.body.appendChild(notice);
  return notice;
}

function showNotice({ title, message, actions }) {
  const notice = ensureNotice();
  notice.replaceChildren();

  const content = document.createElement("div");
  content.className = "pwa-notice__content";

  const heading = document.createElement("strong");
  heading.className = "pwa-notice__title";
  heading.textContent = title;

  const description = document.createElement("span");
  description.className = "pwa-notice__message";
  description.textContent = message;

  content.append(heading, description);

  const controls = document.createElement("div");
  controls.className = "pwa-notice__actions";
  actions.forEach((action) => controls.appendChild(action));

  notice.append(content, controls);
  notice.classList.remove("hidden");
}

function hideNotice() {
  document.getElementById("pwaLifecycleNotice")?.classList.add("hidden");
}

async function requestInstallation() {
  if (!deferredInstallPrompt) return;

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  hideNotice();
}

function showInstallNotice() {
  showNotice({
    title: "Instalar AgSUS Monitora",
    message: "Abra o sistema como aplicativo para acesso mais rápido.",
    actions: [
      createActionButton("Instalar", requestInstallation),
      createActionButton("Agora não", hideNotice, true),
    ],
  });
}

function activateWaitingWorker(worker) {
  worker.postMessage({ type: "SKIP_WAITING" });
}

function showUpdateNotice(worker) {
  showNotice({
    title: "Nova versão disponível",
    message: "Atualize quando estiver pronto para usar as melhorias recentes.",
    actions: [
      createActionButton("Atualizar", () => activateWaitingWorker(worker)),
      createActionButton("Depois", hideNotice, true),
    ],
  });
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

function bindInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    showInstallNotice();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    hideNotice();
  });
}

function bindServiceWorkerUpdates() {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.ready.then(watchRegistration).catch(() => {});

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshingForUpdate) return;
    refreshingForUpdate = true;
    window.location.reload();
  });
}

export function initPwaLifecycle() {
  bindInstallPrompt();
  bindServiceWorkerUpdates();
}
