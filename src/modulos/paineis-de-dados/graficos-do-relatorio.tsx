import type { ChartOptions, Plugin } from "chart.js";
import type { DadosDoGrafico } from "../../lib/paineis/graficos-do-relatorio.ts";
import type { ImagemDoGrafico } from "../../lib/paineis/relatorio-da-visao-geral-em-pdf.ts";
import type { MontagemDoGrafico, PaletaDosGraficos } from "../../ui/index.ts";
import { Grafico, paletaDosGraficos } from "../../ui/index.ts";
import { temaEscuro } from "../../app/tema.ts";
import { carregarChart } from "../../lib/base/chartjs-global.ts";
import { graficoVazio } from "../../lib/paineis/graficos-do-relatorio.ts";
import { paletaDoPainel } from "../../lib/paineis/tema-do-painel.ts";

/*
  O DESENHO DOS GRÁFICOS DO MONTADOR (as séries vêm prontas de
  src/lib/paineis/graficos-do-relatorio.ts): a mesma montagem do Chart.js
  serve à miniatura da prévia (`MiniaturaDoGrafico`, o `Grafico` de src/ui/)
  e à imagem do PDF (`imagensDosGraficos`: canvas fora da tela, em 2x, sem
  animação, com o valor escrito na ponta de cada barra).

  Cores dos tokens (paletaDosGraficos), como nos outros gráficos do sistema.
  O PDF é sempre claro: no tema escuro, o texto, as linhas da grade e o fundo
  vêm da paleta clara de reserva, e as séries, do tom sólido de cada estado.
*/

const paletaDaTela = (escuro: boolean) =>
  paletaDosGraficos(escuro, paletaDoPainel(escuro));

function paletaDoPdf(): PaletaDosGraficos {
  const reserva = paletaDoPainel(false);
  const p = paletaDosGraficos(false, reserva);
  return temaEscuro()
    ? { ...p, text: reserva.text, grid: reserva.grid, surface: reserva.surface }
    : { ...p, surface: reserva.surface };
}

interface Jeito {
  /** A miniatura da prévia: letra menor e sem o valor escrito. */
  miniatura: boolean;
}

const tamanhoDaLetra = ({ miniatura }: Jeito) => (miniatura ? 9 : 13);

function opcoesDeBarras(
  dados: DadosDoGrafico,
  p: PaletaDosGraficos,
  jeito: Jeito,
): ChartOptions<"bar"> {
  const letra = { size: tamanhoDaLetra(jeito) };
  const categorias = {
    stacked: dados.empilhado,
    ticks: { color: p.text, font: letra, autoSkip: jeito.miniatura },
    grid: { display: false },
  };
  const valores = {
    stacked: dados.empilhado,
    beginAtZero: true,
    ticks: { color: p.text, precision: 0, font: letra },
    grid: { color: p.grid },
  };
  return {
    responsive: jeito.miniatura,
    maintainAspectRatio: false,
    animation: jeito.miniatura ? { duration: 300 } : false,
    indexAxis: dados.deitado ? "y" : "x",
    interaction: { mode: "index", intersect: false },
    // Espaço para o valor escrito na ponta da barra (à direita na deitada, em cima na de pé).
    layout: {
      padding: {
        right: jeito.miniatura ? 0 : 36,
        top: jeito.miniatura || dados.deitado ? 4 : 24,
      },
    },
    plugins: {
      legend:
        dados.series.length > 1
          ? {
              position: "top",
              labels: {
                color: p.text,
                boxWidth: jeito.miniatura ? 8 : 14,
                font: letra,
                usePointStyle: true,
              },
            }
          : { display: false },
      tooltip: { enabled: jeito.miniatura },
    },
    scales: dados.deitado
      ? { x: valores, y: categorias }
      : { x: categorias, y: valores },
  };
}

function opcoesDeLinha(
  p: PaletaDosGraficos,
  jeito: Jeito,
): ChartOptions<"line"> {
  const letra = { size: tamanhoDaLetra(jeito) };
  return {
    responsive: jeito.miniatura,
    maintainAspectRatio: false,
    animation: jeito.miniatura ? { duration: 300 } : false,
    interaction: { mode: "index", intersect: false },
    layout: {
      padding: {
        top: jeito.miniatura ? 4 : 18,
        right: 12,
        left: jeito.miniatura ? 0 : 12,
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: jeito.miniatura },
    },
    scales: {
      x: {
        ticks: { color: p.text, font: letra, maxRotation: 0, autoSkip: true },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        ticks: { color: p.text, precision: 0, font: letra },
        grid: { color: p.grid },
      },
    },
  };
}

export function montagemDeBarras(
  dados: DadosDoGrafico,
  p: PaletaDosGraficos,
  jeito: Jeito,
): MontagemDoGrafico<"bar"> {
  return {
    data: {
      labels: [...dados.rotulos],
      datasets: dados.series.map((s) => ({
        label: s.rotulo,
        data: [...s.valores],
        backgroundColor: p[s.tom],
        borderRadius: dados.empilhado ? 0 : 3,
        maxBarThickness: jeito.miniatura || dados.deitado ? 28 : 64,
      })),
    },
    options: opcoesDeBarras(dados, p, jeito),
  };
}

