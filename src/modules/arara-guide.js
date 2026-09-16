const ARARA_VISIBILITY_STORAGE_KEY = "agsus_monitora_arara_oculta_v1";

const GLOBAL_TOPICS = Object.freeze([
  {
    label: "O que você consegue fazer?",
    keywords: ["o que voce faz", "o que consegue", "ajuda", "pode fazer"],
    answer:
      "Eu explico a seção atual, os controles da tela e o caminho mais seguro para concluir uma tarefa. Não altero registros, não concedo permissões e não consulto dados fora do que já está visível para você.",
  },
  {
    label: "Você consulta meus dados?",
    keywords: ["dados", "privacidade", "registro", "consulta", "informacao"],
    answer:
      "Não. Esta versão da Arara funciona localmente no navegador e usa apenas orientações cadastradas no MONITORA. Ela não envia perguntas para um serviço externo e não consulta registros individuais.",
  },
  {
    label: "Você pode alterar algo por mim?",
    keywords: ["alterar", "editar", "salvar", "apagar", "excluir"],
    answer:
      "Não diretamente. Eu posso explicar onde fica cada ação e quais cuidados tomar, mas a confirmação e qualquer alteração continuam sob seu controle.",
  },
]);

const GUIDES = Object.freeze({
  dashboard: {
    title: "Saúde Indígena",
    intro:
      "Aqui você acompanha processos seletivos, indicadores e a distribuição territorial dos DSEIs e CASAIs.",
    steps: [
      "Confira os filtros ativos antes de comparar números ou territórios.",
      "Use os indicadores para localizar situações que merecem atenção.",
      "No mapa, selecione um DSEI para abrir o detalhamento de polos e unidades.",
      "Volte à visão nacional quando quiser comparar outro território.",
    ],
    topics: [
      {
        label: "Como começo?",
        keywords: ["comeco", "comecar", "inicio", "primeiro passo"],
        answer:
          "Comece pelos filtros no topo. Depois confira os KPIs e use o mapa para localizar o território que deseja aprofundar. Antes de interpretar qualquer número, confirme se os filtros ativos representam o recorte que você quer analisar.",
      },
      {
        label: "Como usar o mapa?",
        keywords: ["mapa", "dsei", "territorio", "zoom", "satélite", "satelite"],
        answer:
          "Na visão nacional, clique em um DSEI para abrir seus polos e unidades. Use Mapa/Satélite apenas para trocar o fundo cartográfico. O zoom muda a escala, mas não altera a coordenada real das sedes. Para comparar outro território, volte à visão Brasil.",
      },
      {
        label: "Como usar os filtros?",
        keywords: ["filtro", "filtrar", "uf", "edital", "status", "risco"],
        answer:
          "Os filtros refinam todos os indicadores da página. Use Unidade, Edital, Etapa, Status, Risco e UF para montar o recorte. Se um resultado parecer estranho, confira primeiro os filtros ativos e a informação de atualização.",
      },
      {
        label: "Como interpretar os indicadores?",
        keywords: ["indicador", "kpi", "vagas", "ociosas", "contratados", "criticos"],
        answer:
          "Os KPIs resumem o recorte atual: processos, vagas previstas, contratações, vagas ociosas, processos críticos e inscritos. Eles devem ser lidos junto com os filtros e com a lista detalhada, não isoladamente.",
      },
    ],
  },
  nucleo: {
    title: "Equipe Núcleo",
    intro:
      "Esta seção organiza o acompanhamento operacional dos editais, etapas e cronogramas da Equipe Núcleo.",
    steps: [
      "Pesquise ou filtre o processo que deseja acompanhar.",
      "Abra o processo para consultar etapas, cronograma e informações operacionais.",
      "Revise os campos antes de qualquer salvamento.",
      "Use as ações de edição somente quando seu perfil tiver permissão.",
    ],
    topics: [
      {
        label: "Como localizar um processo?",
        keywords: ["localizar", "buscar", "pesquisar", "processo", "edital"],
        answer:
          "Use a busca da Equipe Núcleo para procurar por edital, unidade ou situação. Depois abra o registro correspondente para ver o cronograma e as informações operacionais.",
      },
      {
        label: "Como funciona o cronograma?",
        keywords: ["cronograma", "etapa", "prazo", "data"],
        answer:
          "O cronograma apresenta as etapas e datas associadas ao processo. Use-o para acompanhar sequência e prazo. Antes de editar, confirme o processo selecionado e os dados que já estão salvos.",
      },
      {
        label: "Posso editar?",
        keywords: ["editar", "salvar", "permissao", "permissão", "perfil"],
        answer:
          "A edição depende do seu perfil. Quando a ação estiver disponível, revise o registro completo antes de salvar. Campos calculados pelo sistema devem ser tratados como referência, não como campos manuais.",
      },
    ],
  },
  config: {
    title: "Configurações",
    intro:
      "Aqui ficam identidade visual, textos, acessos e parâmetros administrativos do MONITORA.",
    steps: [
      "Entre somente na seção de configuração que pretende alterar.",
      "Revise o valor atual antes de editar.",
      "Confirme o impacto da mudança e salve apenas quando estiver seguro.",
      "Depois do salvamento, confira a mensagem de resultado e a tela afetada.",
    ],
    topics: [
      {
        label: "O que posso configurar?",
        keywords: ["configurar", "configuracao", "configuração", "alterar", "opcoes", "opções"],
        answer:
          "As configurações controlam textos, identidade visual, avisos, parâmetros de acesso e outros ajustes administrativos. O que aparece para você depende do seu perfil.",
      },
      {
        label: "Como salvar com segurança?",
        keywords: ["salvar", "seguranca", "segurança", "confirmar"],
        answer:
          "Mude apenas o campo necessário, releia o valor e salve uma vez. Depois confira a confirmação exibida pelo sistema e valide visualmente a área afetada antes de fazer outra alteração.",
      },
      {
        label: "Como funcionam os acessos?",
        keywords: ["acesso", "usuario", "usuário", "permissao", "permissão", "painel"],
        answer:
          "Os acessos são administrados conforme o perfil do usuário e os painéis permitidos. Antes de aprovar ou revogar algo, confirme a pessoa, o perfil e os painéis envolvidos.",
      },
    ],
  },
  analises: {
    title: "Análises",
    intro:
      "Esta seção consolida indicadores e a fila operacional das análises curriculares.",
    steps: [
      "Confirme o período e os filtros que definem o recorte.",
      "Leia o gráfico para entender a evolução do volume de registros.",
      "Use a fila operacional para consultar cada candidato e seu status.",
      "Abra Detalhes quando precisar conferir o registro completo.",
    ],
    topics: [
      {
        label: "Como começo a análise?",
        keywords: ["comeco", "comecar", "analise", "análise", "primeiro"],
        answer:
          "Comece confirmando o recorte dos filtros. Depois observe o gráfico para entender o volume ao longo do tempo e use a fila operacional para verificar os registros individuais.",
      },
      {
        label: "Como ler a fila operacional?",
        keywords: ["fila", "candidato", "status", "detalhes", "registro"],
        answer:
          "A fila mostra grupo, unidade, edital, código, vaga, candidato, status e ações. Use a busca para localizar um registro e o botão Detalhes para abrir as informações completas sem depender de textos truncados na linha.",
      },
      {
        label: "Como usar os filtros?",
        keywords: ["filtro", "edital", "unidade", "status", "periodo", "período"],
        answer:
          "Use os filtros para reduzir o universo analisado antes de comparar resultados. Depois confira o contador de registros pesquisados e a data de atualização para saber exatamente qual recorte está na tela.",
      },
      {
        label: "O que o gráfico mostra?",
        keywords: ["grafico", "gráfico", "linha", "tempo", "evolucao", "evolução"],
        answer:
          "O gráfico mostra a evolução do volume de registros ao longo do tempo no recorte atual. Use-o para perceber picos e quedas; para explicar um ponto específico, confirme os filtros e consulte os registros daquele período.",
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
  return {
    title: title || "Painel",
    intro:
      "Esta área apresenta recursos específicos do painel selecionado no MONITORA.",
    steps: [
      "Identifique o objetivo e os controles disponíveis nesta tela.",
      "Aplique filtros antes de comparar resultados, quando eles estiverem disponíveis.",
      "Abra detalhes somente quando precisar aprofundar uma informação.",
      "Se uma função não estiver disponível, confira seu perfil de acesso.",
    ],
    topics: [
      {
        label: "Como usar esta seção?",
        keywords: ["como usar", "secao", "seção", "painel", "ajuda"],
        answer:
          "Comece identificando os filtros e ações disponíveis nesta seção. Faça um recorte simples, confira o resultado e só depois aprofunde em detalhes. Se algum controle não aparecer, ele pode depender do seu perfil de acesso.",
      },
    ],
  };
}

export function guideForSection(section, title = "") {
  if (section.startsWith("panel:") && /an[aá]lises/i.test(title))
    return GUIDES.analises;
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
  if (!normalized) {
    return "Escreva uma pergunta sobre esta tela ou escolha uma das sugestões.";
  }

  const topics = [...content.topics, ...GLOBAL_TOPICS];
  const best = topics
    .map((topic) => ({ topic, score: scoreTopic(question, topic) }))
    .sort((a, b) => b.score - a.score)[0];

  if (best?.score > 0) return best.topic.answer;

  return `Posso orientar você sobre ${content.title}, principalmente sobre ${content.topics
    .map((topic) => topic.label.toLowerCase())
    .join(", ")}. Não consulto registros individuais nem invento respostas sobre dados que não estão nesta orientação.`;
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
    // A assistente continua funcional mesmo quando o armazenamento é bloqueado.
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
    role === "user" ? "Você" : "Arara",
  );
  const body = element(state.doc, "p", "arara-message__body", text);
  message.append(author, body);
  state.messages.append(message);
  state.messages.scrollTop = state.messages.scrollHeight;
}

function resetConversation(state) {
  state.messages.replaceChildren();
  appendMessage(
    state,
    "assistant",
    `${state.content.intro} Posso explicar esta tela e orientar seus próximos passos.`,
  );
}

function renderStep(state) {
  const steps = state.content.steps;
  const lastIndex = Math.max(steps.length - 1, 0);
  state.stepIndex = Math.min(Math.max(state.stepIndex, 0), lastIndex);
  state.stepCounter.textContent = `Passo ${state.stepIndex + 1} de ${steps.length}`;
  state.stepText.textContent = steps[state.stepIndex] || "";
  state.previousButton.disabled = state.stepIndex === 0;
  state.nextButton.disabled = state.stepIndex >= lastIndex;
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

function renderSuggestions(state) {
  state.suggestions.replaceChildren(
    ...state.content.topics.slice(0, 4).map((topic) => {
      const button = element(
        state.doc,
        "button",
        "arara-suggestion",
        topic.label,
      );
      button.type = "button";
      button.addEventListener("click", () => ask(state, topic.label));
      return button;
    }),
  );
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
  root.setAttribute("aria-label", "Assistente Arara Azul");

  const panel = element(doc, "div", "arara-assistant__panel");
  const header = element(doc, "header", "arara-assistant__header");
  const avatar = doc.createElement("img");
  avatar.className = "arara-assistant__avatar";
  avatar.src = "/assets/arara-azul-monitora.png";
  avatar.alt = "";
  avatar.width = 112;
  avatar.height = 112;

  const heading = element(doc, "div", "arara-assistant__heading");
  const eyebrow = element(
    doc,
    "span",
    "arara-assistant__eyebrow",
    "Assistente do MONITORA",
  );
  const titleNode = element(doc, "strong", "arara-assistant__title", "Arara Azul");
  const sectionBadge = element(doc, "span", "arara-assistant__section");
  heading.append(eyebrow, titleNode, sectionBadge);

  const hideButton = element(
    doc,
    "button",
    "arara-assistant__hide",
    "Ocultar Arara",
  );
  hideButton.type = "button";
  hideButton.setAttribute("aria-label", "Ocultar a Arara Azul");
  header.append(avatar, heading, hideButton);

  const body = element(doc, "div", "arara-assistant__body");
  const context = element(doc, "p", "arara-assistant__context");
  const stepper = element(doc, "section", "arara-stepper");
  const stepHeader = element(doc, "div", "arara-stepper__header");
  const stepLabel = element(doc, "strong", "", "Passo a passo");
  const stepCounter = element(doc, "span", "arara-stepper__counter");
  stepHeader.append(stepLabel, stepCounter);
  const stepText = element(doc, "p", "arara-stepper__text");
  const stepActions = element(doc, "div", "arara-stepper__actions");
  const previousButton = element(doc, "button", "", "Anterior");
  previousButton.type = "button";
  const nextButton = element(doc, "button", "", "Próximo");
  nextButton.type = "button";
  stepActions.append(previousButton, nextButton);
  stepper.append(stepHeader, stepText, stepActions);

  const suggestionLabel = element(
    doc,
    "strong",
    "arara-assistant__suggestion-label",
    "Pergunte para a Arara",
  );
  const suggestions = element(doc, "div", "arara-assistant__suggestions");
  const messages = element(doc, "div", "arara-assistant__messages");
  messages.setAttribute("role", "log");
  messages.setAttribute("aria-live", "polite");
  messages.setAttribute("aria-relevant", "additions");

  const form = element(doc, "form", "arara-assistant__form");
  const inputLabel = element(
    doc,
    "label",
    "arara-visually-hidden",
    "Pergunta para a Arara Azul",
  );
  const input = doc.createElement("input");
  input.className = "arara-assistant__input";
  input.type = "text";
  input.placeholder = "Ex.: como uso o mapa?";
  input.autocomplete = "off";
  inputLabel.htmlFor = "araraAssistantInput";
  input.id = "araraAssistantInput";
  const sendButton = element(doc, "button", "arara-assistant__send", "Enviar");
  sendButton.type = "submit";
  form.append(inputLabel, input, sendButton);

  const footer = element(doc, "footer", "arara-assistant__footer");
  const scope = element(
    doc,
    "span",
    "",
    "Orientação local · não altera registros",
  );
  const resetButton = element(doc, "button", "", "Recomeçar");
  resetButton.type = "button";
  footer.append(scope, resetButton);

  body.append(
    context,
    stepper,
    suggestionLabel,
    suggestions,
    messages,
    form,
    footer,
  );
  panel.append(header, body);

  const launcher = element(doc, "button", "arara-assistant__launcher");
  launcher.type = "button";
  launcher.setAttribute("aria-label", "Mostrar a Arara Azul");
  launcher.dataset.araraShow = "";
  const launcherAvatar = doc.createElement("img");
  launcherAvatar.src = "/assets/arara-azul-monitora.png";
  launcherAvatar.alt = "";
  launcherAvatar.width = 56;
  launcherAvatar.height = 56;
  launcher.append(launcherAvatar, element(doc, "span", "", "Mostrar Arara"));

  root.append(panel, launcher);
  host.append(root);

  const state = {
    doc,
    win,
    root,
    panel,
    launcher,
    sectionBadge,
    context,
    stepCounter,
    stepText,
    previousButton,
    nextButton,
    suggestions,
    messages,
    form,
    input,
    resetButton,
    stepIndex: 0,
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
  previousButton.addEventListener("click", () => {
    state.stepIndex -= 1;
    renderStep(state);
  });
  nextButton.addEventListener("click", () => {
    state.stepIndex += 1;
    renderStep(state);
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    ask(state, input.value);
  });
  resetButton.addEventListener("click", () => {
    state.stepIndex = 0;
    renderStep(state);
    resetConversation(state);
    input.focus();
  });

  assistantState.set(root, state);
  setHidden(state, readHiddenPreference(win), false);
  return root;
}

/**
 * Mantém uma única Arara por página e atualiza o conteúdo ao navegar.
 * A conversa é local: não usa RPC, timers nem chamadas de rede.
 */
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
  state.stepIndex = 0;
  state.sectionBadge.textContent = content.title;
  state.context.textContent = content.intro;
  renderStep(state);
  renderSuggestions(state);
  resetConversation(state);
  return root;
}

export { ARARA_VISIBILITY_STORAGE_KEY };
