import { useEffect, useMemo, useRef, useState } from "react";
import { MultiSelectBusca } from "../../componentes/multi-select-busca.jsx";
import {
  analisesPorResponsavel,
  ESCOPOS,
  FILTROS,
  quantosFiltros,
  ROTULO_DO_KPI,
  rotuloDoEscopo,
  rotuloDoValor,
  STATUS_DO_GRAFICO,
  tendenciaDiaria,
} from "../../lib/analises-curriculares.js";
import { formatNumberBR } from "../../lib/formatters.js";
import { paletaDoPainel } from "../../lib/tema-do-painel.js";
import {
  Campo,
  CardDeGrafico,
  ChipDeFiltro,
  ChipsDeFiltro,
  Grafico,
  GradeDeKpis,
  Kpi,
  ListaDePendencias,
  MaisOpcoes,
  paletaDosGraficos,
  PainelDeFiltros,
} from "../../ui/index.js";

/*
  Os blocos da tela de Análises curriculares, com os componentes de src/ui/:
  "Refinar resultados" (situação do processo, filtros de seleção múltipla em
  cascata, "Mais opções" e os filtros aplicados), os 7 KPIs em card compacto
  (os seis primeiros filtram), os gráficos (carga por responsável, clicável, e
  a evolução diária) e as pendências prioritárias, que também filtram.
*/

const truncar = (valor, limite) => {
  const texto = String(valor ?? "").trim();
  return texto.length > limite ? `${texto.slice(0, limite - 1)}…` : texto;
};

/* ── Filtros ────────────────────────────────────────────────────────── */

const idDoFiltro = (campo) => `analises-filtro-${campo}`;

function CampoDeFiltro({ filtro, opcoes, selecionados, aoMudar }) {
  return (
    <Campo rotulo={filtro.rotulo} idDoControle={idDoFiltro(filtro.campo)}>
      <MultiSelectBusca
        id={idDoFiltro(filtro.campo)}
        opcoes={opcoes}
        selecionados={selecionados}
        placeholder={filtro.todos}
        aoMudar={(valores) => aoMudar(filtro.campo, valores)}
      />
    </Campo>
  );
}

/**
 * `chips`: os filtros aplicados, `[{ chave, rotulo, valor, aoTirar }]`.
 * `busca`/`aoBuscar`: o texto digitado da busca geral (o filtro aplica com
 * um respiro, em analises.jsx).
 */
