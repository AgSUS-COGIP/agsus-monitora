/*
  Convite de acesso e situação da pessoa em Configurações › Acessos, sem DOM e
  sem React.

  O convite é só uma mensagem: o link não dá acesso a nada. Quem entra com a
  conta Google do e-mail cadastrado (adicionar_pessoa_acesso) é ligado ao
  perfil no primeiro login. obter_matriz_acessos traz, por pessoa,
  `convite_pendente` (cadastrada, nunca entrou) e `ultimo_acesso`.
*/

export const ASSUNTO_DO_CONVITE = "Convite para o MONITORA";

const FORMATO_DA_DATA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

/** "2026-09-30T15:00:00Z" → "30/09/2026" (horário de Brasília); "" se inválida. */
export function dataCurta(valor) {
  if (!valor) return "";
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? "" : FORMATO_DA_DATA.format(data);
}

/**
 * Situação da pessoa na coluna "Situação":
 *   { tipo: "convite", rotulo: "Convidado · ainda não entrou" }
 *   { tipo: "acesso",  rotulo: "Último acesso em 30/09/2026" }
 *   { tipo: "nunca",   rotulo: "Nunca" }
 */
export function situacaoDoAcesso(usuario) {
  if (usuario?.convite_pendente)
    return { tipo: "convite", rotulo: "Convidado · ainda não entrou" };
  const data = dataCurta(usuario?.ultimo_acesso);
  return data
    ? { tipo: "acesso", rotulo: `Último acesso em ${data}` }
    : { tipo: "nunca", rotulo: "Nunca" };
}

function saudacao(nome) {
  const limpo = String(nome || "")
    .trim()
    .replace(/\s+/g, " ");
  return limpo ? `Olá, ${limpo}!` : "Olá!";
}

/** Texto do convite, pronto para colar num e-mail ou mensagem. */
export function mensagemDoConvite({ nome, email, origem }) {
  const endereco = String(origem || "").replace(/\/+$/, "");
  return [
    `${saudacao(nome)} Você foi convidado(a) para o MONITORA (AgSUS).`,
    `Acesse ${endereco} e entre com sua conta Google ${String(email || "").trim()}.`,
  ].join(" ");
}

/** mailto: para o e-mail convidado, com assunto e corpo já escritos. */
export function linkDoEmailDoConvite({ nome, email, origem }) {
  const destinatario = encodeURIComponent(String(email || "").trim()).replace(
    /%40/g,
    "@",
  );
  const assunto = encodeURIComponent(ASSUNTO_DO_CONVITE);
  const corpo = encodeURIComponent(mensagemDoConvite({ nome, email, origem }));
  return `mailto:${destinatario}?subject=${assunto}&body=${corpo}`;
}

/**
 * Copia o texto: navigator.clipboard quando existe (HTTPS); senão, um
 * <textarea> escondido + execCommand("copy"). true se copiou.
 */
export async function copiarTexto(
  texto,
  {
    clipboard = globalThis.navigator?.clipboard,
    documento = globalThis.document,
  } = {},
) {
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(texto);
      return true;
    } catch {
      // Sem permissão (ou HTTP): tenta o caminho antigo.
    }
  }
  if (!documento?.body || typeof documento.execCommand !== "function")
    return false;
  const campo = documento.createElement("textarea");
  campo.value = texto;
  campo.setAttribute("readonly", "");
  campo.style.position = "fixed";
  campo.style.opacity = "0";
  documento.body.appendChild(campo);
  campo.select();
  try {
    return documento.execCommand("copy") === true;
  } catch {
    return false;
  } finally {
    campo.remove();
  }
}
