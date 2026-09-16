const hostObservers = new WeakMap();
const activeAnimations = new WeakMap();

const MIN_DURATION_MS = 650;
const MAX_DURATION_MS = 3400;
const MS_PER_CHARACTER = 18;

export function araraSpeechDuration(text) {
  const length = String(text || "").trim().length;
  if (!length) return 0;
  return Math.min(
    MAX_DURATION_MS,
    Math.max(MIN_DURATION_MS, length * MS_PER_CHARACTER),
  );
}

export function shouldAnimateAraraSpeech({
  text = "",
  reducedMotion = false,
}) {
  return Boolean(String(text).trim()) && !reducedMotion;
}

function prefersReducedMotion(win) {
  try {
    return Boolean(win.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  } catch {
    return false;
  }
}

function cancelActiveAnimation(root, reveal = true) {
  const active = activeAnimations.get(root);
  if (!active) return;

  active.win.cancelAnimationFrame?.(active.frameId);
  if (reveal && active.body?.isConnected) {
    active.body.textContent = active.fullText;
  }
  active.body?.classList.remove("arara-message__body--typing");
  active.status?.remove();
  root.classList.remove("is-speaking");
  root.removeAttribute("aria-busy");
  activeAnimations.delete(root);
}

function animateAssistantBody(root, body) {
  if (body.dataset.araraSpeechEnhanced === "1") return;

  const fullText = String(body.textContent || "").trim();
  body.dataset.araraSpeechEnhanced = "1";
  const win = body.ownerDocument.defaultView || window;

  if (
    !shouldAnimateAraraSpeech({
      text: fullText,
      reducedMotion: prefersReducedMotion(win),
    })
  ) {
    return;
  }

  cancelActiveAnimation(root);

  const message = body.closest(".arara-message--assistant");
  if (!message) return;

  const status = body.ownerDocument.createElement("span");
  status.className = "arara-speaking-status";
  status.setAttribute("aria-hidden", "true");
  status.textContent = "Arara está respondendo";
  message.insertBefore(status, body);

  body.textContent = "";
  body.classList.add("arara-message__body--typing");
  body.setAttribute("aria-label", fullText);
  root.classList.add("is-speaking");
  root.setAttribute("aria-busy", "true");

  const duration = araraSpeechDuration(fullText);
  const startedAt = win.performance?.now?.() ?? Date.now();
  const animation = {
    body,
    fullText,
    frameId: 0,
    status,
    win,
  };
  activeAnimations.set(root, animation);

  const render = (timestamp) => {
    if (activeAnimations.get(root) !== animation) return;

    const now = Number.isFinite(timestamp)
      ? timestamp
      : (win.performance?.now?.() ?? Date.now());
    const progress = Math.min(1, Math.max(0, (now - startedAt) / duration));
    const visibleCharacters = Math.max(
      1,
      Math.min(fullText.length, Math.ceil(fullText.length * progress)),
    );
    body.textContent = fullText.slice(0, visibleCharacters);

    if (progress < 1) {
      animation.frameId = win.requestAnimationFrame(render);
      return;
    }

    body.textContent = fullText;
    body.classList.remove("arara-message__body--typing");
    status.remove();
    root.classList.remove("is-speaking");
    root.removeAttribute("aria-busy");
    activeAnimations.delete(root);
  };

  animation.frameId = win.requestAnimationFrame(render);
}

function processAssistantMessages(host) {
  host
    .querySelectorAll(
      "[data-arara-guide] .arara-message--assistant .arara-message__body",
    )
    .forEach((body) => {
      const root = body.closest("[data-arara-guide]");
      if (root) animateAssistantBody(root, body);
    });
}

function observeHost(host) {
  if (!host || hostObservers.has(host)) return;

  const win = host.ownerDocument.defaultView || window;
  const Observer = win.MutationObserver;
  if (!Observer) return;

  const observer = new Observer(() => processAssistantMessages(host));
  observer.observe(host, { childList: true, subtree: true });
  hostObservers.set(host, observer);
  processAssistantMessages(host);
}

export function initAraraSpeakingEffects(doc = document) {
  observeHost(doc.getElementById("araraGuideHost"));
}
