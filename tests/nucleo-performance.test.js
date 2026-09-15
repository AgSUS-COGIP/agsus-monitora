import { execFileSync } from "node:child_process";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ client: null }));
vi.mock("../src/lib/supabaseClient.js", () => ({
  getSupabaseClient: () => mocks.client,
}));
vi.mock("../src/lib/sessao.js", () => ({
  exigirSessao: async () => ({ user: { id: "benchmark" } }),
}));

const listeners = [];
afterEach(() => {
  for (const args of listeners.splice(0)) document.removeEventListener(...args);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// Optional historical benchmark needs the base commit; normal shallow CI runs
// only the current implementation. Timings are simulated, never production data.
for (const version of ["before", "after"]) {
  it.skipIf(version === "before" && process.env.NUCLEO_BENCHMARK !== "1")(
    `Núcleo: medição ${version}`,
    async () => {
      vi.resetModules();
      vi.useFakeTimers({
        toFake: [
          "setTimeout",
          "clearTimeout",
          "Date",
          "requestAnimationFrame",
          "cancelAnimationFrame",
        ],
      });
      vi.setSystemTime(100_000);
      const data = Array.from({ length: 100 }, (_, i) => ({
        id: String(i),
        unidade: `DSEI ${i}`,
        edital: `Edital ${i}`,
        alerta_tipo: "incompleto",
        status: "Planejado",
      }));
      document.body.innerHTML = `<button data-view="nucleo">Abrir</button><input id="nucleoSearch"><section id="page-nucleo" class="active"><table><tbody id="nucleoRows">${data.map((r) => `<tr data-record-id="${r.id}"><td>${r.unidade}</td><td>${r.edital}</td><td>Planejado</td><td>Etapa</td><td></td></tr>`).join("")}</tbody></table></section>`;
      const add = document.addEventListener.bind(document);
      vi.spyOn(document, "addEventListener").mockImplementation((...args) => {
        listeners.push(args);
        add(...args);
      });
      let active = 0,
        peak = 0,
        calls = 0;
      const rpc = async () => {
        calls++;
        active++;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 100));
        active--;
        return { data };
      };
      mocks.client = { rpc, auth: { onAuthStateChange: () => {} } };
      const timer = vi.spyOn(window, "setTimeout");
      let gridWrites = 0,
        badgeWrites = 0;
      const observer = new MutationObserver((records) => {
        gridWrites += records.filter(
          (r) => r.target.id === "nucleoKpiGrid" && r.type === "childList",
        ).length;
        badgeWrites += records.filter(
          (r) =>
            r.target.classList?.contains("nucleo-row-alert") &&
            r.type === "childList",
        ).length;
      });
      observer.observe(document.body, { childList: true, subtree: true });
      if (version === "before") {
        const evaluate = (path, result, injected = {}) => {
          const source = execFileSync(
            "git",
            [
              "show",
              `${process.env.NUCLEO_BASE_REF || "c263f8b86abd7faeb342edb313d154ec7953cc9a"}:${path}`,
            ],
            { encoding: "utf8" },
          )
            .replace(/^import[\s\S]*?from ["'][^"']+["'];\r?\n/gm, "")
            .replace(/export /g, "");
          const args = {
            getSupabaseClient: () => mocks.client,
            exigirSessao: async () => ({}),
            ...injected,
          };
          return new Function(
            ...Object.keys(args),
            `${source}; return ${result};`,
          )(...Object.values(args));
        };
        const store = evaluate(
          "src/modules/nucleo-summary-store.js",
          "({getNucleoSummary, invalidateNucleoSummary})",
        );
        evaluate(
          "src/modules/nucleo-operational.js",
          "initNucleoOperationalSafe",
          store,
        )();
        evaluate(
          "src/modules/nucleo-cronograma-tools.js",
          "initNucleoCronogramaTools",
        )();
      } else {
        const { initNucleoOperationalSafe } =
          await import("../src/modules/nucleo-operational.js");
        const { initNucleoCronogramaTools } =
          await import("../src/modules/nucleo-cronograma-tools.js");
        initNucleoOperationalSafe();
        initNucleoCronogramaTools();
      }
      document.dispatchEvent(new Event("agsus:nucleo-rendered"));
      let ready = null;
      for (let elapsed = 0; elapsed < 1500; elapsed += 10) {
        if (elapsed === 10)
          document.dispatchEvent(
            new CustomEvent("agsus:nucleo-cronograma-loaded", {
              detail: { id: "0" },
            }),
          );
        if ([300, 600, 900].includes(elapsed)) {
          document.querySelector('[data-view="nucleo"]').click();
          document.dispatchEvent(new Event("agsus:nucleo-rendered"));
        }
        if (elapsed >= 400 && elapsed < 450)
          document
            .getElementById("nucleoSearch")
            .dispatchEvent(new Event("input", { bubbles: true }));
        await vi.advanceTimersByTimeAsync(10);
        if (
          ready === null &&
          document.querySelectorAll(".nucleo-row-alert").length === 100
        )
          ready = elapsed + 10;
      }
      console.log(
        "NUCLEO_BENCHMARK",
        JSON.stringify({
          version,
          rows: 100,
          rpcCalls: calls,
          peakConcurrent: peak,
          applicationTimers: timer.mock.calls.length - calls,
          kpiGridWrites: gridWrites,
          badgeWrites,
          simulatedReadyMs: ready,
        }),
      );
      observer.disconnect();
      expect(ready).not.toBeNull();
      if (version === "after") {
        expect(calls).toBe(1);
        expect(peak).toBe(1);
        expect(timer.mock.calls.length - calls).toBe(0);
        expect(badgeWrites).toBe(100);
        expect(gridWrites).toBe(2); // Loading state, then the six KPIs.
      } else {
        expect(calls).toBe(2);
        expect(peak).toBe(2);
      }
    },
  );
}
