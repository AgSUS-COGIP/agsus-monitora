import { useEffect, useMemo, useRef } from "react";
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
} from "../../lib/selecao-do-painel.js";
import { paletaDoPainel } from "../../lib/tema-do-painel.js";
import { MultiSelectBusca } from "../multi-select-busca.jsx";
import { Grafico } from "../recursos/grafico.jsx";
import { classes, usarAlturaDoTopo } from "../recursos/paineis.jsx";

/*
  Os blocos do painel de seleção, na ordem e com os textos do antigo painel
  externo "AgSUS Monitora Recrutamento e Seleção" (Apps Script): cabeçalho,
  "Refinar resultados" com quatro filtros de escolha múltipla, sete KPIs, a
  frase do recorte, cinco gráficos e os alertas da coluna Observação. As
  classes são as do painel de análises (o antigo já era uma cópia dele); o que
  é só da seleção está em src/selecao/selecao.css.
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
          <h1>AgSUS Monitora Recrutamento e Seleção</h1>
          <p className="sub">{subtitulo}</p>
        </div>
      </div>
      <div className="top-actions">
        <span className="status-pill">
          <span className="dot" />
          <span id="updatedText">{status}</span>
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

export function Filtros({ filtros, opcoes, area, carregado, aoMudar }) {
  const ativos = filtrosAtivos(filtros, area);
  return (
    <section
      className="panel filter-panel selecao-filtros"
      aria-labelledby="selecaoFiltrosTitulo"
    >
      <div className="filter-head">
        <div>
          <span className="eyebrow">Filtros da visualização</span>
          <h2 className="title" id="selecaoFiltrosTitulo">
            Refinar resultados
          </h2>
        </div>
      </div>

      <div className="selecao-filtros-grade">
        {CAMPOS_DO_FILTRO.map(({ campo, rotulo, todos }) => (
          <div className="field" key={campo}>
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

      <div id="filterChips" className="chips" aria-label="Filtros aplicados">
        {ativos.map(({ campo, rotulo, valores }) => (
          <button
            key={campo}
            type="button"
            className="chip-filter"
            title={`Tirar o filtro ${rotulo}`}
            onClick={() => aoMudar(campo, [])}
          >
            <b>{rotulo}</b>{" "}
            {valores.length > 2
              ? `${valores.length} selecionados`
              : valores.join(", ")}{" "}
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        ))}
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
    <section
      className="kpis selecao-kpis"
      id="kpiGrid"
      aria-label="Indicadores do recorte"
    >
      <Kpi chave="inscritos" rotulo="Inscritos" valor={n(k.inscritos)} />
      <Kpi cor="k-green" chave="aptos" rotulo="Aptos" valor={n(k.aptos)} />
      <Kpi
        cor="k-yellow"
        chave="triados"
        rotulo="Triados"
        valor={n(k.triados)}
      />
      <Kpi
        cor="k-orange"
        chave="convocados"
        rotulo="Convocados entrevista"
        valor={n(k.convocados)}
        titulo="Das entrevistas do MONITORA quando o edital tem; senão, da planilha Auditoria"
      />
      <Kpi
        cor="k-green"
        chave="aprovados"
        rotulo="Aprovados"
        valor={n(k.aprovados)}
        titulo="Da lista de aprovados vigente de cada edital"
      />
      <Kpi
        chave="contratados"
        rotulo="Contratados"
        valor={n(k.contratados)}
        titulo="Status Contratado ou Migração na lista de aprovados"
      />
      <Kpi
        cor="k-slate"
        chave="taxa"
        rotulo="Taxa contratação"
        valor={formatarTaxa(k.taxa)}
        titulo="Contratados / aprovados"
      />
    </section>
  );
}

/* ── Recorte ativo ──────────────────────────────────────────────────── */

export function Recorte({ texto }) {
  return (
    <div id="activeContextSummary" className="selecao-recorte">
      {texto}
    </div>
  );
}

/* ── Gráficos ───────────────────────────────────────────────────────── */

