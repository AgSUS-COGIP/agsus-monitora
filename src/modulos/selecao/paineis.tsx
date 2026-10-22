import type { ComponentProps } from "react";
import type {
  ChartType,
  ChartOptions,
  Plugin,
  TooltipCallbacks,
} from "chart.js";
import type {
  AtivoDoRecorte,
  CampoDoFiltro,
  FiltrosDaSelecao,
  IndicadoresDaSelecao,
  ObservacaoDaSelecao,
  OpcoesDosFiltros,
  VagaDaSelecao,
} from "./tipos.ts";

declare module "chart.js" {
  interface PluginOptionsByType<TType extends ChartType> {
    selecaoRotuloDeValor?: { cor: string };
    selecaoTextoNoCentro?: {
      cor: string;
      corSecundaria: string;
      principal?: string;
      secundario?: string;
    };
  }
}
type Paleta = ReturnType<typeof paleta>;
type EscalaDeBarras = NonNullable<ChartOptions<"bar">["scales"]>[string];
import { useEffect, useMemo, useRef } from "react";
import { MultiSelectBusca } from "../../componentes/multi-select-busca.jsx";
import { formatNumberBR } from "../../lib/formatters.js";
import {
  aptosEEliminados,
  CAMPOS_DO_FILTRO,
  eliminadosAntesDaAnalise,
  filtrosAtivos,
  formatarQuantidade,
  formatarTaxa,
  rotuloDaUnidade,
  topUnidades,
  triadosEReprovados,
} from "../../lib/selecao-do-painel.ts";
import { paletaDoPainel } from "../../lib/tema-do-painel.js";
import {
  CardDeGrafico,
  ChipDeFiltro,
  ChipsDeFiltro,
  Grafico,
  GradeDeKpis,
  Kpi,
  LinhaDoRecorte,
  paletaDosGraficos,
  PainelDeFiltros,
  TopoDoPainel,
} from "../../ui/index.js";

/*
  Os blocos da tela de Seleção, com os componentes de src/ui/, na ordem do
  antigo painel externo "AgSUS Monitora Recrutamento e Seleção": o topo (o
  status discreto da carga e as ações — o título e a área estão no cabeçalho
  do app), "Refinar resultados" com quatro filtros de escolha múltipla, sete
  KPIs em card compacto, o recorte ativo, cinco gráficos Chart.js e os alertas
  da coluna Observação.
*/

const truncar = (valor: string, limite: number) => {
  const texto = String(valor ?? "").trim();
  return texto.length > limite ? `${texto.slice(0, limite - 1)}…` : texto;
};

/* ── Topo ───────────────────────────────────────────────────────────── */

export function Topo(props: ComponentProps<typeof TopoDoPainel>) {
  return <TopoDoPainel {...props} />;
}

/* ── Filtros ────────────────────────────────────────────────────────── */

/** Os filtros ativos, como o recorte os descreve: `[campo, rótulo, valor]`. */
export function ativosDoRecorte(
  filtros: FiltrosDaSelecao,
  area: string,
): AtivoDoRecorte[] {
  return filtrosAtivos(filtros, area).map(({ campo, rotulo, valores }) => [
    campo,
    rotulo,
    valores.join(", "),
  ]);
}

export function Filtros({
  filtros,
  opcoes,
  area,
  carregado,
  aoMudar,
  aoLimpar,
}: {
  filtros: FiltrosDaSelecao;
  opcoes: OpcoesDosFiltros;
  area: string;
  carregado: boolean;
  aoMudar: (campo: CampoDoFiltro, valores: readonly string[]) => void;
  aoLimpar: () => void;
}) {
  const ativos = filtrosAtivos(filtros, area);
  return (
    <PainelDeFiltros
      tour="selecao-filtros"
      idDoTitulo="selecaoFiltrosTitulo"
      className="selecao-filtros"
      quantos={ativos.length}
      aoLimpar={aoLimpar}
    >
      <div
        className="ui-grade-de-campos selecao-filtros-grade"
        data-tour="selecao-filtros-campos"
      >
        {CAMPOS_DO_FILTRO.map(({ campo, rotulo, todos }) => (
          <div
            className="ui-campo"
            key={campo}
            data-tour={`selecao-filtro-${campo}`}
          >
            <label htmlFor={`filtro-${campo}`}>
              {campo === "unidades" ? rotuloDaUnidade(area) : rotulo}
            </label>
            {carregado ? (
              <MultiSelectBusca
                id={`filtro-${campo}`}
                opcoes={opcoes[campo]}
                selecionados={filtros[campo]}
                placeholder={
                  campo === "unidades" && area !== "saude-indigena"
                    ? "Todas as unidades"
                    : todos
                }
                aoMudar={(valores) => aoMudar(campo, valores)}
              />
            ) : (
              <select id={`filtro-${campo}`} disabled>
                <option>{todos}</option>
              </select>
            )}
          </div>
        ))}
      </div>

      <ChipsDeFiltro>
        {ativos.map(({ campo, rotulo, valores }) => (
          <ChipDeFiltro
            key={campo}
            rotulo={rotulo}
            aoTirar={() => aoMudar(campo, [])}
          >
            {valores.length > 2
              ? `${valores.length} selecionados`
              : valores.join(", ")}
          </ChipDeFiltro>
        ))}
      </ChipsDeFiltro>
    </PainelDeFiltros>
  );
}

