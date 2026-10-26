import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { DependencyList } from "react";
import type {
  Chart as ChartJs,
  ChartData,
  ChartOptions,
  ChartType,
  Plugin,
} from "chart.js";
import { carregarChart, chartCarregado } from "../lib/chartjs-global.ts";

/*
  Cores dos gráficos dentro do app, lidas dos tokens (src/styles/tokens.css)
  no momento do desenho — o tema escuro (`html[data-theme="dark"]`) troca os
  tokens e a paleta vem junto. No claro, as séries usam o tom sólido de cada
  estado; no escuro, o `--state-*` (já clareado para o fundo escuro). Sem o
  CSS carregado (testes), vale a paleta de reserva (src/lib/tema-do-painel.js).
*/
const TOKENS_DA_PALETA = {
  claro: {
    ok: "--color-status-success-solid",
    bad: "--color-status-danger-solid",
    warn: "--color-status-warning-solid",
    review: "--color-status-info-solid",
  },
  escuro: {
    ok: "--state-success",
    bad: "--state-danger",
    warn: "--state-warning",
    review: "--state-info",
  },
};

export interface PaletaDeReserva {
  grid: string;
  text: string;
  ok: string;
  bad: string;
  warn: string;
  review: string;
  blue: string;
  surface: string;
  neutro?: string;
}

export interface PaletaDosGraficos extends PaletaDeReserva {
  neutro: string;
}

export function paletaDosGraficos(
  escuro: boolean,
  reserva: PaletaDeReserva,
): PaletaDosGraficos {
  const estilo =
    typeof getComputedStyle === "function"
      ? getComputedStyle(document.documentElement)
      : null;
  const ler = (nome: string, padrao: string) =>
    estilo?.getPropertyValue(nome).trim() || padrao;
  const estados = TOKENS_DA_PALETA[escuro ? "escuro" : "claro"];
  return {
    grid: ler("--border-subtle", reserva.grid),
    text: ler("--text-secondary", reserva.text),
    ok: ler(estados.ok, reserva.ok),
    bad: ler(estados.bad, reserva.bad),
    warn: ler(estados.warn, reserva.warn),
    review: ler(estados.review, reserva.review),
    blue: ler("--series-1", reserva.blue),
    surface: ler("--surface-card", reserva.surface),
    // "Sem parecer", "Não informado": a fatia neutra das roscas.
    neutro: ler("--state-neutral", reserva.neutro || "#94a3b8"),
  };
}

/*
  Um gráfico Chart.js: criado uma vez no `<canvas>` e, depois, só atualizado
  (`update`) quando os dados, as opções ou o tema mudam — nada de destruir e
  recriar a cada filtro. `montar()` devolve `{ data, options }`; o tema
  ("claro"/"escuro") entra nas `dependencias` para as cores acompanharem a
  troca de tema.

  O canvas leva `role="img"` e o `rotulo`; os números estão também nos KPIs,
  nas pendências e na tabela. `plugins` (opcional) são plugins do Chart.js só
  deste gráfico, fixos desde a criação (ex.: rótulo de valor nas barras).
*/
export interface MontagemDoGrafico<T extends ChartType> {
  data: ChartData<T, number[], string>;
  options?: ChartOptions<T>;
}

export interface PropriedadesDoGrafico<T extends ChartType> {
  tipo: T;
  montar: () => MontagemDoGrafico<NoInfer<T>>;
  dependencias: DependencyList;
  rotulo: string;
  id?: string;
  plugins?: Plugin<NoInfer<T>>[];
}

export function Grafico<T extends ChartType>({
  tipo,
  montar,
  dependencias,
  rotulo,
  id,
  plugins,
}: PropriedadesDoGrafico<T>) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const grafico = useRef<ChartJs<T, number[], string> | null>(null);
  const ultimoMontar = useRef(montar);
  const pluginsIniciais = useRef(plugins);
  // O Chart.js baixa no primeiro gráfico (chartjs-global.ts); depois, desenha na hora.
  const [Chart, definirChart] = useState<typeof ChartJs | null>(() =>
    chartCarregado(),
  );
  useLayoutEffect(() => {
    ultimoMontar.current = montar;
  });

  useEffect(() => {
    if (Chart) return undefined;
    let vivo = true;
    carregarChart().then(
      (carregado: typeof ChartJs) => vivo && definirChart(() => carregado),
      (erro: unknown) =>
        console.warn("Não foi possível carregar os gráficos:", erro),
    );
    return () => {
      vivo = false;
    };
  }, [Chart]);

  useEffect(() => {
    if (!canvas.current || !Chart) return undefined;
    const { data, options } = ultimoMontar.current();
    try {
      grafico.current = new Chart<T, number[], string>(canvas.current, {
        type: tipo,
        data,
        options,
        ...(pluginsIniciais.current
          ? { plugins: pluginsIniciais.current }
          : {}),
      });
    } catch (erro) {
      console.warn("Não foi possível desenhar o gráfico:", erro);
    }
    return () => {
      grafico.current?.destroy();
      grafico.current = null;
    };
  }, [tipo, Chart]);

  useEffect(() => {
    const atual = grafico.current;
    if (!atual) return;
    const { data, options } = ultimoMontar.current();
    atual.data.labels = data.labels;
    atual.data.datasets = data.datasets;
    atual.options = options as NonNullable<typeof atual.options>;
    atual.update();
    // `dependencias` é a lista do chamador (dados e tema), como num useMemo.
  }, dependencias);

  return <canvas id={id} ref={canvas} role="img" aria-label={rotulo} />;
}
