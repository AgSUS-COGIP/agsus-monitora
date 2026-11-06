/* Tours da Aya: progresso das trilhas e convite da primeira visita (API pública em ../aya-tours.ts). */

import type { ProgressoDaTrilha, ProgressoDasTrilhas } from "./tipos.ts";
import { TRILHAS } from "./trilhas.ts";

/* ---------- Progresso (o que progresso.js guarda) ---------- */

/** `{ [id]: { passo, concluida } }` a partir do que estava guardado, descartando o resto. */
export function progressoDasTrilhas(bruto: unknown): ProgressoDasTrilhas {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return {};
  const limpo: ProgressoDasTrilhas = {};
  for (const trilha of TRILHAS) {
    const entrada = (bruto as Record<string, unknown>)[trilha.id] as
      { passo?: unknown; concluida?: unknown } | null | undefined;
    if (!entrada || typeof entrada !== "object") continue;
    const passoGuardado = Number(entrada.passo);
    limpo[trilha.id] = {
      passo:
        Number.isInteger(passoGuardado) && passoGuardado >= 0
          ? passoGuardado
          : 0,
      concluida: entrada.concluida === true,
    };
  }
  return limpo;
}

export function comPassoDaTrilha(
  progresso: ProgressoDasTrilhas,
  id: string,
  passoAtual: unknown,
): ProgressoDasTrilhas {
  const anterior = progresso[id] || { passo: 0, concluida: false };
  return {
    ...progresso,
    [id]: { ...anterior, passo: Math.max(0, Number(passoAtual) || 0) },
  };
}

export function comTrilhaConcluida(
  progresso: ProgressoDasTrilhas,
  id: string,
): ProgressoDasTrilhas {
  return { ...progresso, [id]: { passo: 0, concluida: true } };
}

/** "Concluída", "3 de 7" (parou no 3º) ou "7 passos" (não começou). */
export function rotuloDoProgresso(
  entrada: ProgressoDaTrilha | null | undefined,
  total: number,
): string {
  if (entrada?.concluida) return "Concluída";
  if (entrada && entrada.passo > 0)
    return `${Math.min(entrada.passo + 1, total)} de ${total}`;
  return total === 1 ? "1 passo" : `${total} passos`;
}

/** Onde a trilha recomeça: do passo guardado, ou do começo se já foi concluída. */
export function passoParaRetomar(
  entrada: ProgressoDaTrilha | null | undefined,
  total: number,
): number {
  if (!entrada || entrada.concluida || total <= 0) return 0;
  return Math.min(Math.max(0, entrada.passo), total - 1);
}

/** "Passo 3 de 9". */
export const rotuloDoPasso = (indice: number, total: number): string =>
  `Passo ${indice + 1} de ${total}`;

/* ---------- Convite da primeira visita ---------- */

/** As chaves de tour já oferecidas, a partir do que estava guardado. */
export function convitesFeitos(bruto: unknown): string[] {
  return Array.isArray(bruto)
    ? [
        ...new Set(
          (bruto as unknown[]).filter(
            (c) => typeof c === "string" && c,
          ) as string[],
        ),
      ]
    : [];
}

/** Convida para o tour desta tela? Só uma vez por tela ou aba, e nunca durante outro tour. */
export function deveConvidar({
  chave,
  feitos = [],
  ocupado = false,
}: {
  chave: string | null | undefined;
  feitos?: readonly string[];
  ocupado?: boolean;
}): boolean {
  return Boolean(chave) && !ocupado && !feitos.includes(chave!);
}
