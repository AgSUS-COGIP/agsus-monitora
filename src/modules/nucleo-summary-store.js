import { exigirSessao } from "../lib/sessao.js";
import { getSupabaseClient } from "../lib/supabaseClient.js";

const RPC_SUMMARY = "get_nucleo_cronograma_resumo";
export const NUCLEO_SUMMARY_TTL_MS = 30_000;

async function loadSummaryFromSupabase() {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("Supabase indisponível.");
  await exigirSessao(sb);

  const startedAt = globalThis.performance?.now?.();
  try {
    const { data, error } = await sb.rpc(RPC_SUMMARY);
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    document.dispatchEvent(
      new CustomEvent("agsus:nucleo-metric", {
        detail: {
          name: "summary-rpc",
          durationMs: performance.now() - startedAt,
          rows: rows.length,
          payloadBytes: new TextEncoder().encode(JSON.stringify(rows)).length,
        },
      }),
    );
    return rows;
  } finally {
    if (Number.isFinite(startedAt) && globalThis.performance?.measure) {
      const duration = globalThis.performance.now() - startedAt;
      try {
        globalThis.performance.measure("agsus:nucleo-summary-rpc", {
          start: startedAt,
          duration,
        });
      } catch {
        // Navegadores sem suporte à assinatura moderna de performance.measure.
      }
    }
  }
}

export function createNucleoSummaryStore({
  loader,
  ttlMs = NUCLEO_SUMMARY_TTL_MS,
  now = () => Date.now(),
} = {}) {
  if (typeof loader !== "function")
    throw new TypeError("createNucleoSummaryStore exige um loader.");

  let cache = null;
  let expiresAt = 0;
  let generation = 0;
  let inFlight = null;
  let requestCount = 0;

  const hasFreshCache = () =>
    Array.isArray(cache) && Number(now()) < Number(expiresAt);

  function get({ force = false } = {}) {
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

    if (!force && hasFreshCache()) return Promise.resolve(cache);

    const requestGeneration = generation;
    requestCount += 1;

    let promise;
    promise = Promise.resolve()
      .then(loader)
      .then((data) => {
        const rows = Array.isArray(data) ? data : [];
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

  function peek() {
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

const sharedStore = createNucleoSummaryStore({
  loader: loadSummaryFromSupabase,
});

export function getNucleoSummary(options) {
  return sharedStore.get(options);
}

export function invalidateNucleoSummary() {
  sharedStore.invalidate();
}

export function peekNucleoSummary() {
  return sharedStore.peek();
}

export function nucleoSummarySnapshot() {
  return sharedStore.snapshot();
}
