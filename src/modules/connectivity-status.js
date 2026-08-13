import "../styles/runtime-critical-fixes.css";

const RECONNECTED_VISIBILITY_MS = 3200;
let hideHandle = null;

export function getConnectivityState(online) {
  return online ? "online" : "offline";
}

export function shouldAutoHideConnectivityNotice(renderedState, currentState) {
  return renderedState === "online" && currentState === "online";
}

function ensureConnectivityNotice() {
  let notice = document.getElementById("connectivityStatusNotice");
  if (notice) return notice;

  notice = document.createElement("aside");
  notice.id = "connectivityStatusNotice";
  notice.className = "connectivity-status hidden";
  notice.setAttribute("role", "status");
  notice.setAttribute("aria-live", "polite");
  notice.setAttribute("aria-atomic", "true");
  document.body.appendChild(notice);
  return notice;
}

function createRetryButton() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "connectivity-status__action";
  button.textContent = "Tentar novamente";
  button.addEventListener("click", () => window.location.reload());
  return button;
}

function cancelPendingHide() {
  if (!hideHandle) return;
  window.clearTimeout(hideHandle);
  hideHandle = null;
}

function renderConnectivityNotice(state) {
  const notice = ensureConnectivityNotice();
  cancelPendingHide();
  notice.replaceChildren();
  notice.dataset.state = state;

  const content = document.createElement("div");
  content.className = "connectivity-status__content";

  const title = document.createElement("strong");
  title.className = "connectivity-status__title";

  const message = document.createElement("span");
  message.className = "connectivity-status__message";

  if (state === "offline") {
    title.textContent = "Sem conexão com a internet";
    message.textContent =
      "Algumas informações podem estar desatualizadas até a conexão voltar.";
    content.append(title, message);
    notice.append(content, createRetryButton());
    notice.classList.remove("hidden");
    return;
  }

  title.textContent = "Conexão restabelecida";
  message.textContent = "O sistema voltou a ficar online.";
  content.append(title, message);
  notice.append(content);
  notice.classList.remove("hidden");

  const renderedState = state;
  hideHandle = window.setTimeout(() => {
    hideHandle = null;
    const currentState = notice.dataset.state;
    if (shouldAutoHideConnectivityNotice(renderedState, currentState)) {
      notice.classList.add("hidden");
    }
  }, RECONNECTED_VISIBILITY_MS);
}

export function initConnectivityStatus() {
  let previousState = getConnectivityState(navigator.onLine);

  if (previousState === "offline") {
    renderConnectivityNotice("offline");
  }

  window.addEventListener("offline", () => {
    previousState = "offline";
    renderConnectivityNotice(previousState);
  });

  window.addEventListener("online", () => {
    if (previousState !== "offline") return;
    previousState = "online";
    renderConnectivityNotice(previousState);
  });
}
