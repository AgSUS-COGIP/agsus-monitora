/*
  "Abrir com o filtro": quando a Aya responde com um número ("há 12 análises
  pendentes no edital 93/2026"), o botão Abrir leva à tela já recortada. A
  Aya deixa aqui o pedido (`pedirFiltro`) e navega; a tela pega o pedido que
  é dela (`consumirPedidoDeFiltro`) uma vez só, quando os dados estão
  prontos, e aplica nos filtros que ela já tem (as regras de cada tela ficam
  em src/lib/filtro-da-aya.js). Sem DOM e sem evento do navegador: um valor
  guardado, com validade curta, para um pedido velho não recortar uma
  abertura qualquer. A tela que já está montada fica sabendo pela assinatura
  (`usarPedidoDeFiltro`).

  `filtro`: `{ edital?: "93/2026", metrica?: "pendente" | "aguardandoParecer"… }`.
*/
import { useEffect, useSyncExternalStore } from "react";

const VALIDADE_MS = 15 * 1000;

let pedido = null;
let versao = 0;
const ouvintes = new Set();

export function pedirFiltro(view, filtro = {}, agora = Date.now()) {
  pedido = { view: String(view || ""), filtro: { ...filtro }, em: agora };
  versao += 1;
  for (const ouvinte of ouvintes) ouvinte();
}

/** O filtro pedido para esta tela (e o pedido some), ou `null`. */
export function consumirPedidoDeFiltro(view, agora = Date.now()) {
  if (!pedido || pedido.view !== String(view || "")) return null;
  const valido = agora - pedido.em <= VALIDADE_MS;
  const filtro = pedido.filtro;
  pedido = null;
  return valido ? filtro : null;
}

function assinar(ouvinte) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}
const obterVersao = () => versao;

/**
 * Na tela: quando chega um pedido para `view` e a tela está `pronta` (dados
 * carregados), chama `aplicar(filtro)` uma vez.
 * @param {string} view
 * @param {boolean} pronta
 * @param {(filtro: { edital?: string, metrica?: string, busca?: string }) => void} aplicar
 */
export function usarPedidoDeFiltro(view, pronta, aplicar) {
  const atual = useSyncExternalStore(assinar, obterVersao, obterVersao);
  useEffect(() => {
    if (!pronta) return;
    const filtro = consumirPedidoDeFiltro(view);
    if (filtro) aplicar(filtro);
    // `aplicar` muda a cada desenho; só o pedido novo e a prontidão disparam.
  }, [atual, pronta, view]);
}
