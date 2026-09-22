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
    title: "Equipe Núcleo",
    intro:
      "Olá! Eu sou a Aya, assistente do MONITORA. Estou com você na Equipe Núcleo e posso ajudar a localizar editais, entender etapas, cronogramas e ações disponíveis. O que você quer saber?",
    topics: [
      {
        label: "Processos",
        keywords: ["localizar", "buscar", "pesquisar", "processo", "edital"],
        answer:
          "Use a busca da Equipe Núcleo para localizar por edital, unidade ou situação. Depois abra o registro correspondente para conferir cronograma e informações operacionais.",
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

function setThinking(state, active) {
  state.busy = Boolean(active);
  state.input.disabled = state.busy;
  state.sendButton.disabled = state.busy;
  if (state.thinking?.isConnected) state.thinking.remove();
  state.thinking = null;
  if (!state.busy) return;
  state.thinking = element(
    state.doc,
    "div",
    "arara-assistant__thinking",
    "Aya está pensando…",
  );
  state.thinking.setAttribute("role", "status");
  state.messages.append(state.thinking);
  state.messages.scrollTop = state.messages.scrollHeight;
}

function resetConversation(state) {
  state.messages.replaceChildren();
  state.history = [];
  esquecerConversa(state.win);
  setThinking(state, false);
  appendMessage(state, "assistant", state.content.intro);
}

/*
  Abre o painel com a conversa que estava em andamento. Sem isto, recarregar a
  página apagava tudo — inclusive o distrito que a pessoa acabara de nomear, o
  que obrigava a repetir a pergunta inteira.

  As mensagens restauradas entram com `track: false`: elas já estão no
  histórico que veio do armazenamento, e registrá-las de novo duplicaria cada
  turno a cada recarregamento.
*/
function restaurarConversa(state) {
  const guardada = lerConversa(state.win);
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

  if (!shouldAskAyaAi(cleanQuestion, local.matched)) {
    appendMessage(state, "assistant", local.answer);
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
  });
  state.input.focus();
}

function setHidden(state, hidden, persist = true) {
  state.hidden = Boolean(hidden);
  state.root.classList.toggle("is-hidden", state.hidden);
  state.panel.hidden = state.hidden;
  state.launcher.hidden = !state.hidden;
  if (persist) writeHiddenPreference(state.win, state.hidden);
}

function createAssistant(host) {
  const doc = host.ownerDocument;
  const win = doc.defaultView || window;
  const root = element(doc, "section", "arara-assistant");
  root.dataset.araraGuide = "";
  root.setAttribute("aria-label", "Assistente Aya");

  const panel = element(doc, "div", "arara-assistant__panel");
  const body = element(doc, "div", "arara-assistant__body");
  const sectionBadge = element(
    doc,
    "span",
    "arara-assistant__section arara-visually-hidden",
  );

  const hideButton = element(
    doc,
    "button",
    "arara-assistant__hide",
    "Ocultar Aya",
  );
  hideButton.type = "button";
  hideButton.setAttribute("aria-label", "Ocultar Aya");

  const scene = element(doc, "div", "arara-assistant__scene");
  const avatar = doc.createElement("img");
  avatar.className = "arara-assistant__avatar";
  avatar.src = "/assets/arara-azul-monitora.png";
  avatar.alt = "Aya, assistente do MONITORA";
  avatar.width = 220;
  avatar.height = 250;
  avatar.dataset.ninaDragHandle = "";

  const messages = element(doc, "div", "arara-assistant__messages");
  messages.setAttribute("role", "log");
  messages.setAttribute("aria-live", "polite");
  messages.setAttribute("aria-relevant", "additions");
  scene.append(avatar, messages);

  const form = element(doc, "form", "arara-assistant__form");
  const inputLabel = element(
    doc,
    "label",
    "arara-visually-hidden",
    "Pergunta para a Aya",
  );
  const input = doc.createElement("input");
  input.className = "arara-assistant__input";
  input.type = "text";
  input.placeholder = "Pergunte para a Aya...";
  input.autocomplete = "off";
  inputLabel.htmlFor = "araraAssistantInput";
  input.id = "araraAssistantInput";
  const sendButton = element(doc, "button", "arara-assistant__send", "Enviar");
  sendButton.type = "submit";
  form.append(inputLabel, input, sendButton);

  const actions = element(doc, "div", "arara-assistant__actions");
  const resetButton = element(
    doc,
    "button",
    "arara-assistant__reset",
    "Recomeçar",
  );
  resetButton.type = "button";
  actions.append(resetButton);

  body.append(sectionBadge, hideButton, scene, form, actions);
  panel.append(body);

  const launcher = element(doc, "button", "arara-assistant__launcher");
  launcher.type = "button";
  launcher.setAttribute("aria-label", "Mostrar Aya");
  launcher.dataset.araraShow = "";
  const launcherAvatar = doc.createElement("img");
  launcherAvatar.src = "/assets/arara-azul-monitora.png";
  launcherAvatar.alt = "";
  launcherAvatar.width = 56;
  launcherAvatar.height = 56;
  launcher.append(launcherAvatar, element(doc, "span", "", "Mostrar Aya"));

  root.append(panel, launcher);
  host.append(root);

  const state = {
    doc,
    win,
    root,
    panel,
    launcher,
    sectionBadge,
    messages,
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
  resetButton.addEventListener("click", () => {
    resetConversation(state);
    input.focus();
  });

  assistantState.set(root, state);
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
  restaurarConversa(state);
  return root;
}

export { ARARA_VISIBILITY_STORAGE_KEY };
