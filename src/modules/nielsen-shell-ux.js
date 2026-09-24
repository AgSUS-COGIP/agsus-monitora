import {
  avisar,
  EVENTO_TEMA_ALTERADO,
} from "../lib/eventos-da-barra-lateral.js";

const THEME_STORAGE_KEY = "agsus_dark_mode_v1";
const PRESENCE_SYNC_GRACE_MS = 12000;
const PRESENCE_WATCHDOG_MS = 5000;

let initialized = false;
let presenceTimer = null;
let presenceObservedText = "";
let presenceObservedAt = 0;
let logoutConfirmationResolver = null;
let logoutPreviousFocus = null;
let logoutAction = null;
let logoutRunning = false;

function text(value) {
  return String(value ?? "").trim();
}

/*
  Tema: o seletor Claro/Escuro mora no rodapé da barra lateral, junto do Sair
  (`src/componentes/barra-lateral/rodape.jsx`). É o único controle de tema — o
  botão que ficava no cabeçalho saiu. Daqui saem o estado e a regra que o
  rodapé usa; este módulo só mantém o tema em dia e avisa quando ele troca.
*/
export const OPCOES_DE_TEMA = Object.freeze([
  Object.freeze({ tema: "claro", rotulo: "Claro", icone: "sun" }),
  Object.freeze({ tema: "escuro", rotulo: "Escuro", icone: "moon" }),
]);

/* O segmento já ativo não inverte o tema: só o que pede o tema que não vale. */
export function deveAlternarTema(temaPedido, escuroAtivo) {
  return (temaPedido === "escuro") !== Boolean(escuroAtivo);
}

export function themeControlState(isDark) {
  return isDark
    ? {
        tema: "escuro",
        icon: "moon",
        label: "Tema escuro ativo. Alternar para tema claro.",
        title: "Tema escuro",
        pressed: "true",
      }
    : {
        tema: "claro",
        icon: "sun",
        label: "Tema claro ativo. Alternar para tema escuro.",
        title: "Tema claro",
        pressed: "false",
      };
}

export function presenceStateFromUi(
  label,
  { online = true, elapsedMs = 0, graceMs = PRESENCE_SYNC_GRACE_MS } = {},
) {
  const normalized = text(label);
  if (!online) {
    return {
      state: "offline",
      compactLabel: "Offline",
      detail: "Sem conexão com a internet.",
    };
  }

  if (/^\d+\s+online$/i.test(normalized)) {
    const count = Number.parseInt(normalized, 10) || 0;
    return {
      state: "ready",
      compactLabel: `${count} online`,
      detail: `${count} ${count === 1 ? "pessoa online" : "pessoas online"}.`,
    };
  }

  if (/presença indisponível/i.test(normalized)) {
    return {
      state: "error",
      compactLabel: "Presença indisponível",
      detail: "Não foi possível atualizar a presença agora.",
    };
  }

  if (/sincronizando/i.test(normalized)) {
    if (elapsedMs >= graceMs) {
      return {
        state: "error",
        compactLabel: "Presença indisponível",
        detail: "Não foi possível atualizar a presença agora.",
      };
    }
    return {
      state: "loading",
      compactLabel: "Sincronizando",
      detail: "Sincronizando presença.",
    };
  }

  return {
    state: "ready",
    compactLabel: normalized || "Presença",
    detail: normalized || "Presença online.",
  };
}

function isDarkTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

/*
  Mantém `color-scheme` em dia e avisa a barra lateral (React), que lê o tema
  de `html[data-theme]`.
*/
function syncThemeState() {
  document.documentElement.style.colorScheme = isDarkTheme() ? "dark" : "light";
  avisar(EVENTO_TEMA_ALTERADO);
}

/*
  `toggleDarkMode` (legado) inverte o tema. Embrulhada aqui, avisa depois de
  cada troca; o embrulho de `health-dashboard-interaction-fixes.js` mantém o
  espelho `body.dark-mode`. A troca feita em outra aba chega pelo `storage`.
*/
function installThemeSync() {
  const originalToggle = window.toggleDarkMode;
  if (
    typeof originalToggle === "function" &&
    !originalToggle.__nielsenUxWrapped
  ) {
    const wrappedToggle = (...args) => {
      const result = originalToggle(...args);
      window.setTimeout(syncThemeState, 0);
      return result;
    };
    wrappedToggle.__nielsenUxWrapped = true;
    wrappedToggle.__original = originalToggle;
    window.toggleDarkMode = wrappedToggle;
  }

  window.addEventListener("storage", (event) => {
    if (event.key && event.key !== THEME_STORAGE_KEY) return;
    if (event.newValue !== "1" && event.newValue !== "0") return;
    document.documentElement.setAttribute(
      "data-theme",
      event.newValue === "1" ? "dark" : "",
    );
    syncThemeState();
  });

  syncThemeState();
}

