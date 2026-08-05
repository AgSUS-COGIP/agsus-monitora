const GENERIC_LOADING_COPY = new Set([
  "",
  "aguarde",
  "aguarde um momento",
  "carregando",
  "carregando painel",
  "preparando dados",
]);

const APP_STAGES = [
  {
    maxProgress: 10,
    title: "Preparando o AgSUS Monitora",
    detail: "Validando o ambiente e preparando sua sessão segura.",
  },
  {
    maxProgress: 35,
    title: "Carregando configurações",
    detail: "Aplicando permissões, painéis e preferências do seu perfil.",
  },
  {
    maxProgress: 65,
    title: "Buscando dados atualizados",
    detail: "Consultando indicadores e registros do monitoramento.",
  },
  {
    maxProgress: 90,
    title: "Organizando o painel",
    detail: "Montando gráficos, filtros, mapas e tabelas.",
  },
  {
    maxProgress: 100,
    title: "Finalizando o painel",
    detail: "Conferindo os últimos detalhes antes de liberar a navegação.",
  },
];

const ANALISES_STAGES = [
  {
    maxProgress: 15,
    title: "Preparando o painel de análises",
    detail: "Validando sua sessão e o recorte inicial.",
  },
  {
    maxProgress: 45,
    title: "Buscando análises curriculares",
    detail: "Consultando registros, responsáveis e indicadores.",
  },
  {
    maxProgress: 75,
    title: "Organizando os resultados",
    detail: "Montando gráficos, prioridades e a fila operacional.",
  },
  {
    maxProgress: 100,
    title: "Finalizando o painel de análises",
    detail: "Aplicando filtros e conferindo os dados exibidos.",
  },
];

export function normalizeLoadingProgress(value) {
  const numeric = Number.parseFloat(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, numeric));
}

export function isGenericLoadingCopy(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/[.!…]+$/u, "");
  return GENERIC_LOADING_COPY.has(normalized);
}

export function getLoadingStage({
  context = "app",
  progress = 0,
  elapsedMs = 0,
} = {}) {
  const stages = context === "analises" ? ANALISES_STAGES : APP_STAGES;
  const normalizedProgress = normalizeLoadingProgress(progress);
  const stageIndex = Math.max(
    0,
    stages.findIndex((stage) => normalizedProgress <= stage.maxProgress),
  );
  const stage = stages[stageIndex] || stages.at(-1);
  const delayed = elapsedMs >= 12_000;
  const canRetry = elapsedMs >= 25_000;

  let delayMessage = "";
  if (canRetry) {
    delayMessage =
      "A conexão está demorando mais que o normal. Você pode tentar novamente sem alterar seus dados.";
  } else if (delayed) {
    delayMessage =
      "Esta etapa está levando um pouco mais de tempo, mas o processamento continua.";
  }

  return {
    ...stage,
    progress: normalizedProgress,
    step: stageIndex + 1,
    totalSteps: stages.length,
    delayed,
    canRetry,
    delayMessage,
  };
}
