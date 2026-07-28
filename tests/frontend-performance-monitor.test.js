import { describe, expect, it } from "vitest";
import {
  createPerformanceSnapshot,
  roundMetric,
  summarizeResourceEntries,
} from "../src/lib/frontend-performance-monitor.js";

describe("frontend performance monitor", () => {
  it("arredonda métricas inválidas com segurança", () => {
    expect(roundMetric(12.6)).toBe(13);
    expect(roundMetric("8.2")).toBe(8);
    expect(roundMetric(Number.NaN)).toBe(0);
  });

  it("resume recursos transferidos", () => {
    expect(
      summarizeResourceEntries([
        { transferSize: 1024, decodedBodySize: 2048 },
        { transferSize: 512, decodedBodySize: 1024 },
      ]),
    ).toEqual({
      count: 2,
      transferSize: 1536,
      decodedBodySize: 3072,
    });
  });

  it("cria snapshot técnico sem dados pessoais", () => {
    const snapshot = createPerformanceSnapshot({
      navigationEntry: {
        domInteractive: 1100,
        domContentLoadedEventEnd: 1500,
        loadEventEnd: 2100,
        responseEnd: 700,
      },
      resourceEntries: [{ transferSize: 2048, decodedBodySize: 4096 }],
      longTasks: { count: 2, durationMs: 125.4 },
      requests: { started: 4, completed: 3, failed: 1 },
      memory: {
        usedJSHeapSize: 20 * 1024 * 1024,
        totalJSHeapSize: 30 * 1024 * 1024,
        jsHeapSizeLimit: 100 * 1024 * 1024,
      },
      connection: {
        effectiveType: "4g",
        downlink: 10,
        rtt: 40,
        saveData: false,
      },
      pathname: "/analises.html",
      visibilityState: "visible",
      now: Date.UTC(2026, 6, 28, 12, 0, 0),
    });

    expect(snapshot.pathname).toBe("/analises.html");
    expect(snapshot.navigation.load_event_ms).toBe(2100);
    expect(snapshot.resources.transfer_kb).toBe(2);
    expect(snapshot.requests.failed).toBe(1);
    expect(snapshot.long_tasks.duration_ms).toBe(125);
    expect(snapshot.memory.used_mb).toBe(20);
    expect(snapshot.connection.effective_type).toBe("4g");
    expect(snapshot).not.toHaveProperty("user_id");
  });
});
