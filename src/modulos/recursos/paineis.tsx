import type { ComponentProps } from "react";
import type { ChartOptions, TooltipCallbacks } from "chart.js";
import type {
  RecursoDoPainel,
  FiltrosDosRecursos,
  CampoDoFiltroDosRecursos,
  AoFiltrarRecursos,
} from "../../lib/tipos-dos-recursos.ts";
import {
  calcularIndicadores,
  opcoesDosFiltros,
  pendenciasPrioritarias,
} from "../../lib/recursos-dos-candidatos.ts";
type Opcoes = ReturnType<typeof opcoesDosFiltros>;
type Pendencia = ReturnType<typeof pendenciasPrioritarias>[number];
type FiltroAtivo = [CampoDoFiltroDosRecursos, string, string];
type PropsDoFiltro = {
  filtros: FiltrosDosRecursos;
  carregado: boolean;
  aoFiltrar: AoFiltrarRecursos;
};
import { useEffect, useMemo, useRef, useState } from "react";
import { formatNumberBR } from "../../lib/formatters.js";
import {
  esteiraDosRecursos,
  FILTROS_VAZIOS,
  impactoNoResultado,
  recursosPorAnalista,
  recursosPorSituacao,
} from "../../lib/recursos-dos-candidatos.ts";
import { paletaDoPainel } from "../../lib/tema-do-painel.js";
import {
  Campo,
  CardDeGrafico,
  ChipDeFiltro,
  ChipsDeFiltro,
  Grafico,
  GradeDeKpis,
  Kpi as CardDeKpi,
  LinhaDoRecorte,
  ListaDePendencias,
  MaisOpcoes,
  MarcasDoRecorte,
  paletaDosGraficos,
  PainelDeFiltros,
  TopoDoPainel,
} from "../../ui/index.js";

/*
  Os blocos das telas de Recursos, com os componentes de src/ui/: o topo (só
  status e ações — o título e a área estão no cabeçalho do app), "Refinar
  resultados", os quatro KPIs em card compacto (botões que filtram), o
  recorte ativo, os gráficos Chart.js e as pendências prioritárias.

  O Painel de recursos (acompanhar) usa todos; Analisar recursos (fazer) usa
  o topo e os filtros (`analise`: ids e tour próprios, as duas telas ficam no
  DOM ao mesmo tempo).
*/

const truncar = (valor: unknown, limite: number) => {
  const texto = String(valor ?? "").trim();
  return texto.length > limite ? `${texto.slice(0, limite - 1)}…` : texto;
};

/* ── Topo ───────────────────────────────────────────────────────────── */

export function Topo({
  aoNovo,
  novoDesativado,
  aoModelos,
  aoAnalisar,
  aoVerPainel,
  ...props
}: ComponentProps<typeof TopoDoPainel> & {
  aoNovo?: () => void;
  novoDesativado?: boolean;
  aoModelos?: () => void;
  /** Painel, para quem analisa: Analisar recursos com o recorte do painel. */
  aoAnalisar?: () => void;
  /** Analisar recursos: volta ao painel com o mesmo recorte. */
  aoVerPainel?: () => void;
}) {
  return (
    <TopoDoPainel {...props}>
      {aoVerPainel ? (
        <button
          type="button"
          className="btn secondary"
          data-acao="painel-de-recursos"
          data-tour="analisar-recursos-painel"
          title="O Painel de recursos com os mesmos filtros"
          onClick={aoVerPainel}
        >
          <i className="fa-solid fa-chart-column" aria-hidden="true" /> Ver no
          painel
        </button>
      ) : null}
      {aoModelos ? (
        <button
          type="button"
          className="btn secondary"
          data-acao="modelos"
          data-tour="recursos-modelos"
          title="Modelos de resposta aos recursos (administração)"
          onClick={aoModelos}
        >
          <i className="fa-solid fa-file-signature" aria-hidden="true" />{" "}
          Modelos de resposta
        </button>
      ) : null}
      {aoNovo ? (
        <button
          type="button"
          className="btn"
          data-acao="novo-recurso"
          data-tour="recursos-novo"
          disabled={novoDesativado}
          onClick={aoNovo}
        >
          <i className="fa-solid fa-plus" aria-hidden="true" /> Novo recurso
        </button>
      ) : null}
      {aoAnalisar ? (
        <button
          type="button"
          className="btn"
          data-acao="analisar-recursos"
          data-tour="recursos-analisar"
          title="Analisar recursos com os mesmos filtros"
          onClick={aoAnalisar}
        >
          <i className="fa-solid fa-gavel" aria-hidden="true" /> Analisar
        </button>
      ) : null}
    </TopoDoPainel>
  );
}

