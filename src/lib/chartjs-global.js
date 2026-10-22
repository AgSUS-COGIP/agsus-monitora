/*
  O Chart.js sob demanda: só baixa quando o primeiro gráfico aparece
  (src/ui/grafico.jsx). Antes, `import Chart from "chart.js/auto"` aqui —
  importado por src/main.js — punha o chunk vendor-charts no modulepreload da
  tela de login, que não tem gráfico nenhum.
*/
let carregado = null;
let carga = null;

/** O Chart já baixado (ou null): o gráfico desenha na hora quando já há. */
export const chartCarregado = () => carregado;

/** Baixa o Chart.js uma vez; as chamadas seguintes reaproveitam. */
export function carregarChart() {
  carga ??= import("chart.js/auto").then(
    ({ default: Chart }) => {
      carregado = Chart;
      return Chart;
    },
    (erro) => {
      carga = null;
      throw erro;
    },
  );
  return carga;
}