/* ── KPIs ───────────────────────────────────────────────────────────── */

export function Indicadores({
  indicadores: k,
  carregado,
}: {
  indicadores: IndicadoresDaSelecao;
  carregado: boolean;
}) {
  const n = formatarQuantidade;
  const carregando = !carregado;
  return (
    <GradeDeKpis
      tour="selecao-kpis"
      className="selecao-kpis"
      rotulo="Indicadores do recorte"
    >
      <Kpi
        icone="fa-users"
        chave="inscritos"
        rotulo="Inscritos"
        valor={n(k.inscritos)}
        carregando={carregando}
      />
      <Kpi
        cor="k-green"
        icone="fa-user-check"
        chave="aptos"
        rotulo="Aptos"
        valor={n(k.aptos)}
        carregando={carregando}
      />
      <Kpi
        cor="k-yellow"
        icone="fa-filter"
        chave="triados"
        rotulo="Triados"
        valor={n(k.triados)}
        carregando={carregando}
      />
      <Kpi
        cor="k-orange"
        icone="fa-calendar-check"
        chave="convocados"
        rotulo="Convocados entrevista"
        valor={n(k.convocados)}
        carregando={carregando}
      />
      <Kpi
        cor="k-green"
        icone="fa-circle-check"
        chave="aprovados"
        rotulo="Aprovados"
        valor={n(k.aprovados)}
        carregando={carregando}
      />
      <Kpi
        icone="fa-briefcase"
        chave="contratados"
        rotulo="Contratados"
        valor={n(k.contratados)}
        carregando={carregando}
      />
      <Kpi
        cor="k-slate"
        icone="fa-chart-pie"
        chave="taxa"
        rotulo="Taxa contratação"
        valor={formatarTaxa(k.taxa)}
        carregando={carregando}
      />
    </GradeDeKpis>
  );
}

/* ── Recorte ativo ──────────────────────────────────────────────────── */

export function Recorte({ ativos }: { ativos: AtivoDoRecorte[] }) {
  return <LinhaDoRecorte ativos={ativos} />;
}

/* ── Gráficos ───────────────────────────────────────────────────────── */

/* Uma cor de texto dos tokens do app (com a reserva dos painéis, sem CSS). */
function corDoToken(nome: string, reserva: string) {
  const estilo =
    typeof getComputedStyle === "function"
      ? getComputedStyle(document.documentElement)
      : null;
  return estilo?.getPropertyValue(nome).trim() || reserva;
}

/* O número em cima (ou ao lado) de cada barra, como no painel antigo. */
const rotuloDeValor: Plugin<"bar"> = {
  id: "selecaoRotuloDeValor",
  afterDatasetsDraw(grafico) {
    const { ctx } = grafico;
    const deitado = grafico.options.indexAxis === "y";
    const cor = grafico.options.plugins?.selecaoRotuloDeValor?.cor;
    grafico.data.datasets.forEach((conjunto, i) => {
      grafico.getDatasetMeta(i).data.forEach((barra, j) => {
        const valor = conjunto.data[j];
        if (typeof valor !== "number" || !valor) return;
        const { x, y } = barra.tooltipPosition(false);
        if (x === null || y === null) return;
        ctx.save();
        ctx.fillStyle = cor || "#20324a";
        ctx.font = "600 11px Geist, system-ui, sans-serif";
        ctx.textAlign = deitado ? "left" : "center";
        ctx.textBaseline = deitado ? "middle" : "bottom";
        ctx.fillText(
          formatNumberBR(valor),
          deitado ? x + 6 : x,
          deitado ? y : y - 4,
        );
        ctx.restore();
      });
    });
  },
};

/* O percentual no meio do medidor de contratação. */
const textoNoCentro: Plugin<"doughnut"> = {
  id: "selecaoTextoNoCentro",
  afterDraw(grafico) {
    const cfg = grafico.options.plugins?.selecaoTextoNoCentro;
    const area = grafico.chartArea;
    if (!cfg || !area) return;
    const { ctx } = grafico;
    const x = (area.left + area.right) / 2;
    const y = area.bottom - (area.bottom - area.top) * 0.22;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = cfg.cor || "#20324a";
    ctx.font = "800 28px Geist, system-ui, sans-serif";
    ctx.fillText(cfg.principal || "", x, y - 8);
    ctx.fillStyle = cfg.corSecundaria || "#526780";
    ctx.font = "400 12px Geist, system-ui, sans-serif";
    ctx.fillText(cfg.secundario || "", x, y + 24);
    ctx.restore();
  },
};