/* ── Filtros ────────────────────────────────────────────────────────── */

export const CAMPOS_DO_FILTRO: readonly (readonly [
  Exclude<CampoDoFiltroDosRecursos, "busca">,
  string,
  keyof Opcoes,
  string,
])[] = [
  ["edital", "Edital", "editais", "Todos os editais"],
  ["origem", "Origem", "origens", "Todas as origens"],
  ["analista", "Analista", "analistas", "Todos os analistas"],
  ["situacao", "Situação", "situacoes", "Todas as situações"],
  ["pendencia", "Pendência", "pendencias", "Qualquer pendência"],
];

const rotuloDoValor = (opcoes: Opcoes, lista: keyof Opcoes, valor: string) =>
  opcoes[lista].find((o) => o.valor === valor)?.rotulo || valor;

/** Os filtros ativos, como o recorte os descreve: `[campo, rótulo, valor]`. */
export function filtrosAtivos(
  filtros: FiltrosDosRecursos,
  opcoes: Opcoes,
): FiltroAtivo[] {
  const ativos = CAMPOS_DO_FILTRO.filter(([campo]) => filtros[campo]).map(
    ([campo, rotulo, lista]): FiltroAtivo => [
      campo,
      rotulo,
      rotuloDoValor(opcoes, lista, filtros[campo]),
    ],
  );
  if (String(filtros.busca || "").trim())
    ativos.push(["busca", "Busca", filtros.busca.trim()]);
  return ativos;
}

export function Filtros({
  filtros,
  opcoes,
  carregado,
  aoMudar,
  aoLimpar,
  analise = false,
}: {
  filtros: FiltrosDosRecursos;
  opcoes: Opcoes;
  carregado: boolean;
  aoMudar: AoFiltrarRecursos;
  aoLimpar: () => void;
  analise?: boolean;
}) {
  const [maisOpcoes, setMaisOpcoes] = useState(false);
  const id = (nome: string) => (analise ? `analise-${nome}` : nome);
  const ativos = filtrosAtivos(filtros, opcoes);
  const avancados = String(filtros.busca || "").trim() ? 1 : 0;

  return (
    <PainelDeFiltros
      tour={analise ? "analisar-recursos-filtros" : "recursos-filtros"}
      idDoTitulo={
        analise ? "analiseRecursosFiltrosTitulo" : "recursosFiltrosTitulo"
      }
      quantos={ativos.length}
      aoLimpar={aoLimpar}
      aoRecolher={() => setMaisOpcoes(false)}
    >
      <div className="ui-grade-de-campos" data-tour="recursos-filtros-campos">
        {CAMPOS_DO_FILTRO.map(([campo, rotulo, lista, todos]) => (
          <Campo rotulo={rotulo} key={campo}>
            <select
              id={id(`filtro-${campo}`)}
              data-tour={`recursos-filtro-${campo}`}
              name={campo}
              value={filtros[campo]}
              disabled={!carregado}
              onChange={(evento) => aoMudar(campo, evento.target.value)}
            >
              <option value="">{todos}</option>
              {opcoes[lista].map((opcao) => (
                <option key={opcao.valor} value={opcao.valor}>
                  {opcao.rotulo}
                </option>
              ))}
            </select>
          </Campo>
        ))}
      </div>
      <MaisOpcoes
        id={
          analise
            ? "analiseRecursosFiltrosAdicionais"
            : "recursosFiltrosAdicionais"
        }
        aberto={maisOpcoes}
        aoAlternar={() => setMaisOpcoes((atual) => !atual)}
        quantos={avancados}
        titulo="Mostrar a busca em toda a tela"
      >
        <Campo rotulo="Buscar em toda a tela">
          <input
            id={id("filtro-busca")}
            data-tour="recursos-busca"
            type="search"
            name="busca"
            value={filtros.busca}
            disabled={!carregado}
            placeholder="Candidato, código, vaga, nº ou processo SEI"
            onChange={(evento) => aoMudar("busca", evento.target.value)}
          />
        </Campo>
      </MaisOpcoes>
      <ChipsDeFiltro>
        {ativos.map(([campo, rotulo, valor]) => (
          <ChipDeFiltro
            key={campo}
            rotulo={rotulo}
            aoTirar={() => aoMudar(campo, FILTROS_VAZIOS[campo])}
          >
            {valor}
          </ChipDeFiltro>
        ))}
      </ChipsDeFiltro>
    </PainelDeFiltros>
  );
}

