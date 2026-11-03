import { afterEach, describe, expect, it, vi } from "vitest";

/*
  O retrato de desempenho do front (frontend_performance) vai de carona na
  batida da presença quando ela está ligada (src/app/sistema.ts), sem chamada
  própria; sem ela, numa chamada à parte, como antes.
*/

const rpc = vi.fn(async () => ({ data: 1, error: null }));
vi.mock("../src/lib/supabaseClient", () => ({
  getSupabaseClient: () => ({
    rpc,
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "u1" } } } }),
    },
  }),
}));

const {
  PERFORMANCE_REPORT_DELAY_MS,
  definirEnvioDoRetrato,
  eventoDoRetrato,
  installFrontendPerformanceMonitor,
} = await import("../src/lib/frontend-performance-monitor");

afterEach(() => {
  vi.useRealTimers();
  definirEnvioDoRetrato(null);
});

describe("retrato de desempenho de carona", () => {
  it("o evento é o de sempre: origem, aba e versão do monitor", () => {
    expect(eventoDoRetrato({ x: 1 })).toEqual({
      evento: "frontend_performance",
      tela: "monitora",
      origem: "frontend",
      detalhes: { x: 1 },
      client_session_id: "performance-monitor",
      app_version: "frontend-performance-v1",
    });
  });

  it("com o envio de carona ligado, não chama o banco por conta própria", async () => {
    vi.useFakeTimers();
    const envio = vi.fn();
    definirEnvioDoRetrato(envio);
    installFrontendPerformanceMonitor();
    await vi.advanceTimersByTimeAsync(PERFORMANCE_REPORT_DELAY_MS);
    expect(envio).toHaveBeenCalledTimes(1);
    expect(envio.mock.calls[0][0]).toMatchObject({
      evento: "frontend_performance",
      origem: "frontend",
      client_session_id: "performance-monitor",
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});