function removeLegacyAccountActions() {
  const actions = document.querySelector(
    "#topUserMenu .top-user-popover-actions",
  );
  if (!actions) return;

  actions.querySelectorAll("button").forEach((button) => {
    const handler = button.getAttribute("onclick") || "";
    if (handler.includes("logout") || handler.includes("toggleDarkMode")) {
      button.remove();
    }
  });

  if (!actions.children.length) actions.remove();

  const summary = document.querySelector("#topUserMenu > summary");
  summary?.setAttribute("aria-label", "Abrir informações da conta");
}

function logoutDialogHTML() {
  return `
    <div id="shellLogoutDialog" class="shell-confirm-layer" hidden>
      <div class="shell-confirm-backdrop" data-shell-logout-cancel></div>
      <section class="shell-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="shellLogoutTitle" aria-describedby="shellLogoutDescription">
        <div class="shell-confirm-icon" aria-hidden="true"><i class="fa-solid fa-right-from-bracket"></i></div>
        <h2 id="shellLogoutTitle">Deseja realmente sair?</h2>
        <p id="shellLogoutDescription">Sua sessão será encerrada neste navegador. Dados já salvos serão preservados.</p>
        <p id="shellLogoutUnsavedWarning" class="shell-confirm-warning" hidden>Existem alterações não salvas em Configurações. Se sair agora, elas serão descartadas.</p>
        <div class="shell-confirm-actions">
          <button type="button" class="shell-confirm-cancel" data-shell-logout-cancel>Continuar no sistema</button>
          <button type="button" class="shell-confirm-submit" data-shell-logout-confirm>Sair</button>
        </div>
      </section>
    </div>
    <div id="shellSignoutBusy" class="shell-signout-busy" role="status" aria-live="assertive" aria-busy="true" hidden>
      <div class="shell-signout-card">
        <span class="shell-signout-spinner" aria-hidden="true"></span>
        <strong>Saindo do sistema…</strong>
        <span>Encerrando sua sessão neste navegador.</span>
      </div>
    </div>
  `;
}

function hasUnsavedConfiguration() {
  const indicator = document.getElementById("configWorkspaceDirtyTop");
  return Boolean(indicator && !indicator.hidden);
}

function finishLogoutConfirmation(confirmed) {
  const dialog = document.getElementById("shellLogoutDialog");
  if (dialog) dialog.hidden = true;

  const resolver = logoutConfirmationResolver;
  logoutConfirmationResolver = null;
  resolver?.(Boolean(confirmed));

  if (logoutPreviousFocus instanceof HTMLElement) {
    logoutPreviousFocus.focus({ preventScroll: true });
  }
  logoutPreviousFocus = null;
}

function requestLogoutConfirmation() {
  const dialog = document.getElementById("shellLogoutDialog");
  if (!dialog || logoutConfirmationResolver) return Promise.resolve(false);

  const warning = document.getElementById("shellLogoutUnsavedWarning");
  if (warning) warning.hidden = !hasUnsavedConfiguration();

  logoutPreviousFocus = document.activeElement;
  dialog.hidden = false;
  dialog
    .querySelector("[data-shell-logout-cancel]")
    ?.focus({ preventScroll: true });

  return new Promise((resolve) => {
    logoutConfirmationResolver = resolve;
  });
}

function setSignoutBusy(busy) {
  const layer = document.getElementById("shellSignoutBusy");
  if (layer) layer.hidden = !busy;
}

function reportSignoutFailure() {
  const message = "Não foi possível encerrar esta sessão. Tente novamente.";
  if (typeof window.toast === "function") {
    window.toast(message, "error");
    return;
  }
  window.alert(message);
}

/* O Sair da barra lateral (React) chama esta função: confirma, e só então encerra. */
export async function performExplicitLogout() {
  if (logoutRunning) return false;
  if (typeof logoutAction !== "function") {
    reportSignoutFailure();
    return false;
  }

  const confirmed = await requestLogoutConfirmation();
  if (!confirmed) return false;

  logoutRunning = true;
  document.getElementById("topUserMenu")?.removeAttribute("open");
  setSignoutBusy(true);

  try {
    return await logoutAction();
  } catch (error) {
    console.error("Falha ao encerrar a sessão:", error);
    reportSignoutFailure();
    return false;
  } finally {
    logoutRunning = false;
    setSignoutBusy(false);
  }
}

function installLogoutFlow() {
  if (!document.getElementById("shellLogoutDialog")) {
    document.body.insertAdjacentHTML("beforeend", logoutDialogHTML());
  }

  document
    .querySelectorAll("[data-shell-logout-cancel]")
    .forEach((button) =>
      button.addEventListener("click", () => finishLogoutConfirmation(false)),
    );
  document
    .querySelector("[data-shell-logout-confirm]")
    ?.addEventListener("click", () => finishLogoutConfirmation(true));

  document.addEventListener("keydown", (event) => {
    const dialog = document.getElementById("shellLogoutDialog");
    if (event.key === "Escape" && dialog && !dialog.hidden) {
      event.preventDefault();
      finishLogoutConfirmation(false);
    }
  });

  logoutAction = typeof window.logout === "function" ? window.logout : null;
}

