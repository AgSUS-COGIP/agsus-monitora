const hostObservers = new WeakMap();
const activeAnimations = new WeakMap();
const conversationMemory = new WeakMap();

const ASSISTANT_NAME = "Nina";
const MIN_DURATION_MS = 650;
const MAX_DURATION_MS = 3400;
const MS_PER_CHARACTER = 18;

const OPENING_MESSAGES = Object.freeze({
  dashboard:
    "Olá! Eu sou a Nina. Você está em Saúde Indígena. Posso te ajudar a entender o mapa, os filtros ou os indicadores. O que você quer ver primeiro?",
  nucleo:
    "Olá! Eu sou a Nina. Você está em Equipe Núcleo. Posso te ajudar a localizar um processo, entender o cronograma ou orientar uma edição. Por onde começamos?",
  config:
    "Olá! Eu sou a Nina. Você está em Configurações. Posso explicar os acessos, os ajustes disponíveis ou como salvar uma mudança com segurança. O que você precisa fazer?",
  analises:
    "Olá! Eu sou a Nina. Você está em Análises. Posso te ajudar com os filtros, o gráfico ou a fila operacional. O que você quer entender primeiro?",
});

const TOPIC_PATTERNS = Object.freeze({
  mapa: /\b(mapa|dsei|territ[oó]rio|satelite|satélite|zoom)\b/i,
  filtros: /\b(filtro|filtrar|uf|edital|etapa|status|risco|per[ií]odo)\b/i,
  indicadores: /\b(indicador|kpi|vaga|ociosa|contrata|inscrito|cr[ií]tico)\b/i,
  processo: /\b(processo|edital|buscar|pesquisar|localizar)\b/i,
  cronograma: /\b(cronograma|prazo|data|etapa)\b/i,
  edicao: /\b(editar|salvar|altera|permiss[aã]o|perfil)\b/i,
  acessos: /\b(acesso|usu[aá]rio|perfil|permiss[aã]o|painel)\b/i,
  configuracao: /\b(configura|ajuste|identidade|texto|par[aâ]metro)\b/i,
  fila: /\b(fila|candidato|registro|detalhe)\b/i,
  grafico: /\b(gr[aá]fico|linha|evolu[cç][aã]o|tempo|volume)\b/i,
});

const FOLLOW_UP_PATTERN =
  /^(e\s+(agora|depois|aqui|isso|esse|essa)|como assim|por que|porque|qual deles|qual delas|me explica melhor|e se|entendi|certo)[?!.\s]*$/i;

const CONTINUATIONS = Object.freeze({
  dashboard: {
    mapa:
      "No mapa, o próximo passo é escolher um DSEI. Depois disso, use o detalhamento para ver polos e unidades. Se quiser comparar territórios, volte à visão Brasil antes de selecionar outro DSEI.",
    filtros:
      "Depois de ajustar os filtros, confira os indicadores antes de abrir o mapa. Assim você confirma se o recorte realmente mudou e evita comparar números de contextos diferentes.",
    indicadores:
      "Use o indicador como sinal de onde olhar, não como conclusão isolada. Se algum número chamar atenção, confira os filtros ativos e depois abra o território ou a lista relacionada para entender o detalhe.",
  },
  nucleo: {
    processo:
      "Depois de localizar o processo, abra o registro e confira etapa, cronograma e situação antes de editar qualquer campo.",
    cronograma:
      "No cronograma, compare primeiro a sequência das etapas e as datas. Se precisar editar, confirme que está no processo correto antes de salvar.",
    edicao:
      "Se a edição estiver disponível para o seu perfil, altere apenas o campo necessário, revise o registro e salve uma vez. Depois confira a confirmação do sistema.",
  },
  config: {
    acessos:
      "Antes de mudar um acesso, confirme a pessoa, o perfil atual e os painéis envolvidos. Depois da alteração, valide se o resultado corresponde exatamente ao que você pretendia.",
    configuracao:
      "Faça uma alteração por vez. Isso facilita conferir o efeito da mudança e evita misturar ajustes diferentes na mesma validação.",
    edicao:
      "Antes de salvar, releia o valor atual e o novo valor. Depois do salvamento, confira a mensagem do sistema e valide a área afetada.",
  },
  analises: {
    filtros:
      "Depois de aplicar os filtros, confira o contador de registros e a data de atualização. Só então compare o gráfico ou a fila operacional.",
    fila:
      "Na fila, use a busca para localizar o registro e abra Detalhes quando precisar conferir todas as informações. O status da linha deve ser lido dentro do recorte dos filtros ativos.",
    grafico:
      "Se aparecer um pico ou uma queda no gráfico, confirme o período e os filtros e depois consulte os registros daquele trecho na fila operacional.",
  },
});

