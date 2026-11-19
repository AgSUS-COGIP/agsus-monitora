/*
  Vai a uma tela da seleção já no edital (e na vaga): a aba "Candidatos" da
  página do edital e a faixa das etapas (src/componentes/fluxo-das-etapas.tsx)
  usam o mesmo destino. O pedido de filtro sai antes da navegação, para a tela
  encontrá-lo ao abrir; a navegação (`window.navigate`, chamada na hora do
  clique) confere a permissão e empilha o endereço, e o Voltar do navegador
  devolve à tela de onde se veio, no edital em que estava.
*/
import {
  idaParaAEtapa,
  type EditalDoFluxo,
} from "../lib/navegacao/fluxo-das-etapas.ts";
import type { TelaDoEdital } from "../lib/pagina-do-edital/pagina-do-edital.ts";
import type { ExtrasDaNavegacao } from "./navegacao.ts";
import { pedirFiltro } from "./pedido-de-filtro.ts";

export type JanelaDaTelaDoEdital = {
  navigate?: (view: string, extras?: ExtrasDaNavegacao) => unknown;
};

/** Devolve false se falta o edital que a tela pede ou a navegação. */
export function abrirTelaDoEdital(
  tela: TelaDoEdital,
  edital: EditalDoFluxo,
  vaga: unknown = "",
  janela = globalThis.window as JanelaDaTelaDoEdital | undefined,
): boolean {
  const ida = idaParaAEtapa(tela, edital, vaga);
  if (!ida || typeof janela?.navigate !== "function") return false;
  if (ida.filtro) pedirFiltro(ida.view, ida.filtro);
  if (ida.extras) janela.navigate(ida.view, ida.extras);
  else janela.navigate(ida.view);
  return true;
}