function opcoesDeBarras(
  p: Paleta,
  {
    deitado = false,
    aoClicar,
    dica,
  }: {
    deitado?: boolean;
    aoClicar?: (indice: number) => void;
    dica?: Partial<TooltipCallbacks<"bar">>;
  } = {},
): ChartOptions<"bar"> {
  const categorias: EscalaDeBarras = {
    ticks: { color: p.text, maxRotation: 0, autoSkip: false },
    grid: { display: false },
  };
  const valores: EscalaDeBarras = {
    beginAtZero: true,
    grace: "12%",
    ticks: { color: p.text, precision: 0 },
    grid: { color: p.grid },
  };
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 380 },
    indexAxis: deitado ? "y" : "x",
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: dica ? { callbacks: dica } : {},
      selecaoRotuloDeValor: { cor: p.text },
    },
    scales: deitado
      ? { x: valores, y: categorias }
      : { x: categorias, y: valores },
    onClick: aoClicar
      ? (_, elementos) => {
          const primeiro = elementos[0];
          if (primeiro) aoClicar(primeiro.index);
        }
      : undefined,
  };
}

function opcoesDeRosca(
  p: Paleta,
  extra: ChartOptions<"doughnut"> = {},
): ChartOptions<"doughnut"> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 380 },
    cutout: "62%",
    plugins: {
      legend: {
        position: "bottom",
        labels: { color: p.text, boxWidth: 14, usePointStyle: true },
      },
    },
    ...extra,
  };
}

/* As cores dos tokens do app (com a paleta dos painéis de reserva). */
const paleta = (escuro: boolean) =>
  paletaDosGraficos(escuro, paletaDoPainel(escuro));

