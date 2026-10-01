import { useEffect, useMemo, useRef, useState } from "react";
import { formatNumberBR } from "../../lib/formatters.js";
import {
  esteiraDosRecursos,
  FILTROS_VAZIOS,
  impactoNoResultado,
  recursosPorAnalista,
  recursosPorSituacao,
} from "../../lib/recursos-dos-candidatos.js";
import { paletaDoPainel } from "../../lib/tema-do-painel.js";
import {
  CardDeGrafico,
  ChipDeFiltro,
  ChipsDeFiltro,
  classes,
  EstadoVazio,
  GradeDeKpis,
  Kpi as CardDeKpi,
  PainelDeFiltros,
  TopoDoPainel,
} from "../../ui/index.js";
import { Grafico } from "./grafico.jsx";

/*
  Os blocos do painel de recursos, com a marcação e as classes do painel de
  análises curriculares (analises.html + src/analises/*.css): o cabeçalho fixo
  (`.topbar`), "Refinar resultados" (`.filter-panel`), os KPIs (`.kpis` >
  `.kpi` com a barra colorida em cima), o recorte ativo (`.context-line`), os
  gráficos Chart.js em `.panel` (`.oper-grid`, `.trend`) e as pendências
  prioritárias (`.attention-list`). Os ids que o CSS de análises usa (kpiGrid,
  attentionList, tableBody, topbar…) são os mesmos, e o skeleton é o dele
  (`body.analises-is-loading`, analises-esqueleto.css).
*/

const truncar = (valor, limite) => {
  const texto = String(valor ?? "").trim();
  return texto.length > limite ? `${texto.slice(0, limite - 1)}…` : texto;
};

/* ── Cabeçalho ──────────────────────────────────────────────────────── */

export function Topo({ aoNovo, novoDesativado, aoModelos, ...props }) {
  return (
    <TopoDoPainel titulo="Painel de recursos" {...props}>
      {aoModelos ? (
        <button
          type="button"
          className="btn secondary"
          id="modelosRespostaBtn"
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
          id="novoRecursoBtn"
          disabled={novoDesativado}
          onClick={aoNovo}
        >
          <i className="fa-solid fa-plus" aria-hidden="true" /> Novo recurso
        </button>
      ) : null}
    </TopoDoPainel>
  );
}

/* ── Filtros ────────────────────────────────────────────────────────── */

export const CAMPOS_DO_FILTRO = [
  ["edital", "Edital", "editais", "Todos os editais"],
  ["origem", "Origem", "origens", "Todas as origens"],
  ["analista", "Analista", "analistas", "Todos os analistas"],
  ["situacao", "Situação", "situacoes", "Todas as situações"],
  ["pendencia", "Pendência", "pendencias", "Qualquer pendência"],
];

const rotuloDoValor = (opcoes, lista, valor) =>
  opcoes[lista].find((o) => o.valor === valor)?.rotulo || valor;

/** Os filtros ativos, como o recorte os descreve: `[campo, rótulo, valor]`. */
export function filtrosAtivos(filtros, opcoes) {
  const ativos = CAMPOS_DO_FILTRO.filter(([campo]) => filtros[campo]).map(
    ([campo, rotulo, lista]) => [
      campo,
      rotulo,
      rotuloDoValor(opcoes, lista, filtros[campo]),
    ],
  );
  if (String(filtros.busca || "").trim())
    ativos.push(["busca", "Busca", filtros.busca.trim()]);
  return ativos;
}

