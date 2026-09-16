const PANEL_POSITION_STORAGE_KEY = "agsus_monitora_nina_panel_position_v1";

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
    win.localStorage.setItem(PANEL_POSITION_STORAGE_KEY, JSON.stringify(position));
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

export function initNinaPanelDrag(doc = document) {
  const win = doc.defaultView || window;
  let drag = null;

  const initialHost = doc.getElementById("araraGuideHost");
  if (initialHost) applyPosition(win, initialHost, readPosition(win));

  doc.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest?.("[data-nina-drag-handle]");
    if (!handle || event.button !== 0) return;

    const host = handle.closest("#araraGuideHost") || doc.getElementById("araraGuideHost");
    const root = handle.closest("[data-arara-guide]");
    if (!host || !root || root.classList.contains("is-hidden")) return;

    const rect = host.getBoundingClientRect();
    drag = {
      host,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: rect.left,
      startTop: rect.top,
    };
    handle.setPointerCapture?.(event.pointerId);
    root.classList.add("is-panel-dragging");
    event.preventDefault();
  });

  doc.addEventListener("pointermove", (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const position = clampPosition(
      win,
      drag.host,
      drag.startLeft + event.clientX - drag.startX,
      drag.startTop + event.clientY - drag.startY,
    );
    applyPosition(win, drag.host, position);
    event.preventDefault();
  });

  const finish = (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const root = drag.host.querySelector("[data-arara-guide]");
    root?.classList.remove("is-panel-dragging");
    const rect = drag.host.getBoundingClientRect();
    const position = clampPosition(win, drag.host, rect.left, rect.top);
    applyPosition(win, drag.host, position);
    writePosition(win, position);
    drag = null;
  };

  doc.addEventListener("pointerup", finish);
  doc.addEventListener("pointercancel", finish);

  win.addEventListener("resize", () => {
    const host = doc.getElementById("araraGuideHost");
    if (!host || host.style.left === "") return;
    const rect = host.getBoundingClientRect();
    const position = clampPosition(win, host, rect.left, rect.top);
    applyPosition(win, host, position);
    writePosition(win, position);
  });
}

export { PANEL_POSITION_STORAGE_KEY };