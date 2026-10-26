import { getSupabaseClient } from "./supabaseClient";

/** Medida de recurso (PerformanceResourceTiming ou parecido). */
type MedidaDeRecurso = { transferSize?: unknown; decodedBodySize?: unknown };

/** Os tempos lidos da navegação (PerformanceNavigationTiming). */
type MedidaDaNavegacao = {
  domInteractive?: unknown;
  domContentLoadedEventEnd?: unknown;
  loadEventEnd?: unknown;
  responseEnd?: unknown;
};

/** `performance.memory` (só Chromium). */
type MemoriaDoNavegador = {
  usedJSHeapSize?: unknown;
  totalJSHeapSize?: unknown;
  jsHeapSizeLimit?: unknown;
};

/** `navigator.connection` (Network Information API, fora do padrão). */
type ConexaoDoNavegador = {
  effectiveType?: unknown;
  downlink?: unknown;
  rtt?: unknown;
  saveData?: unknown;
};

export type RetratoDeDesempenho = ReturnType<typeof createPerformanceSnapshot>;

export const PERFORMANCE_REPORT_DELAY_MS = 20 * 1000;
export const PERFORMANCE_STORAGE_KEY = "agsus_frontend_performance_v1";

const APP_VERSION = "frontend-performance-v1";
const MAX_STORED_SNAPSHOTS = 10;

let installed = false;
let reportHandle: number | null = null;
let originalFetch: typeof fetch | null = null;
let longTaskCount = 0;
let longTaskDurationMs = 0;
let requestStarted = 0;
let requestCompleted = 0;
let requestFailed = 0;
let observer: PerformanceObserver | null = null;

export function roundMetric(value: unknown): number {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round(number) : 0;
}

export function summarizeResourceEntries(
  entries: readonly (MedidaDeRecurso | null | undefined)[] = [],
) {
  return entries.reduce<{
    count: number;
    transferSize: number;
    decodedBodySize: number;
  }>(
    (summary, entry) => {
      summary.count += 1;
      summary.transferSize += Number(entry?.transferSize || 0);
      summary.decodedBodySize += Number(entry?.decodedBodySize || 0);
      return summary;
    },
    { count: 0, transferSize: 0, decodedBodySize: 0 },
  );
}

export function createPerformanceSnapshot({
  navigationEntry,
  resourceEntries = [],
  longTasks = { count: 0, durationMs: 0 },
  requests = { started: 0, completed: 0, failed: 0 },
  memory,
  connection,
  pathname = "/",
  visibilityState = "visible",
  now = Date.now(),
}: {
  navigationEntry?: MedidaDaNavegacao | null;
  resourceEntries?: readonly (MedidaDeRecurso | null | undefined)[];
  longTasks?: { count: unknown; durationMs: unknown };
  requests?: { started: unknown; completed: unknown; failed: unknown };
  memory?: MemoriaDoNavegador | null;
  connection?: ConexaoDoNavegador | null;
  pathname?: string;
  visibilityState?: string;
  now?: number;
} = {}) {
  const resources = summarizeResourceEntries(resourceEntries);
  const navigation: MedidaDaNavegacao = navigationEntry || {};

  return {
    captured_at: new Date(now).toISOString(),
    pathname,
    visibility_state: visibilityState,
    navigation: {
      dom_interactive_ms: roundMetric(navigation.domInteractive),
      dom_content_loaded_ms: roundMetric(navigation.domContentLoadedEventEnd),
      load_event_ms: roundMetric(navigation.loadEventEnd),
      response_end_ms: roundMetric(navigation.responseEnd),
    },
    resources: {
      count: resources.count,
      transfer_kb: roundMetric(resources.transferSize / 1024),
      decoded_kb: roundMetric(resources.decodedBodySize / 1024),
    },
    requests: {
      started: roundMetric(requests.started),
      completed: roundMetric(requests.completed),
      failed: roundMetric(requests.failed),
    },
    long_tasks: {
      count: roundMetric(longTasks.count),
      duration_ms: roundMetric(longTasks.durationMs),
    },
    memory: memory
      ? {
          used_mb: roundMetric(
            Number(memory.usedJSHeapSize || 0) / 1024 / 1024,
          ),
          total_mb: roundMetric(
            Number(memory.totalJSHeapSize || 0) / 1024 / 1024,
          ),
          limit_mb: roundMetric(
            Number(memory.jsHeapSizeLimit || 0) / 1024 / 1024,
          ),
        }
      : null,
    connection: connection
      ? {
          effective_type: String(connection.effectiveType || ""),
          downlink_mbps: Number(connection.downlink || 0),
          rtt_ms: roundMetric(connection.rtt),
          save_data: Boolean(connection.saveData),
        }
      : null,
  };
}

