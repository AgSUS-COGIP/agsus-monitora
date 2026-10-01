/*
  Liga as regras de visual-polish.css (cards, mapa, legenda, tela de acesso),
  que dependem da classe no body.
*/
export function initVisualPolish() {
  const start = () => {
    document.body.classList.add("visual-polish-ready");
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
}
