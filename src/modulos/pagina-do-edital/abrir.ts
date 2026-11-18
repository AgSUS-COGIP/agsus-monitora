import {
  enderecoDoEdital,
  type LinhaDoEdital,
} from "../../lib/pagina-do-edital/endereco-do-edital.ts";
import {
  areaDaLinha,
  definirAreaAtual,
  linhasDaArea,
  obterDadosDoMonitoramento,
} from "../../componentes/dados-do-monitoramento.ts";

/*
  "Abrir página do edital" (gaveta da Visão geral, Editais, Cronograma, busca
  global): vai à página do edital (`/<área>/edital/<número-ano>`). Leve, sem
  React, para não puxar a página para o pacote de quem chama. A navegação
  (`window.navigate`, chamada na hora do clique) confere a permissão, empilha
  o endereço e guarda de onde a pessoa veio (o "Voltar" da página).
*/
export type JanelaDaPaginaDoEdital = {
  navigate?: (view: string, extras?: { edital?: string }) => unknown;
};

export function abrirPaginaDoEdital(
  linha: LinhaDoEdital,
  linhasDaArea: readonly LinhaDoEdital[] | null | undefined,
  janela = globalThis.window as JanelaDaPaginaDoEdital | undefined,
): boolean {
  const edital = enderecoDoEdital(linha, linhasDaArea);
  if (!edital || typeof janela?.navigate !== "function") return false;
  return janela.navigate("edital", { edital }) !== false;
}

/**
 * Da busca global, que acha editais de todas as áreas da pessoa: a página
 * abre na área do edital (a área atual troca antes de navegar e volta se a
 * navegação recusar).
 */
export function abrirPaginaDoEditalNaArea(
  linha: LinhaDoEdital,
  todas: readonly LinhaDoEdital[] | null | undefined,
  janela = globalThis.window as JanelaDaPaginaDoEdital | undefined,
): boolean {
  const antes = obterDadosDoMonitoramento().areaAtual;
  const area = areaDaLinha(linha) || antes;
  if (area !== antes) definirAreaAtual(area);
  const abriu = abrirPaginaDoEdital(linha, linhasDaArea(todas, area), janela);
  if (!abriu && area !== antes) definirAreaAtual(antes);
  return abriu;
}
