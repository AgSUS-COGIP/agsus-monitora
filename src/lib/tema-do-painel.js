/*
  Tema do painel de análises no quadro (analises.html): a chave em que ele
  guarda a escolha (o escuro é `html[data-theme="dark"]`, que o CSS de
  src/analises/ sabe desenhar) e a paleta dos gráficos (Chart.js). As telas do
  app (Recursos, Entrevistas, Seleção) seguem o tema do app (src/app/tema.js) e
  usam esta paleta só como reserva dos tokens (paletaDosGraficos, src/ui/).
*/
export const CHAVE_DO_TEMA_DO_PAINEL = "agsus_analises_theme_v3";

/* Cores dos gráficos: a série de status e a grade/texto do tema. */
export function paletaDoPainel(escuro) {
  return {
    grid: escuro ? "rgba(255,255,255,.08)" : "rgba(7,59,121,.09)",
    text: escuro ? "#dbe8f5" : "#526780",
    ok: "#2ca25f",
    bad: "#e45757",
    warn: "#e2a400",
    review: "#2f74c0",
    blue: "#0f5db7",
    surface: escuro ? "#0f1c2e" : "#fff",
  };
}
