import { askAyaAi, shouldAskAyaAi } from "./aya-ai-client.js";
import {
  esquecerConversa,
  lerConversa,
  salvarConversa,
} from "./aya-memoria.js";

const ARARA_VISIBILITY_STORAGE_KEY = "agsus_monitora_arara_oculta_v1";

const GLOBAL_TOPICS = Object.freeze([
  {
    label: "O que você consegue fazer?",
    keywords: ["o que voce faz", "o que consegue", "ajuda", "pode fazer"],
    answer:
      "Eu explico a seção atual, os controles da tela e o caminho mais seguro para concluir uma tarefa. Também consigo interpretar o que já está visível no MONITORA e explicar conceitos institucionais de saúde indígena quando tenho uma fonte oficial segura.",
  },
  {
    label: "Você consulta meus dados?",
    keywords: ["dados", "privacidade", "registro", "consulta", "informacao"],
    answer:
      "Eu uso somente o que já está disponível para você no MONITORA e não amplio seu acesso. Quando uma resposta exigir dado que não esteja carregado, eu digo isso em vez de inventar.",
  },
  {
    label: "Você pode alterar algo por mim?",
    keywords: ["alterar", "editar", "salvar", "apagar", "excluir"],
    answer:
      "Eu posso orientar a ação, mas a confirmação e qualquer alteração continuam sob seu controle.",
  },
]);

const GUIDES = Object.freeze({
  dashboard: {
    title: "Saúde Indígena",
    intro:
      "Olá! Eu sou a Aya, assistente do MONITORA. Estou com você na Saúde Indígena e posso conversar sobre editais, DSEIs, CASAIs, mapa, filtros, indicadores e territórios. O que você quer saber?",
    topics: [
      {
        label: "Mapa",
        keywords: [
          "mapa",
          "dsei",
          "territorio",
          "zoom",
          "satélite",
          "satelite",
        ],
        answer:
          "Na visão nacional, selecione um DSEI para aprofundar o território. O fundo Mapa/Satélite muda apenas a cartografia; o recorte de dados continua definido pelos filtros e pelo território selecionado.",
      },
      {
        label: "Filtros",
        keywords: ["filtro", "filtrar", "uf", "edital", "status", "risco"],
        answer:
          "Os filtros refinam os indicadores da página. Antes de comparar números, confira Unidade, Edital, Etapa, Status, Risco e UF para garantir que o recorte está correto.",
      },
      {
        label: "Indicadores",
        keywords: [
          "indicador",
          "kpi",
          "vagas",
          "ociosas",
          "contratados",
          "criticos",
        ],
        answer:
          "Os indicadores resumem o recorte atual. Use-os como sinal de onde investigar e confirme o detalhe na lista ou no território antes de tirar uma conclusão.",
      },
    ],
  },
  nucleo: {
    title: "Editais",
    intro:
      "Olá! Eu sou a Aya, assistente do MONITORA. Estou com você em Editais e posso ajudar a localizar processos seletivos, entender etapas, cronogramas e ações disponíveis. O que você quer saber?",
    topics: [
      {
        label: "Processos",
        keywords: ["localizar", "buscar", "pesquisar", "processo", "edital"],
        answer:
          "Use a busca de Editais para localizar por edital, unidade ou situação. Depois abra o registro correspondente para conferir cronograma e informações operacionais.",
      },
      {
        label: "Cronograma",
        keywords: ["cronograma", "etapa", "prazo", "data"],
        answer:
          "O cronograma apresenta as etapas e datas do processo. Antes de editar, confirme o processo selecionado e os dados já salvos.",
      },
    ],
  },
  config: {
    title: "Configurações",
    intro:
      "Olá! Eu sou a Aya, assistente do MONITORA. Nesta área posso explicar acessos, identidade visual e ajustes administrativos disponíveis para o seu perfil. O que você quer fazer?",
    topics: [
      {
        label: "Acessos",
        keywords: [
          "acesso",
          "usuario",
          "usuário",
          "permissao",
          "permissão",
          "painel",
        ],
        answer:
          "Os acessos seguem o perfil do usuário. Antes de aprovar ou alterar algo, confirme a pessoa, o perfil atual e o impacto esperado.",
      },
      {
        label: "Salvar",
        keywords: ["salvar", "seguranca", "segurança", "confirmar"],
        answer:
          "Faça uma alteração por vez, releia o valor e salve uma única vez. Depois confira a confirmação do sistema antes de seguir para outra mudança.",
      },
    ],
  },
  analises: {
    title: "Análises",
    intro:
      "Olá! Eu sou a Aya, assistente do MONITORA. Estou com você em análises curriculares e posso ajudar com filtros, gráfico, fila operacional e leitura do recorte atual. O que você quer entender?",
    topics: [
      {
        label: "Fila",
        keywords: ["fila", "candidato", "status", "detalhes", "registro"],
        answer:
          "Na fila operacional, use a busca para localizar um registro e abra Detalhes quando precisar conferir as informações completas. Interprete o status sempre dentro dos filtros ativos.",
      },
      {
        label: "Gráfico",
        keywords: [
          "grafico",
          "gráfico",
          "linha",
          "tempo",
          "evolucao",
          "evolução",
        ],
        answer:
          "O gráfico mostra a evolução do volume no recorte atual. Se houver pico ou queda, confirme o período e depois consulte os registros daquele trecho.",
      },
    ],
  },
});