export function montagemDeLinha(
  dados: DadosDoGrafico,
  p: PaletaDosGraficos,
  jeito: Jeito,
): MontagemDoGrafico<"line"> {
  return {
    data: {
      labels: [...dados.rotulos],
      datasets: dados.series.map((s) => ({
        label: s.rotulo,
        data: [...s.valores],
        borderColor: p[s.tom],
        backgroundColor: p[s.tom],
        borderWidth: jeito.miniatura ? 2 : 3,
        pointRadius: jeito.miniatura ? 1.5 : 3,
        // Reta entre os meses: a curva sugeriria valor entre um mês e outro.
        tension: 0,
      })),
    },
    options: opcoesDeLinha(p, jeito),
  };
}

/** A miniatura de um gráfico na prévia do montador. */
export function MiniaturaDoGrafico({
  dados,
  escuro,
}: {
  dados: DadosDoGrafico;
  escuro: boolean;
}) {
  const jeito = { miniatura: true };
  return (
    <figure className="relatorios-montador-miniatura" data-grafico={dados.id}>
      <figcaption>{dados.titulo}</figcaption>
      {graficoVazio(dados) ? (
        <p className="relatorios-montador-miniatura-vazia">{dados.vazio}</p>
      ) : (
        <div className="relatorios-montador-miniatura-grafico">
          {dados.tipo === "linha" ? (
            <Grafico
              tipo="line"
              rotulo={dados.titulo}
              item={dados.item}
              dependencias={[dados, escuro]}
              montar={() => montagemDeLinha(dados, paletaDaTela(escuro), jeito)}
            />
          ) : (
            <Grafico
              tipo="bar"
              rotulo={dados.titulo}
              item={dados.item}
              dependencias={[dados, escuro]}
              montar={() =>
                montagemDeBarras(dados, paletaDaTela(escuro), jeito)
              }
            />
          )}
        </div>
      )}
    </figure>
  );
}

// ── A imagem do PDF ─────────────────────────────────────────────────────

const LARGURA = 1100;

/* A altura do desenho: barras deitadas crescem com os itens. */
function alturaDoDesenho(dados: DadosDoGrafico): number {
  if (!dados.deitado) return 420;
  const porItem = dados.empilhado || dados.series.length === 1 ? 22 : 28;
  return Math.max(260, 80 + dados.rotulos.length * porItem);
}

/* O fundo branco e o valor na ponta de cada barra (no empilhado, o total) e sobre cada ponto. */
function pluginDoPdf(dados: DadosDoGrafico, p: PaletaDosGraficos): Plugin {
  return {
    id: "yeendeValoresDoRelatorio",
    beforeDraw(chart) {
      const { ctx, width, height } = chart;
      ctx.save();
      ctx.fillStyle = p.surface;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    },
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      ctx.save();
      ctx.fillStyle = p.text;
      ctx.font = `600 12px ${String(chart.options.font?.family || "sans-serif")}`;
      const escrever = (texto: string, x: number, y: number) => {
        if (dados.deitado) {
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(texto, x + 4, y);
        } else {
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(texto, x, y - 4);
        }
      };
      if (dados.empilhado) {
        const ultimo = chart.getDatasetMeta(chart.data.datasets.length - 1);
        dados.rotulos.forEach((_, i) => {
          const total = dados.series.reduce(
            (s, x) => s + (x.valores[i] ?? 0),
            0,
          );
          const ponto = ultimo.data[i];
          if (total > 0 && ponto)
            escrever(total.toLocaleString("pt-BR"), ponto.x, ponto.y);
        });
      } else {
        chart.data.datasets.forEach((_, d) => {
          const meta = chart.getDatasetMeta(d);
          if (meta.hidden) return;
          meta.data.forEach((ponto, i) => {
            const valor = dados.series[d]?.valores[i] ?? 0;
            if (valor > 0)
              escrever(valor.toLocaleString("pt-BR"), ponto.x, ponto.y);
          });
        });
      }
      ctx.restore();
    },
  };
}

function bytesDoPng(url: string): Uint8Array {
  const base64 = url.slice(url.indexOf(",") + 1);
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

/**
 * As imagens PNG dos gráficos para o PDF, na ordem recebida (null: vazio ou
 * não desenhado; o PDF põe a tabela dos números no lugar).
 */
export async function imagensDosGraficos(
  graficos: readonly DadosDoGrafico[],
): Promise<(ImagemDoGrafico | null)[]> {
  if (!graficos.some((g) => !graficoVazio(g))) return graficos.map(() => null);
  const Chart = await carregarChart();
  const p = paletaDoPdf();
  const jeito = { miniatura: false };
  return graficos.map((dados) => {
    if (graficoVazio(dados)) return null;
    const altura = alturaDoDesenho(dados);
    const canvas = document.createElement("canvas");
    canvas.width = LARGURA;
    canvas.height = altura;
    canvas.style.width = `${LARGURA}px`;
    canvas.style.height = `${altura}px`;
    const plugins = [pluginDoPdf(dados, p)];
    let grafico: InstanceType<typeof Chart> | null = null;
    try {
      if (dados.tipo === "linha") {
        const { data, options } = montagemDeLinha(dados, p, jeito);
        grafico = new Chart(canvas, {
          type: "line",
          data,
          options: { ...options, devicePixelRatio: 2 },
          plugins,
        });
      } else {
        const { data, options } = montagemDeBarras(dados, p, jeito);
        grafico = new Chart(canvas, {
          type: "bar",
          data,
          options: { ...options, devicePixelRatio: 2 },
          plugins,
        });
      }
      return {
        bytes: bytesDoPng(canvas.toDataURL("image/png")),
        largura: LARGURA,
        altura,
      };
    } catch (erro) {
      console.warn("Não foi possível desenhar o gráfico do relatório:", erro);
      return null;
    } finally {
      grafico?.destroy();
    }
  });
}