/* O número em cima (ou ao lado) de cada barra, como no painel antigo. */
const rotuloDeValor = {
  id: "selecaoRotuloDeValor",
  afterDatasetsDraw(grafico) {
    const { ctx } = grafico;
    const deitado = grafico.options.indexAxis === "y";
    const cor = grafico.options.plugins?.selecaoRotuloDeValor?.cor || "#20324a";
    grafico.data.datasets.forEach((conjunto, i) => {
      grafico.getDatasetMeta(i).data.forEach((barra, j) => {
        const valor = conjunto.data[j];
        if (!valor) return;
        const { x, y } = barra.tooltipPosition();
        ctx.save();
        ctx.fillStyle = cor;
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
const textoNoCentro = {
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
    ctx.fillStyle = cfg.cor;
    ctx.font = "800 28px Geist, system-ui, sans-serif";
    ctx.fillText(cfg.principal || "", x, y - 8);
    ctx.fillStyle = cfg.corSecundaria;
    ctx.font = "400 12px Geist, system-ui, sans-serif";
    ctx.fillText(cfg.secundario || "", x, y + 24);
    ctx.restore();
  },
};

function opcoesDeBarras(p, { deitado = false, aoClicar, dica } = {}) {
  const categorias = {
    ticks: { color: p.text, maxRotation: 0, autoSkip: false },
    grid: { display: false },
  };
  const valores = {
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
          if (elementos.length) aoClicar(elementos[0].index);
        }
      : undefined,
  };
}

function opcoesDeRosca(p, extra = {}) {
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

const CINZA = "#cbd2dc";

function Bloco({ sobretitulo, titulo, texto, classe, altura, children }) {
  return (
    <article className={classes("panel panel-pad selecao-grafico", classe)}>
      <span className="eyebrow">{sobretitulo}</span>
      <h2 className="title">{titulo}</h2>
      <p className="hint">{texto}</p>
      <div className={classes("chart-wrap", altura)}>{children}</div>
    </article>
  );
}

export function Graficos({
  vagas,
  indicadores,
  area,
  escuro,
  aoFiltrarUnidade,
}) {
  const eliminados = useMemo(() => eliminadosAntesDaAnalise(vagas), [vagas]);
  const aptos = useMemo(() => aptosEEliminados(vagas), [vagas]);
  const analise = useMemo(() => triadosEReprovados(vagas), [vagas]);
  const unidades = useMemo(() => topUnidades(vagas, 10), [vagas]);
  const tema = escuro ? "escuro" : "claro";
  const taxa = indicadores.taxa ?? 0;
  const unidade = rotuloDaUnidade(area) === "Nome DSEI" ? "DSEIs" : "unidades";

  const filtrar = useRef(aoFiltrarUnidade);
  useEffect(() => {
    filtrar.current = aoFiltrarUnidade;
  });

  return (
    <section className="selecao-graficos" id="chartsArea">
      <Bloco
        classe="metade"
        sobretitulo="Eliminações"
        titulo="Eliminados antes da análise"
        texto="Cancelados, questionários não finalizados e eliminados por nota."
      >
        <Grafico
          id="chartEliminados"
          tipo="bar"
          rotulo="Eliminados antes da análise: cancelados, questionário não finalizado e eliminados por nota"
          plugins={[rotuloDeValor]}
          dependencias={[eliminados, tema]}
          montar={() => {
            const p = paletaDoPainel(escuro);
            return {
              data: {
                labels: eliminados.map((e) => e.rotulo),
                datasets: [
                  {
                    label: "Candidatos",
                    data: eliminados.map((e) => e.valor),
                    backgroundColor: [p.warn, p.review, p.bad],
                    borderRadius: 7,
                  },
                ],
              },
              options: opcoesDeBarras(p),
            };
          }}
        />
      </Bloco>

      <Bloco
        classe="metade"
        sobretitulo="Análise curricular"
        titulo="Aptos na análise e eliminados"
        texto="Composição entre aptos para análise e eliminados totais."
      >
        <Grafico
          id="chartAptos"
          tipo="doughnut"
          rotulo="Aptos para análise e eliminados"
          dependencias={[aptos, tema]}
          montar={() => {
            const p = paletaDoPainel(escuro);
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
      </Bloco>

      <Bloco
        classe="metade"
        sobretitulo="Contratação"
        titulo="Contratados"
        texto="Percentual de contratados em relação ao total de aprovados."
      >
        <Grafico
          id="chartContratados"
          tipo="doughnut"
          rotulo={`Contratados: ${formatarTaxa(indicadores.taxa)} dos aprovados`}
          plugins={[textoNoCentro]}
          dependencias={[indicadores.aprovados, indicadores.contratados, tema]}
          montar={() => {
            const p = paletaDoPainel(escuro);
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
                    data: contratados || resto ? [contratados, resto] : [0, 1],
                    backgroundColor: [p.blue, CINZA],
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
                    cor: escuro ? "#f5f8fc" : "#20324a",
                    corSecundaria: p.text,
                  },
                },
              }),
            };
          }}
        />
      </Bloco>

      <Bloco
        classe="metade"
        sobretitulo="Resultado da análise"
        titulo="Triados e reprovados na análise"
        texto="Comparativo operacional da etapa de análise."
      >
        <Grafico
          id="chartAnalise"
          tipo="bar"
          rotulo="Triados e reprovados na análise"
          plugins={[rotuloDeValor]}
          dependencias={[analise, tema]}
          montar={() => {
            const p = paletaDoPainel(escuro);
            return {
              data: {
                labels: analise.map((a) => a.rotulo),
                datasets: [
                  {
                    label: "Candidatos",
                    data: analise.map((a) => a.valor),
                    backgroundColor: [p.review, p.bad],
                    borderRadius: 7,
                  },
                ],
              },
              options: opcoesDeBarras(p),
            };
          }}
        />
      </Bloco>

      <Bloco
        classe="inteiro"
        altura="alto"
        sobretitulo="Distribuição"
        titulo={`Top ${unidade} por inscritos`}
        texto="Ranking do recorte ativo para identificar concentração de volume. Clique numa barra para filtrar."
      >
        <Grafico
          id="chartDsei"
          tipo="bar"
          rotulo={`Top ${unidade} por inscritos`}
          plugins={[rotuloDeValor]}
          dependencias={[unidades, tema]}
          montar={() => {
            const p = paletaDoPainel(escuro);
            return {
              data: {
                labels: unidades.map((u) => truncar(u.rotulo, 34)),
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
                  title: (itens) => unidades[itens[0].dataIndex]?.rotulo || "",
                },
                aoClicar: (indice) =>
                  unidades[indice] &&
                  unidades[indice].rotulo !== "Sem unidade" &&
                  filtrar.current(unidades[indice].rotulo),
              }),
            };
          }}
        />
      </Bloco>
    </section>
  );
}

/* ── Observações ────────────────────────────────────────────────────── */

export function Observacoes({ observacoes }) {
  if (!observacoes.length) return null;
  return (
    <section
      className="panel panel-pad selecao-observacoes"
      id="observationsSection"
      aria-labelledby="selecaoObservacoesTitulo"
    >
      <span className="eyebrow">Observações</span>
      <h2 className="title" id="selecaoObservacoesTitulo">
        Alertas identificados no recorte
      </h2>
      <p className="hint">
        Lista única das observações informadas na planilha Auditoria.
      </p>
      <ul className="selecao-observacoes-lista" id="observationsList">
        {observacoes.map((o) => (
          <li key={o.texto}>
            <span className="selecao-observacao-icone" aria-hidden="true">
              !
            </span>
            <div>
              <div className="selecao-observacao-titulo">{o.texto}</div>
              <div className="selecao-observacao-texto">
                {o.vagas} {o.vagas === 1 ? "vaga" : "vagas"} ·{" "}
                {truncar(o.unidades.join(", "), 120) || "sem unidade"} · Edital{" "}
                {o.editais.join(", ")}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