/* ── KPIs ───────────────────────────────────────────────────────────── */

/* O card de KPI de src/ui/ com o número formatado; os que filtram são botões. */
function Kpi({
  valor,
  sufixo = "",
  aoFiltrar,
  carregado,
  ...props
}: Omit<
  ComponentProps<typeof CardDeKpi>,
  "valor" | "aoClicar" | "carregando"
> & {
  valor: number;
  sufixo?: string;
  aoFiltrar?: () => void;
  carregado: boolean;
}) {
  return (
    <CardDeKpi
      valor={`${formatNumberBR(valor)}${sufixo}`}
      aoClicar={aoFiltrar}
      carregando={!carregado}
      {...props}
    />
  );
}

/*
  Quatro KPIs, os que pedem decisão: o que espera o parecer jurídico (em
  destaque), o prazo vencido e o que já se decidiu (deferidos, com os
  parcialmente, e indeferidos). Cada um filtra a tela. O total fica na
  contagem da fila; o resto (sem SEI, sem resposta, respostas em revisão,
  mudou a nota, prazo vencendo, registrados sem envio) virou pendência,
  filtro ou gráfico — nada se perdeu.
*/
export function Indicadores({
  indicadores: k,
  carregado,
  filtros,
  aoFiltrar,
}: PropsDoFiltro & { indicadores: ReturnType<typeof calcularIndicadores> }) {
  const filtro = (campo: CampoDoFiltroDosRecursos, valor: string) =>
    carregado
      ? {
          ativo: filtros[campo] === valor,
          aoFiltrar: () => aoFiltrar(campo, valor),
        }
      : {};
  return (
    <GradeDeKpis
      tour="recursos-kpis"
      className="recursos-kpis"
      rotulo="Indicadores"
    >
      <Kpi
        cor="k-purple"
        icone="fa-scale-balanced"
        chave="aguardando-parecer"
        rotulo="Aguardando parecer"
        valor={k.aguardandoParecer}
        carregado={carregado}
        {...filtro("situacao", "EM_ANALISE_JURIDICA")}
      />
      <Kpi
        cor="k-red"
        icone="fa-triangle-exclamation"
        chave="prazo-vencido"
        rotulo="Prazo vencido"
        valor={k.atrasados}
        carregado={carregado}
        {...filtro("pendencia", "prazo_vencido")}
      />
      <Kpi
        cor="k-green"
        icone="fa-circle-check"
        chave="deferidos"
        rotulo="Deferidos"
        titulo="Deferidos, inclusive os parcialmente"
        valor={k.deferidos}
        carregado={carregado}
        {...filtro("situacao", "deferidos")}
      />
      <Kpi
        cor="k-slate"
        icone="fa-circle-xmark"
        chave="indeferidos"
        rotulo="Indeferidos"
        valor={k.indeferidos}
        carregado={carregado}
        {...filtro("situacao", "INDEFERIDO")}
      />
    </GradeDeKpis>
  );
}

/* ── Recorte ativo ──────────────────────────────────────────────────── */

export function Recorte({
  ativos,
  recursos,
  carregado,
}: {
  ativos: FiltroAtivo[];
  recursos: readonly RecursoDoPainel[];
  carregado: boolean;
}) {
  const vencidos = recursos.filter((r) => r.atrasado).length;
  const decididos = recursos.filter((r) => r.decidido).length;
  const taxa = recursos.length
    ? Math.round((decididos / recursos.length) * 100)
    : 0;
  const semPrazo = recursos.filter((r) => !r.prazo.data).length;
  const pelaAbertura = recursos.filter(
    (r) => r.prazo.fonte === "abertura",
  ).length;
  const marcas = [
    {
      chave: "vencidos",
      tom: vencidos ? "alerta" : "sucesso",
      icone: vencidos ? "fa-triangle-exclamation" : "fa-circle-check",
      texto: `${formatNumberBR(vencidos)} recurso(s) com o prazo de resposta vencido`,
    },
    {
      chave: "decididos",
      icone: "fa-gavel",
      texto: `${formatNumberBR(taxa)}% decididos (${formatNumberBR(decididos)} de ${formatNumberBR(recursos.length)})`,
    },
    semPrazo && {
      chave: "sem-prazo",
      tom: "alerta",
      icone: "fa-circle-info",
      texto: `${formatNumberBR(semPrazo)} sem prazo no cronograma`,
    },
    pelaAbertura && {
      chave: "pela-abertura",
      icone: "fa-calendar-days",
      texto: `${formatNumberBR(pelaAbertura)} com prazo estimado (*)`,
    },
  ].filter(Boolean);
  return (
    <LinhaDoRecorte ativos={ativos}>
      {carregado ? <MarcasDoRecorte marcas={marcas} /> : null}
    </LinhaDoRecorte>
  );
}

