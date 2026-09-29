/*
  Tema claro/escuro dos painéis (análises curriculares e recursos).

  Os dois painéis dividem a escolha: o botão de tema de um vale para o outro
  (a mesma chave no localStorage) e o escuro é `html[data-theme="dark"]`, que
  o CSS de src/analises/ (analises-painel.css) sabe desenhar. A paleta dos
  gráficos (Chart.js) acompanha o tema — é a do painel de análises.
*/
export const CHAVE_DO_TEMA_DO_PAINEL = "agsus_analises_theme_v3";

export function temaEscuroDoPainel(raiz = document.documentElement) {
  return raiz.dataset.theme === "dark";
}

/* Abre com o tema que a pessoa escolheu da última vez. */
export function aplicarTemaSalvoDoPainel(raiz = document.documentElement) {
  try {
    if (localStorage.getItem(CHAVE_DO_TEMA_DO_PAINEL) === "dark")
      raiz.dataset.theme = "dark";
  } catch {
    /* Sem localStorage (janela privada): fica o claro. */
  }
  return temaEscuroDoPainel(raiz);
}

/* Troca o tema e guarda a escolha; devolve se ficou escuro. */
export function alternarTemaDoPainel(raiz = document.documentElement) {
  const escuro = !temaEscuroDoPainel(raiz);
  raiz.dataset.theme = escuro ? "dark" : "";
  try {
    if (escuro) localStorage.setItem(CHAVE_DO_TEMA_DO_PAINEL, "dark");
    else localStorage.removeItem(CHAVE_DO_TEMA_DO_PAINEL);
  } catch {
    /* Sem localStorage: a troca vale até fechar. */
  }
  return escuro;
}

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
