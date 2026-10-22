/*
  Os status da análise que ainda não têm decisão, sem dependências: usados
  pelo KPI "Pendentes" (analises-curriculares.ts) e pelos marcos de edital
  concluído e fila zerada (comemoracao.js), que não podem importar um ao
  outro (ciclo com a área do painel).

  "Em análise": a ficha da Avaliação documental aberta por alguém (edital com a
  análise no MONITORA). Ainda sem decisão: conta como pendente.
*/
export const STATUS_PENDENTES: readonly string[] = Object.freeze([
  "Pendente",
  "Em análise",
]);
