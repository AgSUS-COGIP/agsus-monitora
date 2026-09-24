const PANEL_POSITION_STORAGE_KEY = "agsus_monitora_nina_panel_position_v1";

const INTERACTIVE_SELECTOR =
  'button, input, textarea, select, a, [contenteditable="true"], .arara-assistant__messages';
const OPEN_DRAG_SELECTOR = "[data-nina-drag-handle], .arara-assistant__panel";
const LAUNCHER_SELECTOR = ".arara-assistant__launcher";
const DRAG_THRESHOLD_PX = 4;
// Mesma chave de `ARARA_VISIBILITY_STORAGE_KEY` em arara-guide.js.
const ARARA_OCULTA_STORAGE_KEY = "agsus_monitora_arara_oculta_v1";

function readPosition(win) {
  try {
    const parsed = JSON.parse(
      win.localStorage.getItem(PANEL_POSITION_STORAGE_KEY) || "null",
    );
    if (parsed && Number.isFinite(parsed.left) && Number.isFinite(parsed.top)) {
      return parsed;
    }
  } catch {
    // Mantém a posição padrão quando o armazenamento local não está disponível.
  }
  return null;
}

function writePosition(win, position) {
  try {
    win.localStorage.setItem(
      PANEL_POSITION_STORAGE_KEY,
      JSON.stringify(position),
    );
  } catch {
    // O movimento continua funcionando mesmo sem persistência local.
  }
}

function clampPosition(win, host, left, top) {
  const rect = host.getBoundingClientRect();
  const margin = 8;
  const maxLeft = Math.max(margin, win.innerWidth - rect.width - margin);
  const maxTop = Math.max(margin, win.innerHeight - rect.height - margin);
  return {
    left: Math.min(Math.max(margin, left), maxLeft),
    top: Math.min(Math.max(margin, top), maxTop),
  };
}

function applyPosition(win, host, position) {
  if (!position) return;
  const safe = clampPosition(win, host, position.left, position.top);
  host.style.left = `${safe.left}px`;
  host.style.top = `${safe.top}px`;
  host.style.right = "auto";
  host.style.bottom = "auto";
}

/*
  Minimizada, a Aya volta para o canto inferior direito.

  A posição salva é a do chat aberto, arrastado com 580px de largura. Aplicada
  à arara minimizada, ela ia para a ponta direita dessa caixa invisível — com o
  chat arrastado para a esquerda, isso é o meio da tela, em cima do conteúdo de
  todas as páginas. A posição continua guardada e volta quando o chat abre.
*/
function estaMinimizada(win, host) {
  const root = host?.querySelector("[data-arara-guide]");
  if (root) return root.classList.contains("is-hidden");
  try {
    return win.localStorage.getItem(ARARA_OCULTA_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function ancorarNoCanto(host) {
  host.style.left = "";
  host.style.top = "";
  host.style.right = "";
  host.style.bottom = "";
}

function posicionarConformeEstado(win, host) {
  if (!host) return;
  if (estaMinimizada(win, host)) ancorarNoCanto(host);
  else applyPosition(win, host, readPosition(win));
}

function keepInsideViewport(win, host, persist = true) {
  if (!host) return;
  const rect = host.getBoundingClientRect();
  const position = clampPosition(win, host, rect.left, rect.top);
  applyPosition(win, host, position);
  if (persist) writePosition(win, position);
}

function resolveDragTarget(event, win) {
  const target = event.target;
  if (!(target instanceof win.Element)) return null;

  const launcher = target.closest(LAUNCHER_SELECTOR);
  if (launcher) return { handle: launcher, launcher: true };

  if (target.closest(INTERACTIVE_SELECTOR)) return null;

  const handle = target.closest(OPEN_DRAG_SELECTOR);
  if (!handle) return null;
  return { handle, launcher: false };
}

export function initNinaPanelDrag(doc = document) {
  const win = doc.defaultView || window;
  let drag = null;
  let suppressLauncherClickUntil = 0;

  posicionarConformeEstado(win, doc.getElementById("araraGuideHost"));

  doc.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;

    const dragTarget = resolveDragTarget(event, win);
    if (!dragTarget) return;

    const host =
      dragTarget.handle.closest("#araraGuideHost") ||
      doc.getElementById("araraGuideHost");
    const root =
      dragTarget.handle.closest("[data-arara-guide]") ||
      host?.querySelector("[data-arara-guide]");
    if (!host || !root) return;
    if (root.classList.contains("is-hidden") && !dragTarget.launcher) return;

    const rect = host.getBoundingClientRect();
    drag = {
      host,
      root,
      handle: dragTarget.handle,
      launcher: dragTarget.launcher,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: rect.left,
      startTop: rect.top,
      moved: false,
    };
    dragTarget.handle.setPointerCapture?.(event.pointerId);
    root.classList.add("is-panel-dragging");
    event.preventDefault();
  });

  doc.addEventListener("pointermove", (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.hypot(deltaX, deltaY) >= DRAG_THRESHOLD_PX) {
      drag.moved = true;
    }

    const position = clampPosition(
      win,
      drag.host,
      drag.startLeft + deltaX,
      drag.startTop + deltaY,
    );
    applyPosition(win, drag.host, position);
    event.preventDefault();
  });

  const finish = (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;

    drag.root.classList.remove("is-panel-dragging");
    drag.handle.releasePointerCapture?.(event.pointerId);
    // Arrastar a arara minimizada move só por agora; o que se guarda é o chat.
    keepInsideViewport(win, drag.host, !estaMinimizada(win, drag.host));

    if (drag.launcher && drag.moved) {
      suppressLauncherClickUntil = Date.now() + 500;
    }
    drag = null;
  };

  doc.addEventListener("pointerup", finish);
  doc.addEventListener("pointercancel", finish);

  doc.addEventListener(
    "click",
    (event) => {
      if (Date.now() > suppressLauncherClickUntil) return;
      if (!event.target.closest?.(LAUNCHER_SELECTOR)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );

  doc.addEventListener("click", (event) => {
    if (
      !event.target.closest?.(
        ".arara-assistant__launcher, .arara-assistant__hide",
      )
    ) {
      return;
    }

    win.requestAnimationFrame(() => {
      posicionarConformeEstado(win, doc.getElementById("araraGuideHost"));
    });
  });

  win.addEventListener("resize", () => {
    const host = doc.getElementById("araraGuideHost");
    if (!host || host.style.left === "") return;
    keepInsideViewport(win, host, !estaMinimizada(win, host));
  });
}

export { PANEL_POSITION_STORAGE_KEY };
