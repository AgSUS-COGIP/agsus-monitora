/*
  O resumo dos cronogramas da Equipe Núcleo (`get_nucleo_cronograma_resumo`):
  uma linha por edital, com o tipo de alerta e quantas etapas ele tem. Alimenta
  os indicadores da página e a lista de "copiar cronograma de outro edital" —
  os dois leem a MESMA carga, com cache curto, e salvar um cronograma o
  invalida.
*/

import type { SupabaseClient } from "@supabase/supabase-js";
import { exigirSessao } from "../../lib/sessao";
import type { ItemDoResumo } from "../../lib/editais-do-nucleo.ts";

const RPC_SUMMARY = "get_nucleo_cronograma_resumo";
export const NUCLEO_SUMMARY_TTL_MS = 30_000;

/** A resposta de uma RPC no que a página lê. */
export type RespostaDaRpc = {
  data: unknown;
  error: { message?: string } | null;
};

/** O cliente Supabase no que o resumo usa (o do app ou um falso nos testes). */
export interface ClienteDoResumo {
  // Método (não propriedade): aceita o cliente tipado do app.
  rpc(
    nome: string,
    argumentos?: Record<string, unknown>,
  ): PromiseLike<RespostaDaRpc>;
  auth?: Partial<Pick<SupabaseClient["auth"], "getSession">> | null;
}

/** As opções do cache do resumo. */
export interface OpcoesDoCacheDoResumo {
  /** Obrigatório: sem ele, `createNucleoSummaryStore` lança. */
  loader?: () => unknown;
  ttlMs?: number;
  now?: () => number;
}

export async function carregarResumoDoNucleo(
  sb: ClienteDoResumo | null | undefined,
): Promise<ItemDoResumo[]> {
  if (!sb) throw new Error("Supabase indisponível.");
  await exigirSessao(sb);
  const { data, error } = await sb.rpc(RPC_SUMMARY);
  if (error) throw error;
  // A fronteira com o banco: cada linha é um item do resumo.
  return Array.isArray(data) ? (data as ItemDoResumo[]) : [];
}

export function createNucleoSummaryStore<T = ItemDoResumo>({
  loader,
  ttlMs = NUCLEO_SUMMARY_TTL_MS,
  now = () => Date.now(),
}: OpcoesDoCacheDoResumo = {}) {
  if (typeof loader !== "function")
    throw new TypeError("createNucleoSummaryStore exige um loader.");

  let cache: T[] | null = null;
  let expiresAt = 0;
  let generation = 0;
  let inFlight: { generation: number; promise: Promise<T[]> } | null = null;
  let requestCount = 0;

  const hasFreshCache = () =>
    Array.isArray(cache) && Number(now()) < Number(expiresAt);

  function get({ force = false }: { force?: boolean } = {}): Promise<T[]> {
    if (inFlight) {
      const active = inFlight;

      // Chamadas equivalentes compartilham exatamente a mesma carga.
      if (active.generation === generation) return active.promise;

      // O cache foi invalidado durante uma carga antiga (por exemplo, após
      // salvar um cronograma). Espera a requisição antiga terminar para manter
      // no máximo uma RPC ativa e, só depois, busca a geração nova.
      return active.promise
        .catch(() => undefined)
        .then(() => get({ force: true }));
    }

    if (!force && hasFreshCache()) return Promise.resolve(cache as T[]);

    const requestGeneration = generation;
    requestCount += 1;

    let promise: Promise<T[]>;
    promise = Promise.resolve()
      .then(loader)
      .then((data) => {
        // O que o loader devolve é a lista de linhas (ou nada).
        const rows = Array.isArray(data) ? (data as T[]) : [];
        if (requestGeneration === generation) {
          cache = rows;
          expiresAt = Number(now()) + Math.max(0, Number(ttlMs) || 0);
        }
        return rows;
      })
      .finally(() => {
        if (inFlight?.promise === promise) inFlight = null;
      });

    inFlight = { generation: requestGeneration, promise };
    return promise;
  }

  function invalidate() {
    generation += 1;
    cache = null;
    expiresAt = 0;
  }

  function peek(): T[] | null {
    return hasFreshCache() ? cache : null;
  }

  function snapshot() {
    return {
      generation,
      hasFreshCache: hasFreshCache(),
      inFlight: Boolean(inFlight),
      requestCount,
      expiresAt,
    };
  }

  return { get, invalidate, peek, snapshot };
}
