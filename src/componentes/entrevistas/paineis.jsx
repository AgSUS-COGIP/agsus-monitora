import { useEffect, useMemo, useRef, useState } from "react";
import { formatNumberBR } from "../../lib/formatters.js";
import {
  contagemPorComparecimento,
  contagemPorParecer,
  faixasDeNota,
  FILTROS_VAZIOS,
  formatarNota,
  mediaPorCriterio,
  topUnidades,
} from "../../lib/entrevistas-do-painel.js";
import { paletaDoPainel } from "../../lib/tema-do-painel.js";
import { Grafico } from "../recursos/grafico.jsx";
import { classes, usarAlturaDoTopo } from "../recursos/paineis.jsx";

/*
  Os blocos do painel de entrevistas, com a marcação e as classes do painel de
  análises (e do de recursos, que é o mesmo desenho): o cabeçalho fixo
  (`.topbar`), "Refinar resultados" (`.filter-panel`), os KPIs (`.kpis` >
  `.kpi`), o recorte (`.context-line`), os gráficos Chart.js em `.panel`
  (`.oper-grid`) e as pendências (`.attention-list`). Só leitura: sem botões
  de cadastro.
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
          <h1>Painel de entrevistas</h1>
          <p className="sub">{subtitulo}</p>
        </div>
      </div>
      <div className="top-actions">
        <span className="status-pill">
          <span className="dot" />
          <span id="updatedText">{status}</span>
        </span>
        <span className="status-pill" title="Nesta fase o painel só consulta">
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
  ["unidade", "Unidade (DSEI)", "unidades", "Todas as unidades"],
  ["edital", "Edital", "editais", "Todos os editais"],
  ["cargo", "Cargo", "cargos", "Todos os cargos"],
  ["parecer", "Parecer", "pareceres", "Todos os pareceres"],
  ["comparecimento", "Comparecimento", "comparecimentos", "Todos"],
  ["modalidade", "Modalidade", "modalidades", "Todas as modalidades"],
  ["ligacao", "Situação da ligação", "ligacoes", "Todas as situações"],
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
      aria-labelledby="entrevistasFiltrosTitulo"
    >
      <div className="filter-head">
        <div>
          <span className="eyebrow">Filtros da visualização</span>
          <h2 className="title" id="entrevistasFiltrosTitulo">
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
            title="Remove os filtros e volta a todas as entrevistas da área."
            onClick={aoLimpar}
          >
            Limpar tudo
          </button>
        </div>
      </div>

      <div id="filtersBody" className="filters-body" hidden={recolhido}>
        <div className="filter-grid">
          <div className="field">
            <label htmlFor="filtro-busca">Buscar candidato</label>
            <input
              id="filtro-busca"
              type="search"
              name="busca"
              value={filtros.busca}
              disabled={!carregado}
              placeholder="Nome ou código do candidato"
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

function Kpi({ cor, rotulo, valor, chave, ativo, aoClicar, titulo }) {
  if (!aoClicar)
    return (
      <article className={classes("kpi", cor)} data-kpi={chave}>
        <span>{rotulo}</span>
        <b>{valor}</b>
      </article>
    );
  return (
    <article
      className={classes("kpi", cor, ativo && "is-active")}
      data-kpi={chave}
    >
      <button
        type="button"
        aria-pressed={ativo === undefined ? undefined : ativo}
        title={titulo || "Filtrar o painel"}
        onClick={aoClicar}
      >
        <span>{rotulo}</span>
        <b>{valor}</b>
      </button>
    </article>
  );
}

export function Indicadores({
  indicadores: k,
  carregado,
  filtros,
  aoFiltrar,
  aoAbrirSemEntrevista,
}) {
  const filtro = (campo, valor) =>
    carregado
      ? {
          ativo: filtros[campo] === valor,
          aoClicar: () => aoFiltrar(campo, valor),
        }
      : {};
  const n = (valor) => formatNumberBR(valor);
  return (
    <section className="kpis" id="kpiGrid" aria-label="Indicadores">
      <Kpi
        cor="k-cyan"
        chave="vagas"
        rotulo="Vagas com entrevista"
        valor={n(k.vagas)}
      />
      <Kpi chave="candidatos" rotulo="Candidatos" valor={n(k.candidatos)} />
      <Kpi
        cor="k-green"
        chave="compareceram"
        rotulo="Compareceram"
        valor={n(k.compareceram)}
        {...filtro("comparecimento", "S")}
      />
      <Kpi
        cor="k-green"
        chave="aptos"
        rotulo="Aptos"
        valor={n(k.aptos)}
        {...filtro("parecer", "APTO")}
      />
      <Kpi
        cor="k-red"
        chave="inaptos"
        rotulo="Inaptos"
        valor={n(k.inaptos)}
        {...filtro("parecer", "INAPTO")}
      />
      <Kpi
        cor="k-purple"
        chave="media"
        rotulo="Média das notas"
        valor={formatarNota(k.media)}
      />
      <Kpi
        cor="k-yellow"
        chave="sem-entrevista"
        rotulo="Aprovados na análise sem entrevista"
        valor={n(k.semEntrevista)}
        titulo="Ver a lista dos aprovados sem entrevista"
        aoClicar={carregado ? aoAbrirSemEntrevista : undefined}
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
          : "Sem filtros aplicados. Recorte base: todas as entrevistas da área."}
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
const ITENS_DO_ESQUELETO = 4;

function Pendencias({
  pendencias,
  carregado,
  filtros,
  aoFiltrar,
  aoAbrirSemEntrevista,
}) {
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
          const abreLista = p.chave === "sem_entrevista";
          const ativo = !abreLista && filtros.ligacao === p.chave;
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
              aria-pressed={abreLista ? undefined : ativo}
              onClick={() =>
                abreLista
                  ? aoAbrirSemEntrevista()
                  : aoFiltrar("ligacao", p.chave)
              }
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

function opcoesDeBarras(
  p,
  { deitado = false, aoClicar, dica, maximo, decimais = false } = {},
) {
  const categorias = {
    ticks: { color: p.text, maxRotation: 0, autoSkip: false },
    grid: { display: false },
  };
  const valores = {
    beginAtZero: true,
    ...(maximo ? { suggestedMax: maximo } : {}),
    ticks: { color: p.text, ...(decimais ? {} : { precision: 0 }) },
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

function opcoesDeRosca(p, { aoClicar } = {}) {
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
    onClick: aoClicar
      ? (_, elementos) => {
          if (elementos.length) aoClicar(elementos[0].index);
        }
      : undefined,
  };
}

const CINZA = "#94a3b8";

export function Graficos({
  entrevistas,
  criterios,
  pendencias,
  carregado,
  filtros,
  aoFiltrar,
  aoAbrirSemEntrevista,
  escuro,
}) {
  const pareceres = useMemo(
    () => contagemPorParecer(entrevistas),
    [entrevistas],
  );
  const comparecimentos = useMemo(
    () => contagemPorComparecimento(entrevistas),
    [entrevistas],
  );
  const faixas = useMemo(() => faixasDeNota(entrevistas), [entrevistas]);
  const porCriterio = useMemo(
    () => mediaPorCriterio(entrevistas, criterios),
    [entrevistas, criterios],
  );
  const unidades = useMemo(() => topUnidades(entrevistas, 10), [entrevistas]);
  const tema = escuro ? "escuro" : "claro";

  const filtrar = useRef(aoFiltrar);
  useEffect(() => {
    filtrar.current = aoFiltrar;
  });

  return (
    <>
      <section className="oper-grid entrevistas-grade-dupla">
        <article className="panel panel-pad">
          <span className="eyebrow">Parecer</span>
          <h2 className="title">Aptos x Inaptos</h2>
          <p className="hint">Clique em uma fatia para recortar o painel.</p>
          <div className="chart-wrap short">
            <Grafico
              id="chartParecer"
              tipo="doughnut"
              rotulo="Entrevistas por parecer: aptos, inaptos e sem parecer"
              dependencias={[pareceres, tema]}
              montar={() => {
                const p = paletaDoPainel(escuro);
                return {
                  data: {
                    labels: pareceres.map((x) => x.rotulo),
                    datasets: [
                      {
                        data: pareceres.map((x) => x.valor),
                        backgroundColor: [p.ok, p.bad, CINZA],
                        borderColor: p.surface,
                        borderWidth: 2,
                      },
                    ],
                  },
                  options: opcoesDeRosca(p, {
                    aoClicar: (indice) =>
                      pareceres[indice] &&
                      filtrar.current("parecer", pareceres[indice].id),
                  }),
                };
              }}
            />
          </div>
        </article>
        <article className="panel panel-pad">
          <span className="eyebrow">Presença</span>
          <h2 className="title">Comparecimento</h2>
          <p className="hint">Clique em uma fatia para recortar o painel.</p>
          <div className="chart-wrap short">
            <Grafico
              id="chartComparecimento"
              tipo="doughnut"
              rotulo="Entrevistas por comparecimento"
              dependencias={[comparecimentos, tema]}
              montar={() => {
                const p = paletaDoPainel(escuro);
                return {
                  data: {
                    labels: comparecimentos.map((x) => x.rotulo),
                    datasets: [
                      {
                        data: comparecimentos.map((x) => x.valor),
                        backgroundColor: [p.review, p.warn, CINZA],
                        borderColor: p.surface,
                        borderWidth: 2,
                      },
                    ],
                  },
                  options: opcoesDeRosca(p, {
                    aoClicar: (indice) =>
                      comparecimentos[indice] &&
                      filtrar.current(
                        "comparecimento",
                        comparecimentos[indice].id,
                      ),
                  }),
                };
              }}
            />
          </div>
        </article>
      </section>

      <section className="oper-grid">
        <article className="panel panel-pad">
          <span className="eyebrow">Desempenho</span>
          <h2 className="title">Faixas de nota final</h2>
          <p className="hint">
            Nota total da entrevista (0 a 20), entre quem compareceu.
          </p>
          <div className="chart-wrap short">
            <Grafico
              id="chartFaixas"
              tipo="bar"
              rotulo="Candidatos que compareceram por faixa de nota final"
              dependencias={[faixas, tema]}
              montar={() => {
                const p = paletaDoPainel(escuro);
                return {
                  data: {
                    labels: faixas.map((f) => f.rotulo),
                    datasets: [
                      {
                        label: "Candidatos",
                        data: faixas.map((f) => f.valor),
                        backgroundColor: [p.bad, p.warn, p.review, p.ok],
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
        <article className="panel panel-pad">
          <span className="eyebrow">Ação imediata</span>
          <h2 className="title">Pendências</h2>
          <p className="hint">
            Clique em um item para recortar a tabela (ou ver a lista dos
            aprovados sem entrevista).
          </p>
          <Pendencias
            pendencias={pendencias}
            carregado={carregado}
            filtros={filtros}
            aoFiltrar={aoFiltrar}
            aoAbrirSemEntrevista={aoAbrirSemEntrevista}
          />
        </article>
      </section>

      <section className="oper-grid entrevistas-grade-dupla">
        <article className="panel panel-pad">
          <span className="eyebrow">Critérios</span>
          <h2 className="title">Média por critério</h2>
          <p className="hint">
            Média das notas lançadas em cada critério (em geral, de 0 a 5).
            Passe o mouse para ver o texto completo.
          </p>
          <div className="chart-wrap short">
            <Grafico
              id="chartCriterios"
              tipo="bar"
              rotulo="Média das notas por critério da entrevista"
              dependencias={[porCriterio, tema]}
              montar={() => {
                const p = paletaDoPainel(escuro);
                return {
                  data: {
                    labels: porCriterio.map((c) => truncar(c.rotulo, 26)),
                    datasets: [
                      {
                        label: "Média",
                        data: porCriterio.map((c) =>
                          c.media === null ? 0 : Number(c.media.toFixed(2)),
                        ),
                        backgroundColor: p.blue,
                        borderRadius: 7,
                      },
                    ],
                  },
                  options: opcoesDeBarras(p, {
                    deitado: true,
                    maximo: 5,
                    decimais: true,
                    dica: {
                      title: (itens) =>
                        porCriterio[itens[0].dataIndex]?.texto || "",
                      label: (item) =>
                        `Média ${formatarNota(item.parsed.x)} · ${formatNumberBR(porCriterio[item.dataIndex]?.quantidade || 0)} nota(s)`,
                    },
                  }),
                };
              }}
            />
          </div>
        </article>
        <article className="panel panel-pad">
          <span className="eyebrow">Território</span>
          <h2 className="title">Top unidades por entrevistados</h2>
          <p className="hint">Clique em uma unidade para recortar o painel.</p>
          <div className="chart-wrap short">
            <Grafico
              id="chartUnidades"
              tipo="bar"
              rotulo="Unidades com mais entrevistados"
              dependencias={[unidades, tema]}
              montar={() => {
                const p = paletaDoPainel(escuro);
                return {
                  data: {
                    labels: unidades.map((u) => truncar(u.rotulo, 24)),
                    datasets: [
                      {
                        label: "Entrevistados",
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
      </section>
    </>
  );
}
