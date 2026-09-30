/*
  Aviso (toast) dos painéis do app num quadro (recursos, entrevistas), com o
  visual do painel de análises.
*/
const ICONE_DO_AVISO = {
  error: "fa-circle-exclamation",
  warn: "fa-triangle-exclamation",
};

/*
  O aviso do painel de análises (`.toast` no `#toastHost`): some sozinho em
  alguns segundos. Montado com elementos, sem HTML: a mensagem pode trazer o
  que o banco respondeu.
*/
export function criarAvisoDoPainel(host, duracaoMs = 5200) {
  return (mensagem, tipo = "info") => {
    if (!host) return;
    const aviso = document.createElement("div");
    aviso.className = `toast${tipo === "warn" ? " warn" : tipo === "error" ? " error" : ""}`;
    aviso.setAttribute("role", tipo === "error" ? "alert" : "status");
    const icone = document.createElement("i");
    icone.className = `fa-solid ${ICONE_DO_AVISO[tipo] || "fa-circle-info"}`;
    icone.setAttribute("aria-hidden", "true");
    const texto = document.createElement("span");
    texto.textContent = String(mensagem ?? "");
    aviso.append(icone, texto);
    host.append(aviso);
    setTimeout(() => aviso.remove(), duracaoMs);
  };
}
