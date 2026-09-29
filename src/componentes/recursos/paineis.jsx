import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatNumberBR } from "../../lib/formatters.js";
import {
  esteiraDosRecursos,
  FILTROS_VAZIOS,
  impactoNoResultado,
  recursosPorAnalista,
  recursosPorSituacao,
} from "../../lib/recursos-dos-candidatos.js";
import { paletaDoPainel } from "../../lib/tema-do-painel.js";
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

export const classes = (...lista) => lista.filter(Boolean).join(" ");

const truncar = (valor, limite) => {
  const texto = String(valor ?? "").trim();
  return texto.length > limite ? `${texto.slice(0, limite - 1)}…` : texto;
};

/* ── Cabeçalho ──────────────────────────────────────────────────────── */

/*
  O `.topbar` é fixo; a altura dele vira `--topbar-height`, que empurra o
  conteúdo (`.shell`) e o cabeçalho da tabela — como o `setupFixedTopbar` do
  painel de análises, acompanhando também a quebra de linha dos botões.
*/
function usarAlturaDoTopo(topo) {
  useLayoutEffect(() => {
    const barra = topo.current;
    if (!barra) return undefined;
    const medir = () =>
      document.documentElement.style.setProperty(
        "--topbar-height",
        `${barra.offsetHeight}px`,
      );
    medir();
    if (typeof ResizeObserver === "function") {
      const observador = new ResizeObserver(medir);
      observador.observe(barra);
      return () => observador.disconnect();
    }
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [topo]);
}

export function Topo({
  subtitulo,
  status,
  somenteConsulta,
  escuro,
  aoTema,
  aoTelaCheia,
  aoAtualizar,
  atualizarDesativado,
  aoExportar,
  exportarDesativado,
  aoNovo,
  novoDesativado,
  aoModelos,
}) {
  const topo = useRef(null);
  usarAlturaDoTopo(topo);
  const rotuloDoTema = escuro ? "Usar tema claro" : "Usar tema escuro";
  return (
    <header className="topbar" id="topbar" ref={topo}>
      <div className="brand">
        <div>
          <h1>Painel de recursos</h1>
          <p className="sub">{subtitulo}</p>
        </div>
      </div>
      <div className="top-actions">
        <span className="status-pill">
          <span className="dot" />
          <span id="updatedText">{status}</span>
        </span>
        {somenteConsulta ? (
          <span className="status-pill" title="Seu acesso só consulta">
            <i className="fa-solid fa-eye" aria-hidden="true" /> Somente
            consulta
          </span>
        ) : null}
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
      </div>
    </header>
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
  const [recolhido, setRecolhido] = useState(false);
  const [maisOpcoes, setMaisOpcoes] = useState(false);
  const ativos = filtrosAtivos(filtros, opcoes);
  const quantos = ativos.length;
  const avancados = String(filtros.busca || "").trim() ? 1 : 0;

  return (
    <section
      className={classes("panel filter-panel", recolhido && "is-collapsed")}
      aria-labelledby="recursosFiltrosTitulo"
    >
      <div className="filter-head">
        <div>
          <span className="eyebrow">Filtros da visualização</span>
          <h2 className="title" id="recursosFiltrosTitulo">
            Refinar resultados
          </h2>
          <p className="hint">
            Use os filtros para refinar os recursos exibidos. Indicadores,
            gráficos, a fila e o CSV são atualizados conforme o recorte
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
            title={
              recolhido
                ? "Mostrar os filtros da visualização"
                : "Ocultar os filtros da visualização"
            }
            onClick={() => {
              setRecolhido((atual) => !atual);
              setMaisOpcoes(false);
            }}
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
            title="Remove os filtros e volta a todos os recursos da área."
            onClick={aoLimpar}
          >
            Limpar tudo
          </button>
        </div>
      </div>

      <div id="filtersBody" className="filters-body" hidden={recolhido}>
        <div id="filtersToolbar" className="filters-toolbar">
          <div className="filters-toolbar-copy">
            <strong>Filtros principais</strong>
            <small>Edital, origem, analista, situação e pendência.</small>
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

/*
  Cartão de KPI do painel de análises: `.kpi` com a barra colorida em cima
  (`k-cyan`, `k-green`, `k-yellow`, `k-red`, `k-purple`), o rótulo e o número
  grande. Os que filtram são botões com `aria-pressed`, como lá.
*/
function Kpi({ cor, rotulo, valor, sufixo = "", chave, ativo, aoFiltrar }) {
  const numero = `${formatNumberBR(valor)}${sufixo}`;
  if (!aoFiltrar)
    return (
      <article className={classes("kpi", cor)} data-kpi={chave}>
        <span>{rotulo}</span>
        <b>{numero}</b>
      </article>
    );
  return (
    <article
      className={classes("kpi", cor, ativo && "is-active")}
      data-kpi={chave}
    >
      <button
        type="button"
        aria-pressed={ativo}
        title="Filtrar o painel"
        onClick={aoFiltrar}
      >
        <span>{rotulo}</span>
        <b>{numero}</b>
      </button>
    </article>
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
    <section className="kpis" id="kpiGrid" aria-label="Indicadores">
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
    </section>
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
    <section
      className="kpis recursos-kpis-respostas"
      id="kpiGridRespostas"
      aria-label="Indicadores das respostas"
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
    </section>
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
          : "Sem filtros aplicados. Recorte base: todos os recursos da área."}
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
                {formatNumberBR(pelaAbertura)} com o prazo pelo fim do prazo de
                recurso (*)
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
                {p.valor === 1 ? "recurso" : "recursos"} · {p.subtitulo}
              </small>
            </button>
          );
        })
      ) : (
        <div className="empty">
          Nenhuma pendência prioritária no recorte atual.
        </div>
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
        <article className="panel panel-pad">
          <span className="eyebrow">Carga operacional</span>
          <h2 className="title">Recursos por analista</h2>
          <p className="hint">
            Barras empilhadas por situação. Clique em um analista para recortar
            a fila.
          </p>
          <div className="chart-wrap short">
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
          </div>
        </article>
        <article className="panel panel-pad">
          <span className="eyebrow">Ação imediata</span>
          <h2 className="title">Pendências prioritárias</h2>
          <p className="hint">
            Clique em um item para aplicar o recorte correspondente na fila.
          </p>
          <Pendencias
            pendencias={pendencias}
            carregado={carregado}
            filtros={filtros}
            aoFiltrar={aoFiltrar}
          />
        </article>
      </section>

      <section className="oper-grid">
        <article className="panel panel-pad">
          <span className="eyebrow">Decisão</span>
          <h2 className="title">Situação</h2>
          <p className="hint">
            Recursos por situação. Clique em uma barra para recortar a fila.
          </p>
          <div className="chart-wrap short">
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
          </div>
        </article>
        <article className="panel panel-pad">
          <span className="eyebrow">Resultado</span>
          <h2 className="title">Impacto no resultado</h2>
          <p className="hint">
            A nota mudou quando a nota atual da análise difere da do cadastro.
          </p>
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

      <section className="panel panel-pad trend">
        <span className="eyebrow">Evolução</span>
        <h2 className="title">Esteira do recurso</h2>
        <p className="hint">
          Quantos recursos do recorte já passaram por cada etapa, do cadastro à
          resposta ao candidato.
        </p>
        <div className="chart-wrap">
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
        </div>
      </section>
    </>
  );
}
