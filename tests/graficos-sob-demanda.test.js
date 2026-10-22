import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { carregarChart, chartCarregado } from "../src/lib/chartjs-global.js";

/*
  O Chart.js baixa no primeiro gráfico, não na entrada: src/main.js importa
  chartjs-global.js, e um import estático de chart.js ali punha o
  vendor-charts no modulepreload da tela de login.
*/
const semComentarios = (arquivo) =>
  readFileSync(arquivo, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

describe("gráficos sob demanda", () => {
  it("nenhum import estático de chart.js no código do app", () => {
    for (const arquivo of ["src/lib/chartjs-global.js", "src/ui/grafico.jsx"])
      expect(semComentarios(arquivo)).not.toMatch(
        /^\s*import\s+(?!type\b)[^;]*from\s+["']chart\.js/m,
      );
  });

  it("baixa uma vez e guarda", async () => {
    expect(chartCarregado()).toBeNull();
    const primeiro = await carregarChart();
    expect(typeof primeiro).toBe("function");
    expect(chartCarregado()).toBe(primeiro);
    expect(await carregarChart()).toBe(primeiro);
  });
});
