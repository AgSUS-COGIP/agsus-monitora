import { useEffect, useLayoutEffect, useRef } from "react";
import { Chart } from "../lib/chartjs-global.js";

/*
  Cores dos gráficos dentro do app, lidas dos tokens (src/styles/tokens.css)
  no momento do desenho — o tema escuro (`html[data-theme="dark"]`) troca os
  tokens e a paleta vem junto. No claro, as séries usam o tom sólido de cada
  estado; no escuro, o `--state-*` (já clareado para o fundo escuro). Sem o
  CSS carregado (testes), vale a paleta dos painéis (src/lib/tema-do-painel.js).
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

export function paletaDosGraficos(escuro, reserva) {
  const estilo =
    typeof getComputedStyle === "function"
      ? getComputedStyle(document.documentElement)
      : null;
  const ler = (nome, padrao) => estilo?.getPropertyValue(nome).trim() || padrao;
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
export function Grafico({ tipo, montar, dependencias, rotulo, id, plugins }) {
  const canvas = useRef(null);
  const grafico = useRef(null);
  const ultimoMontar = useRef(montar);
  const pluginsIniciais = useRef(plugins);
  useLayoutEffect(() => {
    ultimoMontar.current = montar;
  });

  useEffect(() => {
    if (!canvas.current) return undefined;
    const { data, options } = ultimoMontar.current();
    try {
      grafico.current = new Chart(canvas.current, {
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
  }, [tipo]);

  useEffect(() => {
    const atual = grafico.current;
    if (!atual) return;
    const { data, options } = ultimoMontar.current();
    atual.data.labels = data.labels;
    atual.data.datasets = data.datasets;
    atual.options = options;
    atual.update();
    // `dependencias` é a lista do chamador (dados e tema), como num useMemo.
  }, dependencias);

  return <canvas id={id} ref={canvas} role="img" aria-label={rotulo} />;
}
