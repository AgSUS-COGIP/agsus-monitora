/*
  O mapa da Visão geral recolhido ou aberto (12/11/2026): a escolha é de cada
  pessoa, guardada no navegador dela. Aberto é o padrão, e qualquer valor
  diferente do guardado por esta tela conta como aberto. O mapa continua com a
  altura de sempre quando aberto (pedido de 02/10); recolhido, sobra só o
  cabeçalho e as Fases e os Detalhes sobem.
*/

export const CHAVE_DO_MAPA_RECOLHIDO = "agsus_yeende_mapa_recolhido_v1";

const RECOLHIDO = "recolhido";

/** O valor guardado vira a escolha: só "recolhido" recolhe. */
export function lerMapaRecolhido(valor: string | null | undefined): boolean {
  return valor === RECOLHIDO;
}

/** O que guardar para a escolha (null: apagar, o padrão é aberto). */
export function valorDoMapaRecolhido(recolhido: boolean): string | null {
  return recolhido ? RECOLHIDO : null;
}