export function Filtros({
  escopo,
  aoEscopo,
  filtros,
  opcoes,
  busca,
  aoBuscar,
  aoMudar,
  aoLimpar,
  podeLimpar,
  carregado,
  comMunicipio,
  chips,
}) {
  const [maisOpcoes, setMaisOpcoes] = useState(false);
  const campos = (avancado) =>
    FILTROS.filter(
      (filtro) =>
        Boolean(filtro.avancado) === avancado &&
        (filtro.campo !== "municipio" || comMunicipio),
    ).map((filtro) => (
      <CampoDeFiltro
        key={filtro.campo}
        filtro={filtro}
        opcoes={opcoes[filtro.campo]}
        selecionados={filtros[filtro.campo]}
        aoMudar={aoMudar}
      />
    ));

  return (
    <PainelDeFiltros
      idDoTitulo="analisesFiltrosTitulo"
      quantos={quantosFiltros(filtros)}
      escopo={rotuloDoEscopo(escopo)}
      podeLimpar={podeLimpar}
      aoLimpar={aoLimpar}
      aoRecolher={() => setMaisOpcoes(false)}
    >
      <div className="ui-grade-de-campos">
        <Campo rotulo="Situação do processo">
          <select
            id="analises-filtro-escopo"
            value={escopo}
            disabled={!carregado}
            onChange={(evento) => aoEscopo(evento.target.value)}
          >
            {ESCOPOS.map(({ valor, rotulo }) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </Campo>
        {campos(false)}
      </div>
      <MaisOpcoes
        id="analisesFiltrosAdicionais"
        aberto={maisOpcoes}
        aoAlternar={() => setMaisOpcoes((atual) => !atual)}
        quantos={quantosFiltros(filtros, { soAvancados: true })}
        titulo="Mostrar categoria, modalidade, validação e busca"
      >
        {campos(true)}
        <Campo rotulo="Buscar em toda a tela">
          <input
            id="analises-filtro-busca"
            type="search"
            value={busca}
            disabled={!carregado}
            placeholder="Candidato, vaga, edital, responsável ou parecer"
            onChange={(evento) => aoBuscar(evento.target.value)}
          />
        </Campo>
      </MaisOpcoes>
      <ChipsDeFiltro>
        {chips.map(({ chave, rotulo, valor, aoTirar }) => (
          <ChipDeFiltro key={chave} rotulo={rotulo} aoTirar={aoTirar}>
            {valor}
          </ChipDeFiltro>
        ))}
      </ChipsDeFiltro>
    </PainelDeFiltros>
  );
}

/** Os filtros aplicados como chips (cada um com o seu "x"). */
export function chipsDosFiltros({
  escopo,
  filtros,
  kpi,
  responsavel,
  aoTirarEscopo,
  aoMudar,
  aoBuscar,
  aoKpi,
  aoResponsavel,
}) {
  const chips = [];
  if (escopo !== "ativo")
    chips.push({
      chave: "escopo",
      rotulo: "Situação do processo",
      valor: rotuloDoEscopo(escopo),
      aoTirar: aoTirarEscopo,
    });
  for (const { campo, rotulo } of FILTROS) {
    const valores = filtros[campo];
    if (valores.length)
      chips.push({
        chave: campo,
        rotulo,
        valor: valores.map((v) => rotuloDoValor(campo, v)).join(", "),
        aoTirar: () => aoMudar(campo, []),
      });
  }
  if (String(filtros.busca || "").trim())
    chips.push({
      chave: "busca",
      rotulo: "Busca",
      valor: filtros.busca.trim(),
      aoTirar: () => aoBuscar(""),
    });
  if (kpi)
    chips.push({
      chave: "kpi",
      rotulo: "KPI",
      valor: ROTULO_DO_KPI[kpi],
      aoTirar: () => aoKpi(""),
    });
  if (responsavel)
    chips.push({
      chave: "responsavel-do-grafico",
      rotulo: "Responsável no gráfico",
      valor: responsavel,
      aoTirar: () => aoResponsavel(""),
    });
  return chips;
}

/* ── KPIs ───────────────────────────────────────────────────────────── */

const KPIS = [
  ["analisado", "k-green", "fa-list-check"],
  ["pendente", "k-yellow", "fa-clock"],
  ["revisar", "k-purple", "fa-magnifying-glass"],
  ["aprovado", "k-green", "fa-circle-check"],
  ["reprovado", "k-red", "fa-circle-xmark"],
];

/*
  Total (volta a mostrar todos), os cinco que filtram por status (clicar de
  novo tira o filtro) e a taxa de conclusão.
*/
export function Indicadores({ kpis, carregado, kpi, aoKpi }) {
  const valor = (numero) => formatNumberBR(numero);
  return (
    <GradeDeKpis className="analises-kpis" rotulo="Indicadores">
      <Kpi
        cor="k-cyan"
        icone="fa-users"
        chave="total"
        rotulo={ROTULO_DO_KPI.total}
        valor={valor(kpis.total)}
        carregando={!carregado}
        titulo="Mostrar todos os status"
        aoClicar={carregado ? () => aoKpi("") : undefined}
      />
      {KPIS.map(([chave, cor, icone]) => (
        <Kpi
          key={chave}
          cor={cor}
          icone={icone}
          chave={chave}
          rotulo={ROTULO_DO_KPI[chave]}
          valor={valor(kpis[chave])}
          carregando={!carregado}
          ativo={carregado ? kpi === chave : undefined}
          aoClicar={
            carregado ? () => aoKpi(kpi === chave ? "" : chave) : undefined
          }
        />
      ))}
      <Kpi
        cor="k-slate"
        icone="fa-chart-simple"
        chave="taxa"
        rotulo="Taxa de conclusão"
        valor={`${kpis.taxa}%`}
        carregando={!carregado}
      />
    </GradeDeKpis>
  );
}

/* ── Gráficos e pendências ──────────────────────────────────────────── */

/* As cores dos tokens do app (com a paleta dos painéis de reserva). */
const paleta = (escuro) => paletaDosGraficos(escuro, paletaDoPainel(escuro));

/* #rrggbb → rgba com transparência (o preenchimento da linha); outro formato, transparente. */
function translucido(cor, alfa) {
  const hex = String(cor || "")
    .trim()
    .match(/^#([0-9a-f]{6})$/i);
  if (!hex) return "transparent";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alfa})`;
}

const CORES_DO_STATUS = (p) => ({
  Pendente: p.warn,
  Revisar: p.review,
  Aprovado: p.ok,
  Reprovado: p.bad,
});

export function Graficos({
  linhas,
  pendencias,
  carregado,
  responsavel,
  aoResponsavel,
  escuro,
}) {
  const porResponsavel = useMemo(
    () => analisesPorResponsavel(linhas),
    [linhas],
  );
  const porDia = useMemo(() => tendenciaDiaria(linhas), [linhas]);
  const tema = escuro ? "escuro" : "claro";
  const carregando = !carregado;

  // O clique do Chart.js chega aqui, sempre com o filtro mais recente.
  const clique = useRef({ responsavel, aoResponsavel });
  useEffect(() => {
    clique.current = { responsavel, aoResponsavel };
  });

  return (
    <>
      <div className="ui-linha-de-cards">
        <CardDeGrafico
          titulo="Análises por responsável"
          altura="short"
          carregando={carregando}
        >
          <Grafico
            id="chartResponsavel"
            tipo="bar"
            rotulo="Análises por responsável, empilhadas por status"
            dependencias={[porResponsavel, tema]}
            montar={() => {
              const p = paleta(escuro);
              const cores = CORES_DO_STATUS(p);
              return {
                data: {
                  labels: porResponsavel.map((r) => truncar(r.rotulo, 22)),
                  datasets: STATUS_DO_GRAFICO.map((status) => ({
                    label: status,
                    data: porResponsavel.map((r) => r[status]),
                    backgroundColor: cores[status],
                    borderRadius: 6,
                  })),
                },
                options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  animation: { duration: 380 },
                  interaction: { mode: "index", intersect: false },
                  plugins: {
                    legend: {
                      position: "top",
                      labels: {
                        color: p.text,
                        boxWidth: 14,
                        usePointStyle: true,
                      },
                    },
                    tooltip: {
                      callbacks: {
                        title: (itens) =>
                          porResponsavel[itens[0].dataIndex]?.rotulo || "",
                        afterBody: (itens) => [
                          `Total: ${formatNumberBR(porResponsavel[itens[0].dataIndex]?.total || 0)}`,
                        ],
                      },
                    },
                  },
                  scales: {
                    x: {
                      stacked: true,
                      ticks: { color: p.text, maxRotation: 0 },
                      grid: { display: false },
                    },
                    y: {
                      stacked: true,
                      beginAtZero: true,
                      ticks: { color: p.text, precision: 0 },
                      grid: { color: p.grid },
                    },
                  },
                  onClick: (_, elementos) => {
                    const item = porResponsavel[elementos[0]?.index];
                    if (!item) return;
                    const atual = clique.current;
                    atual.aoResponsavel(
                      atual.responsavel === item.rotulo ? "" : item.rotulo,
                    );
                  },
                },
              };
            }}
          />
        </CardDeGrafico>
        <article className="ui-card ui-pilha" data-tour="analises-pendencias">
          <h2 className="ui-titulo">Pendências prioritárias</h2>
          <ListaDePendencias
            carregando={carregando}
            itens={pendencias}
            vazio="Nenhuma pendência prioritária no recorte atual."
          />
        </article>
      </div>

      <CardDeGrafico
        elemento="section"
        titulo="Análises por data"
        carregando={carregando}
      >
        <Grafico
          id="chartTendencia"
          tipo="line"
          rotulo="Análises por data; pontos em vermelho: fora da janela oficial ou com data no futuro"
          dependencias={[porDia, tema]}
          montar={() => {
            const p = paleta(escuro);
            const marcado = (dia) => dia.fora || dia.futuras;
            return {
              data: {
                labels: porDia.map((dia) => dia.rotulo),
                datasets: [
                  {
                    label: "Análises",
                    data: porDia.map((dia) => dia.valor),
                    borderColor: p.blue,
                    backgroundColor: translucido(p.blue, 0.08),
                    pointBackgroundColor: porDia.map((dia) =>
                      marcado(dia) ? p.bad : p.blue,
                    ),
                    pointRadius: porDia.map((dia) => (marcado(dia) ? 5 : 3)),
                    borderWidth: 2.5,
                    tension: 0.22,
                    fill: true,
                  },
                ],
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 380 },
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (item) =>
                        `${formatNumberBR(item.parsed.y)} análise(s)`,
                      afterBody: (itens) => {
                        const dia = porDia[itens[0].dataIndex];
                        if (!dia) return [];
                        return [
                          ...(dia.fora
                            ? [`${formatNumberBR(dia.fora)} fora do período`]
                            : []),
                          ...(dia.futuras
                            ? [
                                `${formatNumberBR(dia.futuras)} com data no futuro — corrija na planilha`,
                              ]
                            : []),
                        ];
                      },
                    },
                  },
                },
                scales: {
                  x: {
                    ticks: { color: p.text, maxRotation: 0 },
                    grid: { color: p.grid },
                  },
                  y: {
                    beginAtZero: true,
                    ticks: { color: p.text, precision: 0 },
                    grid: { color: p.grid },
                  },
                },
              },
            };
          }}
        />
      </CardDeGrafico>
    </>
  );
}
