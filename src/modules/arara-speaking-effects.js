const hostObservers = new WeakMap();
const activeAnimations = new WeakMap();

const MIN_DURATION_MS = 650;
const MAX_DURATION_MS = 3400;
const MS_PER_CHARACTER = 18;

const OPENING_MESSAGES = Object.freeze({
  dashboard:
    "Olá! Você está em Saúde Indígena. Posso te ajudar a entender o mapa, os filtros ou os indicadores. O que você quer ver primeiro?",
  nucleo:
    "Olá! Você está em Equipe Núcleo. Posso te ajudar a localizar um processo, entender o cronograma ou orientar uma edição. Por onde começamos?",
  config:
    "Olá! Você está em Configurações. Posso explicar os acessos, os ajustes disponíveis ou como salvar uma mudança com segurança. O que você precisa fazer?",
  analises:
    "Olá! Você está em Análises. Posso te ajudar com os filtros, o gráfico ou a fila operacional. O que você quer entender primeiro?",
});

export function araraSpeechDuration(text) {
  const length = String(text || "").trim().length;
  if (!length) return 0;
  return Math.min(
    MAX_DURATION_MS,
    Math.max(MIN_DURATION_MS, length * MS_PER_CHARACTER),
  );
}

export function shouldAnimateAraraSpeech({ text = "", reducedMotion = false }) {
  return Boolean(String(text).trim()) && !reducedMotion;
}

export function araraOpeningMessage(section, title = "") {
  if (section === "analises" || /an[aá]lises/i.test(title)) {
    return OPENING_MESSAGES.analises;
  }
  if (OPENING_MESSAGES[section]) return OPENING_MESSAGES[section];

  const sectionName = String(title || "esta seção").trim() || "esta seção";
  return `Olá! Você está em ${sectionName}. Posso explicar os recursos desta tela e te orientar no próximo passo. O que você quer fazer?`;
}

function prefersReducedMotion(win) {
  try {
    return Boolean(
      win.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    );
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

function isOpeningMessage(root, body) {
  const message = body.closest(".arara-message--assistant");
  const messages = message?.parentElement;
  if (!message || !messages) return false;

  return (
    messages.querySelector(".arara-message--assistant") === message &&
    !messages.querySelector(".arara-message--user")
  );
}

function assistantText(root, body) {
  if (isOpeningMessage(root, body)) {
    const section = root.dataset.section || "";
    const title =
      root.querySelector(".arara-assistant__section")?.textContent || "";
    return araraOpeningMessage(section, title);
  }
  return String(body.textContent || "").trim();
}

function animateAssistantBody(root, body) {
  if (body.dataset.araraSpeechEnhanced === "1") return;

  const fullText = assistantText(root, body);
  body.textContent = fullText;
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
  status.textContent = "Arara está falando";
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
