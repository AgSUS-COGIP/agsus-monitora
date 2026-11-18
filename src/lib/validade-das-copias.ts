/*
  A validade das cópias de payload no aparelho (src/lib/cache-de-payload.ts),
  à parte para a varredura da abertura do app
  (src/modules/cache-de-payload-indexeddb.ts, na entrada) não levar o resto.

  48 h: a cópia baixada na véspera ainda serve no dia do trabalho de campo, e
  nomes e notas de candidatos não ficam no aparelho além disso. Era 7 dias.
*/
export const VALIDADE_DO_CACHE_MS = 48 * 60 * 60 * 1000;

/** A cópia passou da validade (ou a hora dela é inválida)? O registro do dono não vence. */
export function registroVencido(registro: unknown, agora: number): boolean {
  if (!registro || typeof registro !== "object") return false;
  const idade =
    agora - Number((registro as { guardadoEm?: unknown }).guardadoEm);
  return !(idade >= 0 && idade <= VALIDADE_DO_CACHE_MS);
}
