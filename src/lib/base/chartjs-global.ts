/*
  O Chart.js sob demanda: só baixa quando o primeiro gráfico aparece
  (src/ui/grafico.jsx). Antes, `import Chart from "chart.js/auto"` aqui —
  importado por src/main.ts — punha o chunk vendor-charts no modulepreload da
  tela de login, que não tem gráfico nenhum.
*/
type ChartJs = typeof import("chart.js/auto").default;

let carregado: ChartJs | null = null;
let carga: Promise<ChartJs> | null = null;

/** O Chart já baixado (ou null): o gráfico desenha na hora quando já há. */
export const chartCarregado = (): ChartJs | null => carregado;

/** Baixa o Chart.js uma vez; as chamadas seguintes reaproveitam. */
export function carregarChart(): Promise<ChartJs> {
  carga ??= import("chart.js/auto").then(
    ({ default: Chart }) => {
      carregado = Chart;
      return Chart;
    },
    (erro: unknown) => {
      carga = null;
      throw erro;
    },
  );
  return carga;
}