const QUICK_SUGGESTIONS = Object.freeze({
  dashboard: Object.freeze([
    "Como uso o mapa?",
    "Quais DSEIs aparecem aqui?",
    "Explique os filtros ativos",
  ]),
  nucleo: Object.freeze([
    "Quais editais aparecem aqui?",
    "Explique o cronograma",
    "Como localizo um processo?",
  ]),
  config: Object.freeze([
    "Explique os acessos",
    "O que posso alterar aqui?",
    "Como salvar com segurança?",
  ]),
  analises: Object.freeze([
    "Como encontro um registro na fila?",
    "Explique os filtros ativos",
    "Como leio este gráfico?",
  ]),
  generic: Object.freeze([
    "O que você consegue fazer?",
    "Explique esta tela",
    "Como começo?",
  ]),
});

const PROVIDER_LABELS = Object.freeze({
  "curated-official": "Fonte oficial",
  "monitora-local-context": "Dados desta tela",
  "ollama-local": "IA local",
  "recusa-por-numero-sem-lastro": "Validação de segurança",
  "orientacao-local": "Orientação do MONITORA",
  "local-fallback": "Apoio local",
});

const assistantState = new WeakMap();

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function genericGuide(title) {
  const sectionTitle = title || "esta seção";
  return {
    title: sectionTitle,
    intro: `Olá! Eu sou a Aya, assistente do MONITORA. Estou com você em ${sectionTitle} e posso explicar o que estiver disponível nesta tela. O que você quer saber?`,
    topics: [
      {
        label: "Ajuda",
        keywords: ["como usar", "secao", "seção", "painel", "ajuda"],
        answer:
          "Posso explicar os controles visíveis desta seção e orientar o próximo passo sem ampliar seu acesso ou inventar dados.",
      },
    ],
  };
}

export function guideForSection(section, title = "") {
  if (section.startsWith("panel:") && /an[aá]lises/i.test(title)) {
    return GUIDES.analises;
  }
  return GUIDES[section] || genericGuide(title);
}

function quickSuggestionsForSection(section, title = "") {
  if (section.startsWith("panel:") && /an[aá]lises/i.test(title)) {
    return QUICK_SUGGESTIONS.analises;
  }
  return QUICK_SUGGESTIONS[section] || QUICK_SUGGESTIONS.generic;
}

