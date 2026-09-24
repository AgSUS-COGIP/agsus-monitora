import { escapeHtml } from "../lib/sanitize.js";

/*
  Notificação curta (toast) do MONITORA.

  Era um bloco de cor saturada (verde, vermelho, amarelo) com texto branco em
  negrito. Agora é um cartão claro com um ícone na cor do estado — o mesmo
  padrão dos KPIs: a cor mora no ícone, o texto fica legível em qualquer tipo.

  `toast(mensagem, tipo)` em legacy-app.js continua sendo a porta de entrada
  (78 chamadas); ela só delega para cá.
*/

export const DURACAO_MS = 4500;
const SAIDA_MS = 180;

// A caixa (#toastBox) já é aria-live="polite"; só o erro interrompe o leitor.
const TIPOS = {
  ok: { icone: "fa-circle-check", papel: "" },
  info: { icone: "fa-circle-info", papel: "" },
  warn: { icone: "fa-triangle-exclamation", papel: "" },
  error: { icone: "fa-circle-xmark", papel: "alert" },
};

export function normalizarTipo(tipo) {
  return Object.hasOwn(TIPOS, tipo) ? tipo : "ok";
}

function fechar(elemento) {
  if (!elemento.isConnected || elemento.dataset.saindo) return;
  elemento.dataset.saindo = "1";
  elemento.classList.add("is-saindo");
  setTimeout(() => elemento.remove(), SAIDA_MS);
}

export function mostrarNotificacao(caixa, mensagem, tipo = "ok") {
  if (!caixa) return null;
  const chave = normalizarTipo(tipo);
  const { icone, papel } = TIPOS[chave];
  const elemento = caixa.ownerDocument.createElement("div");
  elemento.className = `toast ${chave}`;
  if (papel) elemento.setAttribute("role", papel);
  elemento.innerHTML =
    `<i class="fa-solid ${icone} toast-icone" aria-hidden="true"></i>` +
    `<p class="toast-texto">${escapeHtml(mensagem)}</p>` +
    `<button type="button" class="toast-fechar" aria-label="Fechar notificação">` +
    `<i class="fa-solid fa-xmark" aria-hidden="true"></i></button>`;
  elemento
    .querySelector(".toast-fechar")
    .addEventListener("click", () => fechar(elemento));
  caixa.appendChild(elemento);

  // Parado sob o mouse não some: dá tempo de ler uma mensagem longa.
  let restante = DURACAO_MS;
  let inicio = Date.now();
  let temporizador = setTimeout(() => fechar(elemento), restante);
  elemento.addEventListener("mouseenter", () => {
    clearTimeout(temporizador);
    restante -= Date.now() - inicio;
  });
  elemento.addEventListener("mouseleave", () => {
    inicio = Date.now();
    temporizador = setTimeout(() => fechar(elemento), Math.max(restante, 1200));
  });
  return elemento;
}
