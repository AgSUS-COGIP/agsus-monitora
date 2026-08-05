let deferredInstallPrompt = null;
let refreshingForUpdate = false;

const IOS_GUIDANCE_DISMISSED_KEY = "agsus-pwa-ios-guidance-dismissed";

export function isIosLike({
  userAgent = "",
  platform = "",
  maxTouchPoints = 0,
}) {
  const classicIos = /iPad|iPhone|iPod/i.test(userAgent);
  const ipadDesktopMode = platform === "MacIntel" && maxTouchPoints > 1;
  return classicIos || ipadDesktopMode;
}

export function isStandaloneDisplayMode({
  standalone = false,
  matches = false,
}) {
  return Boolean(standalone || matches);
}

export function shouldShowIosInstallGuidance({
  iosLike,
  standalone,
  dismissed,
}) {
  return Boolean(iosLike && !standalone && !dismissed);
}

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

function showNotice({ title, message, actions, variant = "default" }) {
  const notice = ensureNotice();
  notice.replaceChildren();
  notice.dataset.variant = variant;

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

function dismissIosGuidance() {
  try {
    window.sessionStorage.setItem(IOS_GUIDANCE_DISMISSED_KEY, "1");
  } catch {
    // A orientação pode ser dispensada mesmo quando o storage está indisponível.
  }
  hideNotice();
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

function showIosInstallGuidance() {
  showNotice({
    title: "Instalar no iPhone ou iPad",
    message:
      "No Safari, toque em Compartilhar e escolha Adicionar à Tela de Início.",
    actions: [createActionButton("Entendi", dismissIosGuidance)],
    variant: "ios",
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
    variant: "update",
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

function bindIosInstallGuidance() {
  const iosLike = isIosLike({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
  });
  const standalone = isStandaloneDisplayMode({
    standalone: navigator.standalone,
    matches: window.matchMedia("(display-mode: standalone)").matches,
  });

  let dismissed = false;
  try {
    dismissed =
      window.sessionStorage.getItem(IOS_GUIDANCE_DISMISSED_KEY) === "1";
  } catch {
    dismissed = false;
  }

  if (shouldShowIosInstallGuidance({ iosLike, standalone, dismissed })) {
    window.setTimeout(showIosInstallGuidance, 900);
  }
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
  bindIosInstallGuidance();
  bindServiceWorkerUpdates();
}