export function araraAssistantName() {
  return ASSISTANT_NAME;
}

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
  return `Olá! Eu sou a ${ASSISTANT_NAME}. Você está em ${sectionName}. Posso explicar os recursos desta tela e te orientar no próximo passo. O que você quer fazer?`;
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

function normalizeSection(root) {
  const section = root.dataset.section || "";
  const title = root.querySelector(".arara-assistant__section")?.textContent || "";
  if (section === "analises" || /an[aá]lises/i.test(title)) return "analises";
  return section;
}

function detectTopic(text) {
  const value = String(text || "").trim();
  return (
    Object.entries(TOPIC_PATTERNS).find(([, pattern]) => pattern.test(value))?.[0] ||
    ""
  );
}

function conversationContext(root) {
  let memory = conversationMemory.get(root);
  if (!memory) {
    memory = { lastTopic: "" };
    conversationMemory.set(root, memory);
  }
  return memory;
}

function latestUserText(root) {
  const users = root.querySelectorAll(
    ".arara-message--user .arara-message__body",
  );
  return users[users.length - 1]?.textContent?.trim() || "";
}

function contextualContinuation(root) {
  const question = latestUserText(root);
  if (!question) return "";

  const memory = conversationContext(root);
  const explicitTopic = detectTopic(question);
  if (explicitTopic) {
    memory.lastTopic = explicitTopic;
    return "";
  }

  if (!memory.lastTopic || !FOLLOW_UP_PATTERN.test(question)) return "";

  const section = normalizeSection(root);
  return CONTINUATIONS[section]?.[memory.lastTopic] || "";
}

function removeFixedTutorial(root) {
  root.querySelector(".arara-stepper")?.remove();
}

function updateAssistantIdentity(root) {
  root.setAttribute("aria-label", `Assistente ${ASSISTANT_NAME}`);

  const title = root.querySelector(".arara-assistant__title");
  if (title) title.textContent = ASSISTANT_NAME;

  root
    .querySelectorAll(".arara-message--assistant .arara-message__author")
    .forEach((author) => {
      author.textContent = ASSISTANT_NAME;
    });

  const suggestionLabel = root.querySelector(
    ".arara-assistant__suggestion-label",
  );
  if (suggestionLabel) {
    suggestionLabel.textContent = `Pergunte para a ${ASSISTANT_NAME}`;
  }

  const hideButton = root.querySelector(".arara-assistant__hide");
  if (hideButton) {
    hideButton.textContent = `Ocultar ${ASSISTANT_NAME}`;
    hideButton.setAttribute("aria-label", `Ocultar ${ASSISTANT_NAME}`);
  }

  const launcher = root.querySelector("[data-arara-show]");
  if (launcher) {
    launcher.setAttribute("aria-label", `Mostrar ${ASSISTANT_NAME}`);
    const launcherLabel = launcher.querySelector("span");
    if (launcherLabel) launcherLabel.textContent = `Mostrar ${ASSISTANT_NAME}`;
  }

  const inputLabel = root.querySelector('label[for="araraAssistantInput"]');
  if (inputLabel) inputLabel.textContent = `Pergunta para a ${ASSISTANT_NAME}`;
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

  const continuation = contextualContinuation(root);
  if (continuation) return continuation;
  return String(body.textContent || "").trim();
}

function animateAssistantBody(root, body) {
  if (body.dataset.araraSpeechEnhanced === "1") return;

  removeFixedTutorial(root);
  updateAssistantIdentity(root);
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
  status.textContent = `${ASSISTANT_NAME} está falando`;
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
  host.querySelectorAll("[data-arara-guide]").forEach((root) => {
    removeFixedTutorial(root);
    updateAssistantIdentity(root);
  });
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
