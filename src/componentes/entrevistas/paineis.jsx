import { useEffect, useMemo, useRef } from "react";
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
import {
  CardDeGrafico,
  ChipDeFiltro,
  ChipsDeFiltro,
  classes,
  EstadoVazio,
  GradeDeKpis,
  Kpi,
  PainelDeFiltros,
  TopoDoPainel,
} from "../../ui/index.js";
import { Grafico } from "../recursos/grafico.jsx";
import { Segmentado } from "./partes.jsx";

/*
  Os blocos do painel de entrevistas, com a marcação e as classes do painel de
  análises (e do de recursos, que é o mesmo desenho): o cabeçalho fixo
  (`.topbar`), "Refinar resultados" (`.filter-panel`), os KPIs (`.kpis` >
  `.kpi`), o recorte (`.context-line`), os gráficos Chart.js em `.panel`
  (`.oper-grid`) e as pendências (`.attention-list`). A visão "Resultados" é
  só leitura; o cabeçalho troca de visão (Resultados, Conduzir entrevistas,
  Roteiros).
*/

const truncar = (valor, limite) => {
  const texto = String(valor ?? "").trim();
  return texto.length > limite ? `${texto.slice(0, limite - 1)}…` : texto;
};

/* ── Cabeçalho ──────────────────────────────────────────────────────── */

/* Exportar só na visão "Resultados". */
export function Topo({
  visoes = null,
  visao = "resultados",
  aoTrocarVisao,
  aoExportar,
  ...props
}) {
  return (
    <TopoDoPainel
      titulo="Painel de entrevistas"
      visoes={
        visoes ? (
          <Segmentado
            rotulo="Visão do painel"
            className="entrevistas-visoes"
            opcoes={visoes}
            valor={visao}
            aoMudar={aoTrocarVisao}
          />
        ) : null
      }
      aoExportar={visao === "resultados" ? aoExportar : undefined}
      {...props}
    />
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
  const ativos = filtrosAtivos(filtros, opcoes);

  return (
    <PainelDeFiltros
      idDoTitulo="entrevistasFiltrosTitulo"
      quantos={ativos.length}
      aoLimpar={aoLimpar}
    >
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
    <GradeDeKpis id="kpiGrid" rotulo="Indicadores">
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
    </GradeDeKpis>
  );
}

/* ── Recorte ativo ──────────────────────────────────────────────────── */

export function Recorte({ ativos }) {
  return (
    <section className="panel panel-pad">
      <div id="contextLine" className="context-line">
        {ativos.length
          ? `Recorte ativo: ${ativos.map(([, rotulo, valor]) => `${rotulo}: ${valor}`).join(" · ")}`
          : "Sem filtros"}
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
        <EstadoVazio>Nenhuma pendência no recorte atual.</EstadoVazio>
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
        <CardDeGrafico titulo="Aptos x Inaptos" altura="short">
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
        </CardDeGrafico>
        <CardDeGrafico titulo="Comparecimento" altura="short">
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
        </CardDeGrafico>
      </section>

      <section className="oper-grid">
        <article className="panel panel-pad">
          <h2 className="title">Faixas de nota final</h2>
          <p className="hint">0 a 20 · presentes</p>
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
          <h2 className="title">Pendências</h2>
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
          <h2 className="title">Média por critério</h2>
          <p className="hint">Escala 0–5</p>
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
        <CardDeGrafico titulo="Top unidades por entrevistados" altura="short">
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
        </CardDeGrafico>
      </section>
    </>
  );
}
