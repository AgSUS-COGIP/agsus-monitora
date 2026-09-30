import { useEffect, useMemo, useRef, useState } from "react";
import { formatNumberBR } from "../../lib/formatters.js";
import {
  FILTROS_VAZIOS,
  formatarQuantidade,
  funil,
  motivosDeEliminacao,
  topUnidades,
} from "../../lib/selecao-do-painel.js";
import { paletaDoPainel } from "../../lib/tema-do-painel.js";
import { Grafico } from "../recursos/grafico.jsx";
import { classes, usarAlturaDoTopo } from "../recursos/paineis.jsx";

/*
  Os blocos do painel de seleção, com a marcação e as classes do painel de
  análises (o mesmo desenho dos painéis de entrevistas e de recursos): o
  cabeçalho fixo (`.topbar`), "Refinar resultados" (`.filter-panel`), os KPIs
  (`.kpis` > `.kpi`), o recorte (`.context-line`), os gráficos Chart.js em
  `.panel` (`.oper-grid`) e as pendências (`.attention-list`). Só leitura.
*/

const truncar = (valor, limite) => {
  const texto = String(valor ?? "").trim();
  return texto.length > limite ? `${texto.slice(0, limite - 1)}…` : texto;
};

/* ── Cabeçalho ──────────────────────────────────────────────────────── */

export function Topo({
  subtitulo,
  status,
  escuro,
  aoTema,
  aoTelaCheia,
  aoAtualizar,
  atualizarDesativado,
  aoExportar,
  exportarDesativado,
}) {
  const topo = useRef(null);
  usarAlturaDoTopo(topo);
  const rotuloDoTema = escuro ? "Usar tema claro" : "Usar tema escuro";
  return (
    <header className="topbar" id="topbar" ref={topo}>
      <div className="brand">
        <div>
          <h1>Painel de seleção</h1>
          <p className="sub">{subtitulo}</p>
        </div>
      </div>
      <div className="top-actions">
        <span className="status-pill">
          <span className="dot" />
          <span id="updatedText">{status}</span>
        </span>
        <span className="status-pill" title="O painel só consulta">
          <i className="fa-solid fa-eye" aria-hidden="true" /> Somente consulta
        </span>
        <button
          type="button"
          className="btn secondary icon"
          id="themeBtn"
          title={rotuloDoTema}
          aria-label={rotuloDoTema}
          onClick={aoTema}
        >
          <i
            className={`fa-solid ${escuro ? "fa-sun" : "fa-moon"}`}
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          className="btn secondary icon"
          id="fullBtn"
          title="Tela cheia"
          aria-label="Alternar tela cheia"
          onClick={aoTelaCheia}
        >
          <i className="fa-solid fa-expand" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn"
          id="refreshBtn"
          disabled={atualizarDesativado}
          onClick={aoAtualizar}
        >
          <i className="fa-solid fa-rotate" aria-hidden="true" /> Atualizar
        </button>
        <button
          type="button"
          className="btn green"
          id="exportBtn"
          disabled={exportarDesativado}
          onClick={aoExportar}
        >
          <i className="fa-solid fa-download" aria-hidden="true" /> Exportar
        </button>
      </div>
    </header>
  );
}

/* ── Filtros ────────────────────────────────────────────────────────── */