function scoreTopic(question, topic) {
  const normalized = normalizeText(question);
  const label = normalizeText(topic.label);
  let score = normalized === label ? 10 : 0;
  for (const keyword of topic.keywords || []) {
    const normalizedKeyword = normalizeText(keyword);
    if (normalizedKeyword && normalized.includes(normalizedKeyword)) {
      score += normalizedKeyword.includes(" ") ? 4 : 2;
    }
  }
  return score;
}

function localAraraAnswer(section, title, question) {
  const content = guideForSection(section, title);
  const normalized = normalizeText(question);
  if (!normalized) {
    return { answer: "Escreva sua pergunta para a Aya.", matched: true };
  }

  const topics = [...content.topics, ...GLOBAL_TOPICS];
  const best = topics
    .map((topic) => ({ topic, score: scoreTopic(question, topic) }))
    .sort((a, b) => b.score - a.score)[0];

  if (best?.score > 0) return { answer: best.topic.answer, matched: true };

  return {
    answer: `Posso conversar com você sobre ${content.title}. Quando a resposta depender de um dado específico, eu uso apenas o que estiver disponível no MONITORA ou uma referência institucional segura.`,
    matched: false,
  };
}

export function answerAraraQuestion(section, title, question) {
  return localAraraAnswer(section, title, question).answer;
}

