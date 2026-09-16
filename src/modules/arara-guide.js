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
      "Olá! Eu sou a Nina, assistente do MONITORA. Estou com você na Saúde Indígena e posso conversar sobre editais, DSEIs, CASAIs, mapa, filtros, indicadores e territórios. O que você quer saber?",
    topics: [
      {
        label: "Mapa",
        keywords: ["mapa", "dsei", "territorio", "zoom", "satélite", "satelite"],
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
        keywords: ["indicador", "kpi", "vagas", "ociosas", "contratados", "criticos"],
        answer:
          "Os indicadores resumem o recorte atual. Use-os como sinal de onde investigar e confirme o detalhe na lista ou no território antes de tirar uma conclusão.",
      },
    ],
  },
  nucleo: {
    title: "Equipe Núcleo",
    intro:
      "Olá! Eu sou a Nina, assistente do MONITORA. Estou com você na Equipe Núcleo e posso ajudar a localizar editais, entender etapas, cronogramas e ações disponíveis. O que você quer saber?",
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
      "Olá! Eu sou a Nina, assistente do MONITORA. Nesta área posso explicar acessos, identidade visual e ajustes administrativos disponíveis para o seu perfil. O que você quer fazer?",
    topics: [
      {
        label: "Acessos",
        keywords: ["acesso", "usuario", "usuário", "permissao", "permissão", "painel"],
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
      "Olá! Eu sou a Nina, assistente do MONITORA. Estou com você em Análises e posso ajudar com filtros, gráfico, fila operacional e leitura do recorte atual. O que você quer entender?",
    topics: [
      {
        label: "Fila",
        keywords: ["fila", "candidato", "status", "detalhes", "registro"],
        answer:
          "Use a busca para localizar um registro e abra Detalhes quando precisar conferir as informações completas. Interprete o status sempre dentro dos filtros ativos.",
      },
      {
        label: "Gráfico",
        keywords: ["grafico", "gráfico", "linha", "tempo", "evolucao", "evolução"],
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
    intro: `Olá! Eu sou a Nina, assistente do MONITORA. Estou com você em ${sectionTitle} e posso explicar o que estiver disponível nesta tela. O que você quer saber?`,
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

export function answerAraraQuestion(section, title, question) {
  const content = guideForSection(section, title);
  const normalized = normalizeText(question);
  if (!normalized) return "Escreva sua pergunta para a Nina.";

  const topics = [...content.topics, ...GLOBAL_TOPICS];
  const best = topics
    .map((topic) => ({ topic, score: scoreTopic(question, topic) }))
    .sort((a, b) => b.score - a.score)[0];

  if (best?.score > 0) return best.topic.answer;

  return `Posso conversar com você sobre ${content.title}. Quando a resposta depender de um dado específico, eu uso apenas o que estiver disponível no MONITORA ou uma referência institucional segura.`;
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

function appendMessage(state, role, text) {
  const message = element(
    state.doc,
    "div",
    `arara-message arara-message--${role}`,
  );
  const author = element(
    state.doc,
    "strong",
    "arara-message__author",
    role === "user" ? "Você" : "Nina",
  );
  const body = element(state.doc, "p", "arara-message__body", text);
  message.append(author, body);
  state.messages.append(message);
  state.messages.scrollTop = state.messages.scrollHeight;
}

function resetConversation(state) {
  state.messages.replaceChildren();
  appendMessage(state, "assistant", state.content.intro);
}

function ask(state, question) {
  const cleanQuestion = String(question || "").trim();
  if (!cleanQuestion) return;
  appendMessage(state, "user", cleanQuestion);
  appendMessage(
    state,
    "assistant",
    answerAraraQuestion(state.section, state.title, cleanQuestion),
  );
  state.input.value = "";
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
  root.setAttribute("aria-label", "Assistente Nina");

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
    "Ocultar Nina",
  );
  hideButton.type = "button";
  hideButton.setAttribute("aria-label", "Ocultar Nina");

  const scene = element(doc, "div", "arara-assistant__scene");
  const avatar = doc.createElement("img");
  avatar.className = "arara-assistant__avatar";
  avatar.src = "/assets/arara-azul-monitora.png";
  avatar.alt = "Nina, assistente do MONITORA";
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
    "Pergunta para a Nina",
  );
  const input = doc.createElement("input");
  input.className = "arara-assistant__input";
  input.type = "text";
  input.placeholder = "Pergunte para a Nina...";
  input.autocomplete = "off";
  inputLabel.htmlFor = "araraAssistantInput";
  input.id = "araraAssistantInput";
  const sendButton = element(doc, "button", "arara-assistant__send", "Enviar");
  sendButton.type = "submit";
  form.append(inputLabel, input, sendButton);

  const actions = element(doc, "div", "arara-assistant__actions");
  const resetButton = element(doc, "button", "arara-assistant__reset", "Recomeçar");
  resetButton.type = "button";
  actions.append(resetButton);

  body.append(sectionBadge, hideButton, scene, form, actions);
  panel.append(body);

  const launcher = element(doc, "button", "arara-assistant__launcher");
  launcher.type = "button";
  launcher.setAttribute("aria-label", "Mostrar Nina");
  launcher.dataset.araraShow = "";
  const launcherAvatar = doc.createElement("img");
  launcherAvatar.src = "/assets/arara-azul-monitora.png";
  launcherAvatar.alt = "";
  launcherAvatar.width = 56;
  launcherAvatar.height = 56;
  launcher.append(launcherAvatar, element(doc, "span", "", "Mostrar Nina"));

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
    resetButton,
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
  resetConversation(state);
  return root;
}

export { ARARA_VISIBILITY_STORAGE_KEY };