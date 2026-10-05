/*
  A ponte do chat com o resto do app, sem React (o legado também importa).

  - Abrir uma conversa de fora do painel: o botão "Conversa" de Editais e da
    Classificação e o "Mensagem" de Pessoas online avisam por evento em
    `document`; o módulo do chat (chat.jsx) escuta e abre.
  - A tela atual, para "Compartilhar esta tela": a página e a área vêm do estado
    que a Aya já acompanha (src/modulos/aya/estado.js, só leitura) e o edital
    aberto, de quem o abre (`definirEditalDaTela`).
  - Ir para um link recebido: só dentro do app (view, área, seção, edital), pela
    navegação do legado (`window.navigate`); o link é conferido de novo
    (`linkDaTela`) antes de qualquer coisa.
*/

import { linkDaTela } from "../../lib/chat.js";
import { definirAreaAtual } from "../../componentes/dados-do-monitoramento.js";
import { abrirSecaoDeConfiguracao } from "../configuracoes/secoes.js";
import { obterPaginaDaAya } from "../aya/estado.js";

export const EVENTO_ABRIR_CONVERSA = "agsus:chat-abrir-conversa";

function avisar(detalhe, documento = globalThis.document) {
  const janela = documento?.defaultView || globalThis;
  documento?.dispatchEvent(
    new janela.CustomEvent(EVENTO_ABRIR_CONVERSA, { detail: detalhe }),
  );
}

/** Abre (ou cria) a conversa do edital: `{ id, titulo }` (id do monitoramento). */
export function abrirConversaDoEdital(edital, documento) {
  if (!edital?.id) return;
  avisar(
    {
      tipo: "EDITAL",
      edital: { id: String(edital.id), titulo: String(edital.titulo || "") },
    },
    documento,
  );
}

/** Abre (ou cria) a conversa direta com a pessoa (auth.users.id). */
export function abrirConversaDireta(usuarioId, documento) {
  if (!usuarioId) return;
  avisar({ tipo: "DIRETA", usuario: String(usuarioId) }, documento);
}

// ── O edital aberto na tela ─────────────────────────────────────────────────

let editalDaTela = null;

/** Quem abre um edital avisa (`{ view, id, titulo }`); `null` ao fechar. */
export function definirEditalDaTela(edital) {
  editalDaTela =
    edital?.id && edital?.view
      ? {
          view: String(edital.view),
          id: String(edital.id),
          titulo: String(edital.titulo || ""),
        }
      : null;
}

/** O link da tela que está aberta agora (para "Compartilhar esta tela"), ou null. */
export function linkDaTelaAtual(pagina = obterPaginaDaAya()) {
  const view = pagina?.view || "";
  const edital = editalDaTela?.view === view ? editalDaTela : null;
  return linkDaTela({
    view,
    area: pagina?.area || "",
    secao: view === "config" ? pagina?.secao || "" : "",
    ...(edital ? { edital: { id: edital.id, titulo: edital.titulo } } : {}),
  });
}

/**
 * Vai para o link (dentro do app). Devolve false se o link não vale ou se a
 * navegação não está disponível; a permissão da página quem confere é o
 * `navigate` do legado (sem permissão, ele avisa).
 */
export function irParaLink(
  entrada,
  { janela = globalThis.window, documento = globalThis.document } = {},
) {
  const link = linkDaTela(entrada);
  if (!link || typeof janela?.navigate !== "function") return false;
  if (link.area) definirAreaAtual(link.area);
  janela.navigate(link.view);
  if (link.view === "config" && link.secao)
    abrirSecaoDeConfiguracao(documento, link.secao);
  if (link.edital && link.view === "classificacao")
    void janela.classificacaoController?.estado
      ?.escolherEdital?.(link.edital.id)
      ?.catch?.(() => {});
  return true;
}
