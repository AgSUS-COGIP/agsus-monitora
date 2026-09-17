function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const PAGE_CONTEXTS = Object.freeze({
  dashboard: Object.freeze({
    name: "Saúde Indígena",
    purpose:
      "Monitorar o recorte territorial e operacional de Saúde Indígena no MONITORA, com visão de DSEIs/CASAIs, vagas, processos seletivos, filtros e mapa.",
    concepts: Object.freeze([
      "DSEI é Distrito Sanitário Especial Indígena e representa uma unidade territorial e de gestão da saúde indígena vinculada à SESAI.",
      "CASAI é estrutura de apoio a pessoas indígenas referenciadas para atendimento no SUS e não deve ser tratada como sinônimo de DSEI.",
      "O mapa representa o recorte territorial do MONITORA; trocar Mapa/Satélite muda apenas a camada cartográfica, não os dados do recorte.",
      "DSEI e Terra Indígena são conceitos distintos e seus limites não devem ser tratados como equivalentes.",
    ]),
    rules: Object.freeze([
      "Priorize os números, filtros e territórios que estiverem visíveis na tela atual.",
      "Se houver filtros ativos, qualquer contagem ou comparação deve ser descrita como pertencente ao recorte filtrado.",
      "Não deduza vagas, população, ocupação ou situação de um DSEI quando o valor não estiver no contexto recebido.",
      "Ao comparar DSEIs, use somente os DSEIs enviados no contexto atual e deixe claro quando a lista for parcial.",
    ]),
  }),
  nucleo: Object.freeze({
    name: "Equipe Núcleo",
    purpose:
      "Acompanhar processos seletivos da Equipe Núcleo, com editais, etapas, cronogramas, situação operacional e registros disponíveis ao usuário autenticado.",
    concepts: Object.freeze([
      "Edital identifica o processo seletivo e deve ser distinguido de etapa, status e cronograma.",
      "Cronograma reúne etapas e datas do processo selecionado; uma data só deve ser afirmada quando estiver carregada na tela ou em contexto autorizado.",
      "A busca e os filtros definem o conjunto de registros que o usuário está vendo naquele momento.",
    ]),
    rules: Object.freeze([
      "Use primeiro o edital, processo, etapa, status e cronograma que estiverem visíveis no contexto atual.",
      "Não invente prazo, resultado, convocação, candidato ou situação de processo que não esteja carregado.",
      "Quando orientar uma ação, descreva o caminho na interface sem afirmar que a ação já foi executada.",
    ]),
  }),
  analises: Object.freeze({
    name: "Análises",
    purpose:
      "Apoiar a leitura de análises do MONITORA, incluindo filtros, indicadores, evolução ao longo do tempo, fila operacional e registros do recorte atual.",
    concepts: Object.freeze([
      "Indicadores e gráficos devem ser interpretados dentro do período e dos filtros ativos.",
      "Picos, quedas e diferenças no gráfico são sinais para investigação e não devem receber causa inventada sem evidência nos dados enviados.",
      "A fila operacional representa registros do recorte atual e pode mudar conforme busca e filtros.",
    ]),
    rules: Object.freeze([
      "Explique tendências somente a partir dos valores e períodos realmente presentes no contexto.",
      "Não faça julgamento sobre pessoas, desempenho individual ou causa de um resultado sem dados explícitos que sustentem a afirmação.",
      "Se a pergunta pedir um registro não carregado, informe que ele não está no contexto atual.",
    ]),
  }),
  config: Object.freeze({
    name: "Configurações",
    purpose:
      "Orientar o uso das configurações administrativas disponíveis ao perfil atual, incluindo acessos, permissões, identidade visual e ajustes do sistema.",
    concepts: Object.freeze([
      "O que aparece nesta área depende das permissões do usuário autenticado.",
      "A Aya pode explicar o efeito de uma configuração, mas não deve assumir que o usuário possui uma permissão que não esteja comprovada na interface.",
    ]),
    rules: Object.freeze([
      "Não afirme que uma alteração foi salva, aplicada ou publicada sem uma confirmação real do sistema.",
      "Não exponha credenciais, tokens, chaves, segredos ou dados de autenticação presentes em mensagens ou contexto.",
      "Para ações destrutivas ou de permissão, explique o impacto e mantenha a confirmação sob controle do usuário.",
    ]),
  }),
  generic: Object.freeze({
    name: "MONITORA",
    purpose:
      "Explicar a seção atual do MONITORA usando apenas o contexto autorizado e os elementos realmente carregados na tela.",
    concepts: Object.freeze([
      "A seção, o título e o estado visível da interface definem o contexto principal da conversa.",
    ]),
    rules: Object.freeze([
      "Não invente a função de um controle ou dado que não esteja identificado no contexto.",
      "Quando a página não tiver um perfil específico, descreva apenas o que estiver visível ou explicitamente informado.",
    ]),
  }),
});

export function ayaPageContextFor(section = "", title = "") {
  const sectionKey = normalize(section);
  const titleKey = normalize(title);

  if (sectionKey === "dashboard" || /saude indigena/.test(titleKey)) {
    return PAGE_CONTEXTS.dashboard;
  }
  if (sectionKey === "nucleo" || /equipe nucleo|nucleo/.test(titleKey)) {
    return PAGE_CONTEXTS.nucleo;
  }
  if (
    sectionKey === "analises" ||
    (sectionKey.startsWith("panel:") && /analise/.test(titleKey)) ||
    /analise/.test(titleKey)
  ) {
    return PAGE_CONTEXTS.analises;
  }
  if (sectionKey === "config" || /configur/.test(titleKey)) {
    return PAGE_CONTEXTS.config;
  }

  return PAGE_CONTEXTS.generic;
}

export function formatAyaPageContext(section = "", title = "") {
  const profile = ayaPageContextFor(section, title);
  const concepts = profile.concepts.map((item) => `- ${item}`).join("\n");
  const rules = profile.rules.map((item) => `- ${item}`).join("\n");

  return `PÁGINA ATUAL: ${profile.name}\nFinalidade: ${profile.purpose}\nConceitos desta página:\n${concepts}\nRegras específicas desta página:\n${rules}`;
}
