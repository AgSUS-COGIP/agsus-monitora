/*
  O pedido global de estado da mascote (evento `aya:estado`), guardado fora
  do React: todas as araras da tela (a flutuante, a do painel) leem daqui com
  `useSyncExternalStore(assinarPedidoDaAya, obterPedidoDaAya)`. O ouvinte da
  janela entra com o primeiro assinante e sai com o último; o pedido com
  duração expira sozinho.
*/

import {
  EVENTO_ESTADO_DA_AYA,
  lerPedido,
  type EstadoDaMascote,
} from "../../../lib/estado-da-aya.ts";

type Ouvinte = () => void;

const ouvintes = new Set<Ouvinte>();
let atual: EstadoDaMascote | null = null;
let expiracao: ReturnType<typeof setTimeout> | null = null;
let janelaOuvida: Window | null = null;

function publicar(proximo: EstadoDaMascote | null) {
  if (proximo === atual) return;
  atual = proximo;
  for (const ouvinte of [...ouvintes]) ouvinte();
}

/** Aplica um pedido (também usado pelos testes e pela prévia). */
export function aplicarPedidoDaAya(estado: unknown, duracaoMs?: unknown) {
  const pedido = lerPedido(estado, duracaoMs);
  if (!pedido) return;
  if (expiracao) clearTimeout(expiracao);
  expiracao = null;
  if (pedido.estado === "parada") {
    publicar(null);
    return;
  }
  // Mesmo estado pedido de novo: reinicia o tempo (publica por cima).
  if (pedido.estado === atual) {
    atual = null;
  }
  publicar(pedido.estado);
  if (pedido.duracaoMs)
    expiracao = setTimeout(() => {
      expiracao = null;
      publicar(null);
    }, pedido.duracaoMs);
}

function aoPedido(evento: Event) {
  const detalhe = (evento as CustomEvent<unknown>).detail;
  if (!detalhe || typeof detalhe !== "object") return;
  const { estado, duracaoMs } = detalhe as {
    estado?: unknown;
    duracaoMs?: unknown;
  };
  aplicarPedidoDaAya(estado, duracaoMs);
}

export function assinarPedidoDaAya(ouvinte: Ouvinte) {
  ouvintes.add(ouvinte);
  const janela = globalThis.window;
  if (!janelaOuvida && janela?.addEventListener) {
    janela.addEventListener(EVENTO_ESTADO_DA_AYA, aoPedido);
    janelaOuvida = janela;
  }
  return () => {
    ouvintes.delete(ouvinte);
    if (!ouvintes.size && janelaOuvida) {
      janelaOuvida.removeEventListener(EVENTO_ESTADO_DA_AYA, aoPedido);
      janelaOuvida = null;
    }
  };
}

export const obterPedidoDaAya = () => atual;

/** Só para testes: volta ao começo. */
export function reiniciarPedidoDaAya() {
  if (expiracao) clearTimeout(expiracao);
  expiracao = null;
  atual = null;
}
