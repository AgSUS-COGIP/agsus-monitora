/* Parecer em blocos: meses de experiência (regra da ficha) e formatação (API pública em ../parecer-em-blocos.ts). */

import { diasDosIntervalos } from "../avaliacao-documental/pontuacao.ts";
import { arredondar } from "../classificacao/numeros.ts";

// ── Meses de experiência (a regra da ficha) ──────────────────────────────

/** Dias corridos que fazem um mês, como na ficha (`dias_por_mes` padrão). */
export const DIAS_POR_MES = 30;

/**
 * Os meses de uma experiência pela regra da ficha: dias corridos com o
 * primeiro e o último (01/01 a 30/01 = 30 dias = 1 mês), divididos por 30,
 * só os inteiros. Antes era a conta do simulador (meses de calendário, sem o
 * dia final), que dava 0 mês nesse exemplo e divergia da ficha.
 */
export function mesesDaExperiencia(inicio: string, fim: string): number {
  if (!inicio || !fim) return 0;
  return Math.floor(diasDosIntervalos([{ inicio, fim }]) / DIAS_POR_MES);
}

/**
 * O total das experiências que atendem, sem as sobreposições, pela regra da
 * ficha (`diasDosIntervalos` de avaliacao-documental/pontuacao.ts): une os
 * intervalos (o que começa no dia seguinte emenda), conta os dias com o
 * primeiro e o último e divide por 30, só os inteiros.
 */
export function totalSemSobreposicao(
  itens: readonly { atende: boolean; inicio: string; fim: string }[],
  pontosPorMes = 0.2,
): { meses: number; pontos: number } {
  const intervalos = itens
    .filter((item) => item.atende && item.inicio && item.fim)
    .map(({ inicio, fim }) => ({ inicio, fim }));
  const meses = Math.floor(diasDosIntervalos(intervalos) / DIAS_POR_MES);
  return { meses, pontos: meses * pontosPorMes };
}

// ── Formatação (a do simulador) ──────────────────────────────────────────

/** formatDate do simulador: "AAAA-MM-DD" → "DD/MM/AAAA"; vazio → "__/__/____". */
export function dataDoParecer(texto: string | null | undefined): string {
  if (!texto) return "__/__/____";
  const partes = texto.split("-");
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : texto;
}

/**
 * Um decimal com vírgula, meio para cima sem o erro do float: 1,45 vira
 * "1,5" (o `toFixed(1)` puro dava "1,4", porque 1,45 é 1,4499… no binário).
 */
export const pontosDoParecer = (valor: number) =>
  (arredondar(valor, 1) ?? 0).toFixed(1).replace(".", ",");

export function texto(valor: unknown): string {
  return valor === null || valor === undefined ? "" : String(valor).trim();
}
