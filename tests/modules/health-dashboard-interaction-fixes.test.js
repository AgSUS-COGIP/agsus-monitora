import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import {
  notifyHealthDashboardFiltersChanged,
  refreshHealthDashboardLayout,
  syncHealthDarkModeClass,
  syncHealthInteractiveFilterStates
} from "../../src/modules/health-dashboard-interaction-fixes.js";

function createDom() {
  return new JSDOM(`<!doctype html><html><body>
    <section id="page-dashboard">
      <div id="statusSummary">
        <div data-etapa-toggle="true"><b>Resultado final do Processo Seletivo</b></div>
        <div data-etapa-toggle="true"><b>Entrevistas</b></div>
      </div>
      <input type="checkbox" data-filter-field="etapa" data-filter-value="Resultado final do Processo Seletivo" checked>
      <input type="checkbox" data-filter-field="status" data-filter-value="Concluído" checked>
      <button data-health-status="Concluído"></button>
      <button data-health-status="Em andamento"></button>
      <canvas id="statusChart"></canvas>
    </section>
  </body></html>`, { url:"https://agsus.example" });
}

describe("correções integradas do dashboard indígena", () => {
  it("espelha data-theme dark na classe esperada pelos estilos legados", () => {
    const dom = createDom();
    const { document } = dom.window;

    document.documentElement.setAttribute("data-theme", "dark");
    expect(syncHealthDarkModeClass(document.documentElement, document.body)).toBe(true);
    expect(document.body.classList.contains("dark-mode")).toBe(true);

    document.documentElement.setAttribute("data-theme", "");
    expect(syncHealthDarkModeClass(document.documentElement, document.body)).toBe(false);
    expect(document.body.classList.contains("dark-mode")).toBe(false);
  });

  it("marca visualmente etapa e status selecionados", () => {
    const dom = createDom();
    const { document } = dom.window;

    expect(syncHealthInteractiveFilterStates(document)).toBe(true);

    const stages = document.querySelectorAll('[data-etapa-toggle="true"]');
    expect(stages[0].classList.contains("is-filter-active")).toBe(true);
    expect(stages[0].getAttribute("aria-pressed")).toBe("true");
    expect(stages[1].classList.contains("is-filter-active")).toBe(false);

    const statuses = document.querySelectorAll("[data-health-status]");
    expect(statuses[0].classList.contains("is-filter-active")).toBe(true);
    expect(statuses[1].classList.contains("is-filter-active")).toBe(false);
  });

  it("emite atualização para o Status Operacional após mudança dos filtros", () => {
    const dom = createDom();
    const { document } = dom.window;
    const dashboardChange = vi.fn();
    const rendered = vi.fn();

    document.getElementById("page-dashboard").addEventListener("change", dashboardChange);
    document.addEventListener("agsus:dashboard-rendered", rendered);

    expect(notifyHealthDashboardFiltersChanged(document)).toBe(true);
    expect(dashboardChange).toHaveBeenCalledTimes(1);
    expect(rendered).toHaveBeenCalledTimes(1);
  });

  it("redimensiona gráfico e dispara resize para o Leaflet", () => {
    const dom = createDom();
    const { window } = dom;
    const chart = { resize:vi.fn(), update:vi.fn() };
    const resizeListener = vi.fn();

    window.Chart = { getChart:vi.fn(() => chart) };
    window.addEventListener("resize", resizeListener);

    expect(refreshHealthDashboardLayout(window, window.document)).toBe(true);
    expect(chart.resize).toHaveBeenCalledTimes(1);
    expect(chart.update).toHaveBeenCalledWith("none");
    expect(resizeListener).toHaveBeenCalledTimes(1);
  });
});