/* ── Pendências prioritárias ────────────────────────────────────────── */

/* Severidade → tom da borda do item: alta em vermelho; média e baixa em âmbar. */
const TOM_DA_SEVERIDADE: Record<Pendencia["severidade"], string> = {
  alta: "perigo",
  media: "alerta",
  baixa: "alerta",
};

function Pendencias({
  pendencias,
  carregado,
  filtros,
  aoFiltrar,
}: PropsDoFiltro & { pendencias: readonly Pendencia[] }) {
  return (
    <ListaDePendencias
      carregando={!carregado}
      vazio="Nenhuma pendência prioritária no recorte atual."
      itens={pendencias.map((p) => ({
        chave: p.chave,
        titulo: p.titulo,
        detalhe: `${formatNumberBR(p.valor)} ${p.valor === 1 ? "recurso" : "recursos"}`,
        tom: TOM_DA_SEVERIDADE[p.severidade],
        ativo: filtros.pendencia === p.chave,
        aoClicar: () => aoFiltrar("pendencia", p.chave),
      }))}
    />
  );
}

/* ── Gráficos ───────────────────────────────────────────────────────── */

/* Eixos, legenda e dica dos gráficos de barra. */
function opcoesDeBarras(
  p: ReturnType<typeof paleta>,
  {
    empilhado = false,
    legenda = false,
    deitado = false,
    aoClicar,
    dica,
  }: {
    empilhado?: boolean;
    legenda?: boolean;
    deitado?: boolean;
    aoClicar?: (indice: number) => void;
    dica?: Partial<TooltipCallbacks<"bar">>;
  } = {},
): ChartOptions<"bar"> {
  const categorias = {
    stacked: empilhado,
    ticks: { color: p.text, maxRotation: 0 },
    grid: { display: false },
  };
  const valores = {
    stacked: empilhado,
    beginAtZero: true,
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
      legend: legenda
        ? {
            position: "top",
            labels: { color: p.text, boxWidth: 14, usePointStyle: true },
          }
        : { display: false },
      tooltip: dica ? { callbacks: dica } : {},
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

const coresDaSituacao = (
  p: ReturnType<typeof paleta>,
): Partial<Record<string, string>> => ({
  warning: p.warn,
  success: p.ok,
  danger: p.bad,
  info: p.review,
});

/* As cores dos tokens do app (com a paleta dos painéis de reserva). */
const paleta = (escuro: boolean) =>
  paletaDosGraficos(escuro, paletaDoPainel(escuro));

export function Graficos({
  recursos,
  pendencias,
  carregado,
  filtros,
  aoFiltrar,
  escuro,
}: PropsDoFiltro & {
  recursos: readonly RecursoDoPainel[];
  pendencias: readonly Pendencia[];
  escuro: boolean;
}) {
  const analistas = useMemo(
    () => recursosPorAnalista(recursos, 12),
    [recursos],
  );
  const situacoes = useMemo(() => recursosPorSituacao(recursos), [recursos]);
  const impacto = useMemo(() => impactoNoResultado(recursos), [recursos]);
  const esteira = useMemo(() => esteiraDosRecursos(recursos), [recursos]);
  const total = recursos.length;
  const tema = escuro ? "escuro" : "claro";
  const carregando = !carregado;

  // O clique do Chart.js chega aqui, sempre com o filtro mais recente.
  const filtrar = useRef(aoFiltrar);
  useEffect(() => {
    filtrar.current = aoFiltrar;
  });

  return (
    <>
      <div className="ui-linha-de-cards">
        <CardDeGrafico
          titulo="Recursos por analista"
          altura="short"
          carregando={carregando}
        >
          <Grafico
            id="chartAnalista"
            tipo="bar"
            rotulo="Recursos por analista: sem decisão e decididos"
            dependencias={[analistas, tema]}
            montar={() => {
              const p = paleta(escuro);
              return {
                data: {
                  labels: analistas.map((a) => truncar(a.rotulo, 22)),
                  datasets: [
                    {
                      label: "Sem decisão",
                      data: analistas.map((a) => a.pendentes),
                      backgroundColor: p.warn,
                      borderRadius: 6,
                    },
                    {
                      label: "Decididos",
                      data: analistas.map((a) => a.concluidos),
                      backgroundColor: p.ok,
                      borderRadius: 6,
                    },
                  ],
                },
                options: opcoesDeBarras(p, {
                  empilhado: true,
                  legenda: true,
                  dica: {
                    title: (itens) =>
                      analistas[itens[0]?.dataIndex ?? -1]?.rotulo || "",
                    afterBody: (itens) => [
                      `Total: ${formatNumberBR(analistas[itens[0]?.dataIndex ?? -1]?.total || 0)}`,
                    ],
                  },
                  aoClicar: (indice) => {
                    const analista = analistas[indice];
                    if (analista) filtrar.current("analista", analista.rotulo);
                  },
                }),
              };
            }}
          />
        </CardDeGrafico>
        <article className="ui-card ui-pilha" data-tour="recursos-pendencias">
          <h2 className="ui-titulo">Pendências prioritárias</h2>
          <Pendencias
            pendencias={pendencias}
            carregado={carregado}
            filtros={filtros}
            aoFiltrar={aoFiltrar}
          />
        </article>
      </div>

      <div className="ui-linha-de-cards">
        <CardDeGrafico titulo="Situação" altura="short" carregando={carregando}>
          <Grafico
            id="chartSituacao"
            tipo="bar"
            rotulo="Recursos por situação"
            dependencias={[situacoes, tema]}
            montar={() => {
              const p = paleta(escuro);
              const cores = coresDaSituacao(p);
              return {
                data: {
                  labels: situacoes.map((s) => s.rotulo),
                  datasets: [
                    {
                      label: "Recursos",
                      data: situacoes.map((s) => s.valor),
                      backgroundColor: situacoes.map(
                        (s) => cores[s.tom] || p.blue,
                      ),
                      borderRadius: 6,
                    },
                  ],
                },
                options: opcoesDeBarras(p, {
                  aoClicar: (indice) =>
                    situacoes[indice] &&
                    filtrar.current("situacao", situacoes[indice].id),
                }),
              };
            }}
          />
        </CardDeGrafico>
        <CardDeGrafico
          titulo="Impacto no resultado: nota atual × nota do cadastro"
          altura="short"
          carregando={carregando}
        >
          <Grafico
            id="chartImpacto"
            tipo="bar"
            rotulo="Impacto dos recursos na nota e na classificação"
            dependencias={[impacto, tema]}
            montar={() => {
              const p = paleta(escuro);
              return {
                data: {
                  labels: impacto.map((i) => i.rotulo),
                  datasets: [
                    {
                      label: "Recursos",
                      data: impacto.map((i) => i.valor),
                      backgroundColor: [p.review, p.warn, p.ok],
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
        titulo="Esteira do recurso"
        carregando={carregando}
      >
        <Grafico
          id="chartEsteira"
          tipo="bar"
          rotulo="Recursos por etapa da esteira"
          dependencias={[esteira, tema]}
          montar={() => {
            const p = paleta(escuro);
            return {
              data: {
                labels: esteira.map((etapa) => etapa.rotulo),
                datasets: [
                  {
                    label: "Recursos",
                    data: esteira.map((etapa) => etapa.valor),
                    backgroundColor: p.blue,
                    borderRadius: 6,
                  },
                ],
              },
              options: opcoesDeBarras(p, {
                deitado: true,
                dica: {
                  label: (item) =>
                    `${formatNumberBR(item.parsed.x ?? 0)} recurso(s)${total ? ` · ${Math.round(((item.parsed.x ?? 0) / total) * 100)}%` : ""}`,
                },
              }),
            };
          }}
        />
      </CardDeGrafico>
    </>
  );
}