export function Filtros({ filtros, opcoes, carregado, aoMudar, aoLimpar }) {
  const [maisOpcoes, setMaisOpcoes] = useState(false);
  const ativos = filtrosAtivos(filtros, opcoes);
  const avancados = String(filtros.busca || "").trim() ? 1 : 0;

  return (
    <PainelDeFiltros
      idDoTitulo="recursosFiltrosTitulo"
      quantos={ativos.length}
      aoLimpar={aoLimpar}
      aoRecolher={() => setMaisOpcoes(false)}
    >
      <div id="filtersToolbar" className="filters-toolbar">
        <div className="filters-toolbar-copy">
          <strong>Filtros principais</strong>
        </div>
        <button
          type="button"
          className="btn secondary"
          id="advancedBtn"
          aria-expanded={maisOpcoes}
          title={
            maisOpcoes
              ? "Ocultar filtros adicionais"
              : "Mostrar a busca em todo o painel"
          }
          onClick={() => setMaisOpcoes((atual) => !atual)}
        >
          <i
            className={`fa-solid ${maisOpcoes ? "fa-chevron-up" : "fa-sliders"}`}
            aria-hidden="true"
          />{" "}
          {maisOpcoes ? "Menos opções" : "Mais opções"}{" "}
          {avancados ? (
            <span className="advanced-count">{avancados}</span>
          ) : null}
        </button>
      </div>
      <div className="filter-grid">
        {CAMPOS_DO_FILTRO.map(([campo, rotulo, lista, todos]) => (
          <div className="field" key={campo}>
            <label htmlFor={`filtro-${campo}`}>{rotulo}</label>
            <select
              id={`filtro-${campo}`}
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
          </div>
        ))}
      </div>
      <div
        id="advancedFilters"
        className={classes("advanced filter-grid", maisOpcoes && "show")}
      >
        <div className="field">
          <label htmlFor="filtro-busca">Buscar em todo o painel</label>
          <input
            id="filtro-busca"
            type="search"
            name="busca"
            value={filtros.busca}
            disabled={!carregado}
            placeholder="Candidato, código, vaga, nº ou processo SEI"
            onChange={(evento) => aoMudar("busca", evento.target.value)}
          />
        </div>
      </div>
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
function Kpi({ valor, sufixo = "", aoFiltrar, ...props }) {
  return (
    <CardDeKpi
      valor={`${formatNumberBR(valor)}${sufixo}`}
      aoClicar={aoFiltrar}
      {...props}
    />
  );
}

export function Indicadores({ indicadores: k, carregado, filtros, aoFiltrar }) {
  const filtro = (campo, valor) =>
    carregado
      ? {
          ativo: filtros[campo] === valor,
          aoFiltrar: () => aoFiltrar(campo, valor),
        }
      : {};
  return (
    <GradeDeKpis id="kpiGrid" rotulo="Indicadores">
      <Kpi
        cor="k-cyan"
        chave="total"
        rotulo="Total de recursos"
        valor={k.total}
      />
      <Kpi
        cor="k-yellow"
        chave="em-analise"
        rotulo="Em análise"
        valor={k.pendentes}
        {...filtro("situacao", "EM_ANALISE")}
      />
      <Kpi
        cor="k-green"
        chave="decididos"
        rotulo="Decididos"
        valor={k.concluidos}
      />
      <Kpi
        cor="k-red"
        chave="prazo-vencido"
        rotulo="Prazo vencido"
        valor={k.atrasados}
        {...filtro("pendencia", "prazo_vencido")}
      />
      <Kpi
        cor="k-red"
        chave="sem-sei"
        rotulo="Sem processo SEI"
        valor={k.semSei}
        {...filtro("pendencia", "sem_sei")}
      />
      <Kpi
        cor="k-yellow"
        chave="sem-resposta"
        rotulo="Sem resposta enviada"
        valor={k.semResposta}
      />
      <Kpi
        cor="k-purple"
        chave="mudou-resultado"
        rotulo="Mudou nota/classificação"
        valor={k.mudouResultado}
        {...filtro("pendencia", "mudou_resultado")}
      />
      <Kpi
        chave="taxa"
        rotulo="Taxa de conclusão"
        valor={k.taxaConclusao}
        sufixo="%"
      />
    </GradeDeKpis>
  );
}

/*
  A resposta escrita no sistema (resposta-do-recurso.js): em revisão,
  aprovadas aguardando envio e devolvidas. Uma segunda fileira de `.kpi`,
  alinhada às colunas da primeira; cada uma filtra pela pendência dela.
*/
export function IndicadoresDasRespostas({
  indicadores: k,
  carregado,
  filtros,
  aoFiltrar,
}) {
  const filtro = (valor) =>
    carregado
      ? {
          ativo: filtros.pendencia === valor,
          aoFiltrar: () => aoFiltrar("pendencia", valor),
        }
      : {};
  return (
    <GradeDeKpis
      className="recursos-kpis-respostas"
      id="kpiGridRespostas"
      rotulo="Indicadores das respostas"
    >
      <Kpi
        cor="k-yellow"
        chave="respostas-em-revisao"
        rotulo="Respostas em revisão"
        valor={k.respostasEmRevisao}
        {...filtro("resposta_em_revisao")}
      />
      <Kpi
        cor="k-green"
        chave="respostas-aprovadas"
        rotulo="Aprovadas aguardando envio"
        valor={k.respostasAprovadas}
        {...filtro("resposta_aprovada")}
      />
      <Kpi
        cor="k-red"
        chave="respostas-devolvidas"
        rotulo="Respostas devolvidas"
        valor={k.respostasDevolvidas}
        {...filtro("resposta_devolvida")}
      />
    </GradeDeKpis>
  );
}

/* ── Recorte ativo ──────────────────────────────────────────────────── */

export function Recorte({ ativos, recursos, carregado }) {
  const vencidos = recursos.filter((r) => r.atrasado).length;
  const semPrazo = recursos.filter((r) => !r.prazo.data).length;
  const pelaAbertura = recursos.filter(
    (r) => r.prazo.fonte === "abertura",
  ).length;
  return (
    <section className="panel panel-pad">
      <div id="contextLine" className="context-line">
        {ativos.length
          ? `Recorte ativo: ${ativos.map(([, rotulo, valor]) => `${rotulo}: ${valor}`).join(" · ")}`
          : "Sem filtros"}
      </div>
      <div id="windowMeta" className="meta-line">
        {carregado ? (
          <>
            <span className={classes("meta-chip", vencidos && "warning")}>
              <i
                className={`fa-solid ${vencidos ? "fa-triangle-exclamation" : "fa-circle-check"}`}
                aria-hidden="true"
              />{" "}
              {formatNumberBR(vencidos)} recurso(s) com o prazo de resposta
              vencido
            </span>
            {semPrazo ? (
              <span className="meta-chip warning">
                <i className="fa-solid fa-circle-info" aria-hidden="true" />{" "}
                {formatNumberBR(semPrazo)} sem prazo no cronograma
              </span>
            ) : null}
            {pelaAbertura ? (
              <span className="meta-chip">
                <i className="fa-solid fa-calendar-days" aria-hidden="true" />{" "}
                {formatNumberBR(pelaAbertura)} com prazo estimado (*)
              </span>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}

/* ── Pendências prioritárias ────────────────────────────────────────── */

/*
  Severidade → classe do `.attention-item` de análises: alta é `high` (borda
  vermelha); média e baixa ficam na borda âmbar (a classe `low` de lá esconde
  o item, e aqui as de baixa — prazo não encontrado, fora das análises —
  precisam aparecer).
*/
const CLASSE_DA_SEVERIDADE = { alta: "high", media: "", baixa: "" };
const ITENS_DO_ESQUELETO = 4;

function Pendencias({ pendencias, carregado, filtros, aoFiltrar }) {
  if (!carregado)
    return (
      <div id="attentionList" className="attention-list" aria-hidden="true">
        {Array.from({ length: ITENS_DO_ESQUELETO }, (_, indice) => (
          <div className="attention-item" key={indice}>
            <b>&nbsp;</b>
            <small>&nbsp;</small>
          </div>
        ))}
      </div>
    );
  return (
    <div id="attentionList" className="attention-list">
      {pendencias.length ? (
        pendencias.map((p) => {
          const ativo = filtros.pendencia === p.chave;
          return (
            <button
              type="button"
              key={p.chave}
              className={classes(
                "attention-item",
                CLASSE_DA_SEVERIDADE[p.severidade],
                ativo && "is-active",
              )}
              data-action="pendencia"
              aria-pressed={ativo}
              onClick={() => aoFiltrar("pendencia", p.chave)}
            >
              <b>{p.titulo}</b>
              <small>
                {formatNumberBR(p.valor)}{" "}
                {p.valor === 1 ? "recurso" : "recursos"}
                {p.subtitulo ? ` · ${p.subtitulo}` : ""}
              </small>
            </button>
          );
        })
      ) : (
        <EstadoVazio>
          Nenhuma pendência prioritária no recorte atual.
        </EstadoVazio>
      )}
    </div>
  );
}

/* ── Gráficos ───────────────────────────────────────────────────────── */

/* Eixos, legenda e dica dos gráficos de barra do painel de análises. */
function opcoesDeBarras(
  p,
  { empilhado = false, legenda = false, deitado = false, aoClicar, dica } = {},
) {
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
          if (elementos.length) aoClicar(elementos[0].index);
        }
      : undefined,
  };
}

const coresDaSituacao = (p) => ({
  warning: p.warn,
  success: p.ok,
  danger: p.bad,
  info: p.review,
});

export function Graficos({
  recursos,
  pendencias,
  carregado,
  filtros,
  aoFiltrar,
  escuro,
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

  // O clique do Chart.js chega aqui, sempre com o filtro mais recente.
  const filtrar = useRef(aoFiltrar);
  useEffect(() => {
    filtrar.current = aoFiltrar;
  });

  return (
    <>
      <section className="oper-grid">
        <CardDeGrafico titulo="Recursos por analista" altura="short">
          <Grafico
            id="chartAnalista"
            tipo="bar"
            rotulo="Recursos por analista: em análise e decididos"
            dependencias={[analistas, tema]}
            montar={() => {
              const p = paletaDoPainel(escuro);
              return {
                data: {
                  labels: analistas.map((a) => truncar(a.rotulo, 22)),
                  datasets: [
                    {
                      label: "Em análise",
                      data: analistas.map((a) => a.pendentes),
                      backgroundColor: p.warn,
                      borderRadius: 7,
                    },
                    {
                      label: "Decididos",
                      data: analistas.map((a) => a.concluidos),
                      backgroundColor: p.ok,
                      borderRadius: 7,
                    },
                  ],
                },
                options: opcoesDeBarras(p, {
                  empilhado: true,
                  legenda: true,
                  dica: {
                    title: (itens) =>
                      analistas[itens[0].dataIndex]?.rotulo || "",
                    afterBody: (itens) => [
                      `Total: ${formatNumberBR(analistas[itens[0].dataIndex]?.total || 0)}`,
                    ],
                  },
                  aoClicar: (indice) =>
                    analistas[indice] &&
                    filtrar.current("analista", analistas[indice].rotulo),
                }),
              };
            }}
          />
        </CardDeGrafico>
        <article className="panel panel-pad">
          <h2 className="title">Pendências prioritárias</h2>
          <Pendencias
            pendencias={pendencias}
            carregado={carregado}
            filtros={filtros}
            aoFiltrar={aoFiltrar}
          />
        </article>
      </section>

      <section className="oper-grid">
        <CardDeGrafico titulo="Situação" altura="short">
          <Grafico
            id="chartSituacao"
            tipo="bar"
            rotulo="Recursos por situação"
            dependencias={[situacoes, tema]}
            montar={() => {
              const p = paletaDoPainel(escuro);
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
                      borderRadius: 7,
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
        <article className="panel panel-pad">
          <h2 className="title">Impacto no resultado</h2>
          <p className="hint">Nota atual × nota do cadastro</p>
          <div className="chart-wrap short">
            <Grafico
              id="chartImpacto"
              tipo="bar"
              rotulo="Impacto dos recursos na nota e na classificação"
              dependencias={[impacto, tema]}
              montar={() => {
                const p = paletaDoPainel(escuro);
                return {
                  data: {
                    labels: impacto.map((i) => i.rotulo),
                    datasets: [
                      {
                        label: "Recursos",
                        data: impacto.map((i) => i.valor),
                        backgroundColor: [p.review, p.warn, p.ok],
                        borderRadius: 7,
                      },
                    ],
                  },
                  options: opcoesDeBarras(p),
                };
              }}
            />
          </div>
        </article>
      </section>

      <CardDeGrafico
        elemento="section"
        className="trend"
        titulo="Esteira do recurso"
      >
        <Grafico
          id="chartEsteira"
          tipo="bar"
          rotulo="Recursos por etapa da esteira"
          dependencias={[esteira, tema]}
          montar={() => {
            const p = paletaDoPainel(escuro);
            return {
              data: {
                labels: esteira.map((etapa) => etapa.rotulo),
                datasets: [
                  {
                    label: "Recursos",
                    data: esteira.map((etapa) => etapa.valor),
                    backgroundColor: p.blue,
                    borderRadius: 7,
                  },
                ],
              },
              options: opcoesDeBarras(p, {
                deitado: true,
                dica: {
                  label: (item) =>
                    `${formatNumberBR(item.parsed.x)} recurso(s)${total ? ` · ${Math.round((item.parsed.x / total) * 100)}%` : ""}`,
                },
              }),
            };
          }}
        />
      </CardDeGrafico>
    </>
  );
}
