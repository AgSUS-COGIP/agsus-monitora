/*
  A ponte do chat com o resto do app, sem React (o legado também importa).

  - Abrir uma conversa de fora do painel: o botão "Conversa" de Editais e da
    Classificação e o "Mensagem" de Pessoas online avisam por evento em
    `document`; o módulo do chat (chat.jsx) escuta e abre.
  - A tela atual, para "Compartilhar esta tela": a página e a área vêm do estado
    que a Aya já acompanha (src/modulos/aya/estado.js, só leitura) e o edital
    aberto, de quem o abre (`definirEditalDaTela`).
  - Ir para um link recebido: só dentro do app (view, área, seção, edital —
    aberto na Classificação, em Conduzir entrevistas e na Avaliação
    documental — e ficha da avaliação documental), pela navegação do legado
    (`window.navigate`); o link é conferido de novo (`linkDaTela`) antes de
    qualquer coisa. A ficha abre pela Fila da Avaliação documental
    (`avaliacaoDocumentalController`): o banco confere a permissão de quem
    abre (reservar_ficha) e avisa se não puder.
  - "Compartilhar esta ficha" (lateral da ficha): `compartilharNoChat(link)`
    avisa por evento; o painel abre para escolher a conversa.
*/

import { fichaPeloCodigo } from "../../lib/avaliacao-documental/fila.js";
import { linkDaTela } from "../../lib/chat.js";
import { definirAreaAtual } from "../../componentes/dados-do-monitoramento.ts";
import { abrirSecaoDeConfiguracao } from "../configuracoes/secoes.js";
import { obterPaginaDaAya } from "../aya/estado.js";

export const EVENTO_ABRIR_CONVERSA = "agsus:chat-abrir-conversa";
export const EVENTO_COMPARTILHAR = "agsus:chat-compartilhar";

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

/**
 * Manda um cartão (link interno conferido) para uma conversa: o painel abre
 * na lista para escolher qual. Devolve false se o link não vale.
 */
export function compartilharNoChat(entrada, documento = globalThis.document) {
  const link = linkDaTela(entrada);
  if (!link) return false;
  const janela = documento?.defaultView || globalThis;
  documento?.dispatchEvent(
    new janela.CustomEvent(EVENTO_COMPARTILHAR, { detail: { link } }),
  );
  return true;
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
  if (link.edital && link.view === "conduzir-entrevistas")
    void Promise.resolve(
      janela.conduzirEntrevistasController?.abrirEdital?.(link.edital.id),
    ).catch(() => {});
  if (link.edital && link.view === "avaliacao-documental")
    void abrirNaAvaliacaoDocumental(link, janela).catch(() => {});
  return true;
}

/*
  Avaliação documental: o edital na Fila e, com a ficha, a ficha (pelo id ou,
  sem ele, pelo código do candidato). Quem não pode ver o edital ou a ficha
  recebe o aviso do próprio módulo (o banco recusa).
*/
async function abrirNaAvaliacaoDocumental(link, janela) {
  const controle = janela.avaliacaoDocumentalController;
  if (!controle?.estado || !controle?.fila) return false;
  controle.estado.mudarVisao?.("fila");
  if (controle.estado.obter?.().editalId !== link.edital.id)
    await controle.estado.escolherEdital?.(link.edital.id);
  if (!link.ficha) return true;
  if (controle.fila.obter?.().editalId !== link.edital.id)
    await controle.fila.carregar?.(link.edital.id);
  const fichaId =
    link.ficha.id ||
    fichaPeloCodigo(
      controle.fila.obter?.().dados?.candidatos,
      link.ficha.codigo,
    )?.ficha?.id;
  if (!fichaId) return false;
  return controle.fila.abrir?.(fichaId);
}
