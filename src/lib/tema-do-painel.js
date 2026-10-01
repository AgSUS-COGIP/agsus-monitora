/*
  A paleta de reserva dos gráficos (Chart.js) das telas do app: Recursos,
  Entrevistas, Análises curriculares e Seleção seguem o tema do app
  (src/app/tema.js) e leem as cores dos tokens (paletaDosGraficos, src/ui/);
  esta paleta vale quando o CSS não está carregado (testes).
*/
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
