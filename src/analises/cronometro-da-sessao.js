/*
  O cronômetro da sessão (`#agsusSessionTimer`, de installSessionLifecycle),
  compacto no rodapé dos painéis abertos sozinhos numa aba — análises e
  recursos. O visual é `.footer #agsusSessionTimer.analises-session-compact`,
  em analises-responsive-fixes.css. Dentro do MONITORA (iframe) o cronômetro
  é o do app principal, e nada disto roda.
*/
export function compactarCronometroDaSessao() {
  const timer = document.getElementById("agsusSessionTimer");
  const footerMeta = document.querySelector(".footer > span:last-child");
  if (!timer || !footerMeta) return;

  timer.classList.add("analises-session-compact");
  timer.setAttribute("aria-label", "Tempo restante da sessão");
  timer.title = "Tempo restante até o encerramento da sessão por inatividade.";

  if (timer.parentElement !== footerMeta) {
    footerMeta.prepend(timer);
  }
}
