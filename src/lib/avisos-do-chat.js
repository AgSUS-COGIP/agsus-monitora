/*
  Avisos de mensagem nova do chat (src/modulos/chat/), sem DOM e sem React:
  quando avisar e como (aviso na tela, notificação do navegador, som), o que o
  aviso mostra (quem mandou, prévia curta) e a pilha de avisos na tela.

  A regra de base (a própria, a apagada, a silenciada, a da conversa à vista)
  é `deveAvisar` (src/lib/chat.js); aqui entram o carregamento inicial e a aba
  em segundo plano.
*/

import { deveAvisar, tituloDaConversa } from "./chat.js";

/** Quantos avisos ficam na tela ao mesmo tempo (os mais novos). */
export const MAXIMO_DE_AVISOS = 3;
/** Quanto tempo o aviso fica na tela, sem o mouse ou o foco nele. */
export const DURACAO_DO_AVISO_MS = 7000;
/** Tamanho máximo da prévia do texto no aviso e na notificação. */
export const LIMITE_DA_PREVIA = 120;

const NENHUM = Object.freeze({ tela: false, navegador: false, som: false });

const texto = (valor) => (typeof valor === "string" ? valor : "");

/**
 * Prévia de uma linha: sem marcação HTML, espaços juntos e cortada em
 * `limite` caracteres com reticências.
 */
export function previaDoAviso(valor, limite = LIMITE_DA_PREVIA) {
  let semMarcacao = texto(valor).replace(
    /<\/?(?:br|p|div|li|tr|h[1-6])\b[^>]*>/gi,
    " ",
  );
  // Repete até estabilizar: "<scr<script>ipt>" não deixa uma marcação nova.
  let anterior;
  do {
    anterior = semMarcacao;
    semMarcacao = semMarcacao.replace(/<[^>]*>/g, "");
  } while (semMarcacao !== anterior);
  const corpo = semMarcacao.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  if (corpo.length <= limite) return corpo;
  return `${corpo.slice(0, Math.max(1, limite - 1)).trimEnd()}…`;
}

/**
 * Como avisar a mensagem que chegou pelo Realtime: `{ tela, navegador, som }`.
 * Nada durante o carregamento inicial (lista ainda não carregada) nem quando
 * `deveAvisar` recusa. Com a aba à vista, aviso na tela; em segundo plano,
 * notificação do navegador (se a pessoa ativou). O som segue a preferência.
 */
export function comoAvisar({
  mensagem,
  eu,
  conversa,
  abertaAVista = false,
  carregado = false,
  abaVisivel = true,
  preferencias = {},
}) {
  if (!carregado) return NENHUM;
  if (!deveAvisar({ mensagem, eu, conversa, abertaAVista })) return NENHUM;
  return {
    tela: Boolean(abaVisivel),
    navegador: !abaVisivel && preferencias.notificacoes === true,
    som: preferencias.som === true,
  };
}

/**
 * O que o aviso mostra: título da conversa, quem mandou (para o avatar) e a
 * prévia. Na conversa direta, o título já é quem mandou.
 */
export function montarAviso({ mensagem, conversa, eu }) {
  const autor =
    (conversa?.participantes || []).find(
      (p) => String(p.id) === String(mensagem?.autor),
    ) || null;
  const direta = conversa?.tipo === "DIRETA";
  return {
    id: String(mensagem?.id || ""),
    conversa: String(mensagem?.conversa || conversa?.id || ""),
    tipo: conversa?.tipo || "DIRETA",
    titulo: tituloDaConversa(conversa, eu) || "Mensagens",
    autor: autor
      ? { id: String(autor.id), nome: texto(autor.nome), avatar: autor.avatar }
      : null,
    remetente: direta ? "" : texto(autor?.nome).trim().split(/\s+/)[0] || "",
    previa: previaDoAviso(mensagem?.texto),
  };
}

/** Título e corpo da notificação do navegador para o aviso. */
export function textoDaNotificacao(aviso) {
  return {
    titulo: aviso?.titulo || "Mensagens",
    corpo: aviso?.remetente
      ? `${aviso.remetente}: ${aviso.previa}`
      : aviso?.previa || "",
  };
}

/**
 * Põe o aviso novo na pilha (mais novo por último). Um aviso por conversa: a
 * mensagem nova troca o aviso anterior da mesma conversa. No máximo `maximo`.
 */
export function empilharAvisos(avisos, novo, maximo = MAXIMO_DE_AVISOS) {
  const lista = Array.isArray(avisos) ? avisos : [];
  if (!novo?.id) return lista;
  const outros = lista.filter((a) => a.conversa !== novo.conversa);
  return [...outros, novo].slice(-Math.max(1, maximo));
}