function readHiddenPreference(win) {
  try {
    return win.localStorage.getItem(ARARA_VISIBILITY_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeHiddenPreference(win, hidden) {
  try {
    win.localStorage.setItem(ARARA_VISIBILITY_STORAGE_KEY, hidden ? "1" : "0");
  } catch {
    // Mantém a assistente funcional mesmo sem armazenamento local.
  }
}

function element(doc, tag, className, text = "") {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function providerLabel(provider) {
  return PROVIDER_LABELS[String(provider || "")] || "";
}

function appendMessage(state, role, text, options = {}) {
  const message = element(
    state.doc,
    "div",
    `arara-message arara-message--${role}`,
  );
  const author = element(
    state.doc,
    "strong",
    "arara-message__author",
    role === "user" ? "Você" : "Aya",
  );
  const body = element(state.doc, "p", "arara-message__body", text);
  message.append(author, body);

  const origin = role === "assistant" ? providerLabel(options.provider) : "";
  if (origin) {
    const meta = element(state.doc, "div", "arara-message__meta");
    meta.append(element(state.doc, "span", "arara-message__origin", origin));
    message.append(meta);
  }

  const sources = Array.isArray(options.sources) ? options.sources : [];
  if (role === "assistant" && sources.length) {
    const sourceList = element(
      state.doc,
      "div",
      "arara-message__sources",
      "Fontes: ",
    );
    sources.forEach((source, index) => {
      if (index) sourceList.append(state.doc.createTextNode(" · "));
      const link = state.doc.createElement("a");
      link.href = String(source.url || "#");
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = String(source.label || "Fonte oficial");
      sourceList.append(link);
    });
    message.append(sourceList);
  }

  state.messages.append(message);
  if (options.track !== false) {
    state.history.push({ role, content: String(text || "") });
    salvarConversa(state.history, state.win);
  }
  state.messages.scrollTop = state.messages.scrollHeight;
  return message;
}

function setStatus(state, status = "ready") {
  const labels = {
    ready: "Pronta",
    thinking: "Pensando",
    limited: "Apoio local",
  };
  const safeStatus = labels[status] ? status : "ready";
  state.root.dataset.status = safeStatus;
  if (state.statusText) state.statusText.textContent = labels[safeStatus];
}

function resizeComposer(state) {
  if (!state?.input) return;
  const minHeight = 56;
  const maxHeight = 132;
  state.input.style.height = "auto";
  const measured = Number(state.input.scrollHeight) || minHeight;
  state.input.style.height = `${Math.min(
    maxHeight,
    Math.max(minHeight, measured),
  )}px`;
  state.input.style.overflowY = measured > maxHeight ? "auto" : "hidden";
}

function setThinking(state, active) {
  state.busy = Boolean(active);
  state.input.disabled = state.busy;
  state.sendButton.disabled = state.busy;
  state.root.classList.toggle("is-thinking", state.busy);

  if (state.thinking?.isConnected) state.thinking.remove();
  state.thinking = null;

  if (!state.busy) {
    state.root.removeAttribute("aria-busy");
    if (state.root.dataset.status === "thinking") setStatus(state, "ready");
    state.sendButton.setAttribute("aria-label", "Enviar pergunta");
    return;
  }

  setStatus(state, "thinking");
  state.root.setAttribute("aria-busy", "true");
  state.sendButton.setAttribute("aria-label", "Aya está pensando");

  state.thinking = element(state.doc, "div", "arara-assistant__thinking");
  state.thinking.setAttribute("role", "status");
  state.thinking.setAttribute("aria-live", "polite");
  state.thinking.append(
    element(
      state.doc,
      "span",
      "arara-assistant__thinking-label",
      "Aya está analisando sua pergunta",
    ),
  );
  const dots = element(state.doc, "span", "arara-assistant__thinking-dots");
  dots.setAttribute("aria-hidden", "true");
  dots.append(
    element(state.doc, "i", ""),
    element(state.doc, "i", ""),
    element(state.doc, "i", ""),
  );
  state.thinking.append(dots);
  state.messages.append(state.thinking);
  state.messages.scrollTop = state.messages.scrollHeight;
}

function renderQuickSuggestions(state) {
  const suggestions = quickSuggestionsForSection(state.section, state.title);
  state.suggestions.replaceChildren();
  state.suggestionLabel.hidden = !suggestions.length;

  for (const suggestion of suggestions) {
    const button = element(state.doc, "button", "arara-suggestion", suggestion);
    button.type = "button";
    button.addEventListener("click", () => {
      if (!state.busy) ask(state, suggestion);
    });
    state.suggestions.append(button);
  }
}

function resetConversation(state) {
  state.messages.replaceChildren();
  state.history = [];
  esquecerConversa(state.win);
  setThinking(state, false);
  appendMessage(state, "assistant", state.content.intro, { track: false });
}

/*
  Abre o painel com a conversa que estava em andamento. Sem isto, recarregar a
  página apagava tudo — inclusive o distrito que a pessoa acabara de nomear, o
  que obrigava a repetir a pergunta inteira.

  As mensagens restauradas entram com `track: false`: elas já estão no
  histórico que veio do armazenamento, e registrá-las de novo duplicaria cada
  turno a cada recarregamento.
*/
function isStoredIntroduction(turno) {
  return (
    turno?.role === "assistant" &&
    /^ol[aá]! eu sou a aya\b/i.test(String(turno.content || "").trim())
  );
}

function restaurarConversa(state) {
  const armazenada = lerConversa(state.win);
  const guardada = armazenada.filter((turno) => !isStoredIntroduction(turno));

  // Versões anteriores salvaram a apresentação no histórico. Remover daqui e
  // do sessionStorage evita que a duplicata reapareça depois do deploy.
  if (guardada.length !== armazenada.length) {
    salvarConversa(guardada, state.win);
  }

  if (!guardada.length) {
    resetConversation(state);
    return;
  }

  state.messages.replaceChildren();
  state.history = guardada;
  setThinking(state, false);
  appendMessage(state, "assistant", state.content.intro, { track: false });
  for (const turno of guardada) {
    appendMessage(state, turno.role, turno.content, { track: false });
  }
}

async function ask(state, question) {
  const cleanQuestion = String(question || "").trim();
  if (!cleanQuestion || state.busy) return;

  const local = localAraraAnswer(state.section, state.title, cleanQuestion);
  appendMessage(state, "user", cleanQuestion);
  state.input.value = "";
  resizeComposer(state);

  if (!shouldAskAyaAi(cleanQuestion, local.matched)) {
    appendMessage(state, "assistant", local.answer, {
      provider: "orientacao-local",
    });
    setStatus(state, "ready");
    state.input.focus();
    return;
  }

  setThinking(state, true);
  const result = await askAyaAi({
    question: cleanQuestion,
    section: state.section,
    title: state.title,
    history: state.history.slice(0, -1),
    doc: state.doc,
  });
  setThinking(state, false);

  appendMessage(state, "assistant", result.answer || local.answer, {
    sources: result.sources,
    provider:
      result.provider ||
      (result.unavailable ? "local-fallback" : "ollama-local"),
  });
  setStatus(state, result.unavailable ? "limited" : "ready");
  state.input.focus();
}

function setHidden(state, hidden, persist = true) {
  state.hidden = Boolean(hidden);
  state.root.classList.toggle("is-hidden", state.hidden);
  state.panel.hidden = state.hidden;
  state.panel.setAttribute("aria-hidden", state.hidden ? "true" : "false");
  state.launcher.hidden = !state.hidden;
  if (persist) writeHiddenPreference(state.win, state.hidden);
}

function createAssistant(host) {
  const doc = host.ownerDocument;
  const win = doc.defaultView || window;
  const root = element(doc, "section", "arara-assistant");
  root.dataset.araraGuide = "";
  root.dataset.status = "ready";
  root.setAttribute("aria-label", "Assistente Aya");

  const panel = element(doc, "div", "arara-assistant__panel");

  const header = element(doc, "div", "arara-assistant__header");
  const heading = element(doc, "div", "arara-assistant__heading");
  const eyebrow = element(doc, "span", "arara-assistant__eyebrow", "MONITORA");
  const assistantTitle = element(
    doc,
    "strong",
    "arara-assistant__title",
    "Aya",
  );
  const subtitle = element(doc, "div", "arara-assistant__subtitle");
  const status = element(doc, "span", "arara-assistant__status");
  const statusText = element(
    doc,
    "span",
    "arara-assistant__status-text",
    "Pronta",
  );
  status.append(statusText);
  const sectionBadge = element(
    doc,
    "span",
    "arara-assistant__section",
    "Painel",
  );
  subtitle.append(status, sectionBadge);
  heading.append(eyebrow, assistantTitle, subtitle);

  header.dataset.ninaDragHandle = "";
  header.append(heading);

  const resetButton = element(
    doc,
    "button",
    "arara-assistant__reset",
    "Limpar conversa",
  );
  resetButton.type = "button";
  resetButton.title = "Limpar conversa";

  const hideButton = element(
    doc,
    "button",
    "arara-assistant__hide",
    "Minimizar",
  );
  hideButton.type = "button";
  hideButton.setAttribute("aria-label", "Minimizar Aya");

  const body = element(doc, "div", "arara-assistant__body");
  const scene = element(doc, "div", "arara-assistant__scene");

  const avatar = doc.createElement("img");
  avatar.className = "arara-assistant__avatar";
  avatar.src = "/assets/arara-azul-monitora.png";
  avatar.alt = "Aya, assistente do MONITORA";
  avatar.width = 170;
  avatar.height = 194;
  avatar.dataset.ninaDragHandle = "";

  const conversation = element(
    doc,
    "div",
    "arara-assistant__conversation",
  );

  const messages = element(doc, "div", "arara-assistant__messages");
  messages.setAttribute("role", "log");
  messages.setAttribute("aria-live", "polite");
  messages.setAttribute("aria-relevant", "additions");

  const suggestionLabel = element(
    doc,
    "span",
    "arara-assistant__quick-label",
    "Perguntas rápidas",
  );
  const suggestions = element(doc, "div", "arara-assistant__suggestions");

  const conversationTools = element(
    doc,
    "div",
    "arara-assistant__conversation-tools",
  );
  conversationTools.append(resetButton, hideButton);

  const form = element(doc, "form", "arara-assistant__form");
  const inputLabel = element(
    doc,
    "label",
    "arara-visually-hidden",
    "Pergunta para a Aya",
  );
  const input = doc.createElement("textarea");
  input.className = "arara-assistant__input";
  input.rows = 1;
  input.maxLength = 1200;
  input.placeholder =
    "Pergunte sobre a tela, editais, vagas, DSEIs ou saúde indígena…";
  input.autocomplete = "off";
  input.dataset.ayaPlaceholderManaged = "1";
  inputLabel.htmlFor = "araraAssistantInput";
  input.id = "araraAssistantInput";

  const sendButton = element(doc, "button", "arara-assistant__send", "Enviar");
  sendButton.type = "submit";
  sendButton.setAttribute("aria-label", "Enviar pergunta");
  form.append(inputLabel, input, sendButton);

  const composerHint = element(
    doc,
    "div",
    "arara-assistant__composer-hint",
    "Enter envia · Shift+Enter quebra linha",
  );

  conversation.append(
    conversationTools,
    messages,
    suggestionLabel,
    suggestions,
    form,
    composerHint,
  );
  scene.append(avatar, conversation);
  body.append(scene);
  panel.append(header, body);

  const launcher = element(doc, "button", "arara-assistant__launcher");
  launcher.type = "button";
  launcher.setAttribute("aria-label", "Mostrar Aya");
  launcher.dataset.araraShow = "";
  const launcherAvatar = doc.createElement("img");
  launcherAvatar.src = "/assets/arara-azul-monitora.png";
  launcherAvatar.alt = "";
  launcherAvatar.width = 56;
  launcherAvatar.height = 56;
  launcher.append(launcherAvatar);

  root.append(panel, launcher);
  host.append(root);

  const state = {
    doc,
    win,
    root,
    panel,
    launcher,
    sectionBadge,
    statusText,
    messages,
    suggestionLabel,
    suggestions,
    form,
    input,
    sendButton,
    resetButton,
    history: [],
    busy: false,
    thinking: null,
    section: "",
    title: "",
    content: genericGuide("Painel"),
    hidden: false,
    initialized: false,
  };

  hideButton.addEventListener("click", () => {
    setHidden(state, true);
    launcher.focus();
  });
  launcher.addEventListener("click", () => {
    setHidden(state, false);
    input.focus();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    ask(state, input.value);
  });
  input.addEventListener("input", () => resizeComposer(state));
  input.addEventListener("keydown", (event) => {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.isComposing ||
      state.busy
    ) {
      return;
    }
    event.preventDefault();
    if (typeof form.requestSubmit === "function") {
      form.requestSubmit();
    } else {
      form.dispatchEvent(
        new win.Event("submit", { bubbles: true, cancelable: true }),
      );
    }
  });
  resetButton.addEventListener("click", () => {
    resetConversation(state);
    input.focus();
  });

  assistantState.set(root, state);
  setStatus(state, "ready");
  resizeComposer(state);
  setHidden(state, readHiddenPreference(win), false);
  return root;
}

export function updateAraraGuide(section, title, host) {
  if (!host) return null;

  let root = host.querySelector("[data-arara-guide]");
  let state = root ? assistantState.get(root) : null;
  if (!root || !state) {
    root?.remove();
    root = createAssistant(host);
    state = assistantState.get(root);
  }

  const content = guideForSection(section, title);
  const signature = JSON.stringify({ section, title, content });
  if (root.dataset.content === signature) return root;

  root.dataset.content = signature;
  root.dataset.section = section;
  state.section = section;
  state.title = title;
  state.content = content;
  state.sectionBadge.textContent = content.title;
  renderQuickSuggestions(state);

  // A conversa é restaurada apenas na primeira montagem. Trocar de seção muda
  // o contexto da Aya, mas mantém a mesma thread e não cria outra apresentação.
  if (!state.initialized) {
    restaurarConversa(state);
    state.initialized = true;
  }

  return root;
}

export { ARARA_VISIBILITY_STORAGE_KEY };