/** `navigator` com a conexão de cada navegador. */
type NavegadorComConexao = Navigator & {
  connection?: ConexaoDoNavegador;
  mozConnection?: ConexaoDoNavegador;
  webkitConnection?: ConexaoDoNavegador;
};

function getPerformanceEntries(type: string): PerformanceEntry[] {
  try {
    return window.performance?.getEntriesByType?.(type) || [];
  } catch {
    return [];
  }
}

function buildCurrentSnapshot() {
  const navigationEntry = (getPerformanceEntries("navigation")[0] ||
    null) as PerformanceNavigationTiming | null;
  const resourceEntries = getPerformanceEntries(
    "resource",
  ) as PerformanceResourceTiming[];

  return createPerformanceSnapshot({
    navigationEntry,
    resourceEntries,
    longTasks: { count: longTaskCount, durationMs: longTaskDurationMs },
    requests: {
      started: requestStarted,
      completed: requestCompleted,
      failed: requestFailed,
    },
    memory:
      (window.performance as Performance & { memory?: MemoriaDoNavegador })
        ?.memory || null,
    connection:
      (navigator as NavegadorComConexao).connection ||
      (navigator as NavegadorComConexao).mozConnection ||
      (navigator as NavegadorComConexao).webkitConnection ||
      null,
    pathname: window.location.pathname || "/",
    visibilityState: document.visibilityState || "visible",
  });
}

function persistSnapshot(snapshot: RetratoDeDesempenho) {
  try {
    const previous: unknown = JSON.parse(
      window.sessionStorage.getItem(PERFORMANCE_STORAGE_KEY) || "[]",
    );
    const next = [...(Array.isArray(previous) ? previous : []), snapshot].slice(
      -MAX_STORED_SNAPSHOTS,
    );
    window.sessionStorage.setItem(
      PERFORMANCE_STORAGE_KEY,
      JSON.stringify(next),
    );
  } catch {
    // Métricas continuam disponíveis em memória mesmo sem sessionStorage.
  }
}

async function reportSnapshot(snapshot: RetratoDeDesempenho) {
  persistSnapshot(snapshot);
  const client = getSupabaseClient();
  if (!client) return;

  try {
    const { data } = await client.auth.getSession();
    if (!data?.session?.user?.id) return;

    await client.rpc("registrar_evento_acesso", {
      p_evento: "frontend_performance",
      p_tela: window.location.pathname.includes("analises")
        ? "analises"
        : "monitora",
      p_origem: "frontend",
      p_detalhes: snapshot,
      p_client_session_id: "performance-monitor",
      p_user_agent: navigator.userAgent || "",
      p_app_version: APP_VERSION,
    });
  } catch (error) {
    console.warn("Falha ao registrar métricas de desempenho:", error);
  }
}

function installFetchMetrics() {
  if (originalFetch || typeof window.fetch !== "function") return;
  originalFetch = window.fetch.bind(window);

  window.fetch = async (...args) => {
    requestStarted += 1;
    try {
      const response = await (originalFetch as typeof fetch)(...args);
      requestCompleted += 1;
      if (!response.ok) requestFailed += 1;
      return response;
    } catch (error) {
      requestFailed += 1;
      throw error;
    }
  };
}

function installLongTaskObserver() {
  if (!("PerformanceObserver" in window)) return;
  try {
    observer = new window.PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longTaskCount += 1;
        longTaskDurationMs += Number(entry.duration || 0);
      }
    });
    observer.observe({ type: "longtask", buffered: true });
  } catch {
    observer = null;
  }
}

function scheduleReport() {
  window.clearTimeout(reportHandle as number | undefined);
  reportHandle = window.setTimeout(() => {
    reportHandle = null;
    void reportSnapshot(buildCurrentSnapshot());
  }, PERFORMANCE_REPORT_DELAY_MS);
}

export function installFrontendPerformanceMonitor() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  installFetchMetrics();
  installLongTaskObserver();
  scheduleReport();
}