export function Graficos({
  vagas,
  indicadores,
  area,
  carregado,
  escuro,
  aoFiltrarUnidade,
}: {
  vagas: readonly VagaDaSelecao[];
  indicadores: IndicadoresDaSelecao;
  area: string;
  carregado: boolean;
  escuro: boolean;
  aoFiltrarUnidade: (unidade: string) => void;
}) {
  const eliminados = useMemo(() => eliminadosAntesDaAnalise(vagas), [vagas]);
  const aptos = useMemo(() => aptosEEliminados(vagas), [vagas]);
  const analise = useMemo(() => triadosEReprovados(vagas), [vagas]);
  const unidades = useMemo(() => topUnidades(vagas, 10), [vagas]);
  const tema = escuro ? "escuro" : "claro";
  const taxa = indicadores.taxa ?? 0;
  const unidade = rotuloDaUnidade(area) === "Nome DSEI" ? "DSEIs" : "unidades";
  const carregando = !carregado;

  // O clique do Chart.js chega aqui, sempre com o filtro mais recente.
  const filtrar = useRef(aoFiltrarUnidade);
  useEffect(() => {
    filtrar.current = aoFiltrarUnidade;
  });

  return (
    <>
      <div className="ui-linha-de-cards">
        <CardDeGrafico
          titulo="Eliminados antes da análise"
          carregando={carregando}
        >
          <Grafico
            id="chartEliminados"
            tipo="bar"
            rotulo="Eliminados antes da análise: cancelados, questionário não finalizado e eliminados por nota"
            plugins={[rotuloDeValor]}
            dependencias={[eliminados, tema]}
            montar={() => {
              const p = paleta(escuro);
              return {
                data: {
                  labels: eliminados.map((e) => e.rotulo),
                  datasets: [
                    {
                      label: "Candidatos",
                      data: eliminados.map((e) => e.valor),
                      backgroundColor: [p.warn, p.review, p.bad],
                      borderRadius: 6,
                    },
                  ],
                },
                options: opcoesDeBarras(p),
              };
            }}
          />
        </CardDeGrafico>

        <CardDeGrafico
          titulo="Aptos na análise e eliminados"
          carregando={carregando}
        >
          <Grafico
            id="chartAptos"
            tipo="doughnut"
            rotulo="Aptos para análise e eliminados"
            dependencias={[aptos, tema]}
            montar={() => {
              const p = paleta(escuro);
              return {
                data: {
                  labels: aptos.map((a) => a.rotulo),
                  datasets: [
                    {
                      data: aptos.map((a) => a.valor),
                      backgroundColor: [p.ok, p.bad],
                      borderColor: p.surface,
                      borderWidth: 2,
                    },
                  ],
                },
                options: opcoesDeRosca(p),
              };
            }}
          />
        </CardDeGrafico>
      </div>

      <div className="ui-linha-de-cards">
        <CardDeGrafico titulo="Contratados" carregando={carregando}>
          <Grafico
            id="chartContratados"
            tipo="doughnut"
            rotulo={`Contratados: ${formatarTaxa(indicadores.taxa)} dos aprovados`}
            plugins={[textoNoCentro]}
            dependencias={[
              indicadores.aprovados,
              indicadores.contratados,
              tema,
            ]}
            montar={() => {
              const p = paleta(escuro);
              const contratados = indicadores.contratados ?? 0;
              const resto = Math.max(
                (indicadores.aprovados ?? 0) - contratados,
                0,
              );
              return {
                data: {
                  labels: ["Contratados", "Não contratados"],
                  datasets: [
                    {
                      data:
                        contratados || resto ? [contratados, resto] : [0, 1],
                      backgroundColor: [p.blue, p.neutro],
                      borderColor: p.surface,
                      borderWidth: 2,
                    },
                  ],
                },
                options: opcoesDeRosca(p, {
                  rotation: -90,
                  circumference: 180,
                  cutout: "72%",
                  plugins: {
                    legend: {
                      position: "bottom",
                      labels: {
                        color: p.text,
                        boxWidth: 14,
                        usePointStyle: true,
                      },
                    },
                    selecaoTextoNoCentro: {
                      principal: formatarTaxa(taxa),
                      secundario: `${formatarQuantidade(indicadores.contratados)} de ${formatarQuantidade(indicadores.aprovados)} aprovados`,
                      cor: corDoToken(
                        "--text-primary",
                        escuro ? "#edf4fa" : "#20324a",
                      ),
                      corSecundaria: p.text,
                    },
                  },
                }),
              };
            }}
          />
        </CardDeGrafico>

        <CardDeGrafico
          titulo="Triados e reprovados na análise"
          carregando={carregando}
        >
          <Grafico
            id="chartAnalise"
            tipo="bar"
            rotulo="Triados e reprovados na análise"
            plugins={[rotuloDeValor]}
            dependencias={[analise, tema]}
            montar={() => {
              const p = paleta(escuro);
              return {
                data: {
                  labels: analise.map((a) => a.rotulo),
                  datasets: [
                    {
                      label: "Candidatos",
                      data: analise.map((a) => a.valor),
                      backgroundColor: [p.review, p.bad],
                      borderRadius: 6,
                    },
                  ],
                },
                options: opcoesDeBarras(p),
              };
            }}
          />
        </CardDeGrafico>
      </div>

      <CardDeGrafico
        elemento="section"
        altura="alto"
        titulo={`Top ${unidade} por inscritos`}
        carregando={carregando}
      >
        <Grafico
          id="chartDsei"
          tipo="bar"
          rotulo={`Top ${unidade} por inscritos`}
          plugins={[rotuloDeValor]}
          dependencias={[unidades, tema]}
          montar={() => {
            const p = paleta(escuro);
            return {
              data: {
                labels: unidades.map((u) => truncar(u.rotulo, 34)),
                datasets: [
                  {
                    label: "Inscritos",
                    data: unidades.map((u) => u.valor),
                    backgroundColor: p.review,
                    borderRadius: 6,
                  },
                ],
              },
              options: opcoesDeBarras(p, {
                deitado: true,
                dica: {
                  title: (itens) => {
                    const primeiro = itens[0];
                    return primeiro
                      ? unidades[primeiro.dataIndex]?.rotulo || ""
                      : "";
                  },
                },
                aoClicar: (indice) => {
                  const escolhida = unidades[indice];
                  if (escolhida && escolhida.rotulo !== "Sem unidade")
                    filtrar.current(escolhida.rotulo);
                },
              }),
            };
          }}
        />
      </CardDeGrafico>
    </>
  );
}

/* ── Observações ────────────────────────────────────────────────────── */

export function Observacoes({
  observacoes,
}: {
  observacoes: readonly ObservacaoDaSelecao[];
}) {
  if (!observacoes.length) return null;
  return (
    <section
      className="ui-card selecao-observacoes"
      aria-labelledby="selecaoObservacoesTitulo"
      data-tour="selecao-observacoes"
    >
      <h2 className="ui-titulo" id="selecaoObservacoesTitulo">
        Alertas identificados no recorte
      </h2>
      <ul className="selecao-observacoes-lista">
        {observacoes.map((o) => (
          <li key={o.texto} data-observacao="">
            <b>{o.texto}</b>
            <small>
              {o.vagas} {o.vagas === 1 ? "vaga" : "vagas"} ·{" "}
              {truncar(o.unidades.join(", "), 120) || "sem unidade"} · Edital{" "}
              {o.editais.join(", ")}
            </small>
          </li>
        ))}
      </ul>
    </section>
  );
}
