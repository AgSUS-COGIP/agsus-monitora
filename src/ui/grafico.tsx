import {
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { DependencyList, KeyboardEvent } from "react";
import type {
  Chart as ChartJs,
  ChartData,
  ChartOptions,
  ChartType,
  Plugin,
} from "chart.js";
import { carregarChart, chartCarregado } from "../lib/base/chartjs-global.ts";
import {
  ContextoDoGrafico,
  dadosDaTabelaDoGrafico,
  TabelaDoGrafico,
  textoDoPonto,
} from "./tabela-do-grafico.tsx";
import type { DadosDaTabelaDoGrafico } from "./tabela-do-grafico.tsx";

/*
  Cores dos gráficos dentro do app, lidas dos tokens (src/styles/tokens.css)
  no momento do desenho — o tema escuro (`html[data-theme="dark"]`) troca os
  tokens e a paleta vem junto. No claro, as séries usam o tom sólido de cada
  estado; no escuro, o `--state-*` (já clareado para o fundo escuro). Sem o
  CSS carregado (testes), vale a paleta de reserva (src/lib/paineis/tema-do-painel.js).
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
    neutro: ler("--state-neutral", reserva.neutro || "#94a3b8"), // acabamento: permitido(cor) — reserva em hex para quando o CSS não está carregado (teste, SSR): a biblioteca de gráfico não lê var()
  };
}

/*
  Um gráfico Chart.js: criado uma vez no `<canvas>` e, depois, só atualizado
  (`update`) quando os dados, as opções ou o tema mudam — nada de destruir e
  recriar a cada filtro. `montar()` devolve `{ data, options }`; o tema
  ("claro"/"escuro") entra nas `dependencias` para as cores acompanharem a
  troca de tema.

  Acessível (padrão do SIGEPSI): o canvas leva `role="img"` e o `rotulo`, e
  os números vão também numa tabela (TabelaDoGrafico) — escondida da vista,
  para o leitor de tela, ou, com "Tabela" ligado no CardDeGrafico, no lugar
  do gráfico. Pelo teclado, o canvas entra no Tab e as setas (Home, End)
  percorrem os itens: o item fica em destaque, com a dica do Chart.js, e o
  valor é anunciado; Esc ou sair do foco limpa.
  `plugins` (opcional) são plugins do Chart.js só deste gráfico, fixos desde
  a criação (ex.: rótulo de valor nas barras).
*/
const PASSO_DO_TECLADO: Partial<
  Record<string, "+1" | "-1" | "inicio" | "fim">
> = {
  ArrowRight: "+1",
  ArrowDown: "+1",
  ArrowLeft: "-1",
  ArrowUp: "-1",
  Home: "inicio",
  End: "fim",
};

/** O item depois de apertar a tecla (dá a volta); sem destaque, começa na ponta. */
export function proximoDestaque(
  atual: number | null,
  passo: "+1" | "-1" | "inicio" | "fim",
  total: number,
): number {
  const ultimo = total - 1;
  if (passo === "inicio") return 0;
  if (passo === "fim") return ultimo;
  if (atual === null) return passo === "+1" ? 0 : ultimo;
  return (atual + (passo === "+1" ? 1 : -1) + total) % total;
}
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
  const cartao = useContext(ContextoDoGrafico);
  const emTabela = Boolean(cartao?.emTabela);
  const idDaDica = useId();
  const [dados, definirDados] = useState<DadosDaTabelaDoGrafico | null>(null);
  const [anuncio, definirAnuncio] = useState("");
  const destaque = useRef<number | null>(null);
  const registrar = cartao?.registrar;
  useEffect(() => registrar?.(), [registrar]);
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
    // A tabela não espera o Chart.js baixar: sai direto dos dados.
    definirDados(dadosDaTabelaDoGrafico(ultimoMontar.current().data));
    destaque.current = null;
    definirAnuncio("");
    const atual = grafico.current;
    if (!atual) return;
    const { data, options } = ultimoMontar.current();
    atual.data.labels = data.labels;
    atual.data.datasets = data.datasets;
    atual.options = options as NonNullable<typeof atual.options>;
    atual.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `dependencias` é a lista do chamador (dados e tema), como num useMemo.
  }, dependencias);

  function destacar(indice: number | null) {
    destaque.current = indice;
    const atual = grafico.current;
    if (atual) {
      const ativos =
        indice === null
          ? []
          : atual.data.datasets.map((_, datasetIndex) => ({
              datasetIndex,
              index: indice,
            }));
      try {
        atual.setActiveElements(ativos);
        atual.tooltip?.setActiveElements(ativos, { x: 0, y: 0 });
        atual.update();
      } catch {
        // Gráfico sem área desenhada: fica só o anúncio.
      }
    }
    definirAnuncio(
      indice === null || !dados ? "" : textoDoPonto(dados, indice),
    );
  }

  function aoTeclar(evento: KeyboardEvent<HTMLCanvasElement>) {
    if (!dados?.linhas.length) return;
    if (evento.key === "Escape") {
      if (destaque.current !== null) destacar(null);
      return;
    }
    const passo = PASSO_DO_TECLADO[evento.key];
    if (!passo) return;
    evento.preventDefault();
    destacar(proximoDestaque(destaque.current, passo, dados.linhas.length));
  }

  return (
    <>
      <canvas
        id={id}
        ref={canvas}
        role="img"
        aria-label={rotulo}
        aria-describedby={dados ? idDaDica : undefined}
        tabIndex={dados && !emTabela ? 0 : undefined}
        hidden={emTabela}
        onKeyDown={aoTeclar}
        onBlur={() => {
          if (destaque.current !== null) destacar(null);
        }}
      />
      {dados ? (
        <>
          <span id={idDaDica} className="sr-only">
            Setas percorrem os valores.
          </span>
          <span className="sr-only" aria-live="polite">
            {anuncio}
          </span>
          <TabelaDoGrafico dados={dados} titulo={rotulo} visivel={emTabela} />
        </>
      ) : null}
    </>
  );
}
