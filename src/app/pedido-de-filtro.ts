/*
  "Abrir com o filtro": quando a Aya responde com um número ("há 12 análises
  pendentes no edital 93/2026"), o botão Abrir leva à tela já recortada. A
  Aya deixa aqui o pedido (`pedirFiltro`) e navega; a tela pega o pedido que
  é dela (`consumirPedidoDeFiltro`) uma vez só, quando os dados estão
  prontos, e aplica nos filtros que ela já tem (as regras de cada tela ficam
  em src/lib/aya/filtro-da-aya.ts). Sem DOM e sem evento do navegador: um valor
  guardado, com validade curta, para um pedido velho não recortar uma
  abertura qualquer. A tela que já está montada fica sabendo pela assinatura
  (`usarPedidoDeFiltro`).

  `filtro`: `{ edital?: "93/2026", metrica?: "pendente" | "aguardandoParecer"… }`.
*/
import { useEffect, useSyncExternalStore } from "react";

/** O que quem pede manda (a Aya, um aviso de conferência, outra tela): qualquer objeto, copiado raso. */
export type FiltroPedido = object;

/** O filtro que a tela recebe ao consumir o pedido. */
export type FiltroDoPedido = {
  edital?: string;
  /** O id do edital (monitoramento), quando quem pede tem: a Visão geral. */
  editalId?: string;
  metrica?: string;
  busca?: string;
  entrevista?: string;
  candidatos?: readonly (string | number)[];
  /** O caso de um aviso que virou pendência do edital: a Lista de aprovados abre a aba Pendências. */
  pendencias?: boolean;
  /** O código da vaga que segue entre as etapas (src/lib/navegacao/fluxo-das-etapas.ts). */
  vaga?: string;
  /** Relatórios: o relatório que abre (src/componentes/ver-em-relatorios.tsx). */
  relatorio?: string;
  /** Relatórios: o recorte do montador ("visao-geral"). */
  origem?: string;
  /** Relatórios: os editais do Resumo por cargo e status. */
  editais?: readonly string[];
};

interface PedidoGuardado {
  view: string;
  filtro: FiltroDoPedido;
  em: number;
}

const VALIDADE_MS = 15 * 1000;

let pedido: PedidoGuardado | null = null;
let versao = 0;
const ouvintes = new Set<() => void>();

export function pedirFiltro(
  view: unknown,
  filtro: FiltroPedido = {},
  agora: number = Date.now(),
): void {
  pedido = {
    view: String(view || ""),
    filtro: { ...filtro } as FiltroDoPedido,
    em: agora,
  };
  versao += 1;
  for (const ouvinte of ouvintes) ouvinte();
}

/**
 * O filtro pedido para esta tela (e o pedido some), ou `null`. Com `aceita`,
 * o pedido ainda válido que a tela não aceita agora (outro edital aberto)
 * fica para depois.
 */
export function consumirPedidoDeFiltro(
  view: unknown,
  agora: number = Date.now(),
  aceita?: (filtro: FiltroDoPedido) => boolean,
): FiltroDoPedido | null {
  if (!pedido || pedido.view !== String(view || "")) return null;
  const valido = agora - pedido.em <= VALIDADE_MS;
  if (valido && aceita && !aceita(pedido.filtro)) return null;
  const filtro = pedido.filtro;
  pedido = null;
  return valido ? filtro : null;
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}
const obterVersao = () => versao;

/**
 * Na tela: quando chega um pedido para `view` e a tela está `pronta` (dados
 * carregados), chama `aplicar(filtro)` uma vez. `aceita` segura o pedido até
 * a tela estar nele (a vaga espera o edital do pedido abrir).
 */
export function usarPedidoDeFiltro(
  view: string,
  pronta: boolean,
  aplicar: (filtro: FiltroDoPedido) => void,
  aceita?: (filtro: FiltroDoPedido) => boolean,
): void {
  const atual = useSyncExternalStore(assinar, obterVersao, obterVersao);
  useEffect(() => {
    if (!pronta) return;
    const filtro = consumirPedidoDeFiltro(view, Date.now(), aceita);
    if (filtro) aplicar(filtro);
    /*
      `aplicar` muda a cada desenho; disparam o pedido novo, a prontidão e,
      com `aceita`, cada desenho (o pedido segurado espera a tela chegar nele).
    */
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ver acima.
  }, [atual, pronta, view, aceita]);
}
