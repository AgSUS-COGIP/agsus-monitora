const PANE_SELECTOR = ".health-map-pane";
const IMMERSIVE_CLASS = "is-immersive";
const BODY_CLASS = "health-map-immersive-open";

let initialized = false;
let activePane = null;
let returnFocusTo = null;

function refreshLeafletLayout() {
  const fireResize = () => window.dispatchEvent(new Event("resize"));
  requestAnimationFrame(() => {
    fireResize();
    requestAnimationFrame(fireResize);
  });
}

function buttonCopy(expanded) {
  return expanded ? "Sair da tela cheia" : "Expandir mapa";
}

function syncButton(button, expanded) {
  if (!button) return;
  button.setAttribute("aria-pressed", expanded ? "true" : "false");
  button.setAttribute("aria-label", buttonCopy(expanded));
  button.title = buttonCopy(expanded);
  button.innerHTML = expanded
    ? '<i class="fa-solid fa-compress" aria-hidden="true"></i><span>Recolher</span>'
    : '<i class="fa-solid fa-expand" aria-hidden="true"></i><span>Expandir</span>';
}

function exitImmersive({ restoreFocus = true } = {}) {
  if (!activePane) return false;

  const pane = activePane;
  activePane = null;
  pane.classList.remove(IMMERSIVE_CLASS);
  document.body.classList.remove(BODY_CLASS);

  const button = pane.querySelector(".health-map-immersive-toggle");
  syncButton(button, false);
  refreshLeafletLayout();

  if (restoreFocus && returnFocusTo instanceof HTMLElement) {
    requestAnimationFrame(() => returnFocusTo?.focus());
  }
  returnFocusTo = null;
  return true;
}

function enterImmersive(pane, button) {
  if (!pane || activePane === pane) return false;
  if (activePane) exitImmersive({ restoreFocus: false });

  activePane = pane;
  returnFocusTo = button;
  pane.classList.add(IMMERSIVE_CLASS);
  document.body.classList.add(BODY_CLASS);
  syncButton(button, true);
  refreshLeafletLayout();
  return true;
}

function toggleImmersive(pane, button) {
  if (activePane === pane) return exitImmersive();
  return enterImmersive(pane, button);
}

function enhancePane(pane) {
  if (!pane || pane.dataset.immersiveReady === "true") return;
  const header = pane.querySelector(".health-map-pane__header");
  if (!header) return;

  pane.dataset.immersiveReady = "true";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "health-map-immersive-toggle";
  syncButton(button, false);
  button.addEventListener("click", () => toggleImmersive(pane, button));

  header.appendChild(button);
}

export function initHealthMapImmersiveWorkspace() {
  if (initialized) return true;
  initialized = true;

  document.querySelectorAll(PANE_SELECTOR).forEach(enhancePane);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !activePane) return;
    event.preventDefault();
    exitImmersive();
  });

  return true;
}
