import { describe, expect, it } from "vitest";
import { hasMeaningfulMetrics, parseMetricNumber, readDashboardKpiSeries } from "../../src/lib/dashboardMetrics.js";

describe("dashboardMetrics", () => {
  it("converte numeros formatados em pt-BR", () => {
    expect(parseMetricNumber("1.234")).toBe(1234);
    expect(parseMetricNumber("12,5%")).toBe(12.5);
    expect(parseMetricNumber("")).toBe(0);
  });

  it("le series de KPIs a partir do DOM", () => {
    document.body.innerHTML = `
      <b id="kProcessos">10</b>
      <b id="kContratados">4</b>
      <b id="kOciosas">2</b>
      <b id="kCriticos">1</b>
      <b id="kInscritos">100</b>
    `;

    const series = readDashboardKpiSeries(document);
    expect(series.map((item) => item.value)).toEqual([10, 4, 2, 1, 100]);
    expect(hasMeaningfulMetrics(series)).toBe(true);
  });
});
