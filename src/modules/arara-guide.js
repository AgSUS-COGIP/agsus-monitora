const GUIDES = Object.freeze({
  dashboard: {
    title: "Saúde Indígena",
    steps: [
      "Use os filtros para delimitar os dados que deseja acompanhar.",
      "Selecione um território no mapa para consultar seus detalhes. Use os controles do mapa para ampliar ou voltar à visão geral.",
      "Confira a legenda e os filtros ativos antes de interpretar os indicadores.",
    ],
  },
  nucleo: {
    title: "Equipe Núcleo",
    steps: [
      "Selecione os filtros para localizar os processos da Equipe Núcleo.",
      "Abra um processo para consultar suas etapas e o cronograma.",
      "Confira os dados antes de salvar alterações. As opções de edição dependem do seu perfil de acesso.",
    ],
  },
  config: {
    title: "Configurações",
    steps: [
      "Escolha a seção de configuração que deseja administrar.",
      "Revise os valores e as permissões antes de salvar.",
      "Ao importar dados, confira o formato solicitado e a mensagem de resultado da operação.",
    ],
  },
  analises: {
    title: "Análises",
    steps: [
      "Use os filtros para selecionar o edital e os registros de interesse.",
      "Consulte os indicadores e a tabela para acompanhar as análises curriculares.",
      "Confira os filtros ativos e a informação de atualização antes de comparar os resultados.",
    ],
  },
});

export function guideForSection(section, title = "") {
  if (section.startsWith("panel:") && /an[aá]lises/i.test(title))
    return GUIDES.analises;
  return (
    GUIDES[section] || {
      title: title || "Painel",
      steps: [
        "Este painel apresenta conteúdo específico da seção selecionada.",
        "Use os filtros e controles disponíveis dentro do painel.",
        "Se o conteúdo não estiver disponível, confira sua permissão de acesso com a administração do MONITORA.",
      ],
    }
  );
}

/** Um único guia por página, atualizado pela navegação, sem timers ou rede. */
export function updateAraraGuide(section, title, host) {
  if (!host) return null;
  const doc = host.ownerDocument;
  let guide = host.querySelector("[data-arara-guide]");
  if (!guide) {
    guide = doc.createElement("details");
    guide.className = "arara-guide";
    guide.dataset.araraGuide = "";
    const summary = doc.createElement("summary");
    const avatar = doc.createElement("img");
    avatar.src = "/assets/arara-azul-monitora.png";
    avatar.alt = "";
    avatar.width = 48;
    avatar.height = 48;
    const label = doc.createElement("span");
    label.textContent = "Arara Azul · Como usar esta seção";
    summary.append(avatar, label);
    guide.append(summary, doc.createElement("p"), doc.createElement("ol"));
    host.append(guide);
  }
  const content = guideForSection(section, title);
  const signature = JSON.stringify(content);
  if (guide.dataset.content === signature) return guide;
  guide.dataset.content = signature;
  guide.open = false;
  guide.querySelector("p").textContent =
    `Vamos explorar ${content.title} no MONITORA?`;
  guide.querySelector("ol").replaceChildren(
    ...content.steps.map((step) => {
      const item = doc.createElement("li");
      item.textContent = step;
      return item;
    }),
  );
  return guide;
}
