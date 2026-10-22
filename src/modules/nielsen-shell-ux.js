import { estadoDasConfiguracoes } from "../modulos/configuracoes/estado.js";
import { sessaoDoApp } from "../app/sessao.js";

let initialized = false;
let logoutConfirmationResolver = null;
let logoutPreviousFocus = null;
let logoutAction = null;
let logoutRunning = false;

/*
  Tema: o seletor Claro/Escuro mora no rodapé da barra lateral, junto do Sair
  (`src/componentes/barra-lateral/rodape.tsx`). É o único controle de tema — o
  botão que ficava no cabeçalho saiu. Daqui saem o estado e a regra que o
  rodapé usa; o tema em si (aplicar, alternar, outra aba) é de src/app/moldura.js.
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

/* Alterações não salvas vêm do estado das Configurações (React), o mesmo que o navigate consulta. */
export function hasUnsavedConfiguration(estado = estadoDasConfiguracoes) {
  return Boolean(estado?.temAlteracoes?.());
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
  if (typeof window.monitoraToast === "function") {
    window.monitoraToast(message, "error");
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

  // Quem sai é a sessão do app (src/app/sessao.js), depois da confirmação.
  logoutAction = () => sessaoDoApp.sair();
}

export function initNielsenShellUx() {
  if (initialized) return;
  initialized = true;

  installLogoutFlow();
}
