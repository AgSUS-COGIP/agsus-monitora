import Chart from "chart.js/auto";

if (typeof window !== "undefined") {
  window.Chart = Chart;
}

export { Chart };