function setPresenceMessage(message) {
  const list = document.getElementById("onlinePresenceList");
  if (!list) return;
  list.replaceChildren();
  const paragraph = document.createElement("p");
  paragraph.textContent = message;
  list.appendChild(paragraph);
}

function updatePresenceUi() {
  const root = document.getElementById("onlinePresence");
  const label = document.getElementById("onlinePresenceLabel");
  const button = document.getElementById("onlinePresenceBtn");
  const headingDetail = document.querySelector(
    ".online-presence-heading small",
  );
  if (!root || !label || !button) return;

  if (headingDetail) headingDetail.hidden = true;
  label.setAttribute("aria-live", "polite");

  const currentText = text(label.textContent);
  const now = Date.now();
  if (currentText !== presenceObservedText) {
    presenceObservedText = currentText;
    presenceObservedAt = now;
  }

  const state = presenceStateFromUi(currentText, {
    online: navigator.onLine !== false,
    elapsedMs: Math.max(0, now - presenceObservedAt),
  });

  root.dataset.presenceState = state.state;
  root.setAttribute("aria-busy", state.state === "loading" ? "true" : "false");
  button.setAttribute("aria-label", `${state.detail} Ver lista.`);
  button.title = state.detail;

  if (state.compactLabel !== currentText) {
    label.textContent = state.compactLabel;
    presenceObservedText = state.compactLabel;
    presenceObservedAt = now;
  }

  if (state.state === "error" || state.state === "offline") {
    setPresenceMessage(state.detail);
  }
}

function startPresenceWatchdog() {
  if (presenceTimer) window.clearInterval(presenceTimer);
  updatePresenceUi();
  presenceTimer = window.setInterval(() => {
    if (document.visibilityState === "visible") updatePresenceUi();
  }, PRESENCE_WATCHDOG_MS);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") updatePresenceUi();
  });
  window.addEventListener("offline", updatePresenceUi);
  window.addEventListener("online", () => {
    presenceObservedText = "";
    presenceObservedAt = Date.now();
    const label = document.getElementById("onlinePresenceLabel");
    if (label?.textContent === "Offline") label.textContent = "Sincronizando";
    updatePresenceUi();
  });
}

function updateSectionCopy(root, titleBefore, titleAfter, description) {
  const heading = [...root.querySelectorAll(".section-title-row h4")].find(
    (item) => text(item.textContent) === titleBefore,
  );
  if (!heading) return;
  heading.textContent = titleAfter;
  const paragraph = heading.parentElement?.querySelector("p");
  if (paragraph && description) paragraph.textContent = description;
}

function refineConfigurationCopy() {
  const root = document.getElementById("page-config");
  if (!root) return;

  const eyebrow = root.querySelector(".config-workspace-eyebrow");
  const heading = root.querySelector(".config-workspace-heading h2");
  const description = root.querySelector(".config-workspace-heading p");
  const search = document.getElementById("configWorkspaceSearch");
  const accessTitle = document.querySelector("#accessRequestsAdminCard > h3");

  if (eyebrow) eyebrow.textContent = "Administração";
  if (heading) heading.textContent = "Ajustes do sistema";
  if (description) {
    description.textContent =
      "Gerencie acessos, identidade visual, painéis e parâmetros técnicos em um único lugar.";
  }
  if (search) search.setAttribute("placeholder", "Buscar configuração...");
  if (accessTitle) accessTitle.textContent = "Acessos e permissões";

  updateSectionCopy(
    root,
    "Solicitações pendentes",
    "Solicitações pendentes",
    "Aprove ou recuse novos pedidos de acesso.",
  );
  updateSectionCopy(
    root,
    "Usuários ativos",
    "Usuários com acesso",
    "Ajuste perfil, permissões e painéis sem apagar o histórico.",
  );
}

function scheduleConfigurationRefinement() {
  [0, 250, 900].forEach((delay) =>
    window.setTimeout(refineConfigurationCopy, delay),
  );
}

function installNavigationRefinement() {
  const originalNavigate = window.navigate;
  if (
    typeof originalNavigate !== "function" ||
    originalNavigate.__nielsenUxWrapped
  ) {
    return;
  }

  const wrappedNavigate = (...args) => {
    const result = originalNavigate(...args);
    if (String(args[0] || "") === "config") scheduleConfigurationRefinement();
    return result;
  };
  wrappedNavigate.__nielsenUxWrapped = true;
  wrappedNavigate.__original = originalNavigate;
  window.navigate = wrappedNavigate;
}

export function initNielsenShellUx() {
  if (initialized) return;
  initialized = true;

  removeLegacyAccountActions();
  installThemeSync();
  installLogoutFlow();
  startPresenceWatchdog();
  installNavigationRefinement();
  scheduleConfigurationRefinement();

  window.addEventListener(
    "agsus:config-saved",
    scheduleConfigurationRefinement,
  );
}
