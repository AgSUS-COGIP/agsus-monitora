import {
  enderecoDoEdital,
  type LinhaDoEdital,
} from "../../lib/pagina-do-edital/pagina-do-edital.ts";

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
