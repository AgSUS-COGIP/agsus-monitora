const PANEL_POSITION_STORAGE_KEY = "agsus_monitora_nina_panel_position_v1";

const INTERACTIVE_SELECTOR =
  'button, input, textarea, select, a, [contenteditable="true"], .arara-assistant__messages';
const OPEN_DRAG_SELECTOR =
  "[data-nina-drag-handle], .arara-assistant__panel";
const LAUNCHER_SELECTOR = ".arara-assistant__launcher";
const DRAG_THRESHOLD_PX = 4;

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

function keepInsideViewport(win, host, persist = true) {
  if (!host) return;
  const rect = host.getBoundingClientRect();
  const position = clampPosition(win, host, rect.left, rect.top);
  applyPosition(win, host, position);
  if (persist) writePosition(win, position);
}

function resolveDragTarget(event, doc) {
  const target = event.target;
  if (!(target instanceof doc.defaultView.Element)) return null;

  const launcher = target.closest(LAUNCHER_SELECTOR);
  if (launcher) {
    return { handle: launcher, launcher: true };
  }

  if (target.closest(INTERACTIVE_SELECTOR)) return null;

  const handle = target.closest(OPEN_DRAG_SELECTOR);
  if (!handle) return null;
  return { handle, launcher: false };
}

export function initNinaPanelDrag(doc = document) {
  const win = doc.defaultView || window;
  let drag = null;
  let suppressLauncherClickUntil = 0;

  const initialHost = doc.getElementById("araraGuideHost");
  if (initialHost) applyPosition(win, initialHost, readPosition(win));

  doc.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;

    const dragTarget = resolveDragTarget(event, doc);
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
    keepInsideViewport(win, drag.host, true);

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
      const host = doc.getElementById("araraGuideHost");
      keepInsideViewport(win, host, true);
    });
  });

  win.addEventListener("resize", () => {
    const host = doc.getElementById("araraGuideHost");
    if (!host || host.style.left === "") return;
    keepInsideViewport(win, host, true);
  });
}

export { PANEL_POSITION_STORAGE_KEY };
