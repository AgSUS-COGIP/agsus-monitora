import { useEffect, useLayoutEffect, useRef } from "react";
import { Chart } from "../lib/chartjs-global.js";

/*
  Um gráfico Chart.js do painel de recursos, como os do painel de análises:
  criado uma vez no `<canvas>` do `.chart-wrap` e, depois, só atualizado
  (`update`) quando os dados, as opções ou o tema mudam — nada de destruir e
  recriar a cada filtro. `montar(paleta)` devolve `{ data, options }`; a
  paleta é a de src/lib/tema-do-painel.js, e `tema` ("claro"/"escuro") entra
  nas dependências para as cores acompanharem o botão de tema.

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