export const CAMPOS_DO_FILTRO = [
  ["unidade", "Unidade", "unidades", "Todas as unidades"],
  ["edital", "Edital", "editais", "Todos os editais"],
  ["cargo", "Cargo", "cargos", "Todos os cargos"],
  ["origem", "Convocados vêm de", "origens", "Todas as origens"],
  ["situacao", "Situação", "situacoes", "Todas as situações"],
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
  const [recolhido, setRecolhido] = useState(false);
  const ativos = filtrosAtivos(filtros, opcoes);
  const quantos = ativos.length;

  return (
    <section
      className={classes("panel filter-panel", recolhido && "is-collapsed")}
      aria-labelledby="selecaoFiltrosTitulo"
    >
      <div className="filter-head">
        <div>
          <span className="eyebrow">Filtros da visualização</span>
          <h2 className="title" id="selecaoFiltrosTitulo">
            Refinar resultados
          </h2>
          <p className="hint">
            Indicadores, gráficos, pendências, a tabela e o CSV seguem o recorte
            selecionado.
          </p>
        </div>
        <div className="filter-actions">
          <span
            id="filterSummary"
            className={classes("filter-summary", quantos && "has-filters")}
            aria-live="polite"
          >
            <i
              className={`fa-solid ${quantos ? "fa-filter-circle-check" : "fa-layer-group"}`}
              aria-hidden="true"
            />
            <span>
              Todos ·{" "}
              {quantos
                ? `${quantos} filtro${quantos === 1 ? "" : "s"} adicional${quantos === 1 ? "" : "is"}`
                : "nenhum filtro adicional"}
            </span>
          </span>
          <button
            type="button"
            className="btn secondary"
            id="toggleFiltersBtn"
            aria-expanded={!recolhido}
            onClick={() => setRecolhido((atual) => !atual)}
          >
            <i
              className={`fa-solid ${recolhido ? "fa-filter" : "fa-chevron-up"}`}
              aria-hidden="true"
            />
            <span className="toggle-label">
              {recolhido ? "Mostrar filtros" : "Ocultar filtros"}
            </span>
          </button>
          <button
            type="button"
            className="btn secondary"
            id="clearBtn"
            disabled={!quantos}
            title="Remove os filtros e volta a todas as vagas da área."
            onClick={aoLimpar}
          >
            Limpar tudo
          </button>
        </div>
      </div>

      <div id="filtersBody" className="filters-body" hidden={recolhido}>
        <div className="filter-grid">
          <div className="field">
            <label htmlFor="filtro-busca">Buscar vaga</label>
            <input
              id="filtro-busca"
              type="search"
              name="busca"
              value={filtros.busca}
              disabled={!carregado}
              placeholder="Código da vaga, cargo ou unidade"
              onChange={(evento) => aoMudar("busca", evento.target.value)}
            />
          </div>
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
        <div id="filterChips" className="chips" aria-label="Filtros aplicados">
          {ativos.map(([campo, rotulo, valor]) => (
            <button
              key={campo}
              type="button"
              className="chip-filter"
              title={`Tirar o filtro ${rotulo}`}
              onClick={() => aoMudar(campo, FILTROS_VAZIOS[campo])}
            >
              <b>{rotulo}</b> {valor}{" "}
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── KPIs ───────────────────────────────────────────────────────────── */

function Kpi({ cor, rotulo, valor, chave, titulo }) {
  return (
    <article className={classes("kpi", cor)} data-kpi={chave} title={titulo}>
      <span>{rotulo}</span>
      <b>{valor}</b>
    </article>
  );
}

export function Indicadores({ indicadores: k }) {
  const n = formatarQuantidade;
  return (
    <section className="kpis" id="kpiGrid" aria-label="Indicadores">
      <Kpi
        cor="k-cyan"
        chave="vagas"
        rotulo="Vagas"
        valor={formatNumberBR(k.vagas)}
        titulo={`${formatNumberBR(k.editais)} edital(is)`}
      />
      <Kpi chave="inscritos" rotulo="Inscritos" valor={n(k.inscritos)} />
      <Kpi
        cor="k-green"
        chave="aptos"
        rotulo="Aptos para análise"
        valor={n(k.aptos)}
      />
      <Kpi
        cor="k-red"
        chave="eliminados"
        rotulo="Total de eliminados"
        valor={n(k.eliminados)}
      />
      <Kpi
        cor="k-purple"
        chave="triados"
        rotulo="Triados"
        valor={n(k.triados)}
      />
      <Kpi
        cor="k-yellow"
        chave="convocados"
        rotulo="Convocados p/ entrevista"
        valor={n(k.convocados)}
      />
      <Kpi
        cor="k-green"
        chave="aprovados"
        rotulo="Aprovados"
        valor={n(k.aprovados)}
        titulo="Da lista de aprovados vigente de cada edital"
      />
      <Kpi
        cor="k-cyan"
        chave="contratados"
        rotulo="Contratados"
        valor={n(k.contratados)}
        titulo="Status Contratado ou Migração na lista de aprovados"
      />
      <Kpi
        chave="nao-contratados"
        rotulo="Não contratados"
        valor={n(k.naoContratados)}
        titulo="Aprovados menos contratados"
      />
    </section>
  );
}

/* ── Recorte ativo ──────────────────────────────────────────────────── */

export function Recorte({ ativos, textoDaCarga, carregado }) {
  return (
    <section className="panel panel-pad">
      <div id="contextLine" className="context-line">
        {ativos.length
          ? `Recorte ativo: ${ativos.map(([, rotulo, valor]) => `${rotulo}: ${valor}`).join(" · ")}`
          : "Sem filtros aplicados. Recorte base: todas as vagas da área."}
      </div>
      <div id="windowMeta" className="meta-line">
        {carregado ? (
          <span className="meta-chip">
            <i className="fa-solid fa-table-list" aria-hidden="true" />{" "}
            {textoDaCarga}
          </span>
        ) : null}
      </div>
    </section>
  );
}

/* ── Pendências ─────────────────────────────────────────────────────── */

const CLASSE_DA_SEVERIDADE = { alta: "high", media: "", baixa: "" };
const ITENS_DO_ESQUELETO = 3;

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
  const comValor = pendencias.filter((p) => p.valor > 0);
  return (
    <div id="attentionList" className="attention-list">
      {comValor.length ? (
        comValor.map((p) => {
          const ativo = filtros.situacao === p.chave;
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
              onClick={() => aoFiltrar("situacao", p.chave)}
            >
              <b>{p.titulo}</b>
              <small>
                {formatNumberBR(p.valor)}{" "}
                {p.valor === 1 ? p.unidade[0] : p.unidade[1]} · {p.subtitulo}
              </small>
            </button>
          );
        })
      ) : (
        <div className="empty">Nenhuma pendência no recorte atual.</div>
      )}
    </div>
  );
}

/* ── Gráficos ───────────────────────────────────────────────────────── */

function opcoesDeBarras(p, { deitado = false, aoClicar, dica } = {}) {
  const categorias = {
    ticks: { color: p.text, maxRotation: 0, autoSkip: false },
    grid: { display: false },
  };
  const valores = {
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
      legend: { display: false },
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

function opcoesDeRosca(p) {
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
  };
}

export function Graficos({
  vagas,
  pendencias,
  carregado,
  filtros,
  aoFiltrar,
  escuro,
}) {
  const etapas = useMemo(() => funil(vagas), [vagas]);
  const motivos = useMemo(() => motivosDeEliminacao(vagas), [vagas]);
  const unidades = useMemo(() => topUnidades(vagas, 10), [vagas]);
  const tema = escuro ? "escuro" : "claro";

  const filtrar = useRef(aoFiltrar);
  useEffect(() => {
    filtrar.current = aoFiltrar;
  });

  return (
    <>
      <section className="oper-grid selecao-grade-dupla">
        <article className="panel panel-pad">
          <span className="eyebrow">Funil</span>
          <h2 className="title">Da inscrição à contratação</h2>
          <p className="hint">
            Soma das vagas do recorte. Convocados, aprovados e contratados vêm
            do MONITORA (entrevistas e lista de aprovados) quando o edital tem.
          </p>
          <div className="chart-wrap short">
            <Grafico
              id="chartFunil"
              tipo="bar"
              rotulo="Funil da seleção: inscritos, aptos, triados, convocados, aprovados e contratados"
              dependencias={[etapas, tema]}
              montar={() => {
                const p = paletaDoPainel(escuro);
                return {
                  data: {
                    labels: etapas.map((e) => e.rotulo),
                    datasets: [
                      {
                        label: "Candidatos",
                        data: etapas.map((e) => e.valor),
                        backgroundColor: [
                          p.blue,
                          p.review,
                          p.warn,
                          p.blue,
                          p.ok,
                          p.ok,
                        ],
                        borderRadius: 7,
                      },
                    ],
                  },
                  options: opcoesDeBarras(p, {
                    deitado: true,
                    dica: {
                      label: (item) =>
                        `${formatNumberBR(item.parsed.x)} candidato(s)`,
                    },
                  }),
                };
              }}
            />
          </div>
        </article>
        <article className="panel panel-pad">
          <span className="eyebrow">Eliminação</span>
          <h2 className="title">Por que saíram</h2>
          <p className="hint">
            Cancelados, questionário não finalizado, nota e análise curricular.
          </p>
          <div className="chart-wrap short">
            <Grafico
              id="chartMotivos"
              tipo="doughnut"
              rotulo="Eliminados por motivo"
              dependencias={[motivos, tema]}
              montar={() => {
                const p = paletaDoPainel(escuro);
                return {
                  data: {
                    labels: motivos.map((m) => m.rotulo),
                    datasets: [
                      {
                        data: motivos.map((m) => m.valor),
                        backgroundColor: [p.warn, p.review, p.bad, p.blue],
                        borderColor: p.surface,
                        borderWidth: 2,
                      },
                    ],
                  },
                  options: opcoesDeRosca(p),
                };
              }}
            />
          </div>
        </article>
      </section>

      <section className="oper-grid">
        <article className="panel panel-pad">
          <span className="eyebrow">Território</span>
          <h2 className="title">Top unidades por inscritos</h2>
          <p className="hint">Clique em uma unidade para recortar o painel.</p>
          <div className="chart-wrap short">
            <Grafico
              id="chartUnidades"
              tipo="bar"
              rotulo="Unidades com mais inscritos"
              dependencias={[unidades, tema]}
              montar={() => {
                const p = paletaDoPainel(escuro);
                return {
                  data: {
                    labels: unidades.map((u) => truncar(u.rotulo, 24)),
                    datasets: [
                      {
                        label: "Inscritos",
                        data: unidades.map((u) => u.valor),
                        backgroundColor: p.review,
                        borderRadius: 7,
                      },
                    ],
                  },
                  options: opcoesDeBarras(p, {
                    deitado: true,
                    dica: {
                      title: (itens) =>
                        unidades[itens[0].dataIndex]?.rotulo || "",
                    },
                    aoClicar: (indice) =>
                      unidades[indice] &&
                      unidades[indice].rotulo !== "Sem unidade" &&
                      filtrar.current("unidade", unidades[indice].rotulo),
                  }),
                };
              }}
            />
          </div>
        </article>
        <article className="panel panel-pad">
          <span className="eyebrow">Ação imediata</span>
          <h2 className="title">Pendências</h2>
          <p className="hint">Clique em um item para recortar a tabela.</p>
          <Pendencias
            pendencias={pendencias}
            carregado={carregado}
            filtros={filtros}
            aoFiltrar={aoFiltrar}
          />
        </article>
      </section>
    </>
  );
}
